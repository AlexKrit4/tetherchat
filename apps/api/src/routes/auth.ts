import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { LIMITS, USERNAME_PATTERN } from '@tetherchat/shared';
import type { AuthResponse } from '@tetherchat/shared';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { enqueue } from '../jobs/queue.js';
import { publicUserSelect, toSelfUser } from '../lib/serialize.js';
import {
  REFRESH_COOKIE,
  accessTokenTtlSeconds,
  createOpaqueToken,
  createRefreshToken,
  hashPassword,
  hashToken,
  refreshCookieOptions,
  signAccessToken,
  verifyPassword,
} from '../lib/tokens.js';

const selfSelect = {
  ...publicUserSelect,
  email: true,
  emailVerified: true,
  enterToSend: true,
} as const;

const credentialsSchema = z.object({
  email: z.string().email().max(255),
  username: z
    .string()
    .min(LIMITS.username.min)
    .max(LIMITS.username.max)
    .regex(USERNAME_PATTERN, 'Username may contain lowercase letters, digits, dot, dash, underscore'),
  password: z.string().min(LIMITS.password.min).max(LIMITS.password.max),
  displayName: z.string().min(1).max(LIMITS.displayName.max).optional(),
});

const loginSchema = z.object({
  /** Accepts either the email address or the username. */
  login: z.string().min(1).max(255),
  password: z.string().min(1).max(LIMITS.password.max),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = credentialsSchema.parse(request.body);
    const email = body.email.toLowerCase();
    const username = body.username.toLowerCase();

    const clash = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
    if (clash) {
      throw ApiError.conflict(
        clash.email === email ? 'That email is already registered' : 'That username is taken',
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName: body.displayName ?? null,
        passwordHash: await hashPassword(body.password),
        bannerColor: randomBannerColor(),
      },
      select: selfSelect,
    });

    await sendVerificationEmail(user.id, user.email);

    const tokens = await issueSession(request.headers['user-agent'], request.ip, user.id, user.username);
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());

    const response: AuthResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: accessTokenTtlSeconds(),
      user: toSelfUser(user),
    };
    reply.status(201).send(response);
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const identifier = body.login.toLowerCase();

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: { ...selfSelect, passwordHash: true },
    });

    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) throw ApiError.unauthorized('Неверный логин или пароль');

    const tokens = await issueSession(request.headers['user-agent'], request.ip, user.id, user.username);
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());

    const response: AuthResponse = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: accessTokenTtlSeconds(),
      user: toSelfUser(user),
    };
    reply.send(response);
  });

  app.post('/refresh', async (request, reply) => {
    const cookie = request.cookies[REFRESH_COOKIE];
    const fromBody = (request.body as { refreshToken?: string } | undefined)?.refreshToken;
    const presented = cookie ?? fromBody;
    if (!presented) throw ApiError.unauthorized('Missing refresh token');

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presented) },
      include: { user: { select: selfSelect } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token is no longer valid');
    }

    // Rotate: the presented token is burned and replaced, so a stolen copy is
    // only usable until the legitimate client refreshes once.
    const next = createRefreshToken();
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: next.tokenHash,
          expiresAt: next.expiresAt,
          userAgent: request.headers['user-agent'] ?? null,
          ip: request.ip,
        },
      }),
    ]);

    reply.setCookie(REFRESH_COOKIE, next.token, refreshCookieOptions());
    const response: AuthResponse = {
      accessToken: signAccessToken({ sub: stored.userId, username: stored.user.username }),
      refreshToken: next.token,
      expiresIn: accessTokenTtlSeconds(),
      user: toSelfUser(stored.user),
    };
    reply.send(response);
  });

  app.post('/logout', async (request, reply) => {
    const fromBody = (request.body as { refreshToken?: string } | undefined)?.refreshToken;
    const presented = request.cookies[REFRESH_COOKIE] ?? fromBody;
    if (presented) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(presented), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    reply.status(204).send();
  });

  app.post('/verify-email', async (request, reply) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(request.body);
    const row = await prisma.verificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!row || row.usedAt || row.purpose !== 'email_verify' || row.expiresAt < new Date()) {
      throw ApiError.badRequest('This verification link is invalid or has expired');
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { emailVerified: true } }),
      prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);

    reply.status(204).send();
  });

  app.post('/forgot-password', async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    // Always answer 202 so the endpoint cannot be used to enumerate accounts.
    if (user) {
      const { token, tokenHash } = createOpaqueToken();
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          purpose: 'password_reset',
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      await enqueue({
        type: 'email',
        to: user.email,
        subject: 'Reset your TetherChat password',
        text: `Open ${getConfig().PUBLIC_WEB_ORIGIN}/reset-password?token=${token} to choose a new password. The link expires in one hour.`,
      });
    }

    reply.status(202).send({ ok: true });
  });

  app.post('/reset-password', async (request, reply) => {
    const { token, password } = z
      .object({
        token: z.string().min(10),
        password: z.string().min(LIMITS.password.min).max(LIMITS.password.max),
      })
      .parse(request.body);

    const row = await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.purpose !== 'password_reset' || row.expiresAt < new Date()) {
      throw ApiError.badRequest('This reset link is invalid or has expired');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      // Every existing session is dropped after a password reset.
      prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    reply.status(204).send();
  });
}

async function issueSession(
  userAgent: string | undefined,
  ip: string,
  userId: string,
  username: string,
) {
  const refresh = createRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      userAgent: userAgent ?? null,
      ip,
    },
  });
  return {
    accessToken: signAccessToken({ sub: userId, username }),
    refreshToken: refresh.token,
  };
}

async function sendVerificationEmail(userId: string, email: string) {
  const { token, tokenHash } = createOpaqueToken();
  await prisma.verificationToken.create({
    data: {
      userId,
      tokenHash,
      purpose: 'email_verify',
      expiresAt: new Date(Date.now() + 24 * 3_600_000),
    },
  });
  await enqueue({
    type: 'email',
    to: email,
    subject: 'Confirm your TetherChat email',
    text: `Welcome to TetherChat. Confirm your address: ${getConfig().PUBLIC_WEB_ORIGIN}/verify-email?token=${token}`,
  });
}

const BANNER_COLORS = ['#5865f2', '#3ba55d', '#faa81a', '#ed4245', '#eb459e', '#9b59b6'];

function randomBannerColor(): string {
  return BANNER_COLORS[Math.floor(Math.random() * BANNER_COLORS.length)];
}
