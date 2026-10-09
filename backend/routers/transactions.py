from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
from backend.models import TransactionModel, AccountModel
from backend.schemas import TransactionResponse, MoneyTrailResponse
from backend.engine.pipeline import pipeline

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=List[TransactionResponse])
def get_transactions(
    risk: Optional[int] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    source: Optional[str] = None,
    destination: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(TransactionModel)

    if risk is not None:
        query = query.filter(TransactionModel.risk_score >= risk)
    if min_amount is not None:
        query = query.filter(TransactionModel.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(TransactionModel.amount <= max_amount)
    if start_time:
        query = query.filter(TransactionModel.timestamp >= start_time)
    if end_time:
        query = query.filter(TransactionModel.timestamp <= end_time)
    if source:
        query = query.filter(TransactionModel.source_account_id == source)
    if destination:
        query = query.filter(TransactionModel.destination_account_id == destination)
    if status:
        query = query.filter(TransactionModel.status.ilike(status))

    return query.order_by(TransactionModel.timestamp.desc()).offset(offset).limit(limit).all()

@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    tx = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail={"code": "TRANSACTION_NOT_FOUND", "message": f"Transaction {transaction_id} not found."})
    return tx

@router.get("/{transaction_id}/trail")
def get_transaction_trail(transaction_id: str, db: Session = Depends(get_db)):
    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()

    trail_res = pipeline.trail_engine.trace_money_trail(transaction_id, all_txns, all_accounts)
    if not trail_res:
        raise HTTPException(status_code=404, detail={"code": "TRAIL_NOT_FOUND", "message": f"Could not construct trail for transaction {transaction_id}."})
    return trail_res

@router.get("/{transaction_id}/next-hops")
def get_transaction_next_hops(transaction_id: str, db: Session = Depends(get_db)):
    tx = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail={"code": "TRANSACTION_NOT_FOUND", "message": f"Transaction {transaction_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    pipeline.graph_engine.build_graph(all_accounts, all_txns)

    return pipeline.next_hop_engine.predict_next_hops(
        tx.destination_account_id,
        all_txns,
        all_accounts,
        reference_amount=tx.amount
    )
