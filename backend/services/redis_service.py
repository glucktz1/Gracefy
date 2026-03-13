"""
Redis Service for Caching and Session Management
Uses Upstash Redis (serverless)
"""
import os
import json
from typing import Optional, Any
from datetime import timedelta
from upstash_redis import Redis

# Initialize Redis client
_redis_client = None

def get_redis() -> Optional[Redis]:
    """Get Redis client instance"""
    global _redis_client
    
    if _redis_client is None:
        url = os.environ.get('UPSTASH_REDIS_REST_URL')
        token = os.environ.get('UPSTASH_REDIS_REST_TOKEN')
        
        if url and token:
            try:
                _redis_client = Redis(url=url, token=token)
                print("[Redis] Connected to Upstash Redis")
            except Exception as e:
                print(f"[Redis] Connection failed: {e}")
                return None
        else:
            print("[Redis] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN")
            return None
    
    return _redis_client


# ============== CACHING UTILITIES ==============

async def cache_get(key: str) -> Optional[Any]:
    """Get value from cache"""
    redis = get_redis()
    if not redis:
        return None
    
    try:
        value = redis.get(key)
        if value:
            return json.loads(value) if isinstance(value, str) else value
        return None
    except Exception as e:
        print(f"[Redis] Cache get error: {e}")
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> bool:
    """Set value in cache with TTL"""
    redis = get_redis()
    if not redis:
        return False
    
    try:
        serialized = json.dumps(value) if not isinstance(value, str) else value
        redis.set(key, serialized, ex=ttl_seconds)
        return True
    except Exception as e:
        print(f"[Redis] Cache set error: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """Delete value from cache"""
    redis = get_redis()
    if not redis:
        return False
    
    try:
        redis.delete(key)
        return True
    except Exception as e:
        print(f"[Redis] Cache delete error: {e}")
        return False


async def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching pattern"""
    redis = get_redis()
    if not redis:
        return 0
    
    try:
        keys = redis.keys(pattern)
        if keys:
            for key in keys:
                redis.delete(key)
            return len(keys)
        return 0
    except Exception as e:
        print(f"[Redis] Cache delete pattern error: {e}")
        return 0


# ============== BILLING STATUS CACHE ==============

BILLING_CACHE_KEY = "billing:status"
BILLING_CACHE_TTL = 10  # 10 seconds - fast refresh for billing changes

async def get_cached_billing_status() -> Optional[dict]:
    """Get cached billing status"""
    return await cache_get(BILLING_CACHE_KEY)


async def set_cached_billing_status(status: dict) -> bool:
    """Cache billing status"""
    return await cache_set(BILLING_CACHE_KEY, status, BILLING_CACHE_TTL)


async def invalidate_billing_cache() -> bool:
    """Invalidate billing cache (call when admin changes billing)"""
    return await cache_delete(BILLING_CACHE_KEY)


# ============== LIVE LISTENERS CACHE ==============

LIVE_LISTENERS_KEY = "live:listeners"
LIVE_LISTENERS_TTL = 5  # 5 seconds

async def get_cached_live_listeners() -> Optional[dict]:
    """Get cached live listeners count"""
    return await cache_get(LIVE_LISTENERS_KEY)


async def set_cached_live_listeners(data: dict) -> bool:
    """Cache live listeners data"""
    return await cache_set(LIVE_LISTENERS_KEY, data, LIVE_LISTENERS_TTL)


# ============== USER SESSION CACHE ==============

def get_user_session_key(user_id: str) -> str:
    return f"session:{user_id}"

async def get_user_session(user_id: str) -> Optional[dict]:
    """Get user session from cache"""
    return await cache_get(get_user_session_key(user_id))


async def set_user_session(user_id: str, session_data: dict, ttl_seconds: int = 3600) -> bool:
    """Cache user session (1 hour default)"""
    return await cache_set(get_user_session_key(user_id), session_data, ttl_seconds)


async def invalidate_user_session(user_id: str) -> bool:
    """Invalidate user session"""
    return await cache_delete(get_user_session_key(user_id))


# ============== RATE LIMITING ==============

async def check_rate_limit(identifier: str, limit: int = 100, window_seconds: int = 60) -> dict:
    """
    Check rate limit for an identifier (IP, user_id, etc.)
    Returns: {"allowed": bool, "remaining": int, "reset_in": int}
    """
    redis = get_redis()
    if not redis:
        # If Redis unavailable, allow request
        return {"allowed": True, "remaining": limit, "reset_in": 0}
    
    key = f"ratelimit:{identifier}"
    
    try:
        current = redis.get(key)
        
        if current is None:
            # First request in window
            redis.set(key, "1", ex=window_seconds)
            return {"allowed": True, "remaining": limit - 1, "reset_in": window_seconds}
        
        current_count = int(current)
        
        if current_count >= limit:
            # Get TTL for reset time
            ttl = redis.ttl(key)
            return {"allowed": False, "remaining": 0, "reset_in": ttl or window_seconds}
        
        # Increment counter
        new_count = redis.incr(key)
        ttl = redis.ttl(key)
        
        return {
            "allowed": True,
            "remaining": max(0, limit - new_count),
            "reset_in": ttl or window_seconds
        }
    except Exception as e:
        print(f"[Redis] Rate limit check error: {e}")
        return {"allowed": True, "remaining": limit, "reset_in": 0}


# ============== DEVICE TRACKING CACHE ==============

def get_device_key(device_id: str) -> str:
    return f"device:{device_id}"

async def get_device_info(device_id: str) -> Optional[dict]:
    """Get cached device info"""
    return await cache_get(get_device_key(device_id))


async def set_device_info(device_id: str, info: dict) -> bool:
    """Cache device info (24 hours)"""
    return await cache_set(get_device_key(device_id), info, 86400)


# ============== ANALYTICS CACHE ==============

async def get_cached_analytics(key: str) -> Optional[dict]:
    """Get cached analytics data"""
    return await cache_get(f"analytics:{key}")


async def set_cached_analytics(key: str, data: dict, ttl_seconds: int = 60) -> bool:
    """Cache analytics data"""
    return await cache_set(f"analytics:{key}", data, ttl_seconds)


# ============== HOME PAGE CACHE ==============

HOME_CACHE_KEY_PREFIX = "home"
HOME_CACHE_TTL = 180  # 3 minutes - good balance between freshness and performance

async def get_cached_home_data(platform: str = "app") -> Optional[dict]:
    """Get cached home page data"""
    key = f"{HOME_CACHE_KEY_PREFIX}:{platform}:v1"
    return await cache_get(key)


async def set_cached_home_data(platform: str, data: dict) -> bool:
    """Cache home page data"""
    key = f"{HOME_CACHE_KEY_PREFIX}:{platform}:v1"
    return await cache_set(key, data, HOME_CACHE_TTL)


async def invalidate_home_cache(platform: str = None) -> int:
    """Invalidate home cache (call when content is updated)"""
    if platform:
        return 1 if await cache_delete(f"{HOME_CACHE_KEY_PREFIX}:{platform}:v1") else 0
    else:
        # Invalidate all platforms
        count = 0
        for p in ["app", "web"]:
            if await cache_delete(f"{HOME_CACHE_KEY_PREFIX}:{p}:v1"):
                count += 1
        return count


# ============== HEALTH CHECK ==============

async def redis_health_check() -> dict:
    """Check Redis connection health"""
    redis = get_redis()
    if not redis:
        return {"status": "disconnected", "error": "No Redis client"}
    
    try:
        # Simple ping
        redis.set("health:check", "ok", ex=10)
        value = redis.get("health:check")
        
        if value == "ok":
            return {"status": "connected", "provider": "Upstash"}
        else:
            return {"status": "error", "error": "Ping failed"}
    except Exception as e:
        return {"status": "error", "error": str(e)}
