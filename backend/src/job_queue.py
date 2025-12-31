"""
Redis-based job queue for distributed work.
Uses Redis Streams for durability and consumer groups.
"""
import asyncio
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from dataclasses import dataclass

import redis.asyncio as redis
from redis.asyncio import Redis

from backend.config.settings import get_settings


logger = logging.getLogger(__name__)


@dataclass
class Job:
    """Job structure for queue."""
    job_id: str
    ori: str
    offense: str
    year: int
    created_at: str
    attempts: int = 0
    
    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "ori": self.ori,
            "offense": self.offense,
            "year": str(self.year),
            "created_at": self.created_at,
            "attempts": str(self.attempts),
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "Job":
        return cls(
            job_id=data["job_id"],
            ori=data["ori"],
            offense=data["offense"],
            year=int(data["year"]),
            created_at=data["created_at"],
            attempts=int(data.get("attempts", 0)),
        )


class JobQueue:
    """
    Redis Streams based job queue.
    Provides durability and consumer group support.
    """
    
    PENDING_STREAM = "pending_jobs"
    RESULTS_STREAM = "raw_results"
    FAILED_STREAM = "failed_jobs"
    CONSUMER_GROUP = "workers"
    
    def __init__(self, redis_url: Optional[str] = None):
        settings = get_settings()
        self.redis_url = redis_url or settings.redis.url
        self._redis: Optional[Redis] = None
    
    async def connect(self) -> None:
        """Initialize Redis connection."""
        if self._redis is None:
            self._redis = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            
            # Create consumer groups if they don't exist
            for stream in [self.PENDING_STREAM, self.RESULTS_STREAM]:
                try:
                    await self._redis.xgroup_create(
                        stream,
                        self.CONSUMER_GROUP,
                        id="0",
                        mkstream=True,
                    )
                except redis.ResponseError as e:
                    if "BUSYGROUP" not in str(e):
                        raise
    
    async def close(self) -> None:
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None
    
    async def enqueue_job(self, job: Job) -> str:
        """Add job to pending queue."""
        if not self._redis:
            await self.connect()
        
        message_id = await self._redis.xadd(
            self.PENDING_STREAM,
            job.to_dict(),
        )
        logger.debug(f"Enqueued job {job.job_id}: {message_id}")
        return message_id
    
    async def enqueue_batch(self, jobs: List[Job]) -> int:
        """Enqueue multiple jobs efficiently."""
        if not self._redis:
            await self.connect()
        
        pipe = self._redis.pipeline()
        for job in jobs:
            pipe.xadd(self.PENDING_STREAM, job.to_dict())
        
        results = await pipe.execute()
        return len(results)
    
    async def get_job(
        self,
        consumer_name: str,
        block_ms: int = 5000,
    ) -> Optional[tuple[str, Job]]:
        """
        Get next job from queue.
        Returns (message_id, job) or None if no jobs.
        """
        if not self._redis:
            await self.connect()
        
        messages = await self._redis.xreadgroup(
            self.CONSUMER_GROUP,
            consumer_name,
            {self.PENDING_STREAM: ">"},
            count=1,
            block=block_ms,
        )
        
        if not messages:
            return None
        
        stream_name, stream_messages = messages[0]
        if not stream_messages:
            return None
        
        message_id, data = stream_messages[0]
        job = Job.from_dict(data)
        return message_id, job
    
    async def complete_job(self, message_id: str) -> None:
        """Mark job as completed (acknowledge)."""
        if not self._redis:
            await self.connect()
        
        await self._redis.xack(
            self.PENDING_STREAM,
            self.CONSUMER_GROUP,
            message_id,
        )
    
    async def save_result(self, result: Dict[str, Any]) -> str:
        """Save job result to results stream."""
        if not self._redis:
            await self.connect()
        
        # Serialize complex data
        serialized = {k: json.dumps(v) if isinstance(v, (dict, list)) else str(v) for k, v in result.items()}
        
        message_id = await self._redis.xadd(
            self.RESULTS_STREAM,
            serialized,
        )
        return message_id
    
    async def move_to_failed(self, job: Job, error: str) -> str:
        """Move failed job to failed queue."""
        if not self._redis:
            await self.connect()
        
        data = job.to_dict()
        data["error"] = error
        data["failed_at"] = datetime.utcnow().isoformat()
        
        message_id = await self._redis.xadd(
            self.FAILED_STREAM,
            data,
        )
        return message_id
    
    async def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics."""
        if not self._redis:
            await self.connect()
        
        pending = await self._redis.xlen(self.PENDING_STREAM)
        results = await self._redis.xlen(self.RESULTS_STREAM)
        failed = await self._redis.xlen(self.FAILED_STREAM)
        
        return {
            "pending": pending,
            "results": results,
            "failed": failed,
        }
    
    async def get_failed_jobs(self, count: int = 100) -> List[Dict]:
        """Retrieve failed jobs for inspection."""
        if not self._redis:
            await self.connect()
        
        messages = await self._redis.xrange(
            self.FAILED_STREAM,
            count=count,
        )
        
        return [{"id": msg_id, **data} for msg_id, data in messages]


# Global queue instance
_job_queue: Optional[JobQueue] = None


async def get_job_queue() -> JobQueue:
    """Get or create global job queue."""
    global _job_queue
    if _job_queue is None:
        _job_queue = JobQueue()
        await _job_queue.connect()
    return _job_queue


async def cleanup_job_queue() -> None:
    """Clean up global job queue."""
    global _job_queue
    if _job_queue:
        await _job_queue.close()
        _job_queue = None
