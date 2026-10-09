// Graph Engine — Client-side graph analytics
import { Account, Transaction, GraphData, GraphNode, GraphEdge } from '../types';

export interface GraphMetrics {
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  fanIn: number;
  fanOut: number;
  passThroughRatio: number;
  avgVelocity: number;
  betweennessCentrality: number;
}

interface AdjList {
  [nodeId: string]: { target: string; txId: string; amount: number; timestamp: string; riskScore: number }[];
}

// Build graph data from accounts and transactions
export function buildGraphData(accounts: Account[], txns: Transaction[]): GraphData {
  const nodeSet = new Set<string>();
  txns.forEach(t => { nodeSet.add(t.source); nodeSet.add(t.destination); });

  const accountMap = new Map(accounts.map(a => [a.id, a]));

  const nodes: GraphNode[] = Array.from(nodeSet).map(id => {
    const acct = accountMap.get(id);
    return {
      id,
      label: acct?.name || id,
      type: acct?.accountType || 'normal',
      riskScore: acct?.riskScore || 0,
      status: acct?.status || 'normal',
    };
  });

  const edges: GraphEdge[] = txns.map(t => ({
    id: t.id,
    source: t.source,
    target: t.destination,
    amount: t.amount,
    timestamp: t.timestamp,
    riskScore: t.riskScore,
    status: t.status,
  }));

  return { nodes, edges };
}

// Build adjacency list
export function buildAdjacencyList(txns: Transaction[]): AdjList {
  const adj: AdjList = {};
  txns.forEach(t => {
    if (!adj[t.source]) adj[t.source] = [];
    adj[t.source].push({
      target: t.destination,
      txId: t.id,
      amount: t.amount,
      timestamp: t.timestamp,
      riskScore: t.riskScore,
    });
  });
  return adj;
}

// Build reverse adjacency list
export function buildReverseAdjList(txns: Transaction[]): AdjList {
  const adj: AdjList = {};
  txns.forEach(t => {
    if (!adj[t.destination]) adj[t.destination] = [];
    adj[t.destination].push({
      target: t.source,
      txId: t.id,
      amount: t.amount,
      timestamp: t.timestamp,
      riskScore: t.riskScore,
    });
  });
  return adj;
}

// Calculate degree metrics
export function calculateDegree(nodeId: string, txns: Transaction[]): { inDegree: number; outDegree: number; totalDegree: number } {
  const inNeighbors = new Set(txns.filter(t => t.destination === nodeId).map(t => t.source));
  const outNeighbors = new Set(txns.filter(t => t.source === nodeId).map(t => t.destination));
  return {
    inDegree: inNeighbors.size,
    outDegree: outNeighbors.size,
    totalDegree: inNeighbors.size + outNeighbors.size,
  };
}

// Fan-in: number of unique accounts sending to this account
export function calculateFanIn(nodeId: string, txns: Transaction[]): number {
  return new Set(txns.filter(t => t.destination === nodeId).map(t => t.source)).size;
}

// Fan-out: number of unique accounts receiving from this account
export function calculateFanOut(nodeId: string, txns: Transaction[]): number {
  return new Set(txns.filter(t => t.source === nodeId).map(t => t.destination)).size;
}

// Pass-through ratio: outgoing suspicious amount / incoming amount
export function calculatePassThroughRatio(nodeId: string, txns: Transaction[]): number {
  const incoming = txns.filter(t => t.destination === nodeId).reduce((sum, t) => sum + t.amount, 0);
  const outgoing = txns.filter(t => t.source === nodeId).reduce((sum, t) => sum + t.amount, 0);
  if (incoming === 0) return 0;
  return Math.min(outgoing / incoming, 1);
}

// Transaction velocity: average time between incoming and outgoing for an account
export function calculateVelocity(nodeId: string, txns: Transaction[]): number {
  const incoming = txns.filter(t => t.destination === nodeId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const outgoing = txns.filter(t => t.source === nodeId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (incoming.length === 0 || outgoing.length === 0) return Infinity;

  let totalDelay = 0;
  let count = 0;

  for (const inTx of incoming) {
    const inTime = new Date(inTx.timestamp).getTime();
    // Find earliest outgoing tx after this incoming
    const nextOut = outgoing.find(o => new Date(o.timestamp).getTime() > inTime);
    if (nextOut) {
      totalDelay += (new Date(nextOut.timestamp).getTime() - inTime) / 1000;
      count++;
    }
  }

  return count > 0 ? totalDelay / count : Infinity;
}

// Lightweight degree centrality (normalized)
export function calculateCentrality(nodeId: string, txns: Transaction[], totalNodes: number): number {
  const degree = calculateDegree(nodeId, txns);
  if (totalNodes <= 1) return 0;
  return degree.totalDegree / (totalNodes - 1);
}

// Detect suspicious cycles (BFS-based, limited depth)
export function detectCycles(startNodeId: string, adj: AdjList, maxDepth: number = 5): string[][] {
  const cycles: string[][] = [];

  function dfs(current: string, path: string[], visited: Set<string>, depth: number) {
    if (depth > maxDepth) return;

    const neighbors = adj[current] || [];
    for (const edge of neighbors) {
      if (edge.target === startNodeId && path.length >= 2) {
        cycles.push([...path, edge.target]);
        continue;
      }
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        dfs(edge.target, [...path, edge.target], visited, depth + 1);
        visited.delete(edge.target);
      }
    }
  }

  const visited = new Set<string>([startNodeId]);
  dfs(startNodeId, [startNodeId], visited, 0);
  return cycles;
}

// Detect suspicious clusters using connected components
export function detectSuspiciousClusters(accounts: Account[], txns: Transaction[], riskThreshold: number = 50): string[][] {
  const suspiciousIds = new Set(accounts.filter(a => a.riskScore >= riskThreshold).map(a => a.id));
  const suspiciousTxns = txns.filter(t => suspiciousIds.has(t.source) || suspiciousIds.has(t.destination));

  // Build undirected adjacency for clustering
  const adj: Record<string, Set<string>> = {};
  suspiciousTxns.forEach(t => {
    if (suspiciousIds.has(t.source) && suspiciousIds.has(t.destination)) {
      if (!adj[t.source]) adj[t.source] = new Set();
      if (!adj[t.destination]) adj[t.destination] = new Set();
      adj[t.source].add(t.destination);
      adj[t.destination].add(t.source);
    }
  });

  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const nodeId of Object.keys(adj)) {
    if (visited.has(nodeId)) continue;
    const cluster: string[] = [];
    const queue = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);
      for (const neighbor of (adj[current] || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (cluster.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

// Calculate all graph metrics for a node
export function calculateGraphMetrics(nodeId: string, txns: Transaction[], totalNodes: number): GraphMetrics {
  const degree = calculateDegree(nodeId, txns);
  return {
    inDegree: degree.inDegree,
    outDegree: degree.outDegree,
    totalDegree: degree.totalDegree,
    fanIn: calculateFanIn(nodeId, txns),
    fanOut: calculateFanOut(nodeId, txns),
    passThroughRatio: calculatePassThroughRatio(nodeId, txns),
    avgVelocity: calculateVelocity(nodeId, txns),
    betweennessCentrality: calculateCentrality(nodeId, txns, totalNodes),
  };
}

// Shortest suspicious path (BFS)
export function findShortestPath(startId: string, endId: string, adj: AdjList): string[] | null {
  const visited = new Set<string>();
  const queue: string[][] = [[startId]];
  visited.add(startId);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    if (current === endId) return path;

    for (const edge of (adj[current] || [])) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push([...path, edge.target]);
      }
    }
  }

  return null;
}

// Calculate blast radius multi-hop metrics
export function calculateBlastRadius(
  accountId: string,
  accounts: Account[],
  txns: Transaction[]
) {
  const undirAdj: { [key: string]: Set<string> } = {};
  txns.forEach(t => {
    if (!undirAdj[t.source]) undirAdj[t.source] = new Set();
    if (!undirAdj[t.destination]) undirAdj[t.destination] = new Set();
    undirAdj[t.source].add(t.destination);
    undirAdj[t.destination].add(t.source);
  });

  const distance: { [key: string]: number } = { [accountId]: 0 };
  const queue: string[] = [accountId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currDist = distance[curr];
    if (currDist >= 3) continue;

    for (const neighbor of (undirAdj[curr] || [])) {
      if (distance[neighbor] === undefined) {
        distance[neighbor] = currDist + 1;
        queue.push(neighbor);
      }
    }
  }

  const hop1 = Object.keys(distance).filter(k => distance[k] === 1);
  const hop2 = Object.keys(distance).filter(k => distance[k] === 2);
  const hop3 = Object.keys(distance).filter(k => distance[k] === 3);

  const connectedNodes = Object.keys(distance).filter(k => k !== accountId);
  const connectedSet = new Set(connectedNodes);

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const suspiciousNodes: string[] = [];

  connectedNodes.forEach(id => {
    const acct = accountMap.get(id);
    if (acct && (acct.riskScore >= 60 || acct.accountType === 'mule' || acct.accountType === 'cashout')) {
      suspiciousNodes.push(id);
    }
  });

  const suspiciousSet = new Set(suspiciousNodes);
  let totalSuspiciousFlow = 0;
  txns.forEach(t => {
    if (connectedSet.has(t.source) || connectedSet.has(t.destination) || t.source === accountId || t.destination === accountId) {
      if (suspiciousSet.has(t.source) || suspiciousSet.has(t.destination) || suspiciousSet.has(accountId)) {
        totalSuspiciousFlow += t.amount;
      }
    }
  });

  const dirAdj = buildAdjacencyList(txns);
  const downstream = new Set<string>();
  const dirQueue = [accountId];
  while (dirQueue.length > 0) {
    const curr = dirQueue.shift()!;
    for (const edge of (dirAdj[curr] || [])) {
      if (!downstream.has(edge.target) && edge.target !== accountId) {
        downstream.add(edge.target);
        dirQueue.push(edge.target);
      }
    }
  }

  let potentialExposure = 0;
  txns.forEach(t => {
    if (t.source === accountId || downstream.has(t.source)) {
      potentialExposure += t.amount;
    }
  });

  return {
    accountId,
    directConnections: hop1.length,
    twoHopConnections: hop2.length,
    threeHopConnections: hop3.length,
    suspiciousAccounts: suspiciousNodes.length,
    totalSuspiciousFlow,
    potentialDownstreamExposure: potentialExposure,
    connectedNodes,
    suspiciousNodes
  };
}
