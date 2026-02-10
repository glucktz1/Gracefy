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
)
from routes.teachings import router as teachings_router
from routes.rbac import router as rbac_router
from routes.advertising import router as advertising_router

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
    app.include_router(categories_router)     # /api/categories/*, /api/song-categories/*
    app.include_router(browse_router)         # /api/user/browse/*, /api/user/search
    app.include_router(teachings_router)      # /api/teachings/*
    app.include_router(rbac_router)           # /api/rbac/*
    app.include_router(cdn_management_router) # /api/admin/cdn/*
    app.include_router(advertising_router)    # /api/advertising/*
    app.include_router(feedback_router)       # /api/feedback/*
    
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
        
        return {
            "status": "healthy",
            "redis_connected": redis_status,
            "cache_type": "redis" if redis_status else "memory",
            "traffic_level": traffic_stats.traffic_level if hasattr(traffic_stats, 'traffic_level') else "unknown",
            "requests_per_minute": traffic_stats.requests_per_minute if hasattr(traffic_stats, 'requests_per_minute') else 0
        }
    
    return app


# ============== CREATE APP INSTANCE ==============

app = create_app()

# ============== LIFECYCLE EVENTS ==============

# Background task references
cache_cleanup_task = None
traffic_monitoring_task_ref = None


@app.on_event("startup")
async def startup():
    """Initialize services on startup"""
    global cache_cleanup_task, traffic_monitoring_task_ref
    
    logger.info("🚀 Starting Gracefy API v3.0.0...")
    
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
    
    # Start background cache cleanup
    cache_cleanup_task = asyncio.create_task(periodic_cache_cleanup(300))
    logger.info("✅ Cache cleanup task started (every 5 minutes)")
    
    # Start traffic monitoring for auto-scaling
    traffic_monitoring_task_ref = asyncio.create_task(traffic_monitoring_task(30))
    logger.info("📊 Auto-scaling traffic monitor started")
    
    # Run database migrations
    await run_migrations()
    
    logger.info("="*60)
    logger.info("✅ Gracefy API startup complete")
    logger.info("   🔧 Architecture: Modular Routers")
    logger.info("   📊 Traffic levels: low (<50 req/s) → critical (>300)")
    logger.info("   🔄 Cache TTL auto-adjusts: 1x (low) → 4x (critical)")
    logger.info("="*60)


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    global cache_cleanup_task, traffic_monitoring_task_ref
    
    logger.info("Shutting down Gracefy API...")
    
    # Cancel background tasks
    for task in [cache_cleanup_task, traffic_monitoring_task_ref]:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
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
