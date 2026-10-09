from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from backend.database import get_db
from backend.models import AccountModel, TransactionModel
from backend.engine.pipeline import pipeline

router = APIRouter(prefix="/api/networks", tags=["Networks"])

@router.get("")
def get_networks(min_risk: int = 55, db: Session = Depends(get_db)):
    accounts = db.query(AccountModel).all()
    transactions = db.query(TransactionModel).all()

    pipeline.graph_engine.build_graph(accounts, transactions)
    networks = pipeline.network_detector.detect_suspicious_networks(accounts, transactions, min_risk=min_risk)
    return networks

@router.get("/{network_id}")
def get_network_detail(network_id: str, db: Session = Depends(get_db)):
    accounts = db.query(AccountModel).all()
    transactions = db.query(TransactionModel).all()

    pipeline.graph_engine.build_graph(accounts, transactions)
    networks = pipeline.network_detector.detect_suspicious_networks(accounts, transactions)

    matched = next((n for n in networks if n.get("network_id") == network_id), None)
    if not matched:
        raise HTTPException(
            status_code=404,
            detail={"code": "NETWORK_NOT_FOUND", "message": f"Syndicate network {network_id} not found."}
        )

    # Get accounts in network
    key_accounts = matched.get("key_accounts", [])
    acct_objs = db.query(AccountModel).filter(AccountModel.id.in_(key_accounts)).all()

    # Get internal transactions
    internal_txns = db.query(TransactionModel).filter(
        TransactionModel.source_account_id.in_(key_accounts),
        TransactionModel.destination_account_id.in_(key_accounts)
    ).all()

    return {
        "network": matched,
        "accounts": [
            {
                "id": a.id,
                "display_name": a.display_name,
                "bank": a.bank,
                "risk_score": a.risk_score,
                "risk_level": a.risk_level,
                "status": a.status
            }
            for a in acct_objs
        ],
        "transactions": [
            {
                "id": t.id,
                "source": t.source_account_id,
                "destination": t.destination_account_id,
                "amount": t.amount,
                "timestamp": t.timestamp.isoformat(),
                "type": t.transaction_type
            }
            for t in internal_txns
        ]
    }
