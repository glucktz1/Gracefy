"""
Gracefy API Server - Clean Application Factory
===============================================
Christian Music Streaming Platform API
Auto-Scaling Enabled with Redis Cache

This file is the main entry point that assembles all modular routers,
middleware, and handles application lifecycle events.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== IMPORTS ==============

# Core modules
from core.database import connect_db, disconnect_db, get_db
from core.cache import cache as app_cache, periodic_cache_cleanup
from core.redis_cache import redis_cache

# Auto-scaling
from core.auto_scaling import (
    traffic_monitor,
    TrafficTrackingMiddleware,
    traffic_monitoring_task,
)

# Rate limiting
from middleware.rate_limiter import RateLimitMiddleware, rate_limit_cleanup_task

# Import all modular routers
from routes import (
    auth_router,
    music_router,
    home_router,
    payment_router,
    layout_router,
    churches_router,
    choirs_router,
    bible_router,
    analytics_router,
    admin_router,
    uploads_router,
    user_library_router,
    content_router,
    monetization_router,
    categories_router,
    browse_router,
    cdn_management_router,
    feedback_router,
    chat_router,
    app_control_router,
    recommendations_router,
    radio_router,
)
from routes.teachings import router as teachings_router
from routes.rbac import router as rbac_router
from routes.advertising import router as advertising_router
from routes.leaders import router as leaders_router
from routes.branding import router as branding_router
from routes.legal import router as legal_router
from routes.firebase_auth import router as firebase_router
from routes.hls_admin import router as hls_admin_router
from routes.neno_la_leo import router as neno_la_leo_router
from routes.admin_cdn_browser import router as admin_cdn_browser_router
from routes.monetization_usage import router as monetization_usage_router

# Legacy cache service for backward compatibility
from cache_service import cache as legacy_cache

# ============== APPLICATION FACTORY ==============

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    app = FastAPI(
        title="Gracefy API",
        description="Christian Music Streaming Platform API - Auto-Scaling Enabled",
        version="3.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json"
    )
    
    # ============== MIDDLEWARE ==============
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # GZip compression
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Rate limiting (add before traffic tracking)
    app.add_middleware(RateLimitMiddleware)
    
    # Traffic tracking for auto-scaling
    app.add_middleware(TrafficTrackingMiddleware)
    
    # ============== INCLUDE ALL ROUTERS ==============
    
    # Each router is self-contained with its own endpoints
    # All routers already have /api prefix
    
    app.include_router(auth_router)           # /api/auth/*, /api/user/*
    app.include_router(music_router)          # /api/albums/*, /api/songs/*
    app.include_router(home_router)           # /api/home/*
    app.include_router(payment_router)        # /api/payment/*
    app.include_router(layout_router)         # /api/layout/*
    app.include_router(churches_router)       # /api/churches/*
    app.include_router(choirs_router)         # /api/choirs/*, /api/choir/*
    app.include_router(bible_router)          # /api/bible/*
    app.include_router(analytics_router)      # /api/analytics/*
    app.include_router(admin_router)          # /api/admin/*
    app.include_router(uploads_router)        # /api/upload/*, /api/files/*
    app.include_router(user_library_router)   # /api/library/*, /api/user/*
    app.include_router(content_router)        # /api/content-*, /api/religious-leaders/*
    app.include_router(monetization_router)   # /api/subscription-*, /api/monetization-*
    app.include_router(monetization_usage_router)  # /api/monetization/usage, /record-skip, /reset
    app.include_router(categories_router)     # /api/categories/*, /api/song-categories/*
    app.include_router(browse_router)         # /api/user/browse/*, /api/user/search
    app.include_router(teachings_router)      # /api/teachings/*
    app.include_router(rbac_router)           # /api/rbac/*
    app.include_router(cdn_management_router) # /api/admin/cdn/*
    app.include_router(advertising_router)    # /api/advertising/*
    app.include_router(feedback_router)       # /api/feedback/*
    app.include_router(chat_router)           # /api/chat/*
    app.include_router(app_control_router)    # /api/admin/app-*, /api/app/*
    app.include_router(recommendations_router)  # /api/recommendations/*
    app.include_router(radio_router)          # /api/radio/*
    app.include_router(leaders_router)        # /api/leaders/*, /api/leader/*
    app.include_router(branding_router)       # /api/branding/*
    app.include_router(legal_router)          # /api/legal/*
    
    # Import and include geo_content router
    from routes.geo_content import router as geo_content_router
    app.include_router(geo_content_router)    # /api/geo/*
    
    # Firebase authentication router
    app.include_router(firebase_router)       # /api/firebase/*
    
    # HLS Transcoding Admin
    app.include_router(hls_admin_router)      # /api/admin/hls/*
    
    # Neno la Leo (Word of the Day)
    app.include_router(neno_la_leo_router)    # /api/neno-la-leo/*
    
    # Admin CDN Browser (pick existing files for albums/songs)
    app.include_router(admin_cdn_browser_router)  # /api/admin/cdn/*
    
    # ============== ROOT ENDPOINTS ==============
    
    @app.get("/")
    async def root():
        """Root endpoint - API information"""
        return {
            "name": "Gracefy API",
            "version": "3.0.0",
            "status": "running",
            "description": "Christian Music Streaming Platform",
            "documentation": "/api/docs"
        }
    
    @app.get("/api")
    async def api_root():
        """API root - available endpoints"""
        return {
            "message": "Gracefy API v3.0.0",
            "endpoints": {
                "auth": "/api/auth/*",
                "music": "/api/albums/*, /api/songs/*",
                "home": "/api/home/*",
                "layout": "/api/layout/*",
                "churches": "/api/churches/*",
                "choirs": "/api/choirs/*",
                "bible": "/api/bible/*",
                "payment": "/api/payment/*",
                "admin": "/api/admin/*"
            },
            "docs": "/api/docs"
        }
    
    @app.get("/api/health")
    async def health_check():
        """Health check endpoint for monitoring"""
        redis_status = redis_cache._connected
        traffic_stats = {}
        if traffic_monitor:
            try:
                traffic_stats = await traffic_monitor.get_stats()
            except Exception:
                pass
        
        # Check Upstash Redis
        upstash_status = {"status": "not_configured"}
        try:
            from services.redis_service import redis_health_check
            upstash_status = await redis_health_check()
        except Exception as e:
            upstash_status = {"status": "error", "error": str(e)}
        
        return {
            "status": "healthy",
            "redis_connected": redis_status,
            "upstash_redis": upstash_status,
            "cache_type": "redis" if redis_status else "memory",
            "traffic_level": traffic_stats.traffic_level if hasattr(traffic_stats, 'traffic_level') else "unknown",
            "requests_per_minute": traffic_stats.requests_per_minute if hasattr(traffic_stats, 'requests_per_minute') else 0
        }
    
    # ============== KUBERNETES HEALTH PROBES ==============
    
    @app.get("/api/health/live")
    async def liveness_probe():
        """Kubernetes liveness probe - is the app alive?"""
        from core.load_balancer import health_checker
        return await health_checker.liveness_check()
    
    @app.get("/api/health/ready")
    async def readiness_probe():
        """Kubernetes readiness probe - can it receive traffic?"""
        from core.load_balancer import health_checker
        result = await health_checker.readiness_check()
        from fastapi.responses import JSONResponse
        status_code = 200 if result.get("ready") else 503
        return JSONResponse(content=result, status_code=status_code)
    
    @app.get("/api/health/startup")
    async def startup_probe():
        """Kubernetes startup probe - has it finished starting?"""
        from core.load_balancer import health_checker
        result = await health_checker.startup_check()
        from fastapi.responses import JSONResponse
        status_code = 200 if result.get("ready") else 503
        return JSONResponse(content=result, status_code=status_code)
    
    # ============== HIGH AVAILABILITY ENDPOINTS ==============
    
    @app.get("/api/system/status")
    async def system_status():
        """Comprehensive system status for monitoring dashboards"""
        from core.load_balancer import health_checker, lb_info, graceful_shutdown
        from core.circuit_breaker import get_all_circuits_stats
        from core.message_queue import message_queue
        
        health_results = await health_checker.check_all()
        
        return {
            "instance": lb_info.get_info(),
            "health": {
                name: {
                    "status": h.status.value,
                    "latency_ms": h.latency_ms,
                    "error": h.error
                }
                for name, h in health_results.items()
            },
            "cache": await redis_cache.get_stats(),
            "queue": message_queue.get_stats(),
            "circuits": get_all_circuits_stats(),
            "shutdown": graceful_shutdown.get_status(),
            "traffic": await traffic_monitor.get_stats() if traffic_monitor else {}
        }
    
    @app.post("/api/admin/circuits/reset")
    async def reset_circuits():
        """Reset all circuit breakers (admin only)"""
        from core.circuit_breaker import reset_all_circuits
        await reset_all_circuits()
        return {"status": "success", "message": "All circuit breakers reset"}
    
    return app


# ============== CREATE APP INSTANCE ==============

app = create_app()

# ============== LIFECYCLE EVENTS ==============

# Background task references
cache_cleanup_task = None
traffic_monitoring_task_ref = None
queue_worker_task_ref = None
rate_limit_cleanup_task_ref = None
subscription_check_task_ref = None


async def subscription_expiry_check_task(interval_seconds: int = 3600):
    """
    Periodically check for expired subscriptions and send push notifications.
    Runs every hour by default.
    """
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            logger.info("🔔 Running subscription expiry check...")
            
            db = get_db()
            from datetime import datetime, timezone, timedelta
            
            now = datetime.now(timezone.utc)
            one_day_ago = now - timedelta(days=1)
            
            expired_count = 0
            notified_count = 0
            
            # Check both user collections
            for collection_name in ['users', 'app_users']:
                collection = db[collection_name]
                cursor = collection.find({
                    "subscription.status": {"$in": ["active", "expired"]},
                    "subscription.expires_at": {"$lt": now.isoformat()},
                    "$or": [
                        {"subscription.expiry_notified_at": {"$exists": False}},
                        {"subscription.expiry_notified_at": {"$lt": one_day_ago.isoformat()}}
                    ]
                }, {"_id": 0})
                
                async for user in cursor:
                    expires_at_str = user.get("subscription", {}).get("expires_at")
                    if not expires_at_str:
                        continue
                    
                    try:
                        expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                        if expires_at >= now:
                            continue
                        
                        expired_count += 1
                        
                        # Prepare notification
                        is_swahili = user.get("language", "sw") == "sw"
                        title = "Kifurushi Kimeisha!" if is_swahili else "Subscription Expired!"
                        body = "Kifurushi chako kimeisha muda wake. Jiunge tena uendelee kufurahia muziki wote bila kikomo!" if is_swahili else "Your subscription has expired. Subscribe again to continue enjoying unlimited music!"
                        
                        notification_sent = False
                        
                        # Try FCM first
                        fcm_token = user.get("fcm_token")
                        if fcm_token:
                            try:
                                from services.firebase_service import send_fcm_notification
                                await send_fcm_notification(
                                    token=fcm_token,
                                    title=title,
                                    body=body,
                                    data={"type": "subscription_expired", "action": "open_subscription"}
                                )
                                notification_sent = True
                            except Exception as e:
                                logger.debug(f"FCM notification failed: {e}")
                        
                        # Try Expo if FCM failed
                        expo_token = user.get("expo_push_token")
                        if not notification_sent and expo_token:
                            try:
                                from services.push_notification_service import send_push_notification
                                await send_push_notification(
                                    db=db,
                                    push_tokens=[expo_token],
                                    title=title,
                                    body=body,
                                    data={"type": "subscription_expired", "action": "open_subscription"}
                                )
                                notification_sent = True
                            except Exception as e:
                                logger.debug(f"Expo notification failed: {e}")
                        
                        if notification_sent:
                            notified_count += 1
                            await collection.update_one(
                                {"user_id": user.get("user_id")},
                                {"$set": {
                                    "subscription.expiry_notified_at": now.isoformat(),
                                    "subscription.status": "expired"
                                }}
                            )
                    except Exception as e:
                        logger.debug(f"Error processing user: {e}")
            
            if expired_count > 0:
                logger.info(f"🔔 Subscription check: {expired_count} expired, {notified_count} notified")
            
        except asyncio.CancelledError:
            logger.info("Subscription check task cancelled")
            break
        except Exception as e:
            logger.error(f"Subscription check task error: {e}")
            await asyncio.sleep(60)  # Wait before retrying


@app.on_event("startup")
async def startup():
    """Initialize services on startup"""
    global cache_cleanup_task, traffic_monitoring_task_ref, queue_worker_task_ref, rate_limit_cleanup_task_ref
    
    logger.info("🚀 Starting Gracefy API v3.0.0 (High Availability Mode)...")
    
    # Initialize MongoDB connection (via core.database)
    await connect_db()
    logger.info("✅ MongoDB connected")
    
    # Initialize legacy cache (for backward compatibility)
    await legacy_cache.connect()
    logger.info("✅ Legacy cache initialized")
    
    # Initialize Redis cache (primary cache)
    redis_connected = await redis_cache.connect()
    if redis_connected:
        logger.info("🔴 Redis cache connected - PRODUCTION MODE")
    else:
        logger.info("⚠️ Redis not available - using in-memory fallback")
    
    # Initialize message queue (RabbitMQ with fallback)
    try:
        from core.message_queue import message_queue, register_default_handlers, queue_worker_task
        queue_connected = await message_queue.connect()
        register_default_handlers()
        if queue_connected:
            logger.info("🐰 RabbitMQ connected - distributed queue enabled")
        else:
            logger.info("⚠️ RabbitMQ not available - using in-memory queue fallback")
        
        # Start queue worker for fallback processing
        queue_worker_task_ref = asyncio.create_task(queue_worker_task(5))
        logger.info("✅ Queue worker started")
    except Exception as e:
        logger.warning(f"Message queue initialization skipped: {e}")
    
    # Initialize health checks for load balancer
    try:
        from core.load_balancer import health_checker, register_default_checks
        register_default_checks()
        logger.info("✅ Health checks registered for load balancer")
    except Exception as e:
        logger.warning(f"Health check initialization skipped: {e}")
    
    # Initialize circuit breakers
    try:
        from core.circuit_breaker import circuit_registry
        logger.info(f"⚡ Circuit breakers initialized: {list(circuit_registry.keys())}")
    except Exception as e:
        logger.warning(f"Circuit breaker initialization skipped: {e}")
    
    # Start background cache cleanup
    cache_cleanup_task = asyncio.create_task(periodic_cache_cleanup(300))
    logger.info("✅ Cache cleanup task started (every 5 minutes)")
    
    # Start traffic monitoring for auto-scaling
    traffic_monitoring_task_ref = asyncio.create_task(traffic_monitoring_task(30))
    logger.info("📊 Auto-scaling traffic monitor started")
    
    # Start rate limit cleanup task
    rate_limit_cleanup_task_ref = asyncio.create_task(rate_limit_cleanup_task())
    logger.info("🛡️ Rate limiter started")
    
    # Start subscription expiry notification task (check every hour)
    global subscription_check_task_ref
    subscription_check_task_ref = asyncio.create_task(subscription_expiry_check_task(3600))
    logger.info("📧 Subscription expiry checker started (every hour)")
    
    # Run database migrations
    await run_migrations()

    # Ensure analytics + real-time MongoDB indexes (idempotent, runs in <1s)
    try:
        from core.indexes import ensure_indexes
        await ensure_indexes()
    except Exception as e:
        logger.warning(f"Index ensure failed: {e}")

    logger.info("="*60)
    logger.info("✅ Gracefy API startup complete (HIGH AVAILABILITY)")
    logger.info("   🔧 Architecture: Modular Routers + HA Components")
    logger.info("   📊 Traffic levels: low (<50 req/s) → critical (>300)")
    logger.info("   🔄 Cache: Redis with in-memory fallback")
    logger.info("   📬 Queue: RabbitMQ with in-memory fallback")
    logger.info("   ⚡ Circuit Breakers: cdn, payment, sms, external_api")
    logger.info("   🏥 Health Probes: /api/health/live, /ready, /startup")
    logger.info("="*60)


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    global cache_cleanup_task, traffic_monitoring_task_ref, queue_worker_task_ref, rate_limit_cleanup_task_ref, subscription_check_task_ref
    
    logger.info("Shutting down Gracefy API...")
    
    # Signal graceful shutdown for load balancer draining
    try:
        from core.load_balancer import graceful_shutdown
        graceful_shutdown.start_shutdown()
        await graceful_shutdown.wait_for_requests()
    except Exception as e:
        logger.warning(f"Graceful shutdown error: {e}")
    
    # Cancel background tasks
    for task in [cache_cleanup_task, traffic_monitoring_task_ref, queue_worker_task_ref, rate_limit_cleanup_task_ref, subscription_check_task_ref]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    
    # Disconnect message queue
    try:
        from core.message_queue import message_queue
        await message_queue.disconnect()
    except Exception:
        pass
    
    # Disconnect services
    await legacy_cache.disconnect()
    await redis_cache.disconnect()
    await disconnect_db()
    
    logger.info("Gracefy API shutdown complete")


async def run_migrations():
    """Run database migrations on startup"""
    db = get_db()
    
    # Migration: singers followers field
    result = await db.singers.update_many(
        {"followers": {"$exists": True}, "followers_count": {"$exists": False}},
        [{"$set": {"followers_count": {"$ifNull": ["$followers", 0]}}}]
    )
    if result.modified_count > 0:
        logger.info(f"Migrated {result.modified_count} singers: followers -> followers_count")
    
    # Initialize followers_count for singers
    result = await db.singers.update_many(
        {"followers_count": {"$exists": False}},
        {"$set": {"followers_count": 0}}
    )
    if result.modified_count > 0:
        logger.info(f"Initialized followers_count for {result.modified_count} singers")
    
    # Initialize followers_count for churches
    result = await db.churches.update_many(
        {"followers_count": {"$exists": False}},
        {"$set": {"followers_count": 0}}
    )
    if result.modified_count > 0:
        logger.info(f"Initialized followers_count for {result.modified_count} churches")


# ============== EXCEPTION HANDLERS ==============

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to catch unhandled errors"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


# ============== LEGACY COMPATIBILITY ==============
# These are kept for backward compatibility with existing code
# New code should import from core.database instead

# Legacy MongoDB client (deprecated - use get_db() instead)
mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME')

if mongo_url and db_name:
    from motor.motor_asyncio import AsyncIOMotorClient as LegacyClient
    client = LegacyClient(
        mongo_url,
        maxPoolSize=100,
        minPoolSize=10,
        maxIdleTimeMS=30000,
        serverSelectionTimeoutMS=5000,
    )
    db = client[db_name]
