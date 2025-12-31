"""
Database connection and session management.
Provides async and sync database access.
"""
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker, Session

from backend.config.settings import get_settings
from backend.src.models import Base


# Get settings
settings = get_settings()


# Async engine for production use
async_engine = create_async_engine(
    settings.database.connection_url,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Sync engine for migrations and scripts
sync_engine = create_engine(
    settings.database.sync_url,
    echo=False,
    pool_pre_ping=True,
)

# Sync session factory
SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    expire_on_commit=False,
)


@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager for database sessions.
    Automatically handles commit/rollback.
    """
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


def get_sync_session() -> Session:
    """Get synchronous session for scripts."""
    return SyncSessionLocal()


async def init_db():
    """Initialize database tables."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db():
    """Drop all database tables (use with caution)."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def check_connection() -> bool:
    """Check if database connection is healthy."""
    try:
        async with get_async_session() as session:
            await session.execute("SELECT 1")
            return True
    except Exception:
        return False
