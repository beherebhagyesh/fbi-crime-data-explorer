"""
Phase 0: Seed Data Collection Script.
Fetches states, agencies, and builds ORI-to-county mapping.
"""
import asyncio
import logging
from typing import Optional, List

from backend.src.seed_collector import SeedCollector
from backend.src.database import init_db
from backend.src.http_client import cleanup_http_client


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def run_phase0(states: Optional[List[str]] = None):
    """
    Run Phase 0: Seed data collection.
    
    Args:
        states: Optional list of state abbreviations to process.
                If None, processes all 51 states/DC.
    """
    logger.info("=" * 50)
    logger.info("PHASE 0: Seed Data Collection")
    logger.info("=" * 50)
    
    try:
        # Initialize database
        logger.info("Initializing database...")
        await init_db()
        
        # Run collector
        collector = SeedCollector()
        stats = await collector.run(states)
        
        logger.info("=" * 50)
        logger.info("PHASE 0 COMPLETE")
        logger.info(f"States: {stats['states']}")
        logger.info(f"Counties: {stats['counties']}")
        logger.info(f"Agencies: {stats['agencies']}")
        logger.info("=" * 50)
        
        return stats
        
    finally:
        await cleanup_http_client()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Phase 0: Seed Data Collection")
    parser.add_argument(
        "--states",
        type=str,
        help="Comma-separated list of state abbreviations (e.g., 'CA,TX,NY')",
    )
    
    args = parser.parse_args()
    states = args.states.split(",") if args.states else None
    
    asyncio.run(run_phase0(states))
