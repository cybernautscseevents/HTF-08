// Trail Engine — Money trail reconstruction and path analysis
import { Transaction, TrailStep, MoneyTrail } from '../types';
import { buildAdjacencyList } from './graphEngine';

// Trace a money trail starting from a reported transaction
export function traceMoneyTrail(
  reportedTxId: string,
  transactions: Transaction[],
  maxHops: number = 10,
  timeWindowMs: number = 3600000 // 1 hour default
): MoneyTrail | null {
  const txMap = new Map(transactions.map(t => [t.id, t]));
  const reportedTx = txMap.get(reportedTxId);

  if (!reportedTx) return null;

  const adj = buildAdjacencyList(transactions);
  const steps: TrailStep[] = [];

  // First step: reported transaction
  steps.push({
    hopNumber: 1,
    fromAccount: reportedTx.source,
    toAccount: reportedTx.destination,
    transactionId: reportedTx.id,
    amount: reportedTx.amount,
    timestamp: reportedTx.timestamp,
    delay: 0,
    amountRetention: 100,
    riskScore: reportedTx.riskScore,
  });

  let currentAccount = reportedTx.destination;
  let currentTime = new Date(reportedTx.timestamp).getTime();
  let currentAmount = reportedTx.amount;
  let visited = new Set<string>([reportedTx.source, reportedTx.destination]);

  // Follow the trail
  for (let hop = 2; hop <= maxHops; hop++) {
    const outgoing = (adj[currentAccount] || [])
      .filter(edge => {
        const edgeTime = new Date(edge.timestamp).getTime();
        return edgeTime > currentTime && edgeTime - currentTime <= timeWindowMs && !visited.has(edge.target);
      })
      .sort((a, b) => {
        // Score candidates: temporal proximity + amount similarity + risk
        const scoreA = candidateScore(a.amount, currentAmount, new Date(a.timestamp).getTime(), currentTime, a.riskScore);
        const scoreB = candidateScore(b.amount, currentAmount, new Date(b.timestamp).getTime(), currentTime, b.riskScore);
        return scoreB - scoreA;
      });

    if (outgoing.length === 0) break;

    const bestCandidate = outgoing[0];
    const candidateTime = new Date(bestCandidate.timestamp).getTime();
    const delay = (candidateTime - currentTime) / 1000;
    const retention = (bestCandidate.amount / currentAmount) * 100;

    steps.push({
      hopNumber: hop,
      fromAccount: currentAccount,
      toAccount: bestCandidate.target,
      transactionId: bestCandidate.txId,
      amount: bestCandidate.amount,
      timestamp: bestCandidate.timestamp,
      delay: Math.round(delay),
      amountRetention: Math.round(retention * 10) / 10,
      riskScore: bestCandidate.riskScore,
    });

    visited.add(bestCandidate.target);
    currentAccount = bestCandidate.target;
    currentTime = candidateTime;
    currentAmount = bestCandidate.amount;
  }

  const totalDuration = steps.length > 1
    ? (new Date(steps[steps.length - 1].timestamp).getTime() - new Date(steps[0].timestamp).getTime()) / 1000
    : 0;

  return {
    caseId: '',
    steps,
    totalAmount: reportedTx.amount,
    totalLoss: reportedTx.amount - steps[steps.length - 1].amount,
    totalHops: steps.length,
    totalDuration: Math.round(totalDuration),
    predictedNextHop: null,
  };
}

// Score a candidate downstream transaction
function candidateScore(
  candidateAmount: number,
  sourceAmount: number,
  candidateTime: number,
  sourceTime: number,
  riskScore: number
): number {
  // Temporal proximity (0-30): closer in time = higher score
  const delaySeconds = (candidateTime - sourceTime) / 1000;
  const temporalScore = delaySeconds < 60 ? 30 : delaySeconds < 300 ? 20 : delaySeconds < 900 ? 10 : 5;

  // Amount similarity (0-30): closer to source amount = higher score
  const amountRatio = candidateAmount / sourceAmount;
  const amountScore = amountRatio > 0.85 ? 30 : amountRatio > 0.7 ? 20 : amountRatio > 0.5 ? 12 : 5;

  // Risk (0-20): higher risk = more likely
  const riskContrib = (riskScore / 100) * 20;

  // Velocity bonus (0-20): very fast = suspicious
  const velocityScore = delaySeconds < 30 ? 20 : delaySeconds < 120 ? 12 : delaySeconds < 600 ? 5 : 0;

  return temporalScore + amountScore + riskContrib + velocityScore;
}

// Get trail for a specific case
export function getTrailForCase(
  caseId: string,
  reportedTxId: string,
  transactions: Transaction[]
): MoneyTrail | null {
  const trail = traceMoneyTrail(reportedTxId, transactions);
  if (trail) {
    trail.caseId = caseId;
  }
  return trail;
}
