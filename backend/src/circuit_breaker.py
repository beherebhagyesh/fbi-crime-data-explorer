"""
Circuit breaker pattern implementation.
Prevents hammering failing endpoints and enables graceful degradation.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional
from enum import Enum
from dataclasses import dataclass, field


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if recovered


@dataclass
class CircuitStatus:
    """Status of a single circuit."""
    state: CircuitState = CircuitState.CLOSED
    failures: int = 0
    last_failure: Optional[datetime] = None
    cooldown_until: Optional[datetime] = None
    success_count: int = 0
    
    def is_available(self) -> bool:
        """Check if circuit allows requests."""
        if self.state == CircuitState.CLOSED:
            return True
        if self.state == CircuitState.OPEN:
            if self.cooldown_until and datetime.utcnow() >= self.cooldown_until:
                return True  # Allow half-open test
            return False
        if self.state == CircuitState.HALF_OPEN:
            return True
        return False


class CircuitBreaker:
    """
    Circuit breaker for API calls.
    Tracks failures per state and trips after threshold exceeded.
    """
    
    def __init__(
        self,
        failure_threshold: int = 3,
        cooldown_seconds: int = 3600,  # 1 hour
        half_open_successes: int = 2,   # Successes needed to close
    ):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.half_open_successes = half_open_successes
        self._circuits: Dict[str, CircuitStatus] = {}
        self._lock = asyncio.Lock()
    
    async def is_available(self, identifier: str) -> bool:
        """Check if requests are allowed for this identifier."""
        async with self._lock:
            if identifier not in self._circuits:
                return True
            
            circuit = self._circuits[identifier]
            
            # Check for half-open transition
            if circuit.state == CircuitState.OPEN:
                if circuit.cooldown_until and datetime.utcnow() >= circuit.cooldown_until:
                    circuit.state = CircuitState.HALF_OPEN
                    circuit.success_count = 0
                    return True
            
            return circuit.is_available()
    
    async def record_success(self, identifier: str) -> None:
        """Record successful request."""
        async with self._lock:
            if identifier not in self._circuits:
                return
            
            circuit = self._circuits[identifier]
            
            if circuit.state == CircuitState.HALF_OPEN:
                circuit.success_count += 1
                if circuit.success_count >= self.half_open_successes:
                    # Fully recovered
                    circuit.state = CircuitState.CLOSED
                    circuit.failures = 0
                    circuit.cooldown_until = None
            elif circuit.state == CircuitState.CLOSED:
                # Reset failure count on success
                circuit.failures = 0
    
    async def record_failure(self, identifier: str, error: Optional[str] = None) -> bool:
        """
        Record failed request.
        Returns True if circuit was tripped.
        """
        async with self._lock:
            if identifier not in self._circuits:
                self._circuits[identifier] = CircuitStatus()
            
            circuit = self._circuits[identifier]
            circuit.failures += 1
            circuit.last_failure = datetime.utcnow()
            
            # Check if threshold exceeded
            if circuit.failures >= self.failure_threshold:
                if circuit.state != CircuitState.OPEN:
                    circuit.state = CircuitState.OPEN
                    circuit.cooldown_until = datetime.utcnow() + timedelta(seconds=self.cooldown_seconds)
                    return True
            
            # Half-open failure immediately trips back to open
            if circuit.state == CircuitState.HALF_OPEN:
                circuit.state = CircuitState.OPEN
                circuit.cooldown_until = datetime.utcnow() + timedelta(seconds=self.cooldown_seconds)
                return True
            
            return False
    
    async def get_status(self, identifier: str) -> dict:
        """Get circuit status."""
        async with self._lock:
            if identifier not in self._circuits:
                return {
                    "state": CircuitState.CLOSED.value,
                    "failures": 0,
                    "available": True,
                }
            
            circuit = self._circuits[identifier]
            return {
                "state": circuit.state.value,
                "failures": circuit.failures,
                "available": circuit.is_available(),
                "cooldown_until": circuit.cooldown_until.isoformat() if circuit.cooldown_until else None,
            }
    
    async def get_all_open(self) -> Dict[str, dict]:
        """Get all open circuits."""
        async with self._lock:
            return {
                identifier: {
                    "failures": circuit.failures,
                    "cooldown_until": circuit.cooldown_until.isoformat() if circuit.cooldown_until else None,
                }
                for identifier, circuit in self._circuits.items()
                if circuit.state == CircuitState.OPEN
            }
    
    async def reset(self, identifier: str) -> None:
        """Manually reset a circuit."""
        async with self._lock:
            if identifier in self._circuits:
                del self._circuits[identifier]
    
    async def reset_all(self) -> None:
        """Reset all circuits."""
        async with self._lock:
            self._circuits.clear()


# Global circuit breaker instance
_circuit_breaker: Optional[CircuitBreaker] = None


def get_circuit_breaker() -> CircuitBreaker:
    """Get or create global circuit breaker."""
    global _circuit_breaker
    if _circuit_breaker is None:
        from backend.config.settings import get_settings
        settings = get_settings()
        _circuit_breaker = CircuitBreaker(
            failure_threshold=settings.rate_limit.circuit_breaker_threshold,
            cooldown_seconds=settings.rate_limit.circuit_breaker_cooldown_hours * 3600,
        )
    return _circuit_breaker
