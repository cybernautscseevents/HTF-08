from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import TransactionModel, AccountModel, ScamCaseModel
from backend.schemas import MoneyTrailResponse
from backend.engine.pipeline import pipeline

router = APIRouter(prefix="/api/trail", tags=["Money Trail"])

@router.get("/{transaction_id}")
def trace_money_trail(transaction_id: str, db: Session = Depends(get_db)):
    tx = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not tx:
        raise HTTPException(
            status_code=404,
            detail={"code": "TRANSACTION_NOT_FOUND", "message": f"Transaction {transaction_id} not found."}
        )

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()

    # Reconstruct the trail
    trail_res = pipeline.trail_engine.trace_money_trail(
        transaction_id,
        all_txns,
        all_accounts
    )

    if not trail_res:
        raise HTTPException(
            status_code=404,
            detail={"code": "TRAIL_NOT_FOUND", "message": f"Unable to construct money trail for {transaction_id}."}
        )

    # Check if this transaction is linked to a registered scam case
    case = db.query(ScamCaseModel).filter(ScamCaseModel.reported_transaction_id == transaction_id).first()
    if case:
        trail_res["case_id"] = case.id

    return trail_res
