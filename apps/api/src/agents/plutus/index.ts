/**
 * PLUTUS — Payment Streamer
 * Executes Solana payouts: milestone release, streamed payments, escrow holds.
 */

import { createLogger } from '../../utils/logger.js';
import { prisma } from '../../db/index.js';
import { blockchain } from '../../blockchain/index.js';

const log = createLogger('agent:plutus');

export async function runPlutus(taskId: string): Promise<void> {
  log.info('Plutus activated', { taskId });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.workerWallet) {
    log.warn('Task or worker wallet missing', { taskId });
    return;
  }

  if (task.decision !== 'AUTO_RELEASE') {
    log.info('Payment not auto-released, skipping', { taskId, decision: task.decision });

    await prisma.agentReport.create({
      data: {
        taskId, agentName: 'PLUTUS', score: 0, confidence: 1.0,
        severity: 'INFO', summary: `Payment held — decision: ${task.decision}`,
        recommendations: ['Awaiting manual review or revision'],
      },
    });
    return;
  }

  // Execute payment on Solana
  const txResult = await blockchain.createStreamPayment({
    sender: task.clientWallet,
    recipient: task.workerWallet,
    amount: task.escrowAmount * 1e9, // SOL to lamports
    ratePerSecond: task.escrowAmount * 1e9 / 3600, // stream over 1 hour
  });

  // Record payment
  await prisma.payment.create({
    data: {
      taskId,
      fromWallet: task.clientWallet,
      toWallet: task.workerWallet,
      amount: task.escrowAmount,
      txSignature: txResult.signature,
      status: 'STREAMING',
      streamRate: task.escrowAmount / 3600,
      startedAt: new Date(),
    },
  });

  // Update task
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'COMPLETED', escrowTx: txResult.signature },
  });

  // Audit
  await prisma.auditLog.create({
    data: {
      action: 'payment_released',
      actor: 'PLUTUS',
      target: taskId,
      details: { amount: task.escrowAmount, tx: txResult.signature } as any,
    },
  });

  // Agent report
  await prisma.agentReport.create({
    data: {
      taskId, agentName: 'PLUTUS', score: 100, confidence: 1.0,
      severity: 'INFO',
      summary: `Payment of ${task.escrowAmount} SOL streamed to ${task.workerWallet}`,
      reasoning: `TX: ${txResult.signature}`,
      details: txResult as any,
      recommendations: ['Payment successfully initiated'],
    },
  });

  log.info('Plutus payment released', { taskId, tx: txResult.signature, amount: task.escrowAmount });
}
