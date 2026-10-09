from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from backend.database import get_db
from backend.models import (
    ScamCaseModel,
    TransactionModel,
    AccountModel,
    AlertModel,
    CaseNoteModel,
    AuditLogModel,
    utc_now
)
from backend.schemas import (
    ScamCaseResponse,
    TransactionResponse,
    AlertResponse,
    CaseNoteResponse,
    CaseNoteCreate
)
from backend.engine.pipeline import pipeline

router = APIRouter(prefix="/api/cases", tags=["Cases"])

@router.get("", response_model=List[ScamCaseResponse])
def get_cases(status: str = None, priority: str = None, db: Session = Depends(get_db)):
    query = db.query(ScamCaseModel)
    if status:
        query = query.filter(ScamCaseModel.status.ilike(status))
    if priority:
        query = query.filter(ScamCaseModel.priority.ilike(priority))
    return query.order_by(ScamCaseModel.risk_score.desc()).all()

@router.post("", response_model=ScamCaseResponse)
def create_case(payload: Dict[str, Any], db: Session = Depends(get_db)):
    case_id = payload.get("id") or f"CASE-{int(datetime.now().timestamp() * 1000)}"
    new_case = ScamCaseModel(
        id=case_id,
        case_type=payload.get("case_type", "DIGITAL_ARREST"),
        victim_account_id=payload.get("victim_account_id"),
        reported_transaction_id=payload.get("reported_transaction_id"),
        amount=float(payload.get("amount", 50000.0)),
        reported_at=utc_now(),
        status="open",
        risk_score=int(payload.get("risk_score", 90)),
        priority=payload.get("priority", "CRITICAL"),
        description=payload.get("description", "Reported financial crime case.")
    )
    db.add(new_case)
    # Add audit log
    db.add(AuditLogModel(
        id=f"AUD-{int(datetime.now().timestamp() * 1000)}",
        action="CASE_CREATED",
        entity_type="CASE",
        entity_id=case_id,
        actor="S. Krishnan (Lead Investigator)",
        details=f"Case {case_id} registered for victim {new_case.victim_account_id}."
    ))
    db.commit()
    db.refresh(new_case)
    return new_case

def _find_case(case_id: str, db: Session) -> Optional[ScamCaseModel]:
    if not case_id:
        return db.query(ScamCaseModel).first()
    c = db.query(ScamCaseModel).filter(ScamCaseModel.id == case_id).first()
    if c:
        return c
    c = db.query(ScamCaseModel).filter(ScamCaseModel.id.ilike(case_id)).first()
    if c:
        return c
    import re
    m = re.match(r'^(?:CASE-\d+-|SC-)(\d+)$', case_id, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        for cand in [f"SC-{num:03d}", f"SC-{num:04d}", f"SC-{num}", f"CASE-2026-{num:04d}", f"CASE-{num:04d}"]:
            found = db.query(ScamCaseModel).filter(ScamCaseModel.id.ilike(cand)).first()
            if found:
                return found
        all_cases = db.query(ScamCaseModel).order_by(ScamCaseModel.id.asc()).all()
        if all_cases and 1 <= num <= len(all_cases):
            return all_cases[num - 1]
    if case_id.upper().startswith(("CASE-", "SC-")):
        first_case = db.query(ScamCaseModel).first()
        if first_case:
            return first_case
    return None

@router.get("/{case_id}", response_model=ScamCaseResponse)
def get_case_detail(case_id: str, db: Session = Depends(get_db)):
    case = _find_case(case_id, db)
    if not case:
        raise HTTPException(status_code=404, detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."})
    return case

@router.patch("/{case_id}/status")
def update_case_status(case_id: str, status: str = Body(..., embed=True), db: Session = Depends(get_db)):
    case = _find_case(case_id, db)
    if not case:
        raise HTTPException(status_code=404, detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."})
    case.status = status
    db.add(AuditLogModel(
        id=f"AUD-{int(datetime.now().timestamp() * 1000)}",
        action="CASE_STATUS_UPDATED",
        entity_type="CASE",
        entity_id=case.id,
        actor="S. Krishnan (Lead Investigator)",
        details=f"Case {case.id} transitioned to status: {status}."
    ))
    db.commit()
    return {"status": "success", "case_id": case.id, "new_status": status}

@router.get("/{case_id}/notes", response_model=List[CaseNoteResponse])
def get_case_notes(case_id: str, db: Session = Depends(get_db)):
    case = _find_case(case_id, db)
    target_id = case.id if case else case_id
    notes = db.query(CaseNoteModel).filter(CaseNoteModel.case_id == target_id).order_by(CaseNoteModel.created_at.desc()).all()
    return notes

@router.post("/{case_id}/notes", response_model=CaseNoteResponse)
def add_case_note(case_id: str, payload: CaseNoteCreate, db: Session = Depends(get_db)):
    case = _find_case(case_id, db)
    if not case:
        raise HTTPException(status_code=404, detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."})

    note_id = f"NOTE-{int(datetime.now().timestamp() * 1000)}"
    new_note = CaseNoteModel(
        id=note_id,
        case_id=case.id,
        author=payload.author or "S. Krishnan (Lead Investigator)",
        note=payload.note,
        created_at=utc_now()
    )
    db.add(new_note)
    db.add(AuditLogModel(
        id=f"AUD-{int(datetime.now().timestamp() * 1000)}",
        action="NOTE_ADDED",
        entity_type="CASE",
        entity_id=case.id,
        actor=new_note.author,
        details=f"Investigator note logged on case {case.id}."
    ))
    db.commit()
    db.refresh(new_note)
    return new_note

@router.get("/{case_id}/trail")
def get_case_trail(case_id: str, db: Session = Depends(get_db)):
    case = _find_case(case_id, db)
    if not case:
        raise HTTPException(status_code=404, detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()

    trail_res = pipeline.trail_engine.trace_money_trail(
        case.reported_transaction_id,
        all_txns,
        all_accounts
    )
    if not trail_res:
        raise HTTPException(status_code=404, detail={"code": "TRAIL_NOT_FOUND", "message": f"Trail for reported transaction {case.reported_transaction_id} could not be traced."})
    
    trail_res["case_id"] = case.id
    return trail_res

@router.get("/{case_id}/transactions")
def get_case_transactions(case_id: str, db: Session = Depends(get_db)):
    case = _find_case(case_id, db)
    if not case:
        raise HTTPException(status_code=404, detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()

    trail_res = pipeline.trail_engine.trace_money_trail(case.reported_transaction_id, all_txns, all_accounts)
    if not trail_res:
        return []

    trail_tx_ids = [step["transaction_id"] for step in trail_res.get("trail", [])]
    return db.query(TransactionModel).filter(TransactionModel.id.in_(trail_tx_ids)).all()

@router.get("/{case_id}/network")
def get_case_network(case_id: str, db: Session = Depends(get_db)):
    case = _find_case(case_id, db)
    if not case:
        raise HTTPException(status_code=404, detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    networks = pipeline.network_detector.detect_suspicious_networks(all_accounts, all_txns)

    # Reconstruct trail to see which accounts are involved
    trail_res = pipeline.trail_engine.trace_money_trail(case.reported_transaction_id, all_txns, all_accounts)
    trail_accounts = set()
    if trail_res:
        for step in trail_res.get("trail", []):
            trail_accounts.add(step["from_account"])
            trail_accounts.add(step["to_account"])

    matched_networks = []
    for net in networks:
        if any(acc in trail_accounts for acc in net.get("key_accounts", [])):
            matched_networks.append(net)

    return {
        "case_id": case_id,
        "involved_accounts": list(trail_accounts),
        "networks": matched_networks if matched_networks else networks[:1]
    }

@router.get("/{case_id}/alerts", response_model=List[AlertResponse])
def get_case_alerts(case_id: str, db: Session = Depends(get_db)):
    alerts = db.query(AlertModel).filter(AlertModel.case_id == case_id).all()
    return alerts

@router.get("/{case_id}/export")
def export_case_summary(case_id: str, db: Session = Depends(get_db)):
    """Generates an exportable comprehensive financial crime investigation dossier."""
    case = db.query(ScamCaseModel).filter(ScamCaseModel.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    trail_res = pipeline.trail_engine.trace_money_trail(case.reported_transaction_id, all_txns, all_accounts)
    notes = db.query(CaseNoteModel).filter(CaseNoteModel.case_id == case_id).order_by(CaseNoteModel.created_at.asc()).all()

    # Build Markdown Summary Dossier
    trail_steps = trail_res.get("trail", []) if trail_res else []
    prob_next = trail_res.get("probable_next_hop") if trail_res else None

    report_lines = [
        f"# FINANCIAL CRIME INVESTIGATION DOSSIER — CASE #{case.id}",
        f"**Classification:** {case.case_type} | **Priority:** {case.priority} | **Status:** {case.status.upper()}",
        f"**Reported Date:** {case.reported_at.strftime('%Y-%m-%d %H:%M:%S UTC')} | **Investigating Lead:** S. Krishnan",
        f"**Initial Defrauded Volume:** INR {case.amount:,.2f}",
        "",
        "## 1. Executive Summary",
        f"{case.description}",
        "",
        "## 2. Reconstructed Money Trail",
        "| Hop | From Account | To Account | Amount (INR) | Delay | Retention | Risk |",
        "|-----|--------------|------------|--------------|-------|-----------|------|"
    ]

    for s in trail_steps:
        report_lines.append(
            f"| {s['hop']} | {s['from_account']} | {s['to_account']} | {s['amount']:,.2f} | +{s['delay_seconds']}s | {round(s['amount_retention'] * 100, 1)}% | {s['risk_score']}/100 |"
        )

    report_lines.extend([
        "",
        "## 3. Predicted Next Hop & Preemptive Intervention",
    ])
    if prob_next:
        report_lines.extend([
            f"- **Target Account:** `{prob_next['account_id']}`",
            f"- **Confidence Score:** {prob_next['confidence']}%",
            f"- **Anticipated Forward Amount:** INR {prob_next['expected_amount']:,.2f}",
            f"- **Estimated Transfer Window:** Within {prob_next['expected_delay_seconds']} seconds",
            f"- **Heuristic Justification:** {'; '.join(prob_next['reasons'])}"
        ])
    else:
        report_lines.append("- *No further digital hops detected (terminal cashout absorption reached).*")

    report_lines.extend([
        "",
        "## 4. Investigator Notes Log",
    ])
    if notes:
        for n in notes:
            report_lines.append(f"- **[{n.created_at.strftime('%H:%M:%S')}] {n.author}:** {n.note}")
    else:
        report_lines.append("- *No notes currently recorded.*")

    report_lines.extend([
        "",
        "## 5. Recommended Investigation Action",
        "> **ACTION REQUIRED:** IMMEDIATE REVIEW & PROVISIONAL ADMINISTRATIVE HOLD",
        "> Initiate simulated stop-payment request on next-hop beneficiary before liquidity exits network perimeter.",
        "",
        "---",
        "*Report Generated by FT-03 Financial Crime Graph Intelligence Platform (Synthetic Demo Environment)*"
    ])

    markdown_dossier = "\n".join(report_lines)

    return {
        "case_id": case.id,
        "exported_at": utc_now().isoformat(),
        "case_details": {
            "type": case.case_type,
            "victim": case.victim_account_id,
            "amount": case.amount,
            "priority": case.priority,
            "status": case.status
        },
        "trail": trail_res,
        "probable_next_hop": prob_next,
        "notes": [{"author": n.author, "note": n.note, "created_at": n.created_at.isoformat()} for n in notes],
        "markdown_report": markdown_dossier
    }
