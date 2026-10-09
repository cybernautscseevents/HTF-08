import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Search, Filter, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, X, Sparkles, Check, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export type NodeCategory =
  | 'Person'
  | 'Technology'
  | 'Database'
  | 'Concept'
  | 'Organization'
  | 'Victim'
  | 'Mule'
  | 'Cashout'
  | 'Infrastructure'
  | 'Institution';

export interface VisualizerNode {
  id: string;
  name: string;
  type: string;
  category: NodeCategory;
  riskScore?: number;
  status?: string;
  deviceId?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  radius?: number;
  description?: string;
  details?: Record<string, string | number>;
  baseX?: number;
  baseY?: number;
}

export interface SimRenderNode extends VisualizerNode {
  x: number;
  y: number;
  radius: number;
}

export interface VisualizerEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  amount?: number;
  type?: string;
  riskScore?: number;
  status?: string;
}

export interface CortexGraphVisualizerProps {
  nodes: VisualizerNode[];
  edges: VisualizerEdge[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  onSelectEdge?: (edgeId: string | null) => void;
  titleBadge?: string;
  datasetName?: string;
  onToggleDataset?: () => void;
  onReset?: () => void;
  height?: string | number;
  className?: string;
  customLegend?: Array<{ category: NodeCategory; label: string; color: string }>;
}

const CATEGORY_COLORS: Record<string, { main: string; light: string; dark: string; glow: string }> = {
  Person: { main: '#00d2ff', light: '#80eaff', dark: '#0284c7', glow: 'rgba(0, 210, 255, 0.6)' },
  Technology: { main: '#a855f7', light: '#d8b4fe', dark: '#7e22ce', glow: 'rgba(168, 85, 247, 0.6)' },
  Database: { main: '#10b981', light: '#6ee7b7', dark: '#047857', glow: 'rgba(16, 185, 129, 0.6)' },
  Concept: { main: '#ec4899', light: '#f472b6', dark: '#be185d', glow: 'rgba(236, 72, 153, 0.6)' },
  Organization: { main: '#f59e0b', light: '#fde047', dark: '#b45309', glow: 'rgba(245, 158, 11, 0.6)' },

  // Financial crime mappings
  Victim: { main: '#00d2ff', light: '#80eaff', dark: '#0284c7', glow: 'rgba(0, 210, 255, 0.6)' },
  Mule: { main: '#ef4444', light: '#fca5a5', dark: '#b91c1c', glow: 'rgba(239, 68, 68, 0.7)' },
  Cashout: { main: '#ec4899', light: '#f472b6', dark: '#be185d', glow: 'rgba(236, 72, 153, 0.6)' },
  Infrastructure: { main: '#f59e0b', light: '#fde047', dark: '#b45309', glow: 'rgba(245, 158, 11, 0.6)' },
  Institution: { main: '#10b981', light: '#6ee7b7', dark: '#047857', glow: 'rgba(16, 185, 129, 0.6)' },
};

function drawRoundRectFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
}

export default function CortexGraphVisualizer({
  nodes,
  edges,
  selectedNodeId: externalSelectedNodeId,
  onSelectNode,
  onSelectEdge,
  titleBadge = 'CORTEX NEURAL SIMULATOR',
  datasetName,
  onToggleDataset,
  onReset,
  height = '100%',
  className = '',
  customLegend,
}: CortexGraphVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Local selection fallback if not controlled
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(externalSelectedNodeId || null);
  const selectedNodeId = externalSelectedNodeId !== undefined ? externalSelectedNodeId : internalSelectedId;

  // Viewport
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Search filter
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Dragging states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedNode, setDraggedNode] = useState<SimRenderNode | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hover states for edges
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Internal mutable simulation nodes
  const simNodesRef = useRef<Map<string, SimRenderNode>>(new Map());

  // Background ambient star particles
  const starsRef = useRef<
    Array<{ x: number; y: number; r: number; baseAlpha: number; speed: number; phase: number }>
  >([]);

  // Initialize stars once
  useEffect(() => {
    const list = [];
    for (let i = 0; i < 80; i++) {
      list.push({
        x: (Math.random() - 0.5) * 2600,
        y: (Math.random() - 0.5) * 2000,
        r: Math.random() * 1.5 + 0.6,
        baseAlpha: Math.random() * 0.4 + 0.12,
        speed: Math.random() * 0.003 + 0.001,
        phase: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = list;
  }, []);

  // Update selection
  const handleSelectNode = useCallback(
    (id: string | null) => {
      setInternalSelectedId(id);
      if (onSelectNode) onSelectNode(id);
    },
    [onSelectNode]
  );

  // Synchronize internal node positions when dataset or dimensions change
  const initPositions = useCallback(() => {
    const container = containerRef.current;
    const width = container?.clientWidth || 1000;
    const height = container?.clientHeight || 650;
    const centerX = width / 2;
    const centerY = height / 2;

    const map = new Map<string, SimRenderNode>();

    // Calculate scale factor relative to standard 1000x650 viewport
    const scaleX = width / 1100;
    const scaleY = height / 700;

    nodes.forEach((n, idx) => {
      let x = n.x;
      let y = n.y;

      if (x === undefined || y === undefined) {
        if (n.baseX !== undefined && n.baseY !== undefined) {
          x = (n.baseX - 550) * scaleX + centerX;
          y = (n.baseY - 350) * scaleY + centerY;
        } else {
          // Circular placement fallback
          const angle = (idx / Math.max(nodes.length, 1)) * 2 * Math.PI;
          const dist = 180 + (idx % 3) * 60;
          x = centerX + Math.cos(angle) * dist;
          y = centerY + Math.sin(angle) * dist;
        }
      }

      map.set(n.id, {
        ...n,
        x: x ?? centerX,
        y: y ?? centerY,
        radius: n.radius || (n.category === 'Person' || n.category === 'Victim' ? 16 : 14),
        vx: 0,
        vy: 0,
      });
    });

    // --- PRECALCULATE PHYSICS TO FREEZE GRAPH (Stable layout) ---
    const ALPHA = 1.0;
    const REPULSION = 800; 
    const SPRING = 0.05;
    const DAMPING = 0.7;
    const MAX_VELOCITY = 15;
    const nodesArr = Array.from(map.values());

    for (let tick = 0; tick < 200; tick++) {
      edges.forEach(edge => {
        const src = map.get(edge.source);
        const tgt = map.get(edge.target);
        if (!src || !tgt) return;
        let dx = tgt.x - src.x;
        let dy = tgt.y - src.y;
        if (dx === 0 && dy === 0) { dx = 0.1; dy = 0.1; }
        const dist = Math.hypot(dx, dy);
        const force = (dist - 160) * SPRING;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (src.baseX === undefined) { src.vx = (src.vx || 0) + fx; src.vy = (src.vy || 0) + fy; }
        if (tgt.baseX === undefined) { tgt.vx = (tgt.vx || 0) - fx; tgt.vy = (tgt.vy || 0) - fy; }
      });

      for (let i = 0; i < nodesArr.length; i++) {
        for (let j = i + 1; j < nodesArr.length; j++) {
          const a = nodesArr[i];
          const b = nodesArr[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          if (dx === 0 && dy === 0) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
          }
          const distSq = dx * dx + dy * dy;
          if (distSq < 22500) { 
            const dist = Math.sqrt(distSq);
            const force = REPULSION / dist; 
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (a.baseX === undefined) { a.vx = (a.vx || 0) - fx; a.vy = (a.vy || 0) - fy; }
            if (b.baseX === undefined) { b.vx = (b.vx || 0) + fx; b.vy = (b.vy || 0) + fy; }
          }
        }
      }

      nodesArr.forEach(n => {
        if (n.baseX === undefined) {
          n.vx = ((n.vx || 0) + (width / 2 - n.x) * 0.006) * DAMPING;
          n.vy = ((n.vy || 0) + (height / 2 - n.y) * 0.006) * DAMPING;
          n.vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, n.vx));
          n.vy = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, n.vy));
          n.x += n.vx * ALPHA;
          n.y += n.vy * ALPHA;
        }
      });
    }

    simNodesRef.current = map;
  }, [nodes, edges]);

  useEffect(() => {
    initPositions();
  }, [initPositions]);

  // Center on selected node if one exists
  const centerOnNode = useCallback((nodeId: string) => {
    const node = simNodesRef.current.get(nodeId);
    const container = containerRef.current;
    if (!node || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    // Animate or set pan so that node is slightly to the left of center (similar to image 1)
    setPan({
      x: width * 0.38 - node.x * zoom,
      y: height * 0.5 - node.y * zoom,
    });
  }, [zoom]);

  // React to external selectedNodeId changes
  useEffect(() => {
    if (externalSelectedNodeId && simNodesRef.current.has(externalSelectedNodeId)) {
      setInternalSelectedId(externalSelectedNodeId);
      // Removed centerOnNode: Graph layout and viewport must remain completely stable when selecting accounts
    }
  }, [externalSelectedNodeId]);

  // Compute connected nodes & edges
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    const nIds = new Set<string>();
    const eIds = new Set<string>();

    if (selectedNodeId) {
      edges.forEach(e => {
        if (e.source === selectedNodeId) {
          nIds.add(e.target);
          eIds.add(e.id);
        } else if (e.target === selectedNodeId) {
          nIds.add(e.source);
          eIds.add(e.id);
        }
      });
    }

    return { connectedNodeIds: nIds, connectedEdgeIds: eIds };
  }, [selectedNodeId, edges]);

  // Search suggestions
  const searchResults = useMemo(() => {
    if (!searchFilter.trim()) return [];
    const q = searchFilter.toLowerCase();
    return nodes.filter(n => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)).slice(0, 8);
  }, [searchFilter, nodes]);

  // Canvas Main 60FPS Render Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const time = performance.now() / 1000;
      const isSelectionActive = Boolean(selectedNodeId);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Deep dark cosmic space background
      ctx.fillStyle = isDark ? '#07090e' : '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle ambient stars / particles
      const centerX = width / 2;
      const centerY = height / 2;
      starsRef.current.forEach(star => {
        // Soft twinkle & slow drift
        const alpha = star.baseAlpha + Math.sin(time * 2 + star.phase) * 0.08;
        const starScreenX = centerX + (star.x + pan.x * 0.15) % (width + 400) - 200;
        const starScreenY = centerY + (star.y + pan.y * 0.15) % (height + 400) - 200;

        ctx.fillStyle = `rgba(${isDark ? '203, 213, 225' : '100, 116, 139'}, ${Math.max(0.04, alpha)})`;
        ctx.beginPath();
        ctx.arc(starScreenX, starScreenY, star.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Apply viewport transformations
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const simMap = simNodesRef.current;

      // ==========================================
      // 1. DRAW EDGES & CONNECTION ARROWS & PILLS
      // ==========================================
      edges.forEach((edge, edgeIdx) => {
        const src = simMap.get(edge.source);
        const tgt = simMap.get(edge.target);
        if (!src || !tgt) return;

        const isDirectlyConnected =
          isSelectionActive && (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const isDimmed = isSelectionActive && !isDirectlyConnected;

        // Calculate smooth subtle curved arc between nodes
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;

        // Controlled subtle curve
        const curveOffset = ((edgeIdx % 3) - 1) * 22;
        const cx = (src.x + tgt.x) / 2 + nx * curveOffset;
        const cy = (src.y + tgt.y) / 2 + ny * curveOffset;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(cx, cy, tgt.x, tgt.y);

        if (isDimmed) {
          // Dimmed edge
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
          ctx.lineWidth = 1;
          ctx.shadowBlur = 0;
          ctx.stroke();
        } else if (isDirectlyConnected) {
          // Highlighted connection edge (Active connection emanating from selected node)
          const edgeColor = edge.status === 'blocked' ? 'rgba(239, 68, 68, 0.75)' : 'rgba(215, 235, 255, 0.85)';
          const edgeShadow = edge.status === 'blocked' ? '#ef4444' : '#00f0ff';
          
          ctx.strokeStyle = edgeColor;
          ctx.lineWidth = 2.2;
          ctx.shadowColor = edgeShadow;
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Tangent calculation for arrowhead pointing at target
          const tNear = 0.96;
          const qx = (1 - tNear) * (1 - tNear) * src.x + 2 * (1 - tNear) * tNear * cx + tNear * tNear * tgt.x;
          const qy = (1 - tNear) * (1 - tNear) * src.y + 2 * (1 - tNear) * tNear * cy + tNear * tNear * tgt.y;
          const angle = Math.atan2(tgt.y - qy, tgt.x - qx);

          const arrowDist = (tgt.radius || 14) + 4;
          const arrowX = tgt.x - Math.cos(angle) * arrowDist;
          const arrowY = tgt.y - Math.sin(angle) * arrowDist;

          // Crisp glowing arrowhead
          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(angle);
          ctx.fillStyle = edgeShadow;
          ctx.shadowColor = edgeShadow;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-8.5, -4.5);
          ctx.lineTo(-6.5, 0);
          ctx.lineTo(-8.5, 4.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Connection pill badge along the curve (Image 1 style)
          if (edge.label) {
            const tPill = 0.46;
            const bx = (1 - tPill) * (1 - tPill) * src.x + 2 * (1 - tPill) * tPill * cx + tPill * tPill * tgt.x;
            const by = (1 - tPill) * (1 - tPill) * src.y + 2 * (1 - tPill) * tPill * cy + tPill * tPill * tgt.y;

            ctx.save();
            ctx.translate(bx, by);

            const tangentAngle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
            const pillAngle =
              tangentAngle > Math.PI / 2 || tangentAngle < -Math.PI / 2
                ? tangentAngle + Math.PI
                : tangentAngle;
            ctx.rotate(pillAngle * 0.7);

            ctx.font = '700 9.5px JetBrains Mono, monospace';
            const labelText = edge.label.toUpperCase();
            const textWidth = ctx.measureText(labelText).width;
            const pillW = textWidth + 16;
            const pillH = 19;

            // Pill dark background with neon cyan border
            ctx.fillStyle = isDark ? 'rgba(7, 14, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = isDark ? '#00e5ff' : '#0284c7';
            ctx.lineWidth = 1.2;
            ctx.shadowColor = isDark ? 'rgba(0, 229, 255, 0.65)' : 'rgba(2, 132, 199, 0.3)';
            ctx.shadowBlur = 8;

            ctx.beginPath();
            drawRoundRectFallback(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 4);
            ctx.fill();
            ctx.stroke();

            // Neon text
            ctx.fillStyle = edge.status === 'blocked' ? '#ef4444' : '#00e5ff';
            ctx.strokeStyle = edge.status === 'blocked' ? '#ef4444' : '#00e5ff';
            ctx.shadowColor = edge.status === 'blocked' ? 'rgba(239, 68, 68, 0.65)' : 'rgba(0, 229, 255, 0.65)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 4;
            ctx.fillText(edge.status === 'blocked' ? 'BLOCKED' : labelText, 0, 0);
            ctx.restore();
          }

          // Luminous animated particle flow along active edge
          const pSpeed = 0.65;
          const pProgress = (time * pSpeed + (edgeIdx * 0.23)) % 1;
          const px =
            (1 - pProgress) * (1 - pProgress) * src.x +
            2 * (1 - pProgress) * pProgress * cx +
            pProgress * pProgress * tgt.x;
          const py =
            (1 - pProgress) * (1 - pProgress) * src.y +
            2 * (1 - pProgress) * pProgress * cy +
            pProgress * pProgress * tgt.y;

          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = edgeShadow;
          ctx.shadowColor = edgeShadow;
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // Standard overview edge (Image 2 style)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1.2;
          ctx.shadowBlur = 0;
          ctx.stroke();

          // Subtle arrow
          const tNear = 0.95;
          const qx = (1 - tNear) * (1 - tNear) * src.x + 2 * (1 - tNear) * tNear * cx + tNear * tNear * tgt.x;
          const qy = (1 - tNear) * (1 - tNear) * src.y + 2 * (1 - tNear) * tNear * cy + tNear * tNear * tgt.y;
          const angle = Math.atan2(tgt.y - qy, tgt.x - qx);
          const arrowDist = (tgt.radius || 14) + 3;
          const arrowX = tgt.x - Math.cos(angle) * arrowDist;
          const arrowY = tgt.y - Math.sin(angle) * arrowDist;

          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(angle);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-6, -3);
          ctx.lineTo(-6, 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      });

      // ==========================================
      // 2. DRAW NODES WITH 3D SPHERES & HALOS
      // ==========================================
      simMap.forEach(node => {
        const isSelected = selectedNodeId === node.id;
        const isNeighbor = connectedNodeIds.has(node.id);
        const isDimmed = isSelectionActive && !isSelected && !isNeighbor;

        const baseRadius = node.radius || 14;
        const r = isSelected ? baseRadius * 1.2 : isDimmed ? baseRadius * 0.85 : baseRadius;

        const cat = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.Technology;

        if (isDimmed) {
          // DIMMED NODE (The requested dimming behavior)
          ctx.save();
          ctx.globalAlpha = 0.18;

          // Muted 3D sphere gradient
          const grad = ctx.createRadialGradient(
            node.x - r * 0.35,
            node.y - r * 0.35,
            r * 0.05,
            node.x,
            node.y,
            r
          );
          grad.addColorStop(0, cat.light);
          grad.addColorStop(0.5, cat.main);
          grad.addColorStop(1, '#0f172a');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Faint gray label
          ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
          ctx.font = '10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + r + 12);

          ctx.restore();
        } else if (isSelected) {
          // SELECTED / FOCUSED NODE (Intense radiant pulsing aura from Image 1)
          ctx.save();

          // Outer glowing pulsar rings
          const pulse = Math.sin(time * 3.5) * 2.5;

          // 1. Violet radiant outer halo
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 14 + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 24;
          ctx.stroke();

          // 2. Cyan intense pulse ring
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 7 + pulse * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 18;
          ctx.stroke();

          // 3. Inner crisp ring
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Vibrant glowing 3D sphere
          let sphereColor1 = '#ffffff';
          let sphereColor2 = '#38bdf8';
          let sphereColor3 = '#0284c7';
          let sphereColor4 = '#033a5b';
          
          if (node.status === 'frozen') {
            sphereColor1 = '#ffffff';
            sphereColor2 = '#f87171';
            sphereColor3 = '#dc2626';
            sphereColor4 = '#450a0a';
          }

          const grad = ctx.createRadialGradient(
            node.x - r * 0.35,
            node.y - r * 0.35,
            r * 0.05,
            node.x,
            node.y,
            r
          );
          grad.addColorStop(0, sphereColor1);
          grad.addColorStop(0.35, sphereColor2);
          grad.addColorStop(0.85, sphereColor3);
          grad.addColorStop(1, sphereColor4);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();

          if (node.status === 'frozen') {
            // Draw frozen ice/lock icon
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 14px "Font Awesome 5 Free", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('❄', node.x, node.y);
          }

          // Bold white prominent label
          ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
          ctx.font = '700 13px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 10;
          ctx.fillText(node.name, node.x, node.y + r + 20);

          ctx.restore();
        } else {
          // HIGHLIGHTED NEIGHBOR OR OVERVIEW NODE
          ctx.save();

          if (isNeighbor) {
            // Soft aura for connected neighbor
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3.5, 0, Math.PI * 2);
            ctx.strokeStyle = cat.glow;
            ctx.lineWidth = 1.8;
            ctx.shadowColor = cat.main;
            ctx.shadowBlur = 14;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // 3D glossy sphere gradient
          const grad = ctx.createRadialGradient(
            node.x - r * 0.35,
            node.y - r * 0.35,
            r * 0.05,
            node.x,
            node.y,
            r
          );
          grad.addColorStop(0, cat.light);
          grad.addColorStop(0.5, cat.main);
          grad.addColorStop(1, cat.dark);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Clean white label underneath
          ctx.fillStyle = isDark ? (isNeighbor ? '#ffffff' : '#f1f5f9') : (isNeighbor ? '#0f172a' : '#334155');
          ctx.font = isNeighbor ? '600 11.5px Inter, sans-serif' : '500 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 6;
          ctx.fillText(node.name, node.x, node.y + r + 15);

          ctx.restore();
        }
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [pan, zoom, selectedNodeId, connectedNodeIds, connectedEdgeIds, edges]);

  // Mouse interaction: Node Click, Drag, Pan
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;

    // Check hit on nodes
    for (const node of simNodesRef.current.values()) {
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;
      const hitRadius = (node.radius || 14) + 8;
      if (Math.hypot(dx, dy) <= hitRadius) {
        handleSelectNode(node.id);
        setDraggedNode(node);
        setIsDragging(true);
        dragStartRef.current = { x: mouseX - node.x, y: mouseY - node.y };
        return;
      }
    }

    // Check hit on edges
    for (const edge of edges) {
      const src = simNodesRef.current.get(edge.source);
      const tgt = simNodesRef.current.get(edge.target);
      if (!src || !tgt) continue;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const u = Math.max(0, Math.min(1, ((mouseX - src.x) * dx + (mouseY - src.y) * dy) / lenSq));
      const projX = src.x + u * dx;
      const projY = src.y + u * dy;
      if (Math.hypot(mouseX - projX, mouseY - projY) < 10) {
        if (onSelectEdge) onSelectEdge(edge.id);
        return;
      }
    }

    // Clicked empty background: deselect
    handleSelectNode(null);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    setMousePos({ x: clientX, y: clientY });

    if (isDragging) {
      if (draggedNode) {
        draggedNode.x = (clientX - pan.x) / zoom - dragStartRef.current.x;
        draggedNode.y = (clientY - pan.y) / zoom - dragStartRef.current.y;
      } else {
        setPan({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      }
      return;
    }

    // Hover detection for edges
    const mouseX = (clientX - pan.x) / zoom;
    const mouseY = (clientY - pan.y) / zoom;
    let foundEdgeId: string | null = null;
    let hitNode = false;

    // Fast check: did we hit a node?
    for (const node of simNodesRef.current.values()) {
      const dx = mouseX - node.x;
      const dy = mouseY - node.y;
      const hitRadius = (node.radius || 14) + 8;
      if (Math.hypot(dx, dy) <= hitRadius) {
        hitNode = true;
        break;
      }
    }

    if (!hitNode) {
      for (const edge of edges) {
        const src = simNodesRef.current.get(edge.source);
        const tgt = simNodesRef.current.get(edge.target);
        if (!src || !tgt) continue;

        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) continue;

        const u = Math.max(0, Math.min(1, ((mouseX - src.x) * dx + (mouseY - src.y) * dy) / lenSq));
        const projX = src.x + u * dx;
        const projY = src.y + u * dy;
        
        // Curved distance approximation (slightly larger hit box for usability)
        if (Math.hypot(mouseX - projX, mouseY - projY) < 15) {
          foundEdgeId = edge.id;
          break; // Stop at first edge found
        }
      }
    }
    setHoveredEdgeId(foundEdgeId);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNode(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom(z => Math.max(0.3, Math.min(3.5, z * factor)));
  };

  const handleResetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    handleSelectNode(null);
    initPositions();
    if (onReset) onReset();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Legend categories to display
  const legendItems = customLegend || [
    { category: 'Person' as NodeCategory, label: 'Person', color: '#00d2ff' },
    { category: 'Technology' as NodeCategory, label: 'Technology', color: '#a855f7' },
    { category: 'Database' as NodeCategory, label: 'Database', color: '#10b981' },
    { category: 'Concept' as NodeCategory, label: 'Concept', color: '#ec4899' },
    { category: 'Organization' as NodeCategory, label: 'Organization', color: '#f59e0b' },
  ];

  const navBtnStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: isDark ? '#cbd5e1' : '#475569',
    padding: 8,
    cursor: 'pointer',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      ref={containerRef}
      className={`cortex-visualizer-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: '#07090e',
        borderRadius: isFullscreen ? 0 : 'var(--radius-lg, 8px)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
      }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { handleMouseUp(); setHoveredEdgeId(null); }}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      />

      {/* ========================================================= */}
      {/* TOP LEFT: SEARCH / FILTER NODES INPUT (Image 2 style)     */}
      {/* ========================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          width: 240,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: 20,
            padding: '6px 12px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          <Search size={14} style={{ color: '#94a3b8', marginRight: 8, flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Filter nodes..."
            value={searchFilter}
            onChange={e => {
              setSearchFilter(e.target.value);
              setIsFilterDropdownOpen(true);
            }}
            onFocus={() => setIsFilterDropdownOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: isDark ? '#f8fafc' : '#0f172a',
              fontSize: 12,
              fontFamily: 'var(--font-sans, system-ui)',
              width: '100%',
            }}
          />
          {searchFilter ? (
            <button
              onClick={() => {
                setSearchFilter('');
                setIsFilterDropdownOpen(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
              }}
            >
              <X size={13} />
            </button>
          ) : (
            <Filter size={13} style={{ color: isDark ? '#64748b' : '#64748b', opacity: 0.7 }} />
          )}
        </div>

        {/* Search Results Dropdown */}
        {isFilterDropdownOpen && searchResults.length > 0 && (
          <div
            style={{
              background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(14px)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 10,
              padding: 6,
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.7)',
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {searchResults.map(res => (
              <div
                key={res.id}
                onClick={() => {
                  handleSelectNode(res.id);
                  centerOnNode(res.id);
                  setIsFilterDropdownOpen(false);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: selectedNodeId === res.id ? '#00e5ff' : '#e2e8f0',
                  background: selectedNodeId === res.id ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: CATEGORY_COLORS[res.category]?.main || '#a855f7',
                    }}
                  />
                  <span>{res.name}</span>
                </div>
                <span style={{ fontSize: 10, color: isDark ? '#64748b' : '#64748b', textTransform: 'uppercase' }}>
                  {res.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* TOP RIGHT: ZOOM & VIEWPORT CONTROLS (Manual Nav Cluster)    */}
      {/* ========================================================= */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(12px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 16,
          padding: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* PAN CLUSTER (D-PAD) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          <div />
          <button onClick={() => setPan(p => ({ ...p, y: p.y + 100 }))} title="Pan Up" style={navBtnStyle}><ArrowUp size={16}/></button>
          <div />
          
          <button onClick={() => setPan(p => ({ ...p, x: p.x + 100 }))} title="Pan Left" style={navBtnStyle}><ArrowLeft size={16}/></button>
          <button onClick={handleResetViewport} title="Reset View" style={{ ...navBtnStyle, background: 'rgba(0, 229, 255, 0.15)', borderColor: 'rgba(0, 229, 255, 0.3)', color: isDark ? '#00e5ff' : '#0284c7' }}><RotateCcw size={16}/></button>
          <button onClick={() => setPan(p => ({ ...p, x: p.x - 100 }))} title="Pan Right" style={navBtnStyle}><ArrowRight size={16}/></button>
          
          <div />
          <button onClick={() => setPan(p => ({ ...p, y: p.y - 100 }))} title="Pan Down" style={navBtnStyle}><ArrowDown size={16}/></button>
          <div />
        </div>

        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.1)' }} />

        {/* ZOOM CLUSTER */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setZoom(z => Math.min(3.5, z * 1.25))} title="Zoom In" style={navBtnStyle}><ZoomIn size={16} /></button>
          <button onClick={() => setZoom(z => Math.max(0.3, z * 0.8))} title="Zoom Out" style={navBtnStyle}><ZoomOut size={16} /></button>
          <button onClick={toggleFullscreen} title="Toggle Fullscreen" style={navBtnStyle}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM LEFT: CORTEX BADGES & NODE COUNTERS (Image 2 style) */}
      {/* ========================================================= */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Main Title Badge (Clickable to switch dataset if handler provided) */}
        <div
          onClick={onToggleDataset}
          style={{
            background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#94a3b8',
            cursor: onToggleDataset ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          <Sparkles size={11} style={{ color: isDark ? '#00e5ff' : '#0284c7' }} />
          <span>{titleBadge}</span>
          {onToggleDataset && datasetName && (
            <span
              style={{
                marginLeft: 4,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 9,
              }}
            >
              Switch: {datasetName}
            </span>
          )}
        </div>

        {/* Node & Edge count badge (e.g. 25 Nodes · 19 Edges) */}
        <div
          style={{
            background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 600,
            color: isDark ? '#cbd5e1' : '#475569',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {nodes.length} Nodes · {edges.length} Edges
        </div>

        {/* Active focused node badge if one is selected */}
        {selectedNodeId && (
          <div
            onClick={() => handleSelectNode(null)}
            style={{
              background: 'rgba(0, 229, 255, 0.15)',
              border: '1px solid rgba(0, 229, 255, 0.5)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 10,
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 700,
              color: '#00f0ff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Click to reset focus and show all nodes"
          >
            <span>Focused: {simNodesRef.current.get(selectedNodeId)?.name || selectedNodeId}</span>
            <X size={11} />
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* BOTTOM RIGHT: CATEGORY COLOR LEGEND (Image 2 style)       */}
      {/* ========================================================= */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 20,
          background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 20,
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        {legendItems.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontFamily: 'var(--font-sans, system-ui)',
              color: isDark ? '#cbd5e1' : '#475569',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: item.color,
                boxShadow: `0 0 6px ${item.color}`,
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* HOVER TOOLTIP FOR EDGES                                   */}
      {/* ========================================================= */}
      {hoveredEdgeId && (
        (() => {
          const edge = edges.find(e => e.id === hoveredEdgeId);
          if (!edge) return null;
          const srcNode = simNodesRef.current.get(edge.source);
          const tgtNode = simNodesRef.current.get(edge.target);
          
          return (
            <div
              style={{
                position: 'absolute',
                left: mousePos.x + 15,
                top: mousePos.y + 15,
                zIndex: 50,
                pointerEvents: 'none',
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 16px rgba(0, 229, 255, 0.15)',
                color: isDark ? '#f8fafc' : '#0f172a',
                minWidth: '220px',
                fontFamily: 'var(--font-sans, system-ui)',
              }}
            >
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={12} style={{ color: isDark ? '#00e5ff' : '#0284c7' }} />
                Transaction Detected
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: isDark ? '#64748b' : '#64748b' }}>From:</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{srcNode?.name || edge.source}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: isDark ? '#64748b' : '#64748b' }}>To:</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{tgtNode?.name || edge.target}</span>
                </div>
                {edge.amount !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <span style={{ color: isDark ? '#64748b' : '#64748b' }}>Amount:</span>
                    <span style={{ fontWeight: 700, color: isDark ? '#00e5ff' : '#0284c7' }}>₹{(edge.amount / 1000).toFixed(1)}K</span>
                  </div>
                )}
                {edge.riskScore !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: isDark ? '#64748b' : '#64748b' }}>Risk:</span>
                    <span style={{ fontWeight: 700, color: edge.riskScore > 80 ? '#ef4444' : edge.riskScore > 50 ? '#f59e0b' : '#10b981' }}>
                      {edge.riskScore}/100
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
