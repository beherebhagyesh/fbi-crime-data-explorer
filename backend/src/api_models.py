"""
API response models using Pydantic.
Defensive parsing to handle FBI API schema changes.
"""
from typing import List, Optional, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class CrimeResult(BaseModel):
    """Single crime result from API."""
    actual: Optional[int] = None
    cleared: Optional[int] = None
    data_year: Optional[int] = None
    
    class Config:
        extra = "ignore"  # Ignore unknown fields


class CrimeResponse(BaseModel):
    """Response from /summarized/agency/{ori}/{offense} endpoint."""
    results: List[CrimeResult] = Field(default_factory=list)
    offenses: Optional[dict] = None
    
    class Config:
        extra = "ignore"
    
    @property
    def actual_count(self) -> Optional[int]:
        """Extract actual count, supporting both new dict format and old list format."""
        # 1. Try new format (nested dict of monthly counts)
        if self.offenses:
            actuals = self.offenses.get('actuals', {})
            total = 0
            found_data = False
            
            for key, months_data in actuals.items():
                # Filter for "Offenses" keys (ignore "Clearances" etc if needed, though usually separated by type)
                # The API returns "Agency Name Offenses" and "Agency Name Clearances" inside 'actuals' key?
                # Actually actuals usually contains Offenses and Clearances are in 'rates'?
                # Debug output showed 'actuals' has both "Offenses" and "Clearances" keys.
                # We only want Offenses.
                if "Offenses" in key and isinstance(months_data, dict):
                    found_data = True
                    total += sum(v for v in months_data.values() if isinstance(v, (int, float)))
            
            if found_data:
                return int(total)

        # 2. Fallback to old format (list of results)
        if self.results:
            return self.results[0].actual
            
        return None


class ParticipationData(BaseModel):
    """Agency participation data."""
    data_year: Optional[int] = None
    reported: Optional[int] = None  # Number of months reported
    months_reported: Optional[int] = None
    population: Optional[int] = None
    agency_name: Optional[str] = None
    
    class Config:
        extra = "ignore"
    
    @field_validator("months_reported", mode="before")
    @classmethod
    def extract_months(cls, v, info):
        """Handle different field names for months."""
        if v is not None:
            return v
        # Fallback to 'reported' field
        return info.data.get("reported")


class ParticipationResponse(BaseModel):
    """Response from participation endpoint."""
    results: List[ParticipationData] = Field(default_factory=list)
    
    class Config:
        extra = "ignore"
    
    @property
    def months_reported(self) -> Optional[int]:
        """Get months reported, None if no data."""
        if not self.results:
            return None
        return self.results[0].months_reported


class AgencyInfo(BaseModel):
    """Agency information from /agency/byStateAbbr/{state}.
    
    Actual API fields:
    - ori, agency_name, agency_type_name
    - counties (county name), state_abbr, state_name
    - is_nibrs, nibrs_start_date
    - latitude, longitude
    """
    ori: str
    agency_name: str = ""
    agency_type_name: Optional[str] = None
    state_abbr: Optional[str] = None
    state_name: Optional[str] = None
    counties: Optional[str] = None  # API uses 'counties' for county name
    is_nibrs: Optional[bool] = None  # API uses is_nibrs not nibrs
    nibrs_start_date: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Alias for backward compatibility
    @property
    def county_name(self) -> Optional[str]:
        return self.counties
    
    # Population may not be in this endpoint
    population: Optional[int] = None
    
    class Config:
        extra = "ignore"


class StateInfo(BaseModel):
    """State information from lookup."""
    abbr: str
    name: str
    
    class Config:
        extra = "ignore"


class StatesResponse(BaseModel):
    """Response from /lookup/states endpoint."""
    get_states: dict = Field(default_factory=dict)
    
    class Config:
        extra = "ignore"
    
    @property
    def states(self) -> List[StateInfo]:
        """Extract list of states."""
        cde_query = self.get_states.get("cde_states_query", {})
        states_data = cde_query.get("states", [])
        return [StateInfo(**s) for s in states_data]
    
    @property
    def territories(self) -> List[StateInfo]:
        """Extract list of territories."""
        cde_query = self.get_states.get("cde_states_query", {})
        territories_data = cde_query.get("territories", [])
        return [StateInfo(**t) for t in territories_data]


class OffenseInfo(BaseModel):
    """Offense information from lookup."""
    label: str
    value: str
    
    class Config:
        extra = "ignore"


class CrimeGroup(BaseModel):
    """Crime group from offenses lookup."""
    label: str
    crimes: List[OffenseInfo] = Field(default_factory=list)
    
    class Config:
        extra = "ignore"


class OffensesResponse(BaseModel):
    """Response from /lookup/offenses endpoint."""
    crimeGroups: List[CrimeGroup] = Field(default_factory=list)
    
    class Config:
        extra = "ignore"
    
    @property
    def all_offenses(self) -> List[OffenseInfo]:
        """Flatten all offenses."""
        offenses = []
        for group in self.crimeGroups:
            offenses.extend(group.crimes)
        return offenses


class FetchResult(BaseModel):
    """Result of a single fetch operation."""
    ori: str
    offense: str
    year: int
    actual_count: Optional[int] = None
    months_reported: Optional[int] = None
    population: Optional[int] = None
    raw_json: Optional[dict] = None
    success: bool = True
    error: Optional[str] = None
    
    @property
    def is_complete(self) -> bool:
        """Check if agency reported full year."""
        return self.months_reported == 12
