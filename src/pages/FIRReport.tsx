import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { fetchCaseEvidence, postGenerateFIR, fetchCases, FIRGenerateRequest } from '../services/api';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import {
  FileText,
  ShieldAlert,
  Download,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Copy,
  Printer,
  Scale,
  RefreshCw,
  Eye,
  EyeOff,
  Building2,
  Clock,
  ArrowRight,
  Shield,
  Send,
  AlertTriangle,
  FileCheck2,
  UserCheck,
  Edit3,
  Check
} from 'lucide-react';

export default function FIRReport() {
  const { caseId: paramCaseId } = useParams<{ caseId?: string }>();
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  // Selected case state
  const defaultCaseId = paramCaseId || state.selectedCaseId || (state.cases[0] ? state.cases[0].id : 'SC-001');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(defaultCaseId);
  const [availableCases, setAvailableCases] = useState<any[]>(state.cases);

  // Evidence state
  const [evidence, setEvidence] = useState<any>(null);
  const [loadingEvidence, setLoadingEvidence] = useState<boolean>(true);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // Generator configuration
  const [reportType, setReportType] = useState<'FIR' | 'SAR' | 'STR'>('FIR');
  const [includeAiNarrative, setIncludeAiNarrative] = useState<boolean>(true);
  const [investigatorName, setInvestigatorName] = useState<string>('S. Krishnan (ID: INV-8821)');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<number | string>(500000);
  const [isEditingAmount, setIsEditingAmount] = useState<boolean>(false);

  // Generation state
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [unmasked, setUnmasked] = useState<boolean>(false);

  // Active view tab in preview
  const [activeTab, setActiveTab] = useState<'overview' | 'trail' | 'mules' | 'manifest'>('overview');

  // Sync paramCaseId
  useEffect(() => {
    if (paramCaseId && paramCaseId !== selectedCaseId) {
      setSelectedCaseId(paramCaseId);
    }
  }, [paramCaseId]);

  // Sync available cases from backend
  useEffect(() => {
    fetchCases().then((backendCases) => {
      if (backendCases && backendCases.length > 0) {
        setAvailableCases(backendCases);
        // If current case not found, select first valid case
        if (!backendCases.some((c: any) => c.id === selectedCaseId)) {
          setSelectedCaseId(backendCases[0].id);
        }
      }
    });
  }, []);

  // Load evidence whenever selectedCaseId changes
  const loadEvidence = async (id: string) => {
    setLoadingEvidence(true);
    setEvidenceError(null);
    try {
      const data = await fetchCaseEvidence(id);
      if (data) {
        setEvidence(data);
        if (data.victim_details?.reported_amount !== undefined) {
          setCustomAmount(data.victim_details.reported_amount);
        }
      } else {
        setEvidenceError(`Could not load evidence bundle for case ${id}. Check backend connectivity.`);
      }
    } catch (err: any) {
      setEvidenceError(err.message || 'Error loading evidence');
    } finally {
      setLoadingEvidence(false);
    }
  };

  useEffect(() => {
    if (selectedCaseId) {
      loadEvidence(selectedCaseId);
    }
  }, [selectedCaseId]);

  const handleCaseChange = (newId: string) => {
    setSelectedCaseId(newId);
    setGeneratedReport(null);
    navigate(`/fir-report/${newId}`);
  };

  const handleGenerateReport = async () => {
    if (!selectedCaseId) return;
    setGenerating(true);
    try {
      const payload: FIRGenerateRequest = {
        case_id: selectedCaseId,
        report_type: reportType,
        include_ai_narrative: includeAiNarrative,
        investigator_name: investigatorName,
        additional_notes: additionalNotes.trim() ? additionalNotes : undefined,
        defrauded_amount: Number(customAmount) > 0 ? Number(customAmount) : undefined,
      };
      const result = await postGenerateFIR(payload);
      if (result && !result.error && result.report_id) {
        setGeneratedReport(result);
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: `rpt-gen-${Date.now()}`,
            message: `${reportType} Draft generated successfully (${result.report_id})`,
            type: 'success',
          },
        });
      } else {
        const errorMsg = result?.error || 'Failed to generate report draft. Check backend server logs.';
        dispatch({
          type: 'ADD_TOAST',
          toast: {
            id: `rpt-err-${Date.now()}`,
            message: errorMsg,
            type: 'warning',
          },
        });
      }
    } catch (err: any) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: `rpt-err-${Date.now()}`,
          message: `Generation error: ${err.message}`,
          type: 'warning',
        },
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyText = () => {
    if (!generatedReport) return;
    const textLines = [
      `=======================================================`,
      `CONFIDENTIAL REGULATORY / INVESTIGATION DRAFT`,
      `REPORT ID: ${generatedReport.report_id}`,
      `REPORT TYPE: ${generatedReport.report_type}`,
      `CASE ID: ${generatedReport.case_id}`,
      `DATE GENERATED: ${generatedReport.generated_at}`,
      `INVESTIGATING OFFICER: ${generatedReport.investigator}`,
      `STATUS: ${generatedReport.status}`,
      `=======================================================`,
      ``,
      `LEGAL DISCLAIMER:`,
      `${generatedReport.disclaimer}`,
      ``,
      `1. INCIDENT & COMPLAINANT SUMMARY:`,
      `${generatedReport.incident_summary}`,
      ``,
      `2. VICTIM PARTICULARS:`,
      `Account: ${unmasked ? generatedReport.victim_details.account_id : generatedReport.victim_details.account_id_masked}`,
      `Bank: ${generatedReport.victim_details.bank}`,
      `Defrauded Amount: INR ${generatedReport.victim_details.reported_amount?.toLocaleString('en-IN')}`,
      ``,
      `3. FORENSIC TRANSACTION TRAIL (${generatedReport.transaction_chain?.length || 0} HOPS):`,
      ...(generatedReport.transaction_chain || []).map(
        (h: any) =>
          `[Hop ${h.hop}] ${h.timestamp || 'N/A'} | ${unmasked ? h.from_account : h.from_account_masked} -> ${unmasked ? h.to_account : h.to_account_masked} | INR ${h.amount?.toLocaleString('en-IN')} | Rail: ${h.payment_rail || 'N/A'} | Status: ${h.status || 'COMPLETED'}`
      ),
      ``,
      `4. SUSPECT MULE PROFILES (${generatedReport.mule_account_profiles?.length || 0} ACCOUNTS):`,
      ...(generatedReport.mule_account_profiles || []).map(
        (m: any) =>
          `* ${unmasked ? m.account_id : m.account_id_masked} (${m.bank}) | Risk: ${m.risk_score}/100 (${m.risk_level}) | Status: ${m.status}`
      ),
      ``,
      ...(generatedReport.ai_narrative
        ? [
            `5. AI INVESTIGATION NARRATIVE (GROUNDED IN EVIDENCE LEDGER):`,
            `${generatedReport.ai_narrative}`,
            ``,
          ]
        : []),
      `6. APPLICABLE LEGAL SECTIONS:`,
      ...(generatedReport.legal_sections || []).map((s: string) => `* ${s}`),
      ``,
      `7. RECOMMENDED POLICE & BANK ACTIONS:`,
      ...(generatedReport.recommended_actions || []).map((a: string) => `* ${a}`),
      ``,
      `=======================================================`,
      `END OF DRAFT REPORT`,
      `=======================================================`,
    ];

    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: `copy-${Date.now()}`,
        message: 'Draft report copied to clipboard',
        type: 'info',
      },
    });
  };

  const handleExportJSON = () => {
    if (!generatedReport) return;
    const blob = new Blob([JSON.stringify(generatedReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedReport.report_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const checklist = evidence?.evidence_checklist;
  const completenessScore = checklist?.completeness_score || 0;

  return (
    <div className="fir-page-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <h1 className="page-title" style={{ margin: 0, fontSize: 20 }}>
                Auto-FIR & SAR / STR Report Generator
              </h1>
              <p className="page-subtitle" style={{ margin: 0 }}>
                Evidence Preview, Transaction Trail Synthesis & Regulatory Compliance Filing Draft
              </p>
            </div>
          </div>
        </div>

        {/* Case selector & controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>Case:</span>
            <select
              className="filter-select"
              value={selectedCaseId}
              onChange={(e) => handleCaseChange(e.target.value)}
              style={{ minWidth: 200, fontWeight: 600 }}
            >
              {(availableCases.length > 0 ? availableCases : state.cases).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.type || c.case_type} (₹{(c.amount || 0)?.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => loadEvidence(selectedCaseId)}
            title="Reload Evidence"
          >
            <RefreshCw size={13} className={loadingEvidence ? 'spin' : ''} /> Refresh
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setUnmasked(!unmasked)}
            title={unmasked ? 'Mask PII' : 'Reveal Full Account IDs'}
          >
            {unmasked ? <EyeOff size={13} /> : <Eye size={13} />}
            {unmasked ? 'Mask IDs' : 'Unmask IDs'}
          </button>
        </div>
      </div>

      {evidenceError && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--danger)',
          }}
        >
          <AlertCircle size={18} />
          <span>{evidenceError}</span>
        </div>
      )}

      {/* Main Grid: Left Evidence Preview vs Right Draft Generator */}
      <div className="fir-main-grid">
        {/* LEFT COLUMN: Evidence Preview Workspace */}
        <div className="fir-evidence-column">
          {/* Completeness Checklist Card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileCheck2 size={15} style={{ color: 'var(--accent)' }} /> Evidence Completeness Checklist
              </span>
              <span
                className={`risk-badge ${
                  completenessScore >= 80 ? 'low' : completenessScore >= 50 ? 'medium' : 'critical'
                }`}
              >
                {completenessScore}% Complete
              </span>
            </div>

            {/* Score progress bar */}
            <div style={{ background: 'var(--bg-tertiary)', height: 6, borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
              <div
                style={{
                  background:
                    completenessScore >= 80
                      ? 'var(--success)'
                      : completenessScore >= 50
                      ? 'var(--warning)'
                      : 'var(--risk-critical)',
                  height: '100%',
                  width: `${completenessScore}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* 7-Point Checklist items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  label: 'Victim Account & Identity Verified',
                  checked: checklist?.victim_identified,
                  desc: 'Complainant bank account and initial details mapped',
                },
                {
                  label: 'Initial Outflow Transaction Present',
                  checked: checklist?.victim_transaction_present,
                  desc: 'Seed fraudulent debit transaction confirmed in ledger',
                },
                {
                  label: 'Multi-Hop Layering Trail Reconstructed',
                  checked: checklist?.trail_reconstructed,
                  desc: `${evidence?.trail_hops || 0} downstream hops mapped through graph engine`,
                },
                {
                  label: 'Suspect Mule Accounts Identified',
                  checked: checklist?.mule_accounts_identified,
                  desc: `${evidence?.mule_count || 0} relay mule accounts profiled`,
                },
                {
                  label: 'Velocity & Laundering Patterns Found',
                  checked: checklist?.pattern_evidence_found,
                  desc: `${evidence?.patterns_found || 0} historical syndication patterns matched`,
                },
                {
                  label: 'Investigator Case Notes Recorded',
                  checked: checklist?.investigator_notes_present,
                  desc: `${evidence?.notes_count || 0} formal investigation notes in registry`,
                },
                {
                  label: 'Total Defrauded Loss Amount Reconciled',
                  checked: (Number(customAmount) > 0) || checklist?.total_defrauded_amount_known,
                  desc: `₹${Number(customAmount || evidence?.victim_details?.reported_amount || 0).toLocaleString('en-IN')} claimed loss`,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                  }}
                >
                  {item.checked ? (
                    <CheckCircle2 size={16} style={{ color: 'var(--success)', marginTop: 2, flexShrink: 0 }} />
                  ) : (
                    <AlertCircle size={16} style={{ color: 'var(--warning)', marginTop: 2, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Details Section Tabs */}
          <div className="card">
            <div className="tabs" style={{ marginBottom: 14 }}>
              <button
                className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Victim & Summary
              </button>
              <button
                className={`tab ${activeTab === 'trail' ? 'active' : ''}`}
                onClick={() => setActiveTab('trail')}
              >
                Trail ({evidence?.transaction_chain?.length || 0})
              </button>
              <button
                className={`tab ${activeTab === 'mules' ? 'active' : ''}`}
                onClick={() => setActiveTab('mules')}
              >
                Mules ({evidence?.mule_profiles?.length || 0})
              </button>
              <button
                className={`tab ${activeTab === 'manifest' ? 'active' : ''}`}
                onClick={() => setActiveTab('manifest')}
              >
                Manifest ({evidence?.evidence_manifest?.length || 0})
              </button>
            </div>

            {loadingEvidence ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>Loading case evidence bundle...</span>
              </div>
            ) : (
              <>
                {/* Tab 1: Overview */}
                {activeTab === 'overview' && (
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      <div className="detail-stat-label">Case Description</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                        {evidence?.case_description || 'No description provided.'}
                      </div>
                    </div>

                    <div className="detail-stats-grid" style={{ marginBottom: 16 }}>
                      <div className="detail-stat">
                        <div className="detail-stat-label">Victim Account</div>
                        <div className="detail-stat-value" style={{ fontSize: 14 }}>
                          {unmasked
                            ? evidence?.victim_details?.account_id || 'VICTIM-001'
                            : evidence?.victim_details?.account_id_masked || 'VICT***-001'}
                        </div>
                      </div>
                      <div className="detail-stat">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="detail-stat-label">Defrauded Amount</div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', fontSize: 10, height: 20, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            onClick={() => setIsEditingAmount(!isEditingAmount)}
                            title="Edit defrauded amount"
                          >
                            {isEditingAmount ? <Check size={10} /> : <Edit3 size={10} />}
                            {isEditingAmount ? 'Save' : 'Edit'}
                          </button>
                        </div>
                        {isEditingAmount ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--risk-critical)' }}>₹</span>
                            <input
                              type="number"
                              className="form-input"
                              style={{
                                height: 32,
                                padding: '4px 8px',
                                fontSize: 15,
                                fontWeight: 700,
                                color: 'var(--risk-critical)',
                                fontFamily: 'var(--font-mono)'
                              }}
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingAmount(false); }}
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div
                            className="detail-stat-value"
                            style={{ color: 'var(--risk-critical)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => setIsEditingAmount(true)}
                            title="Click to manually edit defrauded amount"
                          >
                            ₹{Number(customAmount || 0).toLocaleString('en-IN')}
                            <Edit3 size={12} style={{ opacity: 0.5 }} />
                          </div>
                        )}
                      </div>
                      <div className="detail-stat">
                        <div className="detail-stat-label">Victim Bank</div>
                        <div className="detail-stat-value" style={{ fontSize: 14 }}>
                          {evidence?.victim_details?.bank || 'HDFC Bank'}
                        </div>
                      </div>
                      <div className="detail-stat">
                        <div className="detail-stat-label">Scam Category</div>
                        <div className="detail-stat-value" style={{ fontSize: 14 }}>
                          {evidence?.case_type || 'UPI Scam'}
                        </div>
                      </div>
                    </div>

                    {evidence?.probable_next_hop && (
                      <div
                        style={{
                          background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                          border: '1px solid var(--warning)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            Predicted Active Laundering Destination:
                          </div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>
                            {evidence.probable_next_hop.account_id} ({evidence.probable_next_hop.bank || 'Unknown Bank'}) —{' '}
                            {evidence.probable_next_hop.confidence}% confidence
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Trail */}
                {activeTab === 'trail' && (
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Hop</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Amount</th>
                          <th>Rail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(evidence?.transaction_chain || []).map((step: any, idx: number) => (
                          <tr key={idx}>
                            <td>
                              <span
                                className={`risk-badge ${
                                  step.role === 'INITIAL_TRANSFER' ? 'critical' : 'medium'
                                }`}
                              >
                                Hop {step.hop}
                              </span>
                            </td>
                            <td className="mono">
                              {unmasked ? step.from_account : step.from_account_masked}
                            </td>
                            <td className="mono">
                              {unmasked ? step.to_account : step.to_account_masked}
                            </td>
                            <td className="amount">₹{step.amount?.toLocaleString('en-IN')}</td>
                            <td>{step.payment_rail || 'IMPS'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 3: Mules */}
                {activeTab === 'mules' && (
                  <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(evidence?.mule_profiles || []).map((m: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--bg-tertiary)',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12 }}>
                            {unmasked ? m.account_id : m.account_id_masked}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {m.bank} • {m.account_type || 'Mule Account'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span
                            className={`risk-badge ${
                              m.risk_score >= 80 ? 'critical' : m.risk_score >= 60 ? 'high' : 'medium'
                            }`}
                          >
                            Score: {m.risk_score}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            ₹{(m.total_incoming || 0).toLocaleString('en-IN')} in
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 4: Manifest */}
                {activeTab === 'manifest' && (
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Ref ID</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(evidence?.evidence_manifest || []).map((ev: any, idx: number) => (
                          <tr key={idx}>
                            <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                              {ev.ref_id}
                            </td>
                            <td>
                              <span className="risk-badge normal">{ev.category}</span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>{ev.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Report Generator & Draft Workspace */}
        <div className="fir-draft-column">
          {/* Generation Configuration Card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Scale size={15} style={{ color: 'var(--accent)' }} /> Filing Draft Parameters
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="form-label">Report Format</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['FIR', 'SAR', 'STR'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`btn btn-sm ${reportType === t ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setReportType(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Investigating Officer</label>
                <input
                  type="text"
                  className="form-input"
                  value={investigatorName}
                  onChange={(e) => setInvestigatorName(e.target.value)}
                  placeholder="Officer Name / ID"
                />
              </div>

              <div>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Defrauded Loss (₹)</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>Manual Override</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--risk-critical)', fontSize: 13 }}>₹</span>
                  <input
                    type="number"
                    className="form-input"
                    style={{ paddingLeft: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--risk-critical)' }}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="500000"
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Investigator Case Notes / Observations (Optional)</label>
              <textarea
                className="form-input"
                rows={2}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Add specific facts (e.g., SIM swapping noticed, urgent lien requested on layer-2 mules)..."
                style={{ resize: 'vertical' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)',
                marginBottom: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    AI-Assisted Investigation Narrative
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Synthesizes incident & fund-flow narrative using canonical ledger facts only (Gemini)
                  </div>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeAiNarrative}
                  onChange={(e) => setIncludeAiNarrative(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleGenerateReport}
                disabled={generating || loadingEvidence}
                style={{ minWidth: 180, justifyContent: 'center' }}
              >
                {generating ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Generating Draft...
                  </>
                ) : (
                  <>
                    <FileText size={14} /> Generate {reportType} Draft
                  </>
                )}
              </button>
            </div>
          </div>

          {/* GENERATED DRAFT REPORT VIEW */}
          {generatedReport ? (
            <div className="fir-report-output">
              {/* Mandatory Disclaimer Banner */}
              <div className="fir-disclaimer-banner">
                <ShieldAlert size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Confidential Draft for Authorized Investigator Review Only
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
                    This document is a machine-assisted regulatory draft. It must be verified and authorized by a designated compliance officer before submission to police or regulatory bodies. AI narratives organize canonical evidence only and do not determine legal guilt.
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="fir-export-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="risk-badge high" style={{ fontSize: 11 }}>
                    {generatedReport.status}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    ID: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{generatedReport.report_id}</strong>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={handleCopyText} title="Copy draft text">
                    <Copy size={13} /> {copied ? 'Copied!' : 'Copy Text'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleExportJSON} title="Download JSON payload">
                    <Download size={13} /> JSON
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handlePrint} title="Print or Save PDF">
                    <Printer size={13} /> Print / PDF
                  </button>
                </div>
              </div>

              {/* Printable Formal Document Paper Container */}
              <div className="fir-document-paper">
                {/* Official Document Header */}
                <div className="fir-doc-header">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="fir-doc-org">STATE CYBER CRIME INVESTIGATION PLATFORM</div>
                      <h2 className="fir-doc-title">
                        {generatedReport.report_type === 'FIR'
                          ? 'FIRST INFORMATION REPORT DRAFT (U/S 154 Cr.P.C.)'
                          : generatedReport.report_type === 'SAR'
                          ? 'SUSPICIOUS ACTIVITY REPORT (SAR) DRAFT'
                          : 'SUSPICIOUS TRANSACTION REPORT (STR) DRAFT'}
                      </h2>
                      <div className="fir-doc-subtitle">
                        Incident Category: {evidence?.case_type || 'Digital Financial Fraud'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Filing Status</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--risk-critical)' }}>
                        {generatedReport.status}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Date: {new Date(generatedReport.generated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="fir-doc-meta-grid">
                    <div>
                      <strong>Case Reference:</strong> {generatedReport.case_id}
                    </div>
                    <div>
                      <strong>Investigator:</strong> {generatedReport.investigator}
                    </div>
                    <div>
                      <strong>Report Ref:</strong> {generatedReport.report_id}
                    </div>
                    <div>
                      <strong>Completeness:</strong> {generatedReport.checklist?.completeness_score}% Checked
                    </div>
                  </div>
                </div>

                {/* Section 1: Incident Summary */}
                <div className="fir-doc-section">
                  <h3 className="fir-section-header">1. Complainant & Incident Summary</h3>
                  <div className="fir-doc-paragraph">{generatedReport.incident_summary}</div>
                  <table className="data-table" style={{ marginTop: 8, fontSize: 12 }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '30%', fontWeight: 600 }}>Complainant / Victim Account:</td>
                        <td className="mono">
                          {unmasked
                            ? generatedReport.victim_details.account_id
                            : generatedReport.victim_details.account_id_masked}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Originating Bank / Branch:</td>
                        <td>{generatedReport.victim_details.bank}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Total Loss Claimed:</td>
                        <td className="amount" style={{ color: 'var(--risk-critical)' }}>
                          ₹{generatedReport.victim_details.reported_amount?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section 2: Forensic Transaction Trail */}
                <div className="fir-doc-section">
                  <h3 className="fir-section-header">
                    2. Forensic Funds Trail & Layering Chain ({generatedReport.transaction_chain?.length || 0} Hops)
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Sequential reconstruction of fund dissipation from victim account through intermediary mule layering nodes:
                  </p>
                  <table className="data-table" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th>Hop</th>
                        <th>From Account</th>
                        <th>To Account</th>
                        <th>Amount</th>
                        <th>Payment Rail</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(generatedReport.transaction_chain || []).map((t: any, idx: number) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>Hop {t.hop}</td>
                          <td className="mono">{unmasked ? t.from_account : t.from_account_masked}</td>
                          <td className="mono">{unmasked ? t.to_account : t.to_account_masked}</td>
                          <td className="amount">₹{t.amount?.toLocaleString('en-IN')}</td>
                          <td>{t.payment_rail || 'IMPS'}</td>
                          <td>
                            <span className={`risk-badge ${t.role === 'INITIAL_TRANSFER' ? 'critical' : 'normal'}`}>
                              {t.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section 3: Suspect Mule Accounts */}
                <div className="fir-doc-section">
                  <h3 className="fir-section-header">
                    3. Profile of Identified Mule Intermediary Accounts ({generatedReport.mule_account_profiles?.length || 0} Accounts)
                  </h3>
                  <table className="data-table" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th>Account ID</th>
                        <th>Bank / Institution</th>
                        <th>Account Type</th>
                        <th>Risk Score</th>
                        <th>Status</th>
                        <th>Device Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(generatedReport.mule_account_profiles || []).map((m: any, idx: number) => (
                        <tr key={idx}>
                          <td className="mono" style={{ fontWeight: 600 }}>
                            {unmasked ? m.account_id : m.account_id_masked}
                          </td>
                          <td>{m.bank}</td>
                          <td>{m.account_type}</td>
                          <td>
                            <span
                              className={`risk-badge ${
                                m.risk_score >= 80 ? 'critical' : m.risk_score >= 60 ? 'high' : 'medium'
                              }`}
                            >
                              {m.risk_score} / 100
                            </span>
                          </td>
                          <td>{m.status}</td>
                          <td className="mono" style={{ fontSize: 10 }}>
                            {m.device_id || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section 4: AI Narrative (if generated) */}
                {generatedReport.ai_narrative && (
                  <div className="fir-doc-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h3 className="fir-section-header" style={{ margin: 0 }}>
                        4. Modus Operandi & Incident Narrative
                      </h3>
                      <span className="risk-badge low" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={11} /> AI Grounded Synthesis
                      </span>
                    </div>
                    <div
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px',
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {generatedReport.ai_narrative}
                    </div>
                  </div>
                )}

                {/* Section 5: Legal Sections */}
                <div className="fir-doc-section">
                  <h3 className="fir-section-header">5. Applicable Legal & Regulatory Provisions</h3>
                  <ul style={{ paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                    {(generatedReport.legal_sections || []).map((sec: string, idx: number) => (
                      <li key={idx}>
                        <strong style={{ color: 'var(--text-primary)' }}>{sec}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Section 6: Recommended Actions */}
                <div className="fir-doc-section">
                  <h3 className="fir-section-header">6. Recommended Actions & Next Steps</h3>
                  <ul style={{ paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                    {(generatedReport.recommended_actions || []).map((action: string, idx: number) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>

                {/* Section 7: Formal Sign-off */}
                <div className="fir-doc-signatures">
                  <div className="fir-signature-box">
                    <div className="fir-signature-line" />
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{generatedReport.investigator}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Reporting Investigating Officer</div>
                  </div>

                  <div className="fir-signature-box">
                    <div className="fir-signature-line" />
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Nodal Cyber Crime Cell Officer</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Verification & Supervisory Review</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state" style={{ padding: '60px 20px' }}>
                <FileText size={36} className="empty-state-icon" style={{ color: 'var(--accent)' }} />
                <div className="empty-state-title">No Report Draft Generated Yet</div>
                <div className="empty-state-message">
                  Review the evidence checklist on the left, select your reporting format (FIR / SAR / STR), and click "Generate Draft" to create a structured regulatory report.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
