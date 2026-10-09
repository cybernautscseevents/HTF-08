"""
Automated Data-Integrity Tests for Multi-Bank Synthetic Data Pipeline
Verifies:
1. Identifier integrity (unique, institution prefixes, format, referential integrity)
2. Transaction integrity (positive amounts, timestamps, statuses, distinction of historical/current/simulated)
3. Account metrics (ledger mathematical consistency: incoming/outgoing sums, fan-in/fan-out, pass-through, velocity)
4. Integration integrity (Network explorer graph, incoming/outgoing views, simulated freeze)
5. Scenario integrity (multi-bank multi-hop cases, benign vs suspicious, explainable next-hop detector)
"""

import re
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from backend.main import app
from backend.engine.synthetic_generator import SyntheticGenerator, EntityIdAllocator, DEFAULT_INSTITUTIONS
from backend.engine.risk_engine import RiskEngine
from backend.engine.graph_engine import GraphEngine

client = TestClient(app)

ACCOUNT_ID_PATTERN = re.compile(r"^[A-Z]{3,8}-(MULE|VICTIM|CUSTOMER|MERCHANT|CASHOUT|ATM|BENEFICIARY)-\d{3}$")
TXN_ID_PATTERN = re.compile(r"^TXN-\d{8}-\d{6}$")
CASE_ID_PATTERN = re.compile(r"^CASE-\d{4}-\d{4}$")

class TestIdentifierIntegrity:
    """Verifies Section 1: Realistic, deterministic institution-specific identifiers."""

    def test_allocator_deterministic_and_unique(self):
        allocator = EntityIdAllocator()
        id1 = allocator.allocate_account_id("SBI", "MULE")
        id2 = allocator.allocate_account_id("AXIS", "MULE")
        id3 = allocator.allocate_account_id("SBI", "VICTIM")
        id4 = allocator.allocate_account_id("HDFC", "CUSTOMER")

        assert id1 == "SBI-MULE-001"
        assert id2 == "AXIS-MULE-002"
        assert id3 == "SBI-VICTIM-001"
        assert id4 == "HDFC-CUSTOMER-001"

    def test_generated_identifiers_format_and_uniqueness(self):
        gen = SyntheticGenerator(seed=101)
        data = gen.generate_dataset(account_count=45, transaction_count=85, seed=101)

        accounts = data["accounts"]
        account_ids = [a["id"] for a in accounts]

        # 1. All account IDs are unique
        assert len(account_ids) == len(set(account_ids)), "Duplicate account ID generated"

        # 2. Account ID adheres to institution-category-number format
        for a in accounts:
            acc_id = a["id"]
            assert ACCOUNT_ID_PATTERN.match(acc_id), f"Invalid account ID format: {acc_id}"
            # Bank prefix matches institution_code
            prefix = acc_id.split("-")[0]
            assert prefix == a["institution_code"], f"Prefix {prefix} != institution_code {a['institution_code']}"

        # 3. Transaction IDs unique and format check
        transactions = data["transactions"]
        tx_ids = [t["id"] for t in transactions]
        assert len(tx_ids) == len(set(tx_ids)), "Duplicate transaction ID generated"
        for t in transactions:
            assert TXN_ID_PATTERN.match(t["id"]), f"Invalid transaction ID format: {t['id']}"

        # 4. Case IDs unique and format check
        cases = data["cases"]
        case_ids = [c["id"] for c in cases]
        assert len(case_ids) == len(set(case_ids)), "Duplicate case ID generated"
        for c in cases:
            assert CASE_ID_PATTERN.match(c["id"]), f"Invalid case ID format: {c['id']}"

    def test_referential_integrity(self):
        gen = SyntheticGenerator(seed=202)
        data = gen.generate_dataset(account_count=50, transaction_count=90, seed=202)

        acc_lookup = {a["id"]: a for a in data["accounts"]}

        for t in data["transactions"]:
            assert t["source"] in acc_lookup, f"Source account {t['source']} not found in accounts"
            assert t["destination"] in acc_lookup, f"Destination account {t['destination']} not found in accounts"


class TestTransactionIntegrity:
    """Verifies Section 5: Realistic transaction histories, amounts, timing, and statuses."""

    def test_transaction_amounts_and_currencies(self):
        gen = SyntheticGenerator(seed=303)
        data = gen.generate_dataset(account_count=40, transaction_count=70, seed=303)

        for t in data["transactions"]:
            assert t["amount"] > 0, f"Non-positive transaction amount: {t['amount']}"
            assert t["currency"] == "INR", f"Unexpected currency: {t['currency']}"
            assert str(t["status"]).upper() in ["COMPLETED", "PENDING", "HELD", "BLOCKED", "FAILED", "FLAGGED"]

    def test_historical_vs_current_transactions(self):
        gen = SyntheticGenerator(seed=404)
        data = gen.generate_dataset(account_count=50, transaction_count=80, seed=404)

        historical = [t for t in data["transactions"] if t.get("is_historical")]
        current = [t for t in data["transactions"] if not t.get("is_historical")]

        assert len(historical) > 0, "No historical transactions generated"
        assert len(current) > 0, "No current transactions generated"

        # Blocked simulated intervention transaction exists
        blocked = [t for t in data["transactions"] if str(t.get("status")).upper() == "BLOCKED"]
        assert len(blocked) >= 1, "Simulated blocked transfer missing"


class TestAccountMetricsMathematicalConsistency:
    """Verifies Section 6: Metrics mathematically derived from canonical transactions ledger."""

    def test_ledger_totals_and_degrees(self):
        gen = SyntheticGenerator(seed=505)
        data = gen.generate_dataset(account_count=45, transaction_count=75, seed=505)

        accounts = data["accounts"]
        transactions = data["transactions"]

        for acc in accounts:
            acc_id = acc["id"]
            # Filter non-blocked transactions where acc is destination
            expected_incoming = sum(
                t["amount"] for t in transactions
                if t["destination"] == acc_id and t.get("status") != "BLOCKED"
            )
            # Filter non-blocked transactions where acc is source
            expected_outgoing = sum(
                t["amount"] for t in transactions
                if t["source"] == acc_id and t.get("status") != "BLOCKED"
            )

            # In-degree (distinct counterparties sending to acc)
            in_sources = {
                t["source"] for t in transactions
                if t["destination"] == acc_id and t.get("status") != "BLOCKED"
            }
            # Out-degree (distinct counterparties receiving from acc)
            out_destinations = {
                t["destination"] for t in transactions
                if t["source"] == acc_id and t.get("status") != "BLOCKED"
            }

            assert abs(acc["total_incoming"] - expected_incoming) < 0.01, (
                f"Account {acc_id} incoming mismatch: ledger {acc['total_incoming']} vs calculated {expected_incoming}"
            )
            assert abs(acc["total_outgoing"] - expected_outgoing) < 0.01, (
                f"Account {acc_id} outgoing mismatch: ledger {acc['total_outgoing']} vs calculated {expected_outgoing}"
            )
            assert acc["in_degree"] == len(in_sources), (
                f"Account {acc_id} in_degree mismatch: {acc['in_degree']} vs {len(in_sources)}"
            )
            assert acc["out_degree"] == len(out_destinations), (
                f"Account {acc_id} out_degree mismatch: {acc['out_degree']} vs {len(out_destinations)}"
            )

    def test_risk_score_is_evidence_based(self):
        gen = SyntheticGenerator(seed=606)
        data = gen.generate_dataset(account_count=45, transaction_count=85, seed=606)

        customers = [a for a in data["accounts"] if a["account_type"] in ["customer", "normal"] or "-CUSTOMER-" in a["id"]]
        mules = [a for a in data["accounts"] if a["account_type"] == "mule"]

        # Customers with no suspicious activity should have lower risk scores (< 60)
        low_risk_customers = [c for c in customers if c["risk_score"] < 60]
        assert len(low_risk_customers) > 0, "Ordinary customers should not all have high risk"

        # Active mules in pass-through chains should have higher risk scores
        active_mules = [m for m in mules if m["total_incoming"] > 0 and m["total_outgoing"] > 0]
        if active_mules:
            avg_mule_score = sum(m["risk_score"] for m in active_mules) / len(active_mules)
            avg_cust_score = sum(c["risk_score"] for c in customers) / len(customers)
            assert avg_mule_score > avg_cust_score, "Active mules must score higher on average than normal customers"


class TestMultiBankScenarioAndNextHop:
    """Verifies Sections 2 & 7: Multi-bank interconnected chains & Next-hop detection."""

    def test_cross_bank_chain_generation(self):
        gen = SyntheticGenerator(seed=707)
        data = gen.generate_dataset(account_count=50, transaction_count=90, seed=707)

        # Cases must exist with multi-hop trails
        cases = data["cases"]
        assert len(cases) >= 2, "At least 2 multi-bank scam cases expected"

        case = cases[0]
        assert case["origin_account_id"] != "", "Case origin account must be populated"
        assert len(case["trail"]) >= 3, "Scam case trail must have >= 3 hops"

        # Check institutions along the trail (multi-bank cross institution)
        trail_institutions = [hop.get("bank") for hop in case["trail"]]
        assert len(set(trail_institutions)) >= 2, "Investigation trail should cross multiple institutions"

    def test_next_hop_candidate_with_evidence(self):
        gen = SyntheticGenerator(seed=808)
        data = gen.generate_dataset(account_count=50, transaction_count=90, seed=808)

        case1 = data["cases"][0]
        # Predicted next hop must be an existing synthetic account
        acc_ids = {a["id"] for a in data["accounts"]}
        assert case1["predicted_next_hop"] in acc_ids, "Predicted next hop account must exist in dataset"
        assert len(case1["evidence"]) >= 1, "Next-hop prediction must provide explainable evidence reasons"


class TestApiIntegrationAndLedgerViews:
    """Verifies Sections 8, 9, 10: Complete API lifecycle, graph sync, and incoming/outgoing views."""

    def test_end_to_end_api_generation_and_consistency(self):
        # 1. Call synthetic generation endpoint
        payload = {
            "accounts": 40,
            "transactions": 75,
            "mule_percentage": 25,
            "fraud_ring_count": 5,
            "avg_transaction_amount": 300000,
            "scam_type": "Digital Arrest",
            "seed": 909
        }
        gen_resp = client.post("/api/synthetic/generate", json=payload)
        assert gen_resp.status_code == 200
        res_data = gen_resp.json()
        assert res_data["status"] == "success"
        assert res_data["accounts_created"] >= 35
        assert res_data["transactions_created"] >= 60

        # 2. Check registered institutions endpoint
        inst_resp = client.get("/api/synthetic/institutions")
        assert inst_resp.status_code == 200
        institutions = inst_resp.json()
        assert len(institutions) >= 10
        codes = [i["code"] for i in institutions]
        assert "SBI" in codes
        assert "HDFC" in codes
        assert "AXIS" in codes
        assert "ICICI" in codes

        # 3. Retrieve account list
        accounts_resp = client.get("/api/accounts")
        assert accounts_resp.status_code == 200
        accounts = accounts_resp.json()
        assert len(accounts) >= 35

        # 4. Pick an account with transactions and test incoming/outgoing data-driven endpoints
        target_account = None
        for a in accounts:
            if a["transaction_count"] > 1:
                target_account = a
                break

        assert target_account is not None, "At least one active account needed for ledger test"
        acc_id = target_account["id"]

        # 5. Test incoming transactions view
        inc_resp = client.get(f"/api/accounts/{acc_id}/transactions?direction=incoming")
        assert inc_resp.status_code == 200
        inc_txns = inc_resp.json()
        for t in inc_txns:
            assert t["destination"] == acc_id, f"Incoming transaction has wrong destination {t['destination']}"
            assert "source_institution" in t or "channel" in t

        # 6. Test outgoing transactions view
        out_resp = client.get(f"/api/accounts/{acc_id}/transactions?direction=outgoing")
        assert out_resp.status_code == 200
        out_txns = out_resp.json()
        for t in out_txns:
            assert t["source"] == acc_id, f"Outgoing transaction has wrong source {t['source']}"
            assert "destination_institution" in t or "channel" in t

        # 7. Test Graph Synchronization
        graph_resp = client.get("/api/graph")
        assert graph_resp.status_code == 200
        graph_data = graph_resp.json()
        node_ids = {n["id"] for n in graph_data["nodes"]}
        # Every generated account is represented in graph nodes
        for a in accounts:
            assert a["id"] in node_ids, f"Account {a['id']} missing from graph nodes"

        # 8. Test Simulated Account Freeze
        freeze_resp = client.post(
            "/api/freeze/simulate",
            json={
                "account_id": acc_id,
                "reason": "Preventive intervention ahead of next hop transfer",
                "trigger_pattern": "MULE_LAYER_RAPID_DRAIN"
            }
        )
        assert freeze_resp.status_code == 200
        freeze_data = freeze_resp.json()
        assert freeze_data["status"] == "FROZEN"
        assert freeze_data["account_id"] == acc_id

        # Verify account status is now frozen in database
        updated_acc_resp = client.get(f"/api/accounts/{acc_id}")
        assert updated_acc_resp.status_code == 200
        assert updated_acc_resp.json()["status"] == "frozen"

        # 9. Clean up: reset to canonical demo state
        reset_resp = client.post("/api/demo/reset")
        assert reset_resp.status_code == 200
