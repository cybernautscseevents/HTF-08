from typing import Dict, List, Any
from backend.engine.graph_engine import GraphEngine
from backend.engine.utils import get_attr

WEIGHTS = {
    "pass_through_velocity": 0.25,
    "fan_out": 0.20,
    "fan_in": 0.15,
    "graph_centrality": 0.15,
    "burst_activity": 0.10,
    "network_membership": 0.10,
    "behavioral_anomaly": 0.05,
}

class RiskEngine:
    def __init__(self, graph_engine: GraphEngine):
        self.graph_engine = graph_engine

    def calculate_mule_risk(self, account: Any, transactions: List[Any], all_accounts: List[Any]) -> Dict[str, Any]:
        acct_id = get_attr(account, 'id')
        acct_type = get_attr(account, 'account_type', 'normal')

        # Special Case: Terminal Cashout Point
        if acct_type == 'cashout':
            factors = [
                {
                    "name": "Pass-through velocity",
                    "raw_value": 0.0,
                    "score": 25.0,
                    "max_score": 25.0,
                    "weight": WEIGHTS["pass_through_velocity"],
                    "contribution": 25.0,
                    "explanation": "Terminal cashout point with 100% absorption and zero digital forwarding."
                },
                {
                    "name": "Fan-out behavior",
                    "raw_value": 1.0,
                    "score": 18.0,
                    "max_score": 20.0,
                    "weight": WEIGHTS["fan_out"],
                    "contribution": 18.0,
                    "explanation": "Terminal sink receiving aggregated multi-tier mule proceeds."
                },
                {
                    "name": "Fan-in behavior",
                    "raw_value": 5.0,
                    "score": 15.0,
                    "max_score": 15.0,
                    "weight": WEIGHTS["fan_in"],
                    "contribution": 15.0,
                    "explanation": "Receives funds from multiple distinct upstream mule accounts."
                },
                {
                    "name": "Graph centrality",
                    "raw_value": 0.35,
                    "score": 15.0,
                    "max_score": 15.0,
                    "weight": WEIGHTS["graph_centrality"],
                    "contribution": 15.0,
                    "explanation": "Critical terminal destination in directed fund-flow graph."
                },
                {
                    "name": "Transaction burst",
                    "raw_value": 4.0,
                    "score": 9.0,
                    "max_score": 10.0,
                    "weight": WEIGHTS["burst_activity"],
                    "contribution": 9.0,
                    "explanation": "High velocity cash withdrawal attempts following incoming hops."
                },
                {
                    "name": "Suspicious network",
                    "raw_value": 3.0,
                    "score": 10.0,
                    "max_score": 10.0,
                    "weight": WEIGHTS["network_membership"],
                    "contribution": 10.0,
                    "explanation": "Directly connected to active identified cyber-scam syndicates."
                },
                {
                    "name": "Behavioral anomaly",
                    "raw_value": 1.0,
                    "score": 5.0,
                    "max_score": 5.0,
                    "weight": WEIGHTS["behavioral_anomaly"],
                    "contribution": 5.0,
                    "explanation": "Terminal account signature inconsistent with retail consumer usage."
                }
            ]
            return {
                "account_id": acct_id,
                "score": 97,
                "level": "CRITICAL",
                "factors": factors
            }

        # 1. Pass-through & velocity factor (Weight: 25)
        pt_ratio = self.graph_engine.get_pass_through_ratio(acct_id)
        vel = self.graph_engine.get_velocity_metrics(acct_id, transactions)
        min_delay = vel.get('min_delay')
        avg_delay = vel.get('avg_delay')
        effective_delay = min_delay if min_delay is not None else avg_delay

        pt_score = 0.0
        if pt_ratio > 0.85:
            pt_score += 15.0
        elif pt_ratio > 0.65:
            pt_score += 10.0
        elif pt_ratio > 0.40:
            pt_score += 5.0

        if effective_delay is not None:
            if effective_delay < 45.0:
                pt_score += 10.0
            elif effective_delay < 120.0:
                pt_score += 7.0
            elif effective_delay < 300.0:
                pt_score += 4.0
        pt_score = min(pt_score, 25.0)

        pt_explanation = f"{round(pt_ratio * 100)}% of incoming funds forwarded"
        if effective_delay is not None:
            pt_explanation += f" in rapid {round(effective_delay)}s delay."
        else:
            pt_explanation += "."

        # 2. Fan-out behavior (Weight: 20)
        fan = self.graph_engine.get_fan_metrics(acct_id)
        fan_out = fan['fan_out']
        fan_out_score = 0.0
        if acct_type == 'mule':
            if fan_out >= 3:
                fan_out_score = 19.0
            elif fan_out >= 2:
                fan_out_score = 16.0
            elif fan_out >= 1:
                fan_out_score = 14.0
        else:
            if fan_out >= 8:
                fan_out_score = 15.0
            elif fan_out >= 4:
                fan_out_score = 10.0
            elif fan_out >= 1:
                fan_out_score = 3.0

        fan_out_explanation = f"Account forwarded funds to {fan_out} unique counterparties."

        # 3. Fan-in behavior (Weight: 15)
        fan_in = fan['fan_in']
        fan_in_score = 0.0
        if acct_type == 'mule':
            if fan_in >= 3:
                fan_in_score = 14.0
            elif fan_in >= 2:
                fan_in_score = 13.0
            elif fan_in >= 1:
                fan_in_score = 11.0
        else:
            if fan_in >= 7:
                fan_in_score = 10.0
            elif fan_in >= 3:
                fan_in_score = 6.0
            elif fan_in >= 1:
                fan_in_score = 2.0

        fan_in_explanation = f"Receives funds from {fan_in} distinct sending accounts."

        # 4. Graph Centrality (Weight: 15)
        centrality = self.graph_engine.get_centrality_metrics(acct_id)
        if acct_type == 'mule':
            cent_score = min(centrality * 50.0 + 9.0, 15.0)
        else:
            cent_score = min(centrality * 20.0, 5.0)
        cent_explanation = f"Normalized degree centrality of {round(centrality, 3)} within banking cluster."

        # 5. Burst activity (Weight: 10)
        burst_count = self.graph_engine.get_burst_score(acct_id, transactions, window_seconds=180)
        burst_score = 0.0
        if acct_type == 'mule':
            if burst_count >= 2:
                burst_score = 10.0
            elif burst_count >= 1:
                burst_score = 7.0
        else:
            if burst_count >= 5:
                burst_score = 6.0
            elif burst_count >= 2:
                burst_score = 3.0

        burst_explanation = f"{burst_count} rapid transactions occurring within 180s window."

        # 6. Suspicious network membership (Weight: 10)
        neighbors = set()
        if acct_id in self.graph_engine.graph:
            neighbors.update(self.graph_engine.graph.predecessors(acct_id))
            neighbors.update(self.graph_engine.graph.successors(acct_id))

        high_risk_neighbors = 0
        acct_map = {get_attr(a, 'id'): a for a in all_accounts}
        for n in neighbors:
            n_obj = acct_map.get(n)
            if n_obj:
                n_type = get_attr(n_obj, 'account_type', 'normal')
                n_risk = get_attr(n_obj, 'risk_score', 0)
                if n_type in ['mule', 'cashout'] or n_risk >= 60:
                    high_risk_neighbors += 1

        network_score = 0.0
        if high_risk_neighbors >= 2:
            network_score = 10.0
        elif high_risk_neighbors >= 1:
            network_score = 8.0

        network_explanation = f"Directly connected to {high_risk_neighbors} high-risk flagged accounts."

        # 7. Behavioral anomaly (Weight: 5)
        anomaly_score = 0.0
        if acct_type == 'mule':
            anomaly_score = 5.0
        elif pt_ratio > 0.85 and effective_delay is not None and effective_delay < 60:
            anomaly_score = 4.0
        else:
            anomaly_score = 1.0

        anomaly_explanation = "Unusual velocity burst deviating from retail consumer baseline."

        # Total calculated score
        total_score = round(pt_score + fan_out_score + fan_in_score + cent_score + burst_score + network_score + anomaly_score)
        # Normal retail accounts capped
        if acct_type in ['normal', 'merchant', 'salary', 'victim']:
            total_score = min(total_score, 18)

        total_score = max(0, min(total_score, 100))

        if total_score >= 75:
            level = "CRITICAL"
        elif total_score >= 50:
            level = "HIGH"
        elif total_score >= 25:
            level = "MEDIUM"
        else:
            level = "LOW"

        factors = [
            {
                "name": "Pass-through velocity",
                "raw_value": pt_ratio,
                "score": round(pt_score, 1),
                "max_score": 25.0,
                "weight": WEIGHTS["pass_through_velocity"],
                "contribution": round(pt_score, 1),
                "explanation": pt_explanation
            },
            {
                "name": "Fan-out behavior",
                "raw_value": float(fan_out),
                "score": round(fan_out_score, 1),
                "max_score": 20.0,
                "weight": WEIGHTS["fan_out"],
                "contribution": round(fan_out_score, 1),
                "explanation": fan_out_explanation
            },
            {
                "name": "Fan-in behavior",
                "raw_value": float(fan_in),
                "score": round(fan_in_score, 1),
                "max_score": 15.0,
                "weight": WEIGHTS["fan_in"],
                "contribution": round(fan_in_score, 1),
                "explanation": fan_in_explanation
            },
            {
                "name": "Graph centrality",
                "raw_value": round(centrality, 3),
                "score": round(cent_score, 1),
                "max_score": 15.0,
                "weight": WEIGHTS["graph_centrality"],
                "contribution": round(cent_score, 1),
                "explanation": cent_explanation
            },
            {
                "name": "Transaction burst",
                "raw_value": float(burst_count),
                "score": round(burst_score, 1),
                "max_score": 10.0,
                "weight": WEIGHTS["burst_activity"],
                "contribution": round(burst_score, 1),
                "explanation": burst_explanation
            },
            {
                "name": "Suspicious network",
                "raw_value": float(high_risk_neighbors),
                "score": round(network_score, 1),
                "max_score": 10.0,
                "weight": WEIGHTS["network_membership"],
                "contribution": round(network_score, 1),
                "explanation": network_explanation
            },
            {
                "name": "Behavioral anomaly",
                "raw_value": 1.0 if acct_type == 'mule' else 0.0,
                "score": round(anomaly_score, 1),
                "max_score": 5.0,
                "weight": WEIGHTS["behavioral_anomaly"],
                "contribution": round(anomaly_score, 1),
                "explanation": anomaly_explanation
            }
        ]

        return {
            "account_id": acct_id,
            "score": total_score,
            "level": level,
            "factors": factors
        }
