import { redis } from '../db/redis.js';
import { AgentEvent } from '../events/emitter.js';

export class TaskCacheService {
  private static TTL = 60 * 60 * 24; // 24 hours

  /**
   * Save a real-time event to Redis for history retrieval
   */
  static async saveEvent(taskId: string, event: AgentEvent): Promise<void> {
    const key = `events:${taskId}`;
    await redis.rpush(key, JSON.stringify(event));
    await redis.expire(key, this.TTL);
  }

  /**
   * Get all events for a task
   */
  static async getEvents(taskId: string): Promise<AgentEvent[]> {
    const key = `events:${taskId}`;
    const raw = await redis.lrange(key, 0, -1);
    return raw.map((r) => JSON.parse(r));
  }

  /**
   * Buffer an agent report in Redis
   */
  static async bufferReport(taskId: string, report: any): Promise<void> {
    const key = `reports:${taskId}`;
    await redis.hset(key, report.agentName, JSON.stringify(report));
    await redis.expire(key, this.TTL);
  }

  /**
   * Get all buffered reports for a task
   */
  static async getBufferedReports(taskId: string): Promise<any[]> {
    const key = `reports:${taskId}`;
    const raw = await redis.hgetall(key);
    return Object.values(raw).map((r) => JSON.parse(r));
  }

  /**
   * Buffer evidence in Redis
   */
  static async bufferEvidence(taskId: string, evidence: any): Promise<void> {
    const key = `evidence:${taskId}`;
    await redis.set(key, JSON.stringify(evidence), 'EX', this.TTL);
  }

  /**
   * Get buffered evidence
   */
  static async getBufferedEvidence(taskId: string): Promise<any | null> {
    const key = `evidence:${taskId}`;
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Clear all task data from Redis after finalization
   */
  static async clearTask(taskId: string): Promise<void> {
    await redis.del(`events:${taskId}`, `reports:${taskId}`, `evidence:${taskId}`);
  }
}
