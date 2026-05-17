"""
Redis Caching Service for Gracefy.
Provides distributed caching with automatic fallback to in-memory cache.
Supports auto-scaling with adaptive TTL based on traffic.
"""

import os
import json
import time
import asyncio
import logging
from typing import Any, Optional, Dict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Redis configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
REDIS_PREFIX = os.environ.get('REDIS_PREFIX', 'gracefy:')
REDIS_ENABLED = os.environ.get('REDIS_ENABLED', 'true').lower() == 'true'


def _is_cloud_env() -> bool:
    """Detect if we're running inside a Kubernetes / container deployment.
    
    When True and REDIS_URL points at localhost, we skip the local Redis
    connection (which would otherwise time out and spam warnings) because
    in-memory + Upstash fallback covers all caching needs in the cloud.
    """
    return bool(
        os.environ.get('KUBERNETES_SERVICE_HOST')
        or os.environ.get('K_SERVICE')  # GCP Cloud Run
        or os.environ.get('RAILWAY_ENVIRONMENT')
        or os.environ.get('RENDER')
        or os.environ.get('FLY_APP_NAME')
    )


def _is_localhost_url(url: str) -> bool:
    """Check if a URL points at localhost / 127.0.0.1."""
    if not url:
        return False
    return 'localhost' in url or '127.0.0.1' in url

# Cache TTL defaults (in seconds)
CACHE_TTL = {
    'home': 60,
    'albums': 120,
    'album_detail': 300,
    'songs': 120,
    'categories': 600,
    'churches': 300,
    'choirs': 300,
    'layout': 120,
    'settings': 300,
    'user_library': 60,
    'search': 30,
    'bible': 3600,
    'filters': 120,
    'default': 60,
}


class RedisCache:
    """
    Redis-based cache with automatic fallback to in-memory.
    Supports traffic-based adaptive TTL for auto-scaling.
    """
    
    def __init__(self):
        self._redis = None
        self._connected = False
        self._fallback_cache: Dict[str, dict] = {}  # In-memory fallback
        self._ttl_multiplier = 1.0  # For auto-scaling
        self._stats = {
            'hits': 0,
            'misses': 0,
            'redis_errors': 0,
            'fallback_hits': 0,
        }
    
    async def connect(self):
        """Connect to Redis server."""
        if not REDIS_ENABLED:
            logger.info("Redis disabled, using in-memory cache only")
            return False
        
        # Skip local Redis in cloud deployments — in-memory + Upstash covers it
        if _is_cloud_env() and _is_localhost_url(REDIS_URL):
            logger.info("Cloud env detected with localhost Redis URL — using in-memory fallback (no warning)")
            self._connected = False
            return False
        
        try:
            import redis.asyncio as aioredis
            
            self._redis = aioredis.from_url(
                REDIS_URL,
                encoding='utf-8',
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
            
            # Test connection
            await self._redis.ping()
            self._connected = True
            logger.info(f"✅ Connected to Redis at {REDIS_URL}")
            return True
            
        except Exception as e:
            # Demote to INFO when URL was localhost — fallback is expected behaviour
            if _is_localhost_url(REDIS_URL):
                logger.info(f"Local Redis unavailable ({type(e).__name__}); using in-memory fallback")
            else:
                logger.warning(f"⚠️ Redis connection failed: {e}. Using in-memory fallback.")
            self._connected = False
            return False
    
    async def disconnect(self):
        """Disconnect from Redis."""
        if self._redis:
            await self._redis.close()
            self._redis = None
            self._connected = False
            logger.info("Disconnected from Redis")
    
    def set_ttl_multiplier(self, multiplier: float):
        """Set TTL multiplier for auto-scaling."""
        self._ttl_multiplier = multiplier
    
    def _get_ttl(self, cache_type: str) -> int:
        """Get TTL with auto-scaling multiplier applied."""
        base_ttl = CACHE_TTL.get(cache_type, CACHE_TTL['default'])
        return int(base_ttl * self._ttl_multiplier)
    
    def _make_key(self, key: str) -> str:
        """Create Redis key with prefix."""
        return f"{REDIS_PREFIX}{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache (Redis with in-memory fallback)."""
        redis_key = self._make_key(key)
        
        # Try Redis first
        if self._connected and self._redis:
            try:
                value = await self._redis.get(redis_key)
                if value:
                    self._stats['hits'] += 1
                    return json.loads(value)
            except Exception as e:
                self._stats['redis_errors'] += 1
                logger.debug(f"Redis get error: {e}")
        
        # Fallback to in-memory
        if key in self._fallback_cache:
            entry = self._fallback_cache[key]
            if time.time() < entry['expires_at']:
                self._stats['fallback_hits'] += 1
                return entry['value']
            else:
                del self._fallback_cache[key]
        
        self._stats['misses'] += 1
        return None
    
    async def set(self, key: str, value: Any, cache_type: str = 'default') -> bool:
        """Set value in cache with adaptive TTL."""
        redis_key = self._make_key(key)
        ttl = self._get_ttl(cache_type)
        
        # Serialize value
        try:
            serialized = json.dumps(value, default=str)
        except (TypeError, ValueError) as e:
            logger.error(f"Cache serialization error: {e}")
            return False
        
        # Try Redis first
        if self._connected and self._redis:
            try:
                await self._redis.setex(redis_key, ttl, serialized)
                return True
            except Exception as e:
                self._stats['redis_errors'] += 1
                logger.debug(f"Redis set error: {e}")
        
        # Fallback to in-memory
        self._fallback_cache[key] = {
            'value': value,
            'expires_at': time.time() + ttl,
        }
        
        # Limit fallback cache size
        if len(self._fallback_cache) > 5000:
            # Remove oldest 1000 entries
            oldest_keys = sorted(
                self._fallback_cache.keys(),
                key=lambda k: self._fallback_cache[k]['expires_at']
            )[:1000]
            for k in oldest_keys:
                del self._fallback_cache[k]
        
        return True
    
    async def delete(self, key: str) -> bool:
        """Delete from cache."""
        redis_key = self._make_key(key)
        
        # Delete from Redis
        if self._connected and self._redis:
            try:
                await self._redis.delete(redis_key)
            except Exception as e:
                logger.debug(f"Redis delete error: {e}")
        
        # Delete from fallback
        self._fallback_cache.pop(key, None)
        return True
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern."""
        redis_pattern = self._make_key(pattern)
        deleted = 0
        
        # Delete from Redis
        if self._connected and self._redis:
            try:
                cursor = 0
                while True:
                    cursor, keys = await self._redis.scan(cursor, match=redis_pattern, count=100)
                    if keys:
                        await self._redis.delete(*keys)
                        deleted += len(keys)
                    if cursor == 0:
                        break
            except Exception as e:
                logger.debug(f"Redis delete_pattern error: {e}")
        
        # Delete from fallback
        import fnmatch
        keys_to_delete = [k for k in self._fallback_cache.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_delete:
            del self._fallback_cache[k]
            deleted += 1
        
        return deleted
    
    async def clear_all(self) -> bool:
        """Clear all cache entries."""
        # Clear Redis
        if self._connected and self._redis:
            try:
                cursor = 0
                while True:
                    cursor, keys = await self._redis.scan(cursor, match=f"{REDIS_PREFIX}*", count=100)
                    if keys:
                        await self._redis.delete(*keys)
                    if cursor == 0:
                        break
            except Exception as e:
                logger.debug(f"Redis clear error: {e}")
        
        # Clear fallback
        self._fallback_cache.clear()
        return True
    
    async def get_stats(self) -> dict:
        """Get cache statistics."""
        redis_info = {}
        redis_keys = 0
        
        if self._connected and self._redis:
            try:
                info = await self._redis.info('memory')
                redis_info = {
                    'used_memory': info.get('used_memory_human', 'N/A'),
                    'peak_memory': info.get('used_memory_peak_human', 'N/A'),
                }
                
                # Count keys with our prefix
                cursor = 0
                while True:
                    cursor, keys = await self._redis.scan(cursor, match=f"{REDIS_PREFIX}*", count=100)
                    redis_keys += len(keys)
                    if cursor == 0:
                        break
            except Exception as e:
                logger.debug(f"Redis stats error: {e}")
        
        total_requests = self._stats['hits'] + self._stats['misses']
        hit_rate = (self._stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'type': 'redis' if self._connected else 'memory_fallback',
            'connected': self._connected,
            'redis_url': REDIS_URL if self._connected else None,
            'redis_keys': redis_keys,
            'redis_memory': redis_info,
            'fallback_entries': len(self._fallback_cache),
            'hits': self._stats['hits'],
            'misses': self._stats['misses'],
            'hit_rate': f"{hit_rate:.1f}%",
            'redis_errors': self._stats['redis_errors'],
            'fallback_hits': self._stats['fallback_hits'],
            'ttl_multiplier': f"{self._ttl_multiplier}x",
            'effective_ttls': {k: int(v * self._ttl_multiplier) for k, v in CACHE_TTL.items()},
        }


# Global Redis cache instance
redis_cache = RedisCache()


# ============== CONVENIENCE FUNCTIONS ==============

async def cache_get(key: str) -> Optional[Any]:
    """Get from Redis cache."""
    return await redis_cache.get(key)


async def cache_set(key: str, value: Any, cache_type: str = 'default') -> bool:
    """Set in Redis cache."""
    return await redis_cache.set(key, value, cache_type)


async def cache_delete(key: str) -> bool:
    """Delete from Redis cache."""
    return await redis_cache.delete(key)


async def invalidate_pattern(pattern: str) -> int:
    """Delete all keys matching pattern."""
    return await redis_cache.delete_pattern(pattern)


# ============== CACHE DECORATORS ==============

def redis_cached(cache_type: str = 'default', key_builder=None):
    """
    Decorator for caching function results in Redis.
    
    Usage:
        @redis_cached('albums')
        async def get_albums(category_id: str = None):
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                key_parts = [func.__name__]
                key_parts.extend(str(arg) for arg in args if arg is not None)
                key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()) if v is not None)
                cache_key = ':'.join(key_parts)
            
            # Try cache
            cached_result = await redis_cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Call function
            result = await func(*args, **kwargs)
            
            # Cache result
            await redis_cache.set(cache_key, result, cache_type)
            
            return result
        
        return wrapper
    return decorator


# ============== INVALIDATION HELPERS ==============

async def invalidate_home_cache():
    """Invalidate all home-related cache."""
    await invalidate_pattern('home:*')
    await invalidate_pattern('user_home:*')
    await invalidate_pattern('layout:*')


async def invalidate_albums_cache(album_id: str = None):
    """Invalidate albums cache."""
    if album_id:
        await redis_cache.delete(f'album:{album_id}')
        await redis_cache.delete(f'album_detail:{album_id}')
    await invalidate_pattern('albums:*')


async def invalidate_songs_cache(song_id: str = None):
    """Invalidate songs cache."""
    if song_id:
        await redis_cache.delete(f'song:{song_id}')
    await invalidate_pattern('songs:*')


async def invalidate_user_cache(user_id: str):
    """Invalidate user-specific cache."""
    await invalidate_pattern(f'user:{user_id}:*')
    await invalidate_pattern(f'library:{user_id}:*')
