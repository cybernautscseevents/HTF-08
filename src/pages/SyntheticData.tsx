import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { generateSyntheticDataset, SyntheticDataConfig, SyntheticDataset } from '../engine/syntheticData';
import { accounts as defaultAccounts, transactions as defaultTransactions, scamCases as defaultCases, alerts as defaultAlerts } from '../data/mockData';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import { ScamType, Alert } from '../types';
import { postGenerateSynthetic } from '../services/api';
import {
  Database, RefreshCw, Play, CheckCircle2, Download, ArrowRight,
  ShieldAlert, GitFork, Users, DollarSign, Activity, FileJson, Sparkles,
  ExternalLink, Brain, Network, Radio, Check
} from 'lucide-react';

export default function SyntheticData() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  // Generator Configuration State
  const [config, setConfig] = useState<SyntheticDataConfig>(state.syntheticConfig || {
    seed: 42,
    accountCount: 50,
    transactionCount: 95,
    mulePercentage: 25,
    fraudRingSize: 5,
    avgTransactionAmount: 250000,
    transactionVelocity: 'high',
    scamType: 'Digital Arrest',
    networkComplexity: 'complex',
  });

  // Current Generated Preview Dataset
  const [generatedData, setGeneratedData] = useState<SyntheticDataset>(() => {
    return generateSyntheticDataset(state.syntheticConfig || config);
  });

  const [activeTab, setActiveTab] = useState<'preview-cases' | 'preview-accounts' | 'preview-txns' | 'preview-institutions' | 'validation'>('preview-cases');
  const [isSyncingBackend, setIsSyncingBackend] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Function to generate data and immediately propagate it across the entire application
  const generateAndSync = useCallback((cfgToUse: SyntheticDataConfig, notify: boolean = true) => {
    const data = generateSyntheticDataset(cfgToUse);
    setGeneratedData(data);

    // Create contextual alerts for the highest risk generated mules
    const generatedAlerts: Alert[] = data.cases.map((c, i) => ({
      id: `SYN-ALT-${String(i + 1).padStart(3, '0')}`,
      type: 'critical',
      category: 'NEXT-HOP RISK',
      title: `Active fund layering in Case ${c.id}`,
      message: `${c.currentLocation} is forwarding ₹${c.amount.toLocaleString('en-IN')} towards ${c.predictedNextHop}`,
      timestamp: c.timestamp,
      relatedAccountId: c.currentLocation,
      relatedCaseId: c.id,
      read: false,
      actionLabel: 'Preemptive Review'
    }));

    // Update global app state immediately: Mule Intelligence, Network Explorer, Dashboard, etc.
    dispatch({
      type: 'SET_DATA',
      accounts: data.accounts,
      transactions: data.transactions,
      cases: data.cases,
      alerts: generatedAlerts
    });

    dispatch({ type: 'SET_SYNTHETIC_CONFIG', config: cfgToUse });

    setLastSyncTime(new Date().toLocaleTimeString());

    // Asynchronously synchronize with backend database & graph engine
    setIsSyncingBackend(true);
    postGenerateSynthetic({
      accounts: cfgToUse.accountCount,
      transactions: cfgToUse.transactionCount,
      mule_percentage: cfgToUse.mulePercentage,
      fraud_ring_count: cfgToUse.fraudRingSize,
      avg_transaction_amount: cfgToUse.avgTransactionAmount,
      scam_type: cfgToUse.scamType,
      seed: cfgToUse.seed
    }).then(() => {
      setIsSyncingBackend(false);
    }).catch(() => {
      setIsSyncingBackend(false);
    });

    if (notify) {
      dispatch({
        type: 'ADD_TOAST',
        toast: {
          id: Date.now().toString(),
          message: `⚡ Live Synced: ${data.accounts.length} accounts & ${data.transactions.length} txns active across Mule Intelligence & Network Explorer!`,
          type: 'success',
        },
      });
    }
  }, [dispatch]);

  // Handle parameter adjustment with immediate live update
  const handleParamChange = (updates: Partial<SyntheticDataConfig>) => {
    const updatedConfig = { ...config, ...updates };
    setConfig(updatedConfig);
    generateAndSync(updatedConfig, true);
  };

  // Preset Configurations for judges
  const applyPreset = (presetName: string) => {
    let newConfig: SyntheticDataConfig = { ...config };
    if (presetName === 'digital-arrest') {
      newConfig = {
        seed: 101,
        accountCount: 45,
        transactionCount: 85,
        mulePercentage: 30,
        fraudRingSize: 6,
        avgTransactionAmount: 500000,
        transactionVelocity: 'high',
        scamType: 'Digital Arrest',
        networkComplexity: 'complex',
      };
    } else if (presetName === 'investment') {
      newConfig = {
        seed: 202,
        accountCount: 75,
        transactionCount: 140,
        mulePercentage: 35,
        fraudRingSize: 8,
        avgTransactionAmount: 850000,
        transactionVelocity: 'medium',
        scamType: 'Investment Scam',
        networkComplexity: 'complex',
      };
    } else if (presetName === 'upi-ring') {
      newConfig = {
        seed: 303,
        accountCount: 30,
        transactionCount: 60,
        mulePercentage: 40,
        fraudRingSize: 4,
        avgTransactionAmount: 95000,
        transactionVelocity: 'high',
        scamType: 'UPI Scam',
        networkComplexity: 'moderate',
      };
    } else if (presetName === 'large-bank') {
      newConfig = {
        seed: 404,
        accountCount: 110,
        transactionCount: 240,
        mulePercentage: 22,
        fraudRingSize: 7,
        avgTransactionAmount: 320000,
        transactionVelocity: 'medium',
        scamType: 'Digital Arrest',
        networkComplexity: 'complex',
      };
    }
    setConfig(newConfig);
    generateAndSync(newConfig, true);
  };

  // Reset to original mock data
  const handleResetToCanonical = () => {
    dispatch({
      type: 'SET_DATA',
      accounts: defaultAccounts,
      transactions: defaultTransactions,
      cases: defaultCases,
      alerts: defaultAlerts
    });
    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: Date.now().toString(),
        message: 'System data reset to canonical reference dataset (Case SC-001).',
        type: 'info',
      },
    });
  };

  // Export JSON file for judges
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(
      {
        config,
        metadata: {
          timestamp: new Date().toISOString(),
          generator: 'MuleTracer Synthetic Network Engine v1.0',
        },
        dataset: generatedData,
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `muletracer-synthetic-seed${config.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculated Preview Metrics
  const stats = useMemo(() => {
    const mules = generatedData.accounts.filter(a => a.accountType === 'mule');
    const victims = generatedData.accounts.filter(a => a.accountType === 'victim');
    const cashouts = generatedData.accounts.filter(a => a.accountType === 'cashout');
    const totalVolume = generatedData.transactions.reduce((s, t) => s + t.amount, 0);
    const avgRisk = Math.round(
      generatedData.accounts.reduce((s, a) => s + a.riskScore, 0) / (generatedData.accounts.length || 1)
    );

    return {
      muleCount: mules.length,
      victimCount: victims.length,
      cashoutCount: cashouts.length,
      totalVolume,
      avgRisk,
    };
  }, [generatedData]);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Synthetic Data Generator</h1>
            <span style={{ fontSize: 11, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>
              LIVE APP SYNC ENABLED
            </span>
          </div>
          <p className="page-subtitle">
            Deterministic, seed-based synthetic transaction network generator with real-time propagation across all intelligence views
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleResetToCanonical} title="Reset to standard 21-account dataset">
            <RefreshCw size={13} /> Reset to Canonical
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleExportJson} title="Download dataset as JSON">
            <Download size={13} /> Export JSON
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => generateAndSync(config, true)}>
            <Play size={13} /> Regenerate & Apply
          </button>
        </div>
      </div>

      {/* LIVE SYNC & PREVIEW ACROSS PLATFORM BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.08))',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--success)',
            boxShadow: '0 0 10px var(--success)',
            animation: 'pulse 1.8s infinite'
          }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>ACTIVE DATASET: {generatedData.accounts.length} ACCOUNTS • {generatedData.transactions.length} TRANSACTIONS • {stats.muleCount} MULES</span>
              {isSyncingBackend && (
                <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 400 }}>
                  (Syncing Backend...)
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              Adjusting parameters immediately updates and visualizes all entities across Mule Intelligence, Network Explorer & Dashboard (Last synced: {lastSyncTime}).
            </div>
          </div>
        </div>

        {/* Quick Navigation Links */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm btn-primary"
            style={{ background: '#3b82f6', border: 'none' }}
            onClick={() => navigate('/mule-intelligence')}
          >
            <Brain size={13} /> Preview in Mule Intelligence ({stats.muleCount}) <ArrowRight size={12} />
          </button>
          <button
            className="btn btn-sm btn-primary"
            style={{ background: '#8b5cf6', border: 'none' }}
            onClick={() => navigate('/network')}
          >
            <Network size={13} /> Visualize in Network Graph ({generatedData.accounts.length}) <ArrowRight size={12} />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            style={{ border: '1px solid var(--border)' }}
            onClick={() => navigate('/')}
          >
            Dashboard Overview <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Preset Banner */}
      <div className="demo-banner" style={{ margin: 0 }}>
        <div className="demo-banner-text">
          <span className="demo-banner-title">Quick Attack Pattern Presets</span>
          <span className="demo-banner-subtitle">
            Instantly configure and apply real-world fraud scenarios into the active intelligence engine
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => applyPreset('digital-arrest')}>
            <Sparkles size={12} color="var(--risk-critical)" /> Digital Arrest Drain (45 Accounts)
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => applyPreset('investment')}>
            <GitFork size={12} color="var(--risk-high)" /> Investment Scam Tree (75 Accounts)
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => applyPreset('upi-ring')}>
            <Activity size={12} color="var(--warning)" /> UPI Circular Mule Ring (30 Accounts)
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => applyPreset('large-bank')}>
            <Database size={12} color="var(--accent)" /> High-Density Bank (110 Accounts)
          </button>
        </div>
      </div>

      {/* Main Grid: Parameters Form & Live Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
        {/* Left Column: Generator Controls */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <span className="card-title">Network Generator Parameters</span>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const newSeed = Math.floor(Math.random() * 9000) + 1000;
                handleParamChange({ seed: newSeed });
              }}
              title="Re-roll random seed"
            >
              <RefreshCw size={12} /> Re-roll Seed: {config.seed}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Account Count Slider */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label">Total Accounts</label>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                  {config.accountCount} Accounts
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="150"
                step="5"
                value={config.accountCount}
                onChange={e => handleParamChange({ accountCount: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
                <span>15 (Compact)</span>
                <span>75 (Medium)</span>
                <span>150 (Enterprise)</span>
              </div>
            </div>

            {/* Transaction Count Slider */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label">Total Transactions</label>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                  {config.transactionCount} Txns
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="300"
                step="5"
                value={config.transactionCount}
                onChange={e => handleParamChange({ transactionCount: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
                <span>20</span>
                <span>150</span>
                <span>300 (Dense Web)</span>
              </div>
            </div>

            {/* Mule Percentage Slider */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label">Mule Proportion (%)</label>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--risk-critical)' }}>
                  {config.mulePercentage}% ({stats.muleCount} Mules)
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={config.mulePercentage}
                onChange={e => handleParamChange({ mulePercentage: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--risk-critical)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)' }}>
                <span>10% (Low)</span>
                <span>30% (Standard)</span>
                <span>50% (Heavy Syndicate)</span>
              </div>
            </div>

            {/* Average Amount Slider */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label">Avg Transaction Volume</label>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
                  {formatCurrency(config.avgTransactionAmount)}
                </span>
              </div>
              <input
                type="range"
                min="50000"
                max="1000000"
                step="25000"
                value={config.avgTransactionAmount}
                onChange={e => handleParamChange({ avgTransactionAmount: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
            </div>

            {/* Fraud Ring Size */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label">Primary Fraud Ring Depth</label>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
                  {config.fraudRingSize} Hops
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="10"
                step="1"
                value={config.fraudRingSize}
                onChange={e => handleParamChange({ fraudRingSize: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            {/* Scam Type */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Primary Scam Pattern</label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={config.scamType}
                onChange={e => handleParamChange({ scamType: e.target.value as ScamType })}
              >
                <option value="Digital Arrest">Digital Arrest (Multi-Hop Rapid Drain)</option>
                <option value="Investment Scam">Investment Scam (Branching Layering)</option>
                <option value="UPI Scam">UPI Scam (Small-Value High-Velocity)</option>
                <option value="Phishing">Phishing (Immediate Cashout)</option>
                <option value="Impersonation">Impersonation (Mule Ring)</option>
              </select>
            </div>

            {/* Transaction Velocity */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Transaction Velocity</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {(['low', 'medium', 'high'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`btn btn-sm ${config.transactionVelocity === v ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ textTransform: 'capitalize', justifyContent: 'center' }}
                    onClick={() => handleParamChange({ transactionVelocity: v })}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Network Complexity */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Network Topology Complexity</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {(['simple', 'moderate', 'complex'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`btn btn-sm ${config.networkComplexity === c ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ textTransform: 'capitalize', justifyContent: 'center' }}
                    onClick={() => handleParamChange({ networkComplexity: c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Seed numeric input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="form-label">Deterministic PRNG Seed</label>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Reproducible</span>
              </div>
              <input
                type="number"
                className="form-input"
                value={config.seed}
                onChange={e => handleParamChange({ seed: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Generated Preview & Statistics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary KPIs */}
          <div className="metrics-grid" style={{ marginBottom: 0 }}>
            <div className="metric-card accent">
              <div className="metric-label">
                <Users size={12} /> Active Network Nodes
              </div>
              <div className="metric-value">{generatedData.accounts.length}</div>
              <div className="metric-trend neutral">{stats.muleCount} Mules • {stats.victimCount} Victims</div>
            </div>

            <div className="metric-card danger">
              <div className="metric-label">
                <ShieldAlert size={12} /> Detected Mule Accounts
              </div>
              <div className="metric-value" style={{ color: 'var(--risk-critical)' }}>
                {stats.muleCount}
              </div>
              <div className="metric-trend up">{((stats.muleCount / generatedData.accounts.length) * 100).toFixed(0)}% of network</div>
            </div>

            <div className="metric-card info">
              <div className="metric-label">
                <Activity size={12} /> Layered Transactions
              </div>
              <div className="metric-value">{generatedData.transactions.length}</div>
              <div className="metric-trend neutral">{formatCurrency(stats.totalVolume)} Total Volume</div>
            </div>

            <div className="metric-card warning">
              <div className="metric-label">
                <DollarSign size={12} /> Generated Scam Cases
              </div>
              <div className="metric-value">{generatedData.cases.length}</div>
              <div className="metric-trend down">Active Money Trails</div>
            </div>
          </div>

          {/* Dataset Tabs */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: 0, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'preview-cases' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preview-cases')}
                >
                  Scam Cases ({generatedData.cases.length})
                </button>
                <button
                  className={`tab ${activeTab === 'preview-accounts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preview-accounts')}
                >
                  Accounts ({generatedData.accounts.length})
                </button>
                <button
                  className={`tab ${activeTab === 'preview-txns' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preview-txns')}
                >
                  Transactions ({generatedData.transactions.length})
                </button>
                <button
                  className={`tab ${activeTab === 'preview-institutions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('preview-institutions')}
                >
                  Banks ({generatedData.institutions?.length || 0})
                </button>
                <button
                  className={`tab ${activeTab === 'validation' ? 'active' : ''}`}
                  onClick={() => setActiveTab('validation')}
                >
                  Integrity Validation {generatedData.validationReport?.valid ? '✓' : '⚠️'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {activeTab === 'preview-accounts' && (
                  <button className="btn btn-sm btn-ghost" onClick={() => navigate('/mule-intelligence')}>
                    <Brain size={12} /> Open in Mule Intelligence <ExternalLink size={11} />
                  </button>
                )}
                {activeTab === 'preview-txns' && (
                  <button className="btn btn-sm btn-ghost" onClick={() => navigate('/network')}>
                    <Network size={12} /> Open in Network Explorer <ExternalLink size={11} />
                  </button>
                )}
                {activeTab === 'preview-cases' && (
                  <button className="btn btn-sm btn-ghost" onClick={() => navigate('/cases')}>
                    View Cases List <ExternalLink size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* TAB CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420, padding: '12px 0' }}>
              {activeTab === 'preview-accounts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {generatedData.accounts.map(a => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="mono" style={{ fontWeight: 700, color: '#fff' }}>{a.id}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.bank}</span>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            background: a.accountType === 'mule' ? 'rgba(239, 68, 68, 0.15)' : a.accountType === 'victim' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                            color: a.accountType === 'mule' ? 'var(--risk-critical)' : a.accountType === 'victim' ? '#a78bfa' : '#38bdf8'
                          }}
                        >
                          {a.accountType}
                        </span>
                        {a.deviceId && (
                          <span className="mono" style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                            {a.deviceId}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="mono" style={{ fontWeight: 700, color: a.riskScore >= 70 ? 'var(--risk-critical)' : 'inherit' }}>
                          Risk: {a.riskScore}/100
                        </span>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ fontSize: 11, padding: '2px 8px', height: 'auto' }}
                          onClick={() => {
                            dispatch({ type: 'SELECT_ACCOUNT', id: a.id });
                            navigate('/mule-intelligence');
                          }}
                        >
                          Inspect <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'preview-txns' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {generatedData.transactions.map(t => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="mono" style={{ fontWeight: 600 }}>{t.id}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="mono" style={{ color: 'var(--accent)' }}>{t.source}</span>
                          <ArrowRight size={12} style={{ color: 'var(--text-tertiary)' }} />
                          <span className="mono" style={{ color: 'var(--risk-critical)' }}>{t.destination}</span>
                        </div>
                        <span style={{ fontSize: 10, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-tertiary)' }}>
                          {t.type}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span className="mono" style={{ fontWeight: 700, color: '#fff' }}>
                          {formatCurrency(t.amount)}
                        </span>
                        <span style={{ fontSize: 11, color: t.riskScore >= 75 ? 'var(--risk-critical)' : 'var(--text-secondary)' }}>
                          Risk {t.riskScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'preview-cases' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {generatedData.cases.map(c => (
                    <div
                      key={c.id}
                      style={{
                        padding: '14px 16px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{c.id}</span>
                          <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.15)', color: 'var(--risk-critical)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            {c.type}
                          </span>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Victim: {c.victimAccount}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {c.description} • Current Location: <strong className="mono" style={{ color: 'var(--risk-critical)' }}>{c.currentLocation}</strong> • Predicted Next Hop: <strong className="mono" style={{ color: '#38bdf8' }}>{c.predictedNextHop}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                          {formatCurrency(c.amount)}
                        </span>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            dispatch({ type: 'LOAD_TRAIL', caseId: c.id });
                            navigate(`/trail/${c.id}`);
                          }}
                        >
                          Trace Trail <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'preview-institutions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(generatedData.institutions || []).map(inst => {
                    const instAccounts = generatedData.accounts.filter(a => a.institutionCode === inst.code);
                    const instMules = instAccounts.filter(a => a.accountType === 'mule');
                    return (
                      <div
                        key={inst.id}
                        style={{
                          padding: '12px 16px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>
                              {inst.code}
                            </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                              {inst.name}
                            </span>
                            <span style={{ fontSize: 10, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-tertiary)' }}>
                              {inst.type}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            ID: <span className="mono">{inst.id}</span> • Synthetic Banking Entity
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            <strong className="mono" style={{ color: 'var(--text-primary)' }}>{instAccounts.length}</strong> accounts
                          </span>
                          <span style={{ fontSize: 12, color: instMules.length > 0 ? 'var(--risk-critical)' : 'var(--text-tertiary)' }}>
                            <strong className="mono">{instMules.length}</strong> mules
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'validation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      background: generatedData.validationReport?.valid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${generatedData.validationReport?.valid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: generatedData.validationReport?.valid ? 'var(--success)' : 'var(--risk-critical)' }}>
                        {generatedData.validationReport?.valid ? '✓ Dataset Referential Integrity Passed' : '⚠️ Dataset Validation Issues Detected'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Dataset Version: <span className="mono">{generatedData.datasetVersion}</span> • Seed: <span className="mono">{config.seed}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {Object.entries(generatedData.validationReport?.checks || {}).map(([chk, passed]) => (
                      <div
                        key={chk}
                        style={{
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12
                        }}
                      >
                        <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                          {chk.replace(/_/g, ' ')}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontWeight: 700,
                            color: passed ? 'var(--success)' : 'var(--risk-critical)',
                            fontSize: 11
                          }}
                        >
                          {passed ? 'PASSED ✓' : 'FAILED ✗'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {generatedData.validationReport?.errors && generatedData.validationReport.errors.length > 0 && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--risk-critical)', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>Validation Errors:</div>
                      <ul style={{ paddingLeft: 18, margin: 0 }}>
                        {generatedData.validationReport.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
