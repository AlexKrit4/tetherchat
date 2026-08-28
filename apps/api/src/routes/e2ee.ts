import { z } from 'zod';
import { createPublicKey } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { areFriends } from '../lib/friends.js';
import { assertConversationMember } from '../lib/permissions.js';
import { userHasSecretKey } from '../lib/secretChat.js';
import { emitToUser } from '../ws/realtime.js';
import { redis } from '../redis.js';

const CLAIM_TTL_SECONDS = 86_400 * 7;

function claimKey(conversationId: string, userId: string): string {
  return `secret:claim:${conversationId}:${userId}`;
}

function claimsForUserKey(userId: string): string {
  return `secret:claims:for:${userId}`;
}

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
    if (existing?.revokedAt) {
      throw ApiError.conflict('This device was revoked; register a new device id');
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
      },
    });
    reply.send(serializeDevice(device));
  });

  app.delete('/devices/:deviceId', async (request, reply) => {
    const { deviceId } = z.object({ deviceId: z.string().min(1) }).parse(request.params);
    const device = await prisma.cryptoDevice.findUnique({ where: { id: deviceId } });
    if (!device || device.userId !== request.userId) throw ApiError.notFound('Device not found');
    await prisma.$transaction([
      prisma.secretConversationKey.deleteMany({ where: { deviceId } }),
      prisma.cryptoDevice.update({
        where: { id: deviceId },
        data: { revokedAt: new Date() },
      }),
    ]);
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

  app.get('/conversations/invites', async (request) => {
    const conversations = await prisma.directConversation.findMany({
      where: {
        isSecret: true,
        members: { some: { userId: request.userId, leftAt: null, hiddenAt: null } },
      },
      select: { id: true },
    });
    const invites: string[] = [];
    for (const conversation of conversations) {
      if (!(await userHasSecretKey(conversation.id, request.userId))) {
        invites.push(conversation.id);
      }
    }
    return { conversationIds: invites };
  });

  app.get('/conversations/pending-claims', async (request) => {
    const client = redis();
    const entries = await client.smembers(claimsForUserKey(request.userId));
    const claims = await Promise.all(
      entries.map(async (entry) => {
        const [conversationId, claimerUserId] = entry.split(':');
        if (!conversationId || !claimerUserId) return null;
        const raw = await client.get(claimKey(conversationId, claimerUserId));
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as { deviceId: string };
          return { conversationId, userId: claimerUserId, deviceId: parsed.deviceId };
        } catch {
          return null;
        }
      }),
    );
    return claims.filter(Boolean);
  });

  app.post('/conversations/:conversationId/claim', async (request, reply) => {
    const { conversationId } = z.object({ conversationId: z.string().min(1) }).parse(request.params);
    const body = z.object({ deviceId: z.string().min(16).max(128) }).parse(request.body);
    await assertConversationMember(conversationId, request.userId);
    const conversation = await prisma.directConversation.findUnique({ where: { id: conversationId } });
    if (!conversation?.isSecret) throw ApiError.badRequest('Not a secret conversation');

    const device = await prisma.cryptoDevice.findUnique({ where: { id: body.deviceId } });
    if (!device || device.userId !== request.userId || device.revokedAt) {
      throw ApiError.forbidden('This device is not registered for your account');
    }

    if (await userHasSecretKey(conversationId, request.userId)) {
      throw ApiError.conflict('Secret chat is already bound to another device');
    }

    const members = await prisma.directConversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    const peerIds = members.map((row) => row.userId).filter((id) => id !== request.userId);
    let holderId: string | null = null;
    for (const peerId of peerIds) {
      if (await userHasSecretKey(conversationId, peerId)) {
        holderId = peerId;
        break;
      }
    }

    if (!holderId) {
      throw ApiError.conflict('Peer has not initialized this secret chat yet');
    }

    const client = redis();
    await client.set(
      claimKey(conversationId, request.userId),
      JSON.stringify({ deviceId: body.deviceId, publicKey: device.publicKey }),
      'EX',
      CLAIM_TTL_SECONDS,
    );
    await client.sadd(claimsForUserKey(holderId), `${conversationId}:${request.userId}`);

    emitToUser(holderId, 'secret:claim', {
      conversationId,
      userId: request.userId,
      deviceId: body.deviceId,
      publicKey: device.publicKey,
    });

    reply.send({ status: 'pending', conversationId, deviceId: body.deviceId });
  });

  app.post('/conversations/:conversationId/deliver-key', async (request, reply) => {
    const { conversationId } = z.object({ conversationId: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        deviceId: z.string().min(16).max(128),
        wrappedKey: z.string().min(128).max(2048),
      })
      .parse(request.body);

    await assertConversationMember(conversationId, request.userId);
    const conversation = await prisma.directConversation.findUnique({ where: { id: conversationId } });
    if (!conversation?.isSecret) throw ApiError.badRequest('Not a secret conversation');

    if (!(await userHasSecretKey(conversationId, request.userId))) {
      throw ApiError.forbidden('Only a device that already has access can deliver a key');
    }

    const targetDevice = await prisma.cryptoDevice.findUnique({ where: { id: body.deviceId } });
    if (!targetDevice || targetDevice.revokedAt) throw ApiError.notFound('Target device not found');
    if (targetDevice.userId === request.userId) {
      throw ApiError.badRequest('Cannot deliver a key to your own device here');
    }

    await assertConversationMember(conversationId, targetDevice.userId);
    if (await userHasSecretKey(conversationId, targetDevice.userId)) {
      throw ApiError.conflict('Peer already claimed this secret chat on another device');
    }

    await prisma.secretConversationKey.create({
      data: {
        conversationId,
        deviceId: body.deviceId,
        wrappedKey: body.wrappedKey,
      },
    });

    const client = redis();
    await client.del(claimKey(conversationId, targetDevice.userId));
    await client.srem(claimsForUserKey(request.userId), `${conversationId}:${targetDevice.userId}`);

    emitToUser(targetDevice.userId, 'secret:key-ready', {
      conversationId,
      deviceId: body.deviceId,
    });

    reply.send({ status: 'delivered', conversationId, deviceId: body.deviceId });
  });
}
