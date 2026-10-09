import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Bell, LayoutDashboard, FileWarning, Route as RouteIcon, Brain, Globe, Database, AlertTriangle, Shield, X, Moon, Sun, FileText } from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { accounts, transactions, scamCases } from './data/mockData';
import Dashboard from './pages/Dashboard';
import ScamCases from './pages/ScamCases';
import MoneyTrail from './pages/MoneyTrail';
import MuleIntelligence from './pages/MuleIntelligence';
import NetworkExplorer from './pages/NetworkExplorer';
import SyntheticData from './pages/SyntheticData';
import AlertCenter from './pages/AlertCenter';
import FIRReport from './pages/FIRReport';
import { ToastContainer } from './components/Toast';
import './index.css';

function AppShell() {
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);

  const unreadAlerts = state.alerts.filter(a => !a.read).length;

  // Close search on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search results
  const searchResults = useCallback(() => {
    if (!searchQuery.trim()) return { accounts: [], transactions: [], cases: [] };
    const q = searchQuery.toLowerCase();
    return {
      accounts: state.accounts.filter(a => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)).slice(0, 5),
      transactions: state.transactions.filter(t => t.id.toLowerCase().includes(q)).slice(0, 5),
      cases: state.cases.filter(c => c.id.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)).slice(0, 5),
    };
  }, [searchQuery, state.accounts, state.transactions, state.cases]);

  const results = searchResults();
  const hasResults = results.accounts.length > 0 || results.transactions.length > 0 || results.cases.length > 0;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Shield size={18} /></div>
          <div>
            <h1>MuleTracer</h1>
            <span>Fraud Intelligence</span>
          </div>
        </div>

        <div className="sidebar-nav">
          <div className="sidebar-section-label">Investigation</div>
          <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive && location.pathname === '/' ? 'active' : ''}`} end>
            <LayoutDashboard size={18} /> <span>Overview</span>
          </NavLink>
          <NavLink to="/cases" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <FileWarning size={18} /> <span>Scam Cases</span>
            {state.cases.filter(c => c.status === 'open' || c.status === 'investigating').length > 0 && (
              <span className="badge">{state.cases.filter(c => c.status === 'open' || c.status === 'investigating').length}</span>
            )}
          </NavLink>
          <NavLink to="/trail" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <RouteIcon size={18} /> <span>Money Trail</span>
          </NavLink>
          <NavLink to="/mule-intelligence" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Brain size={18} /> <span>Mule Intelligence</span>
          </NavLink>
          <NavLink to="/fir-report" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <FileText size={18} /> <span>FIR / SAR Report</span>
          </NavLink>

          <div className="sidebar-section-label">Analysis</div>
          <NavLink to="/network" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Globe size={18} /> <span>Network Explorer</span>
          </NavLink>
          <NavLink to="/synthetic" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Database size={18} /> <span>Synthetic Data</span>
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={18} /> <span>Alerts</span>
            {unreadAlerts > 0 && <span className="badge">{unreadAlerts}</span>}
          </NavLink>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-status">
            <div className="status-dot" />
            <span>Monitoring Active</span>
          </div>
        </div>
      </nav>

      {/* Main Area */}
      <div className="main-area">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-search" ref={searchRef}>
            <Search size={14} className="header-search-icon" />
            <input
              type="text"
              placeholder="Search accounts, transactions, cases..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && searchQuery && hasResults && (
              <div className="search-results">
                {results.accounts.length > 0 && (
                  <div className="search-result-group">
                    <div className="search-result-group-label">Accounts</div>
                    {results.accounts.map(a => (
                      <div key={a.id} className="search-result-item" onClick={() => { navigate(`/network?account=${a.id}&dataset=mule`); dispatch({ type: 'SELECT_ACCOUNT', id: a.id }); setSearchOpen(false); setSearchQuery(''); }}>
                        <span className="id">{a.id}</span>
                        <span className="label">{a.name}</span>
                        <span className={`risk-badge ${a.riskScore >= 85 ? 'critical' : a.riskScore >= 65 ? 'high' : a.riskScore >= 40 ? 'medium' : 'low'}`}>{a.riskScore}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#00d2ff', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Globe size={12} /> Graph
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {results.transactions.length > 0 && (
                  <div className="search-result-group">
                    <div className="search-result-group-label">Transactions</div>
                    {results.transactions.map(t => (
                      <div key={t.id} className="search-result-item" onClick={() => { navigate('/network'); setSearchOpen(false); setSearchQuery(''); }}>
                        <span className="id">{t.id}</span>
                        <span className="label">₹{t.amount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
                {results.cases.length > 0 && (
                  <div className="search-result-group">
                    <div className="search-result-group-label">Cases</div>
                    {results.cases.map(c => (
                      <div key={c.id} className="search-result-item" onClick={() => { navigate('/cases'); dispatch({ type: 'SELECT_CASE', id: c.id }); setSearchOpen(false); setSearchQuery(''); }}>
                        <span className="id">{c.id}</span>
                        <span className="label">{c.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {searchOpen && searchQuery && !hasResults && (
              <div className="search-results">
                <div className="empty-state" style={{ padding: '20px' }}>
                  <p className="empty-state-message">No results found for "{searchQuery}"</p>
                </div>
              </div>
            )}
          </div>

          <div className="header-status">
            <div className="status-dot" />
            Real-time Monitoring
          </div>

          <div className="header-actions">
            <button className="header-btn" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="header-btn" onClick={() => navigate('/alerts')} title="Alerts">
              <Bell size={16} />
              {unreadAlerts > 0 && <span className="notification-dot" />}
            </button>
          </div>

          <div className="header-user">
            <div className="header-user-avatar">SK</div>
            <div className="header-user-info">
              <span className="header-user-name">S. Krishnan</span>
              <span className="header-user-role">Sr. Fraud Investigator</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="content-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cases" element={<ScamCases />} />
            <Route path="/trail" element={<MoneyTrail />} />
            <Route path="/trail/:caseId" element={<MoneyTrail />} />
            <Route path="/mule-intelligence" element={<MuleIntelligence />} />
            <Route path="/fir-report" element={<FIRReport />} />
            <Route path="/fir-report/:caseId" element={<FIRReport />} />
            <Route path="/network" element={<NetworkExplorer />} />
            <Route path="/synthetic" element={<SyntheticData />} />
            <Route path="/alerts" element={<AlertCenter />} />
          </Routes>
        </div>
      </div>

      {/* Smooth Auto-Dismissing Notifications */}
      <ToastContainer
        toasts={state.toasts}
        onRemove={id => dispatch({ type: 'REMOVE_TOAST', id })}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </BrowserRouter>
  );
}
