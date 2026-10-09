import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_full_investigation_judge_lifecycle():
    # 1. Reset / Seed database to canonical demo scenario
    reset_resp = client.post("/api/demo/reset")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"

    # 2. Check Dashboard Metrics
    dash_resp = client.get("/api/dashboard/summary")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["active_cases"] >= 1
    assert dash_data["high_risk_mules"] >= 5
    assert dash_data["transactions_analyzed"] >= 20

    # 3. Retrieve Scam Case SC-001
    case_resp = client.get("/api/cases/SC-001")
    assert case_resp.status_code == 200
    case_data = case_resp.json()
    assert case_data["id"] == "SC-001"
    assert case_data["victim_account_id"] == "VICTIM-001"
    assert case_data["reported_transaction_id"] == "TX-10001"

    # 4. Reconstruct Case Money Trail
    trail_resp = client.get("/api/cases/SC-001/trail")
    assert trail_resp.status_code == 200
    trail_data = trail_resp.json()
    assert trail_data["case_transaction_id"] == "TX-10001"
    assert trail_data["hops"] == 4
    assert trail_data["trail"][0]["from_account"] == "VICTIM-001"
    assert trail_data["trail"][1]["to_account"] == "MULE-042"
    assert trail_data["trail"][2]["to_account"] == "MULE-103"

    # 5. Retrieve Graph Visualization with highlighted trail
    graph_resp = client.get("/api/graph?case_id=SC-001")
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()
    assert len(graph_data["nodes"]) >= 20
    assert len(graph_data["edges"]) >= 25
    assert "MULE-017" in graph_data["highlighted_node_ids"]
    assert "MULE-042" in graph_data["highlighted_node_ids"]
    assert "TX-10002" in graph_data["highlighted_edge_ids"]

    # 6. Retrieve Account Detail with 7-Factor Risk Breakdown
    acct_resp = client.get("/api/accounts/MULE-042")
    assert acct_resp.status_code == 200
    acct_data = acct_resp.json()
    assert acct_data["id"] == "MULE-042"
    assert acct_data["risk_score"] >= 80
    assert acct_data["risk_level"] == "CRITICAL"
    assert len(acct_data["risk_factors"]) >= 5

    # 7. Predict Next-Hop Candidates from MULE-042
    next_hop_resp = client.get("/api/accounts/MULE-042/next-hops")
    assert next_hop_resp.status_code == 200
    next_hop_data = next_hop_resp.json()
    assert len(next_hop_data["predictions"]) >= 1
    top_candidate = next_hop_data["predictions"][0]
    assert top_candidate["account_id"] == "MULE-103"
    assert top_candidate["confidence"] >= 75

    # 8. Retrieve Generated Alerts
    alerts_resp = client.get("/api/alerts")
    assert alerts_resp.status_code == 200
    alerts_list = alerts_resp.json()
    assert len(alerts_list) >= 1

    # 9. Perform Simulated Investigator Freeze Recommendation
    freeze_payload = {
        "account_id": "MULE-103",
        "case_id": "SC-001",
        "action_type": "FREEZE_RECOMMENDED",
        "reason": "High probability next-hop account in digital arrest laundering ring."
    }
    freeze_resp = client.post("/api/actions/freeze-recommendation", json=freeze_payload)
    assert freeze_resp.status_code == 200
    freeze_data = freeze_resp.json()
    assert freeze_data["status"] == "REVIEW_INITIATED"
    assert freeze_data["simulated"] is True
    assert freeze_data["account_id"] == "MULE-103"

    # 10. Verify Account Status has transitioned to frozen (simulated)
    updated_acct_resp = client.get("/api/accounts/MULE-103")
    assert updated_acct_resp.status_code == 200
    assert updated_acct_resp.json()["status"] == "frozen"

    # 11. Verify Action recorded in audit trail
    actions_resp = client.get("/api/actions")
    assert actions_resp.status_code == 200
    actions_list = actions_resp.json()
    assert any(a["account_id"] == "MULE-103" for a in actions_list)

    # 12. Blast Radius Analysis
    blast_resp = client.get("/api/graph/blast-radius/MULE-042")
    assert blast_resp.status_code == 200
    blast_data = blast_resp.json()
    assert blast_data["direct_connections"] >= 2
    assert blast_data["suspicious_accounts"] >= 3
    assert blast_data["total_suspicious_flow"] > 0

    # 13. Case Notes Management
    note_resp = client.post("/api/cases/SC-001/notes", json={
        "author": "S. Krishnan (Lead Investigator)",
        "note": "Provisional administrative freeze triggered on downstream terminal hop."
    })
    assert note_resp.status_code == 200
    assert note_resp.json()["note"] == "Provisional administrative freeze triggered on downstream terminal hop."

    get_notes = client.get("/api/cases/SC-001/notes")
    assert get_notes.status_code == 200
    assert len(get_notes.json()) >= 4

    # 14. Exportable Investigation Summary
    export_resp = client.get("/api/cases/SC-001/export")
    assert export_resp.status_code == 200
    export_data = export_resp.json()
    assert "markdown_report" in export_data
    assert "FINANCIAL CRIME INVESTIGATION DOSSIER" in export_data["markdown_report"]
    assert export_data["case_details"]["type"] == "DIGITAL_ARREST"

    # 15. Audit Logs
    audit_resp = client.get("/api/actions/audit-logs")
    assert audit_resp.status_code == 200
    assert len(audit_resp.json()) >= 4

    # 16. Health Check
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "ok"
    assert health_resp.json()["database"] == "connected"
