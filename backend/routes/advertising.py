"""
Advertising routes for Gracefy Admin Panel.
Manages audio advertisements, impressions tracking, and analytics.
Similar to Spotify's ad system for free users.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from bson import ObjectId
import logging
import uuid

from core.database import get_db
from core.dependencies import get_current_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/advertising", tags=["advertising"])


# ==================== MODELS ====================

def serialize_ad(ad: dict) -> dict:
    """Serialize ad document for JSON response"""
    if not ad:
        return None
    return {
        "ad_id": str(ad.get("_id", "")),
        "title": ad.get("title", ""),
        "description": ad.get("description", ""),
        "advertiser_name": ad.get("advertiser_name", ""),
        "audio_url": ad.get("audio_url", ""),
        "duration_seconds": ad.get("duration_seconds", 30),
        "target_audience": ad.get("target_audience", "all"),
        "click_url": ad.get("click_url", ""),
        "is_active": ad.get("is_active", True),
        "priority": ad.get("priority", 1),
        "start_date": ad.get("start_date"),
        "end_date": ad.get("end_date"),
        "total_impressions": ad.get("total_impressions", 0),
        "total_clicks": ad.get("total_clicks", 0),
        "total_completions": ad.get("total_completions", 0),
        "budget": ad.get("budget", 0),
        "cost_per_impression": ad.get("cost_per_impression", 0),
        "created_at": ad.get("created_at"),
        "updated_at": ad.get("updated_at"),
        "created_by": ad.get("created_by", ""),
    }


# ==================== SETTINGS ENDPOINTS ====================

@router.get("/settings")
async def get_advertising_settings():
    """Get global advertising settings"""
    db = get_db()
    
    settings = await db.system_settings.find_one({"key": "advertising"})
    
    if not settings:
        # Return default settings
        return {
            "enabled": False,
            "free_users_only": True,
            "ads_interval_songs": 3,  # Play ad after every N songs
            "ads_interval_minutes": 15,  # Or after N minutes
            "max_ad_duration_seconds": 60,
            "skip_after_seconds": 5,  # Allow skip after N seconds (0 = no skip)
            "show_ad_label": True,
            "updated_at": None,
            "updated_by": None
        }
    
    return {
        "enabled": settings.get("enabled", False),
        "free_users_only": settings.get("free_users_only", True),
        "ads_interval_songs": settings.get("ads_interval_songs", 3),
        "ads_interval_minutes": settings.get("ads_interval_minutes", 15),
        "max_ad_duration_seconds": settings.get("max_ad_duration_seconds", 60),
        "skip_after_seconds": settings.get("skip_after_seconds", 5),
        "show_ad_label": settings.get("show_ad_label", True),
        "updated_at": settings.get("updated_at"),
        "updated_by": settings.get("updated_by")
    }


@router.put("/settings")
async def update_advertising_settings(
    enabled: bool = Form(...),
    free_users_only: bool = Form(True),
    ads_interval_songs: int = Form(3),
    ads_interval_minutes: int = Form(15),
    max_ad_duration_seconds: int = Form(60),
    skip_after_seconds: int = Form(5),
    show_ad_label: bool = Form(True),
    current_user: dict = Depends(get_current_admin_user)
):
    """Update global advertising settings - Admin only"""
    db = get_db()
    
    # Check if user has permission
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update advertising settings")
    
    settings_data = {
        "key": "advertising",
        "enabled": enabled,
        "free_users_only": free_users_only,
        "ads_interval_songs": ads_interval_songs,
        "ads_interval_minutes": ads_interval_minutes,
        "max_ad_duration_seconds": max_ad_duration_seconds,
        "skip_after_seconds": skip_after_seconds,
        "show_ad_label": show_ad_label,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": current_user.get("user_id", "")
    }
    
    await db.system_settings.update_one(
        {"key": "advertising"},
        {"$set": settings_data},
        upsert=True
    )
    
    logger.info(f"Advertising settings updated by {current_user.get('email')}: enabled={enabled}")
    
    return {"message": "Advertising settings updated successfully", **settings_data}


# ==================== AD MANAGEMENT ENDPOINTS ====================

@router.get("/ads")
async def list_ads(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="active, inactive, all"),
    search: Optional[str] = None
):
    """List all advertisements with pagination"""
    db = get_db()
    
    query = {}
    
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"advertiser_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    
    ads = await db.advertisements.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.advertisements.count_documents(query)
    
    return {
        "ads": [serialize_ad(ad) for ad in ads],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/ads/{ad_id}")
async def get_ad(ad_id: str):
    """Get single advertisement details"""
    db = get_db()
    
    try:
        ad = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ad ID")
    
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    
    return serialize_ad(ad)


@router.post("/ads")
async def create_ad(
    title: str = Form(...),
    description: str = Form(""),
    advertiser_name: str = Form(...),
    audio_url: str = Form(...),
    duration_seconds: int = Form(30),
    target_audience: str = Form("all"),
    click_url: str = Form(""),
    priority: int = Form(1),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    budget: float = Form(0),
    cost_per_impression: float = Form(0),
    current_user: dict = Depends(get_current_admin_user)
):
    """Create a new advertisement - Admin/Ad Manager only"""
    db = get_db()
    
    # Check permissions
    user_role = current_user.get("role", "")
    user_permissions = current_user.get("permissions", [])
    
    if user_role not in ["admin", "super_admin"] and "manage_ads" not in user_permissions:
        raise HTTPException(status_code=403, detail="You don't have permission to create advertisements")
    
    # Parse dates
    parsed_start = None
    parsed_end = None
    if start_date:
        try:
            parsed_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except:
            pass
    if end_date:
        try:
            parsed_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except:
            pass
    
    ad_data = {
        "title": title,
        "description": description,
        "advertiser_name": advertiser_name,
        "audio_url": audio_url,
        "duration_seconds": duration_seconds,
        "target_audience": target_audience,
        "click_url": click_url,
        "is_active": True,
        "priority": priority,
        "start_date": parsed_start,
        "end_date": parsed_end,
        "total_impressions": 0,
        "total_clicks": 0,
        "total_completions": 0,
        "budget": budget,
        "cost_per_impression": cost_per_impression,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user.get("user_id", "")
    }
    
    result = await db.advertisements.insert_one(ad_data)
    ad_data["ad_id"] = str(result.inserted_id)
    
    logger.info(f"Advertisement created: {title} by {current_user.get('email')}")
    
    return {"message": "Advertisement created successfully", "ad": serialize_ad(ad_data)}


@router.put("/ads/{ad_id}")
async def update_ad(
    ad_id: str,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    advertiser_name: Optional[str] = Form(None),
    audio_url: Optional[str] = Form(None),
    duration_seconds: Optional[int] = Form(None),
    target_audience: Optional[str] = Form(None),
    click_url: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    priority: Optional[int] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    budget: Optional[float] = Form(None),
    cost_per_impression: Optional[float] = Form(None),
    current_user: dict = Depends(get_current_admin_user)
):
    """Update an advertisement"""
    db = get_db()
    
    # Check permissions
    user_role = current_user.get("role", "")
    user_permissions = current_user.get("permissions", [])
    
    if user_role not in ["admin", "super_admin"] and "manage_ads" not in user_permissions:
        raise HTTPException(status_code=403, detail="You don't have permission to update advertisements")
    
    try:
        ad = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ad ID")
    
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if title is not None:
        update_data["title"] = title
    if description is not None:
        update_data["description"] = description
    if advertiser_name is not None:
        update_data["advertiser_name"] = advertiser_name
    if audio_url is not None:
        update_data["audio_url"] = audio_url
    if duration_seconds is not None:
        update_data["duration_seconds"] = duration_seconds
    if target_audience is not None:
        update_data["target_audience"] = target_audience
    if click_url is not None:
        update_data["click_url"] = click_url
    if is_active is not None:
        update_data["is_active"] = is_active
    if priority is not None:
        update_data["priority"] = priority
    if budget is not None:
        update_data["budget"] = budget
    if cost_per_impression is not None:
        update_data["cost_per_impression"] = cost_per_impression
    
    if start_date is not None:
        try:
            update_data["start_date"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except:
            pass
    if end_date is not None:
        try:
            update_data["end_date"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except:
            pass
    
    await db.advertisements.update_one({"_id": ObjectId(ad_id)}, {"$set": update_data})
    
    updated_ad = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    
    logger.info(f"Advertisement updated: {ad_id} by {current_user.get('email')}")
    
    return {"message": "Advertisement updated successfully", "ad": serialize_ad(updated_ad)}


@router.delete("/ads/{ad_id}")
async def delete_ad(ad_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete an advertisement"""
    db = get_db()
    
    # Check permissions
    user_role = current_user.get("role", "")
    user_permissions = current_user.get("permissions", [])
    
    if user_role not in ["admin", "super_admin"] and "manage_ads" not in user_permissions:
        raise HTTPException(status_code=403, detail="You don't have permission to delete advertisements")
    
    try:
        result = await db.advertisements.delete_one({"_id": ObjectId(ad_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ad ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    
    logger.info(f"Advertisement deleted: {ad_id} by {current_user.get('email')}")
    
    return {"message": "Advertisement deleted successfully"}


@router.post("/ads/{ad_id}/toggle")
async def toggle_ad_status(ad_id: str, current_user: dict = Depends(get_current_user)):
    """Toggle advertisement active status"""
    db = get_db()
    
    try:
        ad = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ad ID")
    
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    
    new_status = not ad.get("is_active", True)
    
    await db.advertisements.update_one(
        {"_id": ObjectId(ad_id)},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": f"Advertisement {'activated' if new_status else 'deactivated'}", "is_active": new_status}


# ==================== CLIENT ENDPOINTS (Mobile App) ====================

@router.get("/next-ad")
async def get_next_ad(
    user_id: Optional[str] = None,
    platform: str = Query("mobile"),
    songs_played: int = Query(0),
    last_ad_time: Optional[str] = None
):
    """Get the next ad to play for a user - Called by mobile app"""
    db = get_db()
    
    # Check if advertising is enabled
    settings = await db.system_settings.find_one({"key": "advertising"})
    if not settings or not settings.get("enabled", False):
        return {"should_play_ad": False, "ad": None, "reason": "ads_disabled"}
    
    # Check if user is premium (skip ads for premium users if free_users_only)
    if user_id and settings.get("free_users_only", True):
        user = await db.users.find_one({"user_id": user_id})
        if user and user.get("subscription_type") in ["premium", "family"]:
            return {"should_play_ad": False, "ad": None, "reason": "premium_user"}
    
    # Check interval conditions
    ads_interval_songs = settings.get("ads_interval_songs", 3)
    ads_interval_minutes = settings.get("ads_interval_minutes", 15)
    
    should_play = False
    
    # Check songs interval
    if songs_played > 0 and songs_played % ads_interval_songs == 0:
        should_play = True
    
    # Check time interval
    if last_ad_time:
        try:
            last_time = datetime.fromisoformat(last_ad_time.replace("Z", "+00:00"))
            minutes_since_last_ad = (datetime.now(timezone.utc) - last_time).total_seconds() / 60
            if minutes_since_last_ad >= ads_interval_minutes:
                should_play = True
        except:
            pass
    
    if not should_play:
        return {"should_play_ad": False, "ad": None, "reason": "interval_not_reached"}
    
    # Get an active ad
    now = datetime.now(timezone.utc)
    query = {
        "is_active": True,
        "$or": [
            {"start_date": None},
            {"start_date": {"$lte": now}}
        ]
    }
    
    # Exclude expired ads
    ads = await db.advertisements.find(query).sort("priority", -1).to_list(100)
    
    # Filter out expired ads
    valid_ads = []
    for ad in ads:
        if ad.get("end_date") and ad["end_date"] < now:
            continue
        valid_ads.append(ad)
    
    if not valid_ads:
        return {"should_play_ad": False, "ad": None, "reason": "no_active_ads"}
    
    # Select ad based on priority and impressions (weighted random)
    import random
    weights = [ad.get("priority", 1) for ad in valid_ads]
    selected_ad = random.choices(valid_ads, weights=weights, k=1)[0]
    
    return {
        "should_play_ad": True,
        "ad": serialize_ad(selected_ad),
        "settings": {
            "skip_after_seconds": settings.get("skip_after_seconds", 5),
            "show_ad_label": settings.get("show_ad_label", True)
        }
    }


@router.post("/impression")
async def record_impression(
    ad_id: str = Form(...),
    user_id: Optional[str] = Form(None),
    device_id: str = Form(...),
    platform: str = Form("mobile"),
    duration_played: int = Form(0),
    completed: bool = Form(False),
    skipped: bool = Form(False),
    clicked: bool = Form(False)
):
    """Record an ad impression - Called by mobile app after ad plays"""
    db = get_db()
    
    try:
        ad = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ad ID")
    
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    
    # Create impression record
    impression = {
        "impression_id": str(uuid.uuid4()),
        "ad_id": ad_id,
        "user_id": user_id,
        "device_id": device_id,
        "platform": platform,
        "duration_played": duration_played,
        "completed": completed,
        "skipped": skipped,
        "clicked": clicked,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.ad_impressions.insert_one(impression)
    
    # Update ad statistics
    update_ops = {"$inc": {"total_impressions": 1}}
    if completed:
        update_ops["$inc"]["total_completions"] = 1
    if clicked:
        update_ops["$inc"]["total_clicks"] = 1
    
    await db.advertisements.update_one({"_id": ObjectId(ad_id)}, update_ops)
    
    return {"message": "Impression recorded", "impression_id": impression["impression_id"]}


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics/overview")
async def get_ad_analytics_overview(
    days: int = Query(30, ge=1, le=365)
):
    """Get advertising analytics overview"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # Total ads
    total_ads = await db.advertisements.count_documents({})
    active_ads = await db.advertisements.count_documents({"is_active": True})
    
    # Impressions in period
    total_impressions = await db.ad_impressions.count_documents({
        "created_at": {"$gte": start_date}
    })
    
    # Completions in period
    total_completions = await db.ad_impressions.count_documents({
        "created_at": {"$gte": start_date},
        "completed": True
    })
    
    # Clicks in period
    total_clicks = await db.ad_impressions.count_documents({
        "created_at": {"$gte": start_date},
        "clicked": True
    })
    
    # Calculate rates
    completion_rate = (total_completions / total_impressions * 100) if total_impressions > 0 else 0
    click_rate = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    
    # Revenue (based on cost per impression)
    revenue_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$lookup": {
            "from": "advertisements",
            "let": {"ad_id": {"$toObjectId": "$ad_id"}},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$_id", "$$ad_id"]}}}
            ],
            "as": "ad"
        }},
        {"$unwind": {"path": "$ad", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": {"$ifNull": ["$ad.cost_per_impression", 0]}}
        }}
    ]
    
    revenue_result = await db.ad_impressions.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
    
    return {
        "period_days": days,
        "total_ads": total_ads,
        "active_ads": active_ads,
        "total_impressions": total_impressions,
        "total_completions": total_completions,
        "total_clicks": total_clicks,
        "completion_rate": round(completion_rate, 2),
        "click_rate": round(click_rate, 2),
        "estimated_revenue": round(total_revenue, 2)
    }


@router.get("/analytics/trends")
async def get_ad_analytics_trends(
    days: int = Query(30, ge=1, le=365)
):
    """Get daily ad impression trends"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {
                "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
            },
            "impressions": {"$sum": 1},
            "completions": {"$sum": {"$cond": ["$completed", 1, 0]}},
            "clicks": {"$sum": {"$cond": ["$clicked", 1, 0]}},
            "skips": {"$sum": {"$cond": ["$skipped", 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.ad_impressions.aggregate(pipeline).to_list(365)
    
    return {
        "period_days": days,
        "trends": [
            {
                "date": r["_id"],
                "impressions": r["impressions"],
                "completions": r["completions"],
                "clicks": r["clicks"],
                "skips": r["skips"]
            }
            for r in results
        ]
    }


@router.get("/analytics/by-ad")
async def get_analytics_by_ad(
    days: int = Query(30, ge=1, le=365)
):
    """Get analytics breakdown by advertisement"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$ad_id",
            "impressions": {"$sum": 1},
            "completions": {"$sum": {"$cond": ["$completed", 1, 0]}},
            "clicks": {"$sum": {"$cond": ["$clicked", 1, 0]}},
            "avg_duration": {"$avg": "$duration_played"}
        }},
        {"$sort": {"impressions": -1}}
    ]
    
    results = await db.ad_impressions.aggregate(pipeline).to_list(100)
    
    # Enrich with ad details
    enriched = []
    for r in results:
        try:
            ad = await db.advertisements.find_one({"_id": ObjectId(r["_id"])})
            enriched.append({
                "ad_id": r["_id"],
                "title": ad.get("title", "Unknown") if ad else "Deleted Ad",
                "advertiser": ad.get("advertiser_name", "") if ad else "",
                "impressions": r["impressions"],
                "completions": r["completions"],
                "clicks": r["clicks"],
                "completion_rate": round(r["completions"] / r["impressions"] * 100, 2) if r["impressions"] > 0 else 0,
                "click_rate": round(r["clicks"] / r["impressions"] * 100, 2) if r["impressions"] > 0 else 0,
                "avg_duration": round(r["avg_duration"], 1) if r["avg_duration"] else 0
            })
        except:
            continue
    
    return {"period_days": days, "ads": enriched}


@router.get("/analytics/by-platform")
async def get_analytics_by_platform(
    days: int = Query(30, ge=1, le=365)
):
    """Get analytics breakdown by platform"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$platform",
            "impressions": {"$sum": 1},
            "completions": {"$sum": {"$cond": ["$completed", 1, 0]}},
            "clicks": {"$sum": {"$cond": ["$clicked", 1, 0]}}
        }}
    ]
    
    results = await db.ad_impressions.aggregate(pipeline).to_list(10)
    
    return {
        "period_days": days,
        "platforms": [
            {
                "platform": r["_id"] or "unknown",
                "impressions": r["impressions"],
                "completions": r["completions"],
                "clicks": r["clicks"],
                "completion_rate": round(r["completions"] / r["impressions"] * 100, 2) if r["impressions"] > 0 else 0
            }
            for r in results
        ]
    }
