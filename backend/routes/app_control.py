"""
App Control & Management API routes.
Handles app settings, crash reports, and monitoring.
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["app-control"])


@router.get("/admin/app-stats")
async def get_app_stats():
    """Get app statistics for admin dashboard"""
    db = get_db()
    
    # Count total users
    total_users = await db.app_users.count_documents({})
    
    # Count active today (simplified - users with recent activity)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    active_today = await db.listening_sessions.count_documents({
        "started_at": {"$gte": today_start.isoformat()}
    })
    
    # Count guest users (users without email or with guest flag)
    guest_users = await db.app_users.count_documents({
        "$or": [
            {"is_guest": True},
            {"email": None},
            {"email": ""}
        ]
    })
    
    # Count crash reports
    crash_count = await db.crash_reports.count_documents({})
    
    return {
        "total_users": total_users,
        "active_today": active_today,
        "guest_users": guest_users,
        "crash_reports": crash_count
    }


@router.get("/admin/crash-reports")
async def get_crash_reports(limit: int = 50, skip: int = 0):
    """Get crash reports from mobile app"""
    db = get_db()
    
    reports = await db.crash_reports.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"reports": reports}


@router.post("/admin/crash-reports")
async def create_crash_report(data: dict):
    """Submit a new crash report from the mobile app"""
    db = get_db()
    
    report = {
        "report_id": f"crash_{uuid.uuid4().hex[:12]}",
        "error_type": data.get("error_type", "Unknown"),
        "message": data.get("message", ""),
        "stack_trace": data.get("stack_trace", ""),
        "screen": data.get("screen", ""),
        "app_version": data.get("app_version", ""),
        "device_info": data.get("device_info", {}),
        "user_id": data.get("user_id"),
        "severity": data.get("severity", "error"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crash_reports.insert_one(report)
    report.pop("_id", None)
    
    return {"success": True, "report_id": report["report_id"]}


@router.delete("/admin/crash-reports/{report_id}")
async def delete_crash_report(report_id: str):
    """Delete a crash report"""
    db = get_db()
    
    result = await db.crash_reports.delete_one({"report_id": report_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"success": True}


@router.get("/app-settings")
async def get_public_app_settings():
    """Get public app settings for the frontend.

    Cached 30s + queried in parallel - this endpoint is hit on EVERY page
    load and was previously doing 4 sequential find_one calls.
    """
    db = get_db()
    from core.cache import cache
    import asyncio

    cache_key = "app-settings:public"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # Parallel fetch instead of 4 sequential round-trips
    guest_limits, billing, app_config, monetization = await asyncio.gather(
        db.app_settings.find_one({"setting_type": "guest_limits"}, {"_id": 0}),
        db.app_settings.find_one({"setting_type": "billing"}, {"_id": 0}),
        db.app_settings.find_one({"setting_type": "app_config"}, {"_id": 0}),
        db.app_settings.find_one({"setting_type": "monetization"}, {"_id": 0}),
    )

    defaults = {
        "max_plays": 3,
        "max_skips": 3,
        "max_listen_minutes": 10
    }
    
    config = guest_limits.get("config", defaults) if guest_limits else defaults
    app_settings = app_config.get("config", {}) if app_config else {}
    
    # Monetization defaults — Spotify-style tiered enforcement for unpaid logged-in users
    monetization_defaults = {
        "daily_play_limit": 9,
        "soft_skip_limit": 6,
        "hard_skip_limit": 9,
        "preview_duration_seconds": 45,
        "full_play_every_n_previews": 4,
        "prompt_message_sw": "Maudhui haya ni bure lakini teknolojia hii ina gharama. Changia kidogo kuwezesha iwafikie watu wengi zaidi.",
        "prompt_message_en": "This content is free but the technology has costs. Contribute a little to help reach more people."
    }
    mon_config = (monetization or {}).get("config", monetization_defaults)
    # Merge defaults with admin overrides (admin may save partial config)
    monetization_out = {**monetization_defaults, **mon_config}

    result = {
        "guest_play_limit": config.get("max_plays", 3),
        "guest_skip_limit": config.get("max_skips", 3),
        "guest_listen_minutes": config.get("max_listen_minutes", 10),
        "billing_enabled": billing.get("enabled", False) if billing else False,
        "playstore_url": app_settings.get("playstore_url", "https://play.google.com/store/apps/details?id=com.gracefy.app"),
        "appstore_url": app_settings.get("appstore_url", ""),
        "app_download_message": app_settings.get("app_download_message", ""),
        "monetization": monetization_out,
    }
    await cache.set(cache_key, result, 120)
    return result


@router.get("/admin/app-settings")
async def get_app_settings():
    """Get app settings and configuration"""
    db = get_db()
    
    # Get guest limits
    guest_limits = await db.app_settings.find_one(
        {"setting_type": "guest_limits"},
        {"_id": 0}
    )
    
    # Get app settings
    app_settings = await db.app_settings.find_one(
        {"setting_type": "app_config"},
        {"_id": 0}
    )
    
    # Get monetization settings
    monetization = await db.app_settings.find_one(
        {"setting_type": "monetization"},
        {"_id": 0}
    )
    
    return {
        "guest_limits": guest_limits.get("config") if guest_limits else {
            "max_plays": 3,
            "max_skips": 3,
            "max_listen_minutes": 10,
            "prompt_attempts_before_lock": 3
        },
        "app_settings": app_settings.get("config") if app_settings else {
            "maintenance_mode": False,
            "force_update_version": "",
            "min_app_version": "1.0.0",
            "feature_flags": {},
            "playstore_url": "",
            "appstore_url": "",
            "app_download_message": ""
        },
        "monetization": monetization.get("config") if monetization else {
            "soft_skip_limit": 5,
            "hard_skip_limit": 8,
            "preview_duration_seconds": 30,
            "prompt_message_sw": "Maudhui haya ni bure lakini teknolojia hii ina gharama. Changia kidogo kuwezesha iwafikie watu wengi zaidi.",
            "prompt_message_en": "This content is free but the technology has costs. Contribute a little to help reach more people."
        }
    }


@router.post("/admin/app-settings/guest-limits")
async def save_guest_limits(data: dict):
    """Save guest user limits"""
    db = get_db()
    
    await db.app_settings.update_one(
        {"setting_type": "guest_limits"},
        {"$set": {
            "setting_type": "guest_limits",
            "config": {
                "max_plays": data.get("max_plays", 3),
                "max_skips": data.get("max_skips", 3),
                "max_listen_minutes": data.get("max_listen_minutes", 10),
                "prompt_attempts_before_lock": data.get("prompt_attempts_before_lock", 3)
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    # Invalidate the public app-settings cache so the change is visible immediately.
    try:
        from core.cache import cache
        await cache.delete("app-settings:public")
    except Exception:
        pass

    return {"success": True}


@router.post("/admin/app-settings")
async def save_app_settings(data: dict):
    """Save app configuration settings"""
    db = get_db()
    
    await db.app_settings.update_one(
        {"setting_type": "app_config"},
        {"$set": {
            "setting_type": "app_config",
            "config": {
                "maintenance_mode": data.get("maintenance_mode", False),
                "force_update_version": data.get("force_update_version", ""),
                "min_app_version": data.get("min_app_version", "1.0.0"),
                "feature_flags": data.get("feature_flags", {}),
                "playstore_url": data.get("playstore_url", ""),
                "appstore_url": data.get("appstore_url", ""),
                "app_download_message": data.get("app_download_message", "")
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    try:
        from core.cache import cache
        await cache.delete("app-settings:public")
    except Exception:
        pass

    return {"success": True}


@router.post("/admin/app-settings/monetization")
async def save_monetization_settings(data: dict):
    """Save monetization thresholds and prompt message (Spotify-style tiered enforcement).
    
    Fields:
      - soft_skip_limit:        skips before first contribution prompt (default 5)
      - hard_skip_limit:        skips before enforcing 30s preview mode (default 8)
      - preview_duration_seconds: seconds of preview audio in preview mode (default 30)
      - prompt_message_sw / prompt_message_en: text shown in the monetization modal
    """
    db = get_db()
    
    await db.app_settings.update_one(
        {"setting_type": "monetization"},
        {"$set": {
            "setting_type": "monetization",
            "config": {
                "soft_skip_limit": int(data.get("soft_skip_limit", 5)),
                "hard_skip_limit": int(data.get("hard_skip_limit", 8)),
                "preview_duration_seconds": int(data.get("preview_duration_seconds", 30)),
                "prompt_message_sw": data.get(
                    "prompt_message_sw",
                    "Maudhui haya ni bure lakini teknolojia hii ina gharama. Changia kidogo kuwezesha iwafikie watu wengi zaidi."
                ),
                "prompt_message_en": data.get(
                    "prompt_message_en",
                    "This content is free but the technology has costs. Contribute a little to help reach more people."
                ),
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )

    try:
        from core.cache import cache
        await cache.delete("app-settings:public")
    except Exception:
        pass

    return {"success": True}


# Mobile API endpoint to get app config
@router.get("/app/config")
async def get_mobile_app_config():
    """Get app configuration for mobile app startup"""
    db = get_db()
    
    # Get guest limits
    guest_limits = await db.app_settings.find_one(
        {"setting_type": "guest_limits"},
        {"_id": 0}
    )
    
    # Get app settings
    app_settings = await db.app_settings.find_one(
        {"setting_type": "app_config"},
        {"_id": 0}
    )
    
    guest_config = guest_limits.get("config") if guest_limits else {
        "max_plays": 3,
        "max_skips": 3,
        "max_listen_minutes": 10,
        "prompt_attempts_before_lock": 3
    }
    
    app_config = app_settings.get("config") if app_settings else {
        "maintenance_mode": False,
        "force_update_version": "",
        "min_app_version": "1.0.0"
    }
    
    return {
        "guest_limits": guest_config,
        "app_config": app_config
    }


# Mobile API endpoint to submit crash report
@router.post("/app/crash-report")
async def submit_mobile_crash_report(data: dict):
    """Submit crash report from mobile app"""
    return await create_crash_report(data)
