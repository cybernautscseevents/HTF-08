import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatRelativeTime, getStatusLabel } from '../utils/formatters';
import { getRiskLevel } from '../engine/riskEngine';
import { Search, Filter, ArrowRight, ArrowUpDown, Zap, FileText } from 'lucide-react';
import type { ScamCase, ScamType, CaseStatus } from '../types';

export default function ScamCases() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'risk' | 'amount' | 'time'>('risk');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredCases = useMemo(() => {
    let cases = [...state.cases];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cases = cases.filter(c =>
        c.id.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.victimAccount.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }

    // Risk filter
    if (riskFilter !== 'all') {
      cases = cases.filter(c => {
        const level = getRiskLevel(c.riskScore);
        return level === riskFilter;
      });
    }

    // Type filter
    if (typeFilter !== 'all') {
      cases = cases.filter(c => c.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      cases = cases.filter(c => c.status === statusFilter);
    }

    // Sort
    cases.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'risk') cmp = a.riskScore - b.riskScore;
      if (sortBy === 'amount') cmp = a.amount - b.amount;
      if (sortBy === 'time') cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return cases;
  }, [state.cases, searchQuery, riskFilter, typeFilter, statusFilter, sortBy, sortDir]);

  const handleCaseClick = (c: ScamCase) => {
    dispatch({ type: 'LOAD_TRAIL', caseId: c.id });
    navigate('/trail');
  };

  const toggleSort = (field: 'risk' | 'amount' | 'time') => {
    if (sortBy === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Scam Cases</h1>
          <p className="page-subtitle">Reported scam cases under investigation</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>
            {filteredCases.length} of {state.cases.length} cases
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            className="filter-input"
            style={{ width: '100%', paddingLeft: 32 }}
            placeholder="Search cases..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select className="filter-select" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
          <option value="all">All Risk</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="Digital Arrest">Digital Arrest</option>
          <option value="Investment Scam">Investment Scam</option>
          <option value="UPI Scam">UPI Scam</option>
          <option value="Phishing">Phishing</option>
          <option value="Impersonation">Impersonation</option>
        </select>

        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Cases Table */}
      <div className="card" style={{ padding: 0 }}>
        {filteredCases.length === 0 ? (
          <div className="empty-state">
            <Filter size={32} className="empty-state-icon" />
            <p className="empty-state-title">No cases match your filters</p>
            <p className="empty-state-message">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Scam Type</th>
                <th>Victim</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount')}>
                  Amount {sortBy === 'amount' && <ArrowUpDown size={10} style={{ display: 'inline' }} />}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('risk')}>
                  Risk {sortBy === 'risk' && <ArrowUpDown size={10} style={{ display: 'inline' }} />}
                </th>
                <th>Current Location</th>
                <th>Next Hop</th>
                <th>Status</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('time')}>
                  Reported {sortBy === 'time' && <ArrowUpDown size={10} style={{ display: 'inline' }} />}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map(c => (
                <tr key={c.id} onClick={() => handleCaseClick(c)} style={{ cursor: 'pointer' }}>
                  <td className="mono" style={{ fontWeight: 600 }}>{c.id}</td>
                  <td>
                    <span style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}>
                      {c.type}
                    </span>
                  </td>
                  <td className="mono">{c.victimAccount}</td>
                  <td className="amount">{formatCurrency(c.amount)}</td>
                  <td>
                    <span className={`risk-badge ${getRiskLevel(c.riskScore)}`}>{c.riskScore}</span>
                  </td>
                  <td className="mono">{c.currentLocation}</td>
                  <td className="mono" style={{ color: c.predictedNextHop ? 'var(--risk-high)' : 'var(--text-tertiary)' }}>
                    {c.predictedNextHop || '—'}
                  </td>
                  <td>
                    <span className={`status-indicator ${
                      c.status === 'escalated' ? 'critical' :
                        c.status === 'investigating' ? 'high' :
                          c.status === 'open' ? 'medium' : 'normal'
                    }`}>
                      <span className="dot" />
                      {getStatusLabel(c.status)}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{formatRelativeTime(c.reportedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleCaseClick(c); }}>
                        <Zap size={12} /> Trace
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/fir-report/${c.id}`); }}>
                        <FileText size={12} /> FIR Draft
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
