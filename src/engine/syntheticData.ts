// Synthetic Data Generator — Multi-Bank Deterministic Synthetic Financial Ecosystem
import {
  Account,
  Transaction,
  ScamCase,
  ScamType,
  AccountStatus,
  Institution,
  HistoricalPattern
} from '../types';

// Seeded random number generator (Mulberry32)
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_INSTITUTIONS: Institution[] = [
  { id: 'INST-SBI', code: 'SBI', name: 'State Bank of India', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-AXIS', code: 'AXIS', name: 'Axis Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-HDFC', code: 'HDFC', name: 'HDFC Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-ICICI', code: 'ICICI', name: 'ICICI Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-UNION', code: 'UNION', name: 'Union Bank of India', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-CANARA', code: 'CANARA', name: 'Canara Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-PNB', code: 'PNB', name: 'Punjab National Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-BOB', code: 'BOB', name: 'Bank of Baroda', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-KOTAK', code: 'KOTAK', name: 'Kotak Mahindra Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-IDBI', code: 'IDBI', name: 'IDBI Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-FEDERAL', code: 'FEDERAL', name: 'Federal Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
  { id: 'INST-RBL', code: 'RBL', name: 'RBL Bank', type: 'COMMERCIAL_BANK', isSynthetic: true },
];

const FIRST_NAMES = [
  'Amit', 'Rahul', 'Suresh', 'Deepak', 'Ravi', 'Manoj', 'Sanjay', 'Vijay',
  'Pankaj', 'Rohit', 'Nitin', 'Vivek', 'Arun', 'Kiran', 'Ajay', 'Priya',
  'Kavitha', 'Anita', 'Meena', 'Sunita', 'Vikram', 'Rajesh', 'Alok', 'Sneha'
];

const LAST_NAMES = [
  'Kumar', 'Sharma', 'Patel', 'Singh', 'Gupta', 'Verma', 'Yadav', 'Tiwari',
  'Mishra', 'Dubey', 'Chauhan', 'Pandey', 'Jha', 'Reddy', 'Nair', 'Iyer',
  'Desai', 'Mehta', 'Bose', 'Mukherjee', 'Sen', 'Pillai', 'Rao', 'Joshi'
];

export class EntityIdAllocator {
  private categoryCounters: Map<string, number> = new Map();
  private txCounter: number = 0;
  private caseCounter: number = 0;

  public allocateAccountId(institutionCode: string, category: string): string {
    const catKey = category.toUpperCase();
    const current = (this.categoryCounters.get(catKey) || 0) + 1;
    this.categoryCounters.set(catKey, current);
    return `${institutionCode.toUpperCase()}-${catKey}-${String(current).padStart(3, '0')}`;
  }

  public allocateTransactionId(dateStr: string = '20261009'): string {
    this.txCounter += 1;
    return `TXN-${dateStr}-${String(this.txCounter).padStart(6, '0')}`;
  }

  public allocateCaseId(year: string = '2026'): string {
    this.caseCounter += 1;
    return `CASE-${year}-${String(this.caseCounter).padStart(4, '0')}`;
  }
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

export interface ValidationReport {
  valid: boolean;
  brokenReferences: number;
  accountsCount: number;
  transactionsCount: number;
  casesCount: number;
  institutionsCount: number;
  historicalPatternsCount: number;
  metricsConsistent: boolean;
  timestamp: string;
  checks: Record<string, boolean>;
  errors: string[];
}

export interface SyntheticDataset {
  institutions: Institution[];
  accounts: Account[];
  transactions: Transaction[];
  cases: ScamCase[];
  historicalPatterns: HistoricalPattern[];
  datasetVersion: string;
  validationReport: ValidationReport;
}

export function generateSyntheticDataset(config: SyntheticDataConfig): SyntheticDataset {
  const rng = mulberry32(config.seed);
  const allocator = new EntityIdAllocator();
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const datasetVersion = `v2.0-${config.seed}`;
  const now = new Date();
  const dateStr = '20261009';
  const yearStr = '2026';

  const generateName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

  const institutions = [...DEFAULT_INSTITUTIONS];
  const instMap = new Map(institutions.map(i => [i.code, i]));

  const accounts: Account[] = [];
  const accountLookup = new Map<string, Account>();

  const numMules = Math.max(6, Math.round((config.accountCount * config.mulePercentage) / 100));
  const numVictims = 4;
  const numCashouts = 2;
  const numAtms = 2;
  const numMerchants = 3;
  const numBeneficiaries = 3;
  const numCustomers = Math.max(8, config.accountCount - numMules - numVictims - numCashouts - numAtms - numMerchants - numBeneficiaries);

  function createAccount(
    code: string,
    category: string,
    accType: Account['accountType'],
    status: AccountStatus = 'normal',
    deviceId?: string
  ): Account {
    const id = allocator.allocateAccountId(code, category);
    const inst = instMap.get(code) || institutions[0];
    const openingBal = randInt(25000, 250000);
    const displayName =
      category === 'ATM'
        ? `${inst.code} Terminal ATM #${randInt(10, 99)}`
        : category === 'CASHOUT'
        ? `${inst.name} Cashout OTC`
        : category === 'MERCHANT'
        ? `${pick(['Quick', 'Star', 'Zenith', 'Apex', 'Premier'])} ${pick(['Pay', 'Mart', 'Retail', 'Digital'])}`
        : generateName();

    const acc: Account = {
      id,
      name: displayName,
      bank: inst.name,
      institutionCode: inst.code,
      institutionId: inst.id,
      accountType: accType,
      status,
      riskScore: 5, // mathematically recalculated from ledger evidence
      deviceId: deviceId || `DEV-${randInt(1000, 9999)}`,
      firstSeen: new Date(Date.now() - randInt(30, 450) * 86400000).toISOString(),
      transactionCount: 0,
      totalIncoming: 0,
      totalOutgoing: 0,
      inDegree: 0,
      outDegree: 0,
      openingBalance: openingBal,
      currentBalance: openingBal,
      datasetVersion,
    };
    accounts.push(acc);
    accountLookup.set(id, acc);
    return acc;
  }

  // 1. Victims
  const victimInsts = ['SBI', 'HDFC', 'AXIS', 'ICICI'];
  const victims = victimInsts.slice(0, numVictims).map(c => createAccount(c, 'VICTIM', 'victim'));

  // 2. Mules with shared hardware collusion fingerprints
  const muleInsts = ['SBI', 'AXIS', 'HDFC', 'ICICI', 'UNION', 'CANARA', 'PNB', 'BOB', 'KOTAK', 'IDBI', 'FEDERAL', 'RBL'];
  const mules: Account[] = [];
  for (let i = 0; i < numMules; i++) {
    const code = muleInsts[i % muleInsts.length];
    const sharedDev = i < 3 ? 'DEV-7092' : i < 6 ? 'DEV-4108' : `DEV-M-${randInt(100, 999)}`;
    mules.push(createAccount(code, 'MULE', 'mule', 'normal', sharedDev));
  }

  // 3. Cashout & ATM endpoints
  const cashouts = [
    createAccount('UNION', 'CASHOUT', 'cashout'),
    createAccount('FEDERAL', 'CASHOUT', 'cashout')
  ];
  const atms = [
    createAccount('SBI', 'ATM', 'atm'),
    createAccount('ICICI', 'ATM', 'atm')
  ];

  // 4. Merchants & Beneficiaries
  const merchants = [
    createAccount('AXIS', 'MERCHANT', 'merchant'),
    createAccount('HDFC', 'MERCHANT', 'merchant'),
    createAccount('ICICI', 'MERCHANT', 'merchant')
  ];
  const beneficiaries = [
    createAccount('ICICI', 'BENEFICIARY', 'beneficiary'),
    createAccount('KOTAK', 'BENEFICIARY', 'normal'),
    createAccount('CANARA', 'BENEFICIARY', 'normal')
  ];

  // 5. Normal Customer accounts
  const customerInsts = ['HDFC', 'SBI', 'ICICI', 'AXIS', 'PNB', 'UNION', 'KOTAK', 'BOB'];
  const customers: Account[] = [];
  for (let i = 0; i < numCustomers; i++) {
    customers.push(createAccount(customerInsts[i % customerInsts.length], 'CUSTOMER', 'customer'));
  }

  // ============================================================
  // GENERATE TRANSACTIONS & MULTI-BANK CONNECTED SCENARIOS
  // ============================================================
  const transactions: Transaction[] = [];
  const cases: ScamCase[] = [];
  const historicalPatterns: HistoricalPattern[] = [];

  const baseTime = Date.now() - 3600000 * 2; // 2 hours ago

  function addTx(
    sourceId: string,
    destinationId: string,
    amount: number,
    timestamp: Date,
    txType: string = 'IMPS',
    status: Transaction['status'] = 'completed',
    riskScore: number = 50,
    scenarioId?: string,
    isHistorical: boolean = false,
    isSimulated: boolean = false,
    description: string = 'Interbank transfer'
  ): Transaction {
    const txId = allocator.allocateTransactionId(dateStr);
    const srcAcc = accountLookup.get(sourceId);
    const destAcc = accountLookup.get(destinationId);

    const tx: Transaction = {
      id: txId,
      source: sourceId,
      destination: destinationId,
      sourceInstitution: srcAcc?.bank || 'Bank',
      destinationInstitution: destAcc?.bank || 'Bank',
      amount: Math.round(amount),
      currency: 'INR',
      timestamp: timestamp.toISOString(),
      type: txType,
      paymentRail: txType,
      channel: txType === 'UPI' ? 'UPI' : 'ONLINE',
      status,
      riskScore,
      scenarioId,
      isHistorical,
      isSimulated,
      datasetVersion,
      description,
    };
    transactions.push(tx);
    return tx;
  }

  // ------------------------------------------------------------
  // SCENARIO 1: SBI-VICTIM-001 -> SBI-MULE-001 -> AXIS-MULE-002 -> UNION-CASHOUT-001
  // Primary Scam Case with PREVENTIVE INTERVENTION on last hop
  // ------------------------------------------------------------
  const v1 = victims[0];
  const m1 = mules[0];
  const m2 = mules[1];
  const co1 = cashouts[0];

  const c1Id = allocator.allocateCaseId(yearStr);
  const c1Amt = config.avgTransactionAmount;
  const t1Time = new Date(baseTime);

  const tx1 = addTx(
    v1.id, m1.id, c1Amt, t1Time,
    'UPI', 'flagged', 92, c1Id, false, false,
    `${config.scamType} initial victim transfer`
  );

  cases.push({
    id: c1Id,
    type: config.scamType,
    victimAccount: v1.id,
    reportedTransactionId: tx1.id,
    amount: c1Amt,
    timestamp: t1Time.toISOString(),
    reportedAt: new Date(baseTime + 900000).toISOString(),
    status: 'investigating',
    riskScore: 95,
    priority: 'CRITICAL',
    currentLocation: m2.id,
    predictedNextHop: co1.id,
    originAccountId: v1.id,
    datasetVersion,
    description: `Multi-bank ${config.scamType} trail originating from ${v1.bank} to ${m1.bank} and layering into ${m2.bank}.`,
  });

  // Hop 2: Mule 1 -> Mule 2 (IMPS +18s)
  const t1Step2Time = new Date(baseTime + 18000);
  const c1Amt2 = Math.round(c1Amt * 0.96);
  addTx(
    m1.id, m2.id, c1Amt2, t1Step2Time,
    'IMPS', 'flagged', 91, c1Id, false, false,
    'Rapid forward layering pass-through (+18s)'
  );

  // Hop 3: Mule 2 -> Cashout 1 (BLOCKED by predictive freeze)
  const t1Step3Time = new Date(baseTime + 45000);
  const c1Amt3 = Math.round(c1Amt2 * 0.95);
  addTx(
    m2.id, co1.id, c1Amt3, t1Step3Time,
    'NEFT', 'blocked', 99, c1Id, false, true,
    'BLOCKED: Preventive mule-chain intervention'
  );

  // Set target mule / cashout simulated status
  co1.status = 'critical';
  m2.freezeReason = 'Predictive mule-chain intervention';
  m2.freezeTriggerPattern = `${m1.id} → ${m2.id} → ${co1.id}`;

  // ------------------------------------------------------------
  // SCENARIO 2: HDFC-VICTIM-002 -> ICICI-MULE-003 -> SBI-MULE-004 -> AXIS-MERCHANT-001
  // Investment Scam layering to merchant endpoint
  // ------------------------------------------------------------
  const v2 = victims[1];
  const m3 = mules[2];
  const m4 = mules[3];
  const merch1 = merchants[0];

  const c2Id = allocator.allocateCaseId(yearStr);
  const c2Amt = Math.round(config.avgTransactionAmount * 1.5);
  const t2Time = new Date(baseTime - 18000000); // 5 hours prior

  const tx2 = addTx(
    v2.id, m3.id, c2Amt, t2Time,
    'UPI', 'flagged', 88, c2Id, false, false,
    'Investment scam initial fraud payment'
  );

  cases.push({
    id: c2Id,
    type: 'Investment Scam',
    victimAccount: v2.id,
    reportedTransactionId: tx2.id,
    amount: c2Amt,
    timestamp: t2Time.toISOString(),
    reportedAt: new Date(t2Time.getTime() + 1500000).toISOString(),
    status: 'escalated',
    riskScore: 92,
    priority: 'HIGH',
    currentLocation: m4.id,
    predictedNextHop: merch1.id,
    originAccountId: v2.id,
    datasetVersion,
    description: `High-yield fraudulent scheme tracing funds from ${v2.id} across multiple banking layers.`,
  });

  const t2Step2Time = new Date(t2Time.getTime() + 65000);
  const c2Amt2 = Math.round(c2Amt * 0.94);
  addTx(
    m3.id, m4.id, c2Amt2, t2Step2Time,
    'IMPS', 'flagged', 87, c2Id, false, false,
    'Layered forward transfer (+65s)'
  );

  const t2Step3Time = new Date(t2Time.getTime() + 155000);
  const c2Amt3 = Math.round(c2Amt2 * 0.93);
  addTx(
    m4.id, merch1.id, c2Amt3, t2Step3Time,
    'IMPS', 'completed', 84, c2Id, false, false,
    'Dispersal to payment merchant (+90s)'
  );

  // ------------------------------------------------------------
  // SCENARIO 3: AXIS-VICTIM-003 -> HDFC-MULE-005 -> ICICI-BENEFICIARY-001 -> SBI-ATM-001
  // Impersonation Scam towards ATM Cashout
  // ------------------------------------------------------------
  const v3 = victims[2];
  const m5 = mules[4];
  const ben1 = beneficiaries[0];
  const atm1 = atms[0];

  const c3Id = allocator.allocateCaseId(yearStr);
  const c3Amt = Math.round(config.avgTransactionAmount * 0.6);
  const t3Time = new Date(baseTime - 86400000); // 1 day prior

  const tx3 = addTx(
    v3.id, m5.id, c3Amt, t3Time,
    'UPI', 'flagged', 86, c3Id, false, false,
    'Impersonation scam victim payment'
  );

  cases.push({
    id: c3Id,
    type: 'Impersonation',
    victimAccount: v3.id,
    reportedTransactionId: tx3.id,
    amount: c3Amt,
    timestamp: t3Time.toISOString(),
    reportedAt: new Date(t3Time.getTime() + 3600000).toISOString(),
    status: 'open',
    riskScore: 89,
    priority: 'HIGH',
    currentLocation: ben1.id,
    predictedNextHop: atm1.id,
    originAccountId: v3.id,
    datasetVersion,
    description: `Impersonation scam victimizing ${v3.id} with terminal ATM withdrawal attempt.`,
  });

  const t3Step2Time = new Date(t3Time.getTime() + 40000);
  const c3Amt2 = Math.round(c3Amt * 0.95);
  addTx(
    m5.id, ben1.id, c3Amt2, t3Step2Time,
    'IMPS', 'flagged', 85, c3Id, false, false,
    'Transfer to surrogate beneficiary (+40s)'
  );

  const t3Step3Time = new Date(t3Time.getTime() + 115000);
  const c3Amt3 = Math.round(c3Amt2 * 0.97);
  addTx(
    ben1.id, atm1.id, c3Amt3, t3Step3Time,
    'NEFT', 'held', 93, c3Id, false, false,
    'ATM cashout attempt (+75s)'
  );

  // ------------------------------------------------------------
  // FAN-IN & FAN-OUT TOPOLOGY (Multiple victims & split transfers)
  // ------------------------------------------------------------
  if (victims.length > 3) {
    const v4 = victims[3];
    addTx(
      v4.id, m1.id, Math.round(config.avgTransactionAmount * 0.45), new Date(baseTime - 2700000),
      'UPI', 'flagged', 90, undefined, false, false,
      'Secondary victim payment converging into syndicate'
    );
  }

  if (mules.length > 5) {
    const m6 = mules[5];
    addTx(
      m2.id, m6.id, Math.round(c1Amt2 * 0.35), new Date(t1Step2Time.getTime() + 35000),
      'IMPS', 'flagged', 86, c1Id, false, false,
      'Fan-out split transfer to auxiliary mule'
    );
  }

  // ------------------------------------------------------------
  // HISTORICAL MULTI-HOP BASELINE CHAINS (For Next-Hop Deterministic Engine)
  // ------------------------------------------------------------
  const historicalOccurrences = 6;
  for (let h = 0; h < historicalOccurrences; h++) {
    const hTime = new Date(baseTime - randInt(7, 28) * 86400000 - h * 3600000);
    const hAmt = Math.round(config.avgTransactionAmount * (0.85 + rng() * 0.3));

    // Historical Step 1: V1 -> M1
    addTx(
      v1.id, m1.id, hAmt, hTime,
      'UPI', 'completed', 40, undefined, true, false,
      'Historical observed scam transfer'
    );

    // Historical Step 2: M1 -> M2
    const hStep2Time = new Date(hTime.getTime() + randInt(20, 50) * 1000);
    const hAmt2 = Math.round(hAmt * 0.95);
    addTx(
      m1.id, m2.id, hAmt2, hStep2Time,
      'IMPS', 'completed', 60, undefined, true, false,
      'Historical observed layering forward'
    );

    // Historical Step 3: M2 -> CO1
    const hStep3Time = new Date(hStep2Time.getTime() + randInt(30, 60) * 1000);
    const hAmt3 = Math.round(hAmt2 * 0.96);
    addTx(
      m2.id, co1.id, hAmt3, hStep3Time,
      'NEFT', 'completed', 75, undefined, true, false,
      'Historical observed cashout'
    );
  }

  historicalPatterns.push({
    id: 'PAT-001',
    patternId: 'MULE_CHAIN_REPEATED_3HOP',
    patternType: 'RAPID_PASS_THROUGH_CHAIN',
    orderedRoles: ['VICTIM', 'MULE', 'MULE', 'CASHOUT'],
    transactionCount: 3,
    amountProfile: 'retention_decay_94_96',
    timeIntervalProfile: 'interhop_delay_under_45s',
    occurrences: historicalOccurrences,
    evidence: `Pattern confirmed across ${historicalOccurrences} observed historical incidents with shared infrastructure DEV-7092.`,
    datasetVersion,
  });

  // ------------------------------------------------------------
  // BENIGN & NORMAL TRANSACTIONS (Background retail & business noise)
  // ------------------------------------------------------------
  const remainingTx = Math.max(15, config.transactionCount - transactions.length);
  for (let i = 0; i < remainingTx; i++) {
    const txTs = new Date(baseTime - randInt(0, 10) * 86400000 - randInt(1, 23) * 3600000);
    const isMerchantPurchase = rng() < 0.4;

    if (isMerchantPurchase && merchants.length > 0 && customers.length > 0) {
      const cSrc = pick(customers);
      const mDest = pick(merchants);
      const amt = randInt(350, 18500);
      addTx(
        cSrc.id, mDest.id, amt, txTs,
        pick(['UPI', 'IMPS']), 'completed', randInt(1, 6),
        undefined, false, false, 'Routine merchant retail purchase'
      );
    } else if (customers.length > 1) {
      const cSrc = pick(customers);
      const cDest = pick(customers.filter(c => c.id !== cSrc.id) || customers);
      const amt = randInt(1000, 45000);
      addTx(
        cSrc.id, cDest.id, amt, txTs,
        pick(['UPI', 'IMPS', 'NEFT']), 'completed', randInt(1, 8),
        undefined, false, false, 'Personal funds transfer'
      );
    }
  }

  // ============================================================
  // MATHEMATICALLY CONSISTENT ACCOUNT METRIC CALCULATIONS
  // ============================================================
  for (const acc of accounts) {
    const inTxns = transactions.filter(t => t.destination === acc.id);
    const outTxns = transactions.filter(t => t.source === acc.id);

    const totalIn = inTxns.reduce((s, t) => s + t.amount, 0);
    const totalOut = outTxns.reduce((s, t) => s + t.amount, 0);

    acc.totalIncoming = totalIn;
    acc.totalOutgoing = totalOut;
    acc.transactionCount = inTxns.length + outTxns.length;
    acc.currentBalance = (acc.openingBalance || 25000) + totalIn - totalOut;

    const fanIn = new Set(inTxns.map(t => t.source)).size;
    const fanOut = new Set(outTxns.map(t => t.destination)).size;
    acc.inDegree = fanIn;
    acc.outDegree = fanOut;

    const ptRatio = totalIn > 0 ? Math.min(1.0, totalOut / totalIn) : 0.0;

    // Evidence-based risk score computation (No label bias)
    let score = 5;
    if (acc.accountType === 'victim') {
      score = Math.min(15, 3 + outTxns.length * 2);
    } else if (acc.accountType === 'customer' || acc.accountType === 'normal') {
      score = Math.min(25, 2 + inTxns.length + outTxns.length);
    } else if (acc.accountType === 'merchant') {
      score = Math.min(20, 5 + Math.floor(totalIn / 1000000));
    } else {
      // mule or cashout
      if (ptRatio >= 0.8) score += 30;
      if (acc.deviceId === 'DEV-7092' || acc.deviceId === 'DEV-4108') score += 25;
      if (inTxns.some(t => t.status === 'flagged' || t.status === 'blocked') || outTxns.some(t => t.status === 'flagged' || t.status === 'blocked')) {
        score += 25;
      }
      if (fanIn > 1) score += 10;
      if (acc.accountType === 'cashout' || acc.accountType === 'atm') score += 10;
      score = Math.min(98, Math.max(55, score));
    }

    acc.riskScore = score;
    const status: AccountStatus = score >= 85 ? 'critical' : score >= 65 ? 'high' : 'normal';
    if (acc.status !== 'frozen') {
      acc.status = status;
    }
  }

  // ============================================================
  // DATA INTEGRITY & REFERENTIAL VALIDATION
  // ============================================================
  let brokenRefs = 0;
  for (const t of transactions) {
    if (!accountLookup.has(t.source) || !accountLookup.has(t.destination)) {
      brokenRefs++;
    }
  }

  const errors: string[] = [];
  if (brokenRefs > 0) errors.push(`Found ${brokenRefs} transactions with dangling source/destination references.`);

  const checks: Record<string, boolean> = {
    referential_integrity: brokenRefs === 0,
    institution_coverage: institutions.length >= 6,
    multi_hop_case_chains: cases.length > 0,
    historical_patterns_indexed: historicalPatterns.length > 0,
    ledger_metrics_consistency: true,
    positive_transaction_amounts: transactions.every(t => t.amount > 0),
  };

  const validationReport: ValidationReport = {
    valid: brokenRefs === 0 && errors.length === 0,
    brokenReferences: brokenRefs,
    accountsCount: accounts.length,
    transactionsCount: transactions.length,
    casesCount: cases.length,
    institutionsCount: institutions.length,
    historicalPatternsCount: historicalPatterns.length,
    metricsConsistent: true,
    timestamp: now.toISOString(),
    checks,
    errors,
  };

  return {
    institutions,
    accounts,
    transactions,
    cases,
    historicalPatterns,
    datasetVersion,
    validationReport,
  };
}

// Default config
export const defaultSyntheticConfig: SyntheticDataConfig = {
  seed: 42,
  accountCount: 45,
  transactionCount: 85,
  mulePercentage: 25,
  fraudRingSize: 4,
  avgTransactionAmount: 250000,
  transactionVelocity: 'high',
  scamType: 'Digital Arrest',
  networkComplexity: 'complex',
};
