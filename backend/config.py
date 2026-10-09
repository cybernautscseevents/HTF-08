import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "MuleTracer — Fraud Intelligence & Mule Money-Trail Hunter API"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./muletracer.db")
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    DEFAULT_DATASET_SEED: int = 42
    NEXT_HOP_WINDOW_SECONDS: int = 300
    MULE_RISK_THRESHOLD: int = 65
    CRITICAL_RISK_THRESHOLD: int = 85
    # Neo4j Settings
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USER: str = os.getenv("NEO4J_USER", os.getenv("NEO4J_USERNAME", "neo4j"))
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password")
    NEO4J_DATABASE: str = os.getenv("NEO4J_DATABASE", "neo4j")

    # LLM & GraphRAG Settings
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", None))
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-3.8-flash")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
