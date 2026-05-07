/**
 * Global event emitter for real-time agent activity broadcasting.
 * WebSocket connections subscribe to these events to show live agent logs in the dashboard.
 */

import { EventEmitter } from 'events';

export interface AgentEvent {
  type: 'agent_start' | 'agent_progress' | 'agent_complete' | 'agent_error' | 'pipeline_start' | 'pipeline_complete' | 'evidence_fetched';
  taskId: string;
  agent: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

class AequorEventEmitter extends EventEmitter {
  emit(event: 'agent-event', payload: AgentEvent): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  on(event: 'agent-event', listener: (payload: AgentEvent) => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

export const agentEmitter = new AequorEventEmitter();
agentEmitter.setMaxListeners(50);

/** Helper to broadcast an agent event */
export async function emitAgentEvent(event: Omit<AgentEvent, 'timestamp'>) {
  const payload: AgentEvent = {
    ...event,
    timestamp: Date.now(),
  };
  
  // Broadcast live
  agentEmitter.emit('agent-event', payload);

  // Persist in Redis for history (non-blocking)
  import('../services/taskCache.js').then(({ TaskCacheService }) => {
    TaskCacheService.saveEvent(event.taskId, payload).catch(err => {
      console.error('Failed to save event to Redis', err);
    });
  });
}
