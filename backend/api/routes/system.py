"""
System API routes.
Monitoring, job status, and admin operations.
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from sqlalchemy import select, func, update
from backend.src.database import get_async_session
from backend.src.models import JobLedger, JobStatus
from backend.src.job_queue import get_job_queue
from backend.src.http_client import get_http_client
from backend.src.circuit_breaker import get_circuit_breaker
from backend.src.elasticsearch_loader import ElasticsearchLoader


router = APIRouter()


@router.get("/search/counties")
async def search_counties(q: str = Query(..., min_length=2), limit: int = Query(10, le=50)):
    """Search counties using Elasticsearch."""
    try:
        loader = ElasticsearchLoader()
        await loader.connect()
        
        # Build fuzzy search query
        query = {
            "size": limit,
            "query": {
                "bool": {
                    "should": [
                        {"match": {"county_name": {"query": q, "fuzziness": "AUTO"}}},
                        {"term": {"state_abbr": q.upper()}},
                        {"wildcard": {"county_name.keyword": f"*{q}*"}}
                    ]
                }
            },
            "_source": ["county_id", "county_name", "state_abbr", "agencies_total"]
        }
        
        results = await loader.search(query)
        await loader.close()
        
        return [
            {
                "countyId": r["county_id"],
                "countyName": r["county_name"],
                "stateAbbr": r["state_abbr"],
                "agencyCount": r.get("agencies_total", 0)
            }
            for r in results
        ]
    except Exception as e:
        # Fallback to database search if ES not available
        from sqlalchemy import select
        from backend.src.models import County
        
        async with get_async_session() as session:
            query_stmt = select(County).where(
                County.county_name.ilike(f"%{q}%")
            ).limit(limit)
            result = await session.execute(query_stmt)
            counties = result.scalars().all()
            
            return [
                {
                    "countyId": c.county_id,
                    "countyName": c.county_name,
                    "stateAbbr": c.state_abbr,
                    "agencyCount": c.agency_count
                }
                for c in counties
            ]



@router.get("/health")
async def health_check():
    """Full system health check."""
    from backend.src.database import check_connection
    
    db_ok = await check_connection()
    
    # Check Redis
    redis_ok = False
    try:
        queue = await get_job_queue()
        await queue.get_queue_stats()
        redis_ok = True
    except Exception:
        pass
    
    # Check Elasticsearch
    es_ok = False
    try:
        loader = ElasticsearchLoader()
        await loader.connect()
        es_ok = True
        await loader.close()
    except Exception:
        pass
    
    return {
        "status": "healthy" if all([db_ok, redis_ok, es_ok]) else "degraded",
        "components": {
            "database": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "error",
            "elasticsearch": "ok" if es_ok else "error",
        }
    }


@router.get("/jobs/stats")
async def get_job_stats():
    """Get job processing statistics."""
    async with get_async_session() as session:
        # Count by status
        query = select(
            JobLedger.status,
            func.count(JobLedger.id)
        ).group_by(JobLedger.status)
        
        result = await session.execute(query)
        stats = {row[0].value: row[1] for row in result.fetchall()}
    
    # Redis queue stats
    queue = await get_job_queue()
    queue_stats = await queue.get_queue_stats()
    
    return {
        "job_ledger": stats,
        "redis_queues": queue_stats,
    }


@router.get("/jobs/failed")
async def get_failed_jobs(limit: int = Query(50, le=200)):
    """Get list of failed jobs."""
    async with get_async_session() as session:
        query = select(JobLedger).where(
            JobLedger.status == JobStatus.FAILED
        ).order_by(JobLedger.completed_at.desc()).limit(limit)
        
        result = await session.execute(query)
        jobs = result.scalars().all()
        
        return [
            {
                "ori": j.ori,
                "offense": j.offense,
                "year": j.year,
                "attempts": j.attempts,
                "error": j.last_error,
            }
            for j in jobs
        ]


@router.post("/jobs/retry-failed")
async def retry_failed_jobs(limit: int = Query(100, le=1000)):
    """Re-queue failed jobs."""
    async with get_async_session() as session:
        stmt = update(JobLedger).where(
            JobLedger.status == JobStatus.FAILED
        ).values(
            status=JobStatus.PENDING,
            attempts=0,
            last_error=None,
        ).limit(limit)
        
        result = await session.execute(stmt)
        count = result.rowcount
    
    return {"requeued": count}


@router.get("/circuit-breakers")
async def get_circuit_breaker_status():
    """Get circuit breaker states."""
    cb = get_circuit_breaker()
    open_circuits = await cb.get_all_open()
    
    return {
        "open_circuits": open_circuits,
        "total_open": len(open_circuits),
    }


@router.post("/circuit-breakers/reset/{state_abbr}")
async def reset_circuit_breaker(state_abbr: str):
    """Reset a specific circuit breaker."""
    cb = get_circuit_breaker()
    await cb.reset(state_abbr)
    return {"message": f"Circuit breaker for {state_abbr} reset"}


@router.get("/http-client/stats")
async def get_http_stats():
    """Get HTTP client statistics."""
    client = get_http_client()
    return client.get_stats()


@router.get("/key-pool/stats")
async def get_key_pool_stats():
    """Get API key pool statistics."""
    client = get_http_client()
    stats = await client.key_pool.get_stats()
    return {"keys": stats}
