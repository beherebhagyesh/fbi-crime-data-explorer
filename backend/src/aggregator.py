"""
Aggregator module.
Aggregates raw ORI-level data to county-level statistics.
Calculates YoY changes and trend analytics.
"""
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass

from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert

from backend.src.database import get_async_session
from backend.src.models import RawResponse, County, CountyCrimeStat, Agency
from backend.config.offenses import OFFENSE_CODES, EXTRACTION_YEARS


logger = logging.getLogger(__name__)


@dataclass
class YoYResult:
    """Year-over-Year comparison result."""
    county_id: str
    offense: str
    year_current: int
    year_previous: int
    count_current: Optional[int]
    count_previous: Optional[int]
    agencies_reporting_current: int
    agencies_reporting_previous: int
    agencies_total: int
    yoy_change_pct: Optional[float]
    is_complete: bool


class Aggregator:
    """
    Aggregates raw responses to county-level statistics.
    Implements completeness-gated YoY calculation.
    """
    
    async def aggregate_county(
        self,
        county_id: str,
        offense: str,
        year: int,
    ) -> Optional[CountyCrimeStat]:
        """
        Aggregate data for a single county/offense/year.
        Only includes agencies with months_reported == 12.
        """
        async with get_async_session() as session:
            # Get agencies in this county
            agencies_query = select(Agency.ori).where(Agency.county_id == county_id)
            result = await session.execute(agencies_query)
            county_oris = [row[0] for row in result.fetchall()]
            
            if not county_oris:
                return None
            
            # Get raw responses for complete agencies only
            responses_query = select(RawResponse).where(
                RawResponse.ori.in_(county_oris),
                RawResponse.offense == offense,
                RawResponse.year == year,
            )
            result = await session.execute(responses_query)
            responses = result.scalars().all()
            
            # Calculate statistics
            total_count = 0
            agencies_reporting = 0
            complete_agencies = 0
            
            for resp in responses:
                if resp.actual_count is not None:
                    agencies_reporting += 1
                    total_count += resp.actual_count
                    
                    if resp.months_reported == 12:
                        complete_agencies += 1
            
            # Create stat record
            stat = CountyCrimeStat(
                county_id=county_id,
                offense=offense,
                year=year,
                total_count=total_count if agencies_reporting > 0 else None,
                agencies_reporting=agencies_reporting,
                agencies_total=len(county_oris),
                reporting_pct=agencies_reporting / len(county_oris) * 100 if county_oris else 0,
                is_complete=complete_agencies == len(county_oris),
            )
            
            # Upsert to database
            stmt = insert(CountyCrimeStat).values(
                county_id=stat.county_id,
                offense=stat.offense,
                year=stat.year,
                total_count=stat.total_count,
                agencies_reporting=stat.agencies_reporting,
                agencies_total=stat.agencies_total,
                reporting_pct=stat.reporting_pct,
                is_complete=stat.is_complete,
            ).on_conflict_do_update(
                constraint="uq_county_stat",
                set_={
                    "total_count": stat.total_count,
                    "agencies_reporting": stat.agencies_reporting,
                    "reporting_pct": stat.reporting_pct,
                    "is_complete": stat.is_complete,
                    "updated_at": datetime.utcnow(),
                },
            )
            await session.execute(stmt)
            
            return stat
    
    async def calculate_yoy(
        self,
        county_id: str,
        offense: str,
        year_current: int = 2024,
        year_previous: int = 2023,
    ) -> YoYResult:
        """
        Calculate Year-over-Year change.
        Only uses agencies that reported 12 months in BOTH years.
        """
        async with get_async_session() as session:
            # Get agencies in county
            agencies_query = select(Agency.ori).where(Agency.county_id == county_id)
            result = await session.execute(agencies_query)
            county_oris = [row[0] for row in result.fetchall()]
            
            if not county_oris:
                return YoYResult(
                    county_id=county_id,
                    offense=offense,
                    year_current=year_current,
                    year_previous=year_previous,
                    count_current=None,
                    count_previous=None,
                    agencies_reporting_current=0,
                    agencies_reporting_previous=0,
                    agencies_total=0,
                    yoy_change_pct=None,
                    is_complete=False,
                )
            
            # Get responses for both years
            current_query = select(RawResponse).where(
                RawResponse.ori.in_(county_oris),
                RawResponse.offense == offense,
                RawResponse.year == year_current,
                RawResponse.months_reported == 12,
            )
            previous_query = select(RawResponse).where(
                RawResponse.ori.in_(county_oris),
                RawResponse.offense == offense,
                RawResponse.year == year_previous,
                RawResponse.months_reported == 12,
            )
            
            current_result = await session.execute(current_query)
            previous_result = await session.execute(previous_query)
            
            current_responses = {r.ori: r for r in current_result.scalars().all()}
            previous_responses = {r.ori: r for r in previous_result.scalars().all()}
            
            # Only include agencies that reported fully in BOTH years
            valid_oris = set(current_responses.keys()) & set(previous_responses.keys())
            
            if not valid_oris:
                return YoYResult(
                    county_id=county_id,
                    offense=offense,
                    year_current=year_current,
                    year_previous=year_previous,
                    count_current=None,
                    count_previous=None,
                    agencies_reporting_current=len(current_responses),
                    agencies_reporting_previous=len(previous_responses),
                    agencies_total=len(county_oris),
                    yoy_change_pct=None,
                    is_complete=False,
                )
            
            # Sum counts for valid agencies
            count_current = sum(
                current_responses[ori].actual_count or 0
                for ori in valid_oris
            )
            count_previous = sum(
                previous_responses[ori].actual_count or 0
                for ori in valid_oris
            )
            
            # Calculate YoY percentage
            yoy_change_pct = None
            if count_previous > 0:
                yoy_change_pct = round((count_current - count_previous) / count_previous * 100, 2)
            elif count_current > 0:
                yoy_change_pct = 100.0  # From 0 to something = 100% increase
            else:
                yoy_change_pct = 0.0  # Both zero
            
            return YoYResult(
                county_id=county_id,
                offense=offense,
                year_current=year_current,
                year_previous=year_previous,
                count_current=count_current,
                count_previous=count_previous,
                agencies_reporting_current=len(valid_oris),
                agencies_reporting_previous=len(valid_oris),
                agencies_total=len(county_oris),
                yoy_change_pct=yoy_change_pct,
                is_complete=len(valid_oris) == len(county_oris),
            )
    
    async def aggregate_all_counties(
        self,
        offenses: Optional[List[str]] = None,
        years: Optional[List[int]] = None,
    ) -> Dict[str, int]:
        """
        Aggregate all counties for all offenses and years.
        Returns count of aggregated records.
        """
        offenses = offenses or OFFENSE_CODES
        years = years or EXTRACTION_YEARS
        
        async with get_async_session() as session:
            counties_query = select(County.county_id)
            result = await session.execute(counties_query)
            county_ids = [row[0] for row in result.fetchall()]
        
        logger.info(f"Aggregating {len(county_ids)} counties x {len(offenses)} offenses x {len(years)} years")
        
        aggregated = 0
        for county_id in county_ids:
            for offense in offenses:
                for year in years:
                    try:
                        await self.aggregate_county(county_id, offense, year)
                        aggregated += 1
                    except Exception as e:
                        logger.error(f"Error aggregating {county_id}/{offense}/{year}: {e}")
        
        logger.info(f"Aggregated {aggregated} records")
        return {"aggregated": aggregated}
