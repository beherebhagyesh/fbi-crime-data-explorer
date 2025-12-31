"""
Seed data collector.
Fetches states, agencies, and builds ORI-to-county mapping.
"""
import asyncio
import logging
from typing import List, Dict, Optional, Set
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from backend.src.http_client import HTTPClient, get_http_client
from backend.src.api_models import StatesResponse, AgencyInfo
from backend.src.database import get_async_session
from backend.src.models import State, County, Agency
from backend.config.offenses import VALID_AGENCY_TYPES


logger = logging.getLogger(__name__)


class SeedCollector:
    """
    Collects seed data from FBI API.
    - States list
    - Agencies by state
    - ORI to county mapping
    """
    
    def __init__(self, client: Optional[HTTPClient] = None):
        self.client = client or get_http_client()
        self._states: List[State] = []
        self._agencies: List[Agency] = []
        self._counties: Dict[str, County] = {}
    
    async def fetch_states(self) -> List[State]:
        """Fetch all US states from API."""
        logger.info("Fetching states list...")
        
        data = await self.client.get_with_retry("/lookup/states")
        if not data:
            raise RuntimeError("Failed to fetch states list")
        
        response = StatesResponse(**data)
        states = []
        
        # Include both states and DC, exclude territories for now
        for state_info in response.states:
            states.append(State(
                abbr=state_info.abbr,
                name=state_info.name,
            ))
        
        logger.info(f"Found {len(states)} states")
        self._states = states
        return states
    
    async def fetch_agencies_for_state(self, state_abbr: str) -> List[AgencyInfo]:
        """Fetch all agencies for a single state.
        
        API returns: {"COUNTY_NAME": [{agency1}, {agency2}], ...}
        """
        logger.debug(f"Fetching agencies for {state_abbr}...")
        
        data = await self.client.get_with_retry(
            f"/agency/byStateAbbr/{state_abbr}",
            circuit_id=state_abbr,
        )
        
        if not data:
            logger.warning(f"No agencies returned for {state_abbr}")
            return []
        
        agencies = []
        
        # Response is {county_name: [agency_list]}
        if isinstance(data, dict):
            for county_name, agency_list in data.items():
                if not isinstance(agency_list, list):
                    continue
                for item in agency_list:
                    try:
                        # Add county_name from the key if not in item
                        if 'counties' not in item:
                            item['counties'] = county_name
                        agencies.append(AgencyInfo(**item))
                    except Exception as e:
                        logger.warning(f"Failed to parse agency in {county_name}: {e}")
        
        logger.debug(f"Found {len(agencies)} agencies in {state_abbr}")
        return agencies
    
    async def fetch_all_agencies(self, states: Optional[List[str]] = None) -> List[Agency]:
        """
        Fetch agencies for all states.
        Filters to City/County only to prevent double-counting.
        """
        if not self._states:
            await self.fetch_states()
        
        state_abbrs = states or [s.abbr for s in self._states]
        all_agencies = []
        
        logger.info(f"Fetching agencies for {len(state_abbrs)} states...")
        
        for state_abbr in state_abbrs:
            agency_infos = await self.fetch_agencies_for_state(state_abbr)
            
            for info in agency_infos:
                # Filter by agency type
                if info.agency_type_name not in VALID_AGENCY_TYPES:
                    continue
                
                # Build county ID
                county_id = None
                if info.county_name:
                    county_id = f"{info.county_name}_{state_abbr}"
                    
                    # Track county
                    if county_id not in self._counties:
                        self._counties[county_id] = County(
                            county_id=county_id,
                            county_name=info.county_name,
                            state_abbr=state_abbr,
                            agency_count=0,
                        )
                    self._counties[county_id].agency_count += 1
                
                agency = Agency(
                    ori=info.ori,
                    agency_name=info.agency_name,
                    agency_type=info.agency_type_name,
                    county_id=county_id,
                    state_abbr=state_abbr,
                    population=info.population or 0,
                    is_heavy_lift=False,  # Will be set later
                )
                all_agencies.append(agency)
            
            # Small delay between states
            await asyncio.sleep(0.1)
        
        logger.info(f"Found {len(all_agencies)} agencies across {len(self._counties)} counties")
        self._agencies = all_agencies
        return all_agencies
    
    def identify_heavy_lift_agencies(self, top_n: int = 50) -> Set[str]:
        """Identify top N agencies by population for heavy-lift processing."""
        sorted_agencies = sorted(
            self._agencies,
            key=lambda a: a.population or 0,
            reverse=True,
        )
        
        heavy_oris = set()
        for agency in sorted_agencies[:top_n]:
            agency.is_heavy_lift = True
            heavy_oris.add(agency.ori)
            logger.info(f"Heavy-lift: {agency.ori} ({agency.agency_name}) - pop {agency.population}")
        
        return heavy_oris
    
    async def save_to_database(self) -> Dict[str, int]:
        """Save all seed data to PostgreSQL."""
        logger.info("Saving seed data to database...")
        
        async with get_async_session() as session:
            # Insert states
            for state in self._states:
                stmt = insert(State).values(
                    abbr=state.abbr,
                    name=state.name,
                ).on_conflict_do_nothing()
                await session.execute(stmt)
            
            # Insert counties
            for county in self._counties.values():
                stmt = insert(County).values(
                    county_id=county.county_id,
                    county_name=county.county_name,
                    state_abbr=county.state_abbr,
                    agency_count=county.agency_count,
                ).on_conflict_do_update(
                    index_elements=["county_id"],
                    set_={"agency_count": county.agency_count},
                )
                await session.execute(stmt)
            
            # Insert agencies
            for agency in self._agencies:
                stmt = insert(Agency).values(
                    ori=agency.ori,
                    agency_name=agency.agency_name,
                    agency_type=agency.agency_type,
                    county_id=agency.county_id,
                    state_abbr=agency.state_abbr,
                    population=agency.population,
                    is_heavy_lift=agency.is_heavy_lift,
                ).on_conflict_do_update(
                    index_elements=["ori"],
                    set_={
                        "population": agency.population,
                        "is_heavy_lift": agency.is_heavy_lift,
                    },
                )
                await session.execute(stmt)
        
        stats = {
            "states": len(self._states),
            "counties": len(self._counties),
            "agencies": len(self._agencies),
        }
        logger.info(f"Saved: {stats}")
        return stats
    
    async def run(self, states: Optional[List[str]] = None) -> Dict[str, int]:
        """Run full seed collection."""
        await self.fetch_states()
        await self.fetch_all_agencies(states)
        self.identify_heavy_lift_agencies()
        stats = await self.save_to_database()
        return stats
