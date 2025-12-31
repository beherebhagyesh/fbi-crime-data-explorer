"""
Heavy-lift worker for large agencies.
Dedicated processing for NYPD, LAPD, and other high-population agencies.
"""
import asyncio
import logging
import signal
import uuid
from typing import Optional

from backend.src.http_client import HTTPClient, get_http_client
from backend.src.job_queue import JobQueue, Job, get_job_queue
from backend.src.crime_fetcher import CrimeFetcher
from backend.config.settings import get_settings


logger = logging.getLogger(__name__)


class HeavyLiftWorker(CrimeFetcher):
    """
    Specialized worker for large agencies (top 50 by population).
    - Longer timeouts (60s)
    - Lower concurrency (1 at a time)
    - Extra retry logic
    """
    
    def __init__(
        self,
        worker_id: Optional[str] = None,
        client: Optional[HTTPClient] = None,
        queue: Optional[JobQueue] = None,
    ):
        super().__init__(worker_id, client, queue)
        self.worker_id = worker_id or f"heavy-{uuid.uuid4().hex[:8]}"
        self.settings = get_settings()
    
    async def fetch_crime_data(self, ori: str, offense: str, year: int):
        """
        Override with longer timeout for large agencies.
        """
        from backend.src.api_models import CrimeResponse, FetchResult
        
        state_abbr = ori[:2] if len(ori) >= 2 else None
        timeout = self.settings.timeout.heavy_lift_timeout
        
        # Single request at a time, longer timeout
        crime_data = await self.client.get_with_retry(
            f"/summarized/agency/{ori}/{offense}",
            params={
                "from": f"01-{year}",
                "to": f"12-{year}",
                "type": "counts",
            },
            circuit_id=state_abbr,
            timeout=timeout,
            max_retries=5,  # More retries for large agencies
        )
        
        result = FetchResult(
            ori=ori,
            offense=offense,
            year=year,
            raw_json=crime_data,
        )
        
        if crime_data is None:
            result.success = False
            result.error = "API returned no data after 5 retries"
            return result
        
        try:
            response = CrimeResponse(**crime_data)
            result.actual_count = response.actual_count
        except Exception as e:
            result.success = False
            result.error = f"Parse error: {e}"
            return result
        
        # Fetch participation with extended timeout
        participation_data = await self.client.get_with_retry(
            f"/participation/agency/{ori}/{year}/{year}",
            circuit_id=state_abbr,
            timeout=timeout,
        )
        
        if participation_data and isinstance(participation_data, dict):
            results = participation_data.get("results", [])
            if results:
                result.months_reported = results[0].get("reported") or results[0].get("months_reported")
                result.population = results[0].get("population")
        
        return result
    
    async def run(self) -> None:
        """
        Main loop with throttling for large agencies.
        Adds delay between requests to avoid overwhelming the API.
        """
        await self._init_queue()
        self._running = True
        
        logger.info(f"Heavy-lift worker {self.worker_id} starting...")
        
        while self._running and not self._shutdown_event.is_set():
            try:
                job_data = await self.queue.get_job(
                    self.worker_id,
                    block_ms=5000,
                )
                
                if job_data is None:
                    continue
                
                message_id, job = job_data
                logger.info(f"Heavy-lift processing: {job.ori}/{job.offense}/{job.year}")
                
                success = await self.process_job(message_id, job)
                
                if success:
                    logger.info(f"Heavy-lift completed: {job.job_id}")
                else:
                    logger.warning(f"Heavy-lift failed: {job.job_id}")
                
                # Throttle between requests
                await asyncio.sleep(2)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heavy-lift worker error: {e}")
                await asyncio.sleep(5)
        
        logger.info(f"Heavy-lift worker {self.worker_id} stopped")


async def run_heavy_lift_worker():
    """Entry point for heavy-lift worker."""
    worker = HeavyLiftWorker()
    
    # Setup signal handlers
    try:
        worker.setup_signal_handlers()
    except NotImplementedError:
        # Windows doesn't support signal handlers in asyncio
        pass
    
    await worker.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_heavy_lift_worker())
