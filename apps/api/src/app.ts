import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { LIMITS } from '@tetherchat/shared';
import { getConfig } from './config.js';
import { authPlugin } from './plugins/auth.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { authRoutes } from './routes/auth.js';
import { channelRoutes } from './routes/channels.js';
import { dmRoutes } from './routes/dms.js';
import { friendRoutes } from './routes/friends.js';
import { inviteRoutes } from './routes/invites.js';
import { messageRoutes } from './routes/messages.js';
import { appRoutes } from './routes/app.js';
import { vpnRoutes } from './routes/vpn.js';
import { adminRoutes } from './routes/admin.js';
import { reportRoutes } from './routes/reports.js';
import { pushRoutes } from './routes/push.js';
import { callRoutes } from './routes/calls.js';
import { e2eeRoutes } from './routes/e2ee.js';
import { serverRoutes } from './routes/servers.js';
import { uploadRoutes, attachmentRoutes } from './routes/uploads.js';
import { userRoutes } from './routes/users.js';

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
          : undefined,
    },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: config.PUBLIC_WEB_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  await app.register(cookie, { secret: config.JWT_REFRESH_SECRET });

  await app.register(multipart, {
    limits: { fileSize: LIMITS.attachmentBytesPlus, files: 1, fields: 10 },
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    // Rate limiting is keyed per authenticated user when possible, otherwise per IP.
    keyGenerator: (request) => {
      const header = request.headers.authorization;
      return header ? `token:${header.slice(-32)}` : `ip:${request.ip}`;
    },
    allowList: () => config.NODE_ENV === 'test',
  });

  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);

  if (config.STORAGE_DRIVER === 'local') {
    const root = resolve(config.STORAGE_LOCAL_DIR);
    await mkdir(root, { recursive: true });
    await app.register(fastifyStatic, {
      root,
      prefix: '/files/',
      decorateReply: false,
      cacheControl: true,
      maxAge: '365d',
    });
  }

  app.get('/api/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(serverRoutes, { prefix: '/api/servers' });
  await app.register(channelRoutes, { prefix: '/api/channels' });
  await app.register(messageRoutes, { prefix: '/api/messages' });
  await app.register(dmRoutes, { prefix: '/api/dms' });
  await app.register(friendRoutes, { prefix: '/api/friends' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(inviteRoutes, { prefix: '/api/invite' });
  await app.register(uploadRoutes, { prefix: '/api/upload' });
  await app.register(attachmentRoutes, { prefix: '/api/attachments' });
  await app.register(pushRoutes, { prefix: '/api/push' });
  await app.register(callRoutes, { prefix: '/api/calls' });
  await app.register(e2eeRoutes, { prefix: '/api/e2ee' });
  await app.register(appRoutes, { prefix: '/api/app' });
  await app.register(vpnRoutes, { prefix: '/api/vpn' });

  return app;
}
