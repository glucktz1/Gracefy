"""
Rate Limiting Middleware for Gracefy API
=========================================
Protects API endpoints from abuse and DoS attacks.
Uses in-memory storage with Redis fallback.
"""

import time
import asyncio
from collections import defaultdict
from typing import Dict, Tuple, Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket rate limiter with configurable limits per endpoint type.
    """
    
    def __init__(self):
        # Store: {client_key: (tokens, last_update)}
        self._buckets: Dict[str, Tuple[float, float]] = defaultdict(lambda: (0, 0))
        self._lock = asyncio.Lock()
        
        # Rate limit configurations (requests per minute)
        self.limits = {
            # Auth endpoints - stricter limits
            "auth": {"rpm": 20, "burst": 5},
            "login": {"rpm": 10, "burst": 3},
            "register": {"rpm": 5, "burst": 2},
            
            # Payment endpoints - moderate limits
            "payment": {"rpm": 30, "burst": 10},
            
            # Admin endpoints - relaxed for legitimate use
            "admin": {"rpm": 120, "burst": 30},
            
            # Content endpoints - generous limits
            "content": {"rpm": 200, "burst": 50},
            
            # Upload endpoints - strict due to resource usage
            "upload": {"rpm": 20, "burst": 5},
            
            # Default for other endpoints
            "default": {"rpm": 100, "burst": 25},
        }
        
        # Whitelist IPs (internal services)
        self.whitelist = {
            "127.0.0.1",
            "localhost",
        }
    
    def _get_endpoint_type(self, path: str) -> str:
        """Determine endpoint type from path for rate limiting."""
        path_lower = path.lower()
        
        if "/auth/login" in path_lower or "/users/login" in path_lower:
            return "login"
        elif "/auth/register" in path_lower:
            return "register"
        elif "/auth/" in path_lower:
            return "auth"
        elif "/payment/" in path_lower:
            return "payment"
        elif "/admin/" in path_lower:
            return "admin"
        elif "/upload/" in path_lower or "/files/" in path_lower:
            return "upload"
        elif any(x in path_lower for x in ["/songs/", "/albums/", "/home/", "/radio/"]):
            return "content"
        else:
            return "default"
    
    def _get_client_key(self, request: Request) -> str:
        """Get unique client identifier."""
        # Try to get real IP from forwarded headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        # Include user agent for better identification
        user_agent = request.headers.get("User-Agent", "")[:50]
        
        return f"{client_ip}:{hash(user_agent) % 10000}"
    
    async def check_rate_limit(self, request: Request) -> Tuple[bool, dict]:
        """
        Check if request should be rate limited.
        Returns (is_allowed, headers_dict)
        """
        client_key = self._get_client_key(request)
        client_ip = client_key.split(":")[0]
        
        # Skip whitelist
        if client_ip in self.whitelist:
            return True, {}
        
        endpoint_type = self._get_endpoint_type(request.url.path)
        config = self.limits.get(endpoint_type, self.limits["default"])
        
        rpm = config["rpm"]
        burst = config["burst"]
        
        # Token bucket algorithm
        bucket_key = f"{client_key}:{endpoint_type}"
        current_time = time.time()
        
        async with self._lock:
            tokens, last_update = self._buckets[bucket_key]
            
            # Refill tokens based on time passed
            time_passed = current_time - last_update
            tokens_to_add = time_passed * (rpm / 60)  # tokens per second
            tokens = min(burst, tokens + tokens_to_add)
            
            # Check if we have tokens available
            if tokens >= 1:
                tokens -= 1
                self._buckets[bucket_key] = (tokens, current_time)
                
                headers = {
                    "X-RateLimit-Limit": str(rpm),
                    "X-RateLimit-Remaining": str(int(tokens)),
                    "X-RateLimit-Reset": str(int(current_time + 60)),
                }
                return True, headers
            else:
                # Calculate retry time
                retry_after = int((1 - tokens) / (rpm / 60)) + 1
                
                headers = {
                    "X-RateLimit-Limit": str(rpm),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(current_time + retry_after)),
                    "Retry-After": str(retry_after),
                }
                
                logger.warning(
                    f"Rate limit exceeded for {client_key} on {endpoint_type} endpoint"
                )
                return False, headers
    
    async def cleanup_old_buckets(self):
        """Remove old bucket entries to prevent memory growth."""
        current_time = time.time()
        cutoff = current_time - 3600  # Remove entries older than 1 hour
        
        async with self._lock:
            keys_to_remove = [
                key for key, (_, last_update) in self._buckets.items()
                if last_update < cutoff
            ]
            for key in keys_to_remove:
                del self._buckets[key]
        
        logger.info(f"Cleaned up {len(keys_to_remove)} old rate limit buckets")


# Global rate limiter instance
rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and docs
        path = request.url.path
        if path in ["/", "/api", "/api/health", "/api/docs", "/api/redoc", "/api/openapi.json"]:
            return await call_next(request)
        
        # Check rate limit
        is_allowed, headers = await rate_limiter.check_rate_limit(request)
        
        if not is_allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": "Rate limit exceeded. Please slow down.",
                    "retry_after": headers.get("Retry-After", "60")
                },
                headers=headers
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to response
        for key, value in headers.items():
            response.headers[key] = value
        
        return response


# Cleanup task
async def rate_limit_cleanup_task():
    """Periodic cleanup of old rate limit buckets."""
    while True:
        await asyncio.sleep(3600)  # Run every hour
        try:
            await rate_limiter.cleanup_old_buckets()
        except Exception as e:
            logger.error(f"Rate limit cleanup error: {e}")
