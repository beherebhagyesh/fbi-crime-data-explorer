"""
Phase 1: Pilot Run Script.
Tests the pipeline with a subset of states and offenses.
"""
import asyncio
import logging
from typing import List, Optional

from sqlalchemy import select
from backend.src.database import init_db, get_async_session
from backend.src.models import Agency
from backend.src.crime_fetcher import CrimeFetcher, create_jobs_for_agencies
from backend.src.job_queue import get_job_queue, cleanup_job_queue
from backend.src.http_client import cleanup_http_client


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


PILOT_STATES = ["CA", "TX", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI"]
PILOT_OFFENSES = ["LAR", "BUR", "MVT"]  # Property crimes first


async def run_phase1(
    states: Optional[List[str]] = None,
    offenses: Optional[List[str]] = None,
    worker_count: int = 2,
):
    """
    Run Phase 1: Pilot extraction.
    
    Args:
        states: States to process (default: top 10)
        offenses: Offenses to fetch (default: LAR, BUR, MVT)
        worker_count: Number of concurrent workers
    """
    states = states or PILOT_STATES
    offenses = offenses or PILOT_OFFENSES
    
    logger.info("=" * 50)
    logger.info("PHASE 1: Pilot Run")
    logger.info(f"States: {states}")
    logger.info(f"Offenses: {offenses}")
    logger.info("=" * 50)
    
    try:
        await init_db()
        
        # Get agencies for selected states
        async with get_async_session() as session:
            query = select(Agency).where(Agency.state_abbr.in_(states))
            result = await session.execute(query)
            agencies = result.scalars().all()
        
        logger.info(f"Found {len(agencies)} agencies in {len(states)} states")
        
        # Create jobs
        jobs_created = await create_jobs_for_agencies(
            agencies,
            offenses=offenses,
            years=[2023, 2024],  # 2 years for pilot
        )
        logger.info(f"Created {jobs_created} jobs")
        
        # Run workers
        workers = [CrimeFetcher() for _ in range(worker_count)]
        tasks = [asyncio.create_task(w.run()) for w in workers]
        
        # Wait for jobs to complete (with timeout)
        queue = await get_job_queue()
        while True:
            stats = await queue.get_queue_stats()
            logger.info(f"Queue stats: {stats}")
            
            if stats["pending"] == 0:
                break
            
            await asyncio.sleep(10)
        
        # Stop workers
        for w in workers:
            await w.stop()
        
        await asyncio.gather(*tasks, return_exceptions=True)
        
        logger.info("=" * 50)
        logger.info("PHASE 1 COMPLETE")
        logger.info("=" * 50)
        
    finally:
        await cleanup_job_queue()
        await cleanup_http_client()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Phase 1: Pilot Run")
    parser.add_argument("--states", type=str, help="Comma-separated states")
    parser.add_argument("--offenses", type=str, help="Comma-separated offenses")
    parser.add_argument("--workers", type=int, default=2, help="Worker count")
    
    args = parser.parse_args()
    
    states = args.states.split(",") if args.states else None
    offenses = args.offenses.split(",") if args.offenses else None
    
    asyncio.run(run_phase1(states, offenses, args.workers))
