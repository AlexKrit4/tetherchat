import { afterAll, describe, expect, it } from 'vitest';
import type { AuthResponse } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { createOpaqueToken } from '../lib/tokens.js';
import { closeTestApp, createUser, testApp } from './harness.js';
import type { TestUser } from './harness.js';

const created: TestUser[] = [];

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created.map((user) => user.id) } } });
  await closeTestApp();
});

describe('auth', () => {
  it('registers a user and returns a session', async () => {
    const user = await createUser();
    created.push(user);

    expect(user.accessToken).toBeTruthy();

    const app = await testApp();
    const me = await app.inject({ method: 'GET', url: '/api/users/@me', headers: user.auth });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ username: user.username, email: user.email });
  });

  it('rejects a duplicate email or username', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const sameEmail = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: user.email, username: `other${Date.now()}`, password: 'another-secret' },
    });
    expect(sameEmail.statusCode).toBe(409);

    const sameUsername = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `other${Date.now()}@example.test`, username: user.username, password: 'another-secret' },
    });
    expect(sameUsername.statusCode).toBe(409);
  });

  it('rejects weak passwords and malformed usernames', async () => {
    const app = await testApp();

    const shortPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'short@example.test', username: 'shorty', password: 'abc' },
    });
    expect(shortPassword.statusCode).toBe(400);

    const badUsername = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'bad@example.test', username: 'Not Allowed!', password: 'long-enough-pass' },
    });
    expect(badUsername.statusCode).toBe(400);
  });

  it('logs in with either the email or the username', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    for (const login of [user.email, user.username]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { login, password: user.password },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json<AuthResponse>().user.id).toBe(user.id);
    }
  });

  it('refuses a wrong password without leaking which field failed', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: 'not-the-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('Неверный логин или пароль');
  });

  it('rotates the refresh token and invalidates the used one', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: user.password },
    });
    const firstCookie = login.cookies.find((cookie) => cookie.name === 'tc_refresh');
    expect(firstCookie?.value).toBeTruthy();
    expect(firstCookie?.httpOnly).toBe(true);

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { tc_refresh: firstCookie!.value },
    });
    expect(refreshed.statusCode).toBe(200);

    const secondCookie = refreshed.cookies.find((cookie) => cookie.name === 'tc_refresh');
    expect(secondCookie?.value).not.toBe(firstCookie?.value);

    // Replaying the old token must fail now that it has been rotated.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { tc_refresh: firstCookie!.value },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('returns a refresh token in JSON so native apps can persist a session', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: user.password },
    });
    const body = login.json<AuthResponse>();
    expect(body.refreshToken).toBeTruthy();

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: body.refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json<AuthResponse>().accessToken).toBeTruthy();
    expect(refreshed.json<AuthResponse>().refreshToken).toBeTruthy();
  });

  it('revokes the session on logout', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: user.password },
    });
    const cookie = login.cookies.find((entry) => entry.name === 'tc_refresh')!.value;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { tc_refresh: cookie },
    });
    expect(logout.statusCode).toBe(204);

    const afterLogout = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { tc_refresh: cookie },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it('requires a bearer token on protected routes', async () => {
    const app = await testApp();
    const response = await app.inject({ method: 'GET', url: '/api/users/@me' });
    expect(response.statusCode).toBe(401);

    const bogus = await app.inject({
      method: 'GET',
      url: '/api/users/@me',
      headers: { authorization: 'Bearer not.a.jwt' },
    });
    expect(bogus.statusCode).toBe(401);
  });

  it('answers the forgot-password endpoint the same way for unknown emails', async () => {
    const app = await testApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'nobody-here@example.test' },
    });
    expect(response.statusCode).toBe(202);
  });

  it('verifies email with a valid token and enables password reset', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const { token, tokenHash } = createOpaqueToken();
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        purpose: 'email_verify',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const verify = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token },
    });
    expect(verify.statusCode).toBe(204);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.emailVerified).toBe(true);

    const forgot = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: user.email },
    });
    expect(forgot.statusCode).toBe(202);

    const resetToken = await prisma.verificationToken.findFirst({
      where: { userId: user.id, purpose: 'password_reset' },
    });
    expect(resetToken).toBeTruthy();
  });

  it('does not create a reset token until email is verified', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const forgot = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: user.email },
    });
    expect(forgot.statusCode).toBe(202);

    const resetToken = await prisma.verificationToken.findFirst({
      where: { userId: user.id, purpose: 'password_reset' },
    });
    expect(resetToken).toBeNull();
  });

  it('resends verification email for unverified accounts', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const resend = await app.inject({
      method: 'POST',
      url: '/api/auth/resend-verification',
      headers: user.auth,
    });
    expect(resend.statusCode).toBe(204);

    const tokens = await prisma.verificationToken.findMany({
      where: { userId: user.id, purpose: 'email_verify', usedAt: null },
    });
    expect(tokens.length).toBe(1);
  });

  it('resets password with a valid token and revokes sessions', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    const { token, tokenHash } = createOpaqueToken();
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        purpose: 'password_reset',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: user.password },
    });
    expect(login.statusCode).toBe(200);
    const cookie = login.cookies.find((entry) => entry.name === 'tc_refresh')!.value;

    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'brand-new-secret-pass' },
    });
    expect(reset.statusCode).toBe(204);

    const afterReset = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { tc_refresh: cookie },
    });
    expect(afterReset.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: user.email, password: 'brand-new-secret-pass' },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('completes qr login after the mobile client approves the ticket', async () => {
    const user = await createUser();
    created.push(user);
    const app = await testApp();

    const start = await app.inject({ method: 'POST', url: '/api/auth/qr/start' });
    expect(start.statusCode).toBe(200);
    const { ticket } = start.json<{ ticket: string }>();

    const pending = await app.inject({ method: 'GET', url: `/api/auth/qr/poll?ticket=${ticket}` });
    expect(pending.json().status).toBe('pending');

    const approve = await app.inject({
      method: 'POST',
      url: '/api/auth/qr/approve',
      headers: user.auth,
      payload: { ticket },
    });
    expect(approve.statusCode).toBe(200);

    const complete = await app.inject({ method: 'GET', url: `/api/auth/qr/poll?ticket=${ticket}` });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().status).toBe('approved');
    expect(complete.json().user.id).toBe(user.id);
    expect(complete.cookies.some((cookie) => cookie.name === 'tc_refresh')).toBe(true);

    const replay = await app.inject({ method: 'GET', url: `/api/auth/qr/poll?ticket=${ticket}` });
    expect(replay.json().status).toBe('expired');
  });
});
