"""
Admin routes for Gracefy.
Handles admin panel operations, system settings, cache management.
"""

from fastapi import APIRouter, HTTPException, Query, Request
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

from core.database import get_db
from core.cache import cache as app_cache
from core.redis_cache import redis_cache, invalidate_pattern

# Import hybrid cache for stats
try:
    from services.hybrid_cache import get_cache_stats as get_hybrid_cache_stats
except ImportError:
    get_hybrid_cache_stats = None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["admin"])


# Import for traffic monitoring
try:
    from core.auto_scaling import (
        traffic_monitor,
        adaptive_cache,
        auto_scaling_recommendations
    )
except ImportError:
    traffic_monitor = None
    adaptive_cache = None
    auto_scaling_recommendations = None


# ============== CACHE MANAGEMENT ==============

@router.get("/admin/cache/stats")
async def get_cache_stats():
    """Get cache statistics for monitoring"""
    redis_stats = await redis_cache.get_stats()
    app_cache_stats = await app_cache.get_stats() if hasattr(app_cache, 'get_stats') else {}
    adaptive_stats = await adaptive_cache.get_stats() if adaptive_cache else {}
    hybrid_stats = get_hybrid_cache_stats() if get_hybrid_cache_stats else {}
    
    return {
        "hybrid_cache": hybrid_stats,  # L1/L2 cache stats
        "redis_cache": redis_stats,
        "adaptive_cache": adaptive_stats,
        "memory_cache": app_cache_stats,
        "summary": {
            "primary": "hybrid_l1l2",
            "l1_connected": True,  # L1 is always available (in-memory)
            "l2_connected": hybrid_stats.get('home_cache', {}).get('l2', {}).get('connected', False),
            "redis_connected": redis_stats.get('connected', False),
        }
    }


@router.get("/admin/auto-scaling")
async def get_auto_scaling_status():
    """Get auto-scaling status and recommendations"""
    if auto_scaling_recommendations:
        return await auto_scaling_recommendations()
    return {"status": "Auto-scaling not available"}


@router.get("/admin/traffic")
async def get_traffic_stats():
    """Get real-time traffic statistics"""
    if not traffic_monitor:
        return {"error": "Traffic monitoring not available"}
    
    stats = await traffic_monitor.get_stats()
    return {
        "requests_per_second": stats.requests_per_second,
        "requests_per_minute": stats.requests_per_minute,
        "avg_response_time_ms": stats.avg_response_time_ms,
        "active_connections": stats.active_connections,
        "peak_rps_today": stats.peak_rps_today,
        "traffic_level": stats.traffic_level,
        "cache_ttl_multiplier": traffic_monitor.get_cache_ttl_multiplier(),
        "last_updated": stats.last_updated
    }


@router.post("/admin/cache/clear")
async def clear_cache():
    """Clear all cache entries"""
    await redis_cache.clear_all()
    await app_cache.clear_all() if hasattr(app_cache, 'clear_all') else None
    if adaptive_cache:
        await adaptive_cache.clear_all()
    return {"message": "All cache cleared", "status": "success"}


@router.post("/admin/cache/invalidate-pattern")
async def invalidate_cache_pattern(data: dict):
    """Invalidate cache by pattern"""
    pattern = data.get("pattern", "*")
    deleted = await invalidate_pattern(pattern)
    return {"message": f"Deleted {deleted} keys matching '{pattern}'"}


# ============== DATABASE BACKUP ==============

# Import backup service
try:
    from services.backup_service import backup_service
except ImportError:
    backup_service = None


@router.post("/admin/backup/create")
async def create_backup(data: dict = None):
    """
    Create a database backup.
    Optional: provide backup_name in data.
    """
    if not backup_service:
        raise HTTPException(status_code=500, detail="Backup service not available")
    
    backup_name = (data or {}).get("backup_name")
    result = await backup_service.create_backup(backup_name)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Backup failed"))
    
    return result


@router.get("/admin/backup/list")
async def list_backups():
    """List all available backups."""
    if not backup_service:
        raise HTTPException(status_code=500, detail="Backup service not available")
    
    backups = await backup_service.list_backups()
    return {"backups": backups, "max_backups_kept": 7}


@router.post("/admin/backup/restore/{backup_name}")
async def restore_backup(backup_name: str, data: dict = None):
    """
    Restore from a backup.
    WARNING: This will overwrite existing data!
    Requires confirmation: {"confirm": true}
    """
    if not backup_service:
        raise HTTPException(status_code=500, detail="Backup service not available")
    
    # Require explicit confirmation
    if not (data or {}).get("confirm"):
        raise HTTPException(
            status_code=400, 
            detail="Restore requires confirmation. Send {\"confirm\": true}"
        )
    
    result = await backup_service.restore_backup(backup_name)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Restore failed"))
    
    return result


# ============== SYSTEM SETTINGS ==============

@router.get("/admin/system-settings")
async def get_system_settings():
    """Get all system settings"""
    db = get_db()
    
    settings = await db.system_settings.find_one({"settings_id": "main"}, {"_id": 0})
    return settings or {}


@router.post("/admin/system-settings")
async def save_system_settings(data: dict):
    """Save system settings"""
    db = get_db()
    
    data["settings_id"] = "main"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.system_settings.update_one(
        {"settings_id": "main"},
        {"$set": data},
        upsert=True
    )
    
    return {"message": "Settings saved successfully"}


@router.get("/admin/settings")
async def get_admin_settings():
    """Get admin panel settings"""
    db = get_db()
    
    settings = await db.admin_settings.find_one({}, {"_id": 0})
    return settings or {}


@router.put("/admin/settings")
async def update_admin_settings(data: dict):
    """Update admin settings"""
    db = get_db()
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.admin_settings.update_one(
        {},
        {"$set": data},
        upsert=True
    )
    
    # Invalidate billing cache when settings change
    try:
        from services.redis_service import invalidate_billing_cache
        await invalidate_billing_cache()
        logger.info("[Admin] Billing cache invalidated after settings update")
    except Exception as e:
        logger.warning(f"[Admin] Failed to invalidate billing cache: {e}")
    
    return {"message": "Settings updated"}


# ============== TRANSLATIONS MANAGEMENT ==============

@router.get("/admin/translations/languages")
async def get_translation_languages():
    """Get translation statistics for all languages"""
    db = get_db()
    
    # Get all translations
    translations = await db.translations.find({}, {"_id": 0}).to_list(100)
    
    # Default languages
    languages = [
        {"code": "sw", "name": "Swahili", "name_native": "Kiswahili", "status": "active"},
        {"code": "en", "name": "English", "name_native": "English", "status": "active"},
    ]
    
    # Calculate key counts per language
    for lang in languages:
        lang_translations = next((t for t in translations if t.get("language") == lang["code"]), {})
        keys = lang_translations.get("translations", {})
        lang["key_count"] = len(keys) if isinstance(keys, dict) else 0
        lang["last_updated"] = lang_translations.get("updated_at")
    
    return {
        "languages": languages,
        "total_languages": len(languages),
        "default_language": "sw"
    }


@router.get("/admin/translations/download")
async def download_translations(lang: str = Query("sw")):
    """Download translations for a language as JSON"""
    db = get_db()
    from fastapi.responses import Response
    import json
    
    translations = await db.translations.find_one(
        {"language": lang},
        {"_id": 0}
    )
    
    data = translations.get("translations", {}) if translations else {}
    
    return Response(
        content=json.dumps(data, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=translations_{lang}.json"
        }
    )


@router.post("/admin/translations/upload")
async def upload_translations(lang: str = Query("sw")):
    """Upload translations for a language"""
    db = get_db()
    from fastapi import Request
    
    # This would need to handle file upload
    # For now, accept JSON body
    return {"message": "Use PUT /admin/translations/{lang} with JSON body"}


@router.get("/translations")
async def get_translations(lang: str = Query("sw")):
    """Get translations for a language (public endpoint)"""
    db = get_db()
    
    translations = await db.translations.find_one(
        {"language": lang},
        {"_id": 0}
    )
    
    return {
        "language": lang,
        "translations": translations.get("translations", {}) if translations else {}
    }


@router.put("/admin/translations/{lang}")
async def update_translations(lang: str, data: dict):
    """Update translations for a language"""
    db = get_db()
    
    await db.translations.update_one(
        {"language": lang},
        {"$set": {
            "language": lang,
            "translations": data.get("translations", data),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": f"Translations for {lang} updated"}


# ============== USER MANAGEMENT ==============

@router.get("/admin/all-users")
async def get_admin_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    user_type: Optional[str] = None,  # 'admin', 'app', 'all'
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get all users for admin panel - includes both admin users and app users"""
    db = get_db()
    
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}}
        ]
    
    all_users = []
    
    # Get admin users (from 'users' collection)
    if user_type != 'app':
        admin_users = await db.users.find(query, {"_id": 0})\
            .sort("created_at", -1)\
            .to_list(500)
        for u in admin_users:
            u["user_type"] = "admin"
        all_users.extend(admin_users)
    
    # Get app users (from 'app_users' collection)
    if user_type != 'admin':
        app_query = {k: v for k, v in query.items() if k != 'role'}  # app_users don't have role field
        app_users = await db.app_users.find(app_query, {"_id": 0, "password_hash": 0})\
            .sort("created_at", -1)\
            .to_list(500)
        for u in app_users:
            u["user_type"] = "app"
            u["role"] = "user"  # Default role for app users
        all_users.extend(app_users)
    
    # Sort combined list by created_at
    all_users.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Apply pagination
    total = len(all_users)
    paginated_users = all_users[skip:skip + limit]
    
    return {"users": paginated_users, "total": total, "skip": skip, "limit": limit}


@router.get("/admin/users/{user_id}")
async def get_admin_user(user_id: str):
    """Get single user details with comprehensive analytics - checks both admin and app users"""
    db = get_db()
    
    # Try admin users first
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if user:
        user["user_type"] = "admin"
    else:
        # Try app users
        user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if user:
            user["user_type"] = "app"
            user["role"] = "user"
        else:
            raise HTTPException(status_code=404, detail="User not found")
    
    # Get listening statistics
    total_listens = await db.listening_sessions.count_documents({"user_id": user_id})
    total_plays = await db.listening_sessions.count_documents({"user_id": user_id, "counted_as_play": True})
    
    # Get total listening time
    listen_time_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]
    listen_time_result = await db.listening_sessions.aggregate(listen_time_pipeline).to_list(1)
    total_listen_minutes = round((listen_time_result[0]["total"] if listen_time_result else 0) / 60, 1)
    
    # Get subscription info
    subscription = await db.subscriptions.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    
    # Get transaction summary
    transaction_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$status", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    transaction_summary = await db.transactions.aggregate(transaction_pipeline).to_list(10)
    
    # Get playlists count
    playlists_count = await db.user_playlists.count_documents({"user_id": user_id})
    
    # Get liked songs count
    liked_songs_count = await db.user_likes.count_documents({"user_id": user_id})
    
    # Add analytics to user
    user["analytics"] = {
        "total_listens": total_listens,
        "total_plays": total_plays,
        "total_listen_minutes": total_listen_minutes,
        "playlists_count": playlists_count,
        "liked_songs_count": liked_songs_count,
        "transaction_summary": {s["_id"]: {"total": s["total"], "count": s["count"]} for s in transaction_summary}
    }
    user["subscription"] = subscription
    
    return user


@router.get("/admin/users/{user_id}/listening-history")
async def get_user_listening_history(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get user's listening history with content details"""
    db = get_db()
    
    # Get listening sessions
    sessions = await db.listening_sessions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("start_time", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with content details
    history = []
    for session in sessions:
        content_type = session.get("content_type")
        content_id = session.get("content_id") or session.get("song_id")
        content_info = None
        song_title = None
        artist_name = None
        thumbnail = None
        
        if content_type == "song" or (not content_type and content_id):
            content_info = await db.songs.find_one(
                {"song_id": content_id},
                {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1, "thumbnail_url": 1}
            )
            if content_info:
                song_title = content_info.get("title")
                artist_name = content_info.get("artist_name")
                thumbnail = content_info.get("thumbnail") or content_info.get("thumbnail_url")
        elif content_type == "teaching_lesson":
            content_info = await db.teaching_lessons.find_one(
                {"lesson_id": content_id},
                {"_id": 0, "lesson_id": 1, "title": 1, "title_sw": 1}
            )
            if content_info:
                song_title = content_info.get("title") or content_info.get("title_sw")
                artist_name = "Mafundisho"
        elif content_type == "album":
            content_info = await db.albums.find_one(
                {"album_id": content_id},
                {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1, "thumbnail_url": 1}
            )
            if content_info:
                song_title = content_info.get("title")
                artist_name = content_info.get("artist_name")
                thumbnail = content_info.get("thumbnail") or content_info.get("thumbnail_url")
        elif content_type == "radio":
            song_title = session.get("station_name", "Radio Station")
            artist_name = "Live Radio"
        
        # Format duration
        duration_seconds = session.get("duration_seconds", 0)
        if duration_seconds >= 3600:
            duration_str = f"{duration_seconds // 3600}h {(duration_seconds % 3600) // 60}m"
        elif duration_seconds >= 60:
            duration_str = f"{duration_seconds // 60}m {duration_seconds % 60}s"
        else:
            duration_str = f"{duration_seconds}s"
        
        history.append({
            "session_id": session.get("session_id"),
            "content_type": content_type or "song",
            "content_id": content_id,
            "song_title": song_title or "Unknown Track",
            "artist_name": artist_name or "Unknown Artist",
            "thumbnail": thumbnail,
            "duration_listened": duration_str,
            "duration_seconds": duration_seconds,
            "listened_at": session.get("start_time") or session.get("end_time"),
            "platform": session.get("platform", "unknown"),
            "counted_as_play": session.get("counted_as_play", False),
            "content_info": content_info
        })
    
    total = await db.listening_sessions.count_documents({"user_id": user_id})
    
    return {"history": history, "total": total, "skip": skip, "limit": limit}


@router.get("/admin/users/{user_id}/downloads")
async def get_user_downloads(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get user's downloaded songs"""
    db = get_db()
    
    # Get user's downloads from app_users collection
    user = await db.app_users.find_one(
        {"user_id": user_id},
        {"_id": 0, "downloads": 1}
    )
    
    downloads = user.get("downloads", []) if user else []
    
    # Enrich with song details
    enriched_downloads = []
    for download in downloads[skip:skip+limit]:
        song_id = download.get("song_id") if isinstance(download, dict) else download
        
        # Get song details
        song = await db.songs.find_one(
            {"song_id": song_id},
            {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1, "thumbnail_url": 1, "duration": 1}
        )
        
        if song:
            enriched_downloads.append({
                "song_id": song_id,
                "title": song.get("title", "Unknown Track"),
                "artist_name": song.get("artist_name", "Unknown Artist"),
                "thumbnail": song.get("thumbnail") or song.get("thumbnail_url"),
                "duration": song.get("duration", 0),
                "downloaded_at": download.get("downloaded_at") if isinstance(download, dict) else None
            })
    
    return {
        "downloads": enriched_downloads,
        "total": len(downloads),
        "skip": skip,
        "limit": limit
    }


@router.get("/admin/users/{user_id}/transactions")
async def get_user_transactions(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get user's transaction history"""
    db = get_db()
    
    transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.transactions.count_documents({"user_id": user_id})
    
    # Calculate totals
    total_spent = sum(t.get("amount", 0) for t in transactions if t.get("status") == "completed")
    
    return {
        "transactions": transactions,
        "total": total,
        "total_spent": total_spent,
        "skip": skip,
        "limit": limit
    }


@router.get("/admin/users/{user_id}/playlists")
async def get_user_playlists(user_id: str):
    """Get user's playlists"""
    db = get_db()
    
    playlists = await db.user_playlists.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"playlists": playlists, "count": len(playlists)}


@router.get("/admin/users/{user_id}/liked-songs")
async def get_user_liked_songs(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get user's liked songs"""
    db = get_db()
    
    likes = await db.user_likes.find(
        {"user_id": user_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with song details
    liked_songs = []
    for like in likes:
        song = await db.songs.find_one(
            {"song_id": like.get("song_id")},
            {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1}
        )
        if song:
            liked_songs.append({**like, "song": song})
    
    total = await db.user_likes.count_documents({"user_id": user_id})
    
    return {"liked_songs": liked_songs, "total": total}


@router.put("/admin/users/{user_id}")
async def update_admin_user(user_id: str, data: dict):
    """Update user"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("user_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.users.update_one({"user_id": user_id}, {"$set": data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated"}


@router.delete("/admin/users/{user_id}")
async def delete_admin_user(user_id: str, request: Request):
    """Delete a single user (admin OR app user) by id.

    Searches both collections so the admin can delete any user in one call.
    Also cascades to clean up subscriptions, listening sessions and downloads
    for the deleted app user (admin records are removed as-is).
    """
    db = get_db()
    
    # Admin user first
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count > 0:
        return {"message": "Admin user deleted", "user_type": "admin", "deleted": 1}
    
    # Fall back to app_users with cascade cleanup
    result = await db.app_users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cascade: remove related data the admin would expect to disappear with
    # the user. We do it fire-and-forget style — failures here are logged
    # but never block the user deletion itself.
    try:
        await db.subscriptions.delete_many({"user_id": user_id})
        await db.listening_sessions.delete_many({"user_id": user_id})
        await db.downloads.delete_many({"user_id": user_id})
        await db.user_tokens.delete_many({"user_id": user_id})
        await db.active_listeners.delete_many({"user_id": user_id})
    except Exception as e:
        logger.warning(f"Cascade cleanup for {user_id} partially failed: {e}")
    
    return {"message": "User deleted", "user_type": "app", "deleted": 1}


@router.post("/admin/users/bulk-delete")
async def bulk_delete_users(data: dict, request: Request):
    """Bulk delete multiple users.

    Payload: {"user_ids": [...], "confirmation": "delete N"}
    The `confirmation` MUST literally read "delete <count>" (case-insensitive)
    where <count> matches len(user_ids). This is a hard double-confirmation:
    the client UI ALSO asks the admin to type the same string, AND we
    re-verify here to prevent any accidental bulk deletion.
    """
    db = get_db()
    
    user_ids = data.get("user_ids") or []
    if not isinstance(user_ids, list) or not user_ids:
        raise HTTPException(status_code=400, detail="user_ids must be a non-empty list")
    
    # Server-side guard: max 500 per call to limit blast radius if a client bug
    # ever sends thousands.
    if len(user_ids) > 500:
        raise HTTPException(status_code=400, detail="Cannot delete more than 500 users in a single call")
    
    # Confirmation phrase MUST be "delete <count>" (case-insensitive).
    confirmation = (data.get("confirmation") or "").strip().lower()
    expected = f"delete {len(user_ids)}"
    if confirmation != expected:
        raise HTTPException(
            status_code=400,
            detail=f"Confirmation phrase must be exactly '{expected}'",
        )
    
    # Audit log of what's being deleted (for forensic recovery if needed).
    # Snapshot the users into an audit collection BEFORE deletion.
    snapshots = await db.app_users.find(
        {"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(user_ids))
    admin_snaps = await db.users.find(
        {"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}
    ).to_list(len(user_ids))
    if snapshots or admin_snaps:
        try:
            await db.deleted_users_audit.insert_many([
                {
                    "user_id": s.get("user_id"),
                    "email": s.get("email"),
                    "name": s.get("name"),
                    "user_type": "app" if s in snapshots else "admin",
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "snapshot": s,
                }
                for s in (list(snapshots) + list(admin_snaps))
            ])
        except Exception as e:
            logger.warning(f"Could not write deletion audit: {e}")
    
    # Delete from both collections.
    app_res = await db.app_users.delete_many({"user_id": {"$in": user_ids}})
    admin_res = await db.users.delete_many({"user_id": {"$in": user_ids}})
    
    # Cascade cleanup — best-effort
    try:
        await db.subscriptions.delete_many({"user_id": {"$in": user_ids}})
        await db.listening_sessions.delete_many({"user_id": {"$in": user_ids}})
        await db.downloads.delete_many({"user_id": {"$in": user_ids}})
        await db.user_tokens.delete_many({"user_id": {"$in": user_ids}})
        await db.active_listeners.delete_many({"user_id": {"$in": user_ids}})
    except Exception as e:
        logger.warning(f"Bulk cascade cleanup partially failed: {e}")
    
    return {
        "message": "Users deleted",
        "requested": len(user_ids),
        "deleted_app_users": app_res.deleted_count,
        "deleted_admin_users": admin_res.deleted_count,
        "total_deleted": app_res.deleted_count + admin_res.deleted_count,
    }


@router.post("/admin/users")
async def create_admin_user(data: dict):
    """Create a new admin user"""
    db = get_db()
    
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": data.get("name", ""),
        "picture": data.get("picture"),
        "role": data.get("role", "admin"),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    user.pop("_id", None)
    
    return user


@router.get("/admin/users/stats/summary")
async def get_user_stats_summary():
    """Get user statistics summary - includes both admin and app users"""
    db = get_db()
    
    # Count admin users
    admin_total = await db.users.count_documents({})
    admin_by_role = await db.users.aggregate([
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]).to_list(20)
    admin_by_status = await db.users.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    # Count app users
    app_total = await db.app_users.count_documents({})
    app_by_subscription = await db.app_users.aggregate([
        {"$group": {"_id": "$subscription_type", "count": {"$sum": 1}}}
    ]).to_list(10)
    app_by_status = await db.app_users.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    # Count app users by registration method
    app_by_register = await db.app_users.aggregate([
        {"$group": {"_id": {"$ifNull": ["$register_by", "email"]}, "count": {"$sum": 1}}}
    ]).to_list(10)
    
    return {
        "total": admin_total + app_total,
        "admin_users": admin_total,
        "app_users": app_total,
        "by_role": {r["_id"]: r["count"] for r in admin_by_role},
        "by_status": {
            **({"admin_" + str(s["_id"]): s["count"] for s in admin_by_status}),
            **({"app_" + str(s["_id"]): s["count"] for s in app_by_status})
        },
        "by_subscription": {str(s["_id"] or "free"): s["count"] for s in app_by_subscription},
        "by_register_method": {str(r["_id"]): r["count"] for r in app_by_register}
    }


# ============== CHOIR ADMIN ==============

@router.get("/admin/choirs")
async def get_admin_choirs(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get all choirs for admin"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    choirs = await db.singers.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.singers.count_documents(query)
    
    return {"choirs": choirs, "total": total}


@router.get("/admin/choirs/{choir_id}")
async def get_admin_choir(choir_id: str):
    """Get full choir profile + play analytics for the admin choir-details page.

    Returns ``{choir, account, albums, analytics}`` where ``analytics`` has the
    same shape as the choir self-service dashboard (summary/top_songs/etc.).
    """
    db = get_db()
    from core.play_analytics import get_choir_play_analytics

    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")

    account = await db.choir_accounts.find_one(
        {"choir_id": choir_id},
        {"_id": 0, "password_hash": 0}
    )

    # Albums (return with both possible owner key so legacy + new rows are caught)
    albums = await db.albums.find(
        {"$or": [{"artist_id": choir_id}, {"singer_id": choir_id}]},
        {"_id": 0}
    ).to_list(200)

    analytics = await get_choir_play_analytics(choir_id, account=account)

    # Inject the latest play counts into the legacy `albums` list so the
    # admin page shows real numbers next to each album without changing its UI.
    plays_by_album = {a["album_id"]: a["plays"] for a in analytics["albums"]}
    for a in albums:
        a["plays"] = plays_by_album.get(a.get("album_id"), int(a.get("total_plays") or 0))

    return {
        "choir": choir,
        "account": account,
        "albums": albums,
        "analytics": analytics,
    }


@router.put("/admin/choirs/{choir_id}")
async def update_admin_choir(choir_id: str, data: dict):
    """Update choir"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("singer_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.singers.update_one({"singer_id": choir_id}, {"$set": data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    return {"message": "Choir updated"}


@router.post("/admin/choirs")
async def create_admin_choir(data: dict):
    """Create a new choir"""
    db = get_db()
    
    choir = {
        "singer_id": f"sing_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "type": data.get("type", "choir"),
        "denomination": data.get("denomination"),
        "church_id": data.get("church_id"),
        "church_name": data.get("church_name"),
        "location": data.get("location"),
        "country": data.get("country", "Tanzania"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "bio": data.get("bio"),
        "thumbnail": data.get("thumbnail"),
        "cover_image": data.get("cover_image"),
        "followers_count": 0,
        "total_plays": 0,
        "albums_count": 0,
        "songs_count": 0,
        "status": "active",
        "approval_status": "approved",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.singers.insert_one(choir)
    choir.pop("_id", None)
    
    return choir


@router.post("/admin/choir/{choir_id}/approve")
async def approve_choir(choir_id: str):
    """Approve choir registration"""
    db = get_db()
    
    await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": {
            "status": "active",
            "approval_status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.choir_accounts.update_one(
        {"choir_id": choir_id},
        {"$set": {"status": "approved"}}
    )
    
    return {"message": "Choir approved"}


@router.post("/admin/choir/{choir_id}/reject")
async def reject_choir(choir_id: str, data: dict = None):
    """Reject choir registration"""
    db = get_db()
    
    await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": {
            "status": "rejected",
            "approval_status": "rejected",
            "admin_notes": (data or {}).get("reason")
        }}
    )
    
    await db.choir_accounts.update_one(
        {"choir_id": choir_id},
        {"$set": {"status": "rejected"}}
    )
    
    return {"message": "Choir rejected"}


# ============== CATEGORY PERMISSIONS ==============

@router.get("/admin/category-permissions")
async def get_category_permissions():
    """Get category-based permissions for content management"""
    db = get_db()
    
    # Get permission configurations from DB or use defaults
    configs = await db.category_permissions.find({}, {"_id": 0}).to_list(20)
    
    if not configs:
        # Return default categories
        configs = [
            {"category_id": "gospel", "name": "Gospel Music", "role_id": "role_admin", "permissions": ["create", "edit", "delete", "approve"]},
            {"category_id": "worship", "name": "Worship Music", "role_id": "role_moderator", "permissions": ["create", "edit", "approve"]},
            {"category_id": "hymns", "name": "Traditional Hymns", "role_id": "role_choir_admin", "permissions": ["create", "edit"]},
            {"category_id": "christmas", "name": "Christmas Songs", "role_id": "role_admin", "permissions": ["create", "edit", "delete", "approve"]},
            {"category_id": "lent", "name": "Lent & Easter", "role_id": "role_admin", "permissions": ["create", "edit", "delete", "approve"]},
        ]
    
    return {"categories": configs}


@router.post("/admin/category-permissions")
async def update_category_permissions(data: dict):
    """Update category-based permissions"""
    db = get_db()
    
    category_id = data.get("category_id")
    permissions = data.get("permissions", [])
    role_id = data.get("role_id")
    
    if not category_id:
        raise HTTPException(status_code=400, detail="category_id required")
    
    await db.category_permissions.update_one(
        {"category_id": category_id},
        {"$set": {
            "permissions": permissions,
            "role_id": role_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Category permissions updated"}


# ============== ALBUM ADMIN ==============

@router.get("/admin/albums")
async def get_admin_albums(
    status: Optional[str] = None,
    artist_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get all albums for admin. Cached 30s (admin lists change often)."""
    db = get_db()
    
    cache_key = f"admin:albums:list:{status}:{artist_id}:{skip}:{limit}"
    cached = await app_cache.get(cache_key)
    if cached:
        return cached
    
    query = {}
    if status:
        query["status"] = status
    if artist_id:
        query["artist_id"] = artist_id
    
    # Parallel find + count.
    import asyncio
    albums_task = db.albums.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    count_task = db.albums.count_documents(query)
    albums, total = await asyncio.gather(albums_task, count_task)
    
    result = {"albums": albums, "total": total}
    await app_cache.set(cache_key, result, 30)
    return result


@router.get("/admin/albums/{album_id}")
async def get_admin_album(album_id: str):
    """Get album details for admin"""
    db = get_db()
    
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    songs = await db.songs.find(
        {"album_id": album_id},
        {"_id": 0}
    ).sort("track_number", 1).to_list(100)
    
    return {"album": album, "songs": songs}


@router.put("/admin/albums/{album_id}")
async def update_admin_album(album_id: str, data: dict):
    """Update album"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("album_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.albums.update_one({"album_id": album_id}, {"$set": data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    
    return {"message": "Album updated"}


@router.put("/admin/songs/{song_id}")
async def update_admin_song(song_id: str, data: dict):
    """Update song"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("song_id", None)
    
    result = await db.songs.update_one({"song_id": song_id}, {"$set": data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    
    return {"message": "Song updated"}


@router.post("/admin/albums/{album_id}/approve")
async def approve_album(album_id: str):
    """Approve album"""
    db = get_db()
    
    await db.albums.update_one(
        {"album_id": album_id},
        {"$set": {
            "status": "active",
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Album approved"}


# ============== CONTENT REQUESTS ==============

@router.get("/admin/content-requests")
async def get_content_requests(status: Optional[str] = None):
    """Get content requests"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.choir_content_requests.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .to_list(200)
    
    return {"requests": requests}


@router.put("/admin/content-requests/{request_id}")
async def process_content_request(request_id: str, data: dict):
    """Process (approve/reject) content request"""
    db = get_db()
    
    action = data.get("action", "approve")
    
    request = await db.choir_content_requests.find_one({"request_id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if action == "approve":
        # Create the content
        content_data = request.get("content_data", {})
        
        if request["request_type"] == "album_create":
            album = {
                "album_id": f"alb_{uuid.uuid4().hex[:12]}",
                "artist_id": request["choir_id"],
                "artist_name": request["choir_name"],
                "status": "active",
                "songs_count": 0,
                "total_plays": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                **content_data
            }
            await db.albums.insert_one(album)
        
        elif request["request_type"] == "song_upload":
            song = {
                "song_id": f"song_{uuid.uuid4().hex[:12]}",
                "status": "active",
                "plays": 0,
                "likes": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                **content_data
            }
            await db.songs.insert_one(song)
            
            # Update album song count
            await db.albums.update_one(
                {"album_id": content_data.get("album_id")},
                {"$inc": {"songs_count": 1}}
            )
        
        await db.choir_content_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "approved",
                "processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Content approved and created"}
    
    else:
        await db.choir_content_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "rejected",
                "admin_notes": data.get("reason"),
                "processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Content request rejected"}


# ============== WITHDRAWAL ADMIN ==============

@router.get("/withdrawal/requests")
async def get_withdrawal_requests(status: Optional[str] = None):
    """Get all withdrawal requests"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.withdrawal_requests.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .to_list(200)
    
    return {"requests": requests}


@router.put("/withdrawal/{request_id}")
async def process_withdrawal(request_id: str, data: dict):
    """Process withdrawal request"""
    db = get_db()
    
    action = data.get("action", "approve")
    
    request = await db.withdrawal_requests.find_one({"request_id": request_id})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if action == "approve":
        # Deduct from balance
        await db.choir_accounts.update_one(
            {"choir_id": request["choir_id"]},
            {
                "$inc": {
                    "current_balance": -request["amount"],
                    "total_withdrawn": request["amount"]
                }
            }
        )
        
        await db.withdrawal_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "completed",
                "processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Withdrawal approved"}
    
    else:
        await db.withdrawal_requests.update_one(
            {"request_id": request_id},
            {"$set": {
                "status": "rejected",
                "admin_notes": data.get("reason"),
                "processed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Withdrawal rejected"}


# ============== SMS LOGS ==============

@router.get("/admin/sms-logs")
async def get_sms_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get SMS notification logs"""
    db = get_db()
    
    logs = await db.sms_notifications.find({}, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    return {"logs": logs}


@router.post("/admin/sms/send")
async def send_sms(data: dict):
    """Send SMS (mock)"""
    db = get_db()
    
    sms = {
        "sms_id": f"sms_{uuid.uuid4().hex[:12]}",
        "recipient_phone": data.get("phone"),
        "message": data.get("message"),
        "status": "mock_sent",
        "provider": "mock",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sms_notifications.insert_one(sms)
    sms.pop("_id", None)
    
    return {"message": "SMS sent (mock)", "sms": sms}


# ============== ADMIN NOTIFICATIONS ==============

@router.get("/admin/notifications")
async def get_admin_notifications():
    """Get admin notifications"""
    db = get_db()
    
    notifications = await db.admin_notifications.find({}, {"_id": 0})\
        .sort("created_at", -1)\
        .limit(50)\
        .to_list(50)
    
    return {"notifications": notifications}


@router.put("/admin/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark notification as read"""
    db = get_db()
    
    await db.admin_notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True}}
    )
    
    return {"message": "Marked as read"}


@router.put("/admin/notifications/read-all")
async def mark_all_notifications_read():
    """Mark all notifications as read"""
    db = get_db()
    
    await db.admin_notifications.update_many({}, {"$set": {"read": True}})
    
    return {"message": "All marked as read"}



# ============== APPROVALS ==============

@router.get("/approvals")
async def get_pending_approvals():
    """Get all pending approvals"""
    db = get_db()
    
    # Get pending churches
    churches = await db.churches.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    # Get pending choir registrations
    choirs = await db.singers.find(
        {"approval_status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    # Get pending leader registrations
    leaders = await db.church_leader_accounts.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    # Get pending posts
    posts = await db.posts.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    total = len(churches) + len(choirs) + len(leaders) + len(posts)
    
    return {
        "churches": churches,
        "choirs": choirs,
        "leaders": leaders,
        "posts": posts,
        "total": total
    }


@router.post("/approvals/approve")
async def approve_item(data: dict):
    """Approve an item"""
    db = get_db()
    
    item_type = data.get("type")
    item_id = data.get("id")
    
    if item_type == "church":
        await db.churches.update_one(
            {"church_id": item_id},
            {"$set": {"status": "active", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif item_type == "choir":
        await db.singers.update_one(
            {"singer_id": item_id},
            {"$set": {"approval_status": "approved", "status": "active", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.choir_accounts.update_one(
            {"choir_id": item_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif item_type == "leader":
        await db.church_leader_accounts.update_one(
            {"account_id": item_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif item_type == "post":
        await db.posts.update_one(
            {"post_id": item_id},
            {"$set": {"status": "published", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid type")
    
    return {"message": "Approved successfully"}


@router.post("/approvals/reject")
async def reject_item(data: dict):
    """Reject an item"""
    db = get_db()
    
    item_type = data.get("type")
    item_id = data.get("id")
    reason = data.get("reason", "")
    
    if item_type == "church":
        await db.churches.update_one(
            {"church_id": item_id},
            {"$set": {"status": "rejected", "rejection_reason": reason}}
        )
    elif item_type == "choir":
        await db.singers.update_one(
            {"singer_id": item_id},
            {"$set": {"approval_status": "rejected", "status": "rejected", "rejection_reason": reason}}
        )
        await db.choir_accounts.update_one(
            {"choir_id": item_id},
            {"$set": {"status": "rejected", "rejection_reason": reason}}
        )
    elif item_type == "leader":
        await db.church_leader_accounts.update_one(
            {"account_id": item_id},
            {"$set": {"status": "rejected", "rejection_reason": reason}}
        )
    elif item_type == "post":
        await db.posts.update_one(
            {"post_id": item_id},
            {"$set": {"status": "rejected", "rejection_reason": reason}}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid type")
    
    return {"message": "Rejected"}


# ============== CHOIR REGISTRATIONS ==============

@router.get("/admin/choir-registrations")
async def get_choir_registrations(status: Optional[str] = None):
    """Get choir registrations"""
    db = get_db()
    
    query = {}
    if status:
        query["approval_status"] = status
    else:
        query["approval_status"] = "pending"
    
    registrations = await db.singers.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Get accounts too
    for reg in registrations:
        account = await db.choir_accounts.find_one({"choir_id": reg["singer_id"]}, {"_id": 0, "password_hash": 0})
        if account:
            reg["account"] = account
    
    return {"registrations": registrations}


# ============== PAYMENT REQUESTS ==============

@router.get("/admin/payment-requests")
async def get_payment_requests(status: Optional[str] = None):
    """Get payment requests"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.payment_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"requests": requests}


# ============== CONTENT EDIT REQUESTS ==============

@router.get("/admin/content-edit-requests")
async def get_content_edit_requests(status: Optional[str] = None):
    """Get content edit requests"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.content_edit_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"requests": requests}


# ============== CHURCH LEADER ACCOUNTS ==============

@router.get("/church-leader/accounts")
async def get_church_leader_accounts():
    """Get church leader accounts"""
    db = get_db()
    
    accounts = await db.church_leader_accounts.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(100)
    
    return {"accounts": accounts}


# ============== TRANSACTIONS MANAGEMENT ==============

@router.get("/admin/transactions")
async def get_admin_transactions(
    status: Optional[str] = Query(None),
    gateway: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get all transactions with filtering"""
    db = get_db()
    from datetime import timedelta
    
    query = {}
    if status:
        query["status"] = status
    if gateway:
        query["payment_method"] = gateway
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.transactions.count_documents(query)
    
    # Calculate stats
    stats_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }}
    ]
    stats_result = await db.transactions.aggregate(stats_pipeline).to_list(10)
    
    stats = {
        "total_transactions": total,
        "total_revenue": sum(s["total_amount"] for s in stats_result if s["_id"] == "completed"),
        "by_status": {s["_id"]: {"count": s["count"], "amount": s["total_amount"]} for s in stats_result}
    }
    
    # Enrich with user info
    for tx in transactions:
        if tx.get("user_id"):
            user = await db.app_users.find_one(
                {"user_id": tx["user_id"]},
                {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1}
            )
            tx["user"] = user
    
    return {
        "transactions": transactions,
        "total": total,
        "stats": stats,
        "skip": skip,
        "limit": limit
    }


@router.get("/admin/transactions/{transaction_id}")
async def get_transaction_detail(transaction_id: str):
    """Get single transaction details"""
    db = get_db()
    
    tx = await db.transactions.find_one(
        {"transaction_id": transaction_id},
        {"_id": 0}
    )
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get user info
    if tx.get("user_id"):
        user = await db.app_users.find_one(
            {"user_id": tx["user_id"]},
            {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1}
        )
        tx["user"] = user
    
    return tx


@router.post("/admin/transactions/{transaction_id}/refund")
async def refund_transaction(transaction_id: str, data: dict):
    """Process a refund for a transaction"""
    db = get_db()
    
    tx = await db.transactions.find_one({"transaction_id": transaction_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if tx.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only refund completed transactions")
    
    # Update transaction
    await db.transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {
            "status": "refunded",
            "refund_reason": data.get("reason"),
            "refunded_at": datetime.now(timezone.utc).isoformat(),
            "refunded_by": data.get("admin_id")
        }}
    )
    
    # Update user subscription if applicable
    if tx.get("user_id") and tx.get("type") == "subscription":
        await db.app_users.update_one(
            {"user_id": tx["user_id"]},
            {"$set": {
                "subscription_type": "free",
                "subscription_expires": None
            }}
        )
    
    return {"message": "Refund processed", "transaction_id": transaction_id}


@router.get("/admin/transactions/export")
async def export_transactions(
    status: Optional[str] = Query(None),
    gateway: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    format: str = Query("csv")
):
    """Export transactions as CSV or JSON"""
    db = get_db()
    from fastapi.responses import StreamingResponse
    import io
    import csv
    
    query = {}
    if status:
        query["status"] = status
    if gateway:
        query["payment_method"] = gateway
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    if format == "csv":
        output = io.StringIO()
        if transactions:
            fieldnames = ["transaction_id", "user_id", "amount", "currency", "status", 
                         "payment_method", "plan_name", "created_at", "completed_at"]
            writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            for tx in transactions:
                writer.writerow(tx)
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=transactions.csv"}
        )
    
    return {"transactions": transactions, "total": len(transactions)}


@router.get("/admin/payment/gateways")
async def get_payment_gateways():
    """Get available payment gateways"""
    db = get_db()
    
    # Get unique gateways from transactions
    gateways_pipeline = [
        {"$group": {"_id": "$payment_method", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    used_gateways = await db.transactions.aggregate(gateways_pipeline).to_list(20)
    
    # Default gateways
    default_gateways = [
        {"id": "mpesa", "name": "M-Pesa", "status": "active"},
        {"id": "tigopesa", "name": "Tigo Pesa", "status": "active"},
        {"id": "airtel", "name": "Airtel Money", "status": "active"},
        {"id": "halopesa", "name": "Halo Pesa", "status": "active"},
        {"id": "azampay", "name": "AzamPay", "status": "active"},
    ]
    
    # Merge with usage stats
    for gw in default_gateways:
        usage = next((g for g in used_gateways if g["_id"] == gw["id"]), None)
        gw["transactions"] = usage["count"] if usage else 0
    
    return {"gateways": default_gateways}



# ============== PLAY STATISTICS & REVENUE ==============

@router.get("/admin/play-stats")
async def get_play_statistics(
    period: str = Query("30d", description="Period: 7d, 30d, 90d"),
    content_type: Optional[str] = Query(None, description="Filter by content type: song, album, teaching")
):
    """
    Get comprehensive play statistics for admin panel.
    Shows play counts, revenue, and trends.
    """
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}.get(period, 30)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Base query
    query = {"start_time": {"$gte": start_date}}
    if content_type:
        query["content_type"] = content_type
    
    # Total plays in period (only counted plays)
    total_plays = await db.listening_sessions.count_documents({
        **query, 
        "counted_as_play": True
    })
    
    # Total plays all time
    all_time_plays = await db.listening_sessions.count_documents({"counted_as_play": True})
    
    # Total listening time
    duration_pipeline = [
        {"$match": query},
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]
    duration_result = await db.listening_sessions.aggregate(duration_pipeline).to_list(1)
    total_listen_seconds = duration_result[0]["total"] if duration_result else 0
    total_listen_hours = round(total_listen_seconds / 3600, 1)
    
    # Revenue from plays
    revenue_pipeline = [
        {"$match": {**query, "counted_as_play": True}},
        {"$group": {
            "_id": None, 
            "total_revenue": {"$sum": {"$ifNull": ["$revenue_earned", 0]}},
            "choir_revenue": {"$sum": {"$ifNull": ["$choir_revenue", 0]}}
        }}
    ]
    revenue_result = await db.listening_sessions.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
    choir_revenue = revenue_result[0]["choir_revenue"] if revenue_result else 0
    
    # Plays by subscription type
    sub_type_pipeline = [
        {"$match": {**query, "counted_as_play": True}},
        {"$group": {
            "_id": "$subscription_type",
            "count": {"$sum": 1},
            "duration": {"$sum": "$duration_seconds"},
            "revenue": {"$sum": {"$ifNull": ["$revenue_earned", 0]}}
        }}
    ]
    by_subscription = await db.listening_sessions.aggregate(sub_type_pipeline).to_list(10)
    
    # Top songs by play count
    top_songs = await db.songs.find(
        {"status": "active"},
        {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "play_count": 1, "plays": 1, "album_id": 1}
    ).sort("play_count", -1).limit(20).to_list(20)
    
    # Top albums by play count
    top_albums = await db.albums.find(
        {"status": "active"},
        {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "total_plays": 1, "play_count": 1}
    ).sort("total_plays", -1).limit(10).to_list(10)
    
    # Daily play trends
    daily_pipeline = [
        {"$match": {**query, "counted_as_play": True}},
        {"$addFields": {"date": {"$substr": ["$start_time", 0, 10]}}},
        {"$group": {
            "_id": "$date",
            "plays": {"$sum": 1},
            "duration_minutes": {"$sum": {"$divide": ["$duration_seconds", 60]}},
            "revenue": {"$sum": {"$ifNull": ["$revenue_earned", 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_trend = await db.listening_sessions.aggregate(daily_pipeline).to_list(days)
    
    # Plays by platform
    platform_pipeline = [
        {"$match": {**query, "counted_as_play": True}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}}
    ]
    by_platform = await db.listening_sessions.aggregate(platform_pipeline).to_list(10)
    
    # Premium vs Standard content plays
    content_type_pipeline = [
        {"$match": {**query, "counted_as_play": True}},
        {"$group": {
            "_id": "$is_premium_content",
            "count": {"$sum": 1},
            "revenue": {"$sum": {"$ifNull": ["$revenue_earned", 0]}}
        }}
    ]
    by_content_tier = await db.listening_sessions.aggregate(content_type_pipeline).to_list(2)
    
    # Get revenue settings for reference
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {
            "premium_rate_per_hour": 10,
            "standard_rate_per_hour": 5,
            "platform_share_percentage": 30
        }
    
    return {
        "period": period,
        "overview": {
            "total_plays": total_plays,
            "all_time_plays": all_time_plays,
            "total_listen_hours": total_listen_hours,
            "total_revenue": round(total_revenue, 2),
            "choir_revenue_share": round(choir_revenue, 2),
            "platform_revenue_share": round(total_revenue - choir_revenue, 2),
            "average_play_duration_seconds": round(total_listen_seconds / max(total_plays, 1), 1),
            "minimum_play_seconds": 45
        },
        "by_subscription_type": [
            {
                "type": s["_id"] or "unknown",
                "plays": s["count"],
                "listen_hours": round(s["duration"] / 3600, 1),
                "revenue": round(s["revenue"], 2)
            } for s in by_subscription
        ],
        "by_content_tier": [
            {
                "tier": "premium" if c["_id"] else "standard",
                "plays": c["count"],
                "revenue": round(c["revenue"], 2)
            } for c in by_content_tier
        ],
        "by_platform": [{"platform": p["_id"] or "unknown", "plays": p["count"]} for p in by_platform],
        "top_songs": top_songs,
        "top_albums": top_albums,
        "daily_trend": [
            {
                "date": d["_id"],
                "plays": d["plays"],
                "listen_minutes": round(d["duration_minutes"], 1),
                "revenue": round(d["revenue"], 2)
            } for d in daily_trend
        ],
        "revenue_settings": settings
    }


@router.get("/admin/play-stats/song/{song_id}")
async def get_song_play_details(song_id: str, period: str = Query("30d")):
    """Get detailed play statistics for a specific song"""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get song details
    song = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Get listening sessions for this song
    sessions = await db.listening_sessions.find({
        "song_id": song_id,
        "start_time": {"$gte": start_date}
    }, {"_id": 0}).to_list(10000)
    
    # Calculate stats
    counted_plays = sum(1 for s in sessions if s.get("counted_as_play"))
    total_duration = sum(s.get("duration_seconds", 0) for s in sessions)
    total_revenue = sum(s.get("revenue_earned", 0) for s in sessions if s.get("counted_as_play"))
    unique_listeners = len(set(s.get("user_id") for s in sessions if s.get("user_id")))
    
    # By subscription
    premium_plays = sum(1 for s in sessions if s.get("counted_as_play") and s.get("subscription_type") == "premium")
    free_plays = counted_plays - premium_plays
    
    return {
        "song": song,
        "period": period,
        "stats": {
            "total_sessions": len(sessions),
            "counted_plays": counted_plays,
            "unique_listeners": unique_listeners,
            "total_listen_minutes": round(total_duration / 60, 1),
            "total_revenue": round(total_revenue, 2),
            "premium_plays": premium_plays,
            "free_plays": free_plays,
            "average_duration_seconds": round(total_duration / max(len(sessions), 1), 1)
        }
    }


@router.get("/admin/choir-revenue/{choir_id}")
async def get_choir_revenue_detail(choir_id: str, period: str = Query("30d")):
    """Get detailed revenue for a specific choir"""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get choir info
    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    # Get choir account
    account = await db.choir_accounts.find_one(
        {"choir_id": choir_id}, 
        {"_id": 0, "password_hash": 0}
    )
    
    # Get albums by this choir
    albums = await db.albums.find(
        {"singer_id": choir_id},
        {"_id": 0, "album_id": 1, "title": 1, "total_plays": 1, "play_count": 1}
    ).to_list(100)
    
    album_ids = [a["album_id"] for a in albums]
    
    # Get songs from these albums
    songs = await db.songs.find(
        {"album_id": {"$in": album_ids}},
        {"_id": 0, "song_id": 1, "title": 1, "play_count": 1}
    ).to_list(500)
    
    song_ids = [s["song_id"] for s in songs]
    
    # Get listening sessions for these songs
    sessions = await db.listening_sessions.find({
        "song_id": {"$in": song_ids},
        "counted_as_play": True,
        "start_time": {"$gte": start_date}
    }, {"_id": 0}).to_list(10000)
    
    total_plays = len(sessions)
    total_duration = sum(s.get("duration_seconds", 0) for s in sessions)
    period_revenue = sum(s.get("choir_revenue", 0) for s in sessions)
    
    return {
        "choir": choir,
        "account": account,
        "period": period,
        "stats": {
            "total_albums": len(albums),
            "total_songs": len(songs),
            "period_plays": total_plays,
            "period_listen_hours": round(total_duration / 3600, 1),
            "period_revenue": round(period_revenue, 2),
            "current_balance": account.get("current_balance", 0) if account else 0,
            "total_earned": account.get("total_earned", 0) if account else 0,
            "total_withdrawn": account.get("total_withdrawn", 0) if account else 0
        },
        "top_songs": sorted(songs, key=lambda x: x.get("play_count", 0), reverse=True)[:10],
        "albums": albums
    }



# ============== CHOIR MANAGEMENT WITH AUDIT ==============

@router.post("/admin/choir/{choir_id}/disable")
async def disable_choir(choir_id: str, request: Request, data: dict = None):
    """Disable a choir account - keeps data but prevents login and activity"""
    db = get_db()
    
    # Get admin info from session/cookies
    admin_email = request.cookies.get("admin_email", "admin")
    
    # Check choir exists
    choir = await db.singers.find_one({"singer_id": choir_id})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    reason = (data or {}).get("reason", "Disabled by admin")
    
    # Update choir status
    await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": {
            "status": "disabled",
            "disabled_at": datetime.now(timezone.utc).isoformat(),
            "disabled_by": admin_email,
            "disabled_reason": reason
        }}
    )
    
    # Update choir account status
    await db.choir_accounts.update_one(
        {"choir_id": choir_id},
        {"$set": {"status": "disabled"}}
    )
    
    # Create audit log
    audit_log = {
        "log_id": f"audit_{uuid.uuid4().hex[:12]}",
        "action": "choir_disabled",
        "entity_type": "choir",
        "entity_id": choir_id,
        "entity_name": choir.get("name"),
        "performed_by": admin_email,
        "reason": reason,
        "previous_status": choir.get("status"),
        "new_status": "disabled",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log)
    
    return {"success": True, "message": f"Choir '{choir.get('name')}' has been disabled"}


@router.post("/admin/choir/{choir_id}/enable")
async def enable_choir(choir_id: str, request: Request, data: dict = None):
    """Re-enable a disabled choir account"""
    db = get_db()
    
    admin_email = request.cookies.get("admin_email", "admin")
    
    choir = await db.singers.find_one({"singer_id": choir_id})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    reason = (data or {}).get("reason", "Enabled by admin")
    
    # Update choir status
    await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": {
            "status": "active",
            "enabled_at": datetime.now(timezone.utc).isoformat(),
            "enabled_by": admin_email
        },
        "$unset": {
            "disabled_at": "",
            "disabled_by": "",
            "disabled_reason": ""
        }}
    )
    
    # Update choir account status
    await db.choir_accounts.update_one(
        {"choir_id": choir_id},
        {"$set": {"status": "approved"}}
    )
    
    # Create audit log
    audit_log = {
        "log_id": f"audit_{uuid.uuid4().hex[:12]}",
        "action": "choir_enabled",
        "entity_type": "choir",
        "entity_id": choir_id,
        "entity_name": choir.get("name"),
        "performed_by": admin_email,
        "reason": reason,
        "previous_status": choir.get("status"),
        "new_status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log)
    
    return {"success": True, "message": f"Choir '{choir.get('name')}' has been enabled"}


@router.delete("/admin/choir/{choir_id}")
async def delete_choir(choir_id: str, request: Request, data: dict = None):
    """Delete a choir - soft delete, keeps audit record"""
    db = get_db()
    
    admin_email = request.cookies.get("admin_email", "admin")
    
    choir = await db.singers.find_one({"singer_id": choir_id})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    reason = (data or {}).get("reason", "Deleted by admin")
    
    # Get related data counts for audit
    albums_count = await db.albums.count_documents({"singer_id": choir_id})
    account = await db.choir_accounts.find_one({"choir_id": choir_id}, {"_id": 0, "current_balance": 1})
    
    # Soft delete - mark as deleted instead of removing
    await db.singers.update_one(
        {"singer_id": choir_id},
        {"$set": {
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": admin_email,
            "deleted_reason": reason
        }}
    )
    
    # Disable choir account
    await db.choir_accounts.update_one(
        {"choir_id": choir_id},
        {"$set": {"status": "deleted"}}
    )
    
    # Create comprehensive audit log
    audit_log = {
        "log_id": f"audit_{uuid.uuid4().hex[:12]}",
        "action": "choir_deleted",
        "entity_type": "choir",
        "entity_id": choir_id,
        "entity_name": choir.get("name"),
        "performed_by": admin_email,
        "reason": reason,
        "previous_status": choir.get("status"),
        "new_status": "deleted",
        "metadata": {
            "albums_count": albums_count,
            "balance_at_deletion": account.get("current_balance", 0) if account else 0,
            "choir_type": choir.get("type"),
            "church_name": choir.get("church_name"),
            "created_at": choir.get("created_at")
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(audit_log)
    
    return {"success": True, "message": f"Choir '{choir.get('name')}' has been deleted"}


@router.get("/admin/choir-audit-logs")
async def get_choir_audit_logs(
    choir_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """Get audit logs for choir actions"""
    db = get_db()
    
    query = {"entity_type": "choir"}
    if choir_id:
        query["entity_id"] = choir_id
    if action:
        query["action"] = action
    
    logs = await db.audit_logs.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.audit_logs.count_documents(query)
    
    return {"logs": logs, "total": total}


# ============== CHOIR NOTIFICATION SYSTEM ==============

@router.post("/admin/choir-notifications/send")
async def send_choir_notification(request: Request, data: dict):
    """Send notification to one or multiple choirs"""
    db = get_db()
    
    admin_email = request.cookies.get("admin_email", "admin")
    
    choir_ids = data.get("choir_ids", [])  # Can be single choir or list
    subject = data.get("subject", "")
    message = data.get("message", "")
    notification_type = data.get("type", "info")  # info, warning, urgent
    
    if not choir_ids:
        raise HTTPException(status_code=400, detail="At least one choir_id is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    # If single choir_id passed as string, convert to list
    if isinstance(choir_ids, str):
        choir_ids = [choir_ids]
    
    # Create notifications for each choir
    notifications = []
    for choir_id in choir_ids:
        notification = {
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "choir_id": choir_id,
            "subject": subject,
            "message": message,
            "type": notification_type,
            "sent_by": admin_email,
            "is_read": False,
            "responses": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        notifications.append(notification)
    
    if notifications:
        await db.choir_notifications.insert_many(notifications)
    
    return {
        "success": True,
        "message": f"Notification sent to {len(choir_ids)} choir(s)",
        "notification_ids": [n["notification_id"] for n in notifications]
    }


@router.get("/admin/choir-notifications")
async def get_admin_choir_notifications(
    choir_id: Optional[str] = None,
    is_read: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """Get all choir notifications (admin view)"""
    db = get_db()
    
    query = {}
    if choir_id:
        query["choir_id"] = choir_id
    if is_read is not None:
        query["is_read"] = is_read
    
    notifications = await db.choir_notifications.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    # Enrich with choir names
    for notif in notifications:
        choir = await db.singers.find_one(
            {"singer_id": notif["choir_id"]},
            {"_id": 0, "name": 1}
        )
        notif["choir_name"] = choir.get("name") if choir else "Unknown"
    
    total = await db.choir_notifications.count_documents(query)
    
    return {"notifications": notifications, "total": total}


@router.get("/admin/choir-notifications/{notification_id}")
async def get_notification_detail(notification_id: str):
    """Get single notification with responses"""
    db = get_db()
    
    notification = await db.choir_notifications.find_one(
        {"notification_id": notification_id},
        {"_id": 0}
    )
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    # Get choir name
    choir = await db.singers.find_one(
        {"singer_id": notification["choir_id"]},
        {"_id": 0, "name": 1}
    )
    notification["choir_name"] = choir.get("name") if choir else "Unknown"
    
    return notification


@router.post("/admin/choir-notifications/{notification_id}/reply")
async def admin_reply_notification(notification_id: str, request: Request, data: dict):
    """Admin replies to a choir's response"""
    db = get_db()
    
    admin_email = request.cookies.get("admin_email", "admin")
    message = data.get("message", "")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    response = {
        "response_id": f"resp_{uuid.uuid4().hex[:8]}",
        "message": message,
        "from": "admin",
        "from_name": admin_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.choir_notifications.update_one(
        {"notification_id": notification_id},
        {"$push": {"responses": response}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "response": response}


@router.delete("/admin/choir-notifications/{notification_id}")
async def delete_notification(notification_id: str):
    """Delete a notification"""
    db = get_db()
    
    result = await db.choir_notifications.delete_one({"notification_id": notification_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}

