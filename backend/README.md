# FT-03 Mule Account Money-Trail Hunter — Intelligence Backend

A high-performance graph intelligence and money-trail hunting prototype for detecting digital arrest and investment scam mule networks before illicit funds exit the banking perimeter.

---

## 1. System Architecture

```text
Frontend (React 19 + TypeScript + Vite)
   │
   │ REST / JSON (http://127.0.0.1:8000/api)
   ▼
API Layer (FastAPI)
   │
   ├── Dashboard APIs        (/api/dashboard/summary, /trends, /recent-alerts)
   ├── Case APIs             (/api/cases, /{id}, /{id}/trail, /{id}/network)
   ├── Account APIs          (/api/accounts, /{id}, /{id}/risk, /{id}/next-hops)
   ├── Transaction APIs      (/api/transactions, /{id}, /{id}/trail)
   ├── Graph APIs            (/api/graph, /account/{id}, /path)
   ├── Money Trail APIs      (/api/trail/{tx_id})
   ├── Alert APIs            (/api/alerts, /{id}/read)
   ├── Syndicate Ring APIs   (/api/networks, /{id})
   ├── Simulated Action APIs (/api/actions/freeze-recommendation, /flag-account)
   └── Synthetic Engine APIs (/api/synthetic/generate, /demo/reset, /simulate/transaction)
   │
   ▼
Service Layer (Python 3.13)
   │
   ├── Graph Engine          (NetworkX DiGraph, Multi-Edge, Centrality, Cycles)
   ├── Mule Risk Engine      (Transparent 7-Factor Heuristic Risk Model)
   ├── Trail Engine          (Time-Aware Greedy Path Reconstructor, Delay & Retention)
   ├── Next-Hop Engine       (Probabilistic Downstream Destination Ranker)
   ├── Network Detector      (Connected Components Cluster & Syndicate Ring Mining)
   └── Synthetic Generator   (Deterministic PRNG Multi-Tier Banking Simulator)
   │
   ▼
Storage Layer
   SQLite (`muletracer.db`) via SQLAlchemy ORM (Self-contained, zero-friction setup)
```

---

## 2. Quickstart & Startup Commands

### Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- Dependencies installed: `fastapi`, `uvicorn`, `networkx`, `sqlalchemy`, `pydantic-settings`, `pytest`

### Step 1: Initialize Database & Seed Canonical Demo Dataset
```bash
python -m backend.seed
```
This initializes the SQLite schema, populates canonical scam entities (`VICTIM-001`, `MULE-017`, `MULE-042`, `MULE-103`, `CASHOUT-009`), runs graph construction, risk calculations, ring mining, and generates baseline alerts.

### Step 2: Launch Backend Server
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger API documentation will be available immediately at:
- **Swagger Docs:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`
- **Health Check:** `http://127.0.0.1:8000/health`

### Step 3: Run Full Test Suite (Unit & E2E Integration)
```bash
python -m pytest backend/tests/
```
Output:
```text
10 passed in 1.44s
```

---

## 3. Core Intelligence Features

### A. Explainable 7-Factor Mule Risk Model
The system does not claim black-box AI magic. It computes an explainable heuristic score out of 100 based on banking fraud patterns:
1. **Pass-through Velocity (Weight: 25%):** Outgoing volume ratio / incoming volume and rapid delay (< 45s).
2. **Fan-out Behavior (Weight: 20%):** Dispersal across multiple counterparties.
3. **Fan-in Behavior (Weight: 15%):** Multiple unrelated funding sources.
4. **Graph Centrality (Weight: 15%):** Normalized degree centrality in the flow graph.
5. **Transaction Burst (Weight: 10%):** Cluster of transfers within 180 seconds.
6. **Network Membership (Weight: 10%):** Direct adjacency to high-risk mule accounts.
7. **Behavioral Anomaly (Weight: 5%):** Layering structure deviating from retail consumer baseline.

### B. Time-Aware Money Trail Reconstruction (`/api/trail/{tx_id}`)
Reconstructs the movement of reported scam funds hop by hop:
- Hop 0: `VICTIM-001` → `MULE-017` (₹50,000, 10:42:13)
- Hop 1: `MULE-017` → `MULE-042` (₹48,700, +18 sec delay, 97.4% retention)
- Hop 2: `MULE-042` → `MULE-103` (₹46,900, +31 sec delay, 96.3% retention)
- Hop 3: `MULE-103` → `CASHOUT-009` (₹44,800, +45 sec delay, terminal cashout sink)

### C. Risk-Based Next-Hop Prediction (`/api/accounts/{id}/next-hops`)
Calculates candidate confidence ranking combining fund continuity, destination mule risk, transfer velocity, and ring membership.
Example output for `MULE-042`:
- **Rank #1:** `MULE-103` (Confidence: 88%, Expected: ₹46,900, Delay: ~31s)
- **Rank #2:** `MULE-028` (Confidence: 69%, Expected: ₹12,000, Delay: ~31s)
- **Rank #3:** `MERCHANT-204` (Confidence: 18%, Expected: ₹3,500, Retail diversion)

### D. Simulated Investigator Action (`/api/actions/freeze-recommendation`)
Records simulated account freeze recommendations in the audit table and marks the account status as `frozen` across all subsequent queries, proving the intervention loop without touching real bank core systems.

---

## 4. Canonical Demo Scenario & End-to-End Judge Flow

1. **Dashboard KPI Overview:** Visit `GET /api/dashboard/summary` to view active cases, detected mules, and at-risk volume.
2. **Scam Case Selection:** Fetch `GET /api/cases/SC-001` (Digital Arrest Case).
3. **Trail Reconstruction:** Fetch `GET /api/cases/SC-001/trail` to trace `TX-10001` across 4 hops.
4. **Graph Subgraph:** Fetch `GET /api/graph?case_id=SC-001` to view directed edges with `highlighted_node_ids` and `highlighted_edge_ids`.
5. **Mule Account Inspection:** Fetch `GET /api/accounts/MULE-042` to inspect 7-factor explainability.
6. **Probable Next Hop:** Fetch `GET /api/accounts/MULE-042/next-hops` to view predicted downstream destinations.
7. **Freeze Action:** Submit `POST /api/actions/freeze-recommendation` with `{"account_id": "MULE-103"}`.
8. **Audit Verification:** Verify simulated freeze recorded in `GET /api/actions`.
9. **Demo Reset:** Reset to pristine demo state at any time via `POST /api/demo/reset`.
