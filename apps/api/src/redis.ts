import { Redis } from 'ioredis';
import { getConfig } from './config.js';

const clients: Redis[] = [];

export function createRedis(): Redis {
  const client = new Redis(getConfig().REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on('error', (error) => {
    // Connection errors are transient; ioredis reconnects on its own.
    if (getConfig().NODE_ENV !== 'test') {
      console.error('[redis]', error.message);
    }
  });
  clients.push(client);
  return client;
}

let shared: Redis | null = null;

export function redis(): Redis {
  shared ??= createRedis();
  return shared;
}

export async function closeRedis(): Promise<void> {
  await Promise.all(clients.map((client) => client.quit().catch(() => undefined)));
  clients.length = 0;
  shared = null;
}

/**
 * Fixed-window counter used for message send throttling.
 * Returns true when the action is allowed.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const client = redis();
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, windowSeconds);
  }
  return count <= limit;
}
