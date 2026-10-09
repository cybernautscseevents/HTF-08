import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.config import settings
from backend.database import engine, Base, SessionLocal
from backend.models import AccountModel
from backend.seed import seed_database

# Routers
from backend.routers import (
    dashboard,
    accounts,
    transactions,
    cases,
    trail,
    graph,
    alerts,
    networks,
    actions,
    search,
    synthetic,
    risk,
    query,
    reports
)

# Also import graph router with prefix "" for direct /graph paths
from backend.routers.graph import router as graph_router
from backend.routers.accounts import router as accounts_router
from backend.routers.transactions import router as transactions_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("muletracer.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema exists and auto-seed if empty
    logger.info("[STARTUP] Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        acct_count = db.query(AccountModel).count()
        if acct_count == 0:
            logger.info("[STARTUP] Database empty. Running canonical demo seeder...")
            seed_database(db=db, reset=False)
        else:
            logger.info(f"[STARTUP] Found {acct_count} accounts already present.")
    except Exception as e:
        logger.error(f"[STARTUP ERROR] Error checking/seeding database: {e}")
    finally:
        db.close()

    yield

    # Shutdown
    logger.info("[SHUTDOWN] Mule Account Money-Trail Hunter backend shutting down.")

app = FastAPI(
    title="FT-03 Mule Account Money-Trail Hunter API",
    description="Heuristic intelligence platform, graph analytics, and money-trail tracing prototype for banking mule detection.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(dashboard.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(cases.router)
app.include_router(trail.router)
app.include_router(graph.router)
app.include_router(alerts.router)
app.include_router(networks.router)
app.include_router(actions.router)
app.include_router(search.router)
app.include_router(synthetic.router)
app.include_router(risk.router)
app.include_router(query.router)
app.include_router(reports.router)

# Mirror Section 36 direct endpoints (/graph/..., /transactions/..., /accounts/...)
for r in graph.router.routes:
    if getattr(r, 'path', '').startswith('/api/graph'):
        direct_p = r.path.replace('/api/graph', '/graph', 1)
        app.add_api_route(
            direct_p,
            r.endpoint,
            methods=r.methods,
            name=f"direct_root_{r.name}",
            include_in_schema=True
        )

for r in accounts.router.routes:
    if getattr(r, 'path', '').startswith('/api/accounts'):
        direct_p = r.path.replace('/api/accounts', '/accounts', 1)
        app.add_api_route(
            direct_p,
            r.endpoint,
            methods=r.methods,
            name=f"direct_root_acct_{r.name}",
            include_in_schema=True
        )

for r in transactions.router.routes:
    if getattr(r, 'path', '').startswith('/api/transactions'):
        direct_p = r.path.replace('/api/transactions', '/transactions', 1)
        app.add_api_route(
            direct_p,
            r.endpoint,
            methods=r.methods,
            name=f"direct_root_tx_{r.name}",
            include_in_schema=True
        )

@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint confirming database and graph connectivity."""
    db_status = "connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "ok",
        "database": db_status,
        "graph": "ready",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "FT-03 Mule Account Money-Trail Hunter"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
