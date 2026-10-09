from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from backend.database import get_db
from backend.models import AccountModel, TransactionModel, ScamCaseModel
from backend.schemas import GraphResponse, GraphNode, GraphEdge, BlastRadiusResponse
from backend.engine.pipeline import pipeline
from backend.engine.neo4j_service import neo4j_graph

router = APIRouter(prefix="/api/graph", tags=["Graph Intelligence"])

class TraceRequest(BaseModel):
    account_id: str
    amount: Optional[float] = None
    max_hops: Optional[int] = 5
    time_window_minutes: Optional[int] = 180

class CypherQueryRequest(BaseModel):
    query: str
    parameters: Optional[Dict[str, Any]] = None

@router.get("", response_model=GraphResponse)
def get_graph(case_id: Optional[str] = "SC-001", db: Session = Depends(get_db)):
    """Returns standard graph response for frontend visualization."""
    accounts = db.query(AccountModel).all()
    transactions = db.query(TransactionModel).all()

    pipeline.graph_engine.build_graph(accounts, transactions)

    nodes = [
        GraphNode(
            id=a.id,
            label=a.display_name,
            type=a.account_type,
            bank=a.bank,
            risk_score=a.risk_score,
            risk_level=a.risk_level,
            status=a.status,
            device_id=a.device_id,
            total_incoming=a.total_incoming,
            total_outgoing=a.total_outgoing
        )
        for a in accounts
    ]

    edges = [
        GraphEdge(
            id=t.id,
            source=t.source_account_id,
            target=t.destination_account_id,
            amount=t.amount,
            timestamp=t.timestamp.isoformat(),
            risk_score=t.risk_score,
            status=t.status,
            type=t.transaction_type,
            payment_rail=getattr(t, 'payment_rail', t.transaction_type)
        )
        for t in transactions
    ]

    highlighted_node_ids = []
    highlighted_edge_ids = []
    probable_next_hop = None

    target_case = None
    if case_id:
        target_case = db.query(ScamCaseModel).filter(ScamCaseModel.id == case_id).first()
    if not target_case:
        target_case = db.query(ScamCaseModel).order_by(ScamCaseModel.risk_score.desc()).first()

    if target_case and target_case.reported_transaction_id:
        trail_res = pipeline.trail_engine.trace_money_trail(
            target_case.reported_transaction_id,
            transactions,
            accounts
        )
        if trail_res:
            for step in trail_res.get("trail", []):
                highlighted_node_ids.append(step["from_account"])
                highlighted_node_ids.append(step["to_account"])
                highlighted_edge_ids.append(step["transaction_id"])
            p_next = trail_res.get("probable_next_hop")
            if p_next:
                probable_next_hop = p_next.get("account_id")
                highlighted_node_ids.append(probable_next_hop)

    return GraphResponse(
        nodes=nodes,
        edges=edges,
        highlighted_node_ids=list(dict.fromkeys(highlighted_node_ids)),
        highlighted_edge_ids=list(dict.fromkeys(highlighted_edge_ids)),
        probable_next_hop=probable_next_hop
    )

# Section 36 Endpoints
@router.get("/network")
def get_graph_network(
    limit: int = Query(200, description="Max accounts to return"),
    min_risk: int = Query(0, description="Minimum risk score filter"),
    db: Session = Depends(get_db)
):
    """GET /graph/network — Full financial crime network topology."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        cases = db.query(ScamCaseModel).all()
        neo4j_graph.sync_from_database(accounts, transactions, cases)
    return neo4j_graph.get_network(limit=limit, min_risk=min_risk)

@router.get("/entity/{id}")
def get_graph_entity(id: str, db: Session = Depends(get_db)):
    """GET /graph/entity/{id} — Detailed profile of an Account, Device, Merchant, or Customer."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)

    entity = neo4j_graph.get_entity(id)
    if not entity:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": f"Entity '{id}' not found."})
    return entity

@router.get("/search")
def search_graph(q: str = Query(..., description="Search query string"), db: Session = Depends(get_db)):
    """GET /graph/search?q= — Search entities across accounts, devices, transactions."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)
    return neo4j_graph.search_entities(q)

@router.get("/neighbors/{id}")
def get_graph_neighbors(id: str, depth: int = Query(1, ge=1, le=3), db: Session = Depends(get_db)):
    """GET /graph/neighbors/{id} — Neighborhood ego-network around entity."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)
    return neo4j_graph.get_neighbors(id, depth=depth)

@router.post("/trace")
def trace_money_trail(payload: TraceRequest, db: Session = Depends(get_db)):
    """POST /graph/trace — Dedicated chronological multi-hop money-trail engine."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)

    result = neo4j_graph.trace_money(
        account_id=payload.account_id,
        amount=payload.amount,
        max_hops=payload.max_hops or 5,
        time_window_minutes=payload.time_window_minutes or 180
    )
    return result

@router.get("/blast-radius/{id}", response_model=BlastRadiusResponse)
def get_blast_radius(id: str, db: Session = Depends(get_db)):
    """GET /graph/blast-radius/{id} — Multi-hop perimeter exposure calculation."""
    accounts = db.query(AccountModel).all()
    transactions = db.query(TransactionModel).all()
    pipeline.graph_engine.build_graph(accounts, transactions)
    neo4j_graph.sync_from_database(accounts, transactions)

    res = neo4j_graph.calculate_blast_radius(id)
    return BlastRadiusResponse(
        account_id=res["account_id"],
        direct_connections=res["direct_connections"],
        two_hop_connections=res["two_hop_connections"],
        three_hop_connections=res["three_hop_connections"],
        suspicious_accounts=res["suspicious_accounts"],
        total_suspicious_flow=res["total_suspicious_flow"],
        potential_downstream_exposure=res["potential_downstream_exposure"],
        connected_nodes=res["connected_nodes"],
        suspicious_nodes=res["suspicious_nodes"]
    )

@router.get("/suspicious-path/{source}/{target}")
def get_suspicious_path(source: str, target: str, db: Session = Depends(get_db)):
    """GET /graph/suspicious-path/{source}/{target} — Directed money route traversal."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)

    path = neo4j_graph.find_suspicious_path(source, target)
    if not path:
        return {"source": source, "target": target, "found": False, "hops": 0, "path": []}
    return {"source": source, "target": target, "found": True, "hops": len(path) - 1, "path": path}

@router.get("/cycles/{id}")
def get_cycles_for_account(id: str, db: Session = Depends(get_db)):
    """GET /graph/cycles/{id} — Circular fund movement detector (A -> B -> C -> A)."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)
    cycles = neo4j_graph.detect_cycles(id)
    return {"account_id": id, "cycle_count": len(cycles), "cycles": cycles}

@router.get("/fan-in/{id}")
def get_fan_in(id: str, db: Session = Depends(get_db)):
    """GET /graph/fan-in/{id} — Inbound fund aggregation / pooling detector."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)
    return neo4j_graph.detect_fan_in(id)

@router.get("/fan-out/{id}")
def get_fan_out(id: str, db: Session = Depends(get_db)):
    """GET /graph/fan-out/{id} — Outbound fund dispersion detector."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)
    return neo4j_graph.detect_fan_out(id)

@router.get("/communities")
def get_communities(db: Session = Depends(get_db)):
    """GET /graph/communities — Suspicious syndicate community detection."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)
    return neo4j_graph.get_communities()

@router.get("/centrality")
def get_centrality(db: Session = Depends(get_db)):
    """GET /graph/centrality — Degree, Betweenness, and PageRank network hubs."""
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        neo4j_graph.sync_from_database(accounts, transactions)
    return neo4j_graph.get_centrality()

@router.post("/cypher")
def run_read_only_cypher(payload: CypherQueryRequest):
    """Safe read-only Cypher execution endpoint."""
    try:
        neo4j_graph.validate_cypher(payload.query)
        res = neo4j_graph.run_cypher(payload.query, payload.parameters)
        return {"query": payload.query, "results": res, "count": len(res)}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail={"code": "FORBIDDEN_CYPHER", "message": str(val_err)})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "CYPHER_EXEC_ERROR", "message": str(e)})

@router.get("/trace/{transaction_id}")
def trace_transaction_alias(transaction_id: str, db: Session = Depends(get_db)):
    all_accounts = db.query(AccountModel).all()
    all_txns = db.query(TransactionModel).all()
    trail_res = pipeline.trail_engine.trace_money_trail(transaction_id, all_txns, all_accounts)
    if not trail_res:
        raise HTTPException(status_code=404, detail={"code": "TRAIL_NOT_FOUND", "message": f"Trail for {transaction_id} not found."})
    return trail_res

@router.get("/account/{account_id}")
def get_account_subgraph(account_id: str, depth: int = 1, db: Session = Depends(get_db)):
    return get_graph_neighbors(account_id, depth=depth, db=db)

@router.get("/case/{case_id}")
def get_case_subgraph(case_id: str, db: Session = Depends(get_db)):
    return get_graph(case_id=case_id, db=db)

@router.get("/path")
def search_graph_path(
    source: str = Query(..., description="Source account ID"),
    target: str = Query(..., description="Target account ID"),
    db: Session = Depends(get_db)
):
    return get_suspicious_path(source=source, target=target, db=db)

@router.get("/{account_id}")
def get_graph_account_alias(account_id: str, db: Session = Depends(get_db)):
    return get_graph_neighbors(account_id, depth=1, db=db)
