import { buildApp } from './app.js';
import { getConfig } from './config.js';
import { prisma } from './db.js';
import { startWorkers, stopWorkers } from './jobs/queue.js';
import { closeRedis } from './redis.js';
import { attachSocketServer } from './ws/index.js';
import { resetPresence } from './ws/presence.js';

async function main() {
  const config = getConfig();
  const app = await buildApp();

  await attachSocketServer(app);
  startWorkers();
  await resetPresence().catch((error) => app.log.warn({ err: error }, 'presence reset failed'));

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`TetherChat API listening on http://${config.HOST}:${config.PORT}`);

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    try {
      await app.close();
      await stopWorkers();
      await closeRedis();
      await prisma.$disconnect();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start API:', error);
  process.exit(1);
});
