/**
 * Aequor API — Fastify server entry point.
 * AI-verified freelance payment streaming on Solana.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/index.js';
import { connectDB, disconnectDB } from './db/index.js';
import { createLogger } from './utils/logger.js';
import { taskRoutes } from './api/routes/tasks.js';
import { dashboardRoutes } from './api/routes/dashboard.js';
import { disputeRoutes } from './api/routes/disputes.js';

const log = createLogger('server');

async function main() {
  const app = Fastify({ logger: false });

  // CORS
  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  // Health check
  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'aequor-api',
    timestamp: Date.now(),
    uptime: process.uptime(),
  }));

  // Register routes
  await app.register(taskRoutes);
  await app.register(dashboardRoutes);
  await app.register(disputeRoutes);

  // Connect DB
  await connectDB();

  // Start server
  await app.listen({ port: config.port, host: config.host });
  log.info(`Aequor API running on http://${config.host}:${config.port}`);

  // Graceful shutdown
  const shutdown = async () => {
    log.info('Shutting down...');
    await app.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error('Failed to start', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
