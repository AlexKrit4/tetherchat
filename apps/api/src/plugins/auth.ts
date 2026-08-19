import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { ApiError } from '../errors.js';
import { mskDateKey } from '../lib/adminCredentials.js';
import { activeSiteBan, banLoginMessage } from '../lib/platformAdmin.js';
import { verifyAccessToken, verifyAdminToken } from '../lib/tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the requireAuth preHandler. */
    userId: string;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
    /** Resolves the caller when a valid token is present, otherwise null. */
    optionalAuth: (request: FastifyRequest) => string | null;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('userId', '');

  app.decorate('requireAuth', async (request: FastifyRequest) => {
    const token = bearerToken(request);
    if (!token) throw ApiError.unauthorized('Missing bearer token');
    request.userId = verifyAccessToken(token).sub;
    const ban = await activeSiteBan(request.userId);
    if (ban) throw ApiError.banned(banLoginMessage(ban));
  });

  app.decorate('requireAdmin', async (request: FastifyRequest) => {
    const token = bearerToken(request);
    if (!token) throw ApiError.unauthorized('Нужна авторизация админки');
    const payload = verifyAdminToken(token);
    if (payload.dateKey !== mskDateKey()) {
      throw ApiError.unauthorized('Сессия админки истекла, войдите снова');
    }
  });

  app.decorate('optionalAuth', (request: FastifyRequest) => {
    const token = bearerToken(request);
    if (!token) return null;
    try {
      const userId = verifyAccessToken(token).sub;
      request.userId = userId;
      return userId;
    } catch {
      return null;
    }
  });
});
