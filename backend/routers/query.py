from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from backend.database import get_db
from backend.models import AccountModel, TransactionModel, ScamCaseModel
from backend.engine.neo4j_service import neo4j_graph
from backend.engine.graphrag_engine import graphrag_engine

router = APIRouter(tags=["GraphRAG Query Engine"])

class QueryRequest(BaseModel):
    query: str
    context_account: Optional[str] = None

class QueryTraceRequest(BaseModel):
    account_id: str
    reported_amount: Optional[float] = 50000.0

@router.post("/api/query")
@router.post("/query")
def investigator_graphrag_query(payload: QueryRequest, db: Session = Depends(get_db)):
    """
    POST /query and /api/query — Natural Language GraphRAG Investigator Query.
    
    Extracts financial entities, performs multi-hop Neo4j/graph traversal,
    synthesizes deterministic risk signals, and returns a grounded answer
    coupled with the exact 'graph_path' for frontend visualization.
    """
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        cases = db.query(ScamCaseModel).all()
        neo4j_graph.sync_from_database(accounts, transactions, cases)

    try:
        response = graphrag_engine.query(
            user_query=payload.query,
            context_account=payload.context_account
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "GRAPHRAG_ERROR", "message": f"GraphRAG retrieval failed: {str(e)}"}
        )

@router.post("/api/query/trace")
@router.post("/query/trace")
def investigator_trace_query(payload: QueryTraceRequest, db: Session = Depends(get_db)):
    """
    POST /query/trace and /api/query/trace — GraphRAG money-trail query for a specific account.
    """
    if not neo4j_graph.accounts:
        accounts = db.query(AccountModel).all()
        transactions = db.query(TransactionModel).all()
        cases = db.query(ScamCaseModel).all()
        neo4j_graph.sync_from_database(accounts, transactions, cases)

    q = f"Trace the ₹{payload.reported_amount:,.0f} stolen from {payload.account_id}"
    return graphrag_engine.query(user_query=q, context_account=payload.account_id)
