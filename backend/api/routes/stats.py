"""
Stats API routes.
Efficient summary endpoints for dashboard.
"""
from typing import List, Optional
from datetime import datetime
import json

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert

from backend.src.database import get_async_session
from backend.src.models import County, Agency, CountyCrimeStat, CrimeAggregation


router = APIRouter()

# State name lookup
STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia',
}


class StateSummary(BaseModel):
    """State summary with counts."""
    state_abbr: str
    state_name: str
    county_count: int
    agency_count: int


class StateDetail(BaseModel):
    """Detailed state info with top counties."""
    state_abbr: str
    state_name: str
    county_count: int
    agency_count: int
    top_counties: List[dict]


@router.get("/states", response_model=List[StateSummary])
async def get_states_summary():
    """
    Get all states with their county and agency totals.
    Efficient single query - returns ~51 items.
    """
    async with get_async_session() as session:
        # Group by state and count counties + sum agencies
        query = select(
            County.state_abbr,
            func.count(County.county_id).label('county_count'),
            func.sum(County.agency_count).label('agency_count')
        ).group_by(County.state_abbr).order_by(func.sum(County.agency_count).desc())
        
        result = await session.execute(query)
        rows = result.all()
        
        return [
            StateSummary(
                state_abbr=row.state_abbr,
                state_name=STATE_NAMES.get(row.state_abbr, row.state_abbr),
                county_count=row.county_count,
                agency_count=row.agency_count or 0,
            )
            for row in rows
        ]


@router.get("/states/{state_abbr}", response_model=StateDetail)
async def get_state_detail(state_abbr: str):
    """
    Get detailed state info with top 10 counties.
    """
    state_abbr = state_abbr.upper()
    
    async with get_async_session() as session:
        # Get state totals
        totals_query = select(
            func.count(County.county_id).label('county_count'),
            func.sum(County.agency_count).label('agency_count')
        ).where(County.state_abbr == state_abbr)
        
        totals_result = await session.execute(totals_query)
        totals = totals_result.one_or_none()
        
        if not totals or totals.county_count == 0:
            raise HTTPException(status_code=404, detail=f"State {state_abbr} not found")
        
        # Get top 10 counties by agency count
        top_query = select(County).where(
            County.state_abbr == state_abbr
        ).order_by(County.agency_count.desc()).limit(10)
        
        top_result = await session.execute(top_query)
        top_counties = top_result.scalars().all()
        
        return StateDetail(
            state_abbr=state_abbr,
            state_name=STATE_NAMES.get(state_abbr, state_abbr),
            county_count=totals.county_count,
            agency_count=totals.agency_count or 0,
            top_counties=[
                {
                    "county_id": c.county_id,
                    "county_name": c.county_name,
                    "agency_count": c.agency_count,
                }
                for c in top_counties
            ],
        )


@router.get("/overview")
async def get_overview():
    """
    Get national overview stats.
    """
    async with get_async_session() as session:
        # Total counts
        query = select(
            func.count(County.county_id).label('total_counties'),
            func.sum(County.agency_count).label('total_agencies'),
            func.count(func.distinct(County.state_abbr)).label('total_states')
        )
        
        result = await session.execute(query)
        row = result.one()
        
        return {
            "total_states": row.total_states,
            "total_counties": row.total_counties,
            "total_agencies": row.total_agencies or 0,
        }


# ============= Aggregation Endpoints =============



class AggregationResponse(BaseModel):
    """Response model for aggregation data."""
    offense: str
    latest_year: Optional[int]
    latest_count: Optional[int]
    sum_total: Optional[int]
    avg_annual: Optional[float]
    growth_pct: Optional[float]
    growth_prev_count: Optional[int]
    min_year: Optional[int]
    min_count: Optional[int]
    max_year: Optional[int]
    max_count: Optional[int]
    population: Optional[int]
    per_100k: Optional[float]
    years_available: Optional[List[int]]
    year_counts: Optional[dict]


@router.get("/aggregations/{scope_type}/{scope_id}")
async def get_aggregations(scope_type: str, scope_id: str):
    """
    Get all pre-calculated aggregations for a scope.
    scope_type: 'national', 'state', 'county'
    scope_id: 'NATIONAL_US', 'CA', 'Wake_NC', etc.
    """
    async with get_async_session() as session:
        query = select(CrimeAggregation).where(
            CrimeAggregation.scope_type == scope_type.lower(),
            CrimeAggregation.scope_id == scope_id
        )
        
        result = await session.execute(query)
        rows = result.scalars().all()
        
        return [
            {
                "offense": row.offense,
                "latest_year": row.latest_year,
                "latest_count": row.latest_count,
                "sum_total": row.sum_total,
                "avg_annual": row.avg_annual,
                "growth_pct": row.growth_pct,
                "growth_prev_count": row.growth_prev_count,
                "min_year": row.min_year,
                "min_count": row.min_count,
                "max_year": row.max_year,
                "max_count": row.max_count,
                "population": row.population,
                "per_100k": row.per_100k,
                "years_available": row.years_available,
                "year_counts": row.year_counts,
            }
            for row in rows
        ]


async def calculate_and_save_aggregations(session, scope_type: str, scope_id: str, offense: str = None):
    """
    Calculate aggregations for a scope and save to database.
    If offense is specified, only calculate for that offense.
    """
    from backend.src.models import RawResponse, Agency
    
    # We'll use RawResponse for all scope types to get population data
    if scope_type in ["national", "state"]:
        # National/State data is stored in RawResponse with ORI matching the scope_id
        if scope_type == "national":
            ori_filter = RawResponse.ori == scope_id  # NATIONAL_US
        else:
            ori_filter = RawResponse.ori == f"STATE_{scope_id}"  # STATE_CA, STATE_TX, etc.
        
        query = select(
            RawResponse.offense,
            RawResponse.year,
            func.sum(RawResponse.actual_count).label('total_count'),
            func.sum(RawResponse.population).label('population')
        ).where(ori_filter)
        
        if offense:
            query = query.where(func.upper(RawResponse.offense) == offense.upper())
        
        query = query.group_by(RawResponse.offense, RawResponse.year)
    else:
        # County level - sum populations of all agencies in that county
        query = select(
            RawResponse.offense,
            RawResponse.year,
            func.sum(RawResponse.actual_count).label('total_count'),
            func.sum(RawResponse.population).label('population')
        ).join(Agency, RawResponse.ori == Agency.ori)\
         .where(Agency.county_id == scope_id)
        
        if offense:
            query = query.where(func.upper(RawResponse.offense) == offense.upper())
        
        query = query.group_by(RawResponse.offense, RawResponse.year)
    
    result = await session.execute(query)
    rows = result.all()

    
    # Group by offense
    offense_data = {}
    pop_data = {} # Latest year population per offense
    for row in rows:
        off = row.offense.upper()
        if off not in offense_data:
            offense_data[off] = {}
            pop_data[off] = {}
        count = row.total_count or 0
        if count >= 0:  # Include 0 counts
            offense_data[off][row.year] = count
            pop_data[off][row.year] = row.population or 0
    
    # Calculate aggregations for each offense
    for off, year_counts in offense_data.items():
        if not year_counts:
            continue
            
        years = sorted(year_counts.keys())
        counts = [year_counts[y] for y in years]
        
        # Find latest year with data
        latest_year = max(years)
        latest_count = year_counts[latest_year]
        latest_pop = pop_data[off][latest_year]
        
        # Calculate per 100k for latest year
        per_100k = None
        if latest_pop > 0:
            per_100k = (latest_count / latest_pop) * 100000
        
        # Sum
        sum_total = sum(counts)
        
        # Average
        avg_annual = sum_total / len(counts) if counts else 0
        
        # Growth (compare latest to previous)
        growth_pct = None
        growth_prev_year = None
        growth_prev_count = None
        if len(years) >= 2:
            prev_year = years[-2]
            prev_count = year_counts[prev_year]
            if prev_count > 0:
                growth_pct = ((latest_count - prev_count) / prev_count) * 100
                growth_prev_year = prev_year
                growth_prev_count = prev_count
        
        # Min/Max
        min_year = min(years, key=lambda y: year_counts[y])
        min_count = year_counts[min_year]
        max_year = max(years, key=lambda y: year_counts[y])
        max_count = year_counts[max_year]
        
        # Upsert aggregation
        stmt = insert(CrimeAggregation).values(
            scope_type=scope_type.lower(),
            scope_id=scope_id,
            offense=off,
            latest_year=latest_year,
            latest_count=latest_count,
            sum_total=sum_total,
            sum_years_start=min(years),
            sum_years_end=max(years),
            avg_annual=round(avg_annual, 2),
            growth_pct=round(growth_pct, 2) if growth_pct else None,
            growth_prev_year=growth_prev_year,
            growth_prev_count=growth_prev_count,
            min_year=min_year,
            min_count=min_count,
            max_year=max_year,
            max_count=max_count,
            population=latest_pop,
            per_100k=per_100k,
            years_available=years,
            year_counts=year_counts,
            calculated_at=datetime.utcnow()
        )
        
        # On conflict, update all values
        stmt = stmt.on_conflict_do_update(
            constraint="uq_crime_agg",
            set_={
                "latest_year": latest_year,
                "latest_count": latest_count,
                "sum_total": sum_total,
                "sum_years_start": min(years),
                "sum_years_end": max(years),
                "avg_annual": round(avg_annual, 2),
                "growth_pct": round(growth_pct, 2) if growth_pct else None,
                "growth_prev_year": growth_prev_year,
                "growth_prev_count": growth_prev_count,
                "min_year": min_year,
                "min_count": min_count,
                "max_year": max_year,
                "max_count": max_count,
                "years_available": years,
                "year_counts": year_counts,
                "calculated_at": datetime.utcnow()
            }
        )
        
        await session.execute(stmt)
    
    await session.commit()
    return list(offense_data.keys())


@router.post("/aggregations/calculate/{scope_type}/{scope_id}")
async def trigger_calculate_aggregations(scope_type: str, scope_id: str, offense: str = None):
    """
    Trigger aggregation calculation for a scope.
    Called automatically after enrichment.
    """
    async with get_async_session() as session:
        offenses_calculated = await calculate_and_save_aggregations(
            session, scope_type, scope_id, offense
        )
        
        return {
            "success": True,
            "scope_type": scope_type,
            "scope_id": scope_id,
            "offenses_calculated": offenses_calculated
        }
