import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { InvitePreview } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { ApiError } from '../errors.js';
import { publicUserSelect, toPublicUser } from '../lib/serialize.js';
import { joinByInvite } from '../services/serverService.js';
import { emitToUser } from '../ws/realtime.js';

const codeParam = z.object({ code: z.string().min(4).max(32) });

export async function inviteRoutes(app: FastifyInstance) {
  /** Public preview so the invite landing page renders before signing in. */
  app.get('/:code', async (request) => {
    const { code } = codeParam.parse(request.params);

    const invite = await prisma.invite.findUnique({
      where: { code },
      include: {
        inviter: { select: publicUserSelect },
        server: { include: { _count: { select: { members: true } } } },
      },
    });
    if (!invite) throw ApiError.notFound('This invite is invalid or has expired');

    const viewerId = app.optionalAuth(request);
    const alreadyMember = viewerId
      ? Boolean(
          await prisma.serverMember.findUnique({
            where: { serverId_userId: { serverId: invite.serverId, userId: viewerId } },
            select: { id: true },
          }),
        )
      : false;

    const preview: InvitePreview = {
      code: invite.code,
      server: {
        id: invite.server.id,
        name: invite.server.name,
        iconUrl: invite.server.iconUrl,
        description: invite.server.description,
        ownerId: invite.server.ownerId,
        memberCount: invite.server._count.members,
      },
      inviter: toPublicUser(invite.inviter),
      alreadyMember,
    };
    return preview;
  });

  app.post('/:code/join', { preHandler: [app.requireAuth] }, async (request) => {
    const { code } = codeParam.parse(request.params);
    const result = await joinByInvite(code, request.userId);
    emitToUser(request.userId, 'server:join', { serverId: result.serverId });
    return result;
  });
}
