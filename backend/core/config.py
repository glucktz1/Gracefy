"""
Configuration management for Gracefy.
All environment variables and settings are managed here.
Fail fast if required variables are missing.
"""

import os
from functools import lru_cache


class Settings:
    """Application settings loaded from environment variables."""
    
    # Database - Required
    MONGO_URL: str = os.environ.get("MONGO_URL")
    DB_NAME: str = os.environ.get("DB_NAME")
    MONGO_POOL_SIZE: int = int(os.environ.get("MONGO_POOL_SIZE", "100"))
    MONGO_MIN_POOL_SIZE: int = int(os.environ.get("MONGO_MIN_POOL_SIZE", "10"))
    
    # Redis - Optional (falls back to in-memory)
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
    REDIS_PREFIX: str = os.environ.get("REDIS_PREFIX", "gracefy:")
    REDIS_ENABLED: bool = os.environ.get("REDIS_ENABLED", "true").lower() == "true"
    
    # CORS
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")
    
    # Bunny CDN - Optional
    BUNNY_STORAGE_ZONE: str = os.environ.get("BUNNY_STORAGE_ZONE", "")
    BUNNY_API_KEY: str = os.environ.get("BUNNY_API_KEY", "")
    BUNNY_CDN_URL: str = os.environ.get("BUNNY_CDN_URL", "")
    BUNNY_STORAGE_REGION: str = os.environ.get("BUNNY_STORAGE_REGION", "de")
    
    # Azam Pay - Optional
    AZAMPAY_CLIENT_ID: str = os.environ.get("AZAMPAY_CLIENT_ID", "")
    AZAMPAY_CLIENT_SECRET: str = os.environ.get("AZAMPAY_CLIENT_SECRET", "")
    AZAMPAY_TOKEN: str = os.environ.get("AZAMPAY_TOKEN", "")
    AZAMPAY_CALLBACK_URL: str = os.environ.get("AZAMPAY_CALLBACK_URL", "")
    AZAMPAY_TEST_MODE: bool = os.environ.get("AZAMPAY_TEST_MODE", "true").lower() == "true"
    
    # External APIs - Optional
    GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")
    ELEVENLABS_API_KEY: str = os.environ.get("ELEVENLABS_API_KEY", "")
    
    # App Configuration
    APP_NAME: str = os.environ.get("APP_NAME", "Gracefy")
    APP_VERSION: str = os.environ.get("APP_VERSION", "3.0.0")
    DEBUG: bool = os.environ.get("DEBUG", "false").lower() == "true"
    
    # Rate Limiting
    RATE_LIMIT_RPM: int = int(os.environ.get("RATE_LIMIT_RPM", "500"))
    
    # Session Configuration
    SESSION_EXPIRY_DAYS: int = int(os.environ.get("SESSION_EXPIRY_DAYS", "7"))
    TOKEN_EXPIRY_DAYS: int = int(os.environ.get("TOKEN_EXPIRY_DAYS", "30"))
    
    # Streaming
    MIN_STREAM_DURATION_SECONDS: int = int(os.environ.get("MIN_STREAM_DURATION_SECONDS", "45"))
    
    # Monetization
    FREE_TRIAL_DAYS: int = int(os.environ.get("FREE_TRIAL_DAYS", "7"))
    PLATFORM_COMMISSION_PERCENT: int = int(os.environ.get("PLATFORM_COMMISSION_PERCENT", "30"))
    MINIMUM_PAYOUT_THRESHOLD: int = int(os.environ.get("MINIMUM_PAYOUT_THRESHOLD", "10000"))
    
    @classmethod
    def validate(cls):
        """Validate that required settings are present. Fail fast if missing."""
        required = {
            "MONGO_URL": cls.MONGO_URL,
            "DB_NAME": cls.DB_NAME,
        }
        missing = [key for key, value in required.items() if not value]
        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}. "
                f"Please set them in backend/.env file."
            )
    
    @classmethod
    def get_cors_origins(cls) -> list:
        """Get list of allowed CORS origins."""
        if cls.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in cls.CORS_ORIGINS.split(',')]
    
    @classmethod
    def is_cdn_enabled(cls) -> bool:
        """Check if Bunny CDN is properly configured."""
        return bool(cls.BUNNY_STORAGE_ZONE and cls.BUNNY_API_KEY and cls.BUNNY_CDN_URL)
    
    @classmethod
    def is_payment_enabled(cls) -> bool:
        """Check if Azam Pay is configured."""
        return bool(cls.AZAMPAY_CLIENT_ID and cls.AZAMPAY_CLIENT_SECRET)
    
    @classmethod
    def is_google_tts_enabled(cls) -> bool:
        """Check if Google TTS is configured."""
        return bool(cls.GOOGLE_API_KEY)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance after validation."""
    Settings.validate()
    return Settings
