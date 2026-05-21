"""
Advertising & Campaigns routes for Gracefy Admin Panel.
Manages audio advertisements, campaigns (push, SMS, email), and analytics.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from bson import ObjectId
import logging
import uuid
import os
import aiohttp

from core.database import get_db
from core.dependencies import get_current_admin_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/advertising", tags=["advertising"])

# CDN Configuration for file uploads
CDN_UPLOAD_URL = os.getenv("CDN_UPLOAD_URL", "")
CDN_API_KEY = os.getenv("CDN_API_KEY", "")
CDN_STORAGE_ZONE = os.getenv("CDN_STORAGE_ZONE", "gracefy-media")
CDN_BASE_URL = os.getenv("CDN_BASE_URL", "https://gracefy-media.b-cdn.net")


# ==================== HELPER FUNCTIONS ====================

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


def serialize_campaign(campaign: dict) -> dict:
    """Serialize campaign document for JSON response"""
    if not campaign:
        return None
    return {
        "campaign_id": str(campaign.get("_id", "")),
        "name": campaign.get("name", ""),
        "description": campaign.get("description", ""),
        "type": campaign.get("type", "push"),  # push, sms, email
        "status": campaign.get("status", "draft"),  # draft, scheduled, sent, cancelled
        "message_title": campaign.get("message_title", ""),
        "message_body": campaign.get("message_body", ""),
        "message_data": campaign.get("message_data", {}),
        "target_filter": campaign.get("target_filter", {}),
        "target_count": campaign.get("target_count", 0),
        "sent_count": campaign.get("sent_count", 0),
        "delivered_count": campaign.get("delivered_count", 0),
        "opened_count": campaign.get("opened_count", 0),
        "clicked_count": campaign.get("clicked_count", 0),
        "scheduled_at": campaign.get("scheduled_at"),
        "sent_at": campaign.get("sent_at"),
        "created_at": campaign.get("created_at"),
        "updated_at": campaign.get("updated_at"),
        "created_by": campaign.get("created_by", ""),
    }


async def upload_to_cdn(file: UploadFile, folder: str = "ads") -> str:
    """Upload file to CDN and return URL"""
    if not CDN_API_KEY:
        raise HTTPException(status_code=500, detail="CDN not configured")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'mp3'
    filename = f"{folder}/{uuid.uuid4()}.{ext}"
    
    content = await file.read()
    
    async with aiohttp.ClientSession() as session:
        headers = {
            "AccessKey": CDN_API_KEY,
            "Content-Type": file.content_type or "audio/mpeg"
        }
        url = f"https://storage.bunnycdn.com/{CDN_STORAGE_ZONE}/{filename}"
        
        async with session.put(url, data=content, headers=headers) as response:
            if response.status not in [200, 201]:
                raise HTTPException(status_code=500, detail="Failed to upload to CDN")
    
    return f"{CDN_BASE_URL}/{filename}"


async def get_target_users(db, filter_config: dict) -> List[dict]:
    """Get users matching campaign filter criteria.

    Supports location (country / region / city), listening history,
    activity windows and explicit include/exclude lists.

    NOTE: Earlier versions silently dropped filters in two ways:
      1. ``query["$or"]`` from a previous filter (premium/inactive) was
         clobbered when location-region was added — fixed by merging all
         clauses into a single ``$and`` block.
      2. ``last_active_at`` was checked exclusively, but new sessions are
         stamping ``last_seen_at``. Both fields are now checked.
      3. ``listened_content_ids`` defaulted to set-intersection (AND), so a
         user who listened to only ONE of the chosen songs was excluded.
         We now default to OR semantics, matching the most common admin
         intent ("anyone who heard at least one of these songs").
         Pass ``listened_match_mode='all'`` to opt back into AND.
    """
    query: dict = {}
    and_clauses: List[dict] = []  # collected, applied at the end
    filter_type = filter_config.get("type", "all")

    now = datetime.now(timezone.utc)

    # ---- Base filter types ----
    if filter_type == "all":
        pass
    elif filter_type == "active":
        # Active = streamed in the last 7 days (check BOTH legacy + new field)
        week_ago = (now - timedelta(days=7)).isoformat()
        and_clauses.append({"$or": [
            {"last_active_at": {"$gte": week_ago}},
            {"last_seen_at": {"$gte": week_ago}},
        ]})
    elif filter_type == "inactive":
        month_ago = (now - timedelta(days=30)).isoformat()
        and_clauses.append({"$and": [
            {"$or": [{"last_active_at": {"$lt": month_ago}}, {"last_active_at": None}, {"last_active_at": {"$exists": False}}]},
            {"$or": [{"last_seen_at": {"$lt": month_ago}}, {"last_seen_at": None}, {"last_seen_at": {"$exists": False}}]},
        ]})
    elif filter_type == "recent":
        week_ago = (now - timedelta(days=7)).isoformat()
        query["created_at"] = {"$gte": week_ago}
    elif filter_type == "premium":
        and_clauses.append({"$or": [
            {"subscription.status": "active"},
            {"is_premium": True},
        ]})
    elif filter_type == "free":
        and_clauses.append({"$or": [
            {"subscription.status": {"$ne": "active"}},
            {"subscription": {"$exists": False}},
        ]})
        and_clauses.append({"$or": [
            {"is_premium": {"$ne": True}},
            {"is_premium": {"$exists": False}},
        ]})

    # ---- Location filters (case-insensitive so 'tanzania' == 'Tanzania') ----
    def _ci(value: str) -> dict:
        # Anchored case-insensitive match
        import re
        return {"$regex": f"^{re.escape(value)}$", "$options": "i"}

    country = filter_config.get("country")
    if country:
        query["country"] = _ci(country)

    region = filter_config.get("region")
    if region:
        # Some user rows store the value as `region`, others as `city` (legacy
        # schema). Match either field — appended as AND clause so it doesn't
        # collide with any other $or already in the query.
        and_clauses.append({"$or": [
            {"region": _ci(region)},
            {"city": _ci(region)},
        ]})

    city = filter_config.get("city")
    if city:
        query["city"] = _ci(city)

    # ---- Channel-specific requirements ----
    if filter_config.get("has_email"):
        query["email"] = {"$ne": None, "$exists": True, "$regex": ".+@.+"}
    if filter_config.get("has_phone"):
        query["phone"] = {"$ne": None, "$exists": True}
    if filter_config.get("has_push_token"):
        query["push_token"] = {"$ne": None, "$exists": True}

    # Merge collected $and clauses
    if and_clauses:
        existing_and = query.get("$and") or []
        query["$and"] = existing_and + and_clauses

    # Get base users
    users = await db.app_users.find(query, {
        "_id": 0,
        "user_id": 1,
        "email": 1,
        "phone": 1,
        "push_token": 1,
        "name": 1,
        "country": 1,
        "region": 1,
        "city": 1,
        "created_at": 1,
        "last_active_at": 1,
        "last_seen_at": 1,
        "is_premium": 1,
    }).to_list(100000)

    # ---- Content listening filters ----
    listened_content_ids = filter_config.get("listened_content_ids") or []
    not_listened_content_ids = filter_config.get("not_listened_content_ids") or []
    match_mode = (filter_config.get("listened_match_mode") or "any").lower()

    if listened_content_ids:
        # Single MongoDB call instead of N-per-content - much faster.
        plays = await db.listening_sessions.distinct("user_id", {
            "$or": [
                {"song_id": {"$in": listened_content_ids}},
                {"album_id": {"$in": listened_content_ids}},
                {"content_id": {"$in": listened_content_ids}},
            ],
        })
        listened_user_ids = set(plays)

        if match_mode == "all":
            # AND semantics — must have listened to EVERY id. Run one query per
            # id and intersect the result sets (rare, kept for explicit opt-in).
            for cid in listened_content_ids:
                cid_users = await db.listening_sessions.distinct("user_id", {
                    "$or": [
                        {"song_id": cid}, {"album_id": cid}, {"content_id": cid}
                    ],
                })
                listened_user_ids &= set(cid_users)

        users = [u for u in users if u.get("user_id") in listened_user_ids]

    if not_listened_content_ids:
        excluded_listening_users = await db.listening_sessions.distinct("user_id", {
            "$or": [
                {"song_id": {"$in": not_listened_content_ids}},
                {"album_id": {"$in": not_listened_content_ids}},
                {"content_id": {"$in": not_listened_content_ids}},
            ],
        })
        excl_set = set(excluded_listening_users)
        users = [u for u in users if u.get("user_id") not in excl_set]

    # ---- Limit + explicit include/exclude ----
    excluded_ids = filter_config.get("excluded_user_ids") or []
    if excluded_ids:
        excl_set = set(excluded_ids)
        users = [u for u in users if u.get("user_id") not in excl_set]

    selected_ids = filter_config.get("selected_user_ids") or []
    if selected_ids:
        sel_set = set(selected_ids)
        users = [u for u in users if u.get("user_id") in sel_set]

    max_users = filter_config.get("max_users")
    if max_users and max_users > 0:
        users = users[:max_users]

    return users
    
    return users


# ==================== SETTINGS ENDPOINTS ====================

@router.get("/settings")
async def get_advertising_settings():
    """Get global advertising settings"""
    db = get_db()
    
    settings = await db.system_settings.find_one({"key": "advertising"})
    
    if not settings:
        return {
            "enabled": False,
            "free_users_only": True,
            "ads_interval_songs": 3,
            "ads_interval_minutes": 15,
            "max_ad_duration_seconds": 60,
            "skip_after_seconds": 5,
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
    status: Optional[str] = Query(None),
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
    audio_url: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
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
    """Create a new advertisement - supports file upload or URL"""
    db = get_db()
    
    user_role = current_user.get("role", "")
    user_permissions = current_user.get("permissions", [])
    
    if user_role not in ["admin", "super_admin"] and "manage_ads" not in user_permissions:
        raise HTTPException(status_code=403, detail="You don't have permission to create advertisements")
    
    # Handle audio - either file upload or URL
    final_audio_url = audio_url
    if audio_file and audio_file.filename:
        try:
            final_audio_url = await upload_to_cdn(audio_file, "ads")
        except Exception as e:
            logger.error(f"Failed to upload audio: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload audio file")
    
    if not final_audio_url:
        raise HTTPException(status_code=400, detail="Either audio_url or audio_file is required")
    
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
        "audio_url": final_audio_url,
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
    audio_file: Optional[UploadFile] = File(None),
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
    
    # Handle new audio file upload
    if audio_file and audio_file.filename:
        try:
            update_data["audio_url"] = await upload_to_cdn(audio_file, "ads")
        except Exception as e:
            logger.error(f"Failed to upload audio: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload audio file")
    elif audio_url is not None:
        update_data["audio_url"] = audio_url
    
    if title is not None:
        update_data["title"] = title
    if description is not None:
        update_data["description"] = description
    if advertiser_name is not None:
        update_data["advertiser_name"] = advertiser_name
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
async def toggle_ad_status(ad_id: str, current_user: dict = Depends(get_current_admin_user)):
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



# ==================== CAMPAIGN TARGETING HELPER ENDPOINTS ====================

@router.get("/content/search")
async def search_content(
    q: str = Query(..., description="Search query"),
    content_type: str = Query("all", description="Content type: all, songs, albums")
):
    """Search for songs and albums to use in campaign targeting"""
    db = get_db()
    
    results = []
    search_regex = {"$regex": q, "$options": "i"}
    
    if content_type in ["all", "songs"]:
        songs = await db.songs.find(
            {"$or": [{"title": search_regex}, {"artist_name": search_regex}]},
            {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1, "album_name": 1}
        ).limit(20).to_list(20)
        
        for song in songs:
            results.append({
                "id": song.get("song_id"),
                "type": "song",
                "title": song.get("title"),
                "subtitle": f"{song.get('artist_name', 'Unknown')} • {song.get('album_name', '')}",
                "thumbnail": song.get("thumbnail")
            })
    
    if content_type in ["all", "albums"]:
        albums = await db.albums.find(
            {"$or": [{"name": search_regex}, {"title": search_regex}, {"artist_name": search_regex}]},
            {"_id": 0, "album_id": 1, "name": 1, "title": 1, "artist_name": 1, "thumbnail": 1}
        ).limit(20).to_list(20)
        
        for album in albums:
            results.append({
                "id": album.get("album_id"),
                "type": "album",
                "title": album.get("name") or album.get("title"),
                "subtitle": album.get("artist_name", "Unknown Artist"),
                "thumbnail": album.get("thumbnail")
            })
    
    return {"results": results, "total": len(results)}


@router.get("/locations/countries")
async def get_available_countries():
    """Get list of countries where users are located"""
    db = get_db()
    
    countries = await db.app_users.distinct("country", {"country": {"$ne": None, "$exists": True}})
    countries = [c for c in countries if c]  # Filter out empty strings
    
    return {"countries": sorted(countries)}


@router.get("/locations/regions")
async def get_regions_for_country(country: str = Query(...)):
    """Get list of regions/cities for a specific country"""
    db = get_db()
    
    # Get both regions and cities for the country
    regions = await db.app_users.distinct("region", {"country": country, "region": {"$ne": None, "$exists": True}})
    cities = await db.app_users.distinct("city", {"country": country, "city": {"$ne": None, "$exists": True}})
    
    # Combine and deduplicate
    locations = list(set([r for r in regions if r] + [c for c in cities if c]))
    
    return {"regions": sorted(locations)}


@router.post("/campaigns/preview-users")
async def preview_campaign_users(data: dict):
    """
    Preview users matching campaign filters with full details.
    Used to display user list in admin panel for selection.
    """
    db = get_db()
    
    # Build filter config from request data
    filter_config = {
        "type": data.get("filter_type", "all"),
        "country": data.get("country"),
        "region": data.get("region"),
        "city": data.get("city"),
        "listened_content_ids": data.get("listened_content_ids", []),
        "not_listened_content_ids": data.get("not_listened_content_ids", []),
        # Default to "any" — most admins mean "anyone who heard at least one
        # of these songs" rather than "everyone who heard every single song".
        "listened_match_mode": data.get("listened_match_mode", "any"),
        "max_users": data.get("max_users"),
        "excluded_user_ids": data.get("excluded_user_ids", []),
        "selected_user_ids": data.get("selected_user_ids", [])
    }
    
    # Add channel requirements based on campaign type
    campaign_type = data.get("campaign_type", "push")
    if campaign_type == "email":
        filter_config["has_email"] = True
    elif campaign_type == "sms":
        filter_config["has_phone"] = True
    elif campaign_type == "push":
        filter_config["has_push_token"] = True
    
    users = await get_target_users(db, filter_config)
    
    # Format users for display
    user_list = []
    for user in users:
        user_list.append({
            "user_id": user.get("user_id"),
            "name": user.get("name") or "Unknown",
            "email": user.get("email"),
            "phone": user.get("phone"),
            "country": user.get("country"),
            "region": user.get("region") or user.get("city"),
            "is_premium": user.get("is_premium", False),
            "has_push_token": bool(user.get("push_token")),
            "created_at": user.get("created_at"),
            "last_active_at": user.get("last_active_at")
        })
    
    return {
        "users": user_list,
        "total": len(user_list),
        "filter_applied": filter_config
    }


@router.get("/campaigns/preview-count")


# ==================== CAMPAIGN MANAGEMENT ENDPOINTS ====================

@router.get("/campaigns")
async def list_campaigns(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    search: Optional[str] = None
):
    """List all campaigns with pagination"""
    db = get_db()
    
    query = {}
    
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"message_title": {"$regex": search, "$options": "i"}}
        ]
    
    skip = (page - 1) * limit
    
    campaigns = await db.campaigns.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.campaigns.count_documents(query)
    
    return {
        "campaigns": [serialize_campaign(c) for c in campaigns],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    """Get single campaign details"""
    db = get_db()
    
    try:
        campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return serialize_campaign(campaign)


@router.post("/campaigns")
async def create_campaign(
    name: str = Form(...),
    description: str = Form(""),
    type: str = Form(...),  # push, sms, email
    message_title: str = Form(""),
    message_body: str = Form(...),
    target_filter_type: str = Form("all"),  # all, active, inactive, recent, premium, free
    # Location filters
    country: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    # Content listening filters
    listened_content_ids: Optional[str] = Form(None),  # comma-separated content IDs user MUST have listened to
    not_listened_content_ids: Optional[str] = Form(None),  # comma-separated content IDs user must NOT have listened to
    # User selection filters
    max_users: Optional[int] = Form(None),  # Limit number of users
    excluded_user_ids: Optional[str] = Form(None),  # comma-separated user IDs to exclude
    selected_user_ids: Optional[str] = Form(None),  # comma-separated user IDs to include (manual selection)
    scheduled_at: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_admin_user)
):
    """Create a new campaign"""
    db = get_db()
    
    user_role = current_user.get("role", "")
    if user_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can create campaigns")
    
    # Validate type
    if type not in ["push", "sms", "email"]:
        raise HTTPException(status_code=400, detail="Invalid campaign type. Must be push, sms, or email")
    
    # Build target filter
    target_filter = {"type": target_filter_type}
    
    # Location filters
    if country:
        target_filter["country"] = country
    if region:
        target_filter["region"] = region
    if city:
        target_filter["city"] = city
    
    # Content listening filters
    if listened_content_ids:
        target_filter["listened_content_ids"] = [cid.strip() for cid in listened_content_ids.split(",")]
    if not_listened_content_ids:
        target_filter["not_listened_content_ids"] = [cid.strip() for cid in not_listened_content_ids.split(",")]
    
    # User selection filters
    if max_users and max_users > 0:
        target_filter["max_users"] = max_users
    if excluded_user_ids:
        target_filter["excluded_user_ids"] = [uid.strip() for uid in excluded_user_ids.split(",")]
    if selected_user_ids:
        target_filter["selected_user_ids"] = [uid.strip() for uid in selected_user_ids.split(",")]
    
    # Add channel-specific requirements
    if type == "email":
        target_filter["has_email"] = True
    elif type == "sms":
        target_filter["has_phone"] = True
    elif type == "push":
        target_filter["has_push_token"] = True
    
    # Count target users
    target_users = await get_target_users(db, target_filter)
    target_count = len(target_users)
    
    # Parse scheduled date
    parsed_scheduled = None
    if scheduled_at:
        try:
            parsed_scheduled = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        except:
            pass
    
    campaign_data = {
        "name": name,
        "description": description,
        "type": type,
        "status": "scheduled" if parsed_scheduled else "draft",
        "message_title": message_title,
        "message_body": message_body,
        "message_data": {},
        "target_filter": target_filter,
        "target_count": target_count,
        "sent_count": 0,
        "delivered_count": 0,
        "opened_count": 0,
        "clicked_count": 0,
        "scheduled_at": parsed_scheduled,
        "sent_at": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "created_by": current_user.get("user_id", "")
    }
    
    result = await db.campaigns.insert_one(campaign_data)
    campaign_data["campaign_id"] = str(result.inserted_id)
    
    logger.info(f"Campaign created: {name} by {current_user.get('email')}")
    
    return {
        "message": "Campaign created successfully",
        "campaign": serialize_campaign(campaign_data),
        "target_count": target_count
    }


@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    message_title: Optional[str] = Form(None),
    message_body: Optional[str] = Form(None),
    target_filter_type: Optional[str] = Form(None),
    # Location filters
    country: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    # Content listening filters
    listened_content_ids: Optional[str] = Form(None),
    not_listened_content_ids: Optional[str] = Form(None),
    # User selection filters
    max_users: Optional[int] = Form(None),
    excluded_user_ids: Optional[str] = Form(None),
    selected_user_ids: Optional[str] = Form(None),
    scheduled_at: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_admin_user)
):
    """Update a campaign (only if not sent)"""
    db = get_db()
    
    try:
        campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Cannot modify a sent campaign")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if name is not None:
        update_data["name"] = name
    if description is not None:
        update_data["description"] = description
    if message_title is not None:
        update_data["message_title"] = message_title
    if message_body is not None:
        update_data["message_body"] = message_body
    
    # Update target filter if any filter parameters are provided
    if any([target_filter_type is not None, country is not None, region is not None, 
            city is not None, listened_content_ids is not None, not_listened_content_ids is not None,
            max_users is not None, excluded_user_ids is not None, selected_user_ids is not None]):
        
        # Start with existing filter or create new one
        target_filter = campaign.get("target_filter", {}).copy()
        
        # Update filter type if provided
        if target_filter_type is not None:
            target_filter["type"] = target_filter_type
        
        # Update location filters
        if country is not None:
            if country:
                target_filter["country"] = country
            else:
                target_filter.pop("country", None)
        if region is not None:
            if region:
                target_filter["region"] = region
            else:
                target_filter.pop("region", None)
        if city is not None:
            if city:
                target_filter["city"] = city
            else:
                target_filter.pop("city", None)
        
        # Update content listening filters
        if listened_content_ids is not None:
            if listened_content_ids:
                target_filter["listened_content_ids"] = [cid.strip() for cid in listened_content_ids.split(",")]
            else:
                target_filter.pop("listened_content_ids", None)
        if not_listened_content_ids is not None:
            if not_listened_content_ids:
                target_filter["not_listened_content_ids"] = [cid.strip() for cid in not_listened_content_ids.split(",")]
            else:
                target_filter.pop("not_listened_content_ids", None)
        
        # Update user selection filters
        if max_users is not None:
            if max_users and max_users > 0:
                target_filter["max_users"] = max_users
            else:
                target_filter.pop("max_users", None)
        if excluded_user_ids is not None:
            if excluded_user_ids:
                target_filter["excluded_user_ids"] = [uid.strip() for uid in excluded_user_ids.split(",")]
            else:
                target_filter.pop("excluded_user_ids", None)
        if selected_user_ids is not None:
            if selected_user_ids:
                target_filter["selected_user_ids"] = [uid.strip() for uid in selected_user_ids.split(",")]
            else:
                target_filter.pop("selected_user_ids", None)
        
        # Add channel-specific requirements
        campaign_type = campaign.get("type", "push")
        if campaign_type == "email":
            target_filter["has_email"] = True
        elif campaign_type == "sms":
            target_filter["has_phone"] = True
        elif campaign_type == "push":
            target_filter["has_push_token"] = True
        
        update_data["target_filter"] = target_filter
        
        # Recount target users
        target_users = await get_target_users(db, target_filter)
        update_data["target_count"] = len(target_users)
    
    if scheduled_at is not None:
        try:
            update_data["scheduled_at"] = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
            update_data["status"] = "scheduled"
        except:
            pass
    
    await db.campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": update_data})
    
    updated_campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    
    return {"message": "Campaign updated successfully", "campaign": serialize_campaign(updated_campaign)}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Delete a campaign"""
    db = get_db()
    
    try:
        result = await db.campaigns.delete_one({"_id": ObjectId(campaign_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"message": "Campaign deleted successfully"}


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: str, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_admin_user)
):
    """Send a campaign immediately"""
    db = get_db()
    
    try:
        campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Campaign already sent")
    
    # Get target users
    target_users = await get_target_users(db, campaign.get("target_filter", {}))
    
    if not target_users:
        raise HTTPException(status_code=400, detail="No users match the target criteria")
    
    # Update status to sending
    await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {
            "status": "sent",
            "sent_at": datetime.now(timezone.utc),
            "target_count": len(target_users)
        }}
    )
    
    # Queue the actual sending (would integrate with push/SMS/email services)
    # For now, we just log and update counts
    logger.info(f"Campaign {campaign_id} sent to {len(target_users)} users")
    
    # Update sent count (in production, this would be updated as messages are actually sent)
    await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"sent_count": len(target_users)}}
    )
    
    return {
        "message": f"Campaign sent to {len(target_users)} users",
        "sent_count": len(target_users)
    }


@router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(campaign_id: str, current_user: dict = Depends(get_current_admin_user)):
    """Cancel a scheduled campaign"""
    db = get_db()
    
    try:
        campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid campaign ID")
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Cannot cancel a sent campaign")
    
    await db.campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}}
    )
    
    return {"message": "Campaign cancelled"}


@router.get("/preview-target-count")
async def preview_target_count(
    target_filter_type: str = Query("all"),
    campaign_type: str = Query("push"),
    # Location filters
    country: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    # Content listening filters
    listened_content_ids: Optional[str] = Query(None),
    not_listened_content_ids: Optional[str] = Query(None),
    # User selection filters
    max_users: Optional[int] = Query(None),
    excluded_user_ids: Optional[str] = Query(None),
    selected_user_ids: Optional[str] = Query(None)
):
    """Preview how many users would receive a campaign with advanced filtering"""
    db = get_db()
    
    target_filter = {"type": target_filter_type}
    
    # Location filters
    if country:
        target_filter["country"] = country
    if region:
        target_filter["region"] = region
    if city:
        target_filter["city"] = city
    
    # Content listening filters
    if listened_content_ids:
        target_filter["listened_content_ids"] = [cid.strip() for cid in listened_content_ids.split(",")]
    if not_listened_content_ids:
        target_filter["not_listened_content_ids"] = [cid.strip() for cid in not_listened_content_ids.split(",")]
    
    # User selection filters
    if max_users and max_users > 0:
        target_filter["max_users"] = max_users
    if excluded_user_ids:
        target_filter["excluded_user_ids"] = [uid.strip() for uid in excluded_user_ids.split(",")]
    if selected_user_ids:
        target_filter["selected_user_ids"] = [uid.strip() for uid in selected_user_ids.split(",")]
    
    # Channel-specific requirements
    if campaign_type == "email":
        target_filter["has_email"] = True
    elif campaign_type == "sms":
        target_filter["has_phone"] = True
    elif campaign_type == "push":
        target_filter["has_push_token"] = True
    
    target_users = await get_target_users(db, target_filter)
    
    return {
        "target_count": len(target_users),
        "filter": target_filter,
        "sample_users": target_users[:5] if target_users else []  # Show first 5 users as sample
    }


@router.get("/campaigns/preview-count")
async def preview_campaign_count_new(
    target_filter_type: str = Query("all"),
    campaign_type: str = Query("push"),
    # Location filters
    country: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    # Content listening filters
    listened_content_ids: Optional[str] = Query(None),
    not_listened_content_ids: Optional[str] = Query(None),
    # User selection filters
    max_users: Optional[int] = Query(None),
    excluded_user_ids: Optional[str] = Query(None),
    selected_user_ids: Optional[str] = Query(None)
):
    """Preview how many users would receive a campaign with advanced filtering"""
    db = get_db()
    
    target_filter = {"type": target_filter_type}
    
    # Location filters
    if country:
        target_filter["country"] = country
    if region:
        target_filter["region"] = region
    if city:
        target_filter["city"] = city
    
    # Content listening filters
    if listened_content_ids:
        target_filter["listened_content_ids"] = [cid.strip() for cid in listened_content_ids.split(",")]
    if not_listened_content_ids:
        target_filter["not_listened_content_ids"] = [cid.strip() for cid in not_listened_content_ids.split(",")]
    
    # User selection filters
    if max_users and max_users > 0:
        target_filter["max_users"] = max_users
    if excluded_user_ids:
        target_filter["excluded_user_ids"] = [uid.strip() for uid in excluded_user_ids.split(",")]
    if selected_user_ids:
        target_filter["selected_user_ids"] = [uid.strip() for uid in selected_user_ids.split(",")]
    
    # Channel-specific requirements
    if campaign_type == "email":
        target_filter["has_email"] = True
    elif campaign_type == "sms":
        target_filter["has_phone"] = True
    elif campaign_type == "push":
        target_filter["has_push_token"] = True
    
    target_users = await get_target_users(db, target_filter)
    
    return {
        "target_count": len(target_users),
        "filter": target_filter,
        "sample_users": target_users[:5] if target_users else []  # Show first 5 users as sample
    }


@router.get("/campaigns/{campaign_id}/preview-count")
async def preview_campaign_count(
    campaign_id: Optional[str] = None,
    target_filter_type: str = Query("all"),
    campaign_type: str = Query("push"),
    # Location filters
    country: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    # Content listening filters
    listened_content_ids: Optional[str] = Query(None),
    not_listened_content_ids: Optional[str] = Query(None),
    # User selection filters
    max_users: Optional[int] = Query(None),
    excluded_user_ids: Optional[str] = Query(None),
    selected_user_ids: Optional[str] = Query(None)
):
    """Preview how many users would receive a campaign with advanced filtering"""
    db = get_db()
    
    target_filter = {"type": target_filter_type}
    
    # Location filters
    if country:
        target_filter["country"] = country
    if region:
        target_filter["region"] = region
    if city:
        target_filter["city"] = city
    
    # Content listening filters
    if listened_content_ids:
        target_filter["listened_content_ids"] = [cid.strip() for cid in listened_content_ids.split(",")]
    if not_listened_content_ids:
        target_filter["not_listened_content_ids"] = [cid.strip() for cid in not_listened_content_ids.split(",")]
    
    # User selection filters
    if max_users and max_users > 0:
        target_filter["max_users"] = max_users
    if excluded_user_ids:
        target_filter["excluded_user_ids"] = [uid.strip() for uid in excluded_user_ids.split(",")]
    if selected_user_ids:
        target_filter["selected_user_ids"] = [uid.strip() for uid in selected_user_ids.split(",")]
    
    # Channel-specific requirements
    if campaign_type == "email":
        target_filter["has_email"] = True
    elif campaign_type == "sms":
        target_filter["has_phone"] = True
    elif campaign_type == "push":
        target_filter["has_push_token"] = True
    
    target_users = await get_target_users(db, target_filter)
    
    return {
        "target_count": len(target_users),
        "filter": target_filter,
        "sample_users": target_users[:5] if target_users else []  # Show first 5 users as sample
    }


# ==================== CLIENT ENDPOINTS (Mobile App) ====================

@router.get("/next-ad")
async def get_next_ad(
    user_id: Optional[str] = None,
    platform: str = Query("mobile"),
    songs_played: int = Query(0),
    last_ad_time: Optional[str] = None
):
    """Get the next ad to play for a user"""
    db = get_db()
    
    settings = await db.system_settings.find_one({"key": "advertising"})
    if not settings or not settings.get("enabled", False):
        return {"should_play_ad": False, "ad": None, "reason": "ads_disabled"}
    
    if user_id and settings.get("free_users_only", True):
        user = await db.app_users.find_one({"user_id": user_id})
        if user and (user.get("subscription", {}).get("status") == "active" or user.get("is_premium")):
            return {"should_play_ad": False, "ad": None, "reason": "premium_user"}
    
    ads_interval_songs = settings.get("ads_interval_songs", 3)
    ads_interval_minutes = settings.get("ads_interval_minutes", 15)
    
    should_play = False
    
    if songs_played > 0 and songs_played % ads_interval_songs == 0:
        should_play = True
    
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
    
    now = datetime.now(timezone.utc)
    query = {
        "is_active": True,
        "$or": [
            {"start_date": None},
            {"start_date": {"$lte": now}}
        ]
    }
    
    ads = await db.advertisements.find(query).sort("priority", -1).to_list(100)
    
    valid_ads = [ad for ad in ads if not ad.get("end_date") or ad["end_date"] >= now]
    
    if not valid_ads:
        return {"should_play_ad": False, "ad": None, "reason": "no_active_ads"}
    
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
    """Record an ad impression"""
    db = get_db()
    
    try:
        ad = await db.advertisements.find_one({"_id": ObjectId(ad_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid ad ID")
    
    if not ad:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    
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
    
    update_ops = {"$inc": {"total_impressions": 1}}
    if completed:
        update_ops["$inc"]["total_completions"] = 1
    if clicked:
        update_ops["$inc"]["total_clicks"] = 1
    
    await db.advertisements.update_one({"_id": ObjectId(ad_id)}, update_ops)
    
    return {"message": "Impression recorded", "impression_id": impression["impression_id"]}


# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/analytics/overview")
async def get_ad_analytics_overview(days: int = Query(30, ge=1, le=365)):
    """Get advertising analytics overview"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    total_ads = await db.advertisements.count_documents({})
    active_ads = await db.advertisements.count_documents({"is_active": True})
    
    total_impressions = await db.ad_impressions.count_documents({"created_at": {"$gte": start_date}})
    total_completions = await db.ad_impressions.count_documents({"created_at": {"$gte": start_date}, "completed": True})
    total_clicks = await db.ad_impressions.count_documents({"created_at": {"$gte": start_date}, "clicked": True})
    
    completion_rate = (total_completions / total_impressions * 100) if total_impressions > 0 else 0
    click_rate = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    
    # Campaign stats
    total_campaigns = await db.campaigns.count_documents({})
    sent_campaigns = await db.campaigns.count_documents({"status": "sent"})
    
    return {
        "period_days": days,
        "total_ads": total_ads,
        "active_ads": active_ads,
        "total_impressions": total_impressions,
        "total_completions": total_completions,
        "total_clicks": total_clicks,
        "completion_rate": round(completion_rate, 2),
        "click_rate": round(click_rate, 2),
        "total_campaigns": total_campaigns,
        "sent_campaigns": sent_campaigns
    }


@router.get("/analytics/trends")
async def get_ad_analytics_trends(days: int = Query(30, ge=1, le=365)):
    """Get daily ad impression trends"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
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
async def get_analytics_by_ad(days: int = Query(30, ge=1, le=365)):
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
async def get_analytics_by_platform(days: int = Query(30, ge=1, le=365)):
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
