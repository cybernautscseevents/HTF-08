import networkx as nx
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from backend.engine.utils import get_attr

class GraphEngine:
    def __init__(self):
        self.graph = nx.DiGraph()

    def build_graph(self, accounts: List[Any], transactions: List[Any]) -> nx.DiGraph:
        """Constructs a directed NetworkX graph with full node and edge attributes."""
        G = nx.DiGraph()

        # Add accounts as nodes
        for a in accounts:
            a_id = get_attr(a, 'id')
            name = get_attr(a, 'display_name', a_id)
            bank = get_attr(a, 'bank', 'Unknown')
            a_type = get_attr(a, 'account_type', 'normal')
            risk = get_attr(a, 'risk_score', 0)
            status = get_attr(a, 'status', 'normal')
            device_id = get_attr(a, 'device_id')

            G.add_node(
                a_id,
                label=name,
                bank=bank,
                type=a_type,
                risk_score=risk,
                status=status,
                device_id=device_id
            )

        # Add transactions as directed edges
        for t in transactions:
            t_id = get_attr(t, 'id')
            src = get_attr(t, 'source_account_id')
            tgt = get_attr(t, 'destination_account_id')
            amt = float(get_attr(t, 'amount', 0.0))
            ts = get_attr(t, 'timestamp')
            risk = get_attr(t, 'risk_score', 0)
            status = get_attr(t, 'status', 'completed')
            tx_type = get_attr(t, 'transaction_type', 'UPI')
            payment_rail = get_attr(t, 'payment_rail', tx_type)
            device_id = get_attr(t, 'device_id')

            if isinstance(ts, str):
                try:
                    ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    ts_dt = datetime.now(timezone.utc)
            elif isinstance(ts, datetime):
                ts_dt = ts
            else:
                ts_dt = datetime.now(timezone.utc)

            # Support multi-edges by attaching list of txns to edge
            if G.has_edge(src, tgt):
                G[src][tgt]['transactions'].append({
                    'id': t_id,
                    'amount': amt,
                    'timestamp': ts_dt,
                    'risk_score': risk,
                    'status': status,
                    'type': tx_type
                })
                # Update aggregate amount
                G[src][tgt]['total_amount'] += amt
            else:
                G.add_edge(
                    src, tgt,
                    id=t_id,
                    amount=amt,
                    total_amount=amt,
                    timestamp=ts_dt,
                    risk_score=risk,
                    status=status,
                    type=tx_type,
                    transactions=[{
                        'id': t_id,
                        'amount': amt,
                        'timestamp': ts_dt,
                        'risk_score': risk,
                        'status': status,
                        'type': tx_type
                    }]
                )

        self.graph = G
        return G

    def get_degree_metrics(self, account_id: str) -> Dict[str, int]:
        if account_id not in self.graph:
            return {'in_degree': 0, 'out_degree': 0, 'total_degree': 0}
        in_deg = self.graph.in_degree(account_id)
        out_deg = self.graph.out_degree(account_id)
        return {
            'in_degree': in_deg,
            'out_degree': out_deg,
            'total_degree': in_deg + out_deg
        }

    def get_fan_metrics(self, account_id: str) -> Dict[str, int]:
        if account_id not in self.graph:
            return {'fan_in': 0, 'fan_out': 0}
        fan_in = len(set(self.graph.predecessors(account_id)))
        fan_out = len(set(self.graph.successors(account_id)))
        return {'fan_in': fan_in, 'fan_out': fan_out}

    def get_pass_through_ratio(self, account_id: str) -> float:
        """Calculates outgoing suspicious volume / incoming volume."""
        if account_id not in self.graph:
            return 0.0
        incoming = 0.0
        outgoing = 0.0

        for pred in self.graph.predecessors(account_id):
            incoming += self.graph[pred][account_id].get('total_amount', 0.0)

        for succ in self.graph.successors(account_id):
            outgoing += self.graph[account_id][succ].get('total_amount', 0.0)

        if incoming == 0.0:
            return 0.0
        return min(outgoing / incoming, 1.0)

    def get_velocity_metrics(self, account_id: str, transactions: List[Any]) -> Dict[str, Optional[float]]:
        """Calculates average, minimum and median forward delay in seconds between incoming and outgoing."""
        in_txns = []
        out_txns = []

        for t in transactions:
            src = get_attr(t, 'source_account_id')
            tgt = get_attr(t, 'destination_account_id')
            ts = get_attr(t, 'timestamp')

            if isinstance(ts, str):
                try:
                    ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    ts_dt = datetime.now(timezone.utc)
            else:
                ts_dt = ts

            if tgt == account_id:
                in_txns.append(ts_dt)
            elif src == account_id:
                out_txns.append(ts_dt)

        if not in_txns or not out_txns:
            return {'avg_delay': None, 'min_delay': None, 'median_delay': None}

        delays = []
        in_txns.sort()
        out_txns.sort()

        for in_time in in_txns:
            next_outs = [out_time for out_time in out_txns if out_time > in_time]
            if next_outs:
                delta = (next_outs[0] - in_time).total_seconds()
                delays.append(delta)

        if not delays:
            return {'avg_delay': None, 'min_delay': None, 'median_delay': None}

        delays.sort()
        avg_delay = sum(delays) / len(delays)
        min_delay = delays[0]
        mid = len(delays) // 2
        median_delay = delays[mid] if len(delays) % 2 != 0 else (delays[mid - 1] + delays[mid]) / 2

        return {
            'avg_delay': avg_delay,
            'min_delay': min_delay,
            'median_delay': median_delay
        }

    def get_burst_score(self, account_id: str, transactions: List[Any], window_seconds: int = 180) -> int:
        """Counts max transactions occurring within a rolling window."""
        timestamps = []
        for t in transactions:
            src = get_attr(t, 'source_account_id')
            tgt = get_attr(t, 'destination_account_id')
            if src == account_id or tgt == account_id:
                ts = get_attr(t, 'timestamp')
                if isinstance(ts, str):
                    try:
                        ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    except Exception:
                        ts_dt = datetime.now(timezone.utc)
                else:
                    ts_dt = ts
                timestamps.append(ts_dt)

        if len(timestamps) <= 1:
            return 0

        timestamps.sort()
        max_burst = 0
        for i, start_t in enumerate(timestamps):
            count = sum(1 for other in timestamps[i:] if (other - start_t).total_seconds() <= window_seconds)
            if count > max_burst:
                max_burst = count

        return max_burst

    def get_centrality_metrics(self, account_id: str) -> float:
        if account_id not in self.graph or len(self.graph) <= 1:
            return 0.0
        # Degree centrality approximation normalized
        deg = self.graph.degree(account_id)
        return float(deg) / (len(self.graph) - 1)

    def detect_cycles(self, start_node: str, max_depth: int = 5) -> List[List[str]]:
        """Finds circular money movement paths starting and returning to start_node."""
        if start_node not in self.graph:
            return []

        cycles = []
        visited = set()

        def dfs(curr: str, path: List[str], depth: int):
            if depth > max_depth:
                return
            for neighbor in self.graph.successors(curr):
                if neighbor == start_node and len(path) >= 2:
                    cycles.append(path + [neighbor])
                    continue
                if neighbor not in visited:
                    visited.add(neighbor)
                    dfs(neighbor, path + [neighbor], depth + 1)
                    visited.remove(neighbor)

        visited.add(start_node)
        dfs(start_node, [start_node], 0)
        return cycles

    def find_shortest_path(self, source: str, target: str) -> Optional[List[str]]:
        if source not in self.graph or target not in self.graph:
            return None
        try:
            return nx.shortest_path(self.graph, source=source, target=target)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def calculate_blast_radius(self, account_id: str, accounts: List[Any], transactions: List[Any]) -> Dict[str, Any]:
        """
        Calculates multi-hop network exposure metrics:
        - direct_connections (1-hop)
        - two_hop_connections (2-hop)
        - three_hop_connections (3-hop)
        - suspicious_accounts (risk_score >= 60 or type in ['mule', 'cashout'])
        - total_suspicious_flow (volume transacted within the 3-hop sphere)
        - potential_downstream_exposure (unrecovered funds leaving account into downstream mules)
        """
        if account_id not in self.graph:
            return {
                "account_id": account_id,
                "direct_connections": 0,
                "two_hop_connections": 0,
                "three_hop_connections": 0,
                "suspicious_accounts": 0,
                "total_suspicious_flow": 0.0,
                "potential_downstream_exposure": 0.0,
                "connected_nodes": [],
                "suspicious_nodes": []
            }

        undir = self.graph.to_undirected()
        lengths = nx.single_source_shortest_path_length(undir, account_id, cutoff=3)

        hop1 = [n for n, d in lengths.items() if d == 1]
        hop2 = [n for n, d in lengths.items() if d == 2]
        hop3 = [n for n, d in lengths.items() if d == 3]

        all_nodes = set(lengths.keys())
        all_nodes.discard(account_id)

        acct_map = {get_attr(a, 'id'): a for a in accounts}

        suspicious_nodes = []
        for n in all_nodes:
            a_obj = acct_map.get(n)
            if a_obj:
                score = get_attr(a_obj, 'risk_score', 0)
                a_type = get_attr(a_obj, 'account_type', 'normal')
                if score >= 60 or a_type in ['mule', 'cashout']:
                    suspicious_nodes.append(n)

        # Total suspicious flow: sum of transactions involving any suspicious node in the blast radius
        total_suspicious_flow = 0.0
        for t in transactions:
            s = get_attr(t, 'source_account_id')
            d = get_attr(t, 'destination_account_id')
            amt = float(get_attr(t, 'amount', 0.0))
            if s in all_nodes or d in all_nodes or s == account_id or d == account_id:
                if s in suspicious_nodes or d in suspicious_nodes or account_id in suspicious_nodes:
                    total_suspicious_flow += amt

        # Downstream exposure: BFS along directed edges starting from account_id
        downstream = nx.descendants(self.graph, account_id) if account_id in self.graph else set()
        potential_downstream_exposure = 0.0
        for t in transactions:
            s = get_attr(t, 'source_account_id')
            amt = float(get_attr(t, 'amount', 0.0))
            if s == account_id or s in downstream:
                potential_downstream_exposure += amt

        return {
            "account_id": account_id,
            "direct_connections": len(hop1),
            "two_hop_connections": len(hop2),
            "three_hop_connections": len(hop3),
            "suspicious_accounts": len(suspicious_nodes),
            "total_suspicious_flow": round(total_suspicious_flow, 2),
            "potential_downstream_exposure": round(potential_downstream_exposure, 2),
            "connected_nodes": list(all_nodes),
            "suspicious_nodes": suspicious_nodes
        }
