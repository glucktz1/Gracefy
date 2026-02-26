"""
Circuit Breaker Pattern Implementation for Gracefy.
Provides resilience for external service calls with automatic failover.
"""

import os
import asyncio
import logging
from typing import Any, Callable, Optional, Dict
from datetime import datetime, timezone
from dataclasses import dataclass, field
from enum import Enum
import functools

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"       # Normal operation, requests flow through
    OPEN = "open"           # Failure threshold reached, requests blocked
    HALF_OPEN = "half_open" # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5          # Failures before opening circuit
    success_threshold: int = 3          # Successes before closing circuit
    timeout: float = 30.0               # Seconds before trying half-open
    half_open_max_calls: int = 3        # Max calls in half-open state


@dataclass
class CircuitStats:
    """Statistics for circuit breaker."""
    failures: int = 0
    successes: int = 0
    rejected: int = 0
    last_failure_time: Optional[str] = None
    last_success_time: Optional[str] = None
    state_changes: int = 0


class CircuitBreaker:
    """
    Circuit Breaker implementation.
    
    Prevents cascading failures by stopping requests to failing services.
    """
    
    def __init__(
        self,
        name: str,
        config: Optional[CircuitBreakerConfig] = None,
        fallback: Optional[Callable] = None,
    ):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.fallback = fallback
        
        self._state = CircuitState.CLOSED
        self._failures = 0
        self._successes = 0
        self._last_failure_time: Optional[datetime] = None
        self._half_open_calls = 0
        self._lock = asyncio.Lock()
        
        self._stats = CircuitStats()
    
    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        return self._state
    
    @property
    def is_closed(self) -> bool:
        return self._state == CircuitState.CLOSED
    
    @property
    def is_open(self) -> bool:
        return self._state == CircuitState.OPEN
    
    @property
    def is_half_open(self) -> bool:
        return self._state == CircuitState.HALF_OPEN
    
    async def _should_allow_request(self) -> bool:
        """Check if request should be allowed."""
        async with self._lock:
            if self._state == CircuitState.CLOSED:
                return True
            
            if self._state == CircuitState.OPEN:
                # Check if timeout has passed
                if self._last_failure_time:
                    elapsed = (datetime.now(timezone.utc) - self._last_failure_time).total_seconds()
                    if elapsed >= self.config.timeout:
                        self._transition_to(CircuitState.HALF_OPEN)
                        return True
                self._stats.rejected += 1
                return False
            
            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls < self.config.half_open_max_calls:
                    self._half_open_calls += 1
                    return True
                return False
            
            return False
    
    def _transition_to(self, new_state: CircuitState):
        """Transition to a new state."""
        if self._state != new_state:
            logger.info(f"Circuit '{self.name}': {self._state.value} -> {new_state.value}")
            self._state = new_state
            self._stats.state_changes += 1
            
            if new_state == CircuitState.HALF_OPEN:
                self._half_open_calls = 0
                self._successes = 0
            elif new_state == CircuitState.CLOSED:
                self._failures = 0
    
    async def _record_success(self):
        """Record successful call."""
        async with self._lock:
            self._successes += 1
            self._stats.successes += 1
            self._stats.last_success_time = datetime.now(timezone.utc).isoformat()
            
            if self._state == CircuitState.HALF_OPEN:
                if self._successes >= self.config.success_threshold:
                    self._transition_to(CircuitState.CLOSED)
    
    async def _record_failure(self, error: Exception):
        """Record failed call."""
        async with self._lock:
            self._failures += 1
            self._stats.failures += 1
            self._last_failure_time = datetime.now(timezone.utc)
            self._stats.last_failure_time = self._last_failure_time.isoformat()
            
            if self._state == CircuitState.CLOSED:
                if self._failures >= self.config.failure_threshold:
                    self._transition_to(CircuitState.OPEN)
            
            elif self._state == CircuitState.HALF_OPEN:
                self._transition_to(CircuitState.OPEN)
            
            logger.warning(f"Circuit '{self.name}' failure #{self._failures}: {error}")
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection."""
        if not await self._should_allow_request():
            if self.fallback:
                logger.debug(f"Circuit '{self.name}' open, using fallback")
                return await self.fallback(*args, **kwargs) if asyncio.iscoroutinefunction(self.fallback) else self.fallback(*args, **kwargs)
            raise CircuitOpenError(f"Circuit '{self.name}' is open")
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            await self._record_success()
            return result
            
        except Exception as e:
            await self._record_failure(e)
            
            if self.fallback:
                logger.debug(f"Circuit '{self.name}' call failed, using fallback")
                return await self.fallback(*args, **kwargs) if asyncio.iscoroutinefunction(self.fallback) else self.fallback(*args, **kwargs)
            raise
    
    def get_stats(self) -> dict:
        """Get circuit breaker statistics."""
        return {
            'name': self.name,
            'state': self._state.value,
            'failures': self._stats.failures,
            'successes': self._stats.successes,
            'rejected': self._stats.rejected,
            'last_failure_time': self._stats.last_failure_time,
            'last_success_time': self._stats.last_success_time,
            'state_changes': self._stats.state_changes,
            'config': {
                'failure_threshold': self.config.failure_threshold,
                'success_threshold': self.config.success_threshold,
                'timeout': self.config.timeout,
            }
        }
    
    async def reset(self):
        """Manually reset the circuit breaker."""
        async with self._lock:
            self._transition_to(CircuitState.CLOSED)
            self._failures = 0
            self._successes = 0
            self._half_open_calls = 0


class CircuitOpenError(Exception):
    """Raised when circuit is open and no fallback is available."""
    pass


# ============== DECORATOR ==============

def circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    success_threshold: int = 3,
    timeout: float = 30.0,
    fallback: Optional[Callable] = None,
):
    """
    Decorator to apply circuit breaker to a function.
    
    Usage:
        @circuit_breaker('external_api', failure_threshold=3, timeout=60)
        async def call_external_api(data):
            ...
    """
    config = CircuitBreakerConfig(
        failure_threshold=failure_threshold,
        success_threshold=success_threshold,
        timeout=timeout,
    )
    breaker = CircuitBreaker(name, config, fallback)
    
    # Register in global registry
    circuit_registry[name] = breaker
    
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            return await breaker.call(func, *args, **kwargs)
        
        # Attach circuit breaker for access
        wrapper.circuit_breaker = breaker
        return wrapper
    
    return decorator


# ============== GLOBAL REGISTRY ==============

circuit_registry: Dict[str, CircuitBreaker] = {}


def get_circuit(name: str) -> Optional[CircuitBreaker]:
    """Get circuit breaker by name."""
    return circuit_registry.get(name)


def get_all_circuits_stats() -> Dict[str, dict]:
    """Get stats for all circuit breakers."""
    return {name: cb.get_stats() for name, cb in circuit_registry.items()}


async def reset_all_circuits():
    """Reset all circuit breakers."""
    for cb in circuit_registry.values():
        await cb.reset()


# ============== PRE-CONFIGURED CIRCUIT BREAKERS ==============

# External services circuit breakers
cdn_circuit = CircuitBreaker(
    "cdn",
    CircuitBreakerConfig(failure_threshold=5, timeout=60),
    fallback=lambda *args, **kwargs: None  # Return None on CDN failure
)

payment_circuit = CircuitBreaker(
    "payment",
    CircuitBreakerConfig(failure_threshold=3, timeout=120),
)

sms_circuit = CircuitBreaker(
    "sms",
    CircuitBreakerConfig(failure_threshold=5, timeout=300),
)

external_api_circuit = CircuitBreaker(
    "external_api",
    CircuitBreakerConfig(failure_threshold=5, timeout=60),
)

# Register pre-configured circuits
circuit_registry['cdn'] = cdn_circuit
circuit_registry['payment'] = payment_circuit
circuit_registry['sms'] = sms_circuit
circuit_registry['external_api'] = external_api_circuit


# ============== RETRY HELPER ==============

async def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    exceptions: tuple = (Exception,),
    *args,
    **kwargs
) -> Any:
    """
    Retry a function with exponential backoff.
    
    Args:
        func: Async function to retry
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential backoff
        exceptions: Tuple of exceptions to catch and retry
    """
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return func(*args, **kwargs)
        
        except exceptions as e:
            last_exception = e
            
            if attempt == max_retries:
                logger.error(f"All {max_retries} retries failed for {func.__name__}: {e}")
                raise
            
            delay = min(base_delay * (exponential_base ** attempt), max_delay)
            logger.warning(f"Retry {attempt + 1}/{max_retries} for {func.__name__} after {delay:.1f}s: {e}")
            await asyncio.sleep(delay)
    
    raise last_exception


# ============== TIMEOUT HELPER ==============

async def with_timeout(
    func: Callable,
    timeout: float,
    fallback: Any = None,
    *args,
    **kwargs
) -> Any:
    """
    Execute function with timeout.
    
    Args:
        func: Async function to execute
        timeout: Timeout in seconds
        fallback: Value to return on timeout (or raise TimeoutError if None)
    """
    try:
        return await asyncio.wait_for(
            func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else asyncio.to_thread(func, *args, **kwargs),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        if fallback is not None:
            logger.warning(f"Timeout ({timeout}s) for {func.__name__}, using fallback")
            return fallback
        raise
