import { PrismaClient } from '@prisma/client';
import { getConfig } from './config.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: getConfig().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (getConfig().NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type Db = typeof prisma;
