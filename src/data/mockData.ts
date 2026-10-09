import { Account, Transaction, ScamCase, Alert } from '../types';

// ============================================================
// CANONICAL MOCK DATA — Single Source of Truth
// All accounts, transactions, cases, and alerts reference
// the same entity IDs. Nothing is disconnected.
// ============================================================

export const accounts: Account[] = [
  // === VICTIMS ===
  { id: 'VICTIM-001', name: 'Ramesh Kumar', bank: 'SBI', accountType: 'victim', riskScore: 5, status: 'normal', deviceId: 'DEV-1001', firstSeen: '2026-01-15T09:00:00Z', transactionCount: 142, totalIncoming: 1840000, totalOutgoing: 1790000, inDegree: 3, outDegree: 4 },
  { id: 'VICTIM-002', name: 'Priya Sharma', bank: 'HDFC', accountType: 'victim', riskScore: 3, status: 'normal', deviceId: 'DEV-1002', firstSeen: '2025-11-20T09:00:00Z', transactionCount: 89, totalIncoming: 920000, totalOutgoing: 880000, inDegree: 2, outDegree: 3 },
  { id: 'VICTIM-003', name: 'Suresh Patel', bank: 'ICICI', accountType: 'victim', riskScore: 4, status: 'normal', deviceId: 'DEV-1003', firstSeen: '2026-03-10T09:00:00Z', transactionCount: 67, totalIncoming: 560000, totalOutgoing: 540000, inDegree: 2, outDegree: 2 },

  // === PRIMARY MULE CHAIN (Case SC-001) — Shared Infrastructure DEV-7092 ===
  { id: 'MULE-017', name: 'Deepak Verma', bank: 'Axis', accountType: 'mule', riskScore: 88, status: 'critical', deviceId: 'DEV-7092', firstSeen: '2026-09-28T14:00:00Z', transactionCount: 47, totalIncoming: 342000, totalOutgoing: 328000, inDegree: 7, outDegree: 11 },
  { id: 'MULE-042', name: 'Ravi Tiwari', bank: 'PNB', accountType: 'mule', riskScore: 94, status: 'critical', deviceId: 'DEV-7092', firstSeen: '2026-09-30T08:00:00Z', transactionCount: 62, totalIncoming: 518000, totalOutgoing: 484000, inDegree: 9, outDegree: 13 },
  { id: 'MULE-103', name: 'Ajay Singh', bank: 'BOB', accountType: 'mule', riskScore: 91, status: 'critical', deviceId: 'DEV-7092', firstSeen: '2026-10-01T11:00:00Z', transactionCount: 38, totalIncoming: 287000, totalOutgoing: 271000, inDegree: 6, outDegree: 8 },

  // === SECONDARY MULE CHAIN (Case SC-002) — Shared Infrastructure DEV-4108 ===
  { id: 'MULE-028', name: 'Nitin Gupta', bank: 'Kotak', accountType: 'mule', riskScore: 82, status: 'high', deviceId: 'DEV-4108', firstSeen: '2026-09-25T10:00:00Z', transactionCount: 33, totalIncoming: 245000, totalOutgoing: 231000, inDegree: 5, outDegree: 7 },
  { id: 'MULE-055', name: 'Vivek Yadav', bank: 'IDBI', accountType: 'mule', riskScore: 79, status: 'high', deviceId: 'DEV-4108', firstSeen: '2026-10-02T13:00:00Z', transactionCount: 28, totalIncoming: 198000, totalOutgoing: 184000, inDegree: 4, outDegree: 6 },
  { id: 'MULE-071', name: 'Manoj Dubey', bank: 'UCO', accountType: 'mule', riskScore: 76, status: 'high', deviceId: 'DEV-4108', firstSeen: '2026-10-03T09:00:00Z', transactionCount: 22, totalIncoming: 167000, totalOutgoing: 152000, inDegree: 3, outDegree: 5 },

  // === TERTIARY MULES (Case SC-003 + cross-links) ===
  { id: 'MULE-119', name: 'Sanjay Mishra', bank: 'Indian Bank', accountType: 'mule', riskScore: 73, status: 'high', deviceId: 'DEV-5520', firstSeen: '2026-10-04T07:00:00Z', transactionCount: 19, totalIncoming: 134000, totalOutgoing: 121000, inDegree: 4, outDegree: 4 },
  { id: 'MULE-088', name: 'Pankaj Chauhan', bank: 'Canara', accountType: 'mule', riskScore: 68, status: 'watch', deviceId: 'DEV-5520', firstSeen: '2026-10-02T15:00:00Z', transactionCount: 15, totalIncoming: 98000, totalOutgoing: 89000, inDegree: 3, outDegree: 3 },
  { id: 'MULE-134', name: 'Rohit Pandey', bank: 'Union', accountType: 'mule', riskScore: 61, status: 'watch', deviceId: 'DEV-3310', firstSeen: '2026-10-05T12:00:00Z', transactionCount: 11, totalIncoming: 76000, totalOutgoing: 67000, inDegree: 2, outDegree: 3 },
  { id: 'MULE-156', name: 'Amit Jha', bank: 'BOI', accountType: 'mule', riskScore: 57, status: 'watch', deviceId: 'DEV-3310', firstSeen: '2026-10-05T16:00:00Z', transactionCount: 9, totalIncoming: 54000, totalOutgoing: 45000, inDegree: 2, outDegree: 2 },

  // === CASHOUT ACCOUNTS ===
  { id: 'CASHOUT-009', name: 'Unknown Beneficiary', bank: 'Federal', accountType: 'cashout', riskScore: 97, status: 'critical', deviceId: 'DEV-9901', firstSeen: '2026-10-06T04:00:00Z', transactionCount: 8, totalIncoming: 212000, totalOutgoing: 208000, inDegree: 5, outDegree: 1 },
  { id: 'CASHOUT-014', name: 'Shell Entity Ltd', bank: 'RBL', accountType: 'cashout', riskScore: 92, status: 'critical', deviceId: 'DEV-9902', firstSeen: '2026-10-05T22:00:00Z', transactionCount: 6, totalIncoming: 156000, totalOutgoing: 149000, inDegree: 3, outDegree: 1 },

  // === NORMAL ACCOUNTS (noise) ===
  { id: 'NORMAL-001', name: 'Anita Desai', bank: 'SBI', accountType: 'normal', riskScore: 2, status: 'normal', deviceId: 'DEV-2001', firstSeen: '2024-06-01T09:00:00Z', transactionCount: 234, totalIncoming: 3200000, totalOutgoing: 3150000, inDegree: 4, outDegree: 5 },
  { id: 'NORMAL-002', name: 'Vikram Mehta', bank: 'HDFC', accountType: 'normal', riskScore: 4, status: 'normal', deviceId: 'DEV-2002', firstSeen: '2023-09-15T09:00:00Z', transactionCount: 312, totalIncoming: 4500000, totalOutgoing: 4480000, inDegree: 6, outDegree: 7 },
  { id: 'NORMAL-003', name: 'Kavitha Nair', bank: 'ICICI', accountType: 'normal', riskScore: 1, status: 'normal', deviceId: 'DEV-2003', firstSeen: '2025-01-20T09:00:00Z', transactionCount: 178, totalIncoming: 2100000, totalOutgoing: 2080000, inDegree: 3, outDegree: 4 },
  { id: 'NORMAL-004', name: 'Rajesh Iyer', bank: 'Axis', accountType: 'normal', riskScore: 3, status: 'normal', deviceId: 'DEV-2004', firstSeen: '2024-03-10T09:00:00Z', transactionCount: 198, totalIncoming: 2800000, totalOutgoing: 2750000, inDegree: 5, outDegree: 6 },
  { id: 'NORMAL-005', name: 'Meena Reddy', bank: 'Kotak', accountType: 'normal', riskScore: 5, status: 'normal', deviceId: 'DEV-2005', firstSeen: '2024-11-05T09:00:00Z', transactionCount: 156, totalIncoming: 1900000, totalOutgoing: 1870000, inDegree: 3, outDegree: 4 },

  // === MERCHANTS ===
  { id: 'MERCHANT-001', name: 'QuickMart Retail', bank: 'HDFC', accountType: 'merchant', riskScore: 1, status: 'normal', deviceId: 'DEV-POS-01', firstSeen: '2022-01-01T09:00:00Z', transactionCount: 12400, totalIncoming: 89000000, totalOutgoing: 88500000, inDegree: 450, outDegree: 12 },
  { id: 'MERCHANT-002', name: 'FoodExpress Delivery', bank: 'ICICI', accountType: 'merchant', riskScore: 2, status: 'normal', deviceId: 'DEV-POS-02', firstSeen: '2023-06-15T09:00:00Z', transactionCount: 8900, totalIncoming: 45000000, totalOutgoing: 44800000, inDegree: 320, outDegree: 8 },
  { id: 'MERCHANT-204', name: 'Bharti Electronics', bank: 'SBI', accountType: 'merchant', riskScore: 18, status: 'normal', deviceId: 'DEV-POS-03', firstSeen: '2024-02-20T09:00:00Z', transactionCount: 3200, totalIncoming: 28000000, totalOutgoing: 27800000, inDegree: 180, outDegree: 15 },

  // === SALARY ACCOUNTS ===
  { id: 'SALARY-001', name: 'TechCorp Payroll', bank: 'SBI', accountType: 'salary', riskScore: 0, status: 'normal', deviceId: 'DEV-CORP-01', firstSeen: '2020-01-01T09:00:00Z', transactionCount: 2400, totalIncoming: 120000000, totalOutgoing: 119800000, inDegree: 1, outDegree: 200 },
  { id: 'SALARY-002', name: 'InfoSys Salary', bank: 'HDFC', accountType: 'salary', riskScore: 0, status: 'normal', deviceId: 'DEV-CORP-02', firstSeen: '2019-06-01T09:00:00Z', transactionCount: 3600, totalIncoming: 180000000, totalOutgoing: 179500000, inDegree: 1, outDegree: 300 },
];

// ============================================================
// TRANSACTIONS
// ============================================================

export const transactions: Transaction[] = [
  // === PRIMARY SCAM TRAIL (Case SC-001: Digital Arrest Scam) ===
  { id: 'TX-10001', source: 'VICTIM-001', destination: 'MULE-017', amount: 50000, timestamp: '2026-10-07T10:42:13Z', type: 'UPI', status: 'flagged', riskScore: 92, description: 'Scam payment - Digital arrest threat' },
  { id: 'TX-10002', source: 'MULE-017', destination: 'MULE-042', amount: 48700, timestamp: '2026-10-07T10:42:31Z', type: 'IMPS', status: 'flagged', riskScore: 91, description: 'Rapid forward - 18 sec delay' },
  { id: 'TX-10003', source: 'MULE-042', destination: 'MULE-103', amount: 46900, timestamp: '2026-10-07T10:43:02Z', type: 'IMPS', status: 'flagged', riskScore: 89, description: 'Layered transfer - 31 sec delay' },
  { id: 'TX-10004', source: 'MULE-103', destination: 'CASHOUT-009', amount: 44800, timestamp: '2026-10-07T10:43:47Z', type: 'NEFT', status: 'flagged', riskScore: 95, description: 'Cashout transfer - 45 sec delay' },

  // === SECONDARY SCAM TRAIL (Case SC-002: Investment Scam) ===
  { id: 'TX-10011', source: 'VICTIM-002', destination: 'MULE-028', amount: 125000, timestamp: '2026-10-06T14:22:05Z', type: 'UPI', status: 'flagged', riskScore: 88, description: 'Investment scam payment' },
  { id: 'TX-10012', source: 'MULE-028', destination: 'MULE-055', amount: 119500, timestamp: '2026-10-06T14:23:12Z', type: 'IMPS', status: 'flagged', riskScore: 85, description: 'Layered forward - 67 sec delay' },
  { id: 'TX-10013', source: 'MULE-055', destination: 'MULE-071', amount: 115000, timestamp: '2026-10-06T14:24:48Z', type: 'IMPS', status: 'flagged', riskScore: 83, description: 'Continued layering - 96 sec delay' },
  { id: 'TX-10014', source: 'MULE-071', destination: 'CASHOUT-014', amount: 111200, timestamp: '2026-10-06T14:26:30Z', type: 'NEFT', status: 'flagged', riskScore: 90, description: 'Cashout - 102 sec delay' },

  // === TERTIARY SCAM TRAIL (Case SC-003: UPI Scam) ===
  { id: 'TX-10021', source: 'VICTIM-003', destination: 'MULE-119', amount: 35000, timestamp: '2026-10-07T08:15:22Z', type: 'UPI', status: 'flagged', riskScore: 78, description: 'UPI scam payment' },
  { id: 'TX-10022', source: 'MULE-119', destination: 'MULE-088', amount: 33200, timestamp: '2026-10-07T08:16:05Z', type: 'IMPS', status: 'flagged', riskScore: 75, description: 'Forward - 43 sec delay' },
  { id: 'TX-10023', source: 'MULE-088', destination: 'MULE-134', amount: 31500, timestamp: '2026-10-07T08:17:18Z', type: 'IMPS', status: 'flagged', riskScore: 72, description: 'Layered transfer - 73 sec delay' },
  { id: 'TX-10024', source: 'MULE-134', destination: 'MULE-156', amount: 29800, timestamp: '2026-10-07T08:18:42Z', type: 'IMPS', status: 'completed', riskScore: 68, description: 'Further layering - 84 sec delay' },

  // === CROSS-LINKS between mule networks ===
  { id: 'TX-10031', source: 'MULE-042', destination: 'MULE-028', amount: 12000, timestamp: '2026-10-06T22:10:45Z', type: 'IMPS', status: 'flagged', riskScore: 72, description: 'Cross-network transfer' },
  { id: 'TX-10032', source: 'MULE-055', destination: 'MULE-103', amount: 8500, timestamp: '2026-10-07T01:15:30Z', type: 'IMPS', status: 'flagged', riskScore: 69, description: 'Cross-network transfer' },
  { id: 'TX-10033', source: 'MULE-017', destination: 'MULE-119', amount: 15000, timestamp: '2026-10-06T18:42:10Z', type: 'IMPS', status: 'flagged', riskScore: 74, description: 'Cross-network transfer' },

  // === Additional mule traffic (volume) ===
  { id: 'TX-10041', source: 'MULE-017', destination: 'MULE-042', amount: 22000, timestamp: '2026-10-06T08:15:00Z', type: 'IMPS', status: 'flagged', riskScore: 78, description: 'Earlier mule transfer' },
  { id: 'TX-10042', source: 'MULE-017', destination: 'MULE-042', amount: 18500, timestamp: '2026-10-05T22:30:00Z', type: 'IMPS', status: 'flagged', riskScore: 75, description: 'Repeated mule pattern' },
  { id: 'TX-10043', source: 'MULE-042', destination: 'MULE-103', amount: 35000, timestamp: '2026-10-06T11:00:00Z', type: 'IMPS', status: 'flagged', riskScore: 80, description: 'Mule chain continuation' },
  { id: 'TX-10044', source: 'MULE-103', destination: 'CASHOUT-009', amount: 28000, timestamp: '2026-10-06T11:01:20Z', type: 'NEFT', status: 'flagged', riskScore: 85, description: 'Prior cashout attempt' },

  // === NORMAL TRANSACTIONS (noise) ===
  { id: 'TX-20001', source: 'SALARY-001', destination: 'NORMAL-001', amount: 65000, timestamp: '2026-10-01T06:00:00Z', type: 'NEFT', status: 'completed', riskScore: 2, description: 'Monthly salary' },
  { id: 'TX-20002', source: 'SALARY-001', destination: 'NORMAL-004', amount: 72000, timestamp: '2026-10-01T06:00:00Z', type: 'NEFT', status: 'completed', riskScore: 2, description: 'Monthly salary' },
  { id: 'TX-20003', source: 'SALARY-002', destination: 'NORMAL-002', amount: 85000, timestamp: '2026-10-01T06:00:00Z', type: 'NEFT', status: 'completed', riskScore: 1, description: 'Monthly salary' },
  { id: 'TX-20004', source: 'SALARY-002', destination: 'VICTIM-001', amount: 55000, timestamp: '2026-10-01T06:00:00Z', type: 'NEFT', status: 'completed', riskScore: 1, description: 'Monthly salary' },
  { id: 'TX-20005', source: 'NORMAL-001', destination: 'MERCHANT-001', amount: 3200, timestamp: '2026-10-02T12:15:00Z', type: 'UPI', status: 'completed', riskScore: 1, description: 'Grocery purchase' },
  { id: 'TX-20006', source: 'NORMAL-002', destination: 'MERCHANT-002', amount: 450, timestamp: '2026-10-02T19:30:00Z', type: 'UPI', status: 'completed', riskScore: 1, description: 'Food delivery' },
  { id: 'TX-20007', source: 'NORMAL-003', destination: 'MERCHANT-001', amount: 1800, timestamp: '2026-10-03T10:45:00Z', type: 'UPI', status: 'completed', riskScore: 1, description: 'Shopping' },
  { id: 'TX-20008', source: 'NORMAL-004', destination: 'NORMAL-001', amount: 5000, timestamp: '2026-10-03T14:20:00Z', type: 'UPI', status: 'completed', riskScore: 3, description: 'Personal transfer' },
  { id: 'TX-20009', source: 'NORMAL-005', destination: 'MERCHANT-204', amount: 28000, timestamp: '2026-10-04T11:00:00Z', type: 'UPI', status: 'completed', riskScore: 4, description: 'Electronics purchase' },
  { id: 'TX-20010', source: 'NORMAL-001', destination: 'NORMAL-003', amount: 2000, timestamp: '2026-10-04T16:30:00Z', type: 'UPI', status: 'completed', riskScore: 2, description: 'Repayment' },
  { id: 'TX-20011', source: 'VICTIM-001', destination: 'MERCHANT-001', amount: 4500, timestamp: '2026-10-05T09:15:00Z', type: 'UPI', status: 'completed', riskScore: 1, description: 'Regular purchase' },
  { id: 'TX-20012', source: 'VICTIM-002', destination: 'MERCHANT-002', amount: 890, timestamp: '2026-10-05T20:00:00Z', type: 'UPI', status: 'completed', riskScore: 1, description: 'Food order' },
  { id: 'TX-20013', source: 'NORMAL-002', destination: 'NORMAL-005', amount: 15000, timestamp: '2026-10-06T08:00:00Z', type: 'IMPS', status: 'completed', riskScore: 3, description: 'Loan repayment' },
  { id: 'TX-20014', source: 'NORMAL-003', destination: 'MERCHANT-204', amount: 42000, timestamp: '2026-10-06T13:00:00Z', type: 'NEFT', status: 'completed', riskScore: 5, description: 'Appliance purchase' },
  { id: 'TX-20015', source: 'NORMAL-004', destination: 'MERCHANT-002', amount: 680, timestamp: '2026-10-07T07:30:00Z', type: 'UPI', status: 'completed', riskScore: 1, description: 'Breakfast order' },

  // Additional mule transactions for volume
  { id: 'TX-10051', source: 'MULE-028', destination: 'MULE-088', amount: 9200, timestamp: '2026-10-05T20:15:00Z', type: 'IMPS', status: 'flagged', riskScore: 65, description: 'Inter-mule transfer' },
  { id: 'TX-10052', source: 'MULE-088', destination: 'MULE-042', amount: 7800, timestamp: '2026-10-05T20:16:30Z', type: 'IMPS', status: 'flagged', riskScore: 67, description: 'Cross-link mule' },
  { id: 'TX-10053', source: 'MULE-134', destination: 'CASHOUT-009', amount: 14000, timestamp: '2026-10-06T03:00:00Z', type: 'NEFT', status: 'flagged', riskScore: 78, description: 'Cashout attempt' },
  { id: 'TX-10054', source: 'MULE-071', destination: 'MULE-042', amount: 5600, timestamp: '2026-10-06T15:30:00Z', type: 'IMPS', status: 'flagged', riskScore: 62, description: 'Back-flow transfer' },
  { id: 'TX-10055', source: 'MULE-156', destination: 'CASHOUT-014', amount: 11000, timestamp: '2026-10-07T09:00:00Z', type: 'NEFT', status: 'completed', riskScore: 71, description: 'Cashout' },
];

// ============================================================
// SCAM CASES
// ============================================================

export const scamCases: ScamCase[] = [
  {
    id: 'SC-001',
    type: 'Digital Arrest',
    victimAccount: 'VICTIM-001',
    reportedTransactionId: 'TX-10001',
    amount: 50000,
    timestamp: '2026-10-07T10:42:13Z',
    reportedAt: '2026-10-07T10:55:00Z',
    status: 'investigating',
    riskScore: 94,
    currentLocation: 'MULE-103',
    predictedNextHop: 'CASHOUT-009',
    description: 'Victim received a call impersonating CBI officer. Was told their Aadhaar was linked to money laundering. Threatened with immediate arrest. Transferred ₹50,000 under duress.',
  },
  {
    id: 'SC-002',
    type: 'Investment Scam',
    victimAccount: 'VICTIM-002',
    reportedTransactionId: 'TX-10011',
    amount: 125000,
    timestamp: '2026-10-06T14:22:05Z',
    reportedAt: '2026-10-06T16:30:00Z',
    status: 'escalated',
    riskScore: 88,
    currentLocation: 'CASHOUT-014',
    predictedNextHop: '',
    description: 'Victim lured into fake stock trading platform. Promised 200% returns. Made initial investment of ₹1,25,000 through UPI.',
  },
  {
    id: 'SC-003',
    type: 'UPI Scam',
    victimAccount: 'VICTIM-003',
    reportedTransactionId: 'TX-10021',
    amount: 35000,
    timestamp: '2026-10-07T08:15:22Z',
    reportedAt: '2026-10-07T09:00:00Z',
    status: 'open',
    riskScore: 72,
    currentLocation: 'MULE-134',
    predictedNextHop: 'MULE-156',
    description: 'Victim received fake UPI collect request disguised as refund from e-commerce platform. Approved ₹35,000 payment.',
  },
  {
    id: 'SC-004',
    type: 'Phishing',
    victimAccount: 'VICTIM-001',
    reportedTransactionId: 'TX-10041',
    amount: 22000,
    timestamp: '2026-10-06T08:15:00Z',
    reportedAt: '2026-10-06T12:00:00Z',
    status: 'resolved',
    riskScore: 65,
    currentLocation: 'MULE-042',
    predictedNextHop: 'MULE-103',
    description: 'Victim clicked phishing link received via SMS. Bank credentials compromised. ₹22,000 debited via IMPS.',
  },
  {
    id: 'SC-005',
    type: 'Impersonation',
    victimAccount: 'VICTIM-002',
    reportedTransactionId: 'TX-10051',
    amount: 9200,
    timestamp: '2026-10-05T20:15:00Z',
    reportedAt: '2026-10-06T08:00:00Z',
    status: 'closed',
    riskScore: 55,
    currentLocation: 'MULE-042',
    predictedNextHop: '',
    description: 'Caller impersonated bank manager, obtained OTP. ₹9,200 transferred to unknown account.',
  },
];

// ============================================================
// ALERTS
// ============================================================

export const alerts: Alert[] = [
  {
    id: 'ALT-001',
    type: 'critical',
    category: 'NEXT-HOP RISK',
    title: 'Imminent fund transfer detected',
    message: 'MULE-103 is likely to transfer ₹44,800 to CASHOUT-009 within 60 seconds. Immediate intervention recommended.',
    timestamp: '2026-10-07T10:43:05Z',
    relatedAccountId: 'MULE-103',
    relatedCaseId: 'SC-001',
    relatedTransactionId: 'TX-10003',
    read: false,
    actionLabel: 'Investigate',
  },
  {
    id: 'ALT-002',
    type: 'critical',
    category: 'RAPID PASS-THROUGH',
    title: 'High-velocity mule activity',
    message: 'MULE-017 forwarded 97% of incoming funds within 18 seconds. Pattern consistent with automated mule account.',
    timestamp: '2026-10-07T10:42:35Z',
    relatedAccountId: 'MULE-017',
    relatedCaseId: 'SC-001',
    relatedTransactionId: 'TX-10002',
    read: false,
    actionLabel: 'View Trail',
  },
  {
    id: 'ALT-003',
    type: 'critical',
    category: 'NETWORK DETECTED',
    title: 'Suspicious transaction cluster identified',
    message: '6 high-risk accounts form a connected transaction network. Combined throughput: ₹4.2L in last 48 hours.',
    timestamp: '2026-10-07T10:40:00Z',
    relatedAccountId: 'MULE-042',
    relatedCaseId: 'SC-001',
    read: false,
    actionLabel: 'Explore Network',
  },
  {
    id: 'ALT-004',
    type: 'high',
    category: 'NEXT-HOP RISK',
    title: 'Predicted fund movement',
    message: 'MULE-134 shows high probability of transferring ₹29,800 to MULE-156 based on behavioral pattern analysis.',
    timestamp: '2026-10-07T08:18:00Z',
    relatedAccountId: 'MULE-134',
    relatedCaseId: 'SC-003',
    read: false,
    actionLabel: 'Investigate',
  },
  {
    id: 'ALT-005',
    type: 'high',
    category: 'RAPID PASS-THROUGH',
    title: 'Repeated rapid transfers',
    message: 'MULE-028 has completed 5 rapid pass-through transfers in the last 6 hours. Average retention: 4.4%.',
    timestamp: '2026-10-06T14:25:00Z',
    relatedAccountId: 'MULE-028',
    relatedCaseId: 'SC-002',
    read: true,
    actionLabel: 'View Account',
  },
  {
    id: 'ALT-006',
    type: 'high',
    category: 'CASHOUT RISK',
    title: 'Cashout account receiving multiple inflows',
    message: 'CASHOUT-009 received transfers from 3 different mule accounts in the last 12 hours. Total: ₹86,800.',
    timestamp: '2026-10-07T10:44:00Z',
    relatedAccountId: 'CASHOUT-009',
    read: false,
    actionLabel: 'Flag Account',
  },
  {
    id: 'ALT-007',
    type: 'medium',
    category: 'BEHAVIORAL ANOMALY',
    title: 'Unusual transaction pattern',
    message: 'MULE-088 showed a sudden spike in transaction frequency. 8 transactions in 30 minutes vs usual 2/day.',
    timestamp: '2026-10-07T08:20:00Z',
    relatedAccountId: 'MULE-088',
    read: true,
    actionLabel: 'Review',
  },
  {
    id: 'ALT-008',
    type: 'medium',
    category: 'CROSS-NETWORK LINK',
    title: 'Inter-ring transfer detected',
    message: 'MULE-042 transferred ₹12,000 to MULE-028, linking two previously separate suspicious networks.',
    timestamp: '2026-10-06T22:11:00Z',
    relatedAccountId: 'MULE-042',
    relatedTransactionId: 'TX-10031',
    read: true,
    actionLabel: 'Map Network',
  },
  {
    id: 'ALT-009',
    type: 'low',
    category: 'WATCH LIST',
    title: 'New account added to watch list',
    message: 'MULE-156 has been added to the watch list based on behavioral scoring. Current risk: 57/100.',
    timestamp: '2026-10-07T09:00:00Z',
    relatedAccountId: 'MULE-156',
    read: true,
    actionLabel: 'View Profile',
  },
  {
    id: 'ALT-010',
    type: 'medium',
    category: 'CYCLE DETECTED',
    title: 'Circular money flow identified',
    message: 'Funds traced in a cycle: MULE-042 → MULE-028 → MULE-088 → MULE-042. Possible layering attempt.',
    timestamp: '2026-10-06T20:30:00Z',
    relatedAccountId: 'MULE-042',
    read: true,
    actionLabel: 'Investigate Cycle',
  },
  {
    id: 'ALT-011',
    type: 'critical',
    category: 'FUNDS IN MOTION',
    title: 'Active scam trail — funds at risk',
    message: '₹46,900 from Case SC-001 currently held by MULE-103. High probability of imminent cashout.',
    timestamp: '2026-10-07T10:43:10Z',
    relatedAccountId: 'MULE-103',
    relatedCaseId: 'SC-001',
    read: false,
    actionLabel: 'Freeze Review',
  },
  {
    id: 'ALT-012',
    type: 'high',
    category: 'VELOCITY ALERT',
    title: 'Transaction velocity threshold exceeded',
    message: 'MULE-042 processed ₹4.84L across 13 outgoing transfers with avg delay of 27 seconds.',
    timestamp: '2026-10-07T10:44:30Z',
    relatedAccountId: 'MULE-042',
    read: false,
    actionLabel: 'Review',
  },
];

// Helper to get entities by ID
export function getAccountById(id: string): Account | undefined {
  return accounts.find(a => a.id === id);
}

export function getTransactionById(id: string): Transaction | undefined {
  return transactions.find(t => t.id === id);
}

export function getCaseById(id: string): ScamCase | undefined {
  return scamCases.find(c => c.id === id);
}

export function getTransactionsForAccount(accountId: string): Transaction[] {
  return transactions.filter(t => t.source === accountId || t.destination === accountId);
}

export function getOutgoingTransactions(accountId: string): Transaction[] {
  return transactions.filter(t => t.source === accountId);
}

export function getIncomingTransactions(accountId: string): Transaction[] {
  return transactions.filter(t => t.destination === accountId);
}
