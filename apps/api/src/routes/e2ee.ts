import { z } from 'zod';
import { createPublicKey } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { areFriends } from '../lib/friends.js';
import { assertConversationMember } from '../lib/permissions.js';

const deviceSchema = z.object({
  deviceId: z.string().min(16).max(128),
  name: z.string().max(120).nullable().optional(),
  publicKey: z.string().min(128).max(2048),
});

function serializeDevice(device: {
  id: string;
  userId: string;
  name: string | null;
  publicKey: string;
  createdAt: Date;
}) {
  return {
    id: device.id,
    userId: device.userId,
    name: device.name,
    publicKey: device.publicKey,
    createdAt: device.createdAt.toISOString(),
  };
}

export async function e2eeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.post('/devices', async (request, reply) => {
    const body = deviceSchema.parse(request.body);
    try {
      const key = createPublicKey({
        key: Buffer.from(body.publicKey, 'base64'),
        format: 'der',
        type: 'spki',
      });
      if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
        throw new Error('unsupported key');
      }
    } catch {
      throw ApiError.badRequest('Public key must be a valid RSA-2048 SPKI key');
    }
    const existing = await prisma.cryptoDevice.findUnique({ where: { id: body.deviceId } });
    if (existing && existing.userId !== request.userId) {
      throw ApiError.conflict('Device id is already registered');
    }
    if (existing && existing.publicKey !== body.publicKey) {
      throw ApiError.conflict('Device identity cannot be replaced; register a new device id');
    }
    if (!existing) {
      const activeDevices = await prisma.cryptoDevice.count({
        where: { userId: request.userId, revokedAt: null },
      });
      if (activeDevices >= 16) throw ApiError.conflict('Too many active encrypted devices');
    }
    const device = await prisma.cryptoDevice.upsert({
      where: { id: body.deviceId },
      create: {
        id: body.deviceId,
        userId: request.userId,
        name: body.name?.trim() || null,
        publicKey: body.publicKey,
      },
      update: {
        name: body.name?.trim() || null,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
    });
    reply.send(serializeDevice(device));
  });

  app.delete('/devices/:deviceId', async (request, reply) => {
    const { deviceId } = z.object({ deviceId: z.string().min(1) }).parse(request.params);
    const device = await prisma.cryptoDevice.findUnique({ where: { id: deviceId } });
    if (!device || device.userId !== request.userId) throw ApiError.notFound('Device not found');
    await prisma.cryptoDevice.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
    reply.status(204).send();
  });

  app.get('/users/:userId/devices', async (request) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.params);
    if (userId !== request.userId && !(await areFriends(request.userId, userId))) {
      throw ApiError.forbidden('Device keys are available only for friends');
    }
    const devices = await prisma.cryptoDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return devices.map(serializeDevice);
  });

  app.get('/conversations/:conversationId/key/:deviceId', async (request) => {
    const { conversationId, deviceId } = z
      .object({ conversationId: z.string().min(1), deviceId: z.string().min(1) })
      .parse(request.params);
    await assertConversationMember(conversationId, request.userId);
    const device = await prisma.cryptoDevice.findUnique({ where: { id: deviceId } });
    if (!device || device.userId !== request.userId || device.revokedAt) {
      throw ApiError.forbidden('This device is not registered for your account');
    }
    const bundle = await prisma.secretConversationKey.findUnique({
      where: { conversationId_deviceId: { conversationId, deviceId } },
    });
    if (!bundle) throw ApiError.notFound('No secret key was shared with this device');
    return { deviceId, wrappedKey: bundle.wrappedKey };
  });
}
