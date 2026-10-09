from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from backend.database import get_db
from backend.models import AccountModel, ScamCaseModel, InvestigationActionModel, AuditLogModel, utc_now
from backend.schemas import ActionCreate, ActionResponse, AuditLogCreate, AuditLogResponse

router = APIRouter(prefix="/api/actions", tags=["Investigator Actions"])

@router.get("", response_model=List[ActionResponse])
def get_actions(limit: int = 50, db: Session = Depends(get_db)):
    actions = db.query(InvestigationActionModel).order_by(InvestigationActionModel.performed_at.desc()).limit(limit).all()
    res = []
    for a in actions:
        res.append(ActionResponse(
            id=a.id,
            status=a.status,
            simulated=a.simulated,
            account_id=a.account_id,
            case_id=a.case_id,
            action_type=a.action_type,
            performed_at=a.performed_at,
            performed_by=a.performed_by,
            message=a.notes or f"Simulated {a.action_type} executed."
        ))
    return res

@router.post("/freeze-recommendation", response_model=ActionResponse)
def freeze_recommendation(payload: ActionCreate, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {payload.account_id} not found."})

    # Update account status to simulated frozen
    account.status = "frozen"

    act_id = f"ACT-{int(datetime.now().timestamp() * 1000)}"
    action = InvestigationActionModel(
        id=act_id,
        case_id=payload.case_id,
        account_id=payload.account_id,
        action_type="FREEZE_RECOMMENDED",
        performed_at=utc_now(),
        performed_by="S. Krishnan (Sr. Fraud Investigator)",
        status="REVIEW_INITIATED",
        simulated=True,
        notes=payload.reason or "High probability next-hop account. Freeze review recommended."
    )
    db.add(action)
    db.commit()

    return ActionResponse(
        id=act_id,
        status="REVIEW_INITIATED",
        simulated=True,
        account_id=payload.account_id,
        case_id=payload.case_id,
        action_type="FREEZE_RECOMMENDED",
        performed_at=action.performed_at,
        performed_by=action.performed_by,
        message=f"Simulated freeze review recommendation recorded for {account.id} ({account.display_name})."
    )

@router.post("/flag-account", response_model=ActionResponse)
def flag_account(payload: ActionCreate, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {payload.account_id} not found."})

    if account.status != "frozen":
        account.status = "critical"

    act_id = f"ACT-{int(datetime.now().timestamp() * 1000)}"
    action = InvestigationActionModel(
        id=act_id,
        case_id=payload.case_id,
        account_id=payload.account_id,
        action_type="FLAG_ACCOUNT",
        performed_at=utc_now(),
        performed_by="S. Krishnan (Sr. Fraud Investigator)",
        status="FLAGGED",
        simulated=True,
        notes=payload.reason or "Flagged during mule ring investigation."
    )
    db.add(action)
    db.commit()

    return ActionResponse(
        id=act_id,
        status="FLAGGED",
        simulated=True,
        account_id=payload.account_id,
        case_id=payload.case_id,
        action_type="FLAG_ACCOUNT",
        performed_at=action.performed_at,
        performed_by=action.performed_by,
        message=f"Account {payload.account_id} flagged for enhanced monitoring."
    )

@router.post("/watchlist", response_model=ActionResponse)
def add_watchlist(payload: ActionCreate, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {payload.account_id} not found."})

    if account.status == "normal":
        account.status = "watch"

    act_id = f"ACT-{int(datetime.now().timestamp() * 1000)}"
    action = InvestigationActionModel(
        id=act_id,
        case_id=payload.case_id,
        account_id=payload.account_id,
        action_type="ADD_TO_WATCHLIST",
        performed_at=utc_now(),
        performed_by="S. Krishnan (Sr. Fraud Investigator)",
        status="WATCHLISTED",
        simulated=True,
        notes=payload.reason or "Added to high-velocity watch list."
    )
    db.add(action)
    db.commit()

    return ActionResponse(
        id=act_id,
        status="WATCHLISTED",
        simulated=True,
        account_id=payload.account_id,
        case_id=payload.case_id,
        action_type="ADD_TO_WATCHLIST",
        performed_at=action.performed_at,
        performed_by=action.performed_by,
        message=f"Account {payload.account_id} added to active surveillance watchlist."
    )

@router.post("/mark-critical", response_model=ActionResponse)
def mark_critical(payload: ActionCreate, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == payload.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {payload.account_id} not found."})

    account.status = "critical"
    account.risk_level = "CRITICAL"
    if account.risk_score < 85:
        account.risk_score = 88

    act_id = f"ACT-{int(datetime.now().timestamp() * 1000)}"
    action = InvestigationActionModel(
        id=act_id,
        case_id=payload.case_id,
        account_id=payload.account_id,
        action_type="MARK_CRITICAL",
        performed_at=utc_now(),
        performed_by="S. Krishnan (Sr. Fraud Investigator)",
        status="CRITICAL_ESCALATION",
        simulated=True,
        notes=payload.reason or "Marked as critical syndicate node."
    )
    db.add(action)
    db.commit()

    return ActionResponse(
        id=act_id,
        status="CRITICAL_ESCALATION",
        simulated=True,
        account_id=payload.account_id,
        case_id=payload.case_id,
        action_type="MARK_CRITICAL",
        performed_at=action.performed_at,
        performed_by=action.performed_by,
        message=f"Account {payload.account_id} marked as CRITICAL."
    )

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(AuditLogModel).order_by(AuditLogModel.created_at.desc()).limit(limit).all()
    return logs

@router.post("/audit-logs", response_model=AuditLogResponse)
def create_audit_log(payload: AuditLogCreate, db: Session = Depends(get_db)):
    log_id = f"AUD-{int(datetime.now().timestamp() * 1000)}"
    new_log = AuditLogModel(
        id=log_id,
        action=payload.action,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        actor=payload.actor or "S. Krishnan (Lead Investigator)",
        details=payload.details,
        created_at=utc_now()
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log
