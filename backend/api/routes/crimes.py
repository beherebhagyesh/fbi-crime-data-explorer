"""
Crimes API routes.
Crime data queries by offense and year.
"""
from typing import List, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

from sqlalchemy import select, func
from backend.src.database import get_async_session
from backend.src.models import CountyCrimeStat, RawResponse
from backend.config.offenses import OFFENSE_CODES, OFFENSE_LABELS


router = APIRouter()


class OffenseInfo(BaseModel):
    """Offense information."""
    code: str
    label: str


class CrimeAggregate(BaseModel):
    """Aggregated crime stats."""
    offense: str
    year: int
    total_count: int
    counties_reporting: int


@router.get("/offenses", response_model=List[OffenseInfo])
async def list_offenses():
    """List available offense types."""
    return [
        OffenseInfo(code=code, label=OFFENSE_LABELS.get(code, code))
        for code in OFFENSE_CODES
    ]


@router.get("/aggregate")
async def aggregate_crimes(
    offense: str = Query(..., description="Offense code"),
    year: int = Query(..., description="Year"),
    state: Optional[str] = Query(None, description="Filter by state"),
):
    """Get aggregate crime stats by offense and year."""
    async with get_async_session() as session:
        query = select(
            func.sum(CountyCrimeStat.total_count).label("total"),
            func.count(CountyCrimeStat.county_id).label("counties"),
        ).where(
            CountyCrimeStat.offense == offense,
            CountyCrimeStat.year == year,
        )
        
        if state:
            from backend.src.models import County
            query = query.join(County).where(County.state_abbr == state.upper())
        
        result = await session.execute(query)
        row = result.one()
        
        return {
            "offense": offense,
            "offense_label": OFFENSE_LABELS.get(offense, offense),
            "year": year,
            "total_count": row.total or 0,
            "counties_reporting": row.counties or 0,
            "state_filter": state,
        }


@router.get("/range")
async def crimes_by_range(
    offense: str = Query(...),
    start_year: int = Query(2020),
    end_year: int = Query(2024),
    state: Optional[str] = Query(None),
):
    """Get aggregated crime counts over a year range."""
    async with get_async_session() as session:
        # Since we might not have all data in DB, this returns what we have.
        # However, for a "Preview", it's better to show what's in RawResponse if possible.
        # But aggregate table is usually better.
        # For now, let's query RawResponse aggregated.
        from backend.src.models import RawResponse
        
        query = select(
            RawResponse.year,
            func.sum(RawResponse.actual_count).label("total"),
            func.count(func.distinct(RawResponse.ori)).label("agencies")
        ).where(
            RawResponse.offense == offense,
            RawResponse.year >= start_year,
            RawResponse.year <= end_year,
        )
        
        if state:
            # We need to join with agencies/counties to filter by state if we use RawResponse
            # But RawResponse doesn't have state directly. 
            # Easiest: filter by ORI prefix (2 chars) for state if possible, but ORIs are not strictly state-coded 
            # (Wait, they ARE. 1-2 chars of ORI = state abbr? AL001...).
            # Let's use the County join if we can find the ORI in Agency table.
            from backend.src.models import Agency, County
            query = query.join(Agency, RawResponse.ori == Agency.ori).join(County).where(County.state_abbr == state.upper())
            
        query = query.group_by(RawResponse.year).order_by(RawResponse.year)
        
        result = await session.execute(query)
        rows = result.all()
        
        return {
            "offense": offense,
            "state": state,
            "years": [
                {
                    "year": row.year,
                    "total_count": int(row.total or 0),
                    "agencies_reporting": row.agencies
                }
                for row in rows
            ]
        }


@router.get("/raw/{ori}")
async def get_raw_data(
    ori: str,
    offense: Optional[str] = None,
    year: Optional[int] = None,
):
    """Get raw response data for an ORI."""
    async with get_async_session() as session:
        query = select(RawResponse).where(RawResponse.ori == ori)
        
        if offense:
            query = query.where(RawResponse.offense == offense)
        if year:
            query = query.where(RawResponse.year == year)
        
        result = await session.execute(query)
        responses = result.scalars().all()
        
        return [
            {
                "ori": r.ori,
                "offense": r.offense,
                "year": r.year,
                "actual_count": r.actual_count,
                "months_reported": r.months_reported,
                "population": r.population,
                "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
            }
            for r in responses
        ]


@router.get("/agency/{ori}")
async def get_agency_crimes(ori: str):
    """Get all crime data for a specific agency (ORI)."""
    async with get_async_session() as session:
        query = select(RawResponse).where(RawResponse.ori == ori).order_by(
            RawResponse.offense, RawResponse.year
        )
        
        result = await session.execute(query)
        responses = result.scalars().all()
        
        if not responses:
            # No data yet - return empty to trigger fetch
            return []
        
        return [
            {
                "ori": r.ori,
                "offense": r.offense,
                "offense_label": OFFENSE_LABELS.get(r.offense, r.offense),
                "year": r.year,
                "actual_count": r.actual_count,
                "months_reported": r.months_reported,
                "population": r.population,
                "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
            }
            for r in responses
        ]


class FetchRequest(BaseModel):
    years: List[int] = [2020, 2021, 2022, 2023, 2024]
    offenses: Optional[List[str]] = None
    forceRefresh: bool = False  # If true, re-fetch even if already enriched


@router.post("/fetch/{ori}")
async def fetch_agency_crimes(
    ori: str,
    request: FetchRequest,
):
    """
    Fetch crime data for an agency from FBI API.
    Uses smart enrichment - only fetches offenses not already in enriched_offenses.
    Supports virtual IDs: STATE_XX, NATIONAL_US
    """
    import logging
    from datetime import datetime
    from backend.src.crime_fetcher import CrimeFetcher
    from backend.src.models import Agency
    
    logger = logging.getLogger(__name__)
    
    # Check if this is a virtual ID (state or national level)
    is_virtual = ori.startswith("STATE_") or ori == "NATIONAL_US"
    
    agency = None
    offenses_to_fetch = request.offenses or OFFENSE_CODES
    status = 'pending'
    
    # Only check agency table for real agency ORIs
    if not is_virtual:
        async with get_async_session() as session:
            agency_query = select(Agency).where(Agency.ori == ori)
            result = await session.execute(agency_query)
            agency = result.scalar_one_or_none()
            
            if agency and not request.forceRefresh:
                # Smart fetch: skip already enriched offenses
                already_enriched = agency.enriched_offenses or []
                offenses_to_fetch = [o for o in offenses_to_fetch if o not in already_enriched]
                
                if not offenses_to_fetch:
                    logger.info(f"Agency {ori} already fully enriched, skipping fetch")
                    return {
                        "success": True,
                        "ori": ori,
                        "recordCount": 0,
                        "message": "Already fully enriched",
                        "enrichment_status": agency.enrichment_status,
                        "enriched_offenses": already_enriched,
                    }
    
    logger.info(f"Fetching {len(offenses_to_fetch)} offenses for {'virtual ID' if is_virtual else 'agency'}: {ori}")
    
    try:
        fetcher = CrimeFetcher()
        records = await fetcher.fetch_agency_crimes(ori, request.years, offenses_to_fetch)
        
        # Update enrichment tracking only for real agencies (not virtual IDs)
        if not is_virtual:
            async with get_async_session() as session:
                agency_query = select(Agency).where(Agency.ori == ori)
                result = await session.execute(agency_query)
                agency = result.scalar_one_or_none()
                
                if agency:
                    # Merge newly fetched offenses with existing
                    current_enriched = set(agency.enriched_offenses or [])
                    current_enriched.update(offenses_to_fetch)
                    
                    # Determine status
                    all_offenses = set(OFFENSE_CODES)
                    if current_enriched >= all_offenses:
                        status = 'complete'
                    elif len(current_enriched) > 0:
                        status = 'partial'
                    else:
                        status = 'pending'
                    
                    # Update agency
                    agency.enriched_offenses = list(current_enriched)
                    agency.enrichment_status = status
                    agency.last_enriched_at = datetime.utcnow()
                    await session.commit()
                    
                    logger.info(f"Updated {ori} enrichment: {status} ({len(current_enriched)}/{len(all_offenses)} offenses)")
        else:
            # For virtual IDs, determine status based on records found
            status = 'complete' if records else 'pending'
        
        return {
            "success": True,
            "ori": ori,
            "recordCount": len(records) if records else 0,
            "years": request.years,
            "offenses": offenses_to_fetch,
            "enrichment_status": status,
            "indexed": False,
            "data": records[:10] if records else [],
        }
    except Exception as e:
        logger.error(f"Failed to fetch crimes for {ori}: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/enrichment/{ori}")
async def get_enrichment_status(ori: str):
    """Get enrichment status for an agency."""
    from backend.src.models import Agency
    
    async with get_async_session() as session:
        query = select(Agency).where(Agency.ori == ori)
        result = await session.execute(query)
        agency = result.scalar_one_or_none()
        
        if not agency:
            return {
                "ori": ori,
                "status": "unknown",
                "enriched_offenses": [],
                "missing_offenses": OFFENSE_CODES,
            }
        
        enriched = set(agency.enriched_offenses or [])
        all_offenses = set(OFFENSE_CODES)
        missing = list(all_offenses - enriched)
        
        return {
            "ori": ori,
            "status": agency.enrichment_status or "pending",
            "enriched_offenses": list(enriched),
            "missing_offenses": missing,
            "last_enriched_at": agency.last_enriched_at.isoformat() if agency.last_enriched_at else None,
        }
