"""
Admin routes for Gracefy.
Handles admin panel operations, system settings, cache management.
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

from core.database import get_db
from core.cache import cache as app_cache
from core.redis_cache import redis_cache, invalidate_pattern

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
    
    return {
        "redis_cache": redis_stats,
        "adaptive_cache": adaptive_stats,
        "memory_cache": app_cache_stats,
        "summary": {
            "primary": "redis" if redis_stats.get('connected') else "memory",
            "redis_connected": redis_stats.get('connected', False),
            "total_hit_rate": redis_stats.get('hit_rate', '0%'),
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
    
    return {"message": "Settings updated"}


# ============== USER MANAGEMENT ==============

@router.get("/admin/users")
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
    """Get single user details"""
    db = get_db()
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


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
async def delete_admin_user(user_id: str):
    """Delete user"""
    db = get_db()
    
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}


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
    """Get user statistics summary"""
    db = get_db()
    
    total = await db.users.count_documents({})
    by_role = await db.users.aggregate([
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]).to_list(20)
    by_status = await db.users.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(10)
    
    return {
        "total": total,
        "by_role": {r["_id"]: r["count"] for r in by_role},
        "by_status": {s["_id"]: s["count"] for s in by_status}
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
    """Get choir details for admin"""
    db = get_db()
    
    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    # Get account
    account = await db.choir_accounts.find_one(
        {"choir_id": choir_id},
        {"_id": 0, "password_hash": 0}
    )
    
    # Get albums
    albums = await db.albums.find(
        {"artist_id": choir_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"choir": choir, "account": account, "albums": albums}


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
    """Get all albums for admin"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    if artist_id:
        query["artist_id"] = artist_id
    
    albums = await db.albums.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.albums.count_documents(query)
    
    return {"albums": albums, "total": total}


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
