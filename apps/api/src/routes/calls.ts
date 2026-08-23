import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import {
  acceptCall,
  declineCall,
  endCall,
  getActiveCallForUser,
  getCallToken,
  startCall,
} from '../services/callService.js';

const callParam = z.object({ callId: z.string().min(1) });

export async function callRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireAuth);

  app.post('/start', async (request, reply) => {
    const body = z.object({ conversationId: z.string().min(1) }).parse(request.body);
    reply.send(await startCall(request.userId, body.conversationId));
  });

  app.get('/active', async (request) => {
    const active = await getActiveCallForUser(request.userId);
    return active ? { callId: active.id, status: active.status, conversationId: active.conversationId } : null;
  });

  app.post('/:callId/accept', async (request, reply) => {
    const { callId } = callParam.parse(request.params);
    reply.send(await acceptCall(request.userId, callId));
  });

  app.post('/:callId/decline', async (request, reply) => {
    const { callId } = callParam.parse(request.params);
    reply.send(await declineCall(request.userId, callId));
  });

  app.post('/:callId/end', async (request, reply) => {
    const { callId } = callParam.parse(request.params);
    reply.send(await endCall(request.userId, callId));
  });

  app.get('/:callId/token', async (request, reply) => {
    const { callId } = callParam.parse(request.params);
    reply.send(await getCallToken(request.userId, callId));
  });
}
