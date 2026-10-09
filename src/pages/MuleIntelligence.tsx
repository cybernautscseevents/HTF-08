import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatPercentage, getAccountTypeLabel } from '../utils/formatters';
import { calculateMuleRisk, getRiskLevel, getRiskColor } from '../engine/riskEngine';
import { calculateGraphMetrics } from '../engine/graphEngine';
import { findNextHopCandidates } from '../engine/nextHopEngine';
import CortexGraphVisualizer, { VisualizerNode, VisualizerEdge } from '../components/CortexGraphVisualizer';
import { Search, AlertTriangle, ArrowUpDown, X, Brain, Eye, Flag, Snowflake, Globe, Sparkles, ExternalLink, FileText } from 'lucide-react';
import type { Account, MuleRiskResult } from '../types';

export default function MuleIntelligence() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>(searchParams.get('filter') || 'all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(state.selectedAccountId);
  const [sortBy, setSortBy] = useState<'risk' | 'passthrough' | 'velocity'>('risk');
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [txTab, setTxTab] = useState<'incoming' | 'outgoing' | 'all'>('incoming');

  // Compute risk for all accounts
  const accountsWithRisk = useMemo(() => {
    return state.accounts.map(a => ({
      account: a,
      risk: calculateMuleRisk(a, state.transactions, state.accounts),
      metrics: calculateGraphMetrics(a.id, state.transactions, state.accounts.length),
    }));
  }, [state.accounts, state.transactions]);

  const filtered = useMemo(() => {
    let list = [...accountsWithRisk];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        item.account.id.toLowerCase().includes(q) || item.account.name.toLowerCase().includes(q)
      );
    }

    if (riskFilter !== 'all') {
      if (riskFilter === 'high_risk') {
        list = list.filter(item => item.risk.level === 'critical' || item.risk.level === 'high');
      } else {
        list = list.filter(item => item.risk.level === riskFilter);
      }
    }

    if (typeFilter !== 'all') {
      list = list.filter(item => item.account.accountType === typeFilter);
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'flagged') {
        list = list.filter(item => item.account.status === 'high' || item.account.status === 'critical');
      } else {
        list = list.filter(item => item.account.status === statusFilter);
      }
    }

    list.sort((a, b) => {
      if (sortBy === 'risk') return b.risk.score - a.risk.score;
      if (sortBy === 'passthrough') return b.metrics.passThroughRatio - a.metrics.passThroughRatio;
      if (sortBy === 'velocity') {
        const va = a.metrics.avgVelocity === Infinity ? 999999 : a.metrics.avgVelocity;
        const vb = b.metrics.avgVelocity === Infinity ? 999999 : b.metrics.avgVelocity;
        return va - vb;
      }
      return 0;
    });

    return list;
  }, [accountsWithRisk, searchQuery, riskFilter, typeFilter, statusFilter, sortBy]);

  const selected = selectedId ? accountsWithRisk.find(a => a.account.id === selectedId) : null;
  const selectedNextHop = selectedId ? findNextHopCandidates(selectedId, state.transactions, state.accounts) : null;

  // Visualizer data for live interactive modal
  const visualizerNodes: VisualizerNode[] = useMemo(() => {
    return state.accounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.accountType,
      category: (a.accountType === 'victim' ? 'Victim' : a.accountType === 'mule' ? 'Mule' : a.accountType === 'cashout' ? 'Cashout' : 'Institution') as any,
      riskScore: a.riskScore,
      description: `${a.bank} • Score: ${a.riskScore}/100 • Status: ${a.status.toUpperCase()}`,
    }));
  }, [state.accounts]);

  const visualizerEdges: VisualizerEdge[] = useMemo(() => {
    return state.transactions.map(t => ({
      id: t.id,
      source: t.source,
      target: t.destination,
      label: `₹${(t.amount / 1000).toFixed(1)}K`,
      amount: t.amount,
      type: t.type,
      riskScore: t.riskScore,
    }));
  }, [state.transactions]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--header-height) - 48px)' }}>
      {/* Left: Account List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={20} style={{ color: 'var(--accent)' }} /> Mule Intelligence
            </h1>
            <p className="page-subtitle">Explainable risk scoring for all accounts</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              ⚡ Total Synced Accounts: <strong style={{ color: 'var(--accent)' }}>{state.accounts.length}</strong>
            </span>
            <div 
              style={{ fontSize: 12, color: riskFilter === 'high_risk' ? 'var(--accent)' : 'var(--text-tertiary)', cursor: 'pointer', transition: 'color 0.2s', padding: '4px 8px', borderRadius: '4px', background: riskFilter === 'high_risk' ? 'var(--accent-soft)' : 'transparent' }}
              onClick={() => setRiskFilter(riskFilter === 'high_risk' ? 'all' : 'high_risk')}
              title="Click to filter by high-risk mules"
            >
              {filtered.filter(a => a.risk.level === 'critical' || a.risk.level === 'high').length} high-risk mules
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input className="filter-input" style={{ width: '100%', paddingLeft: 32 }} placeholder="Search accounts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <select className="filter-select" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
            <option value="all">All Risk Levels</option>
            <option value="high_risk">Critical & High</option>
            <option value="critical">Critical Only</option>
            <option value="high">High Only</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
          </select>
          <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="mule">Mule</option>
            <option value="victim">Victim</option>
            <option value="cashout">Cashout</option>
            <option value="normal">Normal</option>
            <option value="merchant">Merchant</option>
          </select>
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="frozen">Frozen</option>
            <option value="flagged">Flagged</option>
            <option value="watch">Watchlist</option>
            <option value="normal">Normal</option>
          </select>
          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
            <option value="risk">Sort: Risk Score</option>
            <option value="passthrough">Sort: Pass-Through</option>
            <option value="velocity">Sort: Velocity (fastest)</option>
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="card" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Risk Score</th>
                  <th>Pass-Through</th>
                  <th>Fan-In</th>
                  <th>Fan-Out</th>
                  <th>Velocity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ account, risk, metrics }) => (
                  <tr
                    key={account.id}
                    className={selectedId === account.id ? 'selected' : ''}
                    onClick={() => setSelectedId(account.id)}
                  >
                    <td className="mono" style={{ fontWeight: 600 }}>{account.id}</td>
                    <td>{account.name}</td>
                    <td><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{getAccountTypeLabel(account.accountType)}</span></td>
                    <td>
                      <span className={`risk-badge ${risk.level}`}>{risk.score}</span>
                    </td>
                    <td className="mono">{formatPercentage(metrics.passThroughRatio * 100)}</td>
                    <td className="mono">{metrics.fanIn}</td>
                    <td className="mono">{metrics.fanOut}</td>
                    <td className="mono">{metrics.avgVelocity < Infinity ? `${Math.round(metrics.avgVelocity)}s` : '—'}</td>
                    <td>
                      <span className={`status-indicator ${state.frozenAccounts.has(account.id) ? 'frozen' : account.status}`}>
                        <span className="dot" />
                        {state.frozenAccounts.has(account.id) ? 'Frozen' : account.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {selected && (
        <div className="detail-panel">
          <div className="detail-panel-header">
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>{selected.account.id}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.account.name} • {selected.account.bank}</div>
            </div>
            <button className="btn-icon btn-ghost" onClick={() => setSelectedId(null)}>
              <X size={14} />
            </button>
          </div>

          <div className="detail-panel-body">
            {/* Score */}
            <div className="detail-panel-section" style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-mono)', color: getRiskColor(selected.risk.level) }}>
                {selected.risk.score}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Mule Risk Score / 100
              </div>
              <span className={`risk-badge ${selected.risk.level}`} style={{ marginTop: 8, fontSize: 12, padding: '4px 12px' }}>
                {selected.risk.level.toUpperCase()}
              </span>
            </div>

            {/* Stats */}
            <div className="detail-panel-section">
              <div className="detail-stats-grid">
                <div className="detail-stat">
                  <div className="detail-stat-label">Incoming ({state.transactions.filter(t => t.destination === selected.account.id).length})</div>
                  <div className="detail-stat-value">{formatCurrency(state.transactions.filter(t => t.destination === selected.account.id).reduce((sum, t) => sum + t.amount, 0))}</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-label">Outgoing ({state.transactions.filter(t => t.source === selected.account.id).length})</div>
                  <div className="detail-stat-value">{formatCurrency(state.transactions.filter(t => t.source === selected.account.id).reduce((sum, t) => sum + t.amount, 0))}</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-label">Pass-Through</div>
                  <div className="detail-stat-value">{formatPercentage(selected.metrics.passThroughRatio * 100)}</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-label">Avg Velocity</div>
                  <div className="detail-stat-value">{selected.metrics.avgVelocity < Infinity ? `${Math.round(selected.metrics.avgVelocity)}s` : '—'}</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-label">Fan-In</div>
                  <div className="detail-stat-value">{selected.metrics.fanIn}</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-label">Fan-Out</div>
                  <div className="detail-stat-value">{selected.metrics.fanOut}</div>
                </div>
              </div>
            </div>

            {/* Risk Breakdown */}
            <div className="detail-panel-section">
              <div className="detail-panel-section-title">Risk Factor Breakdown</div>
              <div className="risk-breakdown">
                {selected.risk.factors.map((f, i) => (
                  <div key={i} className="risk-factor">
                    <div className="risk-factor-header">
                      <span className="risk-factor-name">{f.name}</span>
                      <span className="risk-factor-score">{f.score}/{f.maxScore}</span>
                    </div>
                    <div className="risk-factor-bar">
                      <div
                        className="risk-factor-fill"
                        style={{
                          width: `${(f.score / f.maxScore) * 100}%`,
                          background: f.score / f.maxScore >= 0.8 ? 'var(--risk-critical)' : f.score / f.maxScore >= 0.5 ? 'var(--risk-high)' : f.score / f.maxScore >= 0.3 ? 'var(--risk-medium)' : 'var(--risk-low)',
                        }}
                      />
                    </div>
                    <span className="risk-factor-desc">{f.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Explainable Evidence Checklist */}
            <div className="detail-panel-section">
              <div className="detail-panel-section-title">Why is this suspicious?</div>
              <div className="evidence-list" style={{ background: 'var(--bg-tertiary)', padding: '12px 14px', borderRadius: 'var(--radius-md)' }}>
                <div className="evidence-item">
                  <span style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>✓</span>
                  <span><strong>{formatPercentage(selected.metrics.passThroughRatio * 100)}</strong> of funds passed through rapidly</span>
                </div>
                <div className="evidence-item">
                  <span style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>✓</span>
                  <span><strong>{selected.metrics.fanOut}</strong> outgoing counterparties (fan-out behavior)</span>
                </div>
                <div className="evidence-item">
                  <span style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>✓</span>
                  <span>Average transfer delay: <strong>{selected.metrics.avgVelocity < Infinity ? `${Math.round(selected.metrics.avgVelocity)} sec` : '< 60 sec'}</strong></span>
                </div>
                <div className="evidence-item">
                  <span style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>✓</span>
                  <span>Connected to <strong>{selected.metrics.totalDegree}</strong> active graph accounts</span>
                </div>
                <div className="evidence-item">
                  <span style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>✓</span>
                  <span>Embedded in high-velocity syndicate money trail</span>
                </div>
              </div>
            </div>

            {/* Next Hop */}
            {selectedNextHop && (
              <div className="detail-panel-section">
                <div className="nexthop-card">
                  <div className="nexthop-label">⚡ Predicted Next Hop</div>
                  <div className="nexthop-account">{selectedNextHop.accountId}</div>
                  <div className="nexthop-confidence">Score: {selectedNextHop.patternScore}</div>
                  
                  {/* Detailed Evidence / Explainability */}
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--surface-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>PREDICTION REASONS:</div>
                    {selectedNextHop.reasons && selectedNextHop.reasons.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {selectedNextHop.reasons.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                            <span style={{ color: '#00d2ff', fontSize: 12, marginTop: -1 }}>✓</span>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#f8fafc' }}>{r.rule}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selectedNextHop.reason}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Neural Graph Intelligence */}
            <div className="detail-panel-section">
              <div className="detail-panel-section-title">Neural Graph Intelligence</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                    fontWeight: 500,
                  }}
                  onClick={() => navigate(`/network?account=${selected.account.id}&dataset=mule`)}
                >
                  <Globe size={13} /> Check Account Graph & Connections
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ justifyContent: 'center', background: 'var(--surface-muted)' }}
                  onClick={() => setIsGraphModalOpen(true)}
                >
                  <Sparkles size={13} style={{ color: '#00d2ff' }} /> Quick Graph Modal Preview
                </button>
              </div>
            </div>

            {/* Data-Driven Transactions: Incoming & Outgoing */}
            <div className="detail-panel-section">
              <div className="detail-panel-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span>Account Ledger Transactions</span>
                <span className="badge" style={{ background: 'var(--surface-elevated)' }}>
                  {state.transactions.filter(t => t.destination === selected.account.id || t.source === selected.account.id).length} total
                </span>
              </div>

              {/* Segmented Tab Switcher */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: 3, borderRadius: 'var(--radius-md)', marginBottom: 12 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${txTab === 'incoming' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }}
                  onClick={() => setTxTab('incoming')}
                >
                  Incoming ({state.transactions.filter(t => t.destination === selected.account.id).length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${txTab === 'outgoing' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }}
                  onClick={() => setTxTab('outgoing')}
                >
                  Outgoing ({state.transactions.filter(t => t.source === selected.account.id).length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${txTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px', justifyContent: 'center' }}
                  onClick={() => setTxTab('all')}
                >
                  All ({state.transactions.filter(t => t.destination === selected.account.id || t.source === selected.account.id).length})
                </button>
              </div>

              {/* Transaction List with Required Columns */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                {state.transactions
                  .filter(t => {
                    if (txTab === 'incoming') return t.destination === selected.account.id;
                    if (txTab === 'outgoing') return t.source === selected.account.id;
                    return t.destination === selected.account.id || t.source === selected.account.id;
                  })
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(tx => {
                    const isIncoming = tx.destination === selected.account.id;
                    const counterpartyId = isIncoming ? tx.source : tx.destination;
                    const counterpartyAcc = state.accounts.find(a => a.id === counterpartyId);
                    const counterpartyBank = counterpartyAcc?.bank || (isIncoming ? tx.sourceInstitution : tx.destinationInstitution) || (counterpartyId.split('-')[0]) || 'Interbank';

                    return (
                      <div
                        key={tx.id}
                        style={{
                          background: 'var(--bg-tertiary)',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${tx.status === 'blocked' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border)'}`
                        }}
                      >
                        {/* Row 1: TX ID, Channel/Type, Timestamp */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: isIncoming ? '#00d2ff' : '#f59e0b' }}>
                              {tx.id}
                            </span>
                            <span style={{ fontSize: 10, background: 'var(--surface-muted)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                              {tx.channel || tx.type}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                            {new Date(tx.timestamp).toLocaleString()}
                          </span>
                        </div>

                        {/* Row 2: Counterparty, Institution, Amount */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: isIncoming ? 'var(--risk-low)' : 'var(--risk-critical)', fontWeight: 600 }}>
                                {isIncoming ? '↓ FROM' : '↑ TO'}
                              </span>
                              <span
                                className="mono"
                                style={{ fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => setSelectedId(counterpartyId)}
                              >
                                {counterpartyId}
                              </span>
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                              🏛️ {counterpartyBank}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: isIncoming ? 'var(--risk-low)' : 'var(--text-primary)' }}>
                              {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                            </div>
                            <span className={`status-indicator ${tx.status === 'blocked' ? 'frozen' : tx.status}`} style={{ marginTop: 2 }}>
                              <span className="dot" />{tx.status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Row 3: Description / Reason if flagged or blocked */}
                        {tx.description && (
                          <div style={{
                            marginTop: 6,
                            fontSize: 10,
                            color: tx.status === 'blocked' ? '#ef4444' : 'var(--text-tertiary)',
                            background: tx.status === 'blocked' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            padding: tx.status === 'blocked' ? '4px 6px' : 0,
                            borderRadius: 4
                          }}>
                            {tx.status === 'blocked' && <AlertTriangle size={10} style={{ display: 'inline', marginRight: 4 }} />}
                            {tx.description}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {state.transactions.filter(t => txTab === 'incoming' ? t.destination === selected.account.id : (txTab === 'outgoing' ? t.source === selected.account.id : (t.destination === selected.account.id || t.source === selected.account.id))).length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
                    No {txTab} transactions recorded for this account in the ledger.
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="detail-panel-section">
              <div className="detail-panel-section-title">Compliance Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!state.frozenAccounts.has(selected.account.id) && (
                  <button className="btn btn-danger btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => {
                    dispatch({ type: 'FREEZE_ACCOUNT', id: selected.account.id });
                    dispatch({ type: 'ADD_TOAST', toast: { id: `freeze-${Date.now()}`, message: `Freeze review initiated for ${selected.account.id} (Simulated)`, type: 'warning' } });
                  }}>
                    <Snowflake size={12} /> Freeze Recommended
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => {
                  dispatch({ type: 'FLAG_ACCOUNT', id: selected.account.id });
                  dispatch({ type: 'ADD_TOAST', toast: { id: `flag-${Date.now()}`, message: `${selected.account.id} flagged`, type: 'info' } });
                }}>
                  <Flag size={12} /> Flag Account
                </button>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => {
                  dispatch({ type: 'ADD_TO_WATCHLIST', id: selected.account.id });
                  dispatch({ type: 'ADD_TOAST', toast: { id: `watch-${Date.now()}`, message: `${selected.account.id} added to watchlist`, type: 'success' } });
                }}>
                  <Eye size={12} /> Add to Watchlist
                </button>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => {
                  const relevantCase = state.cases.find(c => c.victimAccount === selected.account.id || c.currentLocation === selected.account.id);
                  if (relevantCase) navigate(`/fir-report/${relevantCase.id}`);
                  else navigate('/fir-report');
                }}>
                  <FileText size={12} /> Generate FIR / SAR Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Interactive Account Graph Modal */}
      {isGraphModalOpen && selected && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--surface-muted)',
            backdropFilter: 'blur(16px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setIsGraphModalOpen(false)}
        >
          <div
            style={{
              width: '94%',
              maxWidth: 1180,
              height: '86vh',
              background: 'var(--background)',
              border: '1px solid var(--border-strong)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 24px',
                background: 'var(--surface-elevated)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Globe size={16} style={{ color: 'var(--accent-foreground)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Account Neural Graph: <span className="mono" style={{ color: '#00d2ff' }}>{selected.account.id}</span> ({selected.account.name})
                    <span className={`risk-badge ${selected.risk.level}`}>Score: {selected.risk.score}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Linked counterparties illuminated with glowing connection arrows • Non-counterparty nodes dimmed
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', fontWeight: 500 }}
                  onClick={() => {
                    setIsGraphModalOpen(false);
                    navigate(`/network?account=${selected.account.id}&dataset=mule`);
                  }}
                >
                  Open in Network Explorer <ExternalLink size={12} />
                </button>
                <button className="btn-icon" onClick={() => setIsGraphModalOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Canvas */}
            <div style={{ flex: 1, position: 'relative' }}>
              <CortexGraphVisualizer
                nodes={visualizerNodes}
                edges={visualizerEdges}
                selectedNodeId={selected.account.id}
                onSelectNode={id => {
                  if (id && id !== selected.account.id) {
                    setSelectedId(id);
                  }
                }}
                titleBadge="ACCOUNT NEURAL GRAPH"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
