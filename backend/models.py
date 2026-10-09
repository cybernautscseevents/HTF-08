from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean
from backend.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class InstitutionModel(Base):
    __tablename__ = "institutions"

    id = Column(String(50), primary_key=True, index=True)
    institution_code = Column(String(20), unique=True, index=True, nullable=False)
    institution_name = Column(String(100), nullable=False)
    institution_type = Column(String(50), default="COMMERCIAL_BANK")
    is_synthetic = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

class AccountModel(Base):
    __tablename__ = "accounts"

    id = Column(String(50), primary_key=True, index=True)
    account_number_masked = Column(String(50), nullable=True)
    display_name = Column(String(100), nullable=False)
    bank = Column(String(50), nullable=False)
    institution_code = Column(String(20), nullable=True, index=True)
    institution_id = Column(String(50), nullable=True)
    account_type = Column(String(50), nullable=False, default="normal") # victim, mule, normal, merchant, salary, cashout, atm, beneficiary
    status = Column(String(50), nullable=False, default="normal") # normal, watch, high, critical, frozen
    risk_score = Column(Integer, default=0)
    risk_level = Column(String(20), default="LOW") # LOW, MEDIUM, HIGH, CRITICAL
    device_id = Column(String(50), nullable=True, index=True) # Shared infrastructure indicator
    first_seen = Column(DateTime, default=utc_now)
    total_incoming = Column(Float, default=0.0)
    total_outgoing = Column(Float, default=0.0)
    transaction_count = Column(Integer, default=0)
    opening_balance = Column(Float, default=25000.0)
    current_balance = Column(Float, default=25000.0)
    dataset_version = Column(String(50), default="v1.0")
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(String(50), primary_key=True, index=True)
    source_account_id = Column(String(50), ForeignKey("accounts.id"), index=True, nullable=False)
    destination_account_id = Column(String(50), ForeignKey("accounts.id"), index=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    timestamp = Column(DateTime, default=utc_now, index=True)
    transaction_type = Column(String(20), default="UPI") # UPI, IMPS, NEFT, RTGS
    payment_rail = Column(String(20), default="UPI")
    channel = Column(String(20), default="ONLINE")
    device_id = Column(String(50), nullable=True, index=True)
    status = Column(String(20), default="completed") # completed, pending, flagged, blocked, held
    risk_score = Column(Integer, default=0)
    scenario_id = Column(String(50), nullable=True)
    is_historical = Column(Boolean, default=False)
    is_simulated = Column(Boolean, default=False)
    dataset_version = Column(String(50), default="v1.0")
    metadata_json = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utc_now)

class ScamCaseModel(Base):
    __tablename__ = "scam_cases"

    id = Column(String(50), primary_key=True, index=True)
    case_type = Column(String(50), nullable=False) # DIGITAL_ARREST, INVESTMENT_SCAM, UPI_SCAM, PHISHING, IMPERSONATION
    victim_account_id = Column(String(50), ForeignKey("accounts.id"), nullable=False)
    reported_transaction_id = Column(String(50), ForeignKey("transactions.id"), nullable=False)
    amount = Column(Float, nullable=False)
    reported_at = Column(DateTime, default=utc_now)
    status = Column(String(50), default="open") # open, investigating, escalated, resolved, closed
    risk_score = Column(Integer, default=85)
    priority = Column(String(20), default="HIGH") # CRITICAL, HIGH, MEDIUM, LOW
    current_location = Column(String(50), nullable=True)
    predicted_next_hop = Column(String(50), nullable=True)
    origin_account_id = Column(String(50), nullable=True)
    dataset_version = Column(String(50), default="v1.0")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class HistoricalPatternModel(Base):
    __tablename__ = "historical_patterns"

    id = Column(String(50), primary_key=True, index=True)
    pattern_id = Column(String(50), index=True, nullable=False)
    pattern_type = Column(String(50), nullable=False)
    ordered_account_roles = Column(String(255), nullable=False)
    transaction_count = Column(Integer, default=3)
    amount_profile = Column(String(100), default="retention_decay_90_95")
    time_interval_profile = Column(String(100), default="rapid_transfer_under_60s")
    historical_occurrences = Column(Integer, default=1)
    evidence = Column(Text, nullable=True)
    dataset_version = Column(String(50), default="v1.0")
    created_at = Column(DateTime, default=utc_now)

class CaseNoteModel(Base):
    __tablename__ = "case_notes"

    id = Column(String(50), primary_key=True, index=True)
    case_id = Column(String(50), ForeignKey("scam_cases.id"), index=True, nullable=False)
    author = Column(String(100), default="S. Krishnan (Lead Investigator)")
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)

class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(String(50), primary_key=True, index=True)
    type = Column(String(50), nullable=False) # NEXT-HOP RISK, RAPID PASS-THROUGH, SUSPICIOUS NETWORK, HIGH-RISK ACCOUNT
    severity = Column(String(20), nullable=False) # CRITICAL, HIGH, MEDIUM, LOW
    account_id = Column(String(50), ForeignKey("accounts.id"), nullable=True, index=True)
    transaction_id = Column(String(50), ForeignKey("transactions.id"), nullable=True)
    case_id = Column(String(50), ForeignKey("scam_cases.id"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    risk_score = Column(Integer, default=0)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now, index=True)
    status = Column(String(20), default="active")

class RiskFactorModel(Base):
    __tablename__ = "risk_factors"

    id = Column(String(50), primary_key=True, index=True)
    account_id = Column(String(50), ForeignKey("accounts.id"), index=True, nullable=False)
    factor_name = Column(String(100), nullable=False)
    raw_value = Column(Float, default=0.0)
    factor_score = Column(Float, nullable=False)
    weight = Column(Float, nullable=False)
    contribution = Column(Float, nullable=False)
    explanation = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)

class InvestigationActionModel(Base):
    __tablename__ = "investigation_actions"

    id = Column(String(50), primary_key=True, index=True)
    case_id = Column(String(50), ForeignKey("scam_cases.id"), nullable=True)
    account_id = Column(String(50), ForeignKey("accounts.id"), index=True, nullable=False)
    action_type = Column(String(50), nullable=False) # FREEZE_RECOMMENDED, FLAG_ACCOUNT, ADD_TO_WATCHLIST, MARK_CRITICAL
    performed_at = Column(DateTime, default=utc_now)
    performed_by = Column(String(100), default="S. Krishnan (Sr. Fraud Investigator)")
    status = Column(String(50), default="REVIEW_INITIATED")
    simulated = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String(50), primary_key=True, index=True)
    action = Column(String(100), nullable=False) # LOGIN, CASE_CREATED, ACCOUNT_VIEWED, TRACE_STARTED, NOTE_ADDED, etc.
    entity_type = Column(String(50), nullable=True) # CASE, ACCOUNT, TRANSACTION
    entity_id = Column(String(50), nullable=True)
    actor = Column(String(100), default="S. Krishnan (Lead Investigator)")
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
