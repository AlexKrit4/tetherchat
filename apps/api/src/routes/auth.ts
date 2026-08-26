import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { LIMITS, USERNAME_PATTERN } from '@tetherchat/shared';
import type { AuthResponse, Session, TotpChallenge, TotpSetup, QrLoginPollResult, QrLoginStart } from '@tetherchat/shared';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { enqueue } from '../jobs/queue.js';
import { dailyAdminCredentials } from '../lib/adminCredentials.js';
import { publicUserSelect, toSelfUser } from '../lib/serialize.js';
import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  otpauthUrl,
  qrDataUrl,
  verifyTotp,
} from '../lib/totp.js';
import { assertPlatformAdmin, activeSiteBan, banLoginMessage, syncPlatformAdminFlag } from '../lib/platformAdmin.js';
import { isReservedUsername } from '../lib/aiBot.js';
import { redis } from '../redis.js';
import {
  expiredPoll,
  parseQrLoginRecord,
  pendingPoll,
  qrLoginKey,
  qrLoginTtlSeconds,
  qrLoginUrl,
  type QrLoginRecord,
} from '../lib/qrLogin.js';
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
  totpEnabled: true,
  totpSecretEnc: true,
  isPlatformAdmin: true,
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
    if (isReservedUsername(username)) {
      throw ApiError.conflict('That username is taken');
    }

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
        isPlatformAdmin: username === 'alexkrit' && email === 'alesa89851307411@gmail.com',
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
      select: { ...selfSelect, passwordHash: true, isBot: true },
    });

    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid || user.isBot) throw ApiError.unauthorized('Неверный логин или пароль');

    const ban = await activeSiteBan(user.id);
    if (ban) throw ApiError.banned(banLoginMessage(ban));

    await syncPlatformAdminFlag(user.id);

    if (user.totpEnabled) {
      const ticket = createOpaqueToken(24).token;
      await redis().set(`totp:ticket:${ticket}`, user.id, 'EX', 300);
      const challenge: TotpChallenge = { requires2fa: true, ticket };
      reply.send(challenge);
      return;
    }

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

  app.post('/login/totp', async (request, reply) => {
    const body = z
      .object({
        ticket: z.string().min(10).max(128),
        code: z.string().min(6).max(8),
      })
      .parse(request.body);

    const userId = await redis().get(`totp:ticket:${body.ticket}`);
    if (!userId) throw ApiError.unauthorized('Код устарел, войдите снова');
    await redis().del(`totp:ticket:${body.ticket}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...selfSelect, totpSecretEnc: true },
    });
    if (!user?.totpEnabled || !user.totpSecretEnc) throw ApiError.unauthorized('Двухфакторка не настроена');

    const ban = await activeSiteBan(user.id);
    if (ban) throw ApiError.banned(banLoginMessage(ban));

    if (!verifyTotp(decryptSecret(user.totpSecretEnc), body.code)) {
      throw ApiError.unauthorized('Неверный код двухфакторки');
    }

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

  app.post('/2fa/setup', { preHandler: app.requireAuth }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { username: true, totpEnabled: true },
    });
    if (user.totpEnabled) throw ApiError.badRequest('Двухфакторка уже включена');

    const secret = generateTotpSecret();
    await redis().set(`totp:setup:${request.userId}`, encryptSecret(secret), 'EX', 600);
    const otpauth = otpauthUrl(user.username, secret);
    const payload: TotpSetup = {
      secret,
      otpauthUrl: otpauth,
      qrDataUrl: await qrDataUrl(otpauth),
    };
    return payload;
  });

  app.post('/2fa/enable', { preHandler: app.requireAuth }, async (request) => {
    const { code } = z.object({ code: z.string().min(6).max(8) }).parse(request.body);
    const packed = await redis().get(`totp:setup:${request.userId}`);
    if (!packed) throw ApiError.badRequest('Сначала начните настройку двухфакторки');
    const secret = decryptSecret(packed);
    if (!verifyTotp(secret, code)) throw ApiError.unauthorized('Неверный код двухфакторки');

    await prisma.user.update({
      where: { id: request.userId },
      data: { totpEnabled: true, totpSecretEnc: packed },
    });
    await redis().del(`totp:setup:${request.userId}`);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: selfSelect,
    });
    return toSelfUser(user);
  });

  app.post('/2fa/disable', { preHandler: app.requireAuth }, async (request) => {
    const { code, password } = z
      .object({
        code: z.string().min(6).max(8),
        password: z.string().min(1).max(LIMITS.password.max),
      })
      .parse(request.body);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { ...selfSelect, passwordHash: true, totpSecretEnc: true },
    });
    if (!user.totpEnabled || !user.totpSecretEnc) throw ApiError.badRequest('Двухфакторка не включена');
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw ApiError.unauthorized('Неверный пароль');
    }
    if (!verifyTotp(decryptSecret(user.totpSecretEnc), code)) {
      throw ApiError.unauthorized('Неверный код двухфакторки');
    }

    const updated = await prisma.user.update({
      where: { id: request.userId },
      data: { totpEnabled: false, totpSecretEnc: null },
      select: selfSelect,
    });
    return toSelfUser(updated);
  });

  app.post('/admin-credentials', { preHandler: app.requireAuth }, async (request) => {
    await assertPlatformAdmin(request.userId);
    const { code } = z.object({ code: z.string().min(6).max(8) }).parse(request.body);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.userId },
      select: { totpEnabled: true, totpSecretEnc: true },
    });
    if (!user.totpEnabled || !user.totpSecretEnc) {
      throw ApiError.badRequest('Сначала включите двухфакторку');
    }
    if (!verifyTotp(decryptSecret(user.totpSecretEnc), code)) {
      throw ApiError.unauthorized('Неверный код двухфакторки');
    }
    const creds = dailyAdminCredentials();
    return {
      login: creds.login,
      password: creds.password,
      expiresAt: creds.expiresAt.toISOString(),
      dateKey: creds.dateKey,
    };
  });

  app.post('/refresh', async (request, reply) => {
    const presented = presentedRefreshToken(request);
    if (!presented) throw ApiError.unauthorized('Missing refresh token');

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(presented) },
      include: { user: { select: selfSelect } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token is no longer valid');
    }

    const ban = await activeSiteBan(stored.userId);
    if (ban) throw ApiError.banned(banLoginMessage(ban));

    // Rotate: the presented token is burned and replaced, so a stolen copy is
    // only usable until the legitimate client refreshes once.
    const next = createRefreshToken();
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        tokenHash: next.tokenHash,
        expiresAt: next.expiresAt,
        userAgent: request.headers['user-agent'] ?? stored.userAgent,
        ip: request.ip,
        lastUsedAt: new Date(),
      },
    });

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
    const presented = presentedRefreshToken(request);
    if (presented) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(presented), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    reply.status(204).send();
  });

  app.get('/sessions', { preHandler: app.requireAuth }, async (request) => {
    const currentHash = presentedRefreshToken(request);
    const hashed = currentHash ? hashToken(currentHash) : null;
    const rows = await prisma.refreshToken.findMany({
      where: { userId: request.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    const sessions: Session[] = rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ip: row.ip,
      current: hashed !== null && row.tokenHash === hashed,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
    }));
    return sessions;
  });

  app.delete('/sessions/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const updated = await prisma.refreshToken.updateMany({
      where: { id, userId: request.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) throw ApiError.notFound('Session not found');
    reply.status(204).send();
  });

  app.post('/sessions/revoke-others', { preHandler: app.requireAuth }, async (request, reply) => {
    const current = presentedRefreshToken(request);
    if (!current) throw ApiError.unauthorized('Missing refresh token');
    await prisma.refreshToken.updateMany({
      where: {
        userId: request.userId,
        revokedAt: null,
        tokenHash: { not: hashToken(current) },
      },
      data: { revokedAt: new Date() },
    });
    reply.status(204).send();
  });

  app.post('/qr/start', async () => {
    const ticket = createOpaqueToken(24).token;
    const record: QrLoginRecord = { status: 'pending' };
    await redis().set(qrLoginKey(ticket), JSON.stringify(record), 'EX', qrLoginTtlSeconds());
    const origin = getConfig().PUBLIC_WEB_ORIGIN;
    const qrUrl = qrLoginUrl(origin, ticket);
    const payload: QrLoginStart = {
      ticket,
      expiresIn: qrLoginTtlSeconds(),
      qrUrl,
      qrDataUrl: await qrDataUrl(qrUrl),
    };
    return payload;
  });

  app.get('/qr/poll', async (request, reply) => {
    const { ticket } = z.object({ ticket: z.string().min(10).max(128) }).parse(request.query);
    const raw = await redis().get(qrLoginKey(ticket));
    const record = parseQrLoginRecord(raw);
    if (!record) {
      return expiredPoll();
    }
    if (record.status === 'pending' || !record.userId) {
      return pendingPoll();
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: selfSelect,
    });
    if (!user) {
      await redis().del(qrLoginKey(ticket));
      return expiredPoll();
    }

    const ban = await activeSiteBan(user.id);
    if (ban) throw ApiError.banned(banLoginMessage(ban));

    await redis().del(qrLoginKey(ticket));
    const tokens = await issueSession(request.headers['user-agent'], request.ip, user.id, user.username);
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
    const response: QrLoginPollResult = {
      status: 'approved',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: accessTokenTtlSeconds(),
      user: toSelfUser(user),
    };
    return response;
  });

  app.post('/qr/approve', { preHandler: app.requireAuth }, async (request) => {
    const { ticket } = z.object({ ticket: z.string().min(10).max(128) }).parse(request.body);
    const key = qrLoginKey(ticket);
    const raw = await redis().get(key);
    const record = parseQrLoginRecord(raw);
    if (!record || record.status !== 'pending') {
      throw ApiError.badRequest('QR-код устарел или уже использован');
    }

    const ban = await activeSiteBan(request.userId);
    if (ban) throw ApiError.banned(banLoginMessage(ban));

    const next: QrLoginRecord = { status: 'approved', userId: request.userId };
    const ttl = await redis().ttl(key);
    await redis().set(key, JSON.stringify(next), 'EX', ttl > 0 ? ttl : qrLoginTtlSeconds());
    return { ok: true as const };
  });

  app.post('/qr/cancel', async (request, reply) => {
    const { ticket } = z.object({ ticket: z.string().min(10).max(128) }).parse(request.body);
    await redis().del(qrLoginKey(ticket));
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

function presentedRefreshToken(request: FastifyRequest): string | undefined {
  const cookie = request.cookies[REFRESH_COOKIE];
  const header = request.headers['x-refresh-token'];
  const fromBody = (request.body as { refreshToken?: string } | undefined)?.refreshToken;
  if (typeof header === 'string' && header.length > 0) return header;
  return cookie ?? fromBody;
}

const BANNER_COLORS = ['#5865f2', '#3ba55d', '#faa81a', '#ed4245', '#eb459e', '#9b59b6'];

function randomBannerColor(): string {
  return BANNER_COLORS[Math.floor(Math.random() * BANNER_COLORS.length)];
}
