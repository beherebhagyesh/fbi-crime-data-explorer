"""
Proxy configuration module with toggle support.
Supports Bright Data and direct connection modes.
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class ProxySettings(BaseSettings):
    """Proxy mesh configuration with on/off toggle."""
    
    # Master toggle - can be set via env or runtime
    enabled: bool = Field(default=False, alias="PROXY_ENABLED")
    
    # Bright Data configuration
    brightdata_customer_id: str = Field(default="", alias="BRIGHTDATA_CUSTOMER_ID")
    brightdata_zone: str = Field(default="", alias="BRIGHTDATA_ZONE")
    brightdata_password: str = Field(default="", alias="BRIGHTDATA_PASSWORD")
    
    # Proxy behavior
    rotate_per_request: bool = True
    geo_targeting: str = "us"
    session_sticky: bool = False
    
    # Fallback settings
    max_proxy_failures: int = 5
    fallback_delay_seconds: int = 300
    
    class Config:
        env_file = ".env"
        extra = "ignore"
    
    @property
    def proxy_url(self) -> Optional[str]:
        """Generate Bright Data proxy URL if enabled and configured."""
        if not self.enabled:
            return None
        
        if not all([self.brightdata_customer_id, self.brightdata_zone, self.brightdata_password]):
            return None
        
        # Bright Data Super Proxy format
        return (
            f"http://brd-customer-{self.brightdata_customer_id}-"
            f"zone-{self.brightdata_zone}:{self.brightdata_password}"
            f"@brd.superproxy.io:22225"
        )
    
    def get_proxy_dict(self) -> Optional[dict]:
        """Return proxy configuration for aiohttp."""
        url = self.proxy_url
        if not url:
            return None
        return {"http": url, "https": url}


class ProxyManager:
    """
    Runtime proxy manager with toggle capability.
    Allows enabling/disabling proxy without restart.
    """
    
    def __init__(self, settings: ProxySettings):
        self.settings = settings
        self._runtime_enabled: Optional[bool] = None
        self._consecutive_failures: int = 0
        self._in_fallback: bool = False
    
    @property
    def is_enabled(self) -> bool:
        """Check if proxy is currently active."""
        if self._runtime_enabled is not None:
            return self._runtime_enabled
        return self.settings.enabled
    
    def enable(self) -> None:
        """Enable proxy at runtime."""
        self._runtime_enabled = True
        self._consecutive_failures = 0
        self._in_fallback = False
    
    def disable(self) -> None:
        """Disable proxy at runtime."""
        self._runtime_enabled = False
    
    def toggle(self) -> bool:
        """Toggle proxy state and return new state."""
        if self.is_enabled:
            self.disable()
        else:
            self.enable()
        return self.is_enabled
    
    def record_failure(self) -> None:
        """Record a proxy failure. Triggers fallback if threshold exceeded."""
        self._consecutive_failures += 1
        if self._consecutive_failures >= self.settings.max_proxy_failures:
            self._in_fallback = True
    
    def record_success(self) -> None:
        """Record successful request, reset failure counter."""
        self._consecutive_failures = 0
        self._in_fallback = False
    
    def get_proxy(self) -> Optional[str]:
        """Get proxy URL if enabled and not in fallback mode."""
        if not self.is_enabled or self._in_fallback:
            return None
        return self.settings.proxy_url
    
    def get_status(self) -> dict:
        """Return current proxy status for monitoring."""
        return {
            "enabled": self.is_enabled,
            "in_fallback": self._in_fallback,
            "consecutive_failures": self._consecutive_failures,
            "proxy_url": self.get_proxy() if self.is_enabled else None
        }


@lru_cache()
def get_proxy_settings() -> ProxySettings:
    """Get cached proxy settings."""
    return ProxySettings()


# Global proxy manager instance
_proxy_manager: Optional[ProxyManager] = None


def get_proxy_manager() -> ProxyManager:
    """Get or create global proxy manager."""
    global _proxy_manager
    if _proxy_manager is None:
        _proxy_manager = ProxyManager(get_proxy_settings())
    return _proxy_manager
