/**
 * WebSocket event streaming route.
 * Clients connect to ws://host/ws/events to receive real-time agent activity.
 */

import { FastifyInstance } from 'fastify';
import { agentEmitter, type AgentEvent } from '../../events/emitter.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('ws:events');

export async function eventsRoute(app: FastifyInstance) {
  app.get('/ws/events', { websocket: true }, (socket, req) => {
    log.info('WebSocket client connected');

    const handler = (event: AgentEvent) => {
      try {
        socket.send(JSON.stringify(event));
      } catch {
        // Client disconnected
      }
    };

    agentEmitter.on('agent-event', handler);

    socket.on('message', (data: Buffer | string) => {
      // Clients can send a taskId to filter events (optional)
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      log.info('WebSocket client disconnected');
      agentEmitter.off('agent-event', handler);
    });

    socket.on('error', () => {
      agentEmitter.off('agent-event', handler);
    });
  });
}
