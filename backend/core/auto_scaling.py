"""
Auto-scaling and traffic management for Gracefy.
Automatically detects traffic patterns and adjusts:
- Cache TTL (higher during peak traffic)
- Worker utilization monitoring
- Rate limiting adjustments
"""

import time
import asyncio
import logging
from collections import deque
from typing import Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

@dataclass
class TrafficStats:
    """Real-time traffic statistics."""
    requests_per_second: float = 0.0
    requests_per_minute: float = 0.0
    avg_response_time_ms: float = 0.0
    active_connections: int = 0
    peak_rps_today: float = 0.0
    traffic_level: str = "low"  # low, medium, high, critical
    last_updated: str = ""


class TrafficMonitor:
    """
    Monitors traffic in real-time and provides scaling recommendations.
    """
    
    # Traffic level thresholds (requests per second)
    TRAFFIC_THRESHOLDS = {
        'low': 50,       # < 50 req/s
        'medium': 150,   # 50-150 req/s
        'high': 300,     # 150-300 req/s
        'critical': 500  # > 300 req/s
    }
    
    # Cache TTL multipliers based on traffic level
    CACHE_TTL_MULTIPLIERS = {
        'low': 1.0,      # Normal TTL
        'medium': 1.5,   # 50% longer cache
        'high': 2.5,     # 150% longer cache
        'critical': 4.0  # 300% longer cache (aggressive caching)
    }
    
    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        self.request_times: deque = deque(maxlen=10000)
        self.response_times: deque = deque(maxlen=1000)
        self.active_requests = 0
        self.peak_rps_today = 0.0
        self.last_peak_reset = datetime.now(timezone.utc).date()
        self._lock = asyncio.Lock()
        
        # Current traffic state
        self.current_level = "low"
        self.current_multiplier = 1.0
        
    async def record_request(self, response_time_ms: float = 0):
        """Record a request and its response time."""
        async with self._lock:
            now = time.time()
            self.request_times.append(now)
            
            if response_time_ms > 0:
                self.response_times.append(response_time_ms)
            
            # Clean old entries
            cutoff = now - self.window_seconds
            while self.request_times and self.request_times[0] < cutoff:
                self.request_times.popleft()
    
    async def increment_active(self):
        """Increment active request counter."""
        async with self._lock:
            self.active_requests += 1
    
    async def decrement_active(self):
        """Decrement active request counter."""
        async with self._lock:
            self.active_requests = max(0, self.active_requests - 1)
    
    def _calculate_rps(self) -> float:
        """Calculate current requests per second."""
        if not self.request_times:
            return 0.0
        
        now = time.time()
        cutoff = now - min(10, self.window_seconds)  # Use last 10 seconds for RPS
        recent = [t for t in self.request_times if t > cutoff]
        
        if len(recent) < 2:
            return 0.0
        
        time_span = now - recent[0]
        if time_span <= 0:
            return 0.0
        
        return len(recent) / time_span
    
    def _determine_traffic_level(self, rps: float) -> str:
        """Determine traffic level based on RPS."""
        if rps >= self.TRAFFIC_THRESHOLDS['critical']:
            return 'critical'
        elif rps >= self.TRAFFIC_THRESHOLDS['high']:
            return 'high'
        elif rps >= self.TRAFFIC_THRESHOLDS['medium']:
            return 'medium'
        else:
            return 'low'
    
    async def get_stats(self) -> TrafficStats:
        """Get current traffic statistics."""
        async with self._lock:
            rps = self._calculate_rps()
            rpm = len(self.request_times)
            
            # Update peak RPS
            today = datetime.now(timezone.utc).date()
            if today != self.last_peak_reset:
                self.peak_rps_today = 0.0
                self.last_peak_reset = today
            
            if rps > self.peak_rps_today:
                self.peak_rps_today = rps
            
            # Calculate average response time
            avg_response = 0.0
            if self.response_times:
                avg_response = sum(self.response_times) / len(self.response_times)
            
            # Determine traffic level
            level = self._determine_traffic_level(rps)
            self.current_level = level
            self.current_multiplier = self.CACHE_TTL_MULTIPLIERS[level]
            
            return TrafficStats(
                requests_per_second=round(rps, 2),
                requests_per_minute=rpm,
                avg_response_time_ms=round(avg_response, 2),
                active_connections=self.active_requests,
                peak_rps_today=round(self.peak_rps_today, 2),
                traffic_level=level,
                last_updated=datetime.now(timezone.utc).isoformat()
            )
    
    def get_cache_ttl_multiplier(self) -> float:
        """Get current cache TTL multiplier based on traffic."""
        return self.current_multiplier
    
    def get_traffic_level(self) -> str:
        """Get current traffic level."""
        return self.current_level


class AdaptiveCache:
    """
    Cache with adaptive TTL based on traffic levels.
    Higher traffic = longer cache times to reduce DB load.
    """
    
    # Base TTL values (in seconds)
    BASE_TTL = {
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
    
    def __init__(self, traffic_monitor: TrafficMonitor):
        self.traffic_monitor = traffic_monitor
        self._cache: Dict[str, dict] = {}
        self._max_entries = 15000  # Increased for high traffic
        self._lock = asyncio.Lock()
        self._stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'adaptive_extensions': 0,
        }
    
    def _get_adaptive_ttl(self, cache_type: str) -> int:
        """Get TTL adjusted for current traffic level."""
        base_ttl = self.BASE_TTL.get(cache_type, self.BASE_TTL['default'])
        multiplier = self.traffic_monitor.get_cache_ttl_multiplier()
        
        # Track when we extend TTL
        if multiplier > 1.0:
            self._stats['adaptive_extensions'] += 1
        
        return int(base_ttl * multiplier)
    
    async def get(self, key: str) -> Optional[any]:
        """Get value from cache."""
        async with self._lock:
            if key not in self._cache:
                self._stats['misses'] += 1
                return None
            
            entry = self._cache[key]
            
            # Check expiration
            if time.time() > entry['expires_at']:
                del self._cache[key]
                self._stats['misses'] += 1
                return None
            
            self._stats['hits'] += 1
            return entry['value']
    
    async def set(self, key: str, value: any, cache_type: str = 'default') -> bool:
        """Set value with adaptive TTL."""
        async with self._lock:
            # Evict if at capacity
            while len(self._cache) >= self._max_entries:
                # Remove oldest entry
                oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k]['created_at'])
                del self._cache[oldest_key]
                self._stats['evictions'] += 1
            
            ttl = self._get_adaptive_ttl(cache_type)
            
            self._cache[key] = {
                'value': value,
                'expires_at': time.time() + ttl,
                'created_at': time.time(),
                'cache_type': cache_type,
                'ttl_used': ttl,
            }
            
            return True
    
    async def delete(self, key: str) -> bool:
        """Delete from cache."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern."""
        import fnmatch
        
        async with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if fnmatch.fnmatch(k, pattern)]
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
            total = self._stats['hits'] + self._stats['misses']
            hit_rate = (self._stats['hits'] / total * 100) if total > 0 else 0
            
            traffic_level = self.traffic_monitor.get_traffic_level()
            multiplier = self.traffic_monitor.get_cache_ttl_multiplier()
            
            return {
                'type': 'adaptive_memory',
                'entries': len(self._cache),
                'max_entries': self._max_entries,
                'hits': self._stats['hits'],
                'misses': self._stats['misses'],
                'hit_rate': f"{hit_rate:.1f}%",
                'evictions': self._stats['evictions'],
                'adaptive_extensions': self._stats['adaptive_extensions'],
                'current_traffic_level': traffic_level,
                'current_ttl_multiplier': f"{multiplier}x",
                'effective_ttls': {
                    k: int(v * multiplier) for k, v in self.BASE_TTL.items()
                }
            }
    
    async def cleanup_expired(self) -> int:
        """Remove expired entries."""
        async with self._lock:
            now = time.time()
            expired = [k for k, v in self._cache.items() if now > v['expires_at']]
            for key in expired:
                del self._cache[key]
            return len(expired)


# Global instances
traffic_monitor = TrafficMonitor(window_seconds=60)
adaptive_cache = AdaptiveCache(traffic_monitor)


# ============== MIDDLEWARE FOR TRAFFIC TRACKING ==============

class TrafficTrackingMiddleware:
    """
    Middleware that tracks all requests for traffic monitoring.
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        await traffic_monitor.increment_active()
        
        try:
            await self.app(scope, receive, send)
        finally:
            response_time = (time.time() - start_time) * 1000
            await traffic_monitor.record_request(response_time)
            await traffic_monitor.decrement_active()


# ============== BACKGROUND TASKS ==============

async def traffic_monitoring_task(interval: int = 30):
    """
    Background task that logs traffic stats and adjusts settings.
    """
    while True:
        try:
            await asyncio.sleep(interval)
            stats = await traffic_monitor.get_stats()
            
            # Log traffic level changes
            if stats.traffic_level in ['high', 'critical']:
                logger.warning(
                    f"⚠️ HIGH TRAFFIC: {stats.requests_per_second} req/s, "
                    f"Level: {stats.traffic_level}, "
                    f"Cache TTL multiplier: {traffic_monitor.get_cache_ttl_multiplier()}x"
                )
            elif stats.requests_per_second > 0:
                logger.info(
                    f"📊 Traffic: {stats.requests_per_second} req/s, "
                    f"Level: {stats.traffic_level}"
                )
            
            # Cleanup expired cache entries
            cleaned = await adaptive_cache.cleanup_expired()
            if cleaned > 0:
                logger.debug(f"🧹 Cleaned {cleaned} expired cache entries")
                
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Traffic monitoring error: {e}")


async def auto_scaling_recommendations():
    """
    Get auto-scaling recommendations based on current traffic.
    """
    stats = await traffic_monitor.get_stats()
    cache_stats = await adaptive_cache.get_stats()
    
    recommendations = []
    
    if stats.traffic_level == 'critical':
        recommendations.append({
            'priority': 'HIGH',
            'action': 'Add more Uvicorn workers or scale horizontally',
            'reason': f'Traffic at {stats.requests_per_second} req/s exceeds safe limits'
        })
    
    if stats.avg_response_time_ms > 500:
        recommendations.append({
            'priority': 'MEDIUM', 
            'action': 'Optimize slow endpoints or add database indexes',
            'reason': f'Average response time {stats.avg_response_time_ms}ms is high'
        })
    
    if cache_stats['hit_rate'].replace('%', '') and float(cache_stats['hit_rate'].replace('%', '')) < 50:
        recommendations.append({
            'priority': 'LOW',
            'action': 'Review cache keys and TTL settings',
            'reason': f'Cache hit rate {cache_stats["hit_rate"]} is below optimal'
        })
    
    return {
        'traffic_stats': stats.__dict__,
        'cache_stats': cache_stats,
        'recommendations': recommendations,
        'auto_scaling_active': True,
        'current_adaptations': {
            'cache_ttl_multiplier': traffic_monitor.get_cache_ttl_multiplier(),
            'traffic_level': stats.traffic_level
        }
    }
