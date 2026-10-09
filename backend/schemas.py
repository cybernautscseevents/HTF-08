from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict, model_validator

# Base schemas
class RiskFactorSchema(BaseModel):
    name: str
    raw_value: Optional[float] = None
    score: float
    max_score: float = 25.0
    weight: float
    contribution: float
    explanation: str

class InstitutionResponse(BaseModel):
    id: str
    institution_code: str
    institution_name: str
    institution_type: str = "COMMERCIAL_BANK"
    is_synthetic: bool = True

    model_config = ConfigDict(from_attributes=True)

class AccountResponse(BaseModel):
    id: str
    display_name: str
    bank: str
    institution_code: Optional[str] = None
    account_type: str
    status: str
    risk_score: int
    risk_level: str
    device_id: Optional[str] = None
    total_incoming: float
    total_outgoing: float
    transaction_count: int
    first_seen: datetime
    opening_balance: Optional[float] = 25000.0
    current_balance: Optional[float] = 25000.0
    dataset_version: Optional[str] = "v1.0"

    model_config = ConfigDict(from_attributes=True)

class AccountDetailResponse(AccountResponse):
    in_degree: int
    out_degree: int
    fan_in: int
    fan_out: int
    pass_through_ratio: float
    avg_velocity_seconds: Optional[float] = None
    centrality: float
    shared_device_accounts: List[str] = []
    risk_factors: List[RiskFactorSchema]
    recent_transactions: List[Any] = []

class TransactionResponse(BaseModel):
    id: str
    source_account_id: str
    destination_account_id: str
    source: Optional[str] = None
    destination: Optional[str] = None
    amount: float
    currency: str
    timestamp: datetime
    transaction_type: str
    payment_rail: Optional[str] = "UPI"
    channel: Optional[str] = "ONLINE"
    device_id: Optional[str] = None
    status: str
    risk_score: int
    scenario_id: Optional[str] = None
    is_historical: Optional[bool] = False
    is_simulated: Optional[bool] = False
    dataset_version: Optional[str] = "v1.0"
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_source_destination(self):
        if not self.source:
            self.source = self.source_account_id
        if not self.destination:
            self.destination = self.destination_account_id
        return self

class TransactionCreate(BaseModel):
    source_account_id: str
    destination_account_id: str
    amount: float
    transaction_type: str = "UPI"
    payment_rail: str = "UPI"
    device_id: Optional[str] = None
    description: Optional[str] = "Simulated transfer"

class ScamCaseResponse(BaseModel):
    id: str
    case_type: str
    victim_account_id: str
    reported_transaction_id: str
    amount: float
    reported_at: datetime
    status: str
    risk_score: int
    priority: str
    current_location: Optional[str] = None
    predicted_next_hop: Optional[str] = None
    origin_account_id: Optional[str] = None
    dataset_version: Optional[str] = "v1.0"
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class HistoricalPatternResponse(BaseModel):
    id: str
    pattern_id: str
    pattern_type: str
    ordered_account_roles: str
    transaction_count: int
    amount_profile: str
    time_interval_profile: str
    historical_occurrences: int
    evidence: Optional[str] = None
    dataset_version: str = "v1.0"

    model_config = ConfigDict(from_attributes=True)

class CaseNoteCreate(BaseModel):
    author: Optional[str] = "S. Krishnan (Lead Investigator)"
    note: str

class CaseNoteResponse(BaseModel):
    id: str
    case_id: str
    author: str
    note: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AlertResponse(BaseModel):
    id: str
    type: str
    severity: str
    account_id: Optional[str] = None
    transaction_id: Optional[str] = None
    case_id: Optional[str] = None
    title: str
    description: str
    risk_score: int
    read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Graph schemas
class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    bank: str
    risk_score: int
    risk_level: str
    status: str
    device_id: Optional[str] = None
    total_incoming: float = 0.0
    total_outgoing: float = 0.0

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    amount: float
    timestamp: str
    risk_score: int
    status: str
    type: str
    payment_rail: Optional[str] = "UPI"

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    highlighted_node_ids: List[str] = []
    highlighted_edge_ids: List[str] = []
    probable_next_hop: Optional[str] = None

# Blast Radius Schema
class BlastRadiusResponse(BaseModel):
    account_id: str
    direct_connections: int
    two_hop_connections: int
    three_hop_connections: int
    suspicious_accounts: int
    total_suspicious_flow: float
    potential_downstream_exposure: float
    connected_nodes: List[str]
    suspicious_nodes: List[str]

# Trail schemas
class TrailStepResponse(BaseModel):
    hop: int
    transaction_id: str
    from_account: str
    to_account: str
    amount: float
    timestamp: str
    delay_seconds: int
    amount_retention: float
    risk_score: int
    selection_reason: List[str] = []

class NextHopCandidateResponse(BaseModel):
    account_id: str
    confidence: int
    expected_amount: float
    expected_delay_seconds: int
    reasons: List[str]

class MoneyTrailResponse(BaseModel):
    case_id: Optional[str] = None
    case_transaction_id: str
    source: str
    initial_amount: float
    current_account: str
    hops: int
    total_traced_amount: float
    total_duration_seconds: int
    trail: List[TrailStepResponse]
    probable_next_hop: Optional[NextHopCandidateResponse] = None
    alternatives: List[NextHopCandidateResponse] = []

# Action schemas
class ActionCreate(BaseModel):
    account_id: str
    case_id: Optional[str] = None
    action_type: str = "FREEZE_RECOMMENDED"
    reason: str
    notes: Optional[str] = None

class ActionResponse(BaseModel):
    id: str
    status: str
    simulated: bool
    account_id: str
    case_id: Optional[str] = None
    action_type: str
    performed_at: datetime
    performed_by: str
    message: str

class AuditLogCreate(BaseModel):
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    actor: Optional[str] = "S. Krishnan (Lead Investigator)"
    details: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    actor: str
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Dashboard schemas
class DashboardSummaryResponse(BaseModel):
    active_cases: int
    high_risk_mules: int
    transactions_analyzed: int
    suspicious_networks: int
    at_risk_funds: float
    next_hop_alerts: int
    frozen_accounts_count: int

class TrendPoint(BaseModel):
    date: str
    cases: int
    mules_detected: int
    volume: float

class DashboardTrendsResponse(BaseModel):
    trends: List[TrendPoint]

# Synthetic config schema
class SyntheticConfigInput(BaseModel):
    seed: int = 42
    accounts: Optional[int] = 40
    accountCount: Optional[int] = None
    transactions: Optional[int] = 75
    transactionCount: Optional[int] = None
    mule_percentage: Optional[float] = 0.25
    mulePercentage: Optional[float] = None
    fraud_ring_count: Optional[int] = 5
    fraudRingSize: Optional[int] = None
    avg_transaction_amount: Optional[float] = 250000.0
    avgTransactionAmount: Optional[float] = None
    transaction_velocity: Optional[str] = "high"
    transactionVelocity: Optional[str] = None
    scam_type: Optional[str] = "DIGITAL_ARREST"
    scamType: Optional[str] = None
    network_complexity: Optional[str] = "complex"
    networkComplexity: Optional[str] = None

    def get_accounts(self) -> int:
        return self.accountCount or self.accounts or 40

    def get_transactions(self) -> int:
        return self.transactionCount or self.transactions or 75

    def get_mule_pct(self) -> float:
        val = self.mulePercentage if self.mulePercentage is not None else self.mule_percentage
        if val is None:
            return 0.25
        # If passed as percentage (e.g. 25 instead of 0.25)
        return val / 100.0 if val > 1.0 else val

    def get_fraud_ring(self) -> int:
        return self.fraudRingSize or self.fraud_ring_count or 4

    def get_avg_amount(self) -> float:
        return self.avgTransactionAmount or self.avg_transaction_amount or 250000.0

    def get_scam_type(self) -> str:
        st = self.scamType or self.scam_type or "DIGITAL_ARREST"
        return st.upper().replace(" ", "_")

class ErrorResponse(BaseModel):
    error: dict
