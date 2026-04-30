import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db');

export const prisma = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development'
    ? [{ emit: 'event', level: 'query' }]
    : [],
});

if (process.env['NODE_ENV'] === 'development') {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    log.debug('Prisma query', { query: e.query, duration: `${e.duration}ms` });
  });
}

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    log.info('Connected to PostgreSQL via Prisma');
  } catch (error) {
    log.error('Failed to connect to database', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
  log.info('Disconnected from database');
}
