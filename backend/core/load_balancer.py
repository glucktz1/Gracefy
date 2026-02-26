"""
Load Balancer Configuration for Gracefy.
Provides health checks, readiness probes, and load balancer support.
"""

import os
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    """Health check status."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


@dataclass
class ServiceHealth:
    """Health information for a service."""
    name: str
    status: HealthStatus
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    last_check: Optional[str] = None


class HealthChecker:
    """
    Comprehensive health checker for load balancer integration.
    Provides Kubernetes-compatible health endpoints.
    """
    
    def __init__(self):
        self._checks: Dict[str, callable] = {}
        self._last_results: Dict[str, ServiceHealth] = {}
        self._instance_id = os.environ.get('HOSTNAME', os.environ.get('POD_NAME', 'unknown'))
    
    def register_check(self, name: str, check_func: callable):
        """Register a health check function."""
        self._checks[name] = check_func
    
    async def check_service(self, name: str) -> ServiceHealth:
        """Run a single health check."""
        check_func = self._checks.get(name)
        if not check_func:
            return ServiceHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                error="Check not found"
            )
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            if asyncio.iscoroutinefunction(check_func):
                result = await asyncio.wait_for(check_func(), timeout=5.0)
            else:
                result = check_func()
            
            latency = (asyncio.get_event_loop().time() - start_time) * 1000
            
            health = ServiceHealth(
                name=name,
                status=HealthStatus.HEALTHY if result else HealthStatus.UNHEALTHY,
                latency_ms=round(latency, 2),
                last_check=datetime.now(timezone.utc).isoformat()
            )
            
        except asyncio.TimeoutError:
            health = ServiceHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                error="Health check timeout",
                last_check=datetime.now(timezone.utc).isoformat()
            )
            
        except Exception as e:
            health = ServiceHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                error=str(e),
                last_check=datetime.now(timezone.utc).isoformat()
            )
        
        self._last_results[name] = health
        return health
    
    async def check_all(self) -> Dict[str, ServiceHealth]:
        """Run all health checks."""
        tasks = [self.check_service(name) for name in self._checks.keys()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        return {
            name: result if isinstance(result, ServiceHealth) else ServiceHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                error=str(result)
            )
            for name, result in zip(self._checks.keys(), results)
        }
    
    def get_overall_status(self) -> HealthStatus:
        """Get overall health status."""
        if not self._last_results:
            return HealthStatus.UNHEALTHY
        
        statuses = [h.status for h in self._last_results.values()]
        
        if all(s == HealthStatus.HEALTHY for s in statuses):
            return HealthStatus.HEALTHY
        elif any(s == HealthStatus.UNHEALTHY for s in statuses):
            # Check if critical services are unhealthy
            critical = ['mongodb', 'cache']
            critical_unhealthy = any(
                self._last_results.get(c, ServiceHealth(c, HealthStatus.UNHEALTHY)).status == HealthStatus.UNHEALTHY
                for c in critical if c in self._last_results
            )
            return HealthStatus.UNHEALTHY if critical_unhealthy else HealthStatus.DEGRADED
        else:
            return HealthStatus.DEGRADED
    
    async def liveness_check(self) -> dict:
        """
        Kubernetes liveness probe.
        Returns 200 if app is running, 503 if it should be restarted.
        """
        # Basic liveness - is the app responsive?
        return {
            "status": "alive",
            "instance_id": self._instance_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def readiness_check(self) -> dict:
        """
        Kubernetes readiness probe.
        Returns 200 if ready to receive traffic, 503 if not ready.
        """
        results = await self.check_all()
        overall = self.get_overall_status()
        
        return {
            "status": overall.value,
            "ready": overall in [HealthStatus.HEALTHY, HealthStatus.DEGRADED],
            "instance_id": self._instance_id,
            "checks": {
                name: {
                    "status": health.status.value,
                    "latency_ms": health.latency_ms,
                    "error": health.error
                }
                for name, health in results.items()
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def startup_check(self) -> dict:
        """
        Kubernetes startup probe.
        Returns 200 when app has finished starting up.
        """
        # Check if critical services are ready
        critical_checks = ['mongodb']
        
        for check_name in critical_checks:
            if check_name in self._checks:
                result = await self.check_service(check_name)
                if result.status == HealthStatus.UNHEALTHY:
                    return {
                        "status": "starting",
                        "ready": False,
                        "waiting_for": check_name,
                        "error": result.error
                    }
        
        return {
            "status": "started",
            "ready": True,
            "instance_id": self._instance_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


# Global health checker instance
health_checker = HealthChecker()


# ============== DEFAULT HEALTH CHECKS ==============

async def check_mongodb() -> bool:
    """Check MongoDB connection."""
    try:
        from core.database import get_db
        db = get_db()
        await db.command('ping')
        return True
    except Exception as e:
        logger.error(f"MongoDB health check failed: {e}")
        return False


async def check_redis() -> bool:
    """Check Redis connection."""
    try:
        from core.redis_cache import redis_cache
        if redis_cache._connected and redis_cache._redis:
            await redis_cache._redis.ping()
            return True
        # In-memory fallback is still healthy
        return True
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return True  # Fallback to memory cache is acceptable


async def check_rabbitmq() -> bool:
    """Check RabbitMQ connection."""
    try:
        from core.message_queue import message_queue
        return message_queue._connected
    except ImportError:
        return True  # Not configured, using fallback
    except Exception:
        return True  # Fallback queue is acceptable


def register_default_checks():
    """Register default health checks."""
    health_checker.register_check('mongodb', check_mongodb)
    health_checker.register_check('cache', check_redis)
    health_checker.register_check('queue', check_rabbitmq)


# ============== LOAD BALANCER METADATA ==============

class LoadBalancerInfo:
    """Provides load balancer metadata and configuration."""
    
    def __init__(self):
        self.instance_id = os.environ.get('HOSTNAME', os.environ.get('POD_NAME', 'local'))
        self.pod_ip = os.environ.get('POD_IP', '127.0.0.1')
        self.node_name = os.environ.get('NODE_NAME', 'unknown')
        self.namespace = os.environ.get('POD_NAMESPACE', 'default')
        self.service_name = os.environ.get('SERVICE_NAME', 'gracefy-api')
        
        # Load balancer headers
        self.lb_headers = {
            'X-Instance-ID': self.instance_id,
            'X-Pod-IP': self.pod_ip,
            'X-Node-Name': self.node_name,
        }
    
    def get_info(self) -> dict:
        """Get load balancer information."""
        return {
            "instance_id": self.instance_id,
            "pod_ip": self.pod_ip,
            "node_name": self.node_name,
            "namespace": self.namespace,
            "service_name": self.service_name,
        }
    
    def add_response_headers(self, response) -> None:
        """Add load balancer headers to response."""
        for key, value in self.lb_headers.items():
            response.headers[key] = value


# Global load balancer info
lb_info = LoadBalancerInfo()


# ============== GRACEFUL SHUTDOWN ==============

class GracefulShutdown:
    """Handles graceful shutdown for load balancer draining."""
    
    def __init__(self):
        self._shutting_down = False
        self._active_requests = 0
        self._shutdown_timeout = int(os.environ.get('SHUTDOWN_TIMEOUT', '30'))
    
    @property
    def is_shutting_down(self) -> bool:
        return self._shutting_down
    
    def start_shutdown(self):
        """Signal start of shutdown."""
        self._shutting_down = True
        logger.info("Graceful shutdown initiated")
    
    def request_started(self):
        """Track request start."""
        self._active_requests += 1
    
    def request_finished(self):
        """Track request completion."""
        self._active_requests = max(0, self._active_requests - 1)
    
    async def wait_for_requests(self) -> bool:
        """Wait for active requests to complete."""
        start = asyncio.get_event_loop().time()
        
        while self._active_requests > 0:
            elapsed = asyncio.get_event_loop().time() - start
            if elapsed > self._shutdown_timeout:
                logger.warning(f"Shutdown timeout: {self._active_requests} requests still active")
                return False
            
            logger.info(f"Waiting for {self._active_requests} requests to complete...")
            await asyncio.sleep(1)
        
        logger.info("All requests completed, shutting down")
        return True
    
    def get_status(self) -> dict:
        return {
            "shutting_down": self._shutting_down,
            "active_requests": self._active_requests,
            "shutdown_timeout": self._shutdown_timeout,
        }


# Global graceful shutdown handler
graceful_shutdown = GracefulShutdown()
