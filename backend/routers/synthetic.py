import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict, Any

from backend.database import get_db
from backend.models import (
    AccountModel,
    TransactionModel,
    ScamCaseModel,
    AlertModel,
    utc_now
)
from backend.schemas import SyntheticConfigInput
from backend.engine.synthetic_generator import SyntheticGenerator
from backend.engine.pipeline import pipeline
from backend.seed import seed_database

logger = logging.getLogger("muletracer.synthetic_api")
router = APIRouter(prefix="", tags=["Synthetic & Simulation"])

@router.post("/api/demo/reset")
def reset_demo_database(db: Session = Depends(get_db)):
    """Restores the canonical demo scenario (Victim -> Mule 017 -> Mule 042 -> Mule 103 -> Cashout 009)."""
    try:
        res = seed_database(db=db, reset=True)
        return {
            "status": "success",
            "message": "Deterministic demo dataset successfully restored.",
            "details": res
        }
    except Exception as e:
        logger.error(f"[RESET ERROR] {e}")
        raise HTTPException(status_code=500, detail={"code": "RESET_FAILED", "message": str(e)})

@router.post("/api/intelligence/recompute")
def recompute_intelligence(db: Session = Depends(get_db)):
    """Recomputes graph topology, risk scores, syndicate rings, and alerts across the current database."""
    try:
        res = pipeline.run_full_pipeline(db)
        return {
            "status": "success",
            "message": "Intelligence pipeline recomputed successfully.",
            "pipeline_summary": res
        }
    except Exception as e:
        logger.error(f"[RECOMPUTE ERROR] {e}")
        raise HTTPException(status_code=500, detail={"code": "RECOMPUTE_FAILED", "message": str(e)})

@router.post("/api/synthetic/generate")
def generate_synthetic_data(config: SyntheticConfigInput, db: Session = Depends(get_db)):
    """Generates synthetic accounts, transactions, and scam cases with deterministic PRNG seed."""
    try:
        gen = SyntheticGenerator(seed=config.seed)
        data = gen.generate_dataset(
            account_count=config.get_accounts(),
            transaction_count=config.get_transactions(),
            mule_percentage=config.get_mule_pct(),
            fraud_ring_count=config.get_fraud_ring(),
            avg_amount=config.get_avg_amount(),
            scam_type=config.get_scam_type(),
            seed=config.seed
        )

        # Clear existing and insert generated
        db.query(AlertModel).delete()
        db.query(ScamCaseModel).delete()
        db.query(TransactionModel).delete()
        db.query(AccountModel).delete()
        from backend.models import InstitutionModel, HistoricalPatternModel
        db.query(HistoricalPatternModel).delete()
        db.query(InstitutionModel).delete()

        # Insert institutions
        for inst in data.get("institutions", []):
            db.add(InstitutionModel(
                id=inst["id"],
                institution_code=inst["institution_code"],
                institution_name=inst["institution_name"],
                institution_type=inst["institution_type"],
                is_synthetic=True
            ))
        db.commit()

        # Insert accounts
        for a in data["accounts"]:
            db.add(AccountModel(
                id=a["id"],
                account_number_masked=a["account_number_masked"],
                display_name=a["display_name"],
                bank=a["bank"],
                institution_code=a.get("institution_code"),
                institution_id=a.get("institution_id"),
                account_type=a["account_type"],
                status=a["status"],
                risk_score=a["risk_score"],
                risk_level=a["risk_level"],
                device_id=a.get("device_id"),
                first_seen=a["first_seen"],
                total_incoming=a["total_incoming"],
                total_outgoing=a["total_outgoing"],
                transaction_count=a["transaction_count"],
                opening_balance=a.get("opening_balance", 25000.0),
                current_balance=a.get("current_balance", 25000.0),
                dataset_version=data.get("dataset_version", "v2.0")
            ))
        db.commit()

        # Insert transactions
        for t in data["transactions"]:
            db.add(TransactionModel(
                id=t["id"],
                source_account_id=t["source_account_id"],
                destination_account_id=t["destination_account_id"],
                amount=t["amount"],
                currency=t["currency"],
                timestamp=datetime.fromisoformat(t["timestamp"]),
                transaction_type=t["transaction_type"],
                payment_rail=t.get("payment_rail", "UPI"),
                channel=t.get("channel", "ONLINE"),
                status=t["status"],
                risk_score=t["risk_score"],
                scenario_id=t.get("scenario_id"),
                is_historical=t.get("is_historical", False),
                is_simulated=t.get("is_simulated", False),
                dataset_version=data.get("dataset_version", "v2.0"),
                description=t["description"]
            ))
        db.commit()

        # Insert cases
        for c in data["cases"]:
            db.add(ScamCaseModel(
                id=c["id"],
                case_type=c["case_type"],
                victim_account_id=c["victim_account_id"],
                reported_transaction_id=c["reported_transaction_id"],
                amount=c["amount"],
                reported_at=datetime.fromisoformat(c["reported_at"]),
                status=c["status"],
                risk_score=c["risk_score"],
                priority=c["priority"],
                current_location=c.get("current_location"),
                predicted_next_hop=c.get("predicted_next_hop"),
                origin_account_id=c.get("origin_account_id"),
                dataset_version=data.get("dataset_version", "v2.0"),
                description=c["description"]
            ))
        db.commit()

        # Insert historical patterns
        for hp in data.get("historical_patterns", []):
            db.add(HistoricalPatternModel(
                id=hp["id"],
                pattern_id=hp["pattern_id"],
                pattern_type=hp["pattern_type"],
                ordered_account_roles=hp["ordered_account_roles"],
                transaction_count=hp["transaction_count"],
                amount_profile=hp["amount_profile"],
                time_interval_profile=hp["time_interval_profile"],
                historical_occurrences=hp["historical_occurrences"],
                evidence=hp.get("evidence"),
                dataset_version=data.get("dataset_version", "v2.0")
            ))
        db.commit()

        # Run pipeline
        pipe_res = pipeline.run_full_pipeline(db)

        return {
            "status": "success",
            "seed": config.seed,
            "accounts_created": len(data["accounts"]),
            "transactions_created": len(data["transactions"]),
            "generated": {
                "institutions": len(data.get("institutions", [])),
                "accounts": len(data["accounts"]),
                "transactions": len(data["transactions"]),
                "cases": len(data["cases"]),
                "historical_patterns": len(data.get("historical_patterns", []))
            },
            "validation_report": data.get("validation_report"),
            "dataset_version": data.get("dataset_version", "v2.0"),
            "pipeline": pipe_res
        }
    except Exception as e:
        logger.error(f"[SYNTHETIC GENERATION ERROR] {e}")
        raise HTTPException(status_code=500, detail={"code": "GENERATION_FAILED", "message": str(e)})

@router.post("/api/simulate/transaction")
def simulate_transaction(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Simulates real-time incoming transaction and dynamically checks if risk thresholds are crossed."""
    src = payload.get("source")
    dest = payload.get("destination")
    amt = float(payload.get("amount", 25000.0))
    tx_type = payload.get("type", "IMPS")

    if not src or not dest:
        raise HTTPException(status_code=400, detail={"code": "INVALID_TRANSACTION", "message": "Source and destination are required."})

    src_acct = db.query(AccountModel).filter(AccountModel.id == src).first()
    dest_acct = db.query(AccountModel).filter(AccountModel.id == dest).first()

    if not src_acct or not dest_acct:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": "Source or destination account does not exist."})

    tx_id = f"TX-SIM-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.now(timezone.utc)

    # Insert transaction
    new_tx = TransactionModel(
        id=tx_id,
        source_account_id=src,
        destination_account_id=dest,
        amount=amt,
        currency="INR",
        timestamp=now,
        transaction_type=tx_type,
        status="flagged" if dest_acct.account_type in ["mule", "cashout"] else "completed",
        risk_score=max(src_acct.risk_score, dest_acct.risk_score),
        description=f"Simulated live transfer: {src} -> {dest}"
    )
    db.add(new_tx)

    # Update account volume stats
    src_acct.total_outgoing += amt
    src_acct.transaction_count += 1
    dest_acct.total_incoming += amt
    dest_acct.transaction_count += 1

    db.commit()

    # Re-run pipeline for intelligence updates
    pipeline.run_full_pipeline(db)

    # Check for immediate next-hop prediction from destination
    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    next_hops = pipeline.next_hop_engine.predict_next_hops(dest, all_txns, all_accounts, reference_amount=amt)
    probable_next = next_hops["predictions"][0] if next_hops["predictions"] else None

    # Generate immediate alert if critical
    alert_created = None
    if dest_acct.risk_score >= 85 and probable_next:
        alert_id = f"ALT-LIVE-{int(datetime.now().timestamp() * 1000)}"
        alert_created = {
            "id": alert_id,
            "type": "NEXT-HOP RISK",
            "severity": "CRITICAL",
            "account_id": dest,
            "title": f"Live hop alert: {dest} funds moving",
            "description": f"{dest} received ₹{amt:,.2f}. Imminent transfer predicted to {probable_next['account_id']} (Confidence: {probable_next['confidence']}%)."
        }
        db.add(AlertModel(
            id=alert_id,
            type=alert_created["type"],
            severity=alert_created["severity"],
            account_id=dest,
            transaction_id=tx_id,
            title=alert_created["title"],
            description=alert_created["description"],
            risk_score=dest_acct.risk_score,
            read=False,
            status="active",
            created_at=utc_now()
        ))
        db.commit()

    return {
        "status": "success",
        "simulated_transaction": {
            "id": tx_id,
            "source": src,
            "destination": dest,
            "amount": amt,
            "timestamp": now.isoformat()
        },
        "destination_risk": {
            "account_id": dest,
            "score": dest_acct.risk_score,
            "level": dest_acct.risk_level,
            "status": dest_acct.status
        },
        "probable_next_hop": probable_next,
        "alert_triggered": alert_created
    }

@router.post("/api/freeze/simulate")
def simulate_freeze(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Simulates an intervention freeze on an account without touching production banking cores."""
    from backend.models import AccountModel, InvestigationActionModel
    acc_id = payload.get("account_id")
    account = db.query(AccountModel).filter(AccountModel.id == acc_id).first()
    if not account:
        raise HTTPException(status_code=404, detail={"code": "ACCOUNT_NOT_FOUND", "message": f"Account {acc_id} not found."})
    account.status = "frozen"
    act_id = f"ACT-{int(datetime.now().timestamp() * 1000)}"
    action = InvestigationActionModel(
        id=act_id,
        case_id=payload.get("case_id"),
        account_id=acc_id,
        action_type="FREEZE_RECOMMENDED",
        performed_at=datetime.utcnow(),
        performed_by="Automated Synthetic Risk Guardian",
        status="FROZEN",
        simulated=True,
        notes=payload.get("reason", "Preventive simulated intervention")
    )
    db.add(action)
    db.commit()
    return {
        "status": "FROZEN",
        "account_id": acc_id,
        "simulated": True,
        "message": f"Simulated freeze active on {acc_id}."
    }

@router.get("/api/synthetic/institutions")
def get_institutions(db: Session = Depends(get_db)):
    """Returns all participating institutions in the synthetic multi-bank network."""
    from backend.models import InstitutionModel
    from backend.engine.synthetic_generator import DEFAULT_INSTITUTIONS
    insts = db.query(InstitutionModel).all()
    if not insts:
        return [
            {
                "id": f"INST-{inst['code']}",
                "institution_code": inst["code"],
                "institution_name": inst["name"],
                "code": inst["code"],
                "name": inst["name"],
                "institution_type": inst["type"],
                "type": inst["type"],
                "is_synthetic": True
            } for inst in DEFAULT_INSTITUTIONS
        ]
    return [
        {
            "id": i.id,
            "institution_code": i.institution_code,
            "institution_name": i.institution_name,
            "code": i.institution_code,
            "name": i.institution_name,
            "institution_type": i.institution_type,
            "type": i.institution_type,
            "is_synthetic": i.is_synthetic
        } for i in insts
    ]
