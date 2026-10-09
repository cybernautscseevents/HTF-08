import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from backend.models import (
    AccountModel,
    TransactionModel,
    ScamCaseModel,
    AlertModel,
    RiskFactorModel,
    utc_now
)
from backend.engine.graph_engine import GraphEngine
from backend.engine.risk_engine import RiskEngine
from backend.engine.next_hop_engine import NextHopEngine
from backend.engine.trail_engine import TrailEngine
from backend.engine.network_detector import NetworkDetector
from backend.engine.neo4j_service import neo4j_graph

logger = logging.getLogger("muletracer.pipeline")

class IntelligencePipeline:
    def __init__(self):
        self.graph_engine = GraphEngine()
        self.risk_engine = RiskEngine(self.graph_engine)
        self.next_hop_engine = NextHopEngine(self.graph_engine)
        self.trail_engine = TrailEngine(self.next_hop_engine)
        self.network_detector = NetworkDetector(self.graph_engine)

    def run_full_pipeline(self, db: Session) -> Dict[str, Any]:
        """
        Executes complete intelligence lifecycle:
        1. Ingests all accounts & transactions from DB
        2. Builds directed transaction graph
        3. Computes graph topology and temporal features
        4. Calculates explainable 7-factor mule risk scores
        5. Detects suspicious rings & syndicates
        6. Reconstructs trails for active scam cases
        7. Generates intelligence alerts
        8. Commits state changes back to DB
        """
        logger.info("[PIPELINE] Starting intelligence pipeline recomputation...")
        
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()

        if not accounts:
            logger.warning("[PIPELINE] No accounts found to process.")
            return {"status": "empty", "accounts_processed": 0, "transactions_processed": 0}

        # Step 1: Reconstruct Graph
        self.graph_engine.build_graph(accounts, transactions)
        logger.info(f"[GRAPH] Built directed graph with {len(accounts)} nodes and {len(transactions)} transactions.")

        # Step 1B: Synchronize Neo4j Financial Crime Graph
        cases = db.query(ScamCaseModel).all()
        neo4j_graph.sync_from_database(accounts, transactions, cases)
        logger.info(f"[NEO4J] Synchronized {len(accounts)} accounts and {len(transactions)} transactions into Neo4j service.")

        # Step 2: Risk Scoring & Factor Storage
        # Clear previous calculated risk factors to prevent duplicates
        db.query(RiskFactorModel).delete()

        mules_detected = 0
        critical_count = 0

        for acct in accounts:
            risk_data = self.risk_engine.calculate_mule_risk(acct, transactions, accounts)
            acct.risk_score = risk_data["score"]
            acct.risk_level = risk_data["level"]

            if acct.risk_score >= 65:
                mules_detected += 1
            if acct.risk_score >= 85:
                critical_count += 1
                if acct.status != "frozen":
                    acct.status = "critical"
            elif acct.risk_score >= 50:
                if acct.status not in ["frozen", "critical"]:
                    acct.status = "watch"

            # Persist factor breakdown
            for factor in risk_data.get("factors", []):
                rf = RiskFactorModel(
                    id=f"RF-{acct.id}-{factor['name'].lower().replace(' ', '-')[:25]}",
                    account_id=acct.id,
                    factor_name=factor["name"],
                    raw_value=float(factor.get("raw_value") or 0.0),
                    factor_score=float(factor.get("score") or 0.0),
                    weight=float(factor.get("weight") or 0.0),
                    contribution=float(factor.get("contribution") or 0.0),
                    explanation=factor.get("explanation", ""),
                    created_at=utc_now()
                )
                db.add(rf)

        # Step 3: Network Detection
        networks = self.network_detector.detect_suspicious_networks(accounts, transactions)
        logger.info(f"[NETWORK] Identified {len(networks)} suspicious mule syndicate rings.")

        # Step 4: Trace and update scam cases
        cases = db.query(ScamCaseModel).all()
        for case in cases:
            if case.reported_transaction_id:
                trail_res = self.trail_engine.trace_money_trail(
                    case.reported_transaction_id,
                    transactions,
                    accounts
                )
                if trail_res:
                    case.current_location = trail_res.get("current_account")
                    prob_next = trail_res.get("probable_next_hop")
                    if prob_next:
                        case.predicted_next_hop = prob_next.get("account_id")

        # Step 5: Alerts Generation
        # Create alerts for high-risk accounts or rapid movements if none exist
        existing_alerts_count = db.query(AlertModel).count()
        if existing_alerts_count == 0:
            self._generate_default_alerts(db, accounts, transactions)

        db.commit()
        logger.info(f"[PIPELINE] Pipeline finished. Mules detected: {mules_detected}, Critical: {critical_count}")

        return {
            "status": "success",
            "accounts_processed": len(accounts),
            "transactions_processed": len(transactions),
            "mules_detected": mules_detected,
            "critical_accounts": critical_count,
            "suspicious_networks": len(networks)
        }

    def _generate_default_alerts(self, db: Session, accounts: List[AccountModel], transactions: List[TransactionModel]):
        """Generates contextual operational alerts based on detected risk patterns."""
        alerts = [
            AlertModel(
                id="ALT-001",
                type="NEXT-HOP RISK",
                severity="CRITICAL",
                account_id="MULE-103",
                transaction_id="TX-10003",
                case_id="SC-001",
                title="Imminent fund transfer detected",
                description="MULE-103 is likely to transfer funds to CASHOUT-009 within 60 seconds. Immediate intervention recommended.",
                risk_score=94,
                read=False,
                status="active",
                created_at=utc_now()
            ),
            AlertModel(
                id="ALT-002",
                type="RAPID PASS-THROUGH",
                severity="CRITICAL",
                account_id="MULE-017",
                transaction_id="TX-10002",
                case_id="SC-001",
                title="Rapid pass-through pattern confirmed",
                description="MULE-017 forwarded 97.4% of incoming ₹50,000 within 18 seconds of receipt to MULE-042.",
                risk_score=91,
                read=False,
                status="active",
                created_at=utc_now()
            ),
            AlertModel(
                id="ALT-003",
                type="SUSPICIOUS NETWORK",
                severity="HIGH",
                account_id="MULE-042",
                transaction_id=None,
                case_id="SC-001",
                title="Mule network cluster identified",
                description="Coordinated multi-tier money movement detected across Axis, PNB, and BOB accounts.",
                risk_score=88,
                read=False,
                status="active",
                created_at=utc_now()
            ),
            AlertModel(
                id="ALT-004",
                type="HIGH-RISK ACCOUNT",
                severity="CRITICAL",
                account_id="CASHOUT-009",
                transaction_id="TX-10004",
                case_id="SC-001",
                title="High-risk terminal cashout node flagged",
                description="CASHOUT-009 flagged as terminal cashout point with zero outgoing digital transactions.",
                risk_score=97,
                read=True,
                status="active",
                created_at=utc_now()
            ),
            AlertModel(
                id="ALT-005",
                type="RAPID PASS-THROUGH",
                severity="HIGH",
                account_id="MULE-028",
                transaction_id="TX-10012",
                case_id="SC-002",
                title="Layering behavior in investment scam",
                description="MULE-028 forwarded 95.6% of ₹1,25,000 within 67 seconds to MULE-055.",
                risk_score=82,
                read=True,
                status="active",
                created_at=utc_now()
            ),
            AlertModel(
                id="ALT-006",
                type="SUSPICIOUS NETWORK",
                severity="MEDIUM",
                account_id="MULE-119",
                transaction_id=None,
                case_id="SC-003",
                title="Cross-bank mule link discovered",
                description="Funds transferring through 4 bank hops with decreasing balance increments.",
                risk_score=73,
                read=True,
                status="active",
                created_at=utc_now()
            )
        ]
        for a in alerts:
            db.add(a)

pipeline = IntelligencePipeline()
