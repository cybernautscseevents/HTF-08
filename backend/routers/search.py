from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.database import get_db
from backend.models import AccountModel, TransactionModel, ScamCaseModel, AlertModel
from backend.schemas import AccountResponse, TransactionResponse, ScamCaseResponse, AlertResponse

router = APIRouter(prefix="/api/search", tags=["Search"])

@router.get("")
def search_all(q: str = Query(..., min_length=1, description="Search keyword"), db: Session = Depends(get_db)):
    pat = f"%{q}%"

    # Search accounts
    accounts = db.query(AccountModel).filter(
        (AccountModel.id.ilike(pat)) |
        (AccountModel.display_name.ilike(pat)) |
        (AccountModel.bank.ilike(pat))
    ).limit(10).all()

    # Search transactions
    txns = db.query(TransactionModel).filter(
        (TransactionModel.id.ilike(pat)) |
        (TransactionModel.source_account_id.ilike(pat)) |
        (TransactionModel.destination_account_id.ilike(pat)) |
        (TransactionModel.description.ilike(pat))
    ).limit(10).all()

    # Search cases
    cases = db.query(ScamCaseModel).filter(
        (ScamCaseModel.id.ilike(pat)) |
        (ScamCaseModel.victim_account_id.ilike(pat)) |
        (ScamCaseModel.case_type.ilike(pat)) |
        (ScamCaseModel.description.ilike(pat))
    ).limit(10).all()

    # Search alerts
    alerts = db.query(AlertModel).filter(
        (AlertModel.id.ilike(pat)) |
        (AlertModel.title.ilike(pat)) |
        (AlertModel.description.ilike(pat)) |
        (AlertModel.account_id.ilike(pat))
    ).limit(10).all()

    return {
        "query": q,
        "accounts": [AccountResponse.from_orm(a) for a in accounts],
        "transactions": [TransactionResponse.from_orm(t) for t in txns],
        "cases": [ScamCaseResponse.from_orm(c) for c in cases],
        "alerts": [AlertResponse.from_orm(al) for al in alerts]
    }
