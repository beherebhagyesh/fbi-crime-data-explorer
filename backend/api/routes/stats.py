"""
Stats API routes.
Efficient summary endpoints for dashboard.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from sqlalchemy import select, func
from backend.src.database import get_async_session
from backend.src.models import County, Agency


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
