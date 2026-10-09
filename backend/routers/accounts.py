from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from backend.database import get_db
from backend.models import (
    AccountModel,
    TransactionModel,
    RiskFactorModel,
    ScamCaseModel
)
from backend.schemas import (
    AccountResponse,
    AccountDetailResponse,
    RiskFactorSchema,
    TransactionResponse,
    NextHopCandidateResponse
)
from backend.engine.pipeline import pipeline

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("", response_model=List[AccountResponse])
def get_accounts(
    risk_level: Optional[str] = None,
    account_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(AccountModel)

    if risk_level:
        query = query.filter(AccountModel.risk_level.ilike(risk_level))
    if account_type:
        query = query.filter(AccountModel.account_type.ilike(account_type))
    if status:
        query = query.filter(AccountModel.status.ilike(status))
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (AccountModel.id.ilike(search_pattern)) |
            (AccountModel.display_name.ilike(search_pattern)) |
            (AccountModel.bank.ilike(search_pattern))
        )

    return query.order_by(AccountModel.risk_score.desc()).offset(offset).limit(limit).all()

@router.get("/{account_id}", response_model=AccountDetailResponse)
def get_account_detail(account_id: str, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {account_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()

    # Rebuild graph if needed
    if account_id not in pipeline.graph_engine.graph:
        pipeline.graph_engine.build_graph(all_accounts, all_txns)

    deg = pipeline.graph_engine.get_degree_metrics(account_id)
    fan = pipeline.graph_engine.get_fan_metrics(account_id)
    pt_ratio = pipeline.graph_engine.get_pass_through_ratio(account_id)
    vel = pipeline.graph_engine.get_velocity_metrics(account_id, all_txns)
    cent = pipeline.graph_engine.get_centrality_metrics(account_id)

    # Fetch stored risk factors
    factors_db = db.query(RiskFactorModel).filter(RiskFactorModel.account_id == account_id).all()
    factor_schemas = []
    if factors_db:
        for f in factors_db:
            factor_schemas.append(RiskFactorSchema(
                name=f.factor_name,
                raw_value=f.raw_value,
                score=f.factor_score,
                max_score=25.0,
                weight=f.weight,
                contribution=f.contribution,
                explanation=f.explanation
            ))
    else:
        # Calculate dynamically if not yet seeded
        risk_calc = pipeline.risk_engine.calculate_mule_risk(account, all_txns, all_accounts)
        for f in risk_calc.get("factors", []):
            factor_schemas.append(RiskFactorSchema(
                name=f["name"],
                raw_value=f.get("raw_value"),
                score=f["score"],
                max_score=f.get("max_score", 25.0),
                weight=f["weight"],
                contribution=f["contribution"],
                explanation=f["explanation"]
            ))

    # Shared devices
    shared_devices = []
    if account.device_id:
        shared_devices = [
            a.id for a in all_accounts
            if getattr(a, 'device_id', None) == account.device_id and a.id != account.id
        ]

    # Recent transactions
    recent_txns = db.query(TransactionModel).filter(
        (TransactionModel.source_account_id == account_id) |
        (TransactionModel.destination_account_id == account_id)
    ).order_by(TransactionModel.timestamp.desc()).limit(10).all()

    return AccountDetailResponse(
        id=account.id,
        display_name=account.display_name,
        bank=account.bank,
        account_type=account.account_type,
        status=account.status,
        risk_score=account.risk_score,
        risk_level=account.risk_level,
        device_id=account.device_id,
        total_incoming=account.total_incoming,
        total_outgoing=account.total_outgoing,
        transaction_count=account.transaction_count,
        first_seen=account.first_seen,
        in_degree=deg["in_degree"],
        out_degree=deg["out_degree"],
        fan_in=fan["fan_in"],
        fan_out=fan["fan_out"],
        pass_through_ratio=pt_ratio,
        avg_velocity_seconds=vel.get("avg_delay"),
        centrality=cent,
        shared_device_accounts=shared_devices,
        risk_factors=factor_schemas,
        recent_transactions=[
            {
                "id": t.id,
                "source": t.source_account_id,
                "destination": t.destination_account_id,
                "amount": t.amount,
                "timestamp": t.timestamp.isoformat(),
                "type": t.transaction_type,
                "status": t.status,
                "risk_score": t.risk_score
            } for t in recent_txns
        ]
    )

@router.get("/{account_id}/risk")
def get_account_risk(account_id: str, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {account_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    pipeline.graph_engine.build_graph(all_accounts, all_txns)
    return pipeline.risk_engine.calculate_mule_risk(account, all_txns, all_accounts)

@router.get("/{account_id}/transactions", response_model=List[TransactionResponse])
def get_account_transactions(
    account_id: str,
    direction: Optional[str] = Query(None, description="'incoming' or 'outgoing'"),
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(TransactionModel)
    if direction == "incoming":
        query = query.filter(TransactionModel.destination_account_id == account_id)
    elif direction == "outgoing":
        query = query.filter(TransactionModel.source_account_id == account_id)
    else:
        query = query.filter(
            (TransactionModel.source_account_id == account_id) |
            (TransactionModel.destination_account_id == account_id)
        )
    return query.order_by(TransactionModel.timestamp.desc()).limit(limit).all()

@router.get("/{account_id}/neighbors")
def get_account_neighbors(account_id: str, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {account_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    pipeline.graph_engine.build_graph(all_accounts, all_txns)

    predecessors = list(pipeline.graph_engine.graph.predecessors(account_id)) if account_id in pipeline.graph_engine.graph else []
    successors = list(pipeline.graph_engine.graph.successors(account_id)) if account_id in pipeline.graph_engine.graph else []

    pred_accounts = db.query(AccountModel).filter(AccountModel.id.in_(predecessors)).all() if predecessors else []
    succ_accounts = db.query(AccountModel).filter(AccountModel.id.in_(successors)).all() if successors else []

    return {
        "account_id": account_id,
        "incoming_senders": [AccountResponse.from_orm(p) for p in pred_accounts],
        "outgoing_destinations": [AccountResponse.from_orm(s) for s in succ_accounts]
    }

@router.get("/{account_id}/next-hops")
def get_account_next_hops(account_id: str, db: Session = Depends(get_db)):
    account = db.query(AccountModel).filter(AccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {account_id} not found."})

    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    pipeline.graph_engine.build_graph(all_accounts, all_txns)

    return pipeline.next_hop_engine.predict_next_hops(account_id, all_txns, all_accounts)

@router.get("/{account_id}/network")
def get_account_network(account_id: str, db: Session = Depends(get_db)):
    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    networks = pipeline.network_detector.detect_suspicious_networks(all_accounts, all_txns)

    matching = [n for n in networks if account_id in n.get("key_accounts", []) or any(account_id in n.get("key_accounts", []) for _ in [1])]
    return {
        "account_id": account_id,
        "networks": matching
    }
