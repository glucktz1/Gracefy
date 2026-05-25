"""
In-memory caching service for Gracefy.
Provides fast caching with TTL support and LRU eviction.
"""

import time
import logging
import asyncio
from typing import Any, Optional, Dict
from collections import OrderedDict
from functools import wraps

logger = logging.getLogger(__name__)

# Cache TTL defaults (in seconds)
CACHE_TTL = {
    'home': 60,           # Home page - 1 minute
    'albums': 120,        # Albums list - 2 minutes  
    'album_detail': 300,  # Album detail - 5 minutes
    'songs': 120,         # Songs list - 2 minutes
    'categories': 600,    # Categories - 10 minutes
    'churches': 300,      # Churches - 5 minutes
    'choirs': 300,        # Choirs - 5 minutes
    'layout': 120,        # Layout sections - 2 minutes
    'settings': 300,      # System settings - 5 minutes
    'user_library': 60,   # User library - 1 minute
    'search': 30,         # Search results - 30 seconds
    'bible': 3600,        # Bible content - 1 hour
    'default': 60,        # Default TTL
}

# Maximum cache entries (LRU eviction when exceeded)
MAX_CACHE_ENTRIES = int(__import__('os').environ.get('MAX_CACHE_ENTRIES', '10000'))


class InMemoryCache:
    """
    Thread-safe in-memory cache with TTL and LRU eviction.
    Optimized for high-traffic scenarios.
    """
    
    def __init__(self, max_size: int = MAX_CACHE_ENTRIES):
        self._cache: OrderedDict[str, Dict] = OrderedDict()
        self._max_size = max_size
        self._lock = asyncio.Lock()
        self._stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
        }
    
    def _get_ttl(self, cache_type: str) -> int:
        """Get TTL for cache type."""
        return CACHE_TTL.get(cache_type, CACHE_TTL['default'])
    
    def _make_key(self, prefix: str, *args, **kwargs) -> str:
        """Create cache key from prefix and args."""
        key_parts = [prefix]
        key_parts.extend(str(arg) for arg in args if arg is not None)
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()) if v is not None)
        return ':'.join(key_parts)
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        async with self._lock:
            if key not in self._cache:
                self._stats['misses'] += 1
                return None
            
            entry = self._cache[key]
            
            # Check if expired
            if time.time() > entry['expires_at']:
                del self._cache[key]
                self._stats['misses'] += 1
                return None
            
            # Move to end (LRU)
            self._cache.move_to_end(key)
            self._stats['hits'] += 1
            
            return entry['value']
    
    async def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        """Set value in cache with TTL."""
        async with self._lock:
            # Evict oldest entries if at capacity
            while len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)
                self._stats['evictions'] += 1
            
            self._cache[key] = {
                'value': value,
                'expires_at': time.time() + ttl,
                'created_at': time.time(),
            }
            
            return True
    
    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern (supports * wildcard)."""
        import fnmatch
        
        async with self._lock:
            keys_to_delete = [
                k for k in self._cache.keys() 
                if fnmatch.fnmatch(k, pattern)
            ]
            
            for key in keys_to_delete:
                del self._cache[key]
            
            return len(keys_to_delete)
    
    async def clear_all(self) -> bool:
        """Clear all cache entries."""
        async with self._lock:
            self._cache.clear()
            return True
    
    async def get_stats(self) -> dict:
        """Get cache statistics."""
        async with self._lock:
            total_requests = self._stats['hits'] + self._stats['misses']
            hit_rate = (self._stats['hits'] / total_requests * 100) if total_requests > 0 else 0
            
            return {
                'type': 'memory',
                'entries': len(self._cache),
                'max_size': self._max_size,
                'hits': self._stats['hits'],
                'misses': self._stats['misses'],
                'hit_rate': f"{hit_rate:.1f}%",
                'evictions': self._stats['evictions'],
            }
    
    async def cleanup_expired(self) -> int:
        """Remove expired entries. Call periodically."""
        async with self._lock:
            now = time.time()
            expired_keys = [
                k for k, v in self._cache.items()
                if now > v['expires_at']
            ]
            
            for key in expired_keys:
                del self._cache[key]
            
            return len(expired_keys)


# Global cache instance
cache = InMemoryCache()


# ============== CACHE DECORATORS ==============

def cached(cache_type: str = 'default', key_prefix: str = None):
    """
    Decorator for caching async function results.
    
    Usage:
        @cached('albums', 'album_list')
        async def get_albums(category_id: str = None):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key
            prefix = key_prefix or func.__name__
            cache_key = cache._make_key(prefix, *args, **kwargs)
            
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
    """Invalidate home page cache."""
    await cache.delete_pattern('home:*')
    await cache.delete_pattern('user_home:*')


async def invalidate_albums_cache(album_id: str = None):
    """Invalidate albums cache."""
    if album_id:
        await cache.delete(f'album:{album_id}')
        await cache.delete(f'album_detail:{album_id}')
    await cache.delete_pattern('albums:*')
    await cache.delete_pattern('album_list:*')
    await cache.delete_pattern('admin:albums:*')


async def invalidate_songs_cache(song_id: str = None):
    """Invalidate songs cache."""
    if song_id:
        await cache.delete(f'song:{song_id}')
    await cache.delete_pattern('songs:*')
    await cache.delete_pattern('admin:cdn:*')  # CDN stats depend on song audio_url


async def invalidate_layout_cache():
    """Invalidate layout cache."""
    await cache.delete_pattern('layout:*')
    await cache.delete_pattern('sections:*')


async def invalidate_user_cache(user_id: str):
    """Invalidate user-specific cache."""
    await cache.delete_pattern(f'user:{user_id}:*')
    await cache.delete_pattern(f'library:{user_id}:*')


# ============== BACKGROUND CLEANUP ==============

async def periodic_cache_cleanup(interval_seconds: int = 300):
    """
    Background task to clean up expired cache entries.
    Run this in a background task on startup.
    """
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            cleaned = await cache.cleanup_expired()
            if cleaned > 0:
                logger.debug(f"Cleaned {cleaned} expired cache entries")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cache cleanup error: {e}")
