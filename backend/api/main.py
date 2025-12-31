"""
FastAPI main application.
Entry point for the backend API server.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import counties, crimes, analytics, system, stats
from backend.src.database import init_db
from backend.src.http_client import cleanup_http_client
from backend.src.job_queue import cleanup_job_queue
from backend.config.proxy_config import get_proxy_manager


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan manager."""
    logger.info("Starting FBI Crime Pipeline API...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    yield
    
    # Cleanup
    logger.info("Shutting down...")
    await cleanup_http_client()
    await cleanup_job_queue()


app = FastAPI(
    title="FBI Crime Data Pipeline API",
    description="Production-grade API for FBI crime statistics with 5-year trends",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware - Allow all localhost origins for development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(counties.router, prefix="/api/counties", tags=["Counties"])
app.include_router(crimes.router, prefix="/api/crimes", tags=["Crimes"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(system.router, prefix="/api/system", tags=["System"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "FBI Crime Data Pipeline",
        "version": "1.0.0",
    }


@app.get("/api/proxy/status")
async def proxy_status():
    """Get proxy status."""
    proxy_manager = get_proxy_manager()
    return proxy_manager.get_status()


@app.post("/api/proxy/toggle")
async def toggle_proxy():
    """Toggle proxy on/off."""
    proxy_manager = get_proxy_manager()
    new_state = proxy_manager.toggle()
    return {
        "proxy_enabled": new_state,
        "message": f"Proxy {'enabled' if new_state else 'disabled'}",
    }


@app.post("/api/proxy/enable")
async def enable_proxy():
    """Enable proxy."""
    proxy_manager = get_proxy_manager()
    proxy_manager.enable()
    return {"proxy_enabled": True}


@app.post("/api/proxy/disable")
async def disable_proxy():
    """Disable proxy."""
    proxy_manager = get_proxy_manager()
    proxy_manager.disable()
    return {"proxy_enabled": False}
