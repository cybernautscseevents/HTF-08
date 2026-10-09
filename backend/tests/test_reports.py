import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_evidence_preview_endpoint():
    # Fetch evidence bundle for canonical case SC-001
    resp = client.get("/api/reports/SC-001/evidence")
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["case_id"] == "SC-001"
    assert "evidence_checklist" in data
    checklist = data["evidence_checklist"]
    assert checklist["victim_identified"] is True
    assert checklist["completeness_score"] >= 70
    
    assert "evidence_manifest" in data
    assert len(data["evidence_manifest"]) > 0
    assert any(item["category"] == "TRANSACTION" for item in data["evidence_manifest"])
    
    assert "victim_details" in data
    assert data["victim_details"]["reported_amount"] > 0
    
    assert "transaction_chain" in data
    assert len(data["transaction_chain"]) >= 1
    
    assert "mule_profiles" in data
    assert len(data["mule_profiles"]) >= 1


def test_generate_fir_report_draft():
    payload = {
        "case_id": "SC-001",
        "report_type": "FIR",
        "include_ai_narrative": False,
        "investigator_name": "Senior Investigator S. Krishnan",
        "additional_notes": "Urgent freeze advised on layer 2 mules."
    }
    resp = client.post("/api/reports/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["report_id"].startswith("RPT-FIR-SC-001-")
    assert data["report_type"] == "FIR"
    assert data["status"] == "DRAFT"
    assert "DRAFT FOR INVESTIGATOR REVIEW" in data["disclaimer"]
    assert len(data["legal_sections"]) >= 4
    assert any("420" in sec for sec in data["legal_sections"])
    assert len(data["recommended_actions"]) >= 3
    assert data["checklist"]["completeness_score"] >= 70


def test_generate_sar_report_draft():
    payload = {
        "case_id": "SC-001",
        "report_type": "SAR",
        "include_ai_narrative": False,
        "investigator_name": "Compliance Officer",
    }
    resp = client.post("/api/reports/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    assert data["report_type"] == "SAR"
    assert data["status"] == "DRAFT"
    assert any("PMLA" in sec for sec in data["legal_sections"])


def test_report_invalid_case():
    resp = client.get("/api/reports/NON-EXISTENT-CASE/evidence")
    assert resp.status_code == 404
    
    resp_gen = client.post("/api/reports/generate", json={"case_id": "NON-EXISTENT-CASE", "report_type": "FIR"})
    assert resp_gen.status_code == 404
