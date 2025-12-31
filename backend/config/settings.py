"""
Core settings module - loads environment variables and defines constants.
All configuration is centralized here for easy modification.
"""
import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache

# Get the root directory (where .env is located)
ROOT_DIR = Path(__file__).parent.parent.parent
ENV_FILE = ROOT_DIR / ".env"


class APISettings(BaseSettings):
    """FBI CDE API configuration."""
    base_url: str = "https://cde.ucr.cjis.gov/LATEST"
    
    # API Keys (8 for rotation)
    api_key_1: str = Field(default="", alias="API_KEY_1")
    api_key_2: str = Field(default="", alias="API_KEY_2")
    api_key_3: str = Field(default="", alias="API_KEY_3")
    api_key_4: str = Field(default="", alias="API_KEY_4")
    api_key_5: str = Field(default="", alias="API_KEY_5")
    api_key_6: str = Field(default="", alias="API_KEY_6")
    api_key_7: str = Field(default="", alias="API_KEY_7")
    api_key_8: str = Field(default="", alias="API_KEY_8")
    
    @property
    def api_keys(self) -> List[str]:
        """Return list of non-empty API keys."""
        keys = [
            self.api_key_1, self.api_key_2, self.api_key_3, self.api_key_4,
            self.api_key_5, self.api_key_6, self.api_key_7, self.api_key_8
        ]
        return [k for k in keys if k]
    
    class Config:
        env_file = ENV_FILE
        extra = "ignore"


class RateLimitSettings(BaseSettings):
    """Rate limiting configuration - critical for avoiding bans."""
    requests_per_second: int = Field(default=5, alias="REQUESTS_PER_SECOND")
    max_concurrent: int = Field(default=5, alias="MAX_CONCURRENT")
    circuit_breaker_threshold: int = Field(default=3, alias="CIRCUIT_BREAKER_THRESHOLD")
    circuit_breaker_cooldown_hours: int = Field(default=1, alias="CIRCUIT_BREAKER_COOLDOWN_HOURS")
    
    class Config:
        env_file = ENV_FILE
        extra = "ignore"


class TimeoutSettings(BaseSettings):
    """Request timeout configuration."""
    standard_timeout: int = Field(default=15, alias="STANDARD_TIMEOUT")
    heavy_lift_timeout: int = Field(default=60, alias="HEAVY_LIFT_TIMEOUT")
    
    class Config:
        env_file = ENV_FILE
        extra = "ignore"


class DatabaseSettings(BaseSettings):
    """PostgreSQL connection settings."""
    host: str = Field(default="localhost", alias="POSTGRES_HOST")
    port: int = Field(default=49001, alias="POSTGRES_PORT")
    database: str = Field(default="fbi_crime", alias="POSTGRES_DB")
    user: str = Field(default="pipeline", alias="POSTGRES_USER")
    password: str = Field(default="", alias="POSTGRES_PASSWORD")
    
    @property
    def connection_url(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"
    
    @property
    def sync_url(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"
    
    class Config:
        env_file = ENV_FILE
        extra = "ignore"


class RedisSettings(BaseSettings):
    """Redis connection settings."""
    url: str = Field(default="redis://localhost:49002", alias="REDIS_URL")
    
    class Config:
        env_file = ENV_FILE
        extra = "ignore"


class ElasticsearchSettings(BaseSettings):
    """Elasticsearch connection settings."""
    url: str = Field(default="http://localhost:49003", alias="ES_URL")
    index_name: str = "fbi-crime-stats"
    batch_size: int = Field(default=500, alias="BATCH_SIZE")
    
    class Config:
        env_file = ENV_FILE
        extra = "ignore"


class Settings:
    """Aggregated settings container."""
    def __init__(self):
        self.api = APISettings()
        self.rate_limit = RateLimitSettings()
        self.timeout = TimeoutSettings()
        self.database = DatabaseSettings()
        self.redis = RedisSettings()
        self.elasticsearch = ElasticsearchSettings()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
