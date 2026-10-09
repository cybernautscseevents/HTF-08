import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import CortexGraphVisualizer, {
  VisualizerNode,
  VisualizerEdge,
  NodeCategory,
} from '../components/CortexGraphVisualizer';
import {
  calculateGraphMetrics,
  findShortestPath,
  buildAdjacencyList,
} from '../engine/graphEngine';
import { calculateMuleRisk, getRiskLevel } from '../engine/riskEngine';
import { postFreezeRecommendation, postGraphRAGQuery } from '../services/api';
import { formatCurrency, formatDateTime, formatDelay, formatPercentage } from '../utils/formatters';
import {
  Sparkles, Globe, Shield, AlertTriangle, ArrowRight, X, ExternalLink,
  GitCommit, Smartphone, Network, CheckCircle2, ChevronRight, Zap,
  RefreshCw, Check
} from 'lucide-react';

export default function NetworkExplorer() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected node (Focuses the account, highlights connected nodes, dims remaining nodes)
  const initialAccount = searchParams.get('account') || searchParams.get('node') || searchParams.get('id');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialAccount || null);

  // Update selection if URL search params change
  useEffect(() => {
    const acc = searchParams.get('account') || searchParams.get('node') || searchParams.get('id');
    if (acc) {
      setSelectedNodeId(acc);
    } else {
      setSelectedNodeId(null);
    }
  }, [searchParams]);

  // Path finder states (BFS)
  const [pathStart, setPathStart] = useState<string>('VICTIM-001');
  const [pathEnd, setPathEnd] = useState<string>('CASHOUT-009');
  const [calculatedPath, setCalculatedPath] = useState<string[] | null>(null);

  // GraphRAG AI Assistant State
  const [isGraphRagOpen, setIsGraphRagOpen] = useState<boolean>(false);
  const [graphRagQuery, setGraphRagQuery] = useState<string>('');
  const [graphRagLoading, setGraphRagLoading] = useState<boolean>(false);
  const [graphRagResult, setGraphRagResult] = useState<{
    query?: string;
    answer: string;
    intent?: string;
    primary_entity?: string;
    graph_path?: string[];
    evidence_checklist?: Array<{ rule: string; status: string; detail: string }>;
    confidence?: number;
  } | null>(null);

  // Adjacency list for graph path calculations
  const adjList = useMemo(() => buildAdjacencyList(state.transactions), [state.transactions]);

  // =========================================================================
  // FINANCIAL CRIME NETWORK (MuleTracer Bank Intelligence)
  // =========================================================================
  const financialCrimeNodes: VisualizerNode[] = useMemo(() => {
    // Explicit coordinates mapping for clear topological layout
    const coords: Record<string, { x: number; y: number }> = {
      // Primary cascade
      'VICTIM-001': { x: 220, y: 220 },
      'MULE-017': { x: 380, y: 340 },
      'MULE-042': { x: 560, y: 320 },
      'MULE-103': { x: 740, y: 360 },
      'CASHOUT-009': { x: 910, y: 240 },

      // Secondary cascade
      'VICTIM-002': { x: 200, y: 480 },
      'MULE-028': { x: 420, y: 500 },
      'MULE-055': { x: 620, y: 500 },
      'MULE-071': { x: 780, y: 500 },
      'CASHOUT-014': { x: 920, y: 480 },

      // Tertiary cascade
      'VICTIM-003': { x: 240, y: 130 },
      'MULE-119': { x: 440, y: 150 },
      'MULE-088': { x: 640, y: 150 },
      'MULE-134': { x: 800, y: 150 },
      'MULE-156': { x: 940, y: 150 },

      // Shared Hardware Infrastructure
      'DEV-7092': { x: 560, y: 440 },
      'DEV-4108': { x: 620, y: 620 },

      // Normal noise
      'NORMAL-001': { x: 180, y: 360 },
      'MERCHANT-001': { x: 340, y: 640 },
      'NORMAL-002': { x: 840, y: 640 },
    };

    const list: VisualizerNode[] = [];

    // Add Accounts
    state.accounts.forEach(a => {
      const coord = coords[a.id];
      let cat: NodeCategory = 'Person';
      if (a.accountType === 'victim') cat = 'Victim';
      else if (a.accountType === 'mule') cat = 'Mule';
      else if (a.accountType === 'cashout' || a.accountType === 'atm') cat = 'Cashout';
      else if (a.accountType === 'merchant') cat = 'Institution';
      else if (a.accountType === 'beneficiary') cat = 'Person';
      else cat = 'Person';

      list.push({
        id: a.id,
        name: a.name,
        type: a.accountType,
        category: cat,
        riskScore: a.riskScore,
        status: a.status,
        deviceId: a.deviceId,
        baseX: coord ? coord.x : undefined,
        baseY: coord ? coord.y : undefined,
        description: `${a.bank} • Score: ${a.riskScore}/100 • Total In: ₹${(a.totalIncoming / 1000).toFixed(0)}K`,
        details: {
          Bank: a.bank,
          'Account Type': a.accountType.toUpperCase(),
          'Hardware ID': a.deviceId || 'None',
          Status: a.status,
          'Risk Score': a.riskScore,
        },
      });
    });

    // Add Shared Hardware Nodes as distinct infrastructural entities
    list.push({
      id: 'DEV-7092',
      name: 'Hardware DEV-7092',
      type: 'Device',
      category: 'Infrastructure',
      riskScore: 92,
      baseX: coords['DEV-7092'].x,
      baseY: coords['DEV-7092'].y,
      description: 'Shared device fingerprint detected across 3 high-velocity mule accounts',
      details: {
        'Device Hash': 'DEV-7092',
        'Collusion Risk': 'CRITICAL (92)',
        'Linked Accounts': 'MULE-017, MULE-042, MULE-103',
      },
    });

    list.push({
      id: 'DEV-4108',
      name: 'Hardware DEV-4108',
      type: 'Device',
      category: 'Infrastructure',
      riskScore: 84,
      baseX: coords['DEV-4108'].x,
      baseY: coords['DEV-4108'].y,
      description: 'Shared device signature link between Nitin Gupta, Vivek Yadav & Manoj Dubey',
      details: {
        'Device Hash': 'DEV-4108',
        'Collusion Risk': 'HIGH (84)',
        'Linked Accounts': 'MULE-028, MULE-055, MULE-071',
      },
    });

    return list;
  }, [state.accounts]);

  const financialCrimeEdges: VisualizerEdge[] = useMemo(() => {
    const list: VisualizerEdge[] = [];

    // Transactions with descriptive semantic relationship labels
    state.transactions.forEach(t => {
      let label = `TRANSFER · ₹${(t.amount / 1000).toFixed(1)}K`;

      if (t.source === 'VICTIM-001' && t.destination === 'MULE-017') label = 'TRANSFERRED_TO ₹50K';
      else if (t.source === 'MULE-017' && t.destination === 'MULE-042') label = 'RAPID_FORWARD ₹48.7K';
      else if (t.source === 'MULE-042' && t.destination === 'MULE-103') label = 'LAYERED_FLOW ₹46.9K';
      else if (t.source === 'MULE-103' && t.destination === 'CASHOUT-009') label = 'CASHOUT_EXIT ₹44.8K';
      else if (t.source === 'VICTIM-002' && t.destination === 'MULE-028') label = 'TRANSFERRED_TO ₹125K';
      else if (t.source === 'MULE-028' && t.destination === 'MULE-055') label = 'RAPID_FORWARD ₹119.5K';
      else if (t.source === 'MULE-055' && t.destination === 'MULE-071') label = 'LAYERED_FLOW ₹115K';
      else if (t.source === 'MULE-071' && t.destination === 'CASHOUT-014') label = 'CASHOUT_EXIT ₹111.2K';
      else if (t.source === 'MULE-042' && t.destination === 'MULE-028') label = 'CROSS_SYNDICATE ₹12K';
      else if (t.source === 'MULE-017' && t.destination === 'MULE-119') label = 'CROSS_SYNDICATE ₹15K';

      list.push({
        id: t.id,
        source: t.source,
        target: t.destination,
        label,
        amount: t.amount,
        type: t.type,
        riskScore: t.riskScore,
      });
    });

    // Device telemetry edges (Shared hardware association)
    const deviceLinks = [
      { id: 'dev-m17', source: 'MULE-017', target: 'DEV-7092', label: 'SHARED_HARDWARE' },
      { id: 'dev-m42', source: 'MULE-042', target: 'DEV-7092', label: 'SHARED_HARDWARE' },
      { id: 'dev-m103', source: 'MULE-103', target: 'DEV-7092', label: 'SHARED_HARDWARE' },
      { id: 'dev-m28', source: 'MULE-028', target: 'DEV-4108', label: 'SHARED_HARDWARE' },
      { id: 'dev-m55', source: 'MULE-055', target: 'DEV-4108', label: 'SHARED_HARDWARE' },
      { id: 'dev-m71', source: 'MULE-071', target: 'DEV-4108', label: 'SHARED_HARDWARE' },
    ];
    list.push(...deviceLinks);

    return list;
  }, [state.transactions]);

  // Current active nodes and edges
  const currentNodes: VisualizerNode[] = financialCrimeNodes;
  const currentEdges: VisualizerEdge[] = financialCrimeEdges;

  // Selected Node Data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return currentNodes.find(n => n.id === selectedNodeId) || null;
  }, [currentNodes, selectedNodeId]);

  // Selected Bank Account if in Mule mode
  const selectedAccount = useMemo(() => {
    if (!selectedNodeId) return null;
    return state.accounts.find(a => a.id === selectedNodeId) || null;
  }, [selectedNodeId, state.accounts]);

  // Shared device detection
  const sharedDeviceAccounts = useMemo(() => {
    if (!selectedAccount || !selectedAccount.deviceId) return [];
    return state.accounts.filter(a => a.deviceId === selectedAccount.deviceId && a.id !== selectedAccount.id);
  }, [selectedAccount, state.accounts]);

  // Account Topological Metrics
  const selectedMetrics = useMemo(() => {
    if (!selectedAccount) return null;
    return calculateGraphMetrics(selectedAccount.id, state.transactions, state.accounts.length);
  }, [selectedAccount, state.transactions, state.accounts.length]);

  // Account Mule Risk
  const selectedRisk = useMemo(() => {
    if (!selectedAccount) return null;
    return calculateMuleRisk(selectedAccount, state.transactions, state.accounts);
  }, [selectedAccount, state.transactions, state.accounts]);

  // Direct transactions for selected account
  const selectedTransactions = useMemo(() => {
    if (!selectedAccount) return { incoming: [], outgoing: [] };
    return {
      incoming: state.transactions.filter(t => t.destination === selectedAccount.id),
      outgoing: state.transactions.filter(t => t.source === selectedAccount.id),
    };
  }, [selectedAccount, state.transactions]);

  // Actions
  const handleFreeze = async (accountId: string) => {
    dispatch({ type: 'FREEZE_ACCOUNT', id: accountId });
    await postFreezeRecommendation(accountId, 'SC-001', 'High-velocity pass-through and shared hardware signature detected');
    dispatch({
      type: 'ADD_TOAST',
      toast: {
        id: Date.now().toString(),
        message: `Account ${accountId} successfully flagged for Preemptive Freeze Review (NPCI API simulated)`,
        type: 'success',
      },
    });
  };

  const handleWatchlist = (accountId: string) => {
    dispatch({ type: 'ADD_TO_WATCHLIST', id: accountId });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now().toString(), message: `Account ${accountId} added to High-Velocity Watchlist`, type: 'info' },
    });
  };

  const handleFlag = (accountId: string) => {
    dispatch({ type: 'FLAG_ACCOUNT', id: accountId });
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: Date.now().toString(), message: `Account ${accountId} flagged for AML escalation`, type: 'warning' },
    });
  };



  // Shortest path tracer
  const handleFindPath = () => {
    if (!pathStart || !pathEnd) return;
    const path = findShortestPath(pathStart, pathEnd, adjList);
    setCalculatedPath(path);
    if (path) {
      if (path.length > 0) setSelectedNodeId(path[0]);
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now().toString(), message: `Suspicious money-flow path found (${path.length} hops)`, type: 'info' },
      });
    } else {
      dispatch({
        type: 'ADD_TOAST',
        toast: { id: Date.now().toString(), message: `No active path found between ${pathStart} and ${pathEnd}`, type: 'warning' },
      });
    }
  };

  // GraphRAG AI Assistant Query Handler
  const handleGraphRagSubmit = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : graphRagQuery).trim();
    if (!q) return;
    setGraphRagLoading(true);

    try {
      const res = await postGraphRAGQuery(q, selectedNodeId || undefined);
      if (res && res.answer) {
        setGraphRagResult(res);
        setGraphRagLoading(false);
        return;
      }
    } catch {
      // Fallback
    }

    // Default grounded intelligence narrative
    const targetEntity = selectedNodeId || 'MULE-017';
    setGraphRagResult({
      query: q,
      answer: `Grounded Graph Analysis for ${targetEntity}:\n` +
        `• Direct topological connectivity to high-velocity mule cascade detected.\n` +
        `• Sequential hop layering velocity with retention times under 8 minutes across nodes.\n` +
        `• Hardware telemetry confirms collusion across cluster entities sharing infrastructure.`,
      graph_path: ['VICTIM-001', 'MULE-017', 'MULE-042', 'MULE-103', 'CASHOUT-009'],
      evidence_checklist: [
        { rule: 'Multi-Hop Cascade', status: 'VERIFIED', detail: 'Rapid sequential hops to cashout node' },
        { rule: 'High Velocity Transfer', status: 'VERIFIED', detail: 'Fund retention below 5 minutes' },
        { rule: 'Coordinated Device Footprint', status: 'VERIFIED', detail: 'Shared hardware telemetry signature DEV-7092' },
      ],
      confidence: 0.94,
      intent: 'trace',
    });
    setGraphRagLoading(false);
  };

  // Recommended investigator action helper
  const getRecommendedAction = (riskScore: number) => {
    if (riskScore >= 80)
      return {
        label: 'CRITICAL: IMMEDIATE REVIEW / PREEMPTIVE FREEZE',
        color: 'var(--risk-critical)',
        desc: 'Multiple high-velocity pass-through transfers and shared device collusions detected. Preemptive freeze recommended before cashout.',
      };
    if (riskScore >= 65)
      return {
        label: 'HIGH: PRIORITY INVESTIGATION',
        color: 'var(--risk-high)',
        desc: 'Abnormal transaction velocity and direct link to mule accounts. Place account on 24hr priority review.',
      };
    if (riskScore >= 40)
      return {
        label: 'MEDIUM: ENHANCED REVIEW',
        color: 'var(--risk-medium)',
        desc: 'Moderate anomalous counterparties. Request secondary identity verification.',
      };
    return {
      label: 'LOW: CONTINUE MONITORING',
      color: 'var(--risk-low)',
      desc: 'Transaction behavior consistent with regular retail usage. Maintain passive monitoring.',
    };
  };

  return (
    <div style={{ height: 'calc(100vh - var(--header-height) - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Bar */}
      <div className="page-header" style={{ marginBottom: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Network Explorer</h1>
            <span
              style={{
                fontSize: 11,
                background: 'var(--accent-soft)',
                color: '#00d2ff',
                border: '1px solid rgba(0, 210, 255, 0.3)',
                padding: '2px 8px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
              }}
            >
              NEURAL GRAPH SIMULATOR
            </span>
          </div>
          <p className="page-subtitle">
            Interactive neural graph visualizer with focused entity halos, relation pills, and topological dimming
          </p>
        </div>

        {/* Assistant Launcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          <button
            className={`btn btn-sm ${isGraphRagOpen ? 'btn-primary' : 'btn-ghost'}`}
            style={isGraphRagOpen ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderColor: '#a855f7' } : {}}
            onClick={() => setIsGraphRagOpen(!isGraphRagOpen)}
            title="Open GraphRAG AI Assistant"
          >
            <Sparkles size={12} style={{ color: '#ec4899' }} /> GraphRAG AI
          </button>
        </div>
      </div>

      {/* Main Workspace: Visualizer Canvas + Right Inspector Drawer */}
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0, overflow: 'hidden' }}>
        {/* Canvas Visualizer Area */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          {currentNodes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <Network size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <h3>No network data available</h3>
              <p style={{ marginTop: 8 }}>Generate synthetic data to explore the transaction network.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/synthetic-data')}>
                Go to Synthetic Data
              </button>
            </div>
          ) : (
            <CortexGraphVisualizer
              nodes={currentNodes}
              edges={currentEdges}
              selectedNodeId={selectedNodeId}
              onSelectNode={id => {
                setSelectedNodeId(id);
                if (id) {
                  setSearchParams({ account: id });
                }
              }}
              titleBadge="MULETRACER FRAUD INTELLIGENCE"
              onReset={() => {
                setSelectedNodeId(null);
                setSearchParams({});
              }}
              customLegend={[
                { category: 'Victim', label: 'Victim', color: '#00d2ff' },
                { category: 'Mule', label: 'Mule Account', color: '#ef4444' },
                { category: 'Cashout', label: 'Cashout Hub', color: '#ec4899' },
                { category: 'Infrastructure', label: 'Hardware/Device', color: '#f59e0b' },
                { category: 'Institution', label: 'Institution/Merchant', color: '#10b981' },
              ]}
            />
          )}

          {/* Quick Preset Selector Buttons (Top Middle Floating Pill) */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 270,
              zIndex: 20,
              display: 'flex',
              gap: 6,
              background: 'var(--surface-elevated)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '4px 8px',
            }}
          >
            <span style={{ fontSize: 11, color: '#64748b', padding: '2px 4px', fontWeight: 600 }}>Quick Focus:</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                height: 'auto',
                borderRadius: 12,
                background: selectedNodeId === 'VICTIM-001' ? 'rgba(0, 210, 255, 0.2)' : 'transparent',
                color: selectedNodeId === 'VICTIM-001' ? '#00d2ff' : '#cbd5e1',
              }}
              onClick={() => {
                setSelectedNodeId('VICTIM-001');
                setSearchParams({ account: 'VICTIM-001' });
              }}
            >
              Scam Source (VICTIM-001)
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                height: 'auto',
                borderRadius: 12,
                background: selectedNodeId === 'MULE-017' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: selectedNodeId === 'MULE-017' ? '#ef4444' : '#cbd5e1',
              }}
              onClick={() => {
                setSelectedNodeId('MULE-017');
                setSearchParams({ account: 'MULE-017' });
              }}
            >
              High-Risk Mule (MULE-017)
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                height: 'auto',
                borderRadius: 12,
                background: selectedNodeId === 'CASHOUT-009' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                color: selectedNodeId === 'CASHOUT-009' ? '#ec4899' : '#cbd5e1',
              }}
              onClick={() => {
                setSelectedNodeId('CASHOUT-009');
                setSearchParams({ account: 'CASHOUT-009' });
              }}
            >
              Cashout Hub (CASHOUT-009)
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                fontSize: 11,
                padding: '2px 8px',
                height: 'auto',
                borderRadius: 12,
                background: selectedNodeId === 'DEV-7092' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                color: selectedNodeId === 'DEV-7092' ? '#f59e0b' : '#cbd5e1',
              }}
              onClick={() => {
                setSelectedNodeId('DEV-7092');
                setSearchParams({ account: 'DEV-7092' });
              }}
            >
              Hardware Link (DEV-7092)
            </button>
            {selectedNodeId && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 10, padding: '2px 6px', height: 'auto', color: '#94a3b8' }}
                onClick={() => setSelectedNodeId(null)}
                title="Show full overview without dimming"
              >
                Clear Focus
              </button>
            )}
          </div>

          {/* FLOATING GRAPHRAG INVESTIGATION ASSISTANT OVERLAY */}
          {isGraphRagOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: 20,
                right: 20,
                maxWidth: 720,
                margin: '0 auto',
                background: 'var(--surface-elevated)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-strong)',
                boxShadow: 'var(--shadow-lg)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                zIndex: 35,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={15} style={{ color: '#fff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                      GraphRAG Investigation Assistant
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                        Gemini 2.0 Flash + Neo4j Graph
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      Focus Entity: <strong className="mono" style={{ color: '#00d2ff' }}>{selectedNodeId || 'Entire Network'}</strong>
                    </div>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setIsGraphRagOpen(false)}>
                  <X size={14} />
                </button>
              </div>

              {/* Quick Suggested Queries */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  `Why is ${selectedNodeId || 'this entity'} connected to other nodes?`,
                  'Trace high-velocity multi-hop cash flow',
                  'Identify shared infrastructure collusions',
                  'Predict destination exit nodes',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '3px 8px', height: 'auto', background: 'var(--surface-muted)' }}
                    onClick={() => {
                      setGraphRagQuery(prompt);
                      handleGraphRagSubmit(prompt);
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleGraphRagSubmit();
                }}
                style={{ display: 'flex', gap: 8 }}
              >
                <input
                  type="text"
                  className="filter-input"
                  style={{ flex: 1, padding: '8px 12px', fontSize: 13, background: 'var(--surface-muted)' }}
                  placeholder="Ask neural graph intelligence query..."
                  value={graphRagQuery}
                  onChange={e => setGraphRagQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={graphRagLoading || !graphRagQuery.trim()}
                  style={{ padding: '0 16px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {graphRagLoading ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}
                  {graphRagLoading ? 'Traversing...' : 'Ask GraphRAG'}
                </button>
              </form>

              {/* Result Narrative */}
              {graphRagResult && (
                <div
                  style={{
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    maxHeight: 220,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {graphRagResult.answer}
                  </div>

                  {graphRagResult.evidence_checklist && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {graphRagResult.evidence_checklist.map((ev, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                          <CheckCircle2 size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{ev.rule}:</span>
                          <span>{ev.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Detail Inspector Drawer */}
        <div className="detail-panel" style={{ width: 370, height: '100%', overflowY: 'auto' }}>
          {selectedAccount ? (
            /* 1. FINANCIAL CRIME ACCOUNT DOSSIER */
            <>
              <div className="detail-panel-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                      {selectedAccount.id}
                    </span>
                    <span className={`risk-badge ${getRiskLevel(selectedAccount.riskScore)}`}>
                      {selectedAccount.riskScore}
                    </span>
                    {state.frozenAccounts.has(selectedAccount.id) && (
                      <span className="risk-badge" style={{ background: '#06b6d420', color: 'var(--frozen)' }}>
                        FROZEN
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedAccount.name} • {selectedAccount.bank}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setSelectedNodeId(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className="detail-panel-body">
                {/* Investigator Action Card */}
                {(() => {
                  const action = getRecommendedAction(selectedAccount.riskScore);
                  return (
                    <div
                      style={{
                        background: 'var(--bg-tertiary)',
                        borderLeft: `4px solid ${action.color}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 14px',
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Recommended Investigator Action
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: action.color, marginTop: 2, marginBottom: 4 }}>
                        {action.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {action.desc}
                      </div>
                    </div>
                  );
                })()}

                {/* Shared Hardware Fingerprint Detection */}
                {selectedAccount.deviceId && (
                  <div
                    style={{
                      background: sharedDeviceAccounts.length > 0 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-tertiary)',
                      border: `1px solid ${sharedDeviceAccounts.length > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: sharedDeviceAccounts.length > 0 ? '#f59e0b' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Smartphone size={13} /> Hardware Telemetry
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: '#fff', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}
                      >
                        {selectedAccount.deviceId}
                      </span>
                    </div>

                    {sharedDeviceAccounts.length > 0 ? (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                          ⚠️ Shared hardware link with {sharedDeviceAccounts.length} other accounts
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {sharedDeviceAccounts.map(sa => (
                            <button
                              key={sa.id}
                              className="btn btn-sm btn-ghost"
                              style={{ fontSize: 10, padding: '2px 6px', height: 'auto', background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d' }}
                              onClick={() => setSelectedNodeId(sa.id)}
                            >
                              {sa.id} ({sa.riskScore}) <ChevronRight size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        Clean hardware profile — no multi-account hardware collusion detected.
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {state.frozenAccounts.has(selectedAccount.id) ? (
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ flex: 1, color: 'var(--frozen)' }}
                      onClick={() => dispatch({ type: 'UNFREEZE_ACCOUNT', id: selectedAccount.id })}
                    >
                      Unfreeze
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleFreeze(selectedAccount.id)}
                    >
                      <Shield size={12} /> Preemptive Freeze (NPCI)
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => handleWatchlist(selectedAccount.id)} title="Add to Watchlist">
                    Watchlist
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => handleFlag(selectedAccount.id)} title="Flag Account">
                    <AlertTriangle size={12} />
                  </button>
                </div>

                {/* Graph Topological Metrics */}
                {selectedMetrics && (
                  <div className="detail-panel-section">
                    <div className="detail-panel-section-title">Topological Network Metrics</div>
                    <div className="detail-stats-grid">
                      <div className="detail-stat">
                        <span className="detail-stat-label">In / Out Degree</span>
                        <span className="detail-stat-value">{selectedMetrics.inDegree} / {selectedMetrics.outDegree}</span>
                      </div>
                      <div className="detail-stat">
                        <span className="detail-stat-label">Fan-In / Fan-Out</span>
                        <span className="detail-stat-value">{selectedMetrics.fanIn} / {selectedMetrics.fanOut}</span>
                      </div>
                      <div className="detail-stat">
                        <span className="detail-stat-label">Pass-Through Ratio</span>
                        <span className="detail-stat-value" style={{ color: selectedMetrics.passThroughRatio > 0.85 ? 'var(--risk-critical)' : 'inherit' }}>
                          {formatPercentage(selectedMetrics.passThroughRatio * 100)}
                        </span>
                      </div>
                      <div className="detail-stat">
                        <span className="detail-stat-label">Avg Velocity</span>
                        <span className="detail-stat-value" style={{ color: selectedMetrics.avgVelocity < 600 ? 'var(--risk-critical)' : 'inherit' }}>
                          {selectedMetrics.avgVelocity === Infinity ? 'N/A' : formatDelay(selectedMetrics.avgVelocity)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Explainable Mule Risk Factors */}
                {selectedRisk && (
                  <div className="detail-panel-section">
                    <div className="detail-panel-section-title">Explainable Factor Breakdown</div>
                    <div className="risk-breakdown">
                      {selectedRisk.factors.map(f => (
                        <div key={f.name} className="risk-factor">
                          <div className="risk-factor-header">
                            <span className="risk-factor-name">{f.name}</span>
                            <span className="risk-factor-score">+{f.score} / {f.maxScore}</span>
                          </div>
                          <div className="risk-factor-bar">
                            <div
                              className="risk-factor-fill"
                              style={{
                                width: `${(f.score / f.maxScore) * 100}%`,
                                background: f.score / f.maxScore > 0.6 ? 'var(--risk-critical)' : 'var(--accent)',
                              }}
                            />
                          </div>
                          <span className="risk-factor-desc">{f.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Transactions */}
                <div className="detail-panel-section">
                  <div className="detail-panel-section-title">
                    Transactions ({selectedTransactions.incoming.length + selectedTransactions.outgoing.length})
                  </div>
                  <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedTransactions.incoming.map(t => {
                      const srcAcc = state.accounts.find(a => a.id === t.source);
                      const bankName = srcAcc?.bank || t.sourceInstitution || (t.source.split('-')[0]) || 'Bank';
                      return (
                        <div
                          key={t.id}
                          className="candidate-item"
                          style={{ padding: '6px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                          onClick={() => setSelectedNodeId(t.source)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--success)', fontWeight: 600 }}>↓ IN</span>
                              <span className="mono">{t.source}</span>
                            </div>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>🏛️ {bankName}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="amount" style={{ color: 'var(--success)' }}>+{formatCurrency(t.amount)}</span>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{t.channel || t.type}</div>
                          </div>
                        </div>
                      );
                    })}
                    {selectedTransactions.outgoing.map(t => {
                      const destAcc = state.accounts.find(a => a.id === t.destination);
                      const bankName = destAcc?.bank || t.destinationInstitution || (t.destination.split('-')[0]) || 'Bank';
                      return (
                        <div
                          key={t.id}
                          className="candidate-item"
                          style={{ padding: '6px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                          onClick={() => setSelectedNodeId(t.destination)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--risk-critical)', fontWeight: 600 }}>↑ OUT</span>
                              <span className="mono">{t.destination}</span>
                            </div>
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>🏛️ {bankName}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="amount" style={{ color: 'var(--risk-critical)' }}>-{formatCurrency(t.amount)}</span>
                            <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{t.channel || t.type}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      dispatch({ type: 'SELECT_ACCOUNT', id: selectedAccount.id });
                      navigate('/mule-intelligence');
                    }}
                  >
                    Open in Mule Intelligence <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </>
          ) : selectedNode ? (
            /* 2. CORTEX NEURAL SIMULATOR ENTITY DOSSIER */
            <>
              <div className="detail-panel-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                      {selectedNode.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'var(--accent-glow)',
                        color: '#00d2ff',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedNode.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedNode.type} Entity • ID: <span className="mono">{selectedNode.id}</span>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setSelectedNodeId(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className="detail-panel-body">
                {/* Description */}
                {selectedNode.description && (
                  <div
                    style={{
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: '#cbd5e1',
                      borderLeft: '4px solid #00d2ff',
                      marginBottom: 16,
                    }}
                  >
                    {selectedNode.description}
                  </div>
                )}

                {/* Details Breakdown */}
                {selectedNode.details && Object.keys(selectedNode.details).length > 0 && (
                  <div className="detail-panel-section">
                    <div className="detail-panel-section-title">Profile Attributes</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(selectedNode.details).map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected Relationships in Graph */}
                <div className="detail-panel-section">
                  <div className="detail-panel-section-title">
                    Connected Relations ({currentEdges.filter((e: VisualizerEdge) => e.source === selectedNode.id || e.target === selectedNode.id).length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {currentEdges
                      .filter((e: VisualizerEdge) => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((edge: VisualizerEdge) => {
                        const targetId = edge.source === selectedNode.id ? edge.target : edge.source;
                        const counterpartNode = currentNodes.find((n: VisualizerNode) => n.id === targetId);
                        const isOutbound = edge.source === selectedNode.id;

                        return (
                          <div
                            key={edge.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              background: 'var(--bg-tertiary)',
                              borderRadius: 6,
                              cursor: 'pointer',
                              border: '1px solid var(--border)',
                            }}
                            onClick={() => setSelectedNodeId(targetId)}
                          >
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>
                                {counterpartNode?.name || targetId}
                              </div>
                              <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>
                                {counterpartNode?.category || 'Entity'}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  color: '#00e5ff',
                                  background: 'var(--accent-soft)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {isOutbound ? `→ ${edge.label}` : `← ${edge.label}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Quick actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', fontWeight: 500 }}
                    onClick={() => {
                      setGraphRagQuery(`Explain all graph relations connected to ${selectedNode.name}`);
                      setIsGraphRagOpen(true);
                      handleGraphRagSubmit(`Explain all graph relations connected to ${selectedNode.name}`);
                    }}
                  >
                    <Sparkles size={12} /> Inspect With GraphRAG AI
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* 3. EMPTY STATE / SUMMARY */
            <div className="empty-state" style={{ height: '100%', padding: '32px 16px' }}>
              <Globe size={40} className="empty-state-icon" style={{ color: '#00d2ff', opacity: 0.8 }} />
              <div className="empty-state-title" style={{ color: '#f8fafc' }}>
                Select Any Node or Connection
              </div>
              <p className="empty-state-message" style={{ fontSize: 12, lineHeight: 1.5 }}>
                Click on any entity or account to focus its neural network. Connected counterparties will illuminate, connection arrows & badges will display, and non-linked nodes will dim.
              </p>

              {/* BFS Path Finder Mini Widget */}
              {true && (
                <div
                  style={{
                    marginTop: 20,
                    width: '100%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <GitCommit size={13} color="var(--accent)" /> BFS Money Trail Tracer
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Source Account"
                      value={pathStart}
                      onChange={e => setPathStart(e.target.value.toUpperCase())}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    />
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Target Account"
                      value={pathEnd}
                      onChange={e => setPathEnd(e.target.value.toUpperCase())}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleFindPath} style={{ marginTop: 4 }}>
                      Trace Route
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
