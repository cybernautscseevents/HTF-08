import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatCurrencyFull, formatTime, formatDelay, formatPercentage, formatRelativeTime, getAccountTypeLabel } from '../utils/formatters';
import { getRiskLevel, getRiskColor, calculateMuleRisk } from '../engine/riskEngine';
import { findNextHopCandidates } from '../engine/nextHopEngine';
import { traceMoneyTrail } from '../engine/trailEngine';
import { calculateGraphMetrics } from '../engine/graphEngine';
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, Zap, Shield, X, AlertTriangle,
  ChevronDown, ChevronRight, Snowflake, Eye, Flag, ArrowRight, Target, Clock,
  TrendingDown, FileText, Download, MessageSquare, Send, Smartphone, Check, Copy
} from 'lucide-react';
import { fetchCaseTrail, fetchCaseNotes, postCaseNote, exportCaseSummary, updateCaseStatus } from '../services/api';
import { CaseNote } from '../types';

export default function MoneyTrail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState<string | null>(null);
  const playRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  // Investigator Notes & Dossier Export States
  const [activeTab, setActiveTab] = useState<'entity' | 'notes'>('entity');
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [authorName, setAuthorName] = useState('S. Krishnan (Lead AML Analyst)');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportedDossier, setExportedDossier] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);
  const [currentCaseStatus, setCurrentCaseStatus] = useState<string>('investigating');

  const trail = state.trailData;
  const scamCase = trail ? state.cases.find(c => c.id === trail.caseId) : null;

  // Load trail for case from backend or fallback to local
  useEffect(() => {
    if (caseId) {
      fetchCaseTrail(caseId).then(data => {
        if (data && data.trail) {
          const mappedTrail = {
            caseId: data.case_id || caseId,
            steps: data.trail.map((step: any) => ({
              hopNumber: step.hop,
              fromAccount: step.from_account,
              toAccount: step.to_account,
              transactionId: step.transaction_id,
              amount: step.amount,
              timestamp: step.timestamp,
              delay: step.delay_seconds,
              amountRetention: step.amount_retention,
              riskScore: step.risk_score
            })),
            totalAmount: data.initial_amount,
            totalLoss: data.initial_amount - data.total_traced_amount,
            totalHops: data.hops,
            totalDuration: data.total_duration_seconds,
            predictedNextHop: data.probable_next_hop ? {
              accountId: data.probable_next_hop.account_id,
              confidence: data.probable_next_hop.confidence,
              reasons: data.probable_next_hop.reasons || [],
              patternScore: data.probable_next_hop.pattern_score,
              expectedAmount: data.probable_next_hop.amount || 0,
              estimatedDelay: data.probable_next_hop.delay_seconds || 0,
              reason: data.probable_next_hop.reasons ? data.probable_next_hop.reasons[0] : '',
              alternatives: []
            } : null
          };
          dispatch({ type: 'SET_TRAIL', trail: mappedTrail });
        } else {
          dispatch({ type: 'LOAD_TRAIL', caseId });
        }
      });
    } else if (state.cases.length > 0) {
      // Auto-load first critical case if navigated to /trail directly
      const criticalCase = state.cases.find(c => c.riskScore >= 90) || state.cases[0];
      navigate(`/trail/${criticalCase.id}`);
    }
  }, [caseId, dispatch, state.cases, navigate]);

  // Load case notes
  useEffect(() => {
    const targetCaseId = trail?.caseId || caseId;
    if (targetCaseId) {
      fetchCaseNotes(targetCaseId).then(notes => {
        if (notes && notes.length > 0) setCaseNotes(notes);
      });
    }
  }, [trail?.caseId, caseId]);

  // Timeline play/pause
  useEffect(() => {
    if (playing && trail) {
      playRef.current = window.setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= trail.steps.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, trail]);

  // Selected account data with fallback for dynamic trail accounts
  const selectedAccount = selectedNodeId ? (state.accounts.find(a => a.id === selectedNodeId) || {
    id: selectedNodeId,
    name: (selectedNodeId.toUpperCase().includes('MULE') || selectedNodeId.toUpperCase().startsWith('M-') || selectedNodeId.toUpperCase().startsWith('M0')) ? 'Identified Mule Account' : 'Network Account',
    bank: 'Interbank Node',
    accountType: (selectedNodeId.toUpperCase().includes('VICTIM') || selectedNodeId.toUpperCase().startsWith('V-')) ? 'victim' : (selectedNodeId.toUpperCase().includes('CASHOUT') ? 'cashout' : 'mule'),
    riskScore: 88,
    status: 'critical' as const,
    deviceId: 'DEV-7092',
    firstSeen: '2026-10-07T10:00:00Z',
    transactionCount: 38,
    totalIncoming: 350000,
    totalOutgoing: 340000,
    inDegree: 5,
    outDegree: 6
  }) : null;
  const selectedRisk = selectedAccount ? calculateMuleRisk(selectedAccount, state.transactions, state.accounts) : null;
  const selectedMetrics = selectedNodeId ? calculateGraphMetrics(selectedNodeId, state.transactions, state.accounts.length) : null;
  const selectedNextHop = selectedNodeId ? findNextHopCandidates(selectedNodeId, state.transactions, state.accounts) : null;

  // Get all unique accounts in the trail
  const trailAccounts = useMemo(() => {
    if (!trail) return [];
    const ids = new Set<string>();
    trail.steps.forEach(s => { ids.add(s.fromAccount); ids.add(s.toAccount); });
    return Array.from(ids).map(id => state.accounts.find(a => a.id === id)).filter(Boolean);
  }, [trail, state.accounts]);

  // Canvas graph drawing with 60fps particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !trail) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Gather trail nodes in sequential order
      const allIds: string[] = [];
      trail.steps.forEach(s => {
        if (!allIds.includes(s.fromAccount)) allIds.push(s.fromAccount);
        if (!allIds.includes(s.toAccount)) allIds.push(s.toAccount);
      });

      // Include predicted next-hop account on canvas if available
      const predictedNextHopId = trail.predictedNextHop?.accountId;
      const hasPredictedNextHop = predictedNextHopId && !allIds.includes(predictedNextHopId);
      if (hasPredictedNextHop && predictedNextHopId) {
        allIds.push(predictedNextHopId);
      }

      const totalNodes = allIds.length;
      const marginX = 90;
      const stepX = (w - 2 * marginX) / Math.max(totalNodes - 1, 1);
      const time = performance.now() / 1000;

      // Calculate node positions with subtle wave layout
      const nodePositions: Record<string, { x: number; y: number }> = {};
      allIds.forEach((id, i) => {
        const x = marginX + i * stepX;
        const wave = Math.sin(i * 0.95) * 32;
        const y = h / 2 + wave;
        nodePositions[id] = { x, y };
      });

      // 1. Draw Regular Trail Edges (Curved Bezier Paths)
      trail.steps.forEach((step, i) => {
        const from = nodePositions[step.fromAccount];
        const to = nodePositions[step.toAccount];
        if (!from || !to) return;

        const isPastOrActive = currentStep === -1 || currentStep >= i;
        const isCurrentStep = currentStep === i;

        // Quadratic curve control point (graceful arc above straight line)
        const cpX = (from.x + to.x) / 2;
        const cpY = (from.y + to.y) / 2 - 28;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);

        if (isCurrentStep) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([]);
          ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
          ctx.shadowBlur = 8;
        } else if (isPastOrActive) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = '#33415550';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);

        // Animated money particles flowing along the active edge!
        if (isPastOrActive) {
          const particleCount = isCurrentStep ? 3 : 2;
          for (let p = 0; p < particleCount; p++) {
            const t = (time * 0.45 + (p / particleCount) + (i * 0.2)) % 1;
            // Quadratic Bezier formula
            const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cpX + t * t * to.x;
            const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cpY + t * t * to.y;

            ctx.save();
            ctx.beginPath();
            ctx.arc(px, py, isCurrentStep ? 4 : 3, 0, Math.PI * 2);
            ctx.fillStyle = isCurrentStep ? '#93c5fd' : '#60a5fa';
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = isCurrentStep ? 12 : 8;
            ctx.fill();
            ctx.restore();
          }
        }

        // Arrow head near destination
        const arrowDist = 26;
        const tNearEnd = 0.88;
        const arrowX = (1 - tNearEnd) * (1 - tNearEnd) * from.x + 2 * (1 - tNearEnd) * tNearEnd * cpX + tNearEnd * tNearEnd * to.x;
        const arrowY = (1 - tNearEnd) * (1 - tNearEnd) * from.y + 2 * (1 - tNearEnd) * tNearEnd * cpY + tNearEnd * tNearEnd * to.y;
        const angle = Math.atan2(to.y - arrowY, to.x - arrowX);

        ctx.save();
        ctx.translate(to.x - Math.cos(angle) * arrowDist, to.y - Math.sin(angle) * arrowDist);
        ctx.rotate(angle);
        ctx.fillStyle = isCurrentStep ? '#3b82f6' : isPastOrActive ? 'rgba(59, 130, 246, 0.7)' : '#334155';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-7, -4);
        ctx.lineTo(-7, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Edge label (Pill badge showing amount and velocity)
        if (isPastOrActive) {
          const pillX = cpX;
          const pillY = cpY - 6;
          const text = `₹${step.amount.toLocaleString('en-IN')}`;

          ctx.font = '600 11px "JetBrains Mono", monospace';
          const textWidth = ctx.measureText(text).width;
          const pillW = textWidth + 14;
          const pillH = 18;

          // Glass pill background
          ctx.fillStyle = isDark ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.9)';
          ctx.strokeStyle = isCurrentStep ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(pillX - pillW / 2, pillY - pillH / 2, pillW, pillH, 9);
          ctx.fill();
          ctx.stroke();

          // Amount text
          ctx.fillStyle = isCurrentStep ? (isDark ? '#93c5fd' : '#2563eb') : (isDark ? '#f1f5f9' : '#0f172a');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, pillX, pillY);

          // Delay badge below
          if (step.delay > 0) {
            ctx.font = '500 9px Inter, sans-serif';
            ctx.fillStyle = '#f59e0b';
            ctx.fillText(`+${formatDelay(step.delay)}`, pillX, pillY + 16);
          }
        }
      });

      // 2. Draw Predicted Next Hop Dashed Edge & Warning Particles
      if (hasPredictedNextHop && predictedNextHopId) {
        const lastStep = trail.steps[trail.steps.length - 1];
        if (lastStep) {
          const from = nodePositions[lastStep.toAccount];
          const to = nodePositions[predictedNextHopId];
          if (from && to) {
            const cpX = (from.x + to.x) / 2;
            const cpY = (from.y + to.y) / 2 - 28;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
            ctx.setLineDash([6, 5]);
            ctx.lineDashOffset = -time * 24;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.restore();

            // Next-Hop Hazard Particles
            for (let p = 0; p < 2; p++) {
              const t = (time * 0.55 + p * 0.5) % 1;
              const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cpX + t * t * to.x;
              const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cpY + t * t * to.y;

              ctx.save();
              ctx.beginPath();
              ctx.arc(px, py, 3.5, 0, Math.PI * 2);
              ctx.fillStyle = '#f87171';
              ctx.shadowColor = '#ef4444';
              ctx.shadowBlur = 10;
              ctx.fill();
              ctx.restore();
            }

            // Next Hop Predictive Label Badge
            const pillX = cpX;
            const pillY = cpY - 6;
            const badgeText = `⚡ PREDICTED NEXT HOP`;

            ctx.font = '700 9px Inter, sans-serif';
            const textWidth = ctx.measureText(badgeText).width;
            const pillW = textWidth + 14;
            const pillH = 18;

            ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(pillX - pillW / 2, pillY - pillH / 2, pillW, pillH, 9);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fca5a5';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, pillX, pillY);
          }
        }
      }

      // 3. Draw All Nodes
      allIds.forEach((id, i) => {
        const pos = nodePositions[id];
        const account = state.accounts.find(a => a.id === id);
        const radius = 22;
        const isPredicted = id === predictedNextHopId;

        const isCurrentNode = currentStep >= 0 && trail.steps[currentStep]?.toAccount === id;
        const isSelected = selectedNodeId === id;
        const isHovered = hoveredNodeId === id;
        const isFrozen = state.frozenAccounts.has(id);

        // Determine node classification with complete fallback for any account format (e.g. m-001, m002, m003, MULE-*)
        const idUpper = id.toUpperCase();
        let nodeType: 'victim' | 'mule' | 'cashout' = 'mule';
        if (
          account?.accountType === 'victim' ||
          idUpper.includes('VICTIM') ||
          idUpper.startsWith('V-') ||
          idUpper.startsWith('V0') ||
          (trail.steps.length > 0 && trail.steps[0].fromAccount === id)
        ) {
          nodeType = 'victim';
        } else if (
          account?.accountType === 'cashout' ||
          idUpper.includes('CASHOUT') ||
          idUpper.startsWith('CO-') ||
          idUpper.startsWith('C-')
        ) {
          nodeType = 'cashout';
        } else {
          // In money trail, accounts like m-001, m002, m003, MULE-*, etc. are all mules
          nodeType = 'mule';
        }

        // A. Predicted Next Hop Radar Beacons (Expanding concentric pulse rings)
        if (isPredicted) {
          const radarPhase = (time * 0.9) % 1;
          const ringRadius = radius + radarPhase * 24;
          const alpha = 1 - radarPhase;

          ctx.save();
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.7})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // B. Active or Selected Node Halo Glow
        if (isCurrentNode || isSelected || isHovered) {
          const glowGrad = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, radius + 16);
          
          let glowColor = '#ef4444';
          if (isFrozen) glowColor = '#06b6d4';
          else if (nodeType === 'victim') glowColor = '#3b82f6';
          else if (nodeType === 'mule') glowColor = '#ef4444';
          else if (nodeType === 'cashout') glowColor = '#ec4899';
          
          glowGrad.addColorStop(0, `${glowColor}55`);
          glowGrad.addColorStop(1, 'transparent');

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, radius + 16, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        // C. Node Outer Ring & Fill
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

        let fillColor = isDark ? '#1a2236' : '#f8fafc';
        let strokeColor = isDark ? '#334155' : '#cbd5e1';

        if (isFrozen) {
          fillColor = isDark ? '#083344' : '#cffafe';
          strokeColor = isDark ? '#06b6d4' : '#0891b2';
        } else if (isPredicted) {
          fillColor = isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2';
          strokeColor = isDark ? '#ef4444' : '#dc2626';
        } else if (nodeType === 'victim') {
          // Blue circle for Victim (matching victim blue theme)
          fillColor = isDark ? '#1e1b4b' : '#e0e7ff';
          strokeColor = isDark ? '#818cf8' : '#4f46e5';
        } else if (nodeType === 'mule') {
          // Vivid Red circle for Mule accounts (m-001, m002, m003, MULE-*, etc.)
          fillColor = isDark ? 'rgba(239, 68, 68, 0.22)' : '#fee2e2';
          strokeColor = isDark ? '#ef4444' : '#dc2626';
        } else if (nodeType === 'cashout') {
          fillColor = isDark ? '#500724' : '#fce7f3';
          strokeColor = isDark ? '#ec4899' : '#db2777';
        }

        if (isSelected) {
          strokeColor = nodeType === 'mule' ? (isDark ? '#f87171' : '#b91c1c') : (nodeType === 'victim' ? '#3b82f6' : '#ec4899');
        } else if (isCurrentNode) {
          if (nodeType === 'victim') strokeColor = isDark ? '#3b82f6' : '#2563eb';
          else if (nodeType === 'mule') strokeColor = isDark ? '#ef4444' : '#dc2626';
          else if (nodeType === 'cashout') strokeColor = isDark ? '#ec4899' : '#db2777';
          else strokeColor = isDark ? '#ef4444' : '#dc2626';
        }

        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.lineWidth = isSelected || isCurrentNode || isPredicted || isFrozen ? 3.5 : 2.5;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();

        // D. Node Label (Short format: e.g. M-001 or V-001)
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let shortLabel = id;
        if (/^VICTIM-/i.test(shortLabel)) shortLabel = shortLabel.replace(/^VICTIM-/i, 'V-');
        else if (/^MULE-/i.test(shortLabel)) shortLabel = shortLabel.replace(/^MULE-/i, 'M-');
        else if (/^CASHOUT-/i.test(shortLabel)) shortLabel = shortLabel.replace(/^CASHOUT-/i, 'CO-');
        else if (/^ACC-/i.test(shortLabel)) shortLabel = shortLabel.replace(/^ACC-/i, '#');
        else if (/^M(\d+)/i.test(shortLabel) && !shortLabel.toUpperCase().startsWith('M-')) shortLabel = shortLabel.replace(/^M(\d+)/i, 'M-$1');
        ctx.fillText(shortLabel, pos.x, pos.y);

        // E. Account Holder Name Below Node
        const displayName = account ? account.name.split(' ')[0] : (nodeType === 'victim' ? 'Victim' : nodeType === 'cashout' ? 'Cashout' : 'Mule Node');
        const displayBank = account ? account.bank : (nodeType === 'victim' ? 'Payer Bank' : 'Interbank');

        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
        ctx.fillText(displayName, pos.x, pos.y + radius + 14);

        // Bank Pill Tag
        ctx.font = '500 9px Inter, sans-serif';
        ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
        ctx.fillText(displayBank, pos.x, pos.y + radius + 25);

        // F. Risk Score Badge (Top Right of Node)
        const riskScore = account?.riskScore || (isPredicted ? (trail.predictedNextHop?.confidence || 85) : (nodeType === 'mule' ? 88 : nodeType === 'cashout' ? 95 : 0)) || 0;
        if (riskScore >= 40) {
          const badgeX = pos.x + radius - 4;
          const badgeY = pos.y - radius + 4;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 8, 0, Math.PI * 2);
          ctx.fillStyle = isFrozen ? '#06b6d4' : riskScore >= 80 ? '#ef4444' : riskScore >= 60 ? '#f97316' : '#eab308';
          ctx.fill();

          ctx.font = '700 8px Inter, sans-serif';
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(riskScore.toString(), badgeX, badgeY + 1);
        }

        // G. Frozen Tag
        if (isFrozen) {
          const freezeTagY = pos.y - radius - 8;
          ctx.font = '700 8px Inter, sans-serif';
          ctx.fillStyle = '#06b6d4';
          ctx.fillText('❄ FROZEN', pos.x, freezeTagY);
        } else if (isPredicted) {
          const predTagY = pos.y - radius - 8;
          ctx.font = '700 8px Inter, sans-serif';
          ctx.fillStyle = '#ef4444';
          ctx.fillText(`TARGET ${trail.predictedNextHop?.confidence}%`, pos.x, predTagY);
        }
      });

      // 4. Draw Interactive Glassmorphic Hover Tooltip
      if (hoveredNodeId) {
        const hoverAcct = state.accounts.find(a => a.id === hoveredNodeId) || {
          id: hoveredNodeId,
          name: (hoveredNodeId.toUpperCase().includes('VICTIM') || hoveredNodeId.toUpperCase().startsWith('V-')) ? 'Victim Source' : (hoveredNodeId.toUpperCase().includes('CASHOUT') ? 'Cashout Endpoint' : 'Identified Mule Node'),
          bank: 'Interbank Node',
          accountType: (hoveredNodeId.toUpperCase().includes('VICTIM') || hoveredNodeId.toUpperCase().startsWith('V-')) ? 'victim' : (hoveredNodeId.toUpperCase().includes('CASHOUT') ? 'cashout' : 'mule'),
          riskScore: (hoveredNodeId.toUpperCase().includes('VICTIM') || hoveredNodeId.toUpperCase().startsWith('V-')) ? 5 : 88,
        };
        const hoverPos = nodePositions[hoveredNodeId];
        if (hoverAcct && hoverPos) {
          const tipW = 210;
          const tipH = 92;
          let tipX = hoverPos.x + 24;
          let tipY = hoverPos.y - tipH / 2;

          // Boundary constraints
          if (tipX + tipW > w - 16) tipX = hoverPos.x - tipW - 24;
          if (tipY < 16) tipY = 16;
          if (tipY + tipH > h - 16) tipY = h - tipH - 16;

          ctx.save();
          // Shadow and backdrop
          ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 18;
          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
          ctx.strokeStyle = hoverAcct.riskScore >= 70 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(59, 130, 246, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tipX, tipY, tipW, tipH, 8);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Content
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          // ID and Name
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
          ctx.fillText(hoverAcct.id, tipX + 12, tipY + 10);

          ctx.font = '500 11px Inter, sans-serif';
          ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
          ctx.fillText(`${hoverAcct.name} (${hoverAcct.bank})`, tipX + 12, tipY + 26);

          // Role and Risk
          ctx.font = '600 10px Inter, sans-serif';
          ctx.fillStyle = hoverAcct.accountType === 'mule' ? '#ef4444' : hoverAcct.accountType === 'cashout' ? '#ec4899' : '#818cf8';
          ctx.fillText(`Type: ${getAccountTypeLabel(hoverAcct.accountType as any)}`, tipX + 12, tipY + 44);

          ctx.fillStyle = hoverAcct.riskScore >= 75 ? '#ef4444' : '#eab308';
          ctx.fillText(`Risk Score: ${hoverAcct.riskScore}/100`, tipX + 110, tipY + 44);

          // Risk Bar
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.roundRect(tipX + 12, tipY + 60, tipW - 24, 4, 2);
          ctx.fill();

          ctx.fillStyle = hoverAcct.riskScore >= 75 ? '#ef4444' : hoverAcct.riskScore >= 50 ? '#f97316' : '#3b82f6';
          ctx.beginPath();
          ctx.roundRect(tipX + 12, tipY + 60, (tipW - 24) * (hoverAcct.riskScore / 100), 4, 2);
          ctx.fill();

          // Quick helper hint
          ctx.font = '500 9px Inter, sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.fillText('Click to inspect risk factors & freeze', tipX + 12, tipY + 72);

          ctx.restore();
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [trail, currentStep, selectedNodeId, hoveredNodeId, state.accounts, state.frozenAccounts, isDark]);

  // Canvas Mouse Move Handler (for hover tooltips and pointer cursor)
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !trail) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y };

    const allIds: string[] = [];
    trail.steps.forEach(s => {
      if (!allIds.includes(s.fromAccount)) allIds.push(s.fromAccount);
      if (!allIds.includes(s.toAccount)) allIds.push(s.toAccount);
    });

    if (trail.predictedNextHop && !allIds.includes(trail.predictedNextHop.accountId)) {
      allIds.push(trail.predictedNextHop.accountId);
    }

    const marginX = 90;
    const stepX = (rect.width - 2 * marginX) / Math.max(allIds.length - 1, 1);

    let foundNode: string | null = null;
    for (let i = 0; i < allIds.length; i++) {
      const nx = marginX + i * stepX;
      const ny = rect.height / 2 + Math.sin(i * 0.95) * 32;
      const dist = Math.sqrt((x - nx) ** 2 + (y - ny) ** 2);
      if (dist <= 26) {
        foundNode = allIds[i];
        break;
      }
    }

    setHoveredNodeId(foundNode);
    canvas.style.cursor = foundNode ? 'pointer' : 'default';
  };

  const handleCanvasMouseLeave = () => {
    setHoveredNodeId(null);
  };

  // Canvas click handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !trail) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const allIds: string[] = [];
    trail.steps.forEach(s => {
      if (!allIds.includes(s.fromAccount)) allIds.push(s.fromAccount);
      if (!allIds.includes(s.toAccount)) allIds.push(s.toAccount);
    });

    if (trail.predictedNextHop && !allIds.includes(trail.predictedNextHop.accountId)) {
      allIds.push(trail.predictedNextHop.accountId);
    }

    const marginX = 90;
    const stepX = (rect.width - 2 * marginX) / Math.max(allIds.length - 1, 1);

    for (let i = 0; i < allIds.length; i++) {
      const nx = marginX + i * stepX;
      const ny = rect.height / 2 + Math.sin(i * 0.95) * 32;
      const dist = Math.sqrt((x - nx) ** 2 + (y - ny) ** 2);
      if (dist <= 26) {
        setSelectedNodeId(allIds[i]);
        return;
      }
    }
    setSelectedNodeId(null);
  };

  // Case selector when no trail
  if (!trail) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-title">Money Trail Investigation</h1>
            <p className="page-subtitle">Select a case to trace the money movement</p>
          </div>
        </div>

        <div className="demo-banner">
          <div className="demo-banner-text">
            <div className="demo-banner-title">🎯 Launch Demo Investigation</div>
            <div className="demo-banner-subtitle">Trace ₹50,000 through a digital arrest scam network — Case SC-001</div>
          </div>
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'LOAD_TRAIL', caseId: 'SC-001' })}>
            <Zap size={14} /> Launch Demo Case
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Available Cases</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.cases.map(c => (
                <tr key={c.id} onClick={() => dispatch({ type: 'LOAD_TRAIL', caseId: c.id })}>
                  <td className="mono">{c.id}</td>
                  <td>{c.type}</td>
                  <td className="amount">{formatCurrency(c.amount)}</td>
                  <td><span className={`risk-badge ${getRiskLevel(c.riskScore)}`}>{c.riskScore}</span></td>
                  <td>{c.status}</td>
                  <td><button className="btn btn-primary btn-sm"><Zap size={12} /> Trace</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const handleFreeze = (accountId: string) => {
    dispatch({ type: 'FREEZE_ACCOUNT', id: accountId });
    setShowFreezeModal(null);
    dispatch({
      type: 'ADD_TOAST',
      toast: { id: `freeze-${Date.now()}`, message: `STATUS: FREEZE REVIEW INITIATED — ${accountId} (Simulated bank action)`, type: 'warning' }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 48px)' }}>
      {/* Trail Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={18} style={{ color: 'var(--accent)' }} />
            Money Trail — {trail.caseId}
            {scamCase && <span className={`risk-badge ${getRiskLevel(scamCase.riskScore)}`}>{scamCase.type}</span>}
          </h1>
          <p className="page-subtitle">
            {trail.totalHops} hops • {formatCurrencyFull(trail.totalAmount)} initial → {formatCurrencyFull(trail.steps[trail.steps.length - 1]?.amount || 0)} at last hop • {trail.totalDuration}s total duration
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Case Status Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Status:</span>
            <select
              className="filter-select"
              value={currentCaseStatus}
              onChange={async (e) => {
                const newStatus = e.target.value;
                setCurrentCaseStatus(newStatus);
                await updateCaseStatus(trail.caseId, newStatus);
                dispatch({
                  type: 'ADD_TOAST',
                  toast: { id: Date.now().toString(), message: `Case ${trail.caseId} status updated to ${newStatus.toUpperCase()}`, type: 'info' }
                });
              }}
              style={{ fontSize: 11, padding: '2px 6px', height: 'auto', background: 'transparent', border: 'none', color: '#fff', fontWeight: 600 }}
            >
              <option value="open">OPEN</option>
              <option value="investigating">INVESTIGATING</option>
              <option value="escalated">ESCALATED</option>
              <option value="resolved">RESOLVED</option>
            </select>
          </div>

          {/* Export Dossier Button */}
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              setIsExporting(true);
              const summary = await exportCaseSummary(trail.caseId);
              setExportedDossier(summary);
              setShowExportModal(true);
              setIsExporting(false);
            }}
            disabled={isExporting}
          >
            <FileText size={12} /> {isExporting ? 'Generating...' : 'Export Dossier'}
          </button>

          <button className="btn btn-ghost btn-sm" onClick={() => { dispatch({ type: 'SET_TRAIL', trail: null }); setCurrentStep(-1); setPlaying(false); setSelectedNodeId(null); }}>
            <X size={12} /> Close Trail
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 16, minHeight: 0 }}>
        {/* Left: Graph + Timeline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Graph */}
          <div className="graph-container" style={{ flex: 1, minHeight: 250 }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%' }}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
            />
            <div className="graph-legend">
              <div className="graph-legend-item"><div className="graph-legend-dot" style={{ background: '#3b82f6' }} /> Victim</div>
              <div className="graph-legend-item"><div className="graph-legend-dot" style={{ background: '#ef4444' }} /> Mule</div>
              <div className="graph-legend-item"><div className="graph-legend-dot" style={{ background: '#ec4899' }} /> Cashout</div>
              <div className="graph-legend-item"><div className="graph-legend-dot" style={{ background: '#06b6d4' }} /> Frozen</div>
              <div className="graph-legend-item"><div className="graph-legend-dot" style={{ background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} /> Predicted Next Hop</div>
            </div>
          </div>

          {/* Timeline Controls */}
          <div style={{ flexShrink: 0 }}>
            <div className="timeline-controls">
              <button className={`btn-icon`} onClick={() => { setCurrentStep(-1); setPlaying(false); }} title="Reset">
                <RotateCcw size={14} />
              </button>
              <button className={`btn-icon`} onClick={() => setCurrentStep(Math.max(-1, currentStep - 1))} title="Previous">
                <SkipBack size={14} />
              </button>
              <button className={`btn-icon ${playing ? 'active' : ''}`} onClick={() => {
                if (currentStep >= trail.steps.length - 1) setCurrentStep(-1);
                setPlaying(!playing);
              }} title={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button className={`btn-icon`} onClick={() => setCurrentStep(Math.min(trail.steps.length - 1, currentStep + 1))} title="Next">
                <SkipForward size={14} />
              </button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden', position: 'relative'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${((currentStep + 1) / trail.steps.length) * 100}%`,
                    background: 'var(--accent)',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {currentStep + 1}/{trail.steps.length}
                </span>
              </div>
            </div>

            {/* Trail Steps */}
            <div className="trail-timeline" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
              {trail.steps.map((step, i) => (
                <div
                  key={i}
                  className={`trail-step ${i <= currentStep ? 'completed' : ''} ${i === currentStep ? 'active' : ''} ${step.riskScore >= 85 ? 'danger' : ''}`}
                  onClick={() => setCurrentStep(i)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="trail-step-dot">{step.hopNumber}</div>
                  <div className="trail-step-line" />
                  <div className="trail-step-content">
                    <div className="trail-step-header">
                      <span className="trail-step-accounts">
                        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={e => { e.stopPropagation(); setSelectedNodeId(step.fromAccount); }}>{step.fromAccount}</span>
                        <span className="arrow">→</span>
                        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={e => { e.stopPropagation(); setSelectedNodeId(step.toAccount); }}>{step.toAccount}</span>
                      </span>
                      <span className={`risk-badge ${getRiskLevel(step.riskScore)}`}>{step.riskScore}</span>
                    </div>
                    <div className="trail-step-meta">
                      <span className="mono" style={{ fontWeight: 600 }}>{formatCurrencyFull(step.amount)}</span>
                      <span>{formatTime(step.timestamp)}</span>
                      {step.delay > 0 && <span className="trail-step-delay">+{formatDelay(step.delay)}</span>}
                      <span style={{ color: 'var(--text-tertiary)' }}>Retained: {formatPercentage(step.amountRetention)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel with Tabs */}
        <div className="detail-panel" style={{ height: '100%', overflow: 'auto' }}>
          {/* Tabs Switcher */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            padding: '4px 8px',
            gap: 4
          }}>
            <button
              className={`btn btn-sm ${activeTab === 'entity' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
              onClick={() => setActiveTab('entity')}
            >
              Entity Intelligence
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'notes' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
              onClick={() => setActiveTab('notes')}
            >
              <MessageSquare size={12} /> Notes ({caseNotes.length})
            </button>
          </div>

          {activeTab === 'notes' ? (
            /* Investigator Notes Feed & Input */
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: 'calc(100% - 42px)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={13} color="var(--accent)" /> Case Investigation Notes
              </div>

              {/* Note Feed */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {caseNotes.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 8px' }}>
                    <MessageSquare size={24} className="empty-state-icon" />
                    <p className="empty-state-title" style={{ fontSize: 12 }}>No investigator notes yet</p>
                    <p className="empty-state-message" style={{ fontSize: 11 }}>Add chronological observations, nexus hypotheses, or regulatory escalation tags.</p>
                  </div>
                ) : (
                  caseNotes.map(n => (
                    <div key={n.id} style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{n.author}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{formatRelativeTime(n.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        {n.note}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Input Form */}
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
                <textarea
                  className="filter-input"
                  style={{ width: '100%', minHeight: 65, resize: 'vertical', fontSize: 12, marginBottom: 8 }}
                  placeholder="Record note (e.g. Mule chain exhibits shared hardware signature DEV-7092)..."
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ fontSize: 10, width: 170, padding: '3px 6px' }}
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                    placeholder="Investigator name"
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!newNoteText.trim() || isSubmittingNote}
                    onClick={async () => {
                      if (!newNoteText.trim()) return;
                      setIsSubmittingNote(true);
                      const posted = await postCaseNote(trail.caseId, newNoteText, authorName);
                      if (posted) {
                        setCaseNotes(prev => [posted, ...prev]);
                        setNewNoteText('');
                        dispatch({
                          type: 'ADD_TOAST',
                          toast: { id: Date.now().toString(), message: 'Investigator note saved to case dossier', type: 'success' }
                        });
                      }
                      setIsSubmittingNote(false);
                    }}
                  >
                    <Send size={12} /> Post Note
                  </button>
                </div>
              </div>
            </div>
          ) : selectedAccount ? (
            <>
              <div className="detail-panel-header">
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>{selectedAccount.id}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedAccount.name}</div>
                </div>
                <button className="btn-icon btn-ghost" onClick={() => setSelectedNodeId(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className="detail-panel-body">
                {/* Status & Risk */}
                <div className="detail-panel-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span className={`risk-badge ${getRiskLevel(selectedAccount.riskScore)}`} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {selectedAccount.riskScore}/100
                    </span>
                    <span className={`status-indicator ${state.frozenAccounts.has(selectedAccount.id) ? 'frozen' : selectedAccount.status}`}>
                      <span className="dot" />
                      {state.frozenAccounts.has(selectedAccount.id) ? 'FROZEN' : selectedAccount.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Shared Hardware Fingerprint Alert */}
                  {selectedAccount.deviceId && (
                    <div style={{
                      background: selectedAccount.deviceId === 'DEV-7092' ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-tertiary)',
                      border: `1px solid ${selectedAccount.deviceId === 'DEV-7092' ? 'rgba(245, 158, 11, 0.4)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 10px',
                      marginBottom: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: selectedAccount.deviceId === 'DEV-7092' ? '#f59e0b' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Smartphone size={12} /> Device Hardware ID
                        </span>
                        <span className="mono" style={{ fontSize: 11, color: '#fff' }}>{selectedAccount.deviceId}</span>
                      </div>
                      {selectedAccount.deviceId === 'DEV-7092' && (
                        <div style={{ fontSize: 10, color: '#f59e0b' }}>
                          ⚠️ Shared with MULE-017, MULE-042, MULE-103 (Cross-hop syndicate collusion)
                        </div>
                      )}
                    </div>
                  )}

                  <div className="detail-stats-grid">
                    <div className="detail-stat">
                      <div className="detail-stat-label">Type</div>
                      <div className="detail-stat-value" style={{ fontSize: 13 }}>{getAccountTypeLabel(selectedAccount.accountType)}</div>
                    </div>
                    <div className="detail-stat">
                      <div className="detail-stat-label">Bank</div>
                      <div className="detail-stat-value" style={{ fontSize: 13 }}>{selectedAccount.bank}</div>
                    </div>
                    <div className="detail-stat">
                      <div className="detail-stat-label">Incoming</div>
                      <div className="detail-stat-value">{formatCurrency(selectedAccount.totalIncoming)}</div>
                    </div>
                    <div className="detail-stat">
                      <div className="detail-stat-label">Outgoing</div>
                      <div className="detail-stat-value">{formatCurrency(selectedAccount.totalOutgoing)}</div>
                    </div>
                    {selectedMetrics && (
                      <>
                        <div className="detail-stat">
                          <div className="detail-stat-label">Pass-Through</div>
                          <div className="detail-stat-value">{formatPercentage(selectedMetrics.passThroughRatio * 100)}</div>
                        </div>
                        <div className="detail-stat">
                          <div className="detail-stat-label">Avg Velocity</div>
                          <div className="detail-stat-value">{selectedMetrics.avgVelocity < Infinity ? `${Math.round(selectedMetrics.avgVelocity)}s` : '—'}</div>
                        </div>
                        <div className="detail-stat">
                          <div className="detail-stat-label">Fan-In</div>
                          <div className="detail-stat-value">{selectedMetrics.fanIn}</div>
                        </div>
                        <div className="detail-stat">
                          <div className="detail-stat-label">Fan-Out</div>
                          <div className="detail-stat-value">{selectedMetrics.fanOut}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Risk Breakdown */}
                {selectedRisk && (
                  <div className="detail-panel-section">
                    <div className="detail-panel-section-title">Why this account is risky</div>
                    <div className="risk-breakdown">
                      {selectedRisk.factors.map((f, i) => (
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
                                background: f.score / f.maxScore >= 0.8 ? 'var(--risk-critical)' : f.score / f.maxScore >= 0.5 ? 'var(--risk-high)' : 'var(--risk-medium)',
                              }}
                            />
                          </div>
                          <span className="risk-factor-desc">{f.description}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Total Risk Score</span>
                        <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: getRiskColor(selectedRisk.level) }}>
                          {selectedRisk.score}/100
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Next-Hop Prediction */}
                {selectedNextHop && (
                  <div className="detail-panel-section">
                    <div className="nexthop-card">
                      <div className="nexthop-label">⚡ Predicted Next Hop</div>
                      <div className="nexthop-account">{selectedNextHop.accountId}</div>
                      <div className="nexthop-confidence">{selectedNextHop.confidence}%</div>
                      <div className="nexthop-details">
                        <div className="nexthop-detail">
                          <span className="nexthop-detail-label">Expected Amount</span>
                          <span className="nexthop-detail-value">{formatCurrency(selectedNextHop.expectedAmount)}</span>
                        </div>
                        <div className="nexthop-detail">
                          <span className="nexthop-detail-label">Est. Delay</span>
                          <span className="nexthop-detail-value">{selectedNextHop.estimatedDelay < 120 ? `< ${selectedNextHop.estimatedDelay}s` : formatDelay(selectedNextHop.estimatedDelay)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{selectedNextHop.reason}</div>

                      {selectedNextHop.alternatives.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Alternative Candidates</div>
                          <div className="candidate-list">
                            {selectedNextHop.alternatives.map((alt, i) => (
                              <div key={i} className="candidate-item" onClick={() => setSelectedNodeId(alt.accountId)}>
                                <span className="rank">{i + 2}.</span>
                                <span className="name">{alt.accountId}</span>
                                <span className="confidence" style={{ color: alt.confidence >= 60 ? 'var(--risk-high)' : 'var(--text-secondary)' }}>
                                  {alt.confidence}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="detail-panel-section">
                  <div className="detail-panel-section-title">Investigator Actions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {!state.frozenAccounts.has(selectedAccount.id) && (
                      <button className="btn btn-danger btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => setShowFreezeModal(selectedAccount.id)}>
                        <Snowflake size={12} /> Freeze Recommended
                      </button>
                    )}
                    <button className="btn btn-warning btn-sm" style={{ justifyContent: 'flex-start', color: '#000' }} onClick={() => {
                      dispatch({ type: 'FLAG_ACCOUNT', id: selectedAccount.id });
                      dispatch({ type: 'ADD_TOAST', toast: { id: `flag-${Date.now()}`, message: `${selectedAccount.id} flagged for review`, type: 'info' } });
                    }}>
                      <Flag size={12} /> Flag Account
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => {
                      dispatch({ type: 'ADD_TO_WATCHLIST', id: selectedAccount.id });
                      dispatch({ type: 'ADD_TOAST', toast: { id: `watch-${Date.now()}`, message: `${selectedAccount.id} added to watchlist`, type: 'success' } });
                    }}>
                      <Eye size={12} /> Add to Watchlist
                    </button>
                  </div>
                </div>

                {/* Evidence */}
                <div className="detail-panel-section">
                  <div className="detail-panel-section-title">Suspicious Indicators</div>
                  <div className="evidence-list">
                    {selectedMetrics && selectedMetrics.passThroughRatio > 0.8 && (
                      <div className="evidence-item">
                        <AlertTriangle size={12} className="evidence-icon" />
                        <span>{formatPercentage(selectedMetrics.passThroughRatio * 100)} of funds passed through</span>
                      </div>
                    )}
                    {selectedMetrics && selectedMetrics.fanOut >= 3 && (
                      <div className="evidence-item">
                        <AlertTriangle size={12} className="evidence-icon" />
                        <span>{selectedMetrics.fanOut} outgoing counterparties</span>
                      </div>
                    )}
                    {selectedMetrics && selectedMetrics.avgVelocity < 120 && selectedMetrics.avgVelocity > 0 && (
                      <div className="evidence-item">
                        <AlertTriangle size={12} className="evidence-icon" />
                        <span>Average transfer delay: {Math.round(selectedMetrics.avgVelocity)}s</span>
                      </div>
                    )}
                    {selectedAccount.accountType === 'mule' && (
                      <div className="evidence-item">
                        <AlertTriangle size={12} className="evidence-icon" />
                        <span>Account type classified as mule</span>
                      </div>
                    )}
                    {selectedAccount.accountType === 'cashout' && (
                      <div className="evidence-item">
                        <AlertTriangle size={12} className="evidence-icon" />
                        <span>Known cashout endpoint</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 20 }}>
              <div className="detail-panel-section-title">Investigation Panel</div>
              <div className="empty-state">
                <Target size={32} className="empty-state-icon" />
                <p className="empty-state-title">Select an account</p>
                <p className="empty-state-message">Click on a node in the graph or an account in the trail timeline to view details and risk analysis.</p>
              </div>

              {/* Next-Hop Summary */}
              {trail.predictedNextHop && (
                <div style={{ marginTop: 20 }}>
                  <div className="nexthop-card">
                    <div className="nexthop-label">⚡ Trail Next Hop Prediction</div>
                    <div className="nexthop-account">{trail.predictedNextHop.accountId}</div>
                    <div className="nexthop-confidence">{trail.predictedNextHop.confidence}%</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{trail.predictedNextHop.reason}</div>
                    <div className="nexthop-details" style={{ marginTop: 12 }}>
                      <div className="nexthop-detail">
                        <span className="nexthop-detail-label">Expected</span>
                        <span className="nexthop-detail-value">{formatCurrency(trail.predictedNextHop.expectedAmount)}</span>
                      </div>
                      <div className="nexthop-detail">
                        <span className="nexthop-detail-label">Delay</span>
                        <span className="nexthop-detail-value">&lt; {trail.predictedNextHop.estimatedDelay}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Freeze Modal */}
      {showFreezeModal && (
        <div className="modal-overlay" onClick={() => setShowFreezeModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <Snowflake size={18} style={{ color: 'var(--frozen)', marginRight: 8, display: 'inline' }} />
              Recommended Action — Freeze Review
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{showFreezeModal}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Risk: <span style={{ color: 'var(--risk-critical)', fontWeight: 700 }}>{state.accounts.find(a => a.id === showFreezeModal)?.riskScore}/100</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Reason: Probable next-hop recipient of reported scam funds. High-velocity pass-through pattern detected.
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 16 }}>
              ⓘ This is a simulated bank action for demonstration purposes.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowFreezeModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleFreeze(showFreezeModal)}>
                <Snowflake size={14} /> Initiate Freeze Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Investigation Dossier Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" style={{ maxWidth: 650, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} style={{ color: 'var(--accent)' }} />
                Executive Investigation Summary Dossier
              </span>
              <button className="btn-icon btn-ghost" onClick={() => setShowExportModal(false)}>
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 16 }}>
              <pre style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0
              }}>
                {exportedDossier?.markdown_report || exportedDossier?.markdown_summary || `
# FINANCIAL CRIME INTELLIGENCE DOSSIER
Case ID: ${trail.caseId}
Type: Digital Arrest / Impersonation Scam
Initial Loss: ${formatCurrency(trail.totalAmount)}
Total Layering Duration: ${trail.totalDuration} seconds

## MONEY TRAIL CHRONOLOGY
${trail.steps.map((s, idx) => `Hop ${idx + 1}: ${s.fromAccount} -> ${s.toAccount} (${formatCurrency(s.amount)}) [Delay: ${s.delay}s]`).join('\n')}

## PREDICTED NEXT HOP
Predicted Entity: ${trail.predictedNextHop?.accountId}
Confidence: ${trail.predictedNextHop?.confidence}%
Expected Amount: ${formatCurrency(trail.predictedNextHop?.expectedAmount || 0)}

## RECOMMENDED ACTION
Initiate immediate Freeze Review on ${trail.predictedNextHop?.accountId} via NPCI API.
                `}
              </pre>
            </div>

            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  const content = exportedDossier?.markdown_report || exportedDossier?.markdown_summary || 'Investigation Dossier';
                  navigator.clipboard.writeText(content);
                  setCopiedDossier(true);
                  setTimeout(() => setCopiedDossier(false), 2000);
                }}
              >
                {copiedDossier ? <Check size={14} /> : <Copy size={14} />} {copiedDossier ? 'Copied!' : 'Copy to Clipboard'}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowExportModal(false)}>Close</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const content = exportedDossier?.markdown_report || exportedDossier?.markdown_summary || 'Investigation Dossier';
                    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `DOSSIER_${trail.caseId}_${Date.now()}.md`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={14} /> Download Dossier (.md)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
