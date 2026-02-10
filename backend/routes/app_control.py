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
            "feature_flags": {}
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
                "feature_flags": data.get("feature_flags", {})
            },
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
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
