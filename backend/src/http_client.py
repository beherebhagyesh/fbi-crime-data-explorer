"""
Async HTTP client for FBI CDE API.
Integrates key rotation, proxy, circuit breaker, and rate limiting.
"""
import asyncio
import logging
from typing import Optional, Any, Dict
from datetime import datetime

import aiohttp
from aiohttp import ClientTimeout, ClientSession, TCPConnector
from aiolimiter import AsyncLimiter

from backend.config.settings import get_settings
from backend.config.proxy_config import get_proxy_manager
from backend.src.key_pool import KeyPool, create_key_pool_from_settings
from backend.src.circuit_breaker import CircuitBreaker, get_circuit_breaker


logger = logging.getLogger(__name__)


class HTTPClient:
    """
    Production-grade HTTP client for FBI API.
    Features:
    - 8-key rotation
    - Proxy mesh integration (toggleable)
    - Circuit breaker per state
    - Rate limiting (5 req/sec)
    - Exponential backoff
    """
    
    USER_AGENT = "FBICrimePipeline/1.0 (research-project)"
    
    def __init__(
        self,
        key_pool: Optional[KeyPool] = None,
        circuit_breaker: Optional[CircuitBreaker] = None,
    ):
        self.settings = get_settings()
        self.proxy_manager = get_proxy_manager()
        self.key_pool = key_pool or create_key_pool_from_settings()
        self.circuit_breaker = circuit_breaker or get_circuit_breaker()
        
        # Rate limiting
        self.limiter = AsyncLimiter(
            self.settings.rate_limit.requests_per_second,
            1.0
        )
        self.semaphore = asyncio.Semaphore(
            self.settings.rate_limit.max_concurrent
        )
        
        # Session (created lazily)
        self._session: Optional[ClientSession] = None
        
        # Stats
        self._request_count = 0
        self._error_count = 0
        self._start_time: Optional[datetime] = None
    
    async def _get_session(self) -> ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            connector = TCPConnector(
                limit=self.settings.rate_limit.max_concurrent * 2,
                ttl_dns_cache=300,
            )
            self._session = ClientSession(connector=connector)
            self._start_time = datetime.utcnow()
        return self._session
    
    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
    
    def _build_headers(self, api_key: str) -> Dict[str, str]:
        """Build request headers with API key."""
        return {
            "User-Agent": self.USER_AGENT,
            "X-API-KEY": api_key,
            "Accept": "application/json",
        }
    
    async def get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        circuit_id: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Make GET request with all protections.
        
        Args:
            path: API path (appended to base URL)
            params: Query parameters
            circuit_id: Identifier for circuit breaker (e.g., state abbr)
            timeout: Request timeout in seconds
        
        Returns:
            JSON response or None on failure
        """
        url = f"{self.settings.api.base_url}{path}"
        timeout_val = timeout or self.settings.timeout.standard_timeout
        
        # Check circuit breaker
        if circuit_id:
            if not await self.circuit_breaker.is_available(circuit_id):
                logger.warning(f"Circuit open for {circuit_id}, skipping request")
                return None
        
        # Rate limiting and concurrency control
        async with self.semaphore:
            await self.limiter.acquire()
            
            api_key = await self.key_pool.get_next_key()
            headers = self._build_headers(api_key)
            proxy = self.proxy_manager.get_proxy()
            
            session = await self._get_session()
            client_timeout = ClientTimeout(total=timeout_val)
            
            try:
                async with session.get(
                    url,
                    params=params,
                    headers=headers,
                    proxy=proxy,
                    timeout=client_timeout,
                ) as response:
                    self._request_count += 1
                    
                    if response.status == 200:
                        if circuit_id:
                            await self.circuit_breaker.record_success(circuit_id)
                        if proxy:
                            self.proxy_manager.record_success()
                        return await response.json()
                    
                    elif response.status == 429:
                        logger.warning(f"Rate limited (429) for {path}")
                        await self.key_pool.mark_rate_limited(api_key)
                        self._error_count += 1
                        return None
                    
                    elif response.status in (500, 502, 503, 504):
                        logger.warning(f"Server error ({response.status}) for {path}")
                        self._error_count += 1
                        
                        if circuit_id:
                            tripped = await self.circuit_breaker.record_failure(circuit_id)
                            if tripped:
                                logger.error(f"Circuit tripped for {circuit_id}")
                        
                        if proxy:
                            self.proxy_manager.record_failure()
                        
                        return None
                    
                    else:
                        logger.warning(f"Unexpected status {response.status} for {path}")
                        self._error_count += 1
                        return None
            
            except asyncio.TimeoutError:
                logger.warning(f"Timeout for {path}")
                self._error_count += 1
                if circuit_id:
                    await self.circuit_breaker.record_failure(circuit_id)
                return None
            
            except aiohttp.ClientError as e:
                logger.error(f"Client error for {path}: {e}")
                self._error_count += 1
                if proxy:
                    self.proxy_manager.record_failure()
                return None
            
            except Exception as e:
                logger.error(f"Unexpected error for {path}: {e}")
                self._error_count += 1
                return None
    
    async def get_with_retry(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        circuit_id: Optional[str] = None,
        timeout: Optional[int] = None,
        max_retries: int = 3,
    ) -> Optional[Dict[str, Any]]:
        """
        GET request with exponential backoff retry.
        Backoff: 1s, 2s, 4s
        """
        for attempt in range(max_retries):
            result = await self.get(path, params, circuit_id, timeout)
            
            if result is not None:
                return result
            
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 1, 2, 4 seconds
                logger.info(f"Retry {attempt + 1}/{max_retries} for {path} in {wait_time}s")
                await asyncio.sleep(wait_time)
        
        return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics."""
        elapsed = None
        if self._start_time:
            elapsed = (datetime.utcnow() - self._start_time).total_seconds()
        
        return {
            "requests": self._request_count,
            "errors": self._error_count,
            "error_rate": self._error_count / max(self._request_count, 1),
            "elapsed_seconds": elapsed,
            "requests_per_second": self._request_count / max(elapsed, 1) if elapsed else 0,
            "proxy_status": self.proxy_manager.get_status(),
        }


# Global client instance
_http_client: Optional[HTTPClient] = None


def get_http_client() -> HTTPClient:
    """Get or create global HTTP client."""
    global _http_client
    if _http_client is None:
        _http_client = HTTPClient()
    return _http_client


async def cleanup_http_client() -> None:
    """Clean up global HTTP client."""
    global _http_client
    if _http_client:
        await _http_client.close()
        _http_client = None
