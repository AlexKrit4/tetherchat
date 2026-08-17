import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { ApiError } from '../errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the requireAuth preHandler. */
    userId: string;
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest) => Promise<void>;
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
