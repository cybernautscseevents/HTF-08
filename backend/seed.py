import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from backend.database import engine, SessionLocal, Base
from backend.models import (
    AccountModel,
    TransactionModel,
    ScamCaseModel,
    AlertModel,
    RiskFactorModel,
    InvestigationActionModel,
    CaseNoteModel,
    AuditLogModel,
    utc_now
)
from backend.engine.pipeline import pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("muletracer.seed")

def seed_database(db: Session = None, reset: bool = True):
    """Initializes schema and populates canonical demo banking network."""
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False

    try:
        if reset:
            logger.info("[SEED] Resetting database tables...")
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)

        logger.info("[SEED] Inserting canonical accounts...")
        now = datetime.now(timezone.utc)

        # 1. Accounts
        accounts_data = [
            # Victims
            AccountModel(
                id="VICTIM-001", account_number_masked="•••• 4821", display_name="Ramesh Kumar", bank="SBI",
                account_type="victim", status="normal", risk_score=5, risk_level="LOW", device_id="DEV-8821",
                first_seen=now - timedelta(days=260), total_incoming=1840000.0, total_outgoing=1790000.0, transaction_count=142
            ),
            AccountModel(
                id="VICTIM-002", account_number_masked="•••• 7193", display_name="Priya Sharma", bank="HDFC",
                account_type="victim", status="normal", risk_score=3, risk_level="LOW", device_id="DEV-7193",
                first_seen=now - timedelta(days=320), total_incoming=920000.0, total_outgoing=880000.0, transaction_count=89
            ),
            AccountModel(
                id="VICTIM-003", account_number_masked="•••• 8204", display_name="Suresh Patel", bank="ICICI",
                account_type="victim", status="normal", risk_score=4, risk_level="LOW", device_id="DEV-8204",
                first_seen=now - timedelta(days=210), total_incoming=560000.0, total_outgoing=540000.0, transaction_count=67
            ),

            # Primary Mule Chain (Case SC-001) - Shared Device DEV-7092
            AccountModel(
                id="MULE-017", account_number_masked="•••• 9921", display_name="Deepak Verma", bank="Axis",
                account_type="mule", status="critical", risk_score=88, risk_level="CRITICAL", device_id="DEV-7092",
                first_seen=now - timedelta(days=10), total_incoming=342000.0, total_outgoing=328000.0, transaction_count=47
            ),
            AccountModel(
                id="MULE-042", account_number_masked="•••• 3481", display_name="Ravi Tiwari", bank="PNB",
                account_type="mule", status="critical", risk_score=94, risk_level="CRITICAL", device_id="DEV-7092",
                first_seen=now - timedelta(days=8), total_incoming=518000.0, total_outgoing=484000.0, transaction_count=62
            ),
            AccountModel(
                id="MULE-103", account_number_masked="•••• 6129", display_name="Ajay Singh", bank="BOB",
                account_type="mule", status="critical", risk_score=91, risk_level="CRITICAL", device_id="DEV-7092",
                first_seen=now - timedelta(days=7), total_incoming=287000.0, total_outgoing=271000.0, transaction_count=38
            ),

            # Secondary Mule Chain (Case SC-002) - Shared Device DEV-3140
            AccountModel(
                id="MULE-028", account_number_masked="•••• 5032", display_name="Nitin Gupta", bank="Kotak",
                account_type="mule", status="high", risk_score=82, risk_level="HIGH", device_id="DEV-3140",
                first_seen=now - timedelta(days=13), total_incoming=245000.0, total_outgoing=231000.0, transaction_count=33
            ),
            AccountModel(
                id="MULE-055", account_number_masked="•••• 7741", display_name="Vivek Yadav", bank="IDBI",
                account_type="mule", status="high", risk_score=79, risk_level="HIGH", device_id="DEV-3140",
                first_seen=now - timedelta(days=6), total_incoming=198000.0, total_outgoing=184000.0, transaction_count=28
            ),
            AccountModel(
                id="MULE-071", account_number_masked="•••• 1290", display_name="Manoj Dubey", bank="UCO",
                account_type="mule", status="high", risk_score=76, risk_level="HIGH", device_id="DEV-3140",
                first_seen=now - timedelta(days=5), total_incoming=167000.0, total_outgoing=152000.0, transaction_count=22
            ),

            # Tertiary Mules (Case SC-003 & cross-links)
            AccountModel(
                id="MULE-119", account_number_masked="•••• 8421", display_name="Sanjay Mishra", bank="Indian Bank",
                account_type="mule", status="high", risk_score=73, risk_level="HIGH", device_id="DEV-8421",
                first_seen=now - timedelta(days=4), total_incoming=134000.0, total_outgoing=121000.0, transaction_count=19
            ),
            AccountModel(
                id="MULE-088", account_number_masked="•••• 3198", display_name="Pankaj Chauhan", bank="Canara",
                account_type="mule", status="watch", risk_score=68, risk_level="HIGH", device_id="DEV-8421",
                first_seen=now - timedelta(days=6), total_incoming=98000.0, total_outgoing=89000.0, transaction_count=15
            ),
            AccountModel(
                id="MULE-134", account_number_masked="•••• 6012", display_name="Rohit Pandey", bank="Union",
                account_type="mule", status="watch", risk_score=61, risk_level="MEDIUM", device_id="DEV-6012",
                first_seen=now - timedelta(days=3), total_incoming=76000.0, total_outgoing=67000.0, transaction_count=11
            ),
            AccountModel(
                id="MULE-156", account_number_masked="•••• 4410", display_name="Amit Jha", bank="BOI",
                account_type="mule", status="watch", risk_score=57, risk_level="MEDIUM", device_id="DEV-4410",
                first_seen=now - timedelta(days=3), total_incoming=54000.0, total_outgoing=45000.0, transaction_count=9
            ),

            # Cashout Accounts
            AccountModel(
                id="CASHOUT-009", account_number_masked="•••• 0019", display_name="Terminal ATM/OTC 009", bank="Federal",
                account_type="cashout", status="critical", risk_score=97, risk_level="CRITICAL", device_id="DEV-0009",
                first_seen=now - timedelta(days=2), total_incoming=212000.0, total_outgoing=208000.0, transaction_count=8
            ),
            AccountModel(
                id="CASHOUT-014", account_number_masked="•••• 8820", display_name="Shell Entity OTC 014", bank="RBL",
                account_type="cashout", status="critical", risk_score=92, risk_level="CRITICAL", device_id="DEV-8820",
                first_seen=now - timedelta(days=3), total_incoming=156000.0, total_outgoing=149000.0, transaction_count=6
            ),

            # Normal Accounts
            AccountModel(
                id="NORMAL-001", account_number_masked="•••• 1120", display_name="Anita Desai", bank="SBI",
                account_type="normal", status="normal", risk_score=2, risk_level="LOW",
                first_seen=now - timedelta(days=400), total_incoming=3200000.0, total_outgoing=3150000.0, transaction_count=234
            ),
            AccountModel(
                id="NORMAL-002", account_number_masked="•••• 9942", display_name="Vikram Mehta", bank="HDFC",
                account_type="normal", status="normal", risk_score=4, risk_level="LOW",
                first_seen=now - timedelta(days=500), total_incoming=4500000.0, total_outgoing=4480000.0, transaction_count=312
            ),
            AccountModel(
                id="NORMAL-003", account_number_masked="•••• 7712", display_name="Kavitha Nair", bank="ICICI",
                account_type="normal", status="normal", risk_score=1, risk_level="LOW",
                first_seen=now - timedelta(days=300), total_incoming=2100000.0, total_outgoing=2080000.0, transaction_count=178
            ),
            AccountModel(
                id="NORMAL-004", account_number_masked="•••• 3301", display_name="Rajesh Iyer", bank="Axis",
                account_type="normal", status="normal", risk_score=3, risk_level="LOW",
                first_seen=now - timedelta(days=350), total_incoming=2800000.0, total_outgoing=2750000.0, transaction_count=198
            ),
            AccountModel(
                id="NORMAL-005", account_number_masked="•••• 5521", display_name="Meena Reddy", bank="Kotak",
                account_type="normal", status="normal", risk_score=5, risk_level="LOW",
                first_seen=now - timedelta(days=280), total_incoming=1900000.0, total_outgoing=1870000.0, transaction_count=156
            ),

            # Merchants & Salary
            AccountModel(
                id="MERCHANT-001", account_number_masked="•••• 1001", display_name="QuickMart Retail", bank="HDFC",
                account_type="merchant", status="normal", risk_score=1, risk_level="LOW",
                first_seen=now - timedelta(days=800), total_incoming=89000000.0, total_outgoing=88500000.0, transaction_count=12400
            ),
            AccountModel(
                id="MERCHANT-002", account_number_masked="•••• 2002", display_name="FoodExpress Delivery", bank="ICICI",
                account_type="merchant", status="normal", risk_score=2, risk_level="LOW",
                first_seen=now - timedelta(days=600), total_incoming=45000000.0, total_outgoing=44800000.0, transaction_count=8900
            ),
            AccountModel(
                id="MERCHANT-204", account_number_masked="•••• 3204", display_name="Bharti Electronics", bank="SBI",
                account_type="merchant", status="normal", risk_score=18, risk_level="LOW",
                first_seen=now - timedelta(days=500), total_incoming=28000000.0, total_outgoing=27800000.0, transaction_count=3200
            ),
            AccountModel(
                id="SALARY-001", account_number_masked="•••• 9001", display_name="TechCorp Payroll", bank="SBI",
                account_type="salary", status="normal", risk_score=0, risk_level="LOW",
                first_seen=now - timedelta(days=1200), total_incoming=120000000.0, total_outgoing=119800000.0, transaction_count=2400
            ),
            AccountModel(
                id="SALARY-002", account_number_masked="•••• 9002", display_name="InfoSys Salary", bank="HDFC",
                account_type="salary", status="normal", risk_score=0, risk_level="LOW",
                first_seen=now - timedelta(days=1400), total_incoming=180000000.0, total_outgoing=179500000.0, transaction_count=3600
            ),
        ]

        for acct in accounts_data:
            db.add(acct)
        db.commit()

        logger.info(f"[SEED] Inserted {len(accounts_data)} accounts.")

        # 2. Transactions
        t_base = datetime(2026, 10, 7, 10, 42, 13, tzinfo=timezone.utc)
        txns_data = [
            # Primary Trail SC-001
            TransactionModel(
                id="TX-10001", source_account_id="VICTIM-001", destination_account_id="MULE-017",
                amount=50000.0, currency="INR", timestamp=t_base,
                transaction_type="UPI", status="flagged", risk_score=92,
                description="Scam payment - Digital arrest threat"
            ),
            TransactionModel(
                id="TX-10002", source_account_id="MULE-017", destination_account_id="MULE-042",
                amount=48700.0, currency="INR", timestamp=t_base + timedelta(seconds=18),
                transaction_type="IMPS", status="flagged", risk_score=91,
                description="Rapid forward - 18 sec delay"
            ),
            TransactionModel(
                id="TX-10003", source_account_id="MULE-042", destination_account_id="MULE-103",
                amount=46900.0, currency="INR", timestamp=t_base + timedelta(seconds=49),
                transaction_type="IMPS", status="flagged", risk_score=89,
                description="Layered transfer - 31 sec delay"
            ),
            TransactionModel(
                id="TX-10004", source_account_id="MULE-103", destination_account_id="CASHOUT-009",
                amount=44800.0, currency="INR", timestamp=t_base + timedelta(seconds=94),
                transaction_type="NEFT", status="flagged", risk_score=95,
                description="Cashout transfer - 45 sec delay"
            ),

            # Secondary Trail SC-002
            TransactionModel(
                id="TX-10011", source_account_id="VICTIM-002", destination_account_id="MULE-028",
                amount=125000.0, currency="INR", timestamp=t_base - timedelta(days=1),
                transaction_type="UPI", status="flagged", risk_score=88,
                description="Investment scam payment"
            ),
            TransactionModel(
                id="TX-10012", source_account_id="MULE-028", destination_account_id="MULE-055",
                amount=119500.0, currency="INR", timestamp=t_base - timedelta(days=1) + timedelta(seconds=67),
                transaction_type="IMPS", status="flagged", risk_score=85,
                description="Layered forward - 67 sec delay"
            ),
            TransactionModel(
                id="TX-10013", source_account_id="MULE-055", destination_account_id="MULE-071",
                amount=115000.0, currency="INR", timestamp=t_base - timedelta(days=1) + timedelta(seconds=163),
                transaction_type="IMPS", status="flagged", risk_score=83,
                description="Continued layering - 96 sec delay"
            ),
            TransactionModel(
                id="TX-10014", source_account_id="MULE-071", destination_account_id="CASHOUT-014",
                amount=111200.0, currency="INR", timestamp=t_base - timedelta(days=1) + timedelta(seconds=265),
                transaction_type="NEFT", status="flagged", risk_score=90,
                description="Cashout - 102 sec delay"
            ),

            # Tertiary Trail SC-003
            TransactionModel(
                id="TX-10021", source_account_id="VICTIM-003", destination_account_id="MULE-119",
                amount=35000.0, currency="INR", timestamp=t_base - timedelta(hours=2),
                transaction_type="UPI", status="flagged", risk_score=78,
                description="UPI scam payment"
            ),
            TransactionModel(
                id="TX-10022", source_account_id="MULE-119", destination_account_id="MULE-088",
                amount=33200.0, currency="INR", timestamp=t_base - timedelta(hours=2) + timedelta(seconds=43),
                transaction_type="IMPS", status="flagged", risk_score=75,
                description="Forward - 43 sec delay"
            ),
            TransactionModel(
                id="TX-10023", source_account_id="MULE-088", destination_account_id="MULE-134",
                amount=31500.0, currency="INR", timestamp=t_base - timedelta(hours=2) + timedelta(seconds=116),
                transaction_type="IMPS", status="flagged", risk_score=72,
                description="Layered transfer - 73 sec delay"
            ),
            TransactionModel(
                id="TX-10024", source_account_id="MULE-134", destination_account_id="MULE-156",
                amount=29800.0, currency="INR", timestamp=t_base - timedelta(hours=2) + timedelta(seconds=200),
                transaction_type="IMPS", status="completed", risk_score=68,
                description="Further layering - 84 sec delay"
            ),

            # Cross-links between mule networks (Alternatives for MULE-042 and MULE-103)
            TransactionModel(
                id="TX-10031", source_account_id="MULE-042", destination_account_id="MULE-028",
                amount=12000.0, currency="INR", timestamp=t_base - timedelta(hours=12),
                transaction_type="IMPS", status="flagged", risk_score=72,
                description="Cross-network transfer"
            ),
            TransactionModel(
                id="TX-10032", source_account_id="MULE-055", destination_account_id="MULE-103",
                amount=8500.0, currency="INR", timestamp=t_base - timedelta(hours=9),
                transaction_type="IMPS", status="flagged", risk_score=69,
                description="Cross-network transfer"
            ),
            TransactionModel(
                id="TX-10033", source_account_id="MULE-017", destination_account_id="MULE-119",
                amount=15000.0, currency="INR", timestamp=t_base - timedelta(hours=16),
                transaction_type="IMPS", status="flagged", risk_score=74,
                description="Cross-network transfer"
            ),
            TransactionModel(
                id="TX-10034", source_account_id="MULE-042", destination_account_id="MERCHANT-204",
                amount=3500.0, currency="INR", timestamp=t_base - timedelta(hours=10),
                transaction_type="UPI", status="completed", risk_score=23,
                description="Mule merchant diversion"
            ),

            # Additional mule traffic (volume)
            TransactionModel(
                id="TX-10041", source_account_id="MULE-017", destination_account_id="MULE-042",
                amount=22000.0, currency="INR", timestamp=t_base - timedelta(days=1),
                transaction_type="IMPS", status="flagged", risk_score=78,
                description="Earlier mule transfer"
            ),
            TransactionModel(
                id="TX-10042", source_account_id="MULE-017", destination_account_id="MULE-042",
                amount=18500.0, currency="INR", timestamp=t_base - timedelta(days=2),
                transaction_type="IMPS", status="flagged", risk_score=75,
                description="Repeated mule pattern"
            ),
            TransactionModel(
                id="TX-10043", source_account_id="MULE-042", destination_account_id="MULE-103",
                amount=35000.0, currency="INR", timestamp=t_base - timedelta(days=1),
                transaction_type="IMPS", status="flagged", risk_score=80,
                description="Mule chain continuation"
            ),
            TransactionModel(
                id="TX-10044", source_account_id="MULE-103", destination_account_id="CASHOUT-009",
                amount=28000.0, currency="INR", timestamp=t_base - timedelta(days=1) + timedelta(seconds=80),
                transaction_type="NEFT", status="flagged", risk_score=85,
                description="Prior cashout attempt"
            ),

            # Normal background transactions (Retail, Salary)
            TransactionModel(
                id="TX-20001", source_account_id="SALARY-001", destination_account_id="NORMAL-001",
                amount=65000.0, currency="INR", timestamp=t_base - timedelta(days=6),
                transaction_type="NEFT", status="completed", risk_score=2, description="Monthly salary"
            ),
            TransactionModel(
                id="TX-20002", source_account_id="SALARY-001", destination_account_id="NORMAL-004",
                amount=72000.0, currency="INR", timestamp=t_base - timedelta(days=6),
                transaction_type="NEFT", status="completed", risk_score=2, description="Monthly salary"
            ),
            TransactionModel(
                id="TX-20003", source_account_id="SALARY-002", destination_account_id="NORMAL-002",
                amount=85000.0, currency="INR", timestamp=t_base - timedelta(days=6),
                transaction_type="NEFT", status="completed", risk_score=1, description="Monthly salary"
            ),
            TransactionModel(
                id="TX-20004", source_account_id="SALARY-002", destination_account_id="VICTIM-001",
                amount=55000.0, currency="INR", timestamp=t_base - timedelta(days=6),
                transaction_type="NEFT", status="completed", risk_score=1, description="Monthly salary"
            ),
            TransactionModel(
                id="TX-20005", source_account_id="NORMAL-001", destination_account_id="MERCHANT-001",
                amount=3200.0, currency="INR", timestamp=t_base - timedelta(days=5),
                transaction_type="UPI", status="completed", risk_score=1, description="Grocery purchase"
            ),
            TransactionModel(
                id="TX-20006", source_account_id="NORMAL-002", destination_account_id="MERCHANT-002",
                amount=450.0, currency="INR", timestamp=t_base - timedelta(days=5),
                transaction_type="UPI", status="completed", risk_score=1, description="Food delivery"
            ),
            TransactionModel(
                id="TX-20007", source_account_id="NORMAL-003", destination_account_id="MERCHANT-001",
                amount=1800.0, currency="INR", timestamp=t_base - timedelta(days=4),
                transaction_type="UPI", status="completed", risk_score=1, description="Shopping"
            ),
            TransactionModel(
                id="TX-20008", source_account_id="NORMAL-004", destination_account_id="NORMAL-001",
                amount=5000.0, currency="INR", timestamp=t_base - timedelta(days=4),
                transaction_type="UPI", status="completed", risk_score=3, description="Personal transfer"
            ),
            TransactionModel(
                id="TX-20009", source_account_id="NORMAL-005", destination_account_id="MERCHANT-204",
                amount=28000.0, currency="INR", timestamp=t_base - timedelta(days=3),
                transaction_type="UPI", status="completed", risk_score=4, description="Electronics purchase"
            ),
            TransactionModel(
                id="TX-20010", source_account_id="NORMAL-001", destination_account_id="NORMAL-003",
                amount=2000.0, currency="INR", timestamp=t_base - timedelta(days=3),
                transaction_type="UPI", status="completed", risk_score=2, description="Repayment"
            ),
            TransactionModel(
                id="TX-20011", source_account_id="VICTIM-001", destination_account_id="MERCHANT-001",
                amount=4500.0, currency="INR", timestamp=t_base - timedelta(days=2),
                transaction_type="UPI", status="completed", risk_score=1, description="Regular purchase"
            ),
            TransactionModel(
                id="TX-20012", source_account_id="VICTIM-002", destination_account_id="MERCHANT-002",
                amount=890.0, currency="INR", timestamp=t_base - timedelta(days=2),
                transaction_type="UPI", status="completed", risk_score=1, description="Food order"
            ),
            TransactionModel(
                id="TX-20013", source_account_id="NORMAL-002", destination_account_id="NORMAL-005",
                amount=15000.0, currency="INR", timestamp=t_base - timedelta(days=1),
                transaction_type="IMPS", status="completed", risk_score=3, description="Loan repayment"
            ),
            TransactionModel(
                id="TX-20014", source_account_id="NORMAL-003", destination_account_id="MERCHANT-204",
                amount=42000.0, currency="INR", timestamp=t_base - timedelta(days=1),
                transaction_type="NEFT", status="completed", risk_score=5, description="Appliance purchase"
            ),
            TransactionModel(
                id="TX-20015", source_account_id="NORMAL-004", destination_account_id="MERCHANT-002",
                amount=680.0, currency="INR", timestamp=t_base - timedelta(hours=3),
                transaction_type="UPI", status="completed", risk_score=1, description="Breakfast order"
            )
        ]

        for tx in txns_data:
            db.add(tx)
        db.commit()
        logger.info(f"[SEED] Inserted {len(txns_data)} transactions.")

        # 3. Scam Cases
        cases_data = [
            ScamCaseModel(
                id="SC-001", case_type="DIGITAL_ARREST", victim_account_id="VICTIM-001",
                reported_transaction_id="TX-10001", amount=50000.0, reported_at=t_base + timedelta(minutes=12),
                status="investigating", risk_score=94, priority="CRITICAL",
                current_location="MULE-103", predicted_next_hop="CASHOUT-009",
                description="Victim received a call impersonating CBI officer. Was told their Aadhaar was linked to money laundering. Threatened with immediate arrest. Transferred ₹50,000 under duress."
            ),
            ScamCaseModel(
                id="SC-002", case_type="INVESTMENT_SCAM", victim_account_id="VICTIM-002",
                reported_transaction_id="TX-10011", amount=125000.0, reported_at=t_base - timedelta(days=1) + timedelta(hours=2),
                status="escalated", risk_score=88, priority="HIGH",
                current_location="CASHOUT-014", predicted_next_hop="",
                description="Victim lured into fake stock trading platform. Promised 200% returns. Made initial investment of ₹1,25,000 through UPI."
            ),
            ScamCaseModel(
                id="SC-003", case_type="UPI_SCAM", victim_account_id="VICTIM-003",
                reported_transaction_id="TX-10021", amount=35000.0, reported_at=t_base - timedelta(hours=1),
                status="open", risk_score=72, priority="HIGH",
                current_location="MULE-134", predicted_next_hop="MULE-156",
                description="Victim received fake UPI collect request disguised as refund from e-commerce platform. Approved ₹35,000 payment."
            ),
            ScamCaseModel(
                id="SC-004", case_type="PHISHING", victim_account_id="VICTIM-001",
                reported_transaction_id="TX-10041", amount=22000.0, reported_at=t_base - timedelta(days=1) + timedelta(hours=4),
                status="resolved", risk_score=65, priority="MEDIUM",
                current_location="MULE-042", predicted_next_hop="MULE-103",
                description="Victim clicked phishing link received via SMS. Bank credentials compromised. ₹22,000 debited via IMPS."
            ),
            ScamCaseModel(
                id="SC-005", case_type="IMPERSONATION", victim_account_id="VICTIM-002",
                reported_transaction_id="TX-10032", amount=8500.0, reported_at=t_base - timedelta(hours=5),
                status="closed", risk_score=55, priority="LOW",
                current_location="MULE-103", predicted_next_hop="",
                description="Caller impersonated bank manager, obtained OTP. ₹8,500 transferred to unknown account."
            ),
        ]

        for c in cases_data:
            db.add(c)
        db.commit()
        logger.info(f"[SEED] Inserted {len(cases_data)} scam cases.")

        # 4. Insert Default Investigator Notes
        notes_data = [
            CaseNoteModel(
                id="NOTE-001",
                case_id="SC-001",
                author="S. Krishnan (Lead Investigator)",
                note="Victim Ramesh Kumar reported immediate arrest threat by caller impersonating Cyber Crime Branch / CBI. Transferred ₹50,000 via UPI under coercion.",
                created_at=t_base + timedelta(minutes=15)
            ),
            CaseNoteModel(
                id="NOTE-002",
                case_id="SC-001",
                author="S. Krishnan (Lead Investigator)",
                note="Funds routed rapidly through MULE-017 (Axis Bank) to MULE-042 (PNB) within 18 seconds. Shared device DEV-7092 verified across both accounts.",
                created_at=t_base + timedelta(minutes=18)
            ),
            CaseNoteModel(
                id="NOTE-003",
                case_id="SC-001",
                author="A. Sharma (Forensic Analyst)",
                note="Downstream prediction indicates imminent transfer from MULE-103 to terminal cashout CASHOUT-009. Preemptive freeze recommendation issued.",
                created_at=t_base + timedelta(minutes=22)
            ),
        ]
        for n in notes_data:
            db.add(n)
        db.commit()
        logger.info(f"[SEED] Inserted {len(notes_data)} investigator notes.")

        # 5. Insert Initial Audit Logs
        logs_data = [
            AuditLogModel(
                id="AUD-001", action="LOGIN", entity_type="USER", entity_id="INV-841",
                actor="S. Krishnan (Lead Investigator)", details="Investigator session authenticated from secure SOC terminal.",
                created_at=t_base + timedelta(minutes=5)
            ),
            AuditLogModel(
                id="AUD-002", action="CASE_CREATED", entity_type="CASE", entity_id="SC-001",
                actor="S. Krishnan (Lead Investigator)", details="Digital arrest scam case SC-001 created from citizen grievance portal.",
                created_at=t_base + timedelta(minutes=12)
            ),
            AuditLogModel(
                id="AUD-003", action="TRACE_STARTED", entity_type="TRANSACTION", entity_id="TX-10001",
                actor="S. Krishnan (Lead Investigator)", details="Automated graph multi-hop money trail reconstructed for TX-10001.",
                created_at=t_base + timedelta(minutes=14)
            ),
            AuditLogModel(
                id="AUD-004", action="ALERT_REVIEWED", entity_type="ALERT", entity_id="ALT-001",
                actor="S. Krishnan (Lead Investigator)", details="High-priority next-hop alert ALT-001 acknowledged.",
                created_at=t_base + timedelta(minutes=16)
            ),
        ]
        for l in logs_data:
            db.add(l)
        db.commit()
        logger.info(f"[SEED] Inserted {len(logs_data)} audit logs.")

        # 6. Run Intelligence Pipeline
        logger.info("[SEED] Running intelligence pipeline across seeded dataset...")
        pipe_result = pipeline.run_full_pipeline(db)
        logger.info(f"[SEED] Pipeline completed successfully: {pipe_result}")

        return pipe_result

    finally:
        if should_close:
            db.close()

if __name__ == "__main__":
    seed_database(reset=True)
