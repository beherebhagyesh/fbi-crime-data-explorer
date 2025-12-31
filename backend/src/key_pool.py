"""
API Key rotation pool for distributing requests across 8 keys.
Thread-safe with async lock for concurrent access.
"""
import asyncio
from typing import List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta


@dataclass
class KeyUsage:
    """Track usage statistics per key."""
    key: str
    requests_made: int = 0
    last_used: Optional[datetime] = None
    errors: int = 0
    rate_limited_until: Optional[datetime] = None


class KeyPool:
    """
    Manages rotation across multiple API keys.
    Implements round-robin with rate limit awareness.
    """
    
    def __init__(self, keys: List[str]):
        if not keys:
            raise ValueError("At least one API key is required")
        
        self._keys = [KeyUsage(key=k) for k in keys if k]
        self._index = 0
        self._lock = asyncio.Lock()
    
    @property
    def key_count(self) -> int:
        """Number of keys in pool."""
        return len(self._keys)
    
    async def get_next_key(self) -> str:
        """
        Get next available API key using round-robin.
        Skips rate-limited keys if possible.
        """
        async with self._lock:
            now = datetime.utcnow()
            
            # Try to find an available key
            for attempt in range(self.key_count):
                key_usage = self._keys[self._index]
                self._index = (self._index + 1) % self.key_count
                
                # Check if rate limited
                if key_usage.rate_limited_until and key_usage.rate_limited_until > now:
                    continue
                
                # Update usage stats
                key_usage.requests_made += 1
                key_usage.last_used = now
                return key_usage.key
            
            # All keys rate limited, return first one anyway
            key_usage = self._keys[0]
            key_usage.requests_made += 1
            key_usage.last_used = now
            return key_usage.key
    
    async def mark_rate_limited(self, key: str, cooldown_seconds: int = 3600) -> None:
        """Mark a key as rate limited."""
        async with self._lock:
            for key_usage in self._keys:
                if key_usage.key == key:
                    key_usage.rate_limited_until = datetime.utcnow() + timedelta(seconds=cooldown_seconds)
                    key_usage.errors += 1
                    break
    
    async def mark_error(self, key: str) -> None:
        """Record an error for a key."""
        async with self._lock:
            for key_usage in self._keys:
                if key_usage.key == key:
                    key_usage.errors += 1
                    break
    
    async def get_stats(self) -> List[dict]:
        """Get usage statistics for all keys."""
        async with self._lock:
            return [
                {
                    "key_suffix": ku.key[-4:] if len(ku.key) > 4 else "****",
                    "requests_made": ku.requests_made,
                    "errors": ku.errors,
                    "rate_limited": ku.rate_limited_until is not None and ku.rate_limited_until > datetime.utcnow(),
                }
                for ku in self._keys
            ]
    
    async def reset_stats(self) -> None:
        """Reset all usage statistics."""
        async with self._lock:
            for ku in self._keys:
                ku.requests_made = 0
                ku.errors = 0
                ku.rate_limited_until = None


def create_key_pool_from_settings() -> KeyPool:
    """Create key pool from environment settings."""
    from backend.config.settings import get_settings
    settings = get_settings()
    keys = settings.api.api_keys
    
    if not keys:
        raise ValueError("No API keys configured in environment")
    
    return KeyPool(keys)
