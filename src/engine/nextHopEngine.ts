// Next-Hop Engine — Predicts the most likely next destination for funds based on historical rule matching
import { Account, Transaction, NextHopPrediction, NextHopCandidate, PredictionReason } from '../types';

export function findNextHopCandidates(
  accountId: string,
  transactions: Transaction[],
  accounts: Account[]
): NextHopPrediction | null {
  // 1. Identify the current upstream path leading to accountId
  const currentPath = getPathUpTo(accountId, transactions);
  
  // 2. Find historical occurrences of this path
  const candidatesMap = new Map<string, {
    count: number;
    amounts: number[];
    delays: number[];
    chainMatches: number;
  }>();

  // Look for any historical transactions where the source is `accountId`
  const outgoing = transactions.filter(t => t.source === accountId && t.status === 'completed');
  
  if (outgoing.length === 0) return null;

  for (const tx of outgoing) {
    const destId = tx.destination;
    
    if (!candidatesMap.has(destId)) {
      candidatesMap.set(destId, { count: 0, amounts: [], delays: [], chainMatches: 0 });
    }
    
    const stats = candidatesMap.get(destId)!;
    stats.count++;
    stats.amounts.push(tx.amount);
    
    // Check if the upstream matched the current path (Rule B: Repeated Mule Chain)
    const txPath = getPathUpTo(accountId, transactions, new Date(tx.timestamp).getTime());
    let matchDepth = 0;
    for (let i = 1; i <= Math.min(currentPath.length, txPath.length); i++) {
      if (currentPath[currentPath.length - i] === txPath[txPath.length - i]) {
        matchDepth++;
      } else {
        break;
      }
    }
    if (matchDepth > 1) {
      stats.chainMatches++;
    }

    // Calculate delay (Rule C: Rapid pass-through)
    const incomingToSource = transactions
      .filter(t => t.destination === accountId && new Date(t.timestamp).getTime() <= new Date(tx.timestamp).getTime())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
    if (incomingToSource.length > 0) {
      const delayMs = new Date(tx.timestamp).getTime() - new Date(incomingToSource[0].timestamp).getTime();
      stats.delays.push(delayMs / 1000); // in seconds
    }
  }

  // 3. Score candidates based on Explicit Rules (No ML)
  const candidates: (NextHopCandidate & { patternScore: number; reasons: PredictionReason[]; avgDelay: number; avgAmount: number })[] = [];

  for (const [destId, stats] of candidatesMap.entries()) {
    let patternScore = 0;
    const reasons: PredictionReason[] = [];

    // Rule E: Repeated Destination
    if (stats.count > 0) {
      const pts = Math.min(stats.count * 10, 40);
      patternScore += pts;
      reasons.push({ rule: 'Repeated Destination', detail: `${stats.count} historical transfers to this account (+${pts})` });
    }

    // Rule B: Repeated Mule Chain
    if (stats.chainMatches > 0) {
      const pts = Math.min(stats.chainMatches * 15, 30);
      patternScore += pts;
      reasons.push({ rule: 'Repeated Mule Chain', detail: `Upstream sequence matched ${stats.chainMatches} times historically (+${pts})` });
    }

    // Rule C: Rapid Pass-Through
    const avgDelay = stats.delays.length > 0 ? stats.delays.reduce((a, b) => a + b, 0) / stats.delays.length : 0;
    if (avgDelay > 0 && avgDelay < 300) { // under 5 minutes
      patternScore += 15;
      reasons.push({ rule: 'Rapid Pass-Through', detail: `Historically forwards funds in ${Math.round(avgDelay)}s (+15)` });
    } else if (avgDelay > 0 && avgDelay < 3600) {
      patternScore += 5;
      reasons.push({ rule: 'Rapid Pass-Through', detail: `Historically forwards funds in ${Math.round(avgDelay / 60)}m (+5)` });
    }

    // Rule D: Amount Similarity
    const avgAmount = stats.amounts.reduce((a, b) => a + b, 0) / stats.amounts.length;
    // Check current incoming amount to accountId
    const currentIncoming = transactions
      .filter(t => t.destination === accountId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      
    if (currentIncoming) {
      const ratio = avgAmount / currentIncoming.amount;
      if (ratio > 0.8 && ratio < 1.05) {
        patternScore += 15;
        reasons.push({ rule: 'Amount Similarity', detail: `Historical amount matches ${(ratio*100).toFixed(1)}% of incoming (+15)` });
      }
    }

    candidates.push({
      accountId: destId,
      confidence: Math.min(patternScore, 99),
      patternScore: Math.min(patternScore, 99),
      expectedAmount: avgAmount,
      avgDelay: avgDelay,
      avgAmount: avgAmount,
      reason: 'Historical pattern match',
      reasons,
    });
  }

  candidates.sort((a, b) => b.patternScore - a.patternScore);

  if (candidates.length === 0) return null;

  const top = candidates[0];

  return {
    accountId: top.accountId,
    confidence: top.confidence,
    patternScore: top.patternScore,
    expectedAmount: top.avgAmount,
    estimatedDelay: top.avgDelay,
    reason: top.reason,
    reasons: top.reasons,
    alternatives: candidates.slice(1, 4).map(c => ({
      accountId: c.accountId,
      confidence: c.confidence,
      expectedAmount: c.expectedAmount,
      reason: c.reason,
    })),
  };
}

// Helper: Trace path up to a specific account, optionally bounded by time
function getPathUpTo(accountId: string, txns: Transaction[], maxTime: number = Date.now()): string[] {
  const path = [accountId];
  let current = accountId;
  let currTime = maxTime;

  for (let i = 0; i < 5; i++) { // Trace back max 5 hops
    const incoming = txns
      .filter(t => t.destination === current && new Date(t.timestamp).getTime() <= currTime)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
    if (incoming.length === 0) break;
    
    current = incoming[0].source;
    currTime = new Date(incoming[0].timestamp).getTime();
    
    if (path.includes(current)) break; // avoid loops
    path.unshift(current);
  }
  
  return path;
}
