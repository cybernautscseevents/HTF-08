from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.database import get_db
from backend.models import AccountModel, TransactionModel
from backend.engine.pipeline import pipeline

router = APIRouter(prefix="/api", tags=["Risk & Prediction"])

@router.get("/risk/account/{account_id}")
def get_account_risk(account_id: str, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {account_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    pipeline.graph_engine.build_graph(all_accounts, all_txns)

    return pipeline.risk_engine.calculate_mule_risk(account, all_txns, all_accounts)

@router.get("/risk/transaction/{transaction_id}")
def get_transaction_risk(transaction_id: str, db: Session = Depends(get_db)):
    tx = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail={"code": "TRANSACTION_NOT_FOUND", "message": f"Transaction {transaction_id} not found."})

    src_acct = db.query(AccountModel).filter(AccountModel.id == tx.source_account_id).first()
    dest_acct = db.query(AccountModel).filter(AccountModel.id == tx.destination_account_id).first()

    return {
        "transaction_id": tx.id,
        "amount": tx.amount,
        "risk_score": tx.risk_score,
        "source": {
            "id": tx.source_account_id,
            "risk_score": src_acct.risk_score if src_acct else 0,
            "type": src_acct.account_type if src_acct else "unknown"
        },
        "destination": {
            "id": tx.destination_account_id,
            "risk_score": dest_acct.risk_score if dest_acct else 0,
            "type": dest_acct.account_type if dest_acct else "unknown"
        },
        "payment_rail": getattr(tx, "payment_rail", tx.transaction_type),
        "status": tx.status
    }

@router.get("/prediction/next-hop/{account_id}")
def get_prediction_next_hop(account_id: str, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {account_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    pipeline.graph_engine.build_graph(all_accounts, all_txns)

    return pipeline.next_hop_engine.predict_next_hops(account_id, all_txns, all_accounts)
