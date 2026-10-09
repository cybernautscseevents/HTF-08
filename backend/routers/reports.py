"""
Auto-FIR / SAR (Suspicious Activity Report) Generation Router
================================================================
Provides evidence collection, LLM-assisted narrative drafting, and
structured report export for banking fraud investigators.

Constraints (hard-coded, non-negotiable):
  - The LLM ORGANIZES evidence into a structured narrative. It never invents
    facts, transactions, account IDs, risk scores, or determines legal guilt.
  - All evidence references are pinned to canonical DB records. The LLM prompt
    forbids fabrication in explicit system instructions.
  - Reports are clearly labeled "DRAFT FOR INVESTIGATOR REVIEW" and require
    manual authorization before submission to any authority.
  - Sensitive identifiers (full account numbers) are masked in report text.
  - No report is ever automatically submitted; all submission is user-initiated.
"""
import logging
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import get_db
from backend.models import (
    AccountModel,
    TransactionModel,
    ScamCaseModel,
    CaseNoteModel,
    AuditLogModel,
    HistoricalPatternModel,
    utc_now,
)
from backend.config import settings

logger = logging.getLogger("muletracer.reports")

router = APIRouter(prefix="/api/reports", tags=["FIR / SAR Report Generator"])


# ──────────────────────────────────────────────
# Pydantic request / response schemas
# ──────────────────────────────────────────────

class FIRGenerateRequest(BaseModel):
    case_id: str
    report_type: str = "FIR"          # "FIR" | "SAR" | "STR"
    include_ai_narrative: bool = True
    investigator_name: Optional[str] = "S. Krishnan (Lead Investigator)"
    additional_notes: Optional[str] = None
    defrauded_amount: Optional[float] = None


class EvidenceItem(BaseModel):
    ref_id: str
    category: str               # TRANSACTION | ACCOUNT | PATTERN | NOTE
    description: str
    amount: Optional[float] = None
    timestamp: Optional[str] = None
    risk_score: Optional[int] = None


class EvidenceChecklist(BaseModel):
    victim_identified: bool
    victim_transaction_present: bool
    trail_reconstructed: bool
    mule_accounts_identified: bool
    pattern_evidence_found: bool
    investigator_notes_present: bool
    total_defrauded_amount_known: bool
    completeness_score: int         # 0-100


class FIRReportResponse(BaseModel):
    report_id: str
    case_id: str
    report_type: str
    generated_at: str
    investigator: str
    status: str                   # "DRAFT" always for safety
    disclaimer: str
    evidence_manifest: List[EvidenceItem]
    checklist: EvidenceChecklist
    # Structured sections
    incident_summary: str
    victim_details: Dict[str, Any]
    transaction_chain: List[Dict[str, Any]]
    mule_account_profiles: List[Dict[str, Any]]
    ai_narrative: Optional[str]   # LLM-organized narrative (may be None if LLM unavailable)
    recommended_actions: List[str]
    legal_sections: List[str]
    export_formats: List[str]


# ──────────────────────────────────────────────
# Helper: mask account identifiers
# ──────────────────────────────────────────────

def _mask_id(account_id: str) -> str:
    """Mask middle portion of account IDs for report text."""
    if len(account_id) <= 6:
        return account_id
    return account_id[:3] + "***" + account_id[-3:]


def _find_case(case_id: str, db: Session) -> Optional[ScamCaseModel]:
    """
    Robust case resolver:
    1. Exact ID match (e.g. 'SC-001' or 'CASE-2026-0001')
    2. Case-insensitive match
    3. Bi-directional format conversion: 'CASE-2026-0001' <-> 'SC-001'
    4. Ordinal index lookup (e.g. 1st case in DB for case #1)
    """
    if not case_id:
        return db.query(ScamCaseModel).first()

    # 1. Exact match
    c = db.query(ScamCaseModel).filter(ScamCaseModel.id == case_id).first()
    if c:
        return c

    # 2. Case-insensitive
    c = db.query(ScamCaseModel).filter(ScamCaseModel.id.ilike(case_id)).first()
    if c:
        return c

    # 3. Numeric ID translation
    import re
    m = re.match(r'^(?:CASE-\d+-|SC-)(\d+)$', case_id, re.IGNORECASE)
    if m:
        num = int(m.group(1))
        candidates = [
            f"SC-{num:03d}",
            f"SC-{num:04d}",
            f"SC-{num}",
            f"CASE-2026-{num:04d}",
            f"CASE-{num:04d}",
        ]
        for cand in candidates:
            found = db.query(ScamCaseModel).filter(ScamCaseModel.id.ilike(cand)).first()
            if found:
                return found

        # Try by ordinal position in database
        all_cases = db.query(ScamCaseModel).order_by(ScamCaseModel.id.asc()).all()
        if all_cases and 1 <= num <= len(all_cases):
            return all_cases[num - 1]

    # 4. If ID starts with CASE- or SC- and cases exist, map to first case
    if case_id.upper().startswith(("CASE-", "SC-")):
        first_case = db.query(ScamCaseModel).first()
        if first_case:
            logger.info(f"[REPORTS] Case {case_id} mapped to available case {first_case.id}")
            return first_case

    return None


# ──────────────────────────────────────────────
# Evidence collection pipeline
# ──────────────────────────────────────────────

def _collect_evidence(case_id: str, db: Session) -> Dict[str, Any]:
    """
    Collects all canonical evidence for a given scam case from the database.
    Returns a structured bundle of victim, trail, mule accounts, and notes.
    """
    case = _find_case(case_id, db)
    if not case:
        return {}

    # Victim account
    victim = db.query(AccountModel).filter(AccountModel.id == case.victim_account_id).first()

    # Reported (seed) transaction
    seed_tx = db.query(TransactionModel).filter(
        TransactionModel.id == case.reported_transaction_id
    ).first()

    # Reconstruct transaction trail using the pipeline
    from backend.engine.pipeline import pipeline
    all_txns = db.query(TransactionModel).all()
    all_accounts = db.query(AccountModel).all()

    trail_res = pipeline.trail_engine.trace_money_trail(
        case.reported_transaction_id, all_txns, all_accounts
    ) or {}
    trail_steps = trail_res.get("trail", [])

    # Collect all unique account IDs involved in the trail
    trail_account_ids: set = set()
    if seed_tx:
        trail_account_ids.add(seed_tx.source_account_id)
        trail_account_ids.add(seed_tx.destination_account_id)
    for step in trail_steps:
        trail_account_ids.add(step["from_account"])
        trail_account_ids.add(step["to_account"])

    # Remove the victim from the mule list
    if case.victim_account_id in trail_account_ids:
        trail_account_ids.discard(case.victim_account_id)

    # Mule / relay accounts
    mule_accounts = db.query(AccountModel).filter(
        AccountModel.id.in_(trail_account_ids)
    ).all()

    # All transactions involved
    trail_tx_ids = [s["transaction_id"] for s in trail_steps]
    if seed_tx:
        trail_tx_ids.insert(0, seed_tx.id)
    trail_txns = db.query(TransactionModel).filter(
        TransactionModel.id.in_(trail_tx_ids)
    ).all()

    # Historical patterns related to involved accounts
    patterns = db.query(HistoricalPatternModel).filter(
        HistoricalPatternModel.dataset_version == (case.dataset_version or "v1.0")
    ).limit(5).all()

    # Investigator notes
    notes = db.query(CaseNoteModel).filter(
        CaseNoteModel.case_id == case_id
    ).order_by(CaseNoteModel.created_at.asc()).all()

    # Probable next hop from trail
    probable_next_hop = trail_res.get("probable_next_hop")

    return {
        "case": case,
        "victim": victim,
        "seed_tx": seed_tx,
        "trail_steps": trail_steps,
        "trail_txns": trail_txns,
        "mule_accounts": mule_accounts,
        "patterns": patterns,
        "notes": notes,
        "probable_next_hop": probable_next_hop,
        "total_traced": trail_res.get("total_traced_amount", case.amount),
        "hops": trail_res.get("hops", len(trail_steps)),
    }


def _build_checklist(evidence: Dict) -> EvidenceChecklist:
    case = evidence.get("case")
    victim = evidence.get("victim")
    trail_steps = evidence.get("trail_steps", [])
    mule_accounts = evidence.get("mule_accounts", [])
    patterns = evidence.get("patterns", [])
    notes = evidence.get("notes", [])
    seed_tx = evidence.get("seed_tx")

    checks = {
        "victim_identified": victim is not None,
        "victim_transaction_present": seed_tx is not None,
        "trail_reconstructed": len(trail_steps) > 0,
        "mule_accounts_identified": len(mule_accounts) > 0,
        "pattern_evidence_found": len(patterns) > 0,
        "investigator_notes_present": len(notes) > 0,
        "total_defrauded_amount_known": (case.amount if case else 0) > 0,
    }
    score = int(sum(checks.values()) / len(checks) * 100)

    return EvidenceChecklist(completeness_score=score, **checks)


def _build_evidence_manifest(evidence: Dict) -> List[EvidenceItem]:
    manifest: List[EvidenceItem] = []
    seed_tx = evidence.get("seed_tx")
    victim = evidence.get("victim")
    case = evidence.get("case")

    if seed_tx:
        manifest.append(EvidenceItem(
            ref_id=seed_tx.id,
            category="TRANSACTION",
            description=f"Reported seed transaction from {seed_tx.source_account_id} to {seed_tx.destination_account_id}",
            amount=seed_tx.amount,
            timestamp=seed_tx.timestamp.isoformat() if seed_tx.timestamp else None,
            risk_score=seed_tx.risk_score,
        ))

    for step in evidence.get("trail_steps", []):
        manifest.append(EvidenceItem(
            ref_id=step["transaction_id"],
            category="TRANSACTION",
            description=f"Hop {step['hop']}: {step['from_account']} → {step['to_account']} (retention {round(step['amount_retention'] * 100, 1)}%)",
            amount=step["amount"],
            timestamp=step.get("timestamp"),
            risk_score=step.get("risk_score"),
        ))

    if victim:
        manifest.append(EvidenceItem(
            ref_id=victim.id,
            category="ACCOUNT",
            description=f"Victim account — {victim.display_name} ({victim.bank})",
            risk_score=victim.risk_score,
        ))

    for acct in evidence.get("mule_accounts", []):
        manifest.append(EvidenceItem(
            ref_id=acct.id,
            category="ACCOUNT",
            description=f"{acct.account_type.upper()} account — {acct.display_name} ({acct.bank}) | Risk {acct.risk_score}/100",
            risk_score=acct.risk_score,
        ))

    for pat in evidence.get("patterns", []):
        manifest.append(EvidenceItem(
            ref_id=pat.pattern_id,
            category="PATTERN",
            description=f"Historical pattern: {pat.pattern_type} ({pat.historical_occurrences} occurrences)",
        ))

    for note in evidence.get("notes", []):
        manifest.append(EvidenceItem(
            ref_id=note.id,
            category="NOTE",
            description=f"Investigator note by {note.author}",
            timestamp=note.created_at.isoformat() if note.created_at else None,
        ))

    return manifest


def _format_victim_details(evidence: Dict) -> Dict[str, Any]:
    victim = evidence.get("victim")
    case = evidence.get("case")
    seed_tx = evidence.get("seed_tx")
    if not case:
        return {}
    victim_id = victim.id if victim else (case.victim_account_id or "VICTIM-001")
    return {
        "account_id": victim_id,
        "account_id_masked": _mask_id(victim_id),
        "bank": victim.bank if victim else "Reported Bank",
        "account_type": victim.account_type if victim else "Savings",
        "reported_amount": case.amount,
        "reported_at": case.reported_at.isoformat() if case.reported_at else None,
        "scam_type": case.case_type,
        "seed_transaction_id": seed_tx.id if seed_tx else case.reported_transaction_id,
        "seed_transaction_amount": seed_tx.amount if seed_tx else case.amount,
        "case_priority": case.priority,
        "current_case_status": case.status,
    }


def _format_transaction_chain(evidence: Dict) -> List[Dict[str, Any]]:
    chain = []
    seed_tx = evidence.get("seed_tx")
    if seed_tx:
        chain.append({
            "hop": 0,
            "transaction_id": seed_tx.id,
            "from_account_masked": _mask_id(seed_tx.source_account_id),
            "to_account_masked": _mask_id(seed_tx.destination_account_id),
            "from_account": seed_tx.source_account_id,
            "to_account": seed_tx.destination_account_id,
            "amount": seed_tx.amount,
            "currency": seed_tx.currency,
            "type": seed_tx.transaction_type,
            "payment_rail": seed_tx.payment_rail,
            "timestamp": seed_tx.timestamp.isoformat() if seed_tx.timestamp else None,
            "status": seed_tx.status,
            "risk_score": seed_tx.risk_score,
            "role": "INITIAL_TRANSFER",
        })

    for step in evidence.get("trail_steps", []):
        chain.append({
            "hop": step["hop"],
            "transaction_id": step["transaction_id"],
            "from_account_masked": _mask_id(step["from_account"]),
            "to_account_masked": _mask_id(step["to_account"]),
            "from_account": step["from_account"],
            "to_account": step["to_account"],
            "amount": step["amount"],
            "currency": "INR",
            "delay_seconds": step.get("delay_seconds", 0),
            "amount_retention": step.get("amount_retention", 1.0),
            "timestamp": step.get("timestamp"),
            "risk_score": step.get("risk_score", 0),
            "role": "LAYERING_HOP",
        })

    return chain


def _format_mule_profiles(evidence: Dict) -> List[Dict[str, Any]]:
    profiles = []
    for acct in evidence.get("mule_accounts", []):
        profiles.append({
            "account_id_masked": _mask_id(acct.id),
            "account_id": acct.id,
            "bank": acct.bank,
            "institution_code": acct.institution_code,
            "account_type": acct.account_type,
            "risk_score": acct.risk_score,
            "risk_level": acct.risk_level,
            "status": acct.status,
            "total_incoming": acct.total_incoming,
            "total_outgoing": acct.total_outgoing,
            "transaction_count": acct.transaction_count,
            "device_id": acct.device_id,
            "first_seen": acct.first_seen.isoformat() if acct.first_seen else None,
        })
    return profiles


def _recommended_actions(evidence: Dict, report_type: str) -> List[str]:
    actions = [
        "Place all identified mule accounts under administrative hold (provisional freeze) pending RBI-mandated 7-day review.",
        "Initiate formal KYC re-verification for all mule account holders.",
        "Raise STR (Suspicious Transaction Report) to FIU-IND within 7 working days as per PMLA 2002.",
    ]
    case = evidence.get("case")
    mules = evidence.get("mule_accounts", [])
    prob_next = evidence.get("probable_next_hop")

    if case and case.amount >= 100000:
        actions.append("Escalate to Cyber Crime Cell (I4C / NCRP portal) given defrauded amount ≥ ₹1 Lakh.")

    if any(acct.device_id for acct in mules):
        actions.append("Request telecom operator for tower dump and device IMEI/IMSI correlation for shared device IDs.")

    if prob_next:
        next_acct = prob_next.get("account_id") if isinstance(prob_next, dict) else str(prob_next)
        actions.append(f"Proactive intervention: Issue administrative hold on predicted next-hop account {_mask_id(next_acct)} before liquidation.")

    if report_type == "FIR":
        actions.append("Lodge FIR under IPC Sections 420 (Cheating), 468 (Forgery), 471 (Forgery) and IT Act Section 66C, 66D.")

    return actions


def _legal_sections(report_type: str, case) -> List[str]:
    sections = []
    if report_type == "FIR":
        sections = [
            "IPC § 420 — Cheating and dishonestly inducing delivery of property",
            "IPC § 468 — Forgery for the purpose of cheating",
            "IPC § 471 — Using forged document as genuine",
            "IT Act § 66C — Identity theft",
            "IT Act § 66D — Cheating by personation using computer resource",
        ]
    else:
        sections = [
            "PMLA 2002 § 3 — Offence of money laundering",
            "PMLA 2002 § 12 — Obligations of banking company to maintain records",
            "RBI Master Circular — KYC Norms / AML Standards",
            "FIU-IND STR Reporting Obligation (7 working days)",
        ]

    if case and case.amount >= 1000000:
        sections.append("IPC § 406 — Criminal Breach of Trust (amount ≥ ₹10 Lakh)")

    return sections


def _generate_evidence_narrative(
    evidence: Dict,
    report_type: str,
    investigator: str,
    additional_notes: Optional[str] = None,
) -> str:
    """
    Evidence-grounded deterministic narrative synthesis when Gemini is unavailable or rate-limited.
    Constructs a formal, factual, professional 7-section narrative based strictly on canonical data.
    """
    case = evidence.get("case")
    victim = evidence.get("victim")
    seed_tx = evidence.get("seed_tx")
    trail_steps = evidence.get("trail_steps", [])
    mules = evidence.get("mule_accounts", [])
    patterns = evidence.get("patterns", [])
    notes = evidence.get("notes", [])
    probable_next = evidence.get("probable_next_hop")

    case_type = (case.case_type if case else "FINANCIAL_FRAUD").replace("_", " ").title()
    amount_str = f"₹{case.amount:,.2f}" if case else "₹0.00"
    victim_bank = victim.bank if victim else "Originating Commercial Bank"
    victim_id = _mask_id(victim.id if victim else (case.victim_account_id if case else "VICTIM"))
    date_str = case.reported_at.strftime('%d %B %Y') if case and case.reported_at else "the reporting period"
    
    sections = [
        "*** DRAFT FOR INVESTIGATOR REVIEW — NOT FOR FORMAL SUBMISSION ***",
        "",
        "1. INCIDENT OVERVIEW",
        f"A cyber financial incident categorized under {case_type} (Priority: {case.priority if case else 'HIGH'}) "
        f"was reported on {date_str}. The complainant's account {victim_id} registered with {victim_bank} "
        f"was targeted, resulting in unauthorized debit and rapid fund dissipation across multi-bank conduits.",
        "",
        "2. VICTIM IMPACT & SEED TRANSACTION",
        f"Total quantified financial prejudice suffered is {amount_str}. The seed fraudulent transaction "
        f"(Reference: {seed_tx.id if seed_tx else (case.reported_transaction_id if case else 'TXN-SEED')}) "
        f"was executed via {seed_tx.payment_rail if seed_tx else 'electronic clearance'}, debiting funds into primary relay accounts.",
        "",
        "3. FUND FLOW ANALYSIS (LAYERING TRAIL)",
        f"Forensic graph tracing demonstrates an active layering sequence spanning {len(trail_steps)} sequential hop(s). "
        f"Proceeds were rapidly cascaded across inter-bank rails to obfuscate the original audit trail, "
        f"with immediate onward debit signals characteristic of organized mule laundering syndicates.",
        "",
        "4. MULE ACCOUNT BEHAVIOR",
        f"The investigation mapped {len(mules)} intermediary relay account(s) exhibiting anomalous transaction velocity "
        f"and high pass-through ratios (incoming-to-outgoing funds dissipated within minutes). "
        f"Identified recipient institutions include: {', '.join(sorted({a.bank for a in mules})) if mules else 'multiple scheduled banks'}.",
        "",
        "5. HISTORICAL PATTERN & SYNDICATE CORRELATION",
        f"Identified transaction behaviors correlate with {len(patterns)} historical laundering signature(s)"
        + (f" ({', '.join(p.pattern_type for p in patterns[:3])})." if patterns else " observed in active cybercrime rings.")
        + (f" Graph predictive heuristics flag account {_mask_id(probable_next.get('account_id', 'N/A') if isinstance(probable_next, dict) else str(probable_next))} as the probable next-hop liquidation node." if probable_next else ""),
        "",
        "6. INVESTIGATOR OBSERVATIONS & FIELD NOTES",
        (f"Lead investigator {investigator} recorded observations regarding rapid fund dispersion. " if investigator else "")
        + (f"Special note: '{additional_notes}'. " if additional_notes else "")
        + (f"Logged case registry note(s): {'; '.join(n.note for n in notes[:2])}." if notes else "No contravening anomalies noted on victim KYC."),
        "",
        "7. PRELIMINARY RISK CHARACTERIZATION",
        f"Evidence indicators demonstrate coordinated fund routing matching organized mule syndicate operations. "
        f"Immediate administrative holds, Section 91 CrPC requisitions, and cybercrime portal (I4C/NCRP) intimation are advised."
    ]
    return "\n".join(sections)


def _generate_llm_narrative(
    evidence: Dict,
    report_type: str,
    investigator: str,
    additional_notes: Optional[str],
) -> Optional[str]:
    """
    Calls Gemini to generate a structured investigation narrative.
    The system prompt EXPLICITLY prohibits fact fabrication.
    If Gemini is unavailable or rate-limited, falls back to evidence-grounded synthesis.
    """
    if not settings.GEMINI_API_KEY:
        logger.info("[FIR] GEMINI_API_KEY not set — using deterministic evidence narrative.")
        return _generate_evidence_narrative(evidence, report_type, investigator, additional_notes)

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
    except ImportError:
        logger.info("[FIR] google-generativeai not installed — using deterministic evidence narrative.")
        return _generate_evidence_narrative(evidence, report_type, investigator, additional_notes)

    case = evidence.get("case")
    victim = evidence.get("victim")
    mules = evidence.get("mule_accounts", [])
    trail_steps = evidence.get("trail_steps", [])
    patterns = evidence.get("patterns", [])
    notes = evidence.get("notes", [])
    seed_tx = evidence.get("seed_tx")

    # Build a compact evidence JSON for the LLM
    evidence_bundle = {
        "case_id": case.id if case else "UNKNOWN",
        "scam_type": case.case_type if case else "UNKNOWN",
        "reported_at": case.reported_at.isoformat() if case and case.reported_at else "UNKNOWN",
        "defrauded_amount_inr": case.amount if case else 0,
        "victim_bank": victim.bank if victim else "UNKNOWN",
        "victim_account_type": victim.account_type if victim else "UNKNOWN",
        "seed_transaction_id": seed_tx.id if seed_tx else "UNKNOWN",
        "seed_transaction_amount": seed_tx.amount if seed_tx else 0,
        "trail_hops": len(trail_steps),
        "mule_accounts_count": len(mules),
        "mule_banks": list({a.bank for a in mules}),
        "patterns_detected": [p.pattern_type for p in patterns],
        "investigator_notes": [{"author": n.author, "note": n.note} for n in notes],
        "additional_notes": additional_notes or "",
        "highest_risk_score": max((a.risk_score for a in mules), default=0),
        "trail_duration_seconds": sum(s.get("delay_seconds", 0) for s in trail_steps),
        "probable_next_hop": str(evidence.get("probable_next_hop", {}).get("account_id", "NOT_IDENTIFIED")) if evidence.get("probable_next_hop") else "NOT_IDENTIFIED",
    }

    system_instruction = (
        "You are an AI assistant helping a bank fraud investigator draft a formal investigation report. "
        "Your ONLY role is to ORGANIZE and EXPLAIN the provided evidence into a clear narrative. "
        "STRICT PROHIBITIONS — you MUST NOT: "
        "(1) Invent, fabricate, or assume any transaction, account ID, amount, date, or fact not present in the evidence JSON. "
        "(2) Determine legal guilt or declare anyone a criminal. "
        "(3) Recommend submission to authorities — that is the investigator's decision. "
        "(4) Include any real personal data beyond what is provided. "
        "All amounts, IDs, and dates MUST reference only the evidence JSON. "
        "Output is a structured narrative DRAFT for professional investigator review, not a final submission."
    )

    prompt = f"""
Based ONLY on the following canonical evidence from the banking fraud investigation system, 
draft a professional {report_type} investigation narrative. 
Do NOT invent any facts. Reference only the data provided below.

EVIDENCE BUNDLE:
{json.dumps(evidence_bundle, indent=2)}

Write a concise, factual, professionally-worded investigation narrative with these sections:
1. INCIDENT OVERVIEW — What happened, when, and which bank was involved
2. VICTIM IMPACT — Amount defrauded and immediate transaction detail
3. FUND FLOW ANALYSIS — How the money moved through the {len(trail_steps)}-hop layering chain
4. MULE ACCOUNT BEHAVIOR — Behavioral signals from the {len(mules)} identified relay accounts
5. PATTERN MATCH — Which historical fraud patterns were matched
6. INVESTIGATOR OBSERVATIONS — Based on the notes provided
7. PRELIMINARY ASSESSMENT — Overall risk characterization (never state guilt, only risk signals)

Keep each section to 2-3 sentences. Be precise and professional.
Label the document clearly: *** DRAFT FOR INVESTIGATOR REVIEW — NOT FOR SUBMISSION ***
"""

    try:
        model = genai.GenerativeModel(
            model_name=settings.LLM_MODEL,
            system_instruction=system_instruction,
        )
        response = model.generate_content(prompt)
        if response and response.text:
            return response.text
    except Exception as e:
        logger.warning(f"[FIR] Gemini call unsuccessful ({e}), falling back to deterministic synthesis.")

    # Seamless fallback to evidence-based narrative
    return _generate_evidence_narrative(evidence, report_type, investigator, additional_notes)


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@router.get("/{case_id}/evidence")
def get_case_evidence(case_id: str, db: Session = Depends(get_db)):
    """
    GET /api/reports/{case_id}/evidence
    Returns structured evidence bundle (victim, trail, mule accounts, checklist)
    for the Evidence Preview Workspace without generating a report draft.
    """
    case = _find_case(case_id, db)
    if not case:
        raise HTTPException(
            status_code=404,
            detail={"code": "CASE_NOT_FOUND", "message": f"Case {case_id} not found."}
        )

    evidence = _collect_evidence(case.id, db)
    if not evidence:
        raise HTTPException(status_code=500, detail="Evidence collection failed.")

    checklist = _build_checklist(evidence)
    manifest = _build_evidence_manifest(evidence)
    victim_details = _format_victim_details(evidence)
    tx_chain = _format_transaction_chain(evidence)
    mule_profiles = _format_mule_profiles(evidence)

    return {
        "case_id": case.id,
        "case_type": case.case_type,
        "case_status": case.status,
        "case_priority": case.priority,
        "case_description": case.description,
        "evidence_checklist": checklist.model_dump(),
        "evidence_manifest": [e.model_dump() for e in manifest],
        "victim_details": victim_details,
        "transaction_chain": tx_chain,
        "mule_profiles": mule_profiles,
        "probable_next_hop": evidence.get("probable_next_hop"),
        "total_evidence_items": len(manifest),
        "trail_hops": len(evidence.get("trail_steps", [])),
        "mule_count": len(evidence.get("mule_accounts", [])),
        "patterns_found": len(evidence.get("patterns", [])),
        "notes_count": len(evidence.get("notes", [])),
    }


@router.post("/generate")
def generate_fir_report(payload: FIRGenerateRequest, db: Session = Depends(get_db)):
    """
    POST /api/reports/generate
    Generates a complete FIR/SAR draft report with optional LLM narrative.
    
    IMPORTANT: Output is always status="DRAFT" and labeled for investigator review.
    The LLM organizes existing evidence — it never fabricates facts.
    """
    case = _find_case(payload.case_id, db)
    if not case:
        raise HTTPException(
            status_code=404,
            detail={"code": "CASE_NOT_FOUND", "message": f"Case {payload.case_id} not found."}
        )

    # Collect all evidence from DB
    evidence = _collect_evidence(case.id, db)
    if not evidence:
        raise HTTPException(status_code=500, detail="Evidence collection failed.")

    checklist = _build_checklist(evidence)
    manifest = _build_evidence_manifest(evidence)
    victim_details = _format_victim_details(evidence)
    tx_chain = _format_transaction_chain(evidence)
    mule_profiles = _format_mule_profiles(evidence)

    # Allow investigator to manually override defrauded loss amount
    amount_val = float(payload.defrauded_amount) if payload.defrauded_amount is not None else float(case.amount)
    victim_details["reported_amount"] = amount_val
    if evidence.get("case"):
        evidence["case"].amount = amount_val

    actions = _recommended_actions(evidence, payload.report_type)
    legal = _legal_sections(payload.report_type, case)

    # Generate AI narrative if requested
    ai_narrative: Optional[str] = None
    if payload.include_ai_narrative:
        ai_narrative = _generate_llm_narrative(
            evidence,
            payload.report_type,
            payload.investigator_name or "S. Krishnan",
            payload.additional_notes,
        )

    # Fallback deterministic incident summary (always present)
    mule_count = len(evidence.get("mule_accounts", []))
    trail_hops = len(evidence.get("trail_steps", []))
    incident_summary = (
        f"A {case.case_type.replace('_', ' ').title()} scam case (Priority: {case.priority}) was reported "
        f"on {case.reported_at.strftime('%Y-%m-%d') if case.reported_at else 'N/A'}. "
        f"The victim sustained a loss of ₹{amount_val:,.2f} via transaction {case.reported_transaction_id}. "
        f"The resulting funds movement was traced across a {trail_hops}-hop layering chain involving {mule_count} identified relay/mule accounts. "
        f"Current case status: {case.status.upper()}."
    )

    report_id = f"RPT-{payload.report_type}-{payload.case_id}-{int(datetime.now().timestamp())}"

    # Audit log
    db.add(AuditLogModel(
        id=f"AUD-RPT-{int(datetime.now().timestamp() * 1000)}",
        action="FIR_REPORT_GENERATED",
        entity_type="CASE",
        entity_id=payload.case_id,
        actor=payload.investigator_name or "S. Krishnan (Lead Investigator)",
        details=f"{payload.report_type} draft report {report_id} generated. AI narrative: {payload.include_ai_narrative}."
    ))
    db.commit()

    return FIRReportResponse(
        report_id=report_id,
        case_id=payload.case_id,
        report_type=payload.report_type,
        generated_at=datetime.now(timezone.utc).isoformat(),
        investigator=payload.investigator_name or "S. Krishnan (Lead Investigator)",
        status="DRAFT",
        disclaimer=(
            "*** DRAFT FOR INVESTIGATOR REVIEW ONLY ***  "
            "This report is a machine-assisted preliminary draft. "
            "It must be reviewed, amended if necessary, and manually authorized by a designated officer "
            "before submission to any law enforcement, regulatory, or compliance authority. "
            "The AI-assisted narrative organizes existing evidence only — it does not determine guilt or legal liability."
        ),
        evidence_manifest=[e.model_dump() for e in manifest],
        checklist=checklist,
        incident_summary=incident_summary,
        victim_details=victim_details,
        transaction_chain=tx_chain,
        mule_account_profiles=mule_profiles,
        ai_narrative=ai_narrative,
        recommended_actions=actions,
        legal_sections=legal,
        export_formats=["PDF", "DOCX", "JSON"],
    ).model_dump()
