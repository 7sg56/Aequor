/**
 * Agent barrel export + verification pipeline.
 *
 * Architecture: Argus is the master agent that internally spawns
 * Themis, Dike, and Chronos as audit streams. Kratos then consumes
 * all reports for consensus. Plutus handles payment. Nemesis handles disputes.
 */

export { runArgus } from './argus/index.js';
export { runKratos } from './kratos/index.js';
export { runNemesis } from './nemesis/index.js';
export { runPlutus } from './plutus/index.js';

import { runArgus } from './argus/index.js';
import { runKratos } from './kratos/index.js';
import { runPlutus } from './plutus/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('pipeline');

/**
 * Full verification pipeline:
 *   Argus (fetches evidence + runs Themis/Dike/Chronos audit streams)
 *   -> Kratos (consensus from all reports)
 *   -> Plutus (payment if approved)
 */
export async function runVerificationPipeline(taskId: string): Promise<{
  score: number;
  decision: string;
}> {
  log.info('Verification pipeline started', { taskId });

  // Phase 1-4: Argus handles evidence + all audit streams internally
  await runArgus(taskId);

  // Phase 5: Kratos computes consensus from all filed reports
  const consensus = await runKratos(taskId);

  // Phase 6: Plutus handles payment if auto-released
  if (consensus.decision === 'AUTO_RELEASE') {
    await runPlutus(taskId);
  }

  log.info('Pipeline complete', {
    taskId,
    score: consensus.finalScore,
    decision: consensus.decision,
  });

  return { score: consensus.finalScore, decision: consensus.decision };
}
