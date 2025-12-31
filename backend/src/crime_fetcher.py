"""
Crime data fetcher worker.
Pulls jobs from queue and fetches crime data from FBI API.
"""
import asyncio
import logging
import signal
import uuid
from typing import Optional, List
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from backend.src.http_client import HTTPClient, get_http_client
from backend.src.job_queue import JobQueue, Job, get_job_queue
from backend.src.database import get_async_session
from backend.src.models import JobLedger, RawResponse, Agency, JobStatus
from backend.src.api_models import CrimeResponse, FetchResult
from backend.config.offenses import OFFENSE_CODES, EXTRACTION_YEARS


logger = logging.getLogger(__name__)


class CrimeFetcher:
    """
    Worker that fetches crime data from FBI API.
    - Reads jobs from Redis queue
    - Fetches crime + participation data
    - Saves to PostgreSQL
    - Handles graceful shutdown
    """
    
    def __init__(
        self,
        worker_id: Optional[str] = None,
        client: Optional[HTTPClient] = None,
        queue: Optional[JobQueue] = None,
    ):
        self.worker_id = worker_id or f"fetcher-{uuid.uuid4().hex[:8]}"
        self.client = client or get_http_client()
        self.queue = queue
        self._running = False
        self._shutdown_event = asyncio.Event()
    
    async def _init_queue(self):
        """Initialize queue if not provided."""
        if self.queue is None:
            self.queue = await get_job_queue()
    
    async def fetch_crime_data(self, ori: str, offense: str, year: int) -> FetchResult:
        """
        Fetch crime data for a single ORI/offense/year.
        Returns FetchResult with actual_count and months_reported.
        """
        state_abbr = ori[:2] if len(ori) >= 2 else None
        
        # Fetch crime counts
        crime_data = await self.client.get_with_retry(
            f"/summarized/agency/{ori}/{offense}",
            params={
                "from": f"01-{year}",
                "to": f"12-{year}",
                "type": "counts",
            },
            circuit_id=state_abbr,
        )
        
        result = FetchResult(
            ori=ori,
            offense=offense,
            year=year,
            raw_json=crime_data,
        )
        
        if crime_data is None:
            result.success = False
            result.error = "API returned no data"
            return result
        
        # Parse response
        try:
            response = CrimeResponse(**crime_data)
            result.actual_count = response.actual_count
        except Exception as e:
            result.success = False
            result.error = f"Parse error: {e}"
            return result
        
        # Fetch participation data for months_reported
        participation_data = await self.client.get_with_retry(
            f"/participation/agency/{ori}/{year}/{year}",
            circuit_id=state_abbr,
        )
        
        if participation_data and isinstance(participation_data, dict):
            results = participation_data.get("results", [])
            if results:
                result.months_reported = results[0].get("reported") or results[0].get("months_reported")
                result.population = results[0].get("population")
        
        return result
    
    async def fetch_agency_crimes(
        self,
        ori: str,
        years: Optional[List[int]] = None,
        offenses: Optional[List[str]] = None,
    ) -> List[dict]:
        """
        Fetch all crime data for an agency.
        OPTIMIZED: Uses range query (2020-2024) to fetch all years in ONE request per offense.
        """
        years = sorted(years or EXTRACTION_YEARS)
        offenses = offenses or OFFENSE_CODES
        
        start_year = years[0]
        end_year = years[-1]
        
        logger.info(f"Fetching crimes for {ori}: {len(offenses)} offenses (Range {start_year}-{end_year})")
        
        records = []
        
        # Parallel fetch for offenses, but each offense is just 1 request now!
        sem = asyncio.Semaphore(5)
        
        async def fetch_offense_range(offense: str):
            async with sem:
                try:
                    # Determine URL and circuit
                    # Use /nibrs/ endpoint for state and national (supports all offense codes)
                    if ori.startswith("STATE_"):
                        state_abbr = ori.split("_")[1]
                        url = f"/nibrs/state/{state_abbr}/{offense}"
                        circuit = state_abbr
                        level = "state"
                    elif ori == "NATIONAL_US":
                        url = f"/nibrs/national/{offense}"
                        circuit = "US"
                        level = "national"
                    else:
                        # Agency level - use /nibrs/agency/ for all offense codes
                        url = f"/nibrs/agency/{ori}/{offense}"
                        circuit = ori[:2]
                        level = "agency"

                    params = {
                        "from": f"01-{start_year}",
                        "to": f"12-{end_year}",
                        "type": "counts"
                    }
                    crime_data = await self.client.get_with_retry(
                        url, params=params, circuit_id=circuit
                    )
                    
                    if not crime_data:
                        logger.info(f"No data for {ori}/{offense}")
                        return []

                    # 2. Fetch Participation (Only for standard agencies)
                    part_map = {}
                    if level == "agency":
                        p_data = await self.client.get_with_retry(
                            f"/participation/agency/{ori}/{start_year}/{end_year}",
                            circuit_id=circuit
                        )
                        if p_data and 'results' in p_data:
                             for p in p_data['results']:
                                 dy = p.get('data_year')
                                 if dy:
                                     part_map[dy] = {
                                         'months_reported': p.get('reported') or p.get('months_reported'),
                                         'population': p.get('population')
                                     }

                    # 3. Process Counts, Clearances, and Coverage
                    # Structural Robustness: Some endpoints wrap in 'offenses', some don't.
                    target_root = crime_data
                    if 'offenses' in crime_data:
                        target_root = crime_data['offenses']
                    
                    actuals_dict = target_root.get('actuals', {})
                    tooltips_dict = target_root.get('tooltips', {}).get('Percent of Population Coverage', {})
                    if not tooltips_dict and 'tooltips' in target_root:
                         # Fallback for different nesting
                         tooltips_dict = target_root['tooltips'].get('Percent of Population Coverage', {})
                    
                    # Populations can be at top or nested
                    populations_dict = target_root.get('populations', {}).get('population', {})
                    if not populations_dict and 'populations' in crime_data:
                         populations_dict = crime_data['populations'].get('population', {})

                    logger.debug(f"Parsing {level} counts. Actuals keys: {list(actuals_dict.keys())}")
                    
                    # Mapping logic for different levels
                    def get_data_for_key(d, key_suffix, year):
                        if not d: return {"total": 0, "has_data": False}
                        # Find key that contains suffix (e.g. "Offenses" or "Clearances")
                        # For state it's "Alabama Offenses", for agency it's "Agency Offenses"
                        target_key = next((k for k in d.keys() if key_suffix in k), None)
                        if not target_key: return {"total": 0, "has_data": False}
                        
                        months = d[target_key]
                        year_total = 0
                        has_data = False
                        suffix = f"-{year}"
                        for date_key, val in months.items():
                            if date_key.endswith(suffix):
                                if val is not None:
                                    try:
                                        year_total += float(val)
                                        has_data = True
                                    except (ValueError, TypeError):
                                        pass
                        return {"total": int(year_total), "has_data": has_data}

                    # Coverage and Population also nested by State Name or "United States"
                    def get_ref_data(d, year):
                        if not d: return None
                        # Extract first key that isn't empty
                        ref_key = next(iter(d.keys()), None)
                        if not ref_key: return None
                        
                        months = d[ref_key]
                        latest_val = None
                        for m in range(12, 0, -1):
                            key = f"{m:02d}-{year}"
                            if key in months:
                                val = months[key]
                                if val is not None:
                                    latest_val = float(val)
                                    break
                        return latest_val

                    processed_years = []
                    async with get_async_session() as session:
                        for year in years:
                            # 3a. Get Offenses
                            off_res = get_data_for_key(actuals_dict, "Offenses", year)
                            
                            # 3b. Get Clearances
                            clear_res = get_data_for_key(actuals_dict, "Clearances", year)
                            
                            # 3c. Get Coverage & Population
                            cov = get_ref_data(tooltips_dict, year)
                            pop_ref = get_ref_data(populations_dict, year)
                            
                            # 3d. Final participation/pop selection
                            pm = part_map.get(year, {})
                            months_rep = pm.get('months_reported')
                            pop = pm.get('population') or pop_ref
                            
                            logger.debug(f"Year {year} {offense}: Count={off_res['total']}, Pop={pop}, Cov={cov}")
                            
                            # DB Insert
                            stmt = insert(RawResponse).values(
                                ori=ori,
                                offense=offense,
                                year=year,
                                actual_count=int(off_res.get("total", 0)),
                                clearance_count=int(clear_res.get("total", 0)) if clear_res['has_data'] else None,
                                months_reported=months_rep,
                                population=pop,
                                population_pct=cov,
                                raw_json=crime_data,
                                parsed_ok=True,
                            ).on_conflict_do_update(
                                index_elements=["ori", "offense", "year"],
                                set_={
                                    "actual_count": int(off_res.get("total", 0)),
                                    "clearance_count": int(clear_res.get("total", 0)) if clear_res['has_data'] else None,
                                    "months_reported": months_rep,
                                    "population": pop,
                                    "population_pct": cov,
                                    "fetched_at": datetime.utcnow(),
                                },
                            )
                            await session.execute(stmt)
                            processed_years.append({"ori": ori, "year": year, "offense": offense})
                            
                        await session.commit()
                            
                    logger.info(f"Saved {len(processed_years)} years for {offense} ({level})")
                    return processed_years

                except Exception as e:
                    logger.exception(f"Error fetching range {ori}/{offense}: {e}")
                    return []

                except Exception as e:
                    logger.warning(f"Error fetching range {ori}/{offense}: {e}")
                    return []

        tasks = [fetch_offense_range(off) for off in offenses]
        results = await asyncio.gather(*tasks)
        
        # Flatten
        for r in results:
            records.extend(r)
            
        return records
    
    async def process_job(self, message_id: str, job: Job) -> bool:
        """
        Process a single job.
        Returns True if successful.
        """
        try:
            # Update job status in PostgreSQL
            async with get_async_session() as session:
                stmt = update(JobLedger).where(
                    JobLedger.ori == job.ori,
                    JobLedger.offense == job.offense,
                    JobLedger.year == job.year,
                ).values(
                    status=JobStatus.IN_PROGRESS,
                    started_at=datetime.utcnow(),
                    worker_id=self.worker_id,
                    attempts=job.attempts + 1,
                )
                await session.execute(stmt)
            
            # Fetch data
            result = await self.fetch_crime_data(job.ori, job.offense, job.year)
            
            # Save to database
            async with get_async_session() as session:
                if result.success:
                    # Insert raw response
                    stmt = insert(RawResponse).values(
                        ori=result.ori,
                        offense=result.offense,
                        year=result.year,
                        actual_count=result.actual_count,
                        months_reported=result.months_reported,
                        population=result.population,
                        raw_json=result.raw_json,
                        parsed_ok=True,
                    ).on_conflict_do_update(
                        index_elements=["ori", "offense", "year"],
                        set_={
                            "actual_count": result.actual_count,
                            "months_reported": result.months_reported,
                            "raw_json": result.raw_json,
                            "fetched_at": datetime.utcnow(),
                        },
                    )
                    await session.execute(stmt)
                    
                    # Update job status
                    stmt = update(JobLedger).where(
                        JobLedger.ori == job.ori,
                        JobLedger.offense == job.offense,
                        JobLedger.year == job.year,
                    ).values(
                        status=JobStatus.COMPLETED,
                        completed_at=datetime.utcnow(),
                    )
                    await session.execute(stmt)
                else:
                    # Mark as failed
                    stmt = update(JobLedger).where(
                        JobLedger.ori == job.ori,
                        JobLedger.offense == job.offense,
                        JobLedger.year == job.year,
                    ).values(
                        status=JobStatus.FAILED,
                        last_error=result.error,
                    )
                    await session.execute(stmt)
                    
                    # Move to failed queue
                    await self.queue.move_to_failed(job, result.error)
            
            # Acknowledge job
            await self.queue.complete_job(message_id)
            return result.success
            
        except Exception as e:
            logger.error(f"Error processing job {job.job_id}: {e}")
            await self.queue.move_to_failed(job, str(e))
            await self.queue.complete_job(message_id)
            return False
    
    async def run(self) -> None:
        """Main worker loop."""
        await self._init_queue()
        self._running = True
        
        logger.info(f"Worker {self.worker_id} starting...")
        
        while self._running and not self._shutdown_event.is_set():
            try:
                job_data = await self.queue.get_job(self.worker_id, block_ms=5000)
                
                if job_data is None:
                    continue
                
                message_id, job = job_data
                logger.debug(f"Processing: {job.ori}/{job.offense}/{job.year}")
                
                success = await self.process_job(message_id, job)
                
                if success:
                    logger.debug(f"Completed: {job.job_id}")
                else:
                    logger.warning(f"Failed: {job.job_id}")
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(1)
        
        logger.info(f"Worker {self.worker_id} stopped")
    
    async def stop(self) -> None:
        """Signal worker to stop gracefully."""
        self._running = False
        self._shutdown_event.set()
    
    def setup_signal_handlers(self) -> None:
        """Setup SIGTERM/SIGINT handlers for graceful shutdown."""
        loop = asyncio.get_event_loop()
        
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig,
                lambda s=sig: asyncio.create_task(self._handle_signal(s)),
            )
    
    async def _handle_signal(self, sig: signal.Signals) -> None:
        """Handle shutdown signal."""
        logger.info(f"Received signal {sig.name}, shutting down...")
        await self.stop()


async def create_jobs_for_agencies(
    agencies: List[Agency],
    offenses: Optional[List[str]] = None,
    years: Optional[List[int]] = None,
) -> int:
    """
    Create jobs in PostgreSQL and Redis for given agencies.
    Returns number of jobs created.
    """
    offenses = offenses or OFFENSE_CODES
    years = years or EXTRACTION_YEARS
    queue = await get_job_queue()
    jobs_created = 0
    
    async with get_async_session() as session:
        for agency in agencies:
            for offense in offenses:
                for year in years:
                    job_id = f"{agency.ori}_{offense}_{year}"
                    
                    # Insert into PostgreSQL (idempotent)
                    stmt = insert(JobLedger).values(
                        ori=agency.ori,
                        offense=offense,
                        year=year,
                        status=JobStatus.PENDING,
                    ).on_conflict_do_nothing()
                    
                    result = await session.execute(stmt)
                    
                    # Only enqueue if actually inserted
                    if result.rowcount > 0:
                        job = Job(
                            job_id=job_id,
                            ori=agency.ori,
                            offense=offense,
                            year=year,
                            created_at=datetime.utcnow().isoformat(),
                        )
                        await queue.enqueue_job(job)
                        jobs_created += 1
    
    return jobs_created
