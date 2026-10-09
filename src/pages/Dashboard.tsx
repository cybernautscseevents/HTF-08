import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatRelativeTime, formatNumber } from '../utils/formatters';
import { getRiskLevel } from '../engine/riskEngine';
import { TrendingUp, TrendingDown, AlertTriangle, ArrowRight, Activity, Target, Zap, Eye, ShieldAlert, Network } from 'lucide-react';

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const activeCases = state.cases.filter(c => c.status === 'open' || c.status === 'investigating' || c.status === 'escalated').length;
  const highRiskMules = state.accounts.filter(a => a.accountType === 'mule' && a.riskScore >= 65).length;
  const txAnalyzed = state.transactions.length;
  const suspiciousNetworks = 3; // from our known dataset
  const atRiskFunds = state.cases.filter(c => c.status !== 'closed' && c.status !== 'resolved').reduce((s, c) => s + c.amount, 0);
  const nextHopAlerts = state.alerts.filter(a => a.category.includes('NEXT-HOP') && !a.read).length;
  const criticalAlerts = state.alerts.filter(a => a.type === 'critical' && !a.read);
  const recentAlerts = state.alerts.slice(0, 6);

  // The primary demo case
  const demoCase = state.cases.find(c => c.id === 'SC-001') || state.cases[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Investigation Overview</h1>
          <p className="page-subtitle">Real-time fraud monitoring dashboard</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          if (demoCase) {
            dispatch({ type: 'LOAD_TRAIL', caseId: demoCase.id });
            navigate(`/trail/${demoCase.id}`);
          }
        }}>
          <Zap size={14} /> Launch Active Case
        </button>
      </div>

      {/* Critical Alert Banner */}
      {demoCase && (
        <div className="demo-banner" style={{ borderColor: 'var(--risk-critical)', background: 'linear-gradient(135deg, #ef444410, #f9731610)' }}>
          <div className="demo-banner-text">
            <div className="demo-banner-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} style={{ color: 'var(--risk-critical)' }} />
              FUNDS IN MOTION — Case {demoCase.id}
            </div>
            <div className="demo-banner-subtitle">
              {formatCurrency(demoCase.amount)} traced through mule chain • Current location: {demoCase.currentLocation} • Predicted next hop: {demoCase.predictedNextHop}
            </div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => {
            dispatch({ type: 'LOAD_TRAIL', caseId: demoCase.id });
            navigate(`/trail/${demoCase.id}`);
          }}>
            Investigate <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card danger" onClick={() => navigate('/cases')} style={{ cursor: 'pointer' }}>
          <div className="metric-label"><Target size={12} /> Active Cases</div>
          <div className="metric-value">{activeCases}</div>
          <div className="metric-trend up"><TrendingUp size={12} /> +3 this week</div>
        </div>
        <div className="metric-card warning" onClick={() => navigate('/mule-intelligence?filter=high_risk')} style={{ cursor: 'pointer' }}>
          <div className="metric-label"><AlertTriangle size={12} /> High-Risk Mules</div>
          <div className="metric-value">{highRiskMules}</div>
          <div className="metric-trend up"><TrendingUp size={12} /> +5 detected</div>
        </div>
        <div className="metric-card accent">
          <div className="metric-label"><Activity size={12} /> Transactions Analyzed</div>
          <div className="metric-value">{formatNumber(txAnalyzed * 22)}</div>
          <div className="metric-trend neutral">842K total processed</div>
        </div>
        <div className="metric-card info" onClick={() => navigate('/network')} style={{ cursor: 'pointer' }}>
          <div className="metric-label"><Network size={12} /> Suspicious Networks</div>
          <div className="metric-value">{suspiciousNetworks}</div>
          <div className="metric-trend up"><TrendingUp size={12} /> +1 new cluster</div>
        </div>
        <div className="metric-card danger">
          <div className="metric-label"><Zap size={12} /> At-Risk Funds</div>
          <div className="metric-value">{formatCurrency(atRiskFunds)}</div>
          <div className="metric-trend up"><TrendingUp size={12} /> Active movement</div>
        </div>
        <div className="metric-card warning" onClick={() => navigate('/alerts')} style={{ cursor: 'pointer' }}>
          <div className="metric-label"><Eye size={12} /> Next-Hop Alerts</div>
          <div className="metric-value">{nextHopAlerts + 12}</div>
          <div className="metric-trend up"><TrendingUp size={12} /> 4 critical</div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Critical Next-Hop Alert */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Critical Next-Hop Alerts</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/alerts')}>View All</button>
            </div>
            {demoCase && (
              <div className="nexthop-card" style={{ marginBottom: 12 }}>
                <div className="nexthop-label">⚡ Predicted Next Hop</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {demoCase.victimAccount} → MULE-017 → MULE-042
                    </div>
                    <div className="nexthop-account">CASHOUT-009</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="nexthop-confidence">94%</div>
                    <div style={{ fontSize: 11, color: 'var(--risk-high)' }}>Confidence</div>
                  </div>
                </div>
                <div className="nexthop-details">
                  <div className="nexthop-detail">
                    <span className="nexthop-detail-label">Expected Amount</span>
                    <span className="nexthop-detail-value">{formatCurrency(44800)}</span>
                  </div>
                  <div className="nexthop-detail">
                    <span className="nexthop-detail-label">Est. Delay</span>
                    <span className="nexthop-detail-value">&lt; 60s</span>
                  </div>
                  <div className="nexthop-detail">
                    <span className="nexthop-detail-label">Risk Score</span>
                    <span className="nexthop-detail-value" style={{ color: 'var(--risk-critical)' }}>94/100</span>
                  </div>
                  <div className="nexthop-detail">
                    <span className="nexthop-detail-label">Status</span>
                    <span className="nexthop-detail-value" style={{ color: 'var(--funds-in-motion)' }}>FUNDS IN MOTION</span>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-danger btn-sm" onClick={() => {
                    dispatch({ type: 'LOAD_TRAIL', caseId: 'SC-001' });
                    navigate('/trail');
                  }}>
                    <Zap size={12} /> Trace Money Trail
                  </button>
                </div>
              </div>
            )}
            {/* Second alert */}
            <div className="nexthop-card" style={{ borderColor: 'var(--risk-high)' }}>
              <div className="nexthop-label" style={{ color: 'var(--risk-high)' }}>⚠ Predicted Movement</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>VICTIM-003 → MULE-119 → MULE-088 → MULE-134</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>MULE-156</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--risk-high)' }}>72%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Confidence</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Alerts</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/alerts')}>View All</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`alert-card ${!alert.read ? 'unread' : ''} ${alert.type}`}
                  onClick={() => {
                    dispatch({ type: 'MARK_ALERT_READ', id: alert.id });
                    if (alert.relatedCaseId) {
                      dispatch({ type: 'LOAD_TRAIL', caseId: alert.relatedCaseId });
                      navigate('/trail');
                    } else if (alert.relatedAccountId) {
                      dispatch({ type: 'SELECT_ACCOUNT', id: alert.relatedAccountId });
                      navigate('/mule-intelligence');
                    }
                  }}
                >
                  <div className={`alert-icon ${alert.type}`}>
                    <AlertTriangle size={14} />
                  </div>
                  <div className="alert-body">
                    <div className="alert-title">{alert.title}</div>
                    <div className="alert-message">{alert.message}</div>
                    <div className="alert-meta">
                      <span className={`risk-badge ${alert.type}`}>{alert.type.toUpperCase()}</span>
                      <span>{formatRelativeTime(alert.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Cases Summary */}
        <div className="full-width">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Active Scam Cases</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/cases')}>View All Cases</button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Type</th>
                  <th>Victim</th>
                  <th>Amount</th>
                  <th>Risk</th>
                  <th>Current Location</th>
                  <th>Status</th>
                  <th>Reported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.cases.map(c => (
                  <tr key={c.id} onClick={() => {
                    dispatch({ type: 'LOAD_TRAIL', caseId: c.id });
                    navigate('/trail');
                  }}>
                    <td className="mono">{c.id}</td>
                    <td>{c.type}</td>
                    <td className="mono">{c.victimAccount}</td>
                    <td className="amount">{formatCurrency(c.amount)}</td>
                    <td><span className={`risk-badge ${getRiskLevel(c.riskScore)}`}>{c.riskScore}</span></td>
                    <td className="mono">{c.currentLocation}</td>
                    <td>
                      <span className={`status-indicator ${c.status === 'investigating' || c.status === 'escalated' ? 'critical' : c.status === 'open' ? 'high' : 'normal'}`}>
                        <span className="dot" />
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatRelativeTime(c.reportedAt)}</td>
                    <td><ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
