"""
Hybrid L1/L2 Cache Architecture for Ultra-Fast Performance

Layer 1 (L1) - In-Memory Cache:
- Uses Python's cachetools.TTLCache
- Zero latency, instant reads
- Per-instance, thread-safe

Layer 2 (L2) - Redis/Upstash:
- Shared across all server instances
- Circuit breaker for fault tolerance
- Fire-and-forget async writes
"""

import os
import json
import asyncio
import logging
from typing import Optional, Any, Callable
from datetime import datetime
from functools import wraps
from cachetools import TTLCache
from threading import Lock

logger = logging.getLogger(__name__)

# ============== L1 IN-MEMORY CACHE ==============

class L1Cache:
    """Thread-safe in-memory TTL cache (Layer 1)"""
    
    def __init__(self, maxsize: int = 1000, ttl: int = 60):
        self._cache = TTLCache(maxsize=maxsize, ttl=ttl)
        self._lock = Lock()
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            value = self._cache.get(key)
            if value is not None:
                self._hits += 1
                logger.debug(f"[L1] Cache HIT: {key}")
            else:
                self._misses += 1
                logger.debug(f"[L1] Cache MISS: {key}")
            return value
    
    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._cache[key] = value
            logger.debug(f"[L1] Cache SET: {key}")
    
    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
    
    def stats(self) -> dict:
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0
            return {
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": f"{hit_rate:.1f}%",
                "size": len(self._cache)
            }


# ============== CIRCUIT BREAKER ==============

class CircuitBreaker:
    """Circuit breaker for L2 Redis connection"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self._lock = Lock()
    
    def record_success(self):
        with self._lock:
            self.failures = 0
            self.state = "CLOSED"
    
    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure_time = datetime.now()
            if self.failures >= self.failure_threshold:
                self.state = "OPEN"
                logger.warning(f"[CircuitBreaker] OPENED after {self.failures} failures")
    
    def can_execute(self) -> bool:
        with self._lock:
            if self.state == "CLOSED":
                return True
            
            if self.state == "OPEN":
                # Check if recovery timeout has passed
                if self.last_failure_time:
                    elapsed = (datetime.now() - self.last_failure_time).seconds
                    if elapsed >= self.recovery_timeout:
                        self.state = "HALF_OPEN"
                        logger.info("[CircuitBreaker] Moving to HALF_OPEN state")
                        return True
                return False
            
            # HALF_OPEN - allow one request
            return True


# ============== L2 REDIS CACHE ==============

class L2Cache:
    """Redis cache with circuit breaker (Layer 2)"""
    
    def __init__(self):
        self._client = None
        self._circuit_breaker = CircuitBreaker()
        self._initialized = False
    
    def _get_client(self):
        if self._client is None:
            try:
                from upstash_redis import Redis
                url = os.environ.get('UPSTASH_REDIS_REST_URL')
                token = os.environ.get('UPSTASH_REDIS_REST_TOKEN')
                
                if url and token:
                    self._client = Redis(url=url, token=token)
                    self._initialized = True
                    logger.info("[L2] Connected to Upstash Redis")
            except Exception as e:
                logger.error(f"[L2] Failed to connect to Redis: {e}")
        return self._client
    
    async def get(self, key: str) -> Optional[Any]:
        if not self._circuit_breaker.can_execute():
            logger.debug(f"[L2] Circuit breaker OPEN, skipping Redis GET")
            return None
        
        client = self._get_client()
        if not client:
            return None
        
        try:
            value = client.get(key)
            self._circuit_breaker.record_success()
            
            if value:
                logger.debug(f"[L2] Cache HIT: {key}")
                return json.loads(value) if isinstance(value, str) else value
            
            logger.debug(f"[L2] Cache MISS: {key}")
            return None
        except Exception as e:
            logger.error(f"[L2] Redis GET error: {e}")
            self._circuit_breaker.record_failure()
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        if not self._circuit_breaker.can_execute():
            return False
        
        client = self._get_client()
        if not client:
            return False
        
        try:
            serialized = json.dumps(value) if not isinstance(value, str) else value
            client.set(key, serialized, ex=ttl)
            self._circuit_breaker.record_success()
            logger.debug(f"[L2] Cache SET: {key} (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.error(f"[L2] Redis SET error: {e}")
            self._circuit_breaker.record_failure()
            return False
    
    def set_fire_and_forget(self, key: str, value: Any, ttl: int = 300):
        """Non-blocking cache write"""
        asyncio.ensure_future(self.set(key, value, ttl))
    
    async def delete(self, key: str) -> bool:
        if not self._circuit_breaker.can_execute():
            return False
        
        client = self._get_client()
        if not client:
            return False
        
        try:
            client.delete(key)
            self._circuit_breaker.record_success()
            return True
        except Exception as e:
            logger.error(f"[L2] Redis DELETE error: {e}")
            self._circuit_breaker.record_failure()
            return False
    
    def status(self) -> dict:
        return {
            "connected": self._initialized,
            "circuit_state": self._circuit_breaker.state,
            "failures": self._circuit_breaker.failures
        }


# ============== HYBRID CACHE ==============

class HybridCache:
    """
    Hybrid L1/L2 cache with intelligent fallback.
    
    Read path: L1 -> L2 -> Origin
    Write path: L1 + L2 (fire-and-forget)
    """
    
    def __init__(self, l1_maxsize: int = 1000, l1_ttl: int = 60):
        self.l1 = L1Cache(maxsize=l1_maxsize, ttl=l1_ttl)
        self.l2 = L2Cache()
    
    async def get(self, key: str) -> Optional[Any]:
        """Get from L1, then L2"""
        # Try L1 first (instant)
        value = self.l1.get(key)
        if value is not None:
            return value
        
        # Try L2 (Redis)
        value = await self.l2.get(key)
        if value is not None:
            # Populate L1 for next request
            self.l1.set(key, value)
            return value
        
        return None
    
    async def set(self, key: str, value: Any, l1_ttl: int = 60, l2_ttl: int = 300) -> None:
        """Set in both L1 and L2"""
        # Set L1 immediately
        self.l1.set(key, value)
        
        # Set L2 asynchronously (fire-and-forget)
        self.l2.set_fire_and_forget(key, value, l2_ttl)
    
    async def delete(self, key: str) -> None:
        """Delete from both layers"""
        self.l1.delete(key)
        await self.l2.delete(key)
    
    def stats(self) -> dict:
        return {
            "l1": self.l1.stats(),
            "l2": self.l2.status()
        }


# ============== GLOBAL INSTANCES ==============

# Home page cache - higher capacity, longer TTL
home_cache = HybridCache(l1_maxsize=100, l1_ttl=120)

# General cache for other data
general_cache = HybridCache(l1_maxsize=500, l1_ttl=60)

# Billing cache - shorter TTL for freshness
billing_cache = HybridCache(l1_maxsize=50, l1_ttl=10)


# ============== CACHE DECORATORS ==============

def cached(cache: HybridCache, key_prefix: str, l1_ttl: int = 60, l2_ttl: int = 300):
    """Decorator for caching async function results"""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from prefix and args
            key_parts = [key_prefix]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # Try cache first
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            if result is not None:
                await cache.set(cache_key, result, l1_ttl, l2_ttl)
            
            return result
        return wrapper
    return decorator


# ============== HOME PAGE CACHE FUNCTIONS ==============

HOME_CACHE_PREFIX = "home"

async def get_cached_home_data(platform: str = "app") -> Optional[dict]:
    """Get cached home page data using hybrid cache"""
    key = f"{HOME_CACHE_PREFIX}:{platform}:v2"
    return await home_cache.get(key)


async def set_cached_home_data(platform: str, data: dict) -> None:
    """Cache home page data with hybrid cache"""
    key = f"{HOME_CACHE_PREFIX}:{platform}:v2"
    # L1: 2 minutes, L2: 5 minutes
    await home_cache.set(key, data, l1_ttl=120, l2_ttl=300)


async def invalidate_home_cache(platform: str = None) -> None:
    """Invalidate home cache"""
    if platform:
        await home_cache.delete(f"{HOME_CACHE_PREFIX}:{platform}:v2")
    else:
        for p in ["app", "web"]:
            await home_cache.delete(f"{HOME_CACHE_PREFIX}:{p}:v2")


# ============== BILLING CACHE FUNCTIONS ==============

BILLING_CACHE_KEY = "billing:status:v1"

async def get_cached_billing_status() -> Optional[dict]:
    """Get cached billing status"""
    return await billing_cache.get(BILLING_CACHE_KEY)


async def set_cached_billing_status(status: dict) -> None:
    """Cache billing status (short TTL for freshness)"""
    await billing_cache.set(BILLING_CACHE_KEY, status, l1_ttl=10, l2_ttl=30)


async def invalidate_billing_cache() -> None:
    """Invalidate billing cache"""
    await billing_cache.delete(BILLING_CACHE_KEY)


# ============== CACHE STATS ENDPOINT ==============

def get_cache_stats() -> dict:
    """Get stats for all caches"""
    return {
        "home_cache": home_cache.stats(),
        "general_cache": general_cache.stats(),
        "billing_cache": billing_cache.stats()
    }
