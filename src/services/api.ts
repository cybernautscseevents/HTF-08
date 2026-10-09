// Backend REST API client for Financial Crime Graph Intelligence Platform
import { BlastRadiusData, CaseNote, AuditLog } from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

export interface BackendHealth {
  status: string;
  database: string;
  graph: string;
  timestamp: string;
  service: string;
}

export async function fetchHealth(): Promise<BackendHealth | null> {
  try {
    const res = await fetch('http://127.0.0.1:8000/health');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDashboardSummary() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAccounts(params?: { risk_level?: string; limit?: number }) {
  try {
    const query = new URLSearchParams();
    if (params?.risk_level) query.append('risk_level', params.risk_level);
    if (params?.limit) query.append('limit', String(params.limit));
    const res = await fetch(`${API_BASE}/accounts?${query.toString()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAccountDetail(accountId: string) {
  try {
    const res = await fetch(`${API_BASE}/accounts/${accountId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchBlastRadius(accountId: string): Promise<BlastRadiusData | null> {
  try {
    const res = await fetch(`${API_BASE}/graph/blast-radius/${accountId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      accountId: data.account_id,
      directConnections: data.direct_connections,
      twoHopConnections: data.two_hop_connections,
      threeHopConnections: data.three_hop_connections,
      suspiciousAccounts: data.suspicious_accounts,
      totalSuspiciousFlow: data.total_suspicious_flow,
      potentialDownstreamExposure: data.potential_downstream_exposure,
      connectedNodes: data.connected_nodes,
      suspiciousNodes: data.suspicious_nodes
    };
  } catch {
    return null;
  }
}

export async function fetchCases() {
  try {
    const res = await fetch(`${API_BASE}/cases`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchCaseTrail(caseId: string) {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/trail`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchCaseNotes(caseId: string): Promise<CaseNote[]> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/notes`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
      id: d.id,
      caseId: d.case_id,
      author: d.author,
      note: d.note,
      createdAt: d.created_at
    }));
  } catch {
    return [];
  }
}

export async function postCaseNote(caseId: string, note: string, author?: string): Promise<CaseNote | null> {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: author || 'S. Krishnan (Lead Investigator)',
        note
      })
    });
    if (!res.ok) return null;
    const d = await res.json();
    return {
      id: d.id,
      caseId: d.case_id,
      author: d.author,
      note: d.note,
      createdAt: d.created_at
    };
  } catch {
    return null;
  }
}

export async function exportCaseSummary(caseId: string) {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/export`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function updateCaseStatus(caseId: string, status: string) {
  try {
    const res = await fetch(`${API_BASE}/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchTransactionTrail(transactionId: string) {
  try {
    const res = await fetch(`${API_BASE}/trail/${transactionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchGraph(caseId: string = 'SC-001') {
  try {
    const res = await fetch(`${API_BASE}/graph?case_id=${caseId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAlerts() {
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const res = await fetch(`${API_BASE}/actions/audit-logs`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
      id: d.id,
      action: d.action,
      entityType: d.entity_type,
      entityId: d.entity_id,
      actor: d.actor,
      details: d.details,
      createdAt: d.created_at
    }));
  } catch {
    return [];
  }
}

export async function postFreezeRecommendation(accountId: string, caseId?: string, reason?: string) {
  try {
    const res = await fetch(`${API_BASE}/actions/freeze-recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId,
        case_id: caseId || 'SC-001',
        action_type: 'FREEZE_RECOMMENDED',
        reason: reason || 'Simulated freeze review recommendation triggered from UI'
      })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postResetDemoData() {
  try {
    const res = await fetch(`${API_BASE}/demo/reset`, { method: 'POST' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postSimulateTransaction(source: string, destination: string, amount: number) {
  try {
    const res = await fetch(`${API_BASE}/simulate/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, destination, amount })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postGenerateSynthetic(config: {
  accounts: number;
  transactions: number;
  mule_percentage: number;
  fraud_ring_count: number;
  avg_transaction_amount: number;
  scam_type: string;
  seed: number;
}) {
  try {
    const res = await fetch(`${API_BASE}/synthetic/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postGraphRAGQuery(query: string, contextAccount?: string) {
  try {
    const res = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context_account: contextAccount })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ────── FIR / SAR Report Generator ──────

export async function fetchCaseEvidence(caseId: string) {
  try {
    const res = await fetch(`${API_BASE}/reports/${caseId}/evidence`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface FIRGenerateRequest {
  case_id: string;
  report_type: 'FIR' | 'SAR' | 'STR';
  include_ai_narrative: boolean;
  investigator_name?: string;
  additional_notes?: string;
  defrauded_amount?: number;
}

export async function postGenerateFIR(payload: FIRGenerateRequest) {
  try {
    const res = await fetch(`${API_BASE}/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.detail?.message || errData?.detail || `HTTP Error ${res.status}`;
      console.error("[postGenerateFIR] Server error:", res.status, msg);
      return { error: msg };
    }
    return await res.json();
  } catch (err: any) {
    console.error("[postGenerateFIR] Network error:", err);
    return { error: err.message || 'Network connection failed' };
  }
}
