"""
Database connection and configuration for Gracefy.
Provides async MongoDB connection with connection pooling.
"""

import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

logger = logging.getLogger(__name__)

# Database configuration
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gracefy")

# Connection pooling settings
POOL_SIZE = int(os.environ.get("MONGO_POOL_SIZE", "100"))
MAX_IDLE_TIME_MS = 30000

# Global database client
_client: Optional[AsyncIOMotorClient] = None
_db = None


async def connect_db():
    """Initialize database connection with connection pooling and retry on transient failures.
    
    Retries the initial ping up to 5 times with exponential backoff. This makes pod startup
    resilient to:
      - Atlas serverless cold starts (can take 10-15s on first ping)
      - Brief DNS / SRV record propagation lag after env-var rotation
      - Transient network blips during rolling deployments
    """
    global _client, _db
    
    if _client is not None:
        return _db
    
    last_error: Optional[Exception] = None
    max_attempts = 5
    
    for attempt in range(1, max_attempts + 1):
        try:
            _client = AsyncIOMotorClient(
                MONGO_URL,
                maxPoolSize=POOL_SIZE,
                minPoolSize=10,
                maxIdleTimeMS=MAX_IDLE_TIME_MS,
                serverSelectionTimeoutMS=20000,
                connectTimeoutMS=20000,
                socketTimeoutMS=30000,
                retryWrites=True,
                retryReads=True,
            )
            
            # Test connection
            await _client.admin.command('ping')
            
            _db = _client[DB_NAME]
            logger.info(f"Connected to MongoDB: {DB_NAME} (Pool: {POOL_SIZE}) on attempt {attempt}")
            
            return _db
            
        except Exception as e:
            last_error = e
            # Close half-built client so the next attempt starts fresh
            if _client is not None:
                try:
                    _client.close()
                except Exception:
                    pass
                _client = None
            
            if attempt < max_attempts:
                backoff = min(2 ** attempt, 15)  # 2, 4, 8, 15, 15
                logger.warning(
                    f"MongoDB connection attempt {attempt}/{max_attempts} failed: "
                    f"{type(e).__name__}. Retrying in {backoff}s..."
                )
                import asyncio
                await asyncio.sleep(backoff)
            else:
                logger.error(
                    f"Failed to connect to MongoDB after {max_attempts} attempts: {e}"
                )
    
    # All attempts exhausted
    raise last_error if last_error else RuntimeError("MongoDB connection failed")


async def disconnect_db():
    """Close database connection."""
    global _client, _db
    
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("Disconnected from MongoDB")


def get_db():
    """Get database instance. Must be called after connect_db()."""
    if _db is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _db


# Convenience function for direct access
db = property(lambda self: get_db())
