"""
Configuration management for Gracefy.
All environment variables and settings are managed here.
"""

import os
from pathlib import Path
from functools import lru_cache


class Settings:
    """Application settings loaded from environment variables."""
    
    # Database
    MONGO_URL: str = os.environ.get("MONGO_URL")
    DB_NAME: str = os.environ.get("DB_NAME")
    MONGO_POOL_SIZE: int = int(os.environ.get("MONGO_POOL_SIZE", "100"))
    
    # Redis
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
    REDIS_PREFIX: str = os.environ.get("REDIS_PREFIX", "gracefy:")
    REDIS_ENABLED: bool = os.environ.get("REDIS_ENABLED", "true").lower() == "true"
    
    # CORS
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")
    
    # Bunny CDN
    BUNNY_STORAGE_ZONE: str = os.environ.get("BUNNY_STORAGE_ZONE", "")
    BUNNY_API_KEY: str = os.environ.get("BUNNY_API_KEY", "")
    BUNNY_CDN_URL: str = os.environ.get("BUNNY_CDN_URL", "")
    BUNNY_STORAGE_REGION: str = os.environ.get("BUNNY_STORAGE_REGION", "de")
    
    # Azam Pay
    AZAMPAY_CLIENT_ID: str = os.environ.get("AZAMPAY_CLIENT_ID", "")
    AZAMPAY_CLIENT_SECRET: str = os.environ.get("AZAMPAY_CLIENT_SECRET", "")
    AZAMPAY_TOKEN: str = os.environ.get("AZAMPAY_TOKEN", "")
    AZAMPAY_CALLBACK_URL: str = os.environ.get("AZAMPAY_CALLBACK_URL", "")
    AZAMPAY_TEST_MODE: bool = os.environ.get("AZAMPAY_TEST_MODE", "true").lower() == "true"
    
    # External APIs
    GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")
    ELEVENLABS_API_KEY: str = os.environ.get("ELEVENLABS_API_KEY", "")
    
    # App Configuration
    APP_NAME: str = "Gracefy"
    APP_VERSION: str = "2.2.0"
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = int(os.environ.get("RATE_LIMIT_RPM", "500"))
    
    # Session
    SESSION_EXPIRY_DAYS: int = int(os.environ.get("SESSION_EXPIRY_DAYS", "7"))
    TOKEN_EXPIRY_DAYS: int = int(os.environ.get("TOKEN_EXPIRY_DAYS", "30"))
    
    # Streaming
    MIN_STREAM_DURATION_SECONDS: int = 45
    
    @classmethod
    def validate(cls):
        """Validate that required settings are present."""
        required = ["MONGO_URL", "DB_NAME"]
        missing = [key for key in required if not getattr(cls, key)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
    
    @classmethod
    def get_cors_origins(cls) -> list:
        """Get list of allowed CORS origins."""
        if cls.CORS_ORIGINS == "*":
            return [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
        return [origin.strip() for origin in cls.CORS_ORIGINS.split(',')]
    
    @classmethod
    def is_cdn_enabled(cls) -> bool:
        """Check if Bunny CDN is configured."""
        return bool(cls.BUNNY_STORAGE_ZONE and cls.BUNNY_API_KEY and cls.BUNNY_CDN_URL)
    
    @classmethod
    def is_payment_enabled(cls) -> bool:
        """Check if Azam Pay is configured."""
        return bool(cls.AZAMPAY_CLIENT_ID and cls.AZAMPAY_CLIENT_SECRET)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    Settings.validate()
    return Settings()
