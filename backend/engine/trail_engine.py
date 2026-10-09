from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from backend.engine.next_hop_engine import NextHopEngine
from backend.engine.utils import get_attr

class TrailEngine:
    def __init__(self, next_hop_engine: NextHopEngine):
        self.next_hop_engine = next_hop_engine

    def trace_money_trail(
        self,
        reported_tx_id: str,
        transactions: List[Any],
        accounts: List[Any],
        max_hops: int = 6,
        window_seconds: int = 600
    ) -> Optional[Dict[str, Any]]:
        """Reconstructs the suspicious money trail starting from reported_tx_id."""
        tx_map = {get_attr(t, 'id'): t for t in transactions}
        acct_map = {get_attr(a, 'id'): a for a in accounts}

        initial_tx = tx_map.get(reported_tx_id)
        if not initial_tx:
            return None

        def get_ts(tx):
            ts = get_attr(tx, 'timestamp')
            if isinstance(ts, str):
                try:
                    return datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except Exception:
                    return datetime.now(timezone.utc)
            return ts or datetime.now(timezone.utc)

        src_id = get_attr(initial_tx, 'source_account_id')
        dest_id = get_attr(initial_tx, 'destination_account_id')
        initial_amount = float(get_attr(initial_tx, 'amount', 0.0))
        initial_ts = get_ts(initial_tx)

        # Build initial step (Hop 0)
        trail_steps = []
        hop_0 = {
            "hop": 0,
            "transaction_id": reported_tx_id,
            "from_account": src_id,
            "to_account": dest_id,
            "amount": initial_amount,
            "timestamp": initial_ts.isoformat(),
            "delay_seconds": 0,
            "amount_retention": 1.0,
            "risk_score": get_attr(initial_tx, 'risk_score', 90),
            "selection_reason": ["Initial reported scam transfer from victim"]
        }
        trail_steps.append(hop_0)

        current_account = dest_id
        current_amount = initial_amount
        current_ts = initial_ts
        visited_accounts = {src_id, dest_id}

        for hop in range(1, max_hops):
            # Find candidate outgoing transactions from current_account after current_ts
            candidates = []
            for t in transactions:
                t_src = get_attr(t, 'source_account_id')
                t_tgt = get_attr(t, 'destination_account_id')
                t_amt = float(get_attr(t, 'amount', 0.0))
                t_ts = get_ts(t)

                if t_src == current_account and t_tgt not in visited_accounts and t_ts >= current_ts:
                    delay = (t_ts - current_ts).total_seconds()
                    if delay <= window_seconds:
                        # Calculate path heuristic score (amount conservation + timing)
                        amt_ratio = min(t_amt, current_amount) / max(t_amt, current_amount, 1.0)
                        timing_score = max(0, 1.0 - (delay / window_seconds))
                        dest_acct = acct_map.get(t_tgt)
                        dest_risk = get_attr(dest_acct, 'risk_score', 50) if dest_acct else 50

                        score = (amt_ratio * 40.0) + (timing_score * 30.0) + ((dest_risk / 100.0) * 30.0)
                        candidates.append({
                            'tx': t,
                            'score': score,
                            'delay': int(delay),
                            'amount_ratio': amt_ratio,
                            'target': t_tgt,
                            'dest_risk': dest_risk,
                            'amount': t_amt,
                            'ts': t_ts
                        })

            if not candidates:
                break

            # Pick top scored candidate
            candidates.sort(key=lambda x: x['score'], reverse=True)
            best = candidates[0]
            best_tx = best['tx']
            tx_id = get_attr(best_tx, 'id')

            reasons = [
                f"{round(best['amount_ratio'] * 100)}% fund conservation",
                f"Rapid transfer within {best['delay']} seconds",
                f"Destination account risk score {best['dest_risk']}/100"
            ]

            step = {
                "hop": hop,
                "transaction_id": tx_id,
                "from_account": current_account,
                "to_account": best['target'],
                "amount": best['amount'],
                "timestamp": best['ts'].isoformat(),
                "delay_seconds": best['delay'],
                "amount_retention": round(best['amount_ratio'], 3),
                "risk_score": get_attr(best_tx, 'risk_score', best['dest_risk']),
                "selection_reason": reasons
            }
            trail_steps.append(step)

            # Advance current
            current_account = best['target']
            current_amount = best['amount']
            current_ts = best['ts']
            visited_accounts.add(current_account)

            # If reached cashout node, stop
            curr_acct_obj = acct_map.get(current_account)
            if curr_acct_obj and getattr(curr_acct_obj, 'account_type', '') == 'cashout':
                break

        # Calculate next hop prediction for the final account in the trail
        pred_data = self.next_hop_engine.predict_next_hops(
            current_account,
            transactions,
            accounts,
            reference_amount=current_amount
        )
        predictions = pred_data.get('predictions', [])
        probable_next = predictions[0] if predictions else None
        alternatives = predictions[1:] if len(predictions) > 1 else []

        # If terminal node reached, provide the prediction from the active penultimate mule
        if not probable_next and len(trail_steps) >= 2:
            penultimate_acct = trail_steps[-2]['to_account']
            p_data = self.next_hop_engine.predict_next_hops(
                penultimate_acct,
                transactions,
                accounts,
                reference_amount=trail_steps[-2]['amount']
            )
            p_preds = p_data.get('predictions', [])
            if p_preds:
                probable_next = p_preds[0]
                alternatives = p_preds[1:]

        total_duration = sum(s['delay_seconds'] for s in trail_steps)
        last_step = trail_steps[-1]

        return {
            "case_transaction_id": reported_tx_id,
            "source": src_id,
            "initial_amount": initial_amount,
            "current_account": current_account,
            "hops": len(trail_steps),
            "total_traced_amount": last_step['amount'],
            "total_duration_seconds": total_duration,
            "trail": trail_steps,
            "probable_next_hop": probable_next,
            "alternatives": alternatives
        }
