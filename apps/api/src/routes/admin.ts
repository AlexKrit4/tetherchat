import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AdminCredentials, AdminSession } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import {
  adminCredentialsMatch,
  dailyAdminCredentials,
  mskDateKey,
} from '../lib/adminCredentials.js';
import { reportInclude, toMessageReport, toSiteBan } from '../lib/reports.js';
import { publicUserSelect, toPublicUser } from '../lib/serialize.js';
import { signAdminToken } from '../lib/tokens.js';
import { assertPlatformAdmin } from '../lib/platformAdmin.js';

export async function adminRoutes(app: FastifyInstance) {
  app.patch('/users/:userId/plus', { preHandler: app.requireAuth }, async (request) => {
    await assertPlatformAdmin(request.userId);
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.params);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body);
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) throw ApiError.notFound('User not found');
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isPlus: enabled, plusUntil: enabled ? null : new Date(0) },
      select: publicUserSelect,
    });
    return toPublicUser(updated);
  });

  app.post('/login', async (request) => {
    const body = z
      .object({
        login: z.string().min(1).max(64),
        password: z.string().min(1).max(64),
      })
      .parse(request.body);

    if (!adminCredentialsMatch(body.login, body.password)) {
      throw ApiError.unauthorized('Неверный логин или пароль');
    }

    const creds = dailyAdminCredentials();
    const response: AdminSession = {
      accessToken: signAdminToken(creds.dateKey, creds.expiresAt),
      expiresAt: creds.expiresAt.toISOString(),
    };
    return response;
  });

  app.get('/reports', { preHandler: app.requireAdmin }, async (request) => {
    const { status } = z
      .object({ status: z.enum(['pending', 'pardoned', 'banned', 'closed']).default('pending') })
      .parse(request.query);
    const where =
      status === 'closed'
        ? { status: { in: ['pardoned' as const, 'banned' as const] } }
        : { status };
    const rows = await prisma.messageReport.findMany({
      where,
      include: reportInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toMessageReport);
  });

  app.get('/reports/:id', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const row = await prisma.messageReport.findUnique({ where: { id }, include: reportInclude });
    if (!row) throw ApiError.notFound('Репорт не найден');
    return toMessageReport(row);
  });

  app.post('/reports/:id/pardon', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const row = await prisma.messageReport.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('Репорт не найден');
    if (row.status !== 'pending') throw ApiError.badRequest('Репорт уже обработан');

    const updated = await prisma.messageReport.update({
      where: { id },
      data: { status: 'pardoned', resolvedAt: new Date() },
      include: reportInclude,
    });
    return toMessageReport(updated);
  });

  app.post('/reports/:id/ban', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        durationHours: z.number().int().min(1).max(24 * 365).nullish(),
        message: z.string().trim().min(1).max(500),
      })
      .parse(request.body);

    const row = await prisma.messageReport.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('Репорт не найден');
    if (row.status !== 'pending') throw ApiError.badRequest('Репорт уже обработан');

    const expiresAt = body.durationHours
      ? new Date(Date.now() + body.durationHours * 3_600_000)
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.siteBan.updateMany({
        where: { userId: row.targetUserId, liftedAt: null },
        data: { liftedAt: new Date() },
      });
      const ban = await tx.siteBan.create({
        data: {
          userId: row.targetUserId,
          reason: body.message,
          expiresAt,
        },
        include: { user: { select: publicUserSelect } },
      });
      await tx.refreshToken.updateMany({
        where: { userId: row.targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.messageReport.update({
        where: { id },
        data: {
          status: 'banned',
          resolvedAt: new Date(),
          siteBanId: ban.id,
        },
        include: reportInclude,
      });
    });

    return toMessageReport(updated);
  });

  app.get('/bans', { preHandler: app.requireAdmin }, async () => {
    const now = new Date();
    const rows = await prisma.siteBan.findMany({
      where: {
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: { user: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSiteBan);
  });

  app.post('/bans/:id/lift', { preHandler: app.requireAdmin }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const row = await prisma.siteBan.findUnique({
      where: { id },
      include: { user: { select: publicUserSelect } },
    });
    if (!row) throw ApiError.notFound('Бан не найден');
    if (row.liftedAt) throw ApiError.badRequest('Пользователь уже разжалован');
    const updated = await prisma.siteBan.update({
      where: { id },
      data: { liftedAt: new Date() },
      include: { user: { select: publicUserSelect } },
    });
    return toSiteBan(updated);
  });
}

export function currentAdminCredentials(): AdminCredentials {
  const creds = dailyAdminCredentials();
  return {
    login: creds.login,
    password: creds.password,
    expiresAt: creds.expiresAt.toISOString(),
    dateKey: creds.dateKey,
  };
}

export { mskDateKey };
