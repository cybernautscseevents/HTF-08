// Risk Engine — Explainable mule risk scoring
import { Account, Transaction, RiskFactor, MuleRiskResult, RiskLevel } from '../types';
import { calculateFanIn, calculateFanOut, calculatePassThroughRatio, calculateVelocity, calculateCentrality } from './graphEngine';

// Weight configuration for the mule risk score
const WEIGHTS = {
  passThroughVelocity: 25,
  fanOutBehavior: 20,
  fanInBehavior: 15,
  graphCentrality: 15,
  sharedDevice: 15,
  transactionBurst: 10,
  networkRisk: 10,
  behavioralAnomaly: 5,
};

// Determine risk level from score
export function getRiskLevel(score: number): RiskLevel {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'normal';
}

// Get risk color
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'var(--risk-critical)';
    case 'high': return 'var(--risk-high)';
    case 'medium': return 'var(--risk-medium)';
    case 'low': return 'var(--risk-low)';
    default: return 'var(--risk-normal)';
  }
}

// Calculate pass-through velocity score
function calcPassThroughScore(accountId: string, txns: Transaction[]): { score: number; description: string } {
  const ratio = calculatePassThroughRatio(accountId, txns);
  const velocity = calculateVelocity(accountId, txns);

  let score = 0;
  if (ratio > 0.9) score += 15;
  else if (ratio > 0.7) score += 10;
  else if (ratio > 0.5) score += 5;

  if (velocity < 30) score += 10;
  else if (velocity < 120) score += 7;
  else if (velocity < 300) score += 3;

  const desc = velocity < 60
    ? `${Math.round(ratio * 100)}% funds passed through with avg ${Math.round(velocity)}s delay`
    : `${Math.round(ratio * 100)}% pass-through ratio`;

  return { score: Math.min(score, WEIGHTS.passThroughVelocity), description: desc };
}

// Calculate fan-out score
function calcFanOutScore(accountId: string, txns: Transaction[]): { score: number; description: string } {
  const fanOut = calculateFanOut(accountId, txns);
  let score = 0;
  if (fanOut >= 10) score = 20;
  else if (fanOut >= 6) score = 15;
  else if (fanOut >= 3) score = 8;
  else if (fanOut >= 2) score = 4;

  return { score: Math.min(score, WEIGHTS.fanOutBehavior), description: `${fanOut} outgoing counterparties` };
}

// Calculate fan-in score
function calcFanInScore(accountId: string, txns: Transaction[]): { score: number; description: string } {
  const fanIn = calculateFanIn(accountId, txns);
  let score = 0;
  if (fanIn >= 8) score = 15;
  else if (fanIn >= 5) score = 11;
  else if (fanIn >= 3) score = 6;
  else if (fanIn >= 2) score = 3;

  return { score: Math.min(score, WEIGHTS.fanInBehavior), description: `${fanIn} incoming counterparties` };
}

// Calculate graph centrality score
function calcCentralityScore(accountId: string, txns: Transaction[], totalNodes: number): { score: number; description: string } {
  const centrality = calculateCentrality(accountId, txns, totalNodes);
  let score = 0;
  if (centrality > 0.4) score = 15;
  else if (centrality > 0.25) score = 11;
  else if (centrality > 0.15) score = 7;
  else if (centrality > 0.05) score = 3;

  return { score: Math.min(score, WEIGHTS.graphCentrality), description: `Centrality: ${(centrality * 100).toFixed(1)}%` };
}

// Calculate transaction burst score
function calcBurstScore(accountId: string, txns: Transaction[]): { score: number; description: string } {
  const acctTxns = txns.filter(t => t.source === accountId || t.destination === accountId);
  if (acctTxns.length === 0) return { score: 0, description: 'No transactions' };

  // Check for bursts: multiple transactions within short windows
  const sorted = acctTxns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let maxBurst = 0;

  for (let i = 0; i < sorted.length; i++) {
    const windowStart = new Date(sorted[i].timestamp).getTime();
    let count = 0;
    for (let j = i; j < sorted.length; j++) {
      if (new Date(sorted[j].timestamp).getTime() - windowStart <= 300000) { // 5 min window
        count++;
      } else break;
    }
    maxBurst = Math.max(maxBurst, count);
  }

  let score = 0;
  if (maxBurst >= 8) score = 10;
  else if (maxBurst >= 5) score = 7;
  else if (maxBurst >= 3) score = 4;

  return { score: Math.min(score, WEIGHTS.transactionBurst), description: `${maxBurst} transactions in 5-min burst` };
}

// Calculate network risk score
function calcNetworkRiskScore(accountId: string, txns: Transaction[], accounts: Account[]): { score: number; description: string } {
  const neighbors = new Set<string>();
  txns.forEach(t => {
    if (t.source === accountId) neighbors.add(t.destination);
    if (t.destination === accountId) neighbors.add(t.source);
  });

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  let highRiskNeighbors = 0;
  neighbors.forEach(n => {
    const acct = accountMap.get(n);
    if (acct && acct.riskScore >= 65) highRiskNeighbors++;
  });

  let score = 0;
  if (highRiskNeighbors >= 4) score = 10;
  else if (highRiskNeighbors >= 2) score = 7;
  else if (highRiskNeighbors >= 1) score = 4;

  return { score: Math.min(score, WEIGHTS.networkRisk), description: `Connected to ${highRiskNeighbors} high-risk accounts` };
}

// Calculate behavioral anomaly score
function calcBehavioralScore(account: Account, txns: Transaction[]): { score: number; description: string } {
  let score = 0;
  const descriptions: string[] = [];

  // Check account age vs transaction count
  const ageMs = Date.now() - new Date(account.firstSeen).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const txnRate = account.transactionCount / Math.max(ageDays, 1);

  if (ageDays < 30 && account.transactionCount > 20) {
    score += 3;
    descriptions.push('New account with high activity');
  }

  // Check flagged transaction ratio
  const acctTxns = txns.filter(t => t.source === account.id || t.destination === account.id);
  const flagged = acctTxns.filter(t => t.status === 'flagged').length;
  if (acctTxns.length > 0 && flagged / acctTxns.length > 0.5) {
    score += 2;
    descriptions.push(`${Math.round(flagged / acctTxns.length * 100)}% flagged transactions`);
  }

  return {
    score: Math.min(score, WEIGHTS.behavioralAnomaly),
    description: descriptions.length > 0 ? descriptions.join('; ') : 'Normal behavioral pattern',
  };
}

// Calculate shared device infrastructure risk
function calcSharedDeviceScore(account: Account, allAccounts: Account[]): { score: number; description: string } {
  if (!account.deviceId) return { score: 0, description: 'No shared hardware identified' };
  const sharing = allAccounts.filter(a => a.deviceId === account.deviceId && a.id !== account.id);
  if (sharing.length >= 2) {
    return {
      score: 15,
      description: `Hardware ID ${account.deviceId} shared with ${sharing.length} syndicates (${sharing.map(a => a.id).slice(0, 3).join(', ')})`
    };
  } else if (sharing.length === 1) {
    return {
      score: 10,
      description: `Hardware ID ${account.deviceId} shared with ${sharing[0].id}`
    };
  }
  return { score: 0, description: `Dedicated hardware signature (${account.deviceId})` };
}

// Main mule risk calculation — explainable and deterministic
export function calculateMuleRisk(account: Account, transactions: Transaction[], allAccounts: Account[]): MuleRiskResult {
  const totalNodes = allAccounts.length;

  const passThrough = calcPassThroughScore(account.id, transactions);
  const fanOut = calcFanOutScore(account.id, transactions);
  const fanIn = calcFanInScore(account.id, transactions);
  const centrality = calcCentralityScore(account.id, transactions, totalNodes);
  const sharedDev = calcSharedDeviceScore(account, allAccounts);
  const burst = calcBurstScore(account.id, transactions);
  const network = calcNetworkRiskScore(account.id, transactions, allAccounts);
  const behavioral = calcBehavioralScore(account, transactions);

  const rawScore = passThrough.score + fanOut.score + fanIn.score + centrality.score + sharedDev.score + burst.score + network.score + behavioral.score;
  const totalScore = Math.max(account.riskScore, Math.min(rawScore, 100));

  const factors: RiskFactor[] = [
    { name: 'Pass-through velocity', score: passThrough.score, maxScore: WEIGHTS.passThroughVelocity, contribution: passThrough.score, description: passThrough.description },
    { name: 'Fan-out behavior', score: fanOut.score, maxScore: WEIGHTS.fanOutBehavior, contribution: fanOut.score, description: fanOut.description },
    { name: 'Fan-in behavior', score: fanIn.score, maxScore: WEIGHTS.fanInBehavior, contribution: fanIn.score, description: fanIn.description },
    { name: 'Shared device infrastructure', score: sharedDev.score, maxScore: WEIGHTS.sharedDevice, contribution: sharedDev.score, description: sharedDev.description },
    { name: 'Graph centrality', score: centrality.score, maxScore: WEIGHTS.graphCentrality, contribution: centrality.score, description: centrality.description },
    { name: 'Transaction burst', score: burst.score, maxScore: WEIGHTS.transactionBurst, contribution: burst.score, description: burst.description },
    { name: 'Suspicious network', score: network.score, maxScore: WEIGHTS.networkRisk, contribution: network.score, description: network.description },
    { name: 'Behavioral anomaly', score: behavioral.score, maxScore: WEIGHTS.behavioralAnomaly, contribution: behavioral.score, description: behavioral.description },
  ];

  return {
    score: totalScore,
    level: getRiskLevel(totalScore),
    factors,
  };
}
