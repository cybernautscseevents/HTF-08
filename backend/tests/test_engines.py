import pytest
from datetime import datetime, timezone, timedelta
from backend.engine.graph_engine import GraphEngine
from backend.engine.risk_engine import RiskEngine
from backend.engine.next_hop_engine import NextHopEngine
from backend.engine.trail_engine import TrailEngine
from backend.engine.network_detector import NetworkDetector
from backend.engine.synthetic_generator import SyntheticGenerator

@pytest.fixture
def sample_dataset():
    now = datetime(2026, 10, 7, 10, 0, 0, tzinfo=timezone.utc)
    accounts = [
        {"id": "VICTIM-001", "display_name": "Victim One", "bank": "SBI", "account_type": "victim", "risk_score": 5, "status": "normal"},
        {"id": "MULE-A", "display_name": "Mule Alpha", "bank": "Axis", "account_type": "mule", "risk_score": 88, "status": "critical"},
        {"id": "MULE-B", "display_name": "Mule Beta", "bank": "PNB", "account_type": "mule", "risk_score": 92, "status": "critical"},
        {"id": "CASHOUT-Z", "display_name": "Terminal Cashout", "bank": "Federal", "account_type": "cashout", "risk_score": 97, "status": "critical"},
        {"id": "NORMAL-01", "display_name": "Normal Citizen", "bank": "HDFC", "account_type": "normal", "risk_score": 2, "status": "normal"}
    ]
    transactions = [
        # Victim -> Mule A (50k)
        {"id": "TX-1", "source_account_id": "VICTIM-001", "destination_account_id": "MULE-A", "amount": 50000.0, "timestamp": now, "risk_score": 90, "status": "flagged", "transaction_type": "UPI"},
        # Mule A -> Mule B (48.7k after 18s)
        {"id": "TX-2", "source_account_id": "MULE-A", "destination_account_id": "MULE-B", "amount": 48700.0, "timestamp": now + timedelta(seconds=18), "risk_score": 91, "status": "flagged", "transaction_type": "IMPS"},
        # Mule B -> Cashout Z (46.9k after 31s)
        {"id": "TX-3", "source_account_id": "MULE-B", "destination_account_id": "CASHOUT-Z", "amount": 46900.0, "timestamp": now + timedelta(seconds=49), "risk_score": 95, "status": "flagged", "transaction_type": "NEFT"},
        # Normal noise
        {"id": "TX-N1", "source_account_id": "NORMAL-01", "destination_account_id": "VICTIM-001", "amount": 1500.0, "timestamp": now - timedelta(days=2), "risk_score": 2, "status": "completed", "transaction_type": "UPI"}
    ]
    return accounts, transactions

def test_graph_construction(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    G = ge.build_graph(accounts, transactions)

    assert len(G.nodes) == len(accounts)
    assert G.has_edge("VICTIM-001", "MULE-A")
    assert G.has_edge("MULE-A", "MULE-B")
    assert G.has_edge("MULE-B", "CASHOUT-Z")

def test_fan_and_degree_metrics(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)

    fan_a = ge.get_fan_metrics("MULE-A")
    assert fan_a["fan_in"] == 1
    assert fan_a["fan_out"] == 1

    deg_a = ge.get_degree_metrics("MULE-A")
    assert deg_a["total_degree"] == 2

def test_pass_through_ratio(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)

    # Mule A received 50k, forwarded 48.7k -> 48700 / 50000 = 0.974
    pt_ratio = ge.get_pass_through_ratio("MULE-A")
    assert pt_ratio == pytest.approx(0.974, rel=1e-2)

def test_velocity_metrics(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)

    vel = ge.get_velocity_metrics("MULE-A", transactions)
    assert vel["min_delay"] == pytest.approx(18.0)
    assert vel["avg_delay"] == pytest.approx(18.0)

def test_risk_scoring(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)
    re = RiskEngine(ge)

    risk_victim = re.calculate_mule_risk(accounts[0], transactions, accounts)
    assert risk_victim["score"] < 25
    assert risk_victim["level"] == "LOW"

    risk_mule_a = re.calculate_mule_risk(accounts[1], transactions, accounts)
    assert risk_mule_a["score"] >= 75
    assert risk_mule_a["level"] == "CRITICAL"

    risk_cashout = re.calculate_mule_risk(accounts[3], transactions, accounts)
    assert risk_cashout["score"] >= 90
    assert risk_cashout["level"] == "CRITICAL"

def test_next_hop_ranking(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)
    nhe = NextHopEngine(ge)

    res = nhe.predict_next_hops("MULE-A", transactions, accounts, reference_amount=50000.0)
    assert res["current_account"] == "MULE-A"
    assert len(res["predictions"]) >= 1
    top_pred = res["predictions"][0]
    assert top_pred["account_id"] == "MULE-B"
    assert top_pred["confidence"] >= 70

def test_trail_reconstruction(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)
    nhe = NextHopEngine(ge)
    te = TrailEngine(nhe)

    trail_res = te.trace_money_trail("TX-1", transactions, accounts)
    assert trail_res is not None
    assert trail_res["hops"] == 3
    assert trail_res["trail"][0]["from_account"] == "VICTIM-001"
    assert trail_res["trail"][1]["to_account"] == "MULE-B"
    assert trail_res["trail"][2]["to_account"] == "CASHOUT-Z"
    assert trail_res["total_traced_amount"] == 46900.0

def test_network_detection(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)
    nd = NetworkDetector(ge)

    networks = nd.detect_suspicious_networks(accounts, transactions, min_risk=50)
    assert len(networks) >= 1
    net = networks[0]
    assert "MULE-A" in net["key_accounts"] or "MULE-B" in net["key_accounts"]

def test_synthetic_generator_deterministic():
    gen1 = SyntheticGenerator(seed=42)
    data1 = gen1.generate_dataset(account_count=20, transaction_count=40, seed=42)

    gen2 = SyntheticGenerator(seed=42)
    data2 = gen2.generate_dataset(account_count=20, transaction_count=40, seed=42)

    assert len(data1["accounts"]) == len(data2["accounts"])
    assert len(data1["transactions"]) == len(data2["transactions"])
    assert data1["accounts"][0]["id"] == data2["accounts"][0]["id"]
    assert data1["transactions"][0]["amount"] == data2["transactions"][0]["amount"]

def test_blast_radius_calculation(sample_dataset):
    accounts, transactions = sample_dataset
    ge = GraphEngine()
    ge.build_graph(accounts, transactions)

    blast = ge.calculate_blast_radius("MULE-A", accounts, transactions)
    assert blast["account_id"] == "MULE-A"
    assert blast["direct_connections"] >= 2 # VICTIM-001, MULE-B
    assert blast["suspicious_accounts"] >= 2 # MULE-B, CASHOUT-Z
    assert blast["potential_downstream_exposure"] >= 46900.0
