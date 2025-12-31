"""
SQLAlchemy database models for FBI Crime Pipeline.
Defines all tables for seed data, job tracking, and raw responses.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, 
    DateTime, ForeignKey, Enum, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func
import enum


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class JobStatus(str, enum.Enum):
    """Job status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class State(Base):
    """US States reference table."""
    __tablename__ = "states"
    
    abbr = Column(String(2), primary_key=True)
    name = Column(String(50), nullable=False)
    
    # Relationships
    counties = relationship("County", back_populates="state")
    
    def __repr__(self):
        return f"<State {self.abbr}: {self.name}>"


class County(Base):
    """Counties table - aggregation unit for crime stats."""
    __tablename__ = "counties"
    
    county_id = Column(String(50), primary_key=True)  # "Wake_NC"
    county_name = Column(String(100), nullable=False)
    state_abbr = Column(String(2), ForeignKey("states.abbr"), nullable=False)
    agency_count = Column(Integer, default=0)
    
    # Relationships
    state = relationship("State", back_populates="counties")
    agencies = relationship("Agency", back_populates="county")
    crime_stats = relationship("CountyCrimeStat", back_populates="county")
    
    def __repr__(self):
        return f"<County {self.county_id}>"


class Agency(Base):
    """Law enforcement agencies (ORIs)."""
    __tablename__ = "agencies"
    
    ori = Column(String(20), primary_key=True)
    agency_name = Column(String(200), nullable=False)
    agency_type = Column(String(50))  # City, County, State, Federal
    county_id = Column(String(50), ForeignKey("counties.county_id"), nullable=True)
    state_abbr = Column(String(2), ForeignKey("states.abbr"), nullable=False)
    population = Column(Integer, default=0)
    is_heavy_lift = Column(Boolean, default=False)  # Top 50 large agencies
    
    # Location fields for neighborhood mapping
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String(300), nullable=True)
    city = Column(String(100), nullable=True)
    zip_code = Column(String(10), nullable=True)
    county_name = Column(String(100), nullable=True)
    nibrs_start_date = Column(DateTime(timezone=True), nullable=True)
    
    # Enrichment tracking for smart re-fetch
    enriched_offenses = Column(JSONB, default=list)  # List of fetched offense codes
    enrichment_status = Column(String(20), default='pending')  # pending, partial, complete
    last_enriched_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    county = relationship("County", back_populates="agencies")
    raw_responses = relationship("RawResponse", back_populates="agency")
    
    __table_args__ = (
        Index("idx_agency_county", "county_id"),
        Index("idx_agency_type", "agency_type"),
        Index("idx_agency_location", "latitude", "longitude"),
    )
    
    def __repr__(self):
        return f"<Agency {self.ori}: {self.agency_name}>"


class JobLedger(Base):
    """
    Job tracking table for idempotency.
    Ensures each (ori, offense, year) is only fetched once.
    """
    __tablename__ = "job_ledger"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    ori = Column(String(20), nullable=False)
    offense = Column(String(10), nullable=False)
    year = Column(Integer, nullable=False)
    status = Column(Enum(JobStatus), default=JobStatus.PENDING)
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    worker_id = Column(String(50), nullable=True)  # Track which worker took the job
    
    __table_args__ = (
        UniqueConstraint("ori", "offense", "year", name="uq_job_ledger_ori_offense_year"),
        Index("idx_job_status", "status"),
        Index("idx_job_ori", "ori"),
    )
    
    def __repr__(self):
        return f"<Job {self.ori}/{self.offense}/{self.year}: {self.status}>"


class RawResponse(Base):
    """
    Raw API response storage.
    Stores both parsed values and raw JSON for forensics.
    """
    __tablename__ = "raw_responses"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    ori = Column(String(20), ForeignKey("agencies.ori"), nullable=False)
    offense = Column(String(10), nullable=False)
    year = Column(Integer, nullable=False)
    
    # Parsed values
    actual_count = Column(Integer, nullable=True)  # NULL = no data, 0 = zero crimes
    clearance_count = Column(Integer, nullable=True) # LE Clearances
    months_reported = Column(Integer, nullable=True)
    population = Column(Integer, nullable=True)
    population_pct = Column(Float, nullable=True)   # Percent of Population Covered
    
    # Raw storage for forensics
    raw_json = Column(JSONB, nullable=True)
    parsed_ok = Column(Boolean, default=True)
    parse_error = Column(Text, nullable=True)
    
    # Metadata
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    agency = relationship("Agency", back_populates="raw_responses")
    
    __table_args__ = (
        UniqueConstraint("ori", "offense", "year", name="uq_raw_response"),
        Index("idx_raw_ori", "ori"),
        Index("idx_raw_offense_year", "offense", "year"),
    )
    
    def __repr__(self):
        return f"<RawResponse {self.ori}/{self.offense}/{self.year}>"


class CountyCrimeStat(Base):
    """
    Aggregated county-level crime statistics.
    Pre-computed from raw responses for fast querying.
    """
    __tablename__ = "county_crime_stats"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    county_id = Column(String(50), ForeignKey("counties.county_id"), nullable=False)
    offense = Column(String(10), nullable=False)
    year = Column(Integer, nullable=False)
    
    # Aggregated values
    total_count = Column(Integer, nullable=True)
    agencies_reporting = Column(Integer, default=0)
    agencies_total = Column(Integer, default=0)
    reporting_pct = Column(Float, nullable=True)
    
    # Data quality flags
    is_complete = Column(Boolean, default=False)  # All agencies reported 12 months
    
    # Metadata
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    county = relationship("County", back_populates="crime_stats")
    
    __table_args__ = (
        UniqueConstraint("county_id", "offense", "year", name="uq_county_stat"),
        Index("idx_county_stat", "county_id", "offense"),
    )
    
    def __repr__(self):
        return f"<CountyStat {self.county_id}/{self.offense}/{self.year}>"


class CircuitBreakerState(Base):
    """
    Circuit breaker state persistence.
    Tracks failures per state to avoid hammering failing endpoints.
    """
    __tablename__ = "circuit_breaker_state"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    state_abbr = Column(String(2), unique=True, nullable=False)
    consecutive_failures = Column(Integer, default=0)
    is_open = Column(Boolean, default=False)
    last_failure_at = Column(DateTime(timezone=True), nullable=True)
    cooldown_until = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<CircuitBreaker {self.state_abbr}: {'OPEN' if self.is_open else 'CLOSED'}>"
