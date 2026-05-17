"""
Redis Caching Service for Gracefy
Provides distributed caching for high-traffic scenarios
"""

import json
import logging
from typing import Optional, Any
from datetime import timedelta
import os

logger = logging.getLogger(__name__)

# Redis connection settings from environment
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
REDIS_ENABLED = os.environ.get('REDIS_ENABLED', 'false').lower() == 'true'

# Cache TTL defaults (in seconds)
CACHE_TTL = {
    'home': 60,           # Home page - 1 minute
    'albums': 120,        # Albums list - 2 minutes
    'album_detail': 300,  # Album detail - 5 minutes
    'categories': 600,    # Categories - 10 minutes
    'churches': 300,      # Churches - 5 minutes
    'layout': 120,        # Layout sections - 2 minutes
    'settings': 300,      # System settings - 5 minutes
    'user_library': 60,   # User library - 1 minute
    'search': 30,         # Search results - 30 seconds
    'default': 60,        # Default TTL
}


class RedisCache:
    """Redis-based distributed cache with fallback to in-memory"""
    
    def __init__(self):
        self.redis_client = None
        self.connected = False
        self._memory_cache = {}  # Fallback in-memory cache
        self._memory_timestamps = {}
        
    async def connect(self):
        """Initialize Redis connection"""
        if not REDIS_ENABLED:
            logger.info("Redis caching disabled - using in-memory cache")
            return False
        
        # Skip local Redis in cloud deployments
        _is_cloud = bool(
            os.environ.get('KUBERNETES_SERVICE_HOST')
            or os.environ.get('K_SERVICE')
            or os.environ.get('RAILWAY_ENVIRONMENT')
            or os.environ.get('RENDER')
            or os.environ.get('FLY_APP_NAME')
        )
        _is_localhost = bool(REDIS_URL and ('localhost' in REDIS_URL or '127.0.0.1' in REDIS_URL))
        if _is_cloud and _is_localhost:
            logger.info("Cloud env detected with localhost Redis URL — using in-memory fallback")
            self.connected = False
            return False
            
        try:
            import redis.asyncio as redis
            self.redis_client = redis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5
            )
            # Test connection
            await self.redis_client.ping()
            self.connected = True
            logger.info(f"Redis connected: {REDIS_URL}")
            return True
        except Exception as e:
            if _is_localhost:
                logger.info(f"Local Redis unavailable ({type(e).__name__}); using in-memory fallback")
            else:
                logger.warning(f"Redis connection failed: {e}. Using in-memory fallback.")
            self.connected = False
            return False
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            self.connected = False
    
    def _get_ttl(self, cache_type: str) -> int:
        """Get TTL for cache type"""
        return CACHE_TTL.get(cache_type, CACHE_TTL['default'])
    
    def _make_key(self, prefix: str, *args) -> str:
        """Create cache key from prefix and args"""
        key_parts = [prefix] + [str(arg) for arg in args if arg]
        return ':'.join(key_parts)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.connected and self.redis_client:
                data = await self.redis_client.get(key)
                if data:
                    return json.loads(data)
            else:
                # Fallback to memory cache
                import time
                if key in self._memory_cache:
                    if time.time() - self._memory_timestamps.get(key, 0) < 60:
                        return self._memory_cache[key]
                    else:
                        # Expired
                        del self._memory_cache[key]
                        del self._memory_timestamps[key]
        except Exception as e:
            logger.error(f"Cache get error: {e}")
        return None
    
    async def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        """Set value in cache with TTL"""
        try:
            if self.connected and self.redis_client:
                await self.redis_client.setex(key, ttl, json.dumps(value, default=str))
                return True
            else:
                # Fallback to memory cache
                import time
                self._memory_cache[key] = value
                self._memory_timestamps[key] = time.time()
                return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
        return False
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache"""
        try:
            if self.connected and self.redis_client:
                await self.redis_client.delete(key)
            else:
                self._memory_cache.pop(key, None)
                self._memory_timestamps.pop(key, None)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
        return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        try:
            if self.connected and self.redis_client:
                keys = await self.redis_client.keys(pattern)
                if keys:
                    return await self.redis_client.delete(*keys)
            else:
                # Memory cache pattern matching
                import fnmatch
                deleted = 0
                keys_to_delete = [k for k in self._memory_cache.keys() if fnmatch.fnmatch(k, pattern)]
                for k in keys_to_delete:
                    del self._memory_cache[k]
                    self._memory_timestamps.pop(k, None)
                    deleted += 1
                return deleted
        except Exception as e:
            logger.error(f"Cache delete pattern error: {e}")
        return 0
    
    async def clear_all(self) -> bool:
        """Clear all cache"""
        try:
            if self.connected and self.redis_client:
                await self.redis_client.flushdb()
            else:
                self._memory_cache.clear()
                self._memory_timestamps.clear()
            return True
        except Exception as e:
            logger.error(f"Cache clear error: {e}")
        return False
    
    async def get_stats(self) -> dict:
        """Get cache statistics"""
        try:
            if self.connected and self.redis_client:
                info = await self.redis_client.info('memory')
                keys_count = await self.redis_client.dbsize()
                return {
                    'type': 'redis',
                    'connected': True,
                    'keys_count': keys_count,
                    'memory_used': info.get('used_memory_human', 'N/A'),
                    'memory_peak': info.get('used_memory_peak_human', 'N/A'),
                }
            else:
                return {
                    'type': 'memory',
                    'connected': False,
                    'keys_count': len(self._memory_cache),
                    'memory_used': 'N/A',
                }
        except Exception as e:
            return {'type': 'error', 'error': str(e)}


# Global cache instance
cache = RedisCache()


# ============== CACHE DECORATORS ==============

def cached(cache_type: str = 'default', key_prefix: str = None):
    """
    Decorator for caching async function results
    
    Usage:
        @cached('albums', 'album_list')
        async def get_albums():
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Build cache key
            prefix = key_prefix or func.__name__
            cache_key = cache._make_key(prefix, *args, *kwargs.values())
            
            # Try to get from cache
            cached_result = await cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            ttl = cache._get_ttl(cache_type)
            await cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


# ============== CACHE INVALIDATION HELPERS ==============

async def invalidate_home_cache():
    """Invalidate home page cache"""
    await cache.delete_pattern('home:*')
    await cache.delete_pattern('user_home:*')

async def invalidate_albums_cache(album_id: str = None):
    """Invalidate albums cache"""
    if album_id:
        await cache.delete(f'album:{album_id}')
        await cache.delete(f'album_detail:{album_id}')
    await cache.delete_pattern('albums:*')
    await cache.delete_pattern('album_list:*')

async def invalidate_layout_cache():
    """Invalidate layout cache"""
    await cache.delete_pattern('layout:*')
    await cache.delete_pattern('sections:*')

async def invalidate_user_cache(user_id: str):
    """Invalidate user-specific cache"""
    await cache.delete_pattern(f'user:{user_id}:*')
    await cache.delete_pattern(f'library:{user_id}:*')
