"""
Database migration script.
Creates all tables defined in models.
"""
import asyncio
import logging

from backend.src.database import init_db


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_migration():
    """Run database migrations."""
    logger.info("Running database migration...")
    await init_db()
    logger.info("Migration complete!")


if __name__ == "__main__":
    asyncio.run(run_migration())
