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
    """Initialize database connection with connection pooling."""
    global _client, _db
    
    if _client is not None:
        return _db
    
    try:
        _client = AsyncIOMotorClient(
            MONGO_URL,
            maxPoolSize=POOL_SIZE,
            minPoolSize=10,
            maxIdleTimeMS=MAX_IDLE_TIME_MS,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=30000,
            retryWrites=True,
            retryReads=True,
        )
        
        # Test connection
        await _client.admin.command('ping')
        
        _db = _client[DB_NAME]
        logger.info(f"Connected to MongoDB: {DB_NAME} (Pool: {POOL_SIZE})")
        
        return _db
        
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


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
