// Core data types for Financial Crime Graph Intelligence Platform

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'normal';
export type AccountStatus = 'normal' | 'watch' | 'high' | 'critical' | 'frozen';
export type TransactionStatus = 'completed' | 'pending' | 'flagged' | 'blocked' | 'held' | 'failed';
export type CaseStatus = 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed';
export type AlertType = 'critical' | 'high' | 'medium' | 'low';
export type ScamType = 'Digital Arrest' | 'Investment Scam' | 'UPI Scam' | 'Phishing' | 'Impersonation';

export interface Institution {
  id: string;
  code: string;
  name: string;
  type: string;
  isSynthetic: boolean;
}

export interface Account {
  id: string;
  name: string;
  bank: string;
  institutionCode?: string;
  institutionId?: string;
  accountType: 'victim' | 'mule' | 'normal' | 'customer' | 'merchant' | 'salary' | 'cashout' | 'atm' | 'beneficiary';
  riskScore: number;
  status: AccountStatus;
  deviceId?: string;
  firstSeen: string;
  transactionCount: number;
  totalIncoming: number;
  totalOutgoing: number;
  inDegree: number;
  outDegree: number;
  openingBalance?: number;
  currentBalance?: number;
  datasetVersion?: string;
  freezeReason?: string;
  freezeTriggerPattern?: string;
  freezeTimestamp?: string;
}

export interface Transaction {
  id: string;
  source: string;
  destination: string;
  sourceInstitution?: string;
  destinationInstitution?: string;
  amount: number;
  currency?: string;
  timestamp: string;
  type: string;
  paymentRail?: string;
  channel?: string;
  deviceId?: string;
  status: TransactionStatus;
  riskScore: number;
  scenarioId?: string;
  isHistorical?: boolean;
  isSimulated?: boolean;
  datasetVersion?: string;
  description?: string;
}

export interface ScamCase {
  id: string;
  type: ScamType;
  victimAccount: string;
  reportedTransactionId: string;
  amount: number;
  timestamp: string;
  reportedAt: string;
  status: CaseStatus;
  riskScore: number;
  priority?: string;
  currentLocation: string;
  predictedNextHop: string;
  originAccountId?: string;
  datasetVersion?: string;
  description: string;
}

export interface HistoricalPattern {
  id: string;
  patternId: string;
  patternType: string;
  orderedRoles: string[];
  transactionCount: number;
  amountProfile: string;
  timeIntervalProfile: string;
  occurrences: number;
  evidence?: string;
  datasetVersion: string;
}

export interface CaseNote {
  id: string;
  caseId: string;
  author: string;
  note: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  actor: string;
  details?: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  category: string;
  title: string;
  message: string;
  timestamp: string;
  relatedAccountId?: string;
  relatedCaseId?: string;
  relatedTransactionId?: string;
  read: boolean;
  actionLabel?: string;
}

export interface TrailStep {
  hopNumber: number;
  fromAccount: string;
  toAccount: string;
  transactionId: string;
  amount: number;
  timestamp: string;
  delay: number; // seconds from previous hop
  amountRetention: number; // percentage
  riskScore: number;
}

export interface MoneyTrail {
  caseId: string;
  steps: TrailStep[];
  totalAmount: number;
  totalLoss: number;
  totalHops: number;
  totalDuration: number;
  predictedNextHop: NextHopPrediction | null;
}

export interface PredictionReason {
  rule: string;
  detail: string;
}

export interface NextHopPrediction {
  accountId: string;
  confidence: number;
  expectedAmount: number;
  estimatedDelay: number;
  reason: string;
  patternScore: number;
  reasons: PredictionReason[];
  alternatives: NextHopCandidate[];
}

export interface NextHopCandidate {
  accountId: string;
  confidence: number;
  expectedAmount: number;
  reason: string;
}

export interface RiskFactor {
  name: string;
  score: number;
  maxScore: number;
  contribution: number;
  description: string;
}

export interface MuleRiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

export interface BlastRadiusData {
  accountId: string;
  directConnections: number;
  twoHopConnections: number;
  threeHopConnections: number;
  suspiciousAccounts: number;
  totalSuspiciousFlow: number;
  potentialDownstreamExposure: number;
  connectedNodes: string[];
  suspiciousNodes: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: Account['accountType'];
  riskScore: number;
  status: AccountStatus;
  deviceId?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  timestamp: string;
  riskScore: number;
  status: TransactionStatus;
  paymentRail?: string;
}

export interface SyntheticDataConfig {
  seed: number;
  accountCount: number;
  transactionCount: number;
  mulePercentage: number;
  fraudRingSize: number;
  avgTransactionAmount: number;
  transactionVelocity: 'low' | 'medium' | 'high';
  scamType: ScamType;
  networkComplexity: 'simple' | 'moderate' | 'complex';
}

export interface DashboardMetrics {
  activeCases: number;
  highRiskMules: number;
  transactionsAnalyzed: number;
  suspiciousNetworks: number;
  atRiskFunds: number;
  nextHopAlerts: number;
  caseTrend: number;
  muleTrend: number;
  transactionTrend: number;
}
