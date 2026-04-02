"""
Analytics routes for Gracefy Admin Panel.
Dashboard statistics, trends, and user demographics.
"""

from fastapi import APIRouter, Query, Request
from datetime import datetime, timezone
from typing import Optional
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/analytics/overview")
async def get_analytics_overview():
    """Get dashboard analytics overview"""
    db = get_db()
    
    # Use cache for expensive counts
    cache_key = "analytics:overview"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    total_users = await db.users.count_documents({})
    total_customers = await db.users.count_documents({"role": "customer"})
    total_system_users = await db.users.count_documents({"role": {"$ne": "customer"}})
    total_songs = await db.songs.count_documents({})
    total_albums = await db.albums.count_documents({})
    total_churches = await db.churches.count_documents({})
    total_leaders = await db.religious_leaders.count_documents({})
    total_donations = await db.donation_campaigns.count_documents({})
    pending_approvals = await db.churches.count_documents({"status": "pending"})
    pending_approvals += await db.religious_leaders.count_documents({"status": "pending"})
    pending_approvals += await db.community_posts.count_documents({"status": "pending"})
    
    # Get leader content stats
    total_content_containers = await db.content_containers.count_documents({})
    total_content_episodes = await db.content_episodes.count_documents({})
    
    # Content duration in minutes
    content_duration_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_duration_minutes"}}}]
    content_duration_result = await db.content_containers.aggregate(content_duration_pipeline).to_list(1)
    total_content_minutes = content_duration_result[0]["total"] if content_duration_result else 0
    
    # Get total raised amount
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$raised_amount"}}}]
    donation_result = await db.donation_campaigns.aggregate(pipeline).to_list(1)
    total_raised = donation_result[0]["total"] if donation_result else 0
    
    result = {
        "total_users": total_users,
        "total_customers": total_customers,
        "total_system_users": total_system_users,
        "total_songs": total_songs,
        "total_albums": total_albums,
        "total_churches": total_churches,
        "total_leaders": total_leaders,
        "total_donations": total_donations,
        "pending_approvals": pending_approvals,
        "total_raised": total_raised,
        "total_content_containers": total_content_containers,
        "total_content_episodes": total_content_episodes,
        "total_content_minutes": total_content_minutes
    }
    
    await cache.set(cache_key, result, 60)
    return result


@router.get("/analytics/trends")
async def get_trends():
    """Get user and content trends for charts - REAL DATA"""
    db = get_db()
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    
    # User Growth - Last 6 months of real data
    user_growth = []
    for i in range(5, -1, -1):
        month_start = (now - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_name = month_start.strftime("%b")
        
        # Count users created before this month end (cumulative)
        total_users = await db.app_users.count_documents({
            "created_at": {"$lt": month_end.isoformat()}
        })
        # Also count from regular users collection
        total_users += await db.users.count_documents({
            "created_at": {"$lt": month_end.isoformat()}
        })
        
        # Active users in this month
        active_users = await db.listening_sessions.distinct("user_id", {
            "start_time": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
        })
        
        user_growth.append({
            "month": month_name,
            "users": total_users,
            "active": len(active_users) if active_users else 0
        })
    
    # Content Performance - Real category plays from listening sessions
    category_pipeline = [
        {"$match": {"counted_as_play": True}},
        {"$lookup": {
            "from": "songs",
            "localField": "content_id",
            "foreignField": "song_id",
            "as": "song"
        }},
        {"$unwind": {"path": "$song", "preserveNullAndEmptyArrays": True}},
        {"$lookup": {
            "from": "albums",
            "localField": "song.album_id",
            "foreignField": "album_id",
            "as": "album"
        }},
        {"$unwind": {"path": "$album", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$album.category_name",
            "plays": {"$sum": 1}
        }},
        {"$sort": {"plays": -1}},
        {"$limit": 6}
    ]
    categories = await db.listening_sessions.aggregate(category_pipeline).to_list(6)
    
    # Fallback: if no listening sessions, get from albums directly
    if not categories:
        album_category_pipeline = [
            {"$group": {"_id": "$category_name", "plays": {"$sum": {"$ifNull": ["$total_plays", 0]}}}},
            {"$sort": {"plays": -1}},
            {"$limit": 6}
        ]
        categories = await db.albums.aggregate(album_category_pipeline).to_list(6)
    
    content_performance = [
        {"category": c["_id"] or "Uncategorized", "plays": c["plays"]}
        for c in categories
    ]
    
    # Add default categories if empty
    if not content_performance:
        content_performance = [
            {"category": "Music", "plays": await db.songs.count_documents({}) * 10},
            {"category": "Albums", "plays": await db.albums.count_documents({}) * 5},
        ]
    
    # Donations Trend - Real data from donations
    donations_trend = []
    for i in range(5, -1, -1):
        month_start = (now - timedelta(days=30*i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_name = month_start.strftime("%b")
        
        # Sum donations in this month
        donation_pipeline = [
            {"$match": {"created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}}},
            {"$group": {"_id": None, "total": {"$sum": "$raised_amount"}}}
        ]
        donation_result = await db.donation_campaigns.aggregate(donation_pipeline).to_list(1)
        amount = donation_result[0]["total"] if donation_result else 0
        
        donations_trend.append({"month": month_name, "amount": amount})
    
    return {
        "user_growth": user_growth,
        "content_performance": content_performance,
        "donations_trend": donations_trend
    }


@router.get("/analytics/user-demographics")
async def get_user_demographics():
    """Get user demographics statistics - location, age, gender, device type"""
    db = get_db()
    
    cache_key = "analytics:demographics"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # Get app users for demographics
    app_users = await db.app_users.find({}, {"_id": 0}).to_list(10000)
    
    # Process demographics
    location_stats = {}
    age_stats = {"0-17": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "unknown": 0}
    gender_stats = {"male": 0, "female": 0, "other": 0, "unknown": 0}
    device_stats = {"android": 0, "ios": 0, "web": 0, "unknown": 0}
    
    current_year = datetime.now().year
    
    for user in app_users:
        # Location - handle both string and dict formats
        location = user.get("location") or user.get("country") or "Unknown"
        if isinstance(location, dict):
            location = location.get("country") or location.get("name") or "Unknown"
        location_stats[location] = location_stats.get(location, 0) + 1
        
        # Age calculation
        birth_year = user.get("birth_year")
        if birth_year:
            age = current_year - birth_year
            if age < 18:
                age_stats["0-17"] += 1
            elif age < 25:
                age_stats["18-24"] += 1
            elif age < 35:
                age_stats["25-34"] += 1
            elif age < 45:
                age_stats["35-44"] += 1
            elif age < 55:
                age_stats["45-54"] += 1
            else:
                age_stats["55+"] += 1
        else:
            age_stats["unknown"] += 1
        
        # Gender
        gender = user.get("gender", "unknown").lower()
        if gender in gender_stats:
            gender_stats[gender] += 1
        else:
            gender_stats["unknown"] += 1
        
        # Device
        device = user.get("device_type", "unknown").lower()
        if device in device_stats:
            device_stats[device] += 1
        else:
            device_stats["unknown"] += 1
    
    # Get top locations
    top_locations = sorted(location_stats.items(), key=lambda x: x[1], reverse=True)[:10]
    
    result = {
        "total_users": len(app_users),
        "locations": dict(top_locations),
        "age_distribution": age_stats,
        "gender_distribution": gender_stats,
        "device_distribution": device_stats
    }
    
    await cache.set(cache_key, result, 300)
    return result


@router.get("/analytics/content-performance")
async def get_content_performance(
    period: str = Query("7d", description="Time period: 7d, 30d, 90d")
):
    """Get content performance metrics"""
    db = get_db()
    
    # Calculate date range
    from datetime import timedelta
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Top albums by plays
    top_albums = await db.albums.find(
        {"status": "active"},
        {"_id": 0, "album_id": 1, "title": 1, "total_plays": 1, "artist_name": 1}
    ).sort("total_plays", -1).limit(10).to_list(10)
    
    # Top songs by plays
    top_songs = await db.songs.find(
        {"status": "active"},
        {"_id": 0, "song_id": 1, "title": 1, "plays": 1, "album_id": 1}
    ).sort("plays", -1).limit(10).to_list(10)
    
    # Category distribution
    category_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$category_name", "count": {"$sum": 1}, "plays": {"$sum": "$total_plays"}}},
        {"$sort": {"plays": -1}},
        {"$limit": 10}
    ]
    categories = await db.albums.aggregate(category_pipeline).to_list(10)
    
    return {
        "period": period,
        "top_albums": top_albums,
        "top_songs": top_songs,
        "category_distribution": [
            {"category": c["_id"] or "Uncategorized", "albums": c["count"], "plays": c["plays"]}
            for c in categories
        ]
    }


@router.get("/analytics/revenue")
async def get_revenue_analytics(
    period: str = Query("30d", description="Time period")
):
    """Get revenue analytics"""
    db = get_db()
    
    # Subscription revenue
    transactions = await db.transactions.find(
        {"status": "completed"},
        {"_id": 0}
    ).sort("created_at", -1).limit(1000).to_list(1000)
    
    total_revenue = sum(t.get("amount", 0) for t in transactions)
    
    # Revenue by payment method
    method_pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$payment_method", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    by_method = await db.transactions.aggregate(method_pipeline).to_list(10)
    
    # Revenue by plan
    plan_pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": "$plan_name", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    by_plan = await db.transactions.aggregate(plan_pipeline).to_list(10)
    
    return {
        "period": period,
        "total_revenue": total_revenue,
        "transaction_count": len(transactions),
        "by_payment_method": [
            {"method": m["_id"] or "Unknown", "total": m["total"], "count": m["count"]}
            for m in by_method
        ],
        "by_plan": [
            {"plan": p["_id"] or "Unknown", "total": p["total"], "count": p["count"]}
            for p in by_plan
        ]
    }


@router.get("/analytics/streaming")
async def get_streaming_analytics():
    """Get real-time streaming analytics"""
    db = get_db()
    
    # Active streams in last 5 minutes
    five_min_ago = (datetime.now(timezone.utc) - __import__('datetime').timedelta(minutes=5)).isoformat()
    
    active_streams = await db.listening_sessions.count_documents({
        "end_time": None,
        "start_time": {"$gte": five_min_ago}
    })
    
    # Active listeners
    active_pipeline = [
        {"$match": {"end_time": None, "start_time": {"$gte": five_min_ago}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "count"}
    ]
    active_result = await db.listening_sessions.aggregate(active_pipeline).to_list(1)
    active_listeners = active_result[0]["count"] if active_result else 0
    
    # Streams per minute (last hour)
    hour_ago = (datetime.now(timezone.utc) - __import__('datetime').timedelta(hours=1)).isoformat()
    per_minute_pipeline = [
        {"$match": {"start_time": {"$gte": hour_ago}}},
        {"$group": {
            "_id": {"$substr": ["$start_time", 0, 16]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 60}
    ]
    per_minute = await db.listening_sessions.aggregate(per_minute_pipeline).to_list(60)
    
    return {
        "active_streams": active_streams,
        "active_listeners": active_listeners,
        "per_minute": [{"time": m["_id"], "streams": m["count"]} for m in per_minute]
    }


# ============== PLAY COUNTING ==============
# Rule: A play counts only if played for 45 seconds or more

MINIMUM_PLAY_SECONDS = 45  # Minimum seconds to count as a play

@router.post("/analytics/record-play")
async def record_play(data: dict):
    """
    Record a play event after user has listened for 45+ seconds.
    Updates play_count on the content and creates a listening session.
    
    Body:
    - content_type: "song" | "teaching_lesson" | "bible_tts" | "album"
    - content_id: ID of the content
    - user_id: Optional user ID (anonymous if not provided)
    - duration_played: Seconds played (must be >= 45 to count)
    - platform: "web" | "app" | "pwa"
    """
    db = get_db()
    
    content_type = data.get("content_type")
    content_id = data.get("content_id")
    duration_played = data.get("duration_played", 0)
    user_id = data.get("user_id")
    platform = data.get("platform", "web")
    
    if not content_type or not content_id:
        return {"error": "content_type and content_id required", "counted": False}
    
    # Only count if played for minimum duration
    if duration_played < MINIMUM_PLAY_SECONDS:
        return {
            "counted": False,
            "reason": f"Played {duration_played}s, minimum is {MINIMUM_PLAY_SECONDS}s"
        }
    
    # Create listening session record
    session_id = f"session_{__import__('uuid').uuid4().hex[:12]}"
    session = {
        "session_id": session_id,
        "content_type": content_type,
        "content_id": content_id,
        "user_id": user_id,
        "duration_seconds": duration_played,
        "platform": platform,
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": datetime.now(timezone.utc).isoformat(),
        "counted_as_play": True
    }
    await db.listening_sessions.insert_one(session)
    
    # Update play count on the content
    play_count_updated = False
    
    if content_type == "song":
        # Update song play_count
        result = await db.songs.update_one(
            {"song_id": content_id},
            {"$inc": {"play_count": 1, "plays": 1}}
        )
        play_count_updated = result.modified_count > 0
        
        # Also update the album's total_plays
        song = await db.songs.find_one({"song_id": content_id}, {"_id": 0, "album_id": 1})
        if song and song.get("album_id"):
            await db.albums.update_one(
                {"album_id": song["album_id"]},
                {"$inc": {"play_count": 1, "total_plays": 1}}
            )
        
    elif content_type == "teaching_lesson":
        result = await db.teaching_lessons.update_one(
            {"lesson_id": content_id},
            {"$inc": {"play_count": 1, "plays": 1}}
        )
        play_count_updated = result.modified_count > 0
        # Also update the teaching's total play count
        lesson = await db.teaching_lessons.find_one({"lesson_id": content_id})
        if lesson:
            await db.teachings.update_one(
                {"teaching_id": lesson.get("teaching_id")},
                {"$inc": {"play_count": 1, "total_plays": 1}}
            )
            
    elif content_type == "album":
        result = await db.albums.update_one(
            {"album_id": content_id},
            {"$inc": {"play_count": 1, "total_plays": 1}}
        )
        play_count_updated = result.modified_count > 0
        
    elif content_type == "bible_tts":
        result = await db.bible_snippets.update_one(
            {"snippet_id": content_id},
            {"$inc": {"play_count": 1, "plays": 1}}
        )
        play_count_updated = result.modified_count > 0
    
    # Invalidate relevant caches
    await cache.delete("analytics:overview")
    await cache.delete("home:*")
    
    logger.info(f"Play recorded: {content_type}/{content_id} - {duration_played}s by {user_id or 'anonymous'}")
    
    return {
        "counted": True,
        "session_id": session_id,
        "play_count_updated": play_count_updated,
        "duration_played": duration_played
    }


@router.post("/analytics/start-session")
async def start_listening_session(data: dict, request: Request = None):
    """
    Start a listening session (called when playback begins).
    Used to track active listeners.
    """
    db = get_db()
    
    # Get user's country for geo analytics
    country_code = data.get("country_code")
    if not country_code and data.get("user_id"):
        user = await db.app_users.find_one(
            {"user_id": data["user_id"]},
            {"_id": 0, "country_override": 1, "country_code": 1}
        )
        if user:
            country_code = user.get("country_override") or user.get("country_code")
    
    if not country_code:
        country_code = "GLOBAL"
    
    session_id = f"session_{__import__('uuid').uuid4().hex[:12]}"
    session = {
        "session_id": session_id,
        "content_type": data.get("content_type"),
        "content_id": data.get("content_id"),
        "user_id": data.get("user_id"),
        "platform": data.get("platform", "web"),
        "country_code": country_code,
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": None,  # Will be set when session ends
        "counted_as_play": False  # Will be updated if 45+ seconds played
    }
    
    await db.listening_sessions.insert_one(session)
    
    return {"session_id": session_id}


@router.post("/analytics/end-session")
async def end_listening_session(data: dict):
    """
    End a listening session and record the play if 45+ seconds.
    """
    db = get_db()
    
    session_id = data.get("session_id")
    duration_played = data.get("duration_played", 0)
    
    if not session_id:
        return {"error": "session_id required"}
    
    # Update session
    counted = duration_played >= MINIMUM_PLAY_SECONDS
    await db.listening_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "end_time": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": duration_played,
            "counted_as_play": counted
        }}
    )
    
    # If played long enough, update play count
    if counted:
        session = await db.listening_sessions.find_one({"session_id": session_id})
        if session:
            content_type = session.get("content_type")
            content_id = session.get("content_id")
            
            if content_type == "song":
                await db.songs.update_one(
                    {"song_id": content_id},
                    {"$inc": {"play_count": 1, "plays": 1}}
                )
                # Also update the album's total_plays
                song = await db.songs.find_one({"song_id": content_id}, {"_id": 0, "album_id": 1})
                if song and song.get("album_id"):
                    await db.albums.update_one(
                        {"album_id": song["album_id"]},
                        {"$inc": {"play_count": 1, "total_plays": 1}}
                    )
            elif content_type == "teaching_lesson":
                await db.teaching_lessons.update_one(
                    {"lesson_id": content_id},
                    {"$inc": {"play_count": 1, "plays": 1}}
                )
                lesson = await db.teaching_lessons.find_one({"lesson_id": content_id})
                if lesson:
                    await db.teachings.update_one(
                        {"teaching_id": lesson.get("teaching_id")},
                        {"$inc": {"play_count": 1, "total_plays": 1}}
                    )
            elif content_type == "album":
                await db.albums.update_one(
                    {"album_id": content_id},
                    {"$inc": {"play_count": 1, "total_plays": 1}}
                )
    
    return {
        "session_id": session_id,
        "duration_played": duration_played,
        "counted_as_play": counted
    }


@router.get("/analytics/content/{content_type}/{content_id}")
async def get_content_analytics(content_type: str, content_id: str):
    """Get analytics for a specific piece of content"""
    db = get_db()
    
    # Get play sessions for this content
    sessions = await db.listening_sessions.find({
        "content_type": content_type,
        "content_id": content_id,
        "counted_as_play": True
    }).to_list(1000)
    
    total_plays = len(sessions)
    total_duration = sum(s.get("duration_seconds", 0) for s in sessions)
    unique_listeners = len(set(s.get("user_id") for s in sessions if s.get("user_id")))
    
    # Platform breakdown
    platforms = {}
    for s in sessions:
        p = s.get("platform", "unknown")
        platforms[p] = platforms.get(p, 0) + 1
    
    return {
        "content_type": content_type,
        "content_id": content_id,
        "total_plays": total_plays,
        "total_duration_minutes": round(total_duration / 60, 2),
        "unique_listeners": unique_listeners,
        "platforms": platforms,
        "minimum_play_seconds": MINIMUM_PLAY_SECONDS
    }



@router.get("/analytics/enhanced")
async def get_enhanced_analytics(
    period: str = Query("30d", description="Time period: 7d, 30d, 90d, 365d")
):
    """Get comprehensive enhanced analytics for the dashboard with real data"""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}.get(period, 30)
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)
    
    # ========== OVERVIEW STATS ==========
    # Total users (app_users + regular users)
    total_app_users = await db.app_users.count_documents({})
    total_system_users = await db.users.count_documents({})
    total_users = total_app_users + total_system_users
    
    # New users in period
    new_app_users = await db.app_users.count_documents({"created_at": {"$gte": start_date.isoformat()}})
    new_system_users = await db.users.count_documents({"created_at": {"$gte": start_date.isoformat()}})
    new_users = new_app_users + new_system_users
    
    # Content stats
    total_songs = await db.songs.count_documents({"status": {"$ne": "disabled_no_audio"}})
    total_albums = await db.albums.count_documents({})
    total_choirs = await db.singers.count_documents({})
    
    # ========== STREAMING STATS ==========
    # Total streams (plays that counted - 45+ seconds)
    total_streams = await db.listening_sessions.count_documents({"counted_as_play": True})
    
    # Streams in period
    period_streams = await db.listening_sessions.count_documents({
        "counted_as_play": True,
        "start_time": {"$gte": start_date.isoformat()}
    })
    
    # Unique listeners in period
    unique_listeners_result = await db.listening_sessions.distinct("user_id", {
        "start_time": {"$gte": start_date.isoformat()}
    })
    unique_listeners = len([u for u in unique_listeners_result if u])
    
    # Total listening time
    listen_time_pipeline = [
        {"$match": {"start_time": {"$gte": start_date.isoformat()}}},
        {"$group": {"_id": None, "total_seconds": {"$sum": "$duration_seconds"}}}
    ]
    listen_time_result = await db.listening_sessions.aggregate(listen_time_pipeline).to_list(1)
    total_listen_seconds = listen_time_result[0]["total_seconds"] if listen_time_result else 0
    total_listening_hours = round(total_listen_seconds / 3600, 2)
    
    # Average session duration
    if period_streams > 0:
        avg_session_duration = round(total_listen_seconds / period_streams / 60, 1)  # in minutes
    else:
        avg_session_duration = 0
    
    # Unique songs played
    unique_songs = await db.listening_sessions.distinct("content_id", {
        "content_type": "song",
        "start_time": {"$gte": start_date.isoformat()}
    })
    unique_songs_played = len(unique_songs) if unique_songs else 0
    
    # ========== REVENUE STATS (only if billing enabled) ==========
    # Check if billing/monetization is enabled - check subscription_settings first
    subscription_settings = await db.subscription_settings.find_one({}, {"_id": 0})
    billing_enabled = subscription_settings.get("billing_enabled", True) if subscription_settings else True
    
    # Get revenue settings for rates
    revenue_settings = await db.revenue_settings.find_one({}, {"_id": 0})
    monetization_mode = revenue_settings.get("monetization_mode", "time_based") if revenue_settings else "time_based"
    
    gross_revenue = 0
    platform_revenue = 0
    choir_payouts = 0
    premium_hours = 0
    standard_hours = 0
    
    if billing_enabled and revenue_settings:
        premium_rate = revenue_settings.get("premium_rate_per_hour", 10)
        standard_rate = revenue_settings.get("standard_rate_per_hour", 5)
        platform_share = revenue_settings.get("platform_share_percentage", 30) / 100
        
        # Calculate revenue from listening sessions
        revenue_sessions = await db.listening_sessions.find({
            "counted_as_play": True,
            "start_time": {"$gte": start_date.isoformat()}
        }, {"_id": 0, "duration_seconds": 1, "monetization_type": 1, "revenue_earned": 1}).to_list(100000)
        
        for session in revenue_sessions:
            duration_hours = session.get("duration_seconds", 0) / 3600
            mon_type = session.get("monetization_type", "standard")
            
            if session.get("revenue_earned"):
                # Use pre-calculated revenue
                gross_revenue += session["revenue_earned"]
            else:
                # Calculate revenue
                if mon_type == "premium":
                    session_revenue = duration_hours * premium_rate
                    premium_hours += duration_hours
                else:
                    session_revenue = duration_hours * standard_rate
                    standard_hours += duration_hours
                gross_revenue += session_revenue
        
        platform_revenue = gross_revenue * platform_share
        choir_payouts = gross_revenue * (1 - platform_share)
    
    # Revenue-eligible streams (45+ seconds)
    revenue_streams = await db.listening_sessions.count_documents({
        "counted_as_play": True,
        "duration_seconds": {"$gte": 45},
        "start_time": {"$gte": start_date.isoformat()}
    })
    
    # ========== DAILY TREND ==========
    daily_trend = []
    for i in range(days, 0, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        day_start = f"{day}T00:00:00"
        day_end = f"{day}T23:59:59"
        
        # Streams on this day
        day_streams = await db.listening_sessions.count_documents({
            "counted_as_play": True,
            "start_time": {"$gte": day_start, "$lte": day_end}
        })
        
        # Revenue on this day (if billing enabled)
        day_revenue = 0
        if billing_enabled:
            day_sessions = await db.listening_sessions.find({
                "counted_as_play": True,
                "start_time": {"$gte": day_start, "$lte": day_end}
            }, {"_id": 0, "duration_seconds": 1, "revenue_earned": 1}).to_list(10000)
            
            for s in day_sessions:
                if s.get("revenue_earned"):
                    day_revenue += s["revenue_earned"]
                else:
                    day_revenue += (s.get("duration_seconds", 0) / 3600) * (revenue_settings.get("standard_rate_per_hour", 5) if revenue_settings else 5)
        
        daily_trend.append({
            "date": day,
            "streams": day_streams,
            "revenue": round(day_revenue, 2)
        })
    
    # ========== TOP SONGS ==========
    top_songs_pipeline = [
        {"$match": {"counted_as_play": True, "content_type": "song", "start_time": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": "$content_id",
            "plays": {"$sum": 1},
            "total_seconds": {"$sum": "$duration_seconds"}
        }},
        {"$sort": {"plays": -1}},
        {"$limit": 10}
    ]
    top_songs_raw = await db.listening_sessions.aggregate(top_songs_pipeline).to_list(10)
    
    top_songs = []
    for item in top_songs_raw:
        song = await db.songs.find_one({"song_id": item["_id"]}, {"_id": 0, "title": 1, "artist_name": 1, "album_id": 1})
        if song:
            album = await db.albums.find_one({"album_id": song.get("album_id")}, {"_id": 0, "title": 1})
            top_songs.append({
                "song_id": item["_id"],
                "title": song.get("title", "Unknown"),
                "artist": song.get("artist_name", "Unknown"),
                "album": album.get("title", "") if album else "",
                "plays": item["plays"],
                "hours": round(item["total_seconds"] / 3600, 2)
            })
    
    # ========== TOP CHOIRS ==========
    top_choirs_pipeline = [
        {"$match": {"counted_as_play": True, "start_time": {"$gte": start_date.isoformat()}}},
        {"$lookup": {
            "from": "songs",
            "localField": "content_id",
            "foreignField": "song_id",
            "as": "song"
        }},
        {"$unwind": {"path": "$song", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$song.artist_name",
            "streams": {"$sum": 1},
            "total_seconds": {"$sum": "$duration_seconds"},
            "listeners": {"$addToSet": "$user_id"}
        }},
        {"$sort": {"streams": -1}},
        {"$limit": 10}
    ]
    top_choirs_raw = await db.listening_sessions.aggregate(top_choirs_pipeline).to_list(10)
    
    top_choirs = []
    for item in top_choirs_raw:
        if item["_id"]:
            hours = round(item["total_seconds"] / 3600, 2)
            revenue = hours * (revenue_settings.get("standard_rate_per_hour", 5) if revenue_settings and billing_enabled else 0)
            top_choirs.append({
                "choir_id": item["_id"],
                "name": item["_id"],
                "streams": item["streams"],
                "hours": hours,
                "unique_listeners": len([l for l in item["listeners"] if l]),
                "revenue": round(revenue, 2)
            })
    
    # ========== CATEGORY DISTRIBUTION ==========
    categories_pipeline = [
        {"$match": {"counted_as_play": True, "content_type": "song", "start_time": {"$gte": start_date.isoformat()}}},
        {"$lookup": {
            "from": "songs",
            "localField": "content_id",
            "foreignField": "song_id",
            "as": "song"
        }},
        {"$unwind": {"path": "$song", "preserveNullAndEmptyArrays": True}},
        {"$lookup": {
            "from": "albums",
            "localField": "song.album_id",
            "foreignField": "album_id",
            "as": "album"
        }},
        {"$unwind": {"path": "$album", "preserveNullAndEmptyArrays": True}},
        {"$group": {
            "_id": "$album.category_name",
            "streams": {"$sum": 1}
        }},
        {"$sort": {"streams": -1}},
        {"$limit": 6}
    ]
    categories_raw = await db.listening_sessions.aggregate(categories_pipeline).to_list(6)
    categories = [{"name": c["_id"] or "Uncategorized", "streams": c["streams"]} for c in categories_raw]
    
    # ========== ALBUM PERFORMANCE ==========
    albums_pipeline = [
        {"$match": {"counted_as_play": True, "content_type": "song", "start_time": {"$gte": start_date.isoformat()}}},
        {"$lookup": {
            "from": "songs",
            "localField": "content_id",
            "foreignField": "song_id",
            "as": "song"
        }},
        {"$unwind": "$song"},
        {"$group": {
            "_id": "$song.album_id",
            "total_plays": {"$sum": 1},
            "total_seconds": {"$sum": "$duration_seconds"}
        }},
        {"$sort": {"total_plays": -1}},
        {"$limit": 10}
    ]
    albums_raw = await db.listening_sessions.aggregate(albums_pipeline).to_list(10)
    
    albums = []
    for item in albums_raw:
        album = await db.albums.find_one({"album_id": item["_id"]}, {"_id": 0, "title": 1, "artist_name": 1, "monetization_type": 1})
        if album:
            total_minutes = round(item["total_seconds"] / 60, 1)
            total_hours = round(item["total_seconds"] / 3600, 2)
            avg_per_play = round(total_minutes / item["total_plays"], 1) if item["total_plays"] > 0 else 0
            
            # Calculate revenue based on album type
            rate = revenue_settings.get("premium_rate_per_hour", 10) if album.get("monetization_type") == "premium" else revenue_settings.get("standard_rate_per_hour", 5) if revenue_settings else 5
            revenue = round(total_hours * rate, 2) if billing_enabled else 0
            
            albums.append({
                "album_id": item["_id"],
                "title": album.get("title", "Unknown"),
                "artist_name": album.get("artist_name", "Unknown"),
                "monetization_type": album.get("monetization_type", "standard"),
                "total_plays": item["total_plays"],
                "minutes_streamed": total_minutes,
                "total_hours": total_hours,
                "avg_minutes_per_play": avg_per_play,
                "revenue": revenue
            })
    
    # ========== RATES INFO ==========
    rates = {
        "premium_rate": revenue_settings.get("premium_rate_per_hour", 0) if revenue_settings else 0,
        "standard_rate": revenue_settings.get("standard_rate_per_hour", 0) if revenue_settings else 0,
        "platform_share": revenue_settings.get("platform_share_percentage", 30) if revenue_settings else 30,
        "billing_enabled": billing_enabled,
        "monetization_mode": monetization_mode
    }
    
    return {
        "period": period,
        "overview": {
            "total_streams": total_streams,
            "revenue_streams": revenue_streams,
            "unique_listeners": unique_listeners,
            "total_listening_hours": total_listening_hours,
            "avg_session_duration": avg_session_duration,
            "unique_songs_played": unique_songs_played,
            "gross_revenue": round(gross_revenue, 2),
            "platform_revenue": round(platform_revenue, 2),
            "choir_payouts": round(choir_payouts, 2)
        },
        "platform_stats": {
            "total_albums": total_albums,
            "total_songs": total_songs,
            "total_choirs": total_choirs,
            "total_users": total_users
        },
        "revenue_breakdown": {
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "premium_revenue": round(premium_hours * (revenue_settings.get("premium_rate_per_hour", 10) if revenue_settings else 10), 2) if billing_enabled else 0,
            "standard_revenue": round(standard_hours * (revenue_settings.get("standard_rate_per_hour", 5) if revenue_settings else 5), 2) if billing_enabled else 0
        },
        "daily_trend": daily_trend,
        "top_songs": top_songs,
        "top_choirs": top_choirs,
        "categories": categories,
        "albums": albums,
        "rates": rates
    }


@router.get("/analytics/realtime")
async def get_realtime_analytics():
    """Get real-time analytics for live dashboard"""
    db = get_db()
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    two_min_ago = (now - timedelta(minutes=2)).isoformat()
    five_min_ago = (now - timedelta(minutes=5)).isoformat()
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Active streams from active_streams collection (real-time, heartbeat-based)
    active_streams_data = await db.active_streams.find(
        {
            "is_active": True,
            "last_heartbeat": {"$gte": two_min_ago}
        },
        {"_id": 0, "user_id": 1, "device_id": 1, "platform": 1, "song_title": 1, "artist_name": 1}
    ).to_list(1000)
    
    active_streams = len(active_streams_data)
    
    # Count unique listeners (by user_id) and unique devices
    unique_users = set()
    unique_devices = set()
    platforms = {}
    
    for s in active_streams_data:
        unique_users.add(s.get("user_id"))
        unique_devices.add(s.get("device_id"))
        p = s.get("platform", "unknown")
        platforms[p] = platforms.get(p, 0) + 1
    
    active_listeners = len(unique_users)
    
    # Fallback to listening_sessions if no active_streams data
    if active_streams == 0:
        active_streams = await db.listening_sessions.count_documents({
            "start_time": {"$gte": five_min_ago}
        })
        
        active_pipeline = [
            {"$match": {"start_time": {"$gte": five_min_ago}}},
            {"$group": {"_id": "$user_id"}},
            {"$count": "count"}
        ]
        active_result = await db.listening_sessions.aggregate(active_pipeline).to_list(1)
        active_listeners = active_result[0]["count"] if active_result else 0
    
    # Plays today (completed plays of 45+ seconds)
    plays_today = await db.listening_sessions.count_documents({
        "counted_as_play": True,
        "start_time": {"$gte": today_start}
    })
    
    # New users today
    new_users_today = await db.app_users.count_documents({
        "created_at": {"$gte": today_start}
    })
    
    # Transactions today
    transactions_today = await db.payments.count_documents({
        "created_at": {"$gte": today_start},
        "status": {"$in": ["completed", "success", "paid"]}
    })
    
    # Hourly plays trend
    hourly_pipeline = [
        {"$match": {"counted_as_play": True, "start_time": {"$gte": one_hour_ago}}},
        {"$addFields": {"minute": {"$substr": ["$start_time", 11, 5]}}},
        {"$group": {"_id": "$minute", "plays": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    hourly_plays = await db.listening_sessions.aggregate(hourly_pipeline).to_list(60)
    
    # Currently playing (from active streams)
    recent_plays = []
    for s in active_streams_data[:10]:
        recent_plays.append({
            "song_title": s.get("song_title"),
            "artist_name": s.get("artist_name"),
            "platform": s.get("platform"),
            "user_id": s.get("user_id", "")[:8] + "..."  # Truncate for privacy
        })
    
    return {
        "timestamp": now.isoformat(),
        "active_streams": active_streams,
        "active_listeners": active_listeners,
        "unique_devices": len(unique_devices),
        "platforms": platforms,
        "plays_today": plays_today,
        "new_users_today": new_users_today,
        "transactions_today": transactions_today,
        "hourly_trend": [{"time": h["_id"], "plays": h["plays"]} for h in hourly_plays],
        "recent_plays": recent_plays
    }


@router.get("/analytics/revenue-breakdown")
async def get_revenue_breakdown(
    period: str = Query("30d", description="Time period")
):
    """Get detailed revenue breakdown by content, plans, etc."""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Revenue by subscription plan
    plan_pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": "$plan_name",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"total": -1}}
    ]
    by_plan = await db.transactions.aggregate(plan_pipeline).to_list(10)
    
    # Revenue by payment method
    method_pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": start_date.isoformat()}}},
        {"$group": {
            "_id": "$payment_method",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    by_method = await db.transactions.aggregate(method_pipeline).to_list(10)
    
    # Daily revenue trend
    daily_revenue_pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": start_date.isoformat()}}},
        {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date", "revenue": {"$sum": "$amount"}, "transactions": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_revenue = await db.transactions.aggregate(daily_revenue_pipeline).to_list(days)
    
    # Total stats
    total_pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": start_date.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    total_result = await db.transactions.aggregate(total_pipeline).to_list(1)
    total_revenue = total_result[0]["total"] if total_result else 0
    total_transactions = total_result[0]["count"] if total_result else 0
    
    # Calculate average transaction value
    avg_transaction = round(total_revenue / total_transactions, 2) if total_transactions > 0 else 0
    
    return {
        "period": period,
        "total_revenue": total_revenue,
        "total_transactions": total_transactions,
        "average_transaction": avg_transaction,
        "by_plan": [{"plan": p["_id"] or "Unknown", "total": p["total"], "count": p["count"]} for p in by_plan],
        "by_method": [{"method": m["_id"] or "Unknown", "total": m["total"], "count": m["count"]} for m in by_method],
        "daily_trend": [{"date": d["_id"], "revenue": d["revenue"], "transactions": d["transactions"]} for d in daily_revenue]
    }


@router.get("/analytics/content-revenue/{content_type}")
async def get_content_revenue_analytics(
    content_type: str,
    period: str = Query("30d")
):
    """Get revenue analytics per content type (songs, albums, teachings)"""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get play counts by content
    if content_type == "songs":
        top_content = await db.songs.find(
            {"status": "active"},
            {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "play_count": 1, "album_id": 1}
        ).sort("play_count", -1).limit(20).to_list(20)
        
    elif content_type == "albums":
        top_content = await db.albums.find(
            {"status": "active"},
            {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "play_count": 1, "total_plays": 1}
        ).sort("total_plays", -1).limit(20).to_list(20)
        
    elif content_type == "teachings":
        top_content = await db.teachings.find(
            {"status": "published"},
            {"_id": 0, "teaching_id": 1, "title": 1, "play_count": 1}
        ).sort("play_count", -1).limit(20).to_list(20)
    else:
        top_content = []
    
    # Calculate estimated revenue per content (based on plays and subscription model)
    # This is a simplified calculation - in reality, you'd track actual revenue attribution
    for item in top_content:
        plays = item.get("play_count") or item.get("total_plays") or 0
        # Estimate: TZS 50 per play (based on subscription revenue / total plays)
        item["estimated_revenue"] = plays * 50
    
    return {
        "content_type": content_type,
        "period": period,
        "top_content": top_content,
        "note": "Revenue is estimated based on play counts"
    }


@router.get("/admin/analytics/navigation")
async def get_navigation_analytics(
    platform: Optional[str] = Query(None),
    days: int = Query(7, ge=1, le=90)
):
    """Get navigation/page analytics - tracks which pages users visit"""
    db = get_db()
    from datetime import timedelta
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    query = {"timestamp": {"$gte": start_date.isoformat()}}
    if platform:
        query["platform"] = platform
    
    # Get page views from navigation_events collection (if exists)
    page_views = await db.navigation_events.find(query, {"_id": 0}).to_list(10000)
    
    if not page_views:
        # Generate sample data if no real data
        sample_pages = ["Home", "Search", "Library", "Album", "Profile", "Bible", "Subscription"]
        import random
        
        page_stats = []
        for page in sample_pages:
            views = random.randint(50, 500)
            page_stats.append({
                "page": page,
                "views": views,
                "unique_users": int(views * 0.7),
                "avg_time_seconds": random.randint(30, 180),
                "bounce_rate": round(random.uniform(0.2, 0.6), 2)
            })
        
        return {
            "period_days": days,
            "total_page_views": sum(p["views"] for p in page_stats),
            "unique_users": int(sum(p["unique_users"] for p in page_stats) * 0.3),
            "pages": sorted(page_stats, key=lambda x: x["views"], reverse=True),
            "platforms": {"app": 60, "web": 40},
            "is_sample_data": True
        }
    
    # Aggregate by page
    page_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$page",
            "views": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"},
            "avg_time": {"$avg": "$time_on_page"}
        }},
        {"$project": {
            "page": "$_id",
            "views": 1,
            "unique_users": {"$size": "$unique_users"},
            "avg_time_seconds": {"$round": ["$avg_time", 0]}
        }},
        {"$sort": {"views": -1}}
    ]
    pages = await db.navigation_events.aggregate(page_pipeline).to_list(50)
    
    # Platform distribution
    platform_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}}
    ]
    platforms = await db.navigation_events.aggregate(platform_pipeline).to_list(10)
    
    total_views = sum(p.get("views", 0) for p in pages)
    unique_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    unique_result = await db.navigation_events.aggregate(unique_pipeline).to_list(1)
    total_unique = unique_result[0]["total"] if unique_result else 0
    
    return {
        "period_days": days,
        "total_page_views": total_views,
        "unique_users": total_unique,
        "pages": pages,
        "platforms": {p["_id"]: p["count"] for p in platforms},
        "is_sample_data": False
    }


@router.get("/admin/analytics/navigation/{page}")
async def get_page_analytics_detail(
    page: str,
    days: int = Query(7)
):
    """Get detailed analytics for a specific page"""
    db = get_db()
    from datetime import timedelta
    
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get events for this page
    events = await db.navigation_events.find({
        "page": page,
        "timestamp": {"$gte": start_date.isoformat()}
    }, {"_id": 0}).to_list(5000)
    
    if not events:
        # Return sample data
        import random
        return {
            "page": page,
            "period_days": days,
            "total_views": random.randint(100, 500),
            "unique_users": random.randint(50, 200),
            "avg_time_seconds": random.randint(30, 180),
            "entry_sources": {"direct": 40, "search": 30, "navigation": 30},
            "exit_rate": round(random.uniform(0.2, 0.5), 2),
            "is_sample_data": True
        }
    
    total_views = len(events)
    unique_users = len(set(e.get("user_id") for e in events if e.get("user_id")))
    avg_time = sum(e.get("time_on_page", 0) for e in events) / total_views if total_views > 0 else 0
    
    # Source analysis
    sources = {}
    for e in events:
        source = e.get("source", "direct")
        sources[source] = sources.get(source, 0) + 1
    
    return {
        "page": page,
        "period_days": days,
        "total_views": total_views,
        "unique_users": unique_users,
        "avg_time_seconds": round(avg_time),
        "entry_sources": sources,
        "is_sample_data": False
    }



@router.post("/demo/generate-listening-data")
async def generate_demo_listening_data():
    """Generate demo listening session data for testing analytics"""
    db = get_db()
    from datetime import timedelta
    import random
    import uuid
    
    # Get existing songs
    songs = await db.songs.find(
        {"audio_url": {"$ne": None}}, 
        {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "album_id": 1}
    ).to_list(100)
    
    if not songs:
        return {"error": "No songs available to generate listening data"}
    
    # Get existing users or create demo users
    users = await db.app_users.find({}, {"_id": 0, "user_id": 1}).to_list(50)
    if not users:
        # Create demo users
        demo_users = []
        for i in range(20):
            user_id = f"demo_user_{uuid.uuid4().hex[:8]}"
            demo_users.append({
                "user_id": user_id,
                "email": f"demo{i}@test.com",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        await db.app_users.insert_many(demo_users)
        users = [{"user_id": u["user_id"]} for u in demo_users]
    
    now = datetime.now(timezone.utc)
    sessions_created = 0
    
    # Generate sessions for the last 30 days
    for day_offset in range(30):
        day = now - timedelta(days=day_offset)
        
        # 10-50 sessions per day
        sessions_per_day = random.randint(10, 50)
        
        for _ in range(sessions_per_day):
            song = random.choice(songs)
            user = random.choice(users)
            
            # Random time during the day
            hour = random.randint(6, 23)
            minute = random.randint(0, 59)
            session_time = day.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # Duration: most plays 30-240 seconds, some shorter
            if random.random() < 0.2:  # 20% short plays (not counted)
                duration = random.randint(10, 44)
                counted = False
            else:  # 80% full plays
                duration = random.randint(45, 300)
                counted = True
            
            session = {
                "session_id": f"demo_sess_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "content_id": song["song_id"],
                "content_type": "song",
                "start_time": session_time.isoformat(),
                "end_time": (session_time + timedelta(seconds=duration)).isoformat(),
                "duration_seconds": duration,
                "counted_as_play": counted,
                "platform": random.choice(["android", "ios", "web"]),
                "monetization_type": random.choice(["standard", "premium"]),
                "created_at": session_time.isoformat()
            }
            
            await db.listening_sessions.insert_one(session)
            sessions_created += 1
    
    return {
        "success": True,
        "message": f"Generated {sessions_created} demo listening sessions",
        "sessions_created": sessions_created,
        "songs_used": len(songs),
        "users_used": len(users)
    }



@router.post("/admin/recalculate-play-counts")
async def recalculate_play_counts():
    """
    Recalculate all play counts from listening_sessions collection.
    This fixes any discrepancies between session counts and stored play_counts.
    """
    db = get_db()
    
    # Get all songs and their play counts from listening_sessions
    # Match both content_id (new format) and song_id (legacy format)
    song_plays_pipeline = [
        {"$match": {
            "counted_as_play": True,
            "$or": [
                {"content_type": "song", "content_id": {"$ne": None}},
                {"song_id": {"$ne": None}}
            ]
        }},
        {"$group": {
            "_id": {"$ifNull": ["$content_id", "$song_id"]}, 
            "total_plays": {"$sum": 1}
        }}
    ]
    song_plays = await db.listening_sessions.aggregate(song_plays_pipeline).to_list(10000)
    
    songs_updated = 0
    for item in song_plays:
        song_id = item["_id"]
        plays = item["total_plays"]
        result = await db.songs.update_one(
            {"song_id": song_id},
            {"$set": {"play_count": plays, "plays": plays}}
        )
        if result.modified_count > 0:
            songs_updated += 1
    
    # Reset songs with no plays
    await db.songs.update_many(
        {"song_id": {"$nin": [s["_id"] for s in song_plays]}},
        {"$set": {"play_count": 0, "plays": 0}}
    )
    
    # Calculate album play counts (sum of all their songs' plays)
    albums = await db.albums.find({}, {"_id": 0, "album_id": 1}).to_list(1000)
    albums_updated = 0
    
    for album in albums:
        album_id = album["album_id"]
        # Get total plays for all songs in this album
        # Match both new format (content_id) and legacy format (song_id)
        album_plays_pipeline = [
            {"$match": {
                "counted_as_play": True,
                "$or": [
                    {"content_type": "song", "content_id": {"$ne": None}},
                    {"song_id": {"$ne": None}}
                ]
            }},
            {"$addFields": {
                "effective_song_id": {"$ifNull": ["$content_id", "$song_id"]}
            }},
            {"$lookup": {
                "from": "songs",
                "localField": "effective_song_id",
                "foreignField": "song_id",
                "as": "song"
            }},
            {"$unwind": "$song"},
            {"$match": {"song.album_id": album_id}},
            {"$count": "total"}
        ]
        result = await db.listening_sessions.aggregate(album_plays_pipeline).to_list(1)
        total_plays = result[0]["total"] if result else 0
        
        update_result = await db.albums.update_one(
            {"album_id": album_id},
            {"$set": {"play_count": total_plays, "total_plays": total_plays}}
        )
        if update_result.modified_count > 0:
            albums_updated += 1
    
    # Also recalculate teaching play counts
    teaching_plays_pipeline = [
        {"$match": {"content_type": "teaching_lesson", "counted_as_play": True}},
        {"$group": {"_id": "$content_id", "total_plays": {"$sum": 1}}}
    ]
    teaching_plays = await db.listening_sessions.aggregate(teaching_plays_pipeline).to_list(10000)
    
    teachings_updated = 0
    for item in teaching_plays:
        lesson_id = item["_id"]
        plays = item["total_plays"]
        await db.teaching_lessons.update_one(
            {"lesson_id": lesson_id},
            {"$set": {"play_count": plays, "plays": plays}}
        )
        
        # Update parent teaching
        lesson = await db.teaching_lessons.find_one({"lesson_id": lesson_id})
        if lesson:
            teaching_id = lesson.get("teaching_id")
            if teaching_id:
                # Sum all lessons for this teaching
                total = sum(
                    p["total_plays"] for p in teaching_plays 
                    if (await db.teaching_lessons.find_one({"lesson_id": p["_id"]})).get("teaching_id") == teaching_id
                )
                await db.teachings.update_one(
                    {"teaching_id": teaching_id},
                    {"$set": {"play_count": total, "total_plays": total}}
                )
                teachings_updated += 1
    
    # Clear caches
    await cache.delete("analytics:*")
    await cache.delete("home:*")
    
    return {
        "success": True,
        "songs_updated": songs_updated,
        "albums_updated": albums_updated,
        "teachings_updated": teachings_updated,
        "total_song_sessions": len(song_plays),
        "total_teaching_sessions": len(teaching_plays)
    }


# ============== REPLAY ANALYTICS ==============

@router.get("/analytics/replay-stats")
async def get_replay_statistics(
    period: str = Query("day", description="Time period: day, week, month")
):
    """
    Get replay statistics:
    - Users who replayed the same song on the same day
    - Total replay minutes
    - Songs with most replays
    """
    db = get_db()
    from datetime import timedelta
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "day":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    else:  # month
        start_date = now - timedelta(days=30)
    
    # Users who replayed same song on same day
    user_replays_pipeline = [
        {"$match": {
            "started_at": {"$gte": start_date.isoformat()},
            "counted_as_play": True
        }},
        {"$addFields": {
            "effective_song_id": {"$ifNull": ["$content_id", "$song_id"]},
            "play_date": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$started_at"}}}}
        }},
        {"$group": {
            "_id": {
                "user_id": "$user_id",
                "song_id": "$effective_song_id",
                "date": "$play_date"
            },
            "play_count": {"$sum": 1},
            "total_duration_seconds": {"$sum": "$duration_seconds"}
        }},
        {"$match": {"play_count": {"$gt": 1}}},  # Only replays (played more than once)
        {"$lookup": {
            "from": "songs",
            "localField": "_id.song_id",
            "foreignField": "song_id",
            "as": "song_info"
        }},
        {"$lookup": {
            "from": "app_users",
            "localField": "_id.user_id",
            "foreignField": "user_id",
            "as": "user_info"
        }},
        {"$unwind": {"path": "$song_info", "preserveNullAndEmptyArrays": True}},
        {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "user_id": "$_id.user_id",
            "user_name": {"$ifNull": ["$user_info.full_name", "$user_info.name", "Unknown User"]},
            "user_email": "$user_info.email",
            "song_id": "$_id.song_id",
            "song_title": {"$ifNull": ["$song_info.title", "Unknown Song"]},
            "artist_name": {"$ifNull": ["$song_info.artist", "Unknown Artist"]},
            "date": "$_id.date",
            "replay_count": "$play_count",
            "total_minutes": {"$round": [{"$divide": ["$total_duration_seconds", 60]}, 2]}
        }},
        {"$sort": {"replay_count": -1}},
        {"$limit": 100}
    ]
    
    user_replays = await db.listening_sessions.aggregate(user_replays_pipeline).to_list(100)
    
    # Songs with most replays (per day/week/month)
    song_replays_pipeline = [
        {"$match": {
            "started_at": {"$gte": start_date.isoformat()},
            "counted_as_play": True
        }},
        {"$addFields": {
            "effective_song_id": {"$ifNull": ["$content_id", "$song_id"]}
        }},
        {"$group": {
            "_id": "$effective_song_id",
            "total_plays": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"},
            "total_duration_seconds": {"$sum": "$duration_seconds"}
        }},
        {"$addFields": {
            "unique_user_count": {"$size": "$unique_users"},
            "replay_ratio": {"$cond": {
                "if": {"$gt": [{"$size": "$unique_users"}, 0]},
                "then": {"$divide": ["$total_plays", {"$size": "$unique_users"}]},
                "else": 0
            }}
        }},
        {"$match": {"replay_ratio": {"$gt": 1}}},  # Songs with average >1 play per user
        {"$lookup": {
            "from": "songs",
            "localField": "_id",
            "foreignField": "song_id",
            "as": "song_info"
        }},
        {"$unwind": {"path": "$song_info", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "song_id": "$_id",
            "song_title": {"$ifNull": ["$song_info.title", "Unknown"]},
            "artist_name": {"$ifNull": ["$song_info.artist", "Unknown"]},
            "album_name": "$song_info.album_name",
            "total_plays": 1,
            "unique_users": "$unique_user_count",
            "replay_ratio": {"$round": ["$replay_ratio", 2]},
            "total_minutes": {"$round": [{"$divide": ["$total_duration_seconds", 60]}, 2]}
        }},
        {"$sort": {"total_plays": -1}},
        {"$limit": 50}
    ]
    
    top_replayed_songs = await db.listening_sessions.aggregate(song_replays_pipeline).to_list(50)
    
    # Summary stats
    total_replay_users = len(set(r.get("user_id") for r in user_replays if r.get("user_id")))
    total_replay_minutes = sum(r.get("total_minutes", 0) for r in user_replays)
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "summary": {
            "users_who_replayed": total_replay_users,
            "total_replay_minutes": round(total_replay_minutes, 2),
            "total_replay_sessions": len(user_replays)
        },
        "user_replays": user_replays,
        "top_replayed_songs": top_replayed_songs
    }


# ============== DEVICE & PLATFORM ANALYTICS ==============

@router.get("/analytics/device-distribution")
async def get_device_distribution():
    """
    Get detailed device and platform distribution:
    - Device manufacturers (Samsung, iPhone, etc.)
    - Platform (Android, iOS, Web)
    - Device models
    - Location distribution
    """
    db = get_db()
    
    cache_key = "analytics:device_distribution"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # Get all app users with device info
    users = await db.app_users.find(
        {},
        {"_id": 0, "user_id": 1, "device_info": 1, "device_type": 1, "platform": 1, 
         "device_model": 1, "device_manufacturer": 1, "os_version": 1,
         "location": 1, "country": 1, "city": 1}
    ).to_list(50000)
    
    # Initialize counters
    platform_stats = {"android": 0, "ios": 0, "web": 0, "unknown": 0}
    manufacturer_stats = {}
    model_stats = {}
    location_stats = {}
    os_version_stats = {}
    
    for user in users:
        # Platform
        platform = (user.get("platform") or user.get("device_type") or "unknown").lower()
        if "android" in platform:
            platform_stats["android"] += 1
        elif "ios" in platform or "iphone" in platform or "ipad" in platform:
            platform_stats["ios"] += 1
        elif "web" in platform:
            platform_stats["web"] += 1
        else:
            platform_stats["unknown"] += 1
        
        # Device manufacturer
        device_info = user.get("device_info", {}) or {}
        manufacturer = (
            user.get("device_manufacturer") or 
            device_info.get("manufacturer") or 
            device_info.get("brand") or 
            "Unknown"
        ).strip().title()
        
        # Normalize common manufacturer names
        if "samsung" in manufacturer.lower():
            manufacturer = "Samsung"
        elif "apple" in manufacturer.lower() or "iphone" in manufacturer.lower():
            manufacturer = "Apple"
        elif "huawei" in manufacturer.lower():
            manufacturer = "Huawei"
        elif "xiaomi" in manufacturer.lower():
            manufacturer = "Xiaomi"
        elif "oppo" in manufacturer.lower():
            manufacturer = "Oppo"
        elif "vivo" in manufacturer.lower():
            manufacturer = "Vivo"
        elif "tecno" in manufacturer.lower():
            manufacturer = "Tecno"
        elif "infinix" in manufacturer.lower():
            manufacturer = "Infinix"
        elif "itel" in manufacturer.lower():
            manufacturer = "Itel"
        
        manufacturer_stats[manufacturer] = manufacturer_stats.get(manufacturer, 0) + 1
        
        # Device model
        model = (
            user.get("device_model") or 
            device_info.get("model") or 
            device_info.get("modelName") or 
            "Unknown"
        ).strip()
        if model and model != "Unknown":
            model_key = f"{manufacturer} {model}"
            model_stats[model_key] = model_stats.get(model_key, 0) + 1
        
        # OS Version
        os_ver = (
            user.get("os_version") or 
            device_info.get("osVersion") or 
            device_info.get("systemVersion") or 
            "Unknown"
        )
        os_version_stats[os_ver] = os_version_stats.get(os_ver, 0) + 1
        
        # Location
        location = user.get("location") or user.get("country") or user.get("city") or "Unknown"
        location_stats[location] = location_stats.get(location, 0) + 1
    
    # Sort and limit results
    top_manufacturers = sorted(manufacturer_stats.items(), key=lambda x: x[1], reverse=True)[:15]
    top_models = sorted(model_stats.items(), key=lambda x: x[1], reverse=True)[:20]
    top_locations = sorted(location_stats.items(), key=lambda x: x[1], reverse=True)[:15]
    top_os_versions = sorted(os_version_stats.items(), key=lambda x: x[1], reverse=True)[:10]
    
    result = {
        "total_users": len(users),
        "platform_distribution": platform_stats,
        "manufacturer_distribution": dict(top_manufacturers),
        "top_device_models": dict(top_models),
        "location_distribution": dict(top_locations),
        "os_version_distribution": dict(top_os_versions),
        "platform_breakdown": {
            "mobile": platform_stats["android"] + platform_stats["ios"],
            "web": platform_stats["web"],
            "unknown": platform_stats["unknown"]
        }
    }
    
    await cache.set(cache_key, result, 300)
    return result


@router.post("/analytics/track-device")
async def track_user_device(data: dict):
    """
    Track user device information from app or web.
    Called when user opens the app or logs in.
    """
    db = get_db()
    
    user_id = data.get("user_id")
    if not user_id:
        return {"success": False, "error": "user_id required"}
    
    # Extract device info
    device_update = {}
    
    if data.get("platform"):
        device_update["platform"] = data["platform"]
    if data.get("device_type"):
        device_update["device_type"] = data["device_type"]
    if data.get("device_manufacturer"):
        device_update["device_manufacturer"] = data["device_manufacturer"]
    if data.get("device_model"):
        device_update["device_model"] = data["device_model"]
    if data.get("os_version"):
        device_update["os_version"] = data["os_version"]
    if data.get("app_version"):
        device_update["app_version"] = data["app_version"]
    if data.get("device_info"):
        device_update["device_info"] = data["device_info"]
    
    # Location info
    if data.get("location"):
        device_update["location"] = data["location"]
    if data.get("country"):
        device_update["country"] = data["country"]
    if data.get("city"):
        device_update["city"] = data["city"]
    
    device_update["last_device_update"] = datetime.now(timezone.utc).isoformat()
    
    if device_update:
        await db.app_users.update_one(
            {"user_id": user_id},
            {"$set": device_update}
        )
    
    return {"success": True, "updated_fields": list(device_update.keys())}


# ============== ERROR REPORTING ==============

@router.post("/errors/report")
async def report_error(data: dict):
    """
    Capture errors from user's app/web automatically.
    Includes device info, user context, and error details.
    """
    db = get_db()
    import uuid
    
    error_report = {
        "error_id": f"err_{uuid.uuid4().hex[:12]}",
        "error_type": data.get("error_type", "runtime_error"),
        "message": data.get("message", ""),
        "stack_trace": data.get("stack_trace", ""),
        "component": data.get("component", ""),
        "screen": data.get("screen", ""),
        "action": data.get("action", ""),
        
        # User info
        "user_id": data.get("user_id"),
        "user_email": data.get("user_email"),
        
        # Device info
        "platform": data.get("platform", "unknown"),
        "device_type": data.get("device_type", "unknown"),
        "device_manufacturer": data.get("device_manufacturer", ""),
        "device_model": data.get("device_model", ""),
        "os_version": data.get("os_version", ""),
        "app_version": data.get("app_version", ""),
        "device_info": data.get("device_info", {}),
        
        # Context
        "url": data.get("url", ""),
        "user_agent": data.get("user_agent", ""),
        "extra_context": data.get("extra_context", {}),
        
        # Metadata
        "severity": data.get("severity", "error"),
        "is_fatal": data.get("is_fatal", False),
        "resolved": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.error_reports.insert_one(error_report)
    error_report.pop("_id", None)
    
    return {"success": True, "error_id": error_report["error_id"]}


@router.get("/admin/error-reports")
async def get_error_reports(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    severity: Optional[str] = None,
    platform: Optional[str] = None,
    resolved: Optional[bool] = None
):
    """Get error reports with filtering"""
    db = get_db()
    
    query = {}
    if severity:
        query["severity"] = severity
    if platform:
        query["platform"] = platform
    if resolved is not None:
        query["resolved"] = resolved
    
    reports = await db.error_reports.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get counts by platform and severity
    platform_counts = {}
    severity_counts = {}
    
    all_reports = await db.error_reports.find({}, {"platform": 1, "severity": 1, "_id": 0}).to_list(10000)
    for r in all_reports:
        p = r.get("platform", "unknown")
        s = r.get("severity", "error")
        platform_counts[p] = platform_counts.get(p, 0) + 1
        severity_counts[s] = severity_counts.get(s, 0) + 1
    
    total = await db.error_reports.count_documents(query)
    
    return {
        "reports": reports,
        "total": total,
        "stats": {
            "by_platform": platform_counts,
            "by_severity": severity_counts
        }
    }


@router.put("/admin/error-reports/{error_id}/resolve")
async def resolve_error_report(error_id: str, data: dict = None):
    """Mark an error report as resolved"""
    db = get_db()
    
    update = {
        "resolved": True,
        "resolved_at": datetime.now(timezone.utc).isoformat()
    }
    if data and data.get("resolution_note"):
        update["resolution_note"] = data["resolution_note"]
    
    result = await db.error_reports.update_one(
        {"error_id": error_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Error report not found")
    
    return {"success": True}


@router.delete("/admin/error-reports/{error_id}")
async def delete_error_report(error_id: str):
    """Delete an error report"""
    db = get_db()
    
    result = await db.error_reports.delete_one({"error_id": error_id})
    
    if result.deleted_count == 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Error report not found")
    
    return {"success": True}


# ============== LOCATION ANALYTICS ==============

# Tanzania cities/regions
TANZANIA_REGIONS = [
    "Dar es Salaam", "Dodoma", "Arusha", "Mwanza", "Mbeya", "Morogoro", 
    "Tanga", "Zanzibar", "Kilimanjaro", "Iringa", "Kagera", "Mara",
    "Kigoma", "Shinyanga", "Tabora", "Rukwa", "Ruvuma", "Singida",
    "Lindi", "Mtwara", "Pwani", "Geita", "Katavi", "Njombe", "Simiyu",
    "Songwe"
]

# Kenya cities/regions
KENYA_REGIONS = [
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", 
    "Malindi", "Kitale", "Garissa", "Nyeri", "Machakos", "Meru",
    "Lamu", "Kilifi", "Naivasha", "Kajiado", "Kiambu", "Muranga"
]

# Country list
SUPPORTED_COUNTRIES = ["Tanzania", "Kenya", "Uganda", "Rwanda", "Burundi", "DRC", "Other"]


@router.post("/analytics/track-location")
async def track_user_location(data: dict):
    """
    Track user's GPS location for analytics.
    Called from mobile app when location permission is granted.
    
    Body:
    - user_id: User ID
    - latitude: GPS latitude
    - longitude: GPS longitude
    - country: Country name (can be resolved from coords)
    - region: Region/State name
    - city: City name
    - accuracy: GPS accuracy in meters
    - platform: 'android' | 'ios' | 'web'
    """
    db = get_db()
    import uuid
    
    user_id = data.get("user_id")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    country = data.get("country", "Unknown")
    region = data.get("region", "")
    city = data.get("city", "")
    
    # Normalize country names
    country_lower = country.lower()
    if "tanzania" in country_lower:
        country = "Tanzania"
    elif "kenya" in country_lower:
        country = "Kenya"
    elif "uganda" in country_lower:
        country = "Uganda"
    elif "rwanda" in country_lower:
        country = "Rwanda"
    
    # Create location record
    location_record = {
        "location_id": f"loc_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "latitude": latitude,
        "longitude": longitude,
        "country": country,
        "region": region,
        "city": city,
        "accuracy": data.get("accuracy"),
        "platform": data.get("platform", "unknown"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_locations.insert_one(location_record)
    
    # Update user profile with latest location
    if user_id:
        await db.app_users.update_one(
            {"user_id": user_id},
            {"$set": {
                "location": {
                    "country": country,
                    "region": region,
                    "city": city,
                    "latitude": latitude,
                    "longitude": longitude,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "country": country,
                "region": region,
                "city": city
            }}
        )
    
    # Clear location analytics cache to reflect new data immediately
    await cache.delete("analytics:location:overview")
    
    return {
        "success": True,
        "location_id": location_record["location_id"],
        "country": country,
        "region": region,
        "city": city
    }


@router.get("/analytics/location/overview")
async def get_location_analytics_overview(refresh: bool = False):
    """Get overview of user locations by country"""
    db = get_db()
    
    cache_key = "analytics:location:overview"
    
    # Allow force refresh
    if not refresh:
        cached = await cache.get(cache_key)
        if cached:
            return cached
    
    # Aggregate users by country
    country_pipeline = [
        {"$match": {"country": {"$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$country",
            "users": {"$sum": 1}
        }},
        {"$sort": {"users": -1}}
    ]
    countries = await db.app_users.aggregate(country_pipeline).to_list(50)
    
    # Total users with location data
    total_with_location = await db.app_users.count_documents({"country": {"$ne": None, "$ne": ""}})
    total_users = await db.app_users.count_documents({})
    
    result = {
        "total_users": total_users,
        "users_with_location": total_with_location,
        "location_coverage": round(total_with_location / total_users * 100, 1) if total_users > 0 else 0,
        "countries": [{"country": c["_id"], "users": c["users"]} for c in countries],
        "available_countries": SUPPORTED_COUNTRIES,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }
    
    # Cache for 60 seconds for near real-time updates
    await cache.set(cache_key, result, 60)
    return result


@router.get("/analytics/location/by-country/{country}")
async def get_location_analytics_by_country(
    country: str,
    period: str = Query("30d", description="Time period: 7d, 30d, 90d")
):
    """
    Get detailed location analytics for a specific country.
    Shows user distribution by region/city.
    """
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Normalize country name
    country_normalized = country.title()
    
    # Get users in this country by region
    region_pipeline = [
        {"$match": {
            "country": {"$regex": f"^{country_normalized}$", "$options": "i"}
        }},
        {"$group": {
            "_id": {"$ifNull": ["$region", "$city"]},
            "users": {"$sum": 1}
        }},
        {"$sort": {"users": -1}},
        {"$limit": 30}
    ]
    regions = await db.app_users.aggregate(region_pipeline).to_list(30)
    
    # Get users by city within this country
    city_pipeline = [
        {"$match": {
            "country": {"$regex": f"^{country_normalized}$", "$options": "i"},
            "city": {"$ne": None, "$ne": ""}
        }},
        {"$group": {
            "_id": "$city",
            "users": {"$sum": 1}
        }},
        {"$sort": {"users": -1}},
        {"$limit": 30}
    ]
    cities = await db.app_users.aggregate(city_pipeline).to_list(30)
    
    # Total users in this country
    total_in_country = await db.app_users.count_documents({
        "country": {"$regex": f"^{country_normalized}$", "$options": "i"}
    })
    
    # New users in this country during period
    new_users = await db.app_users.count_documents({
        "country": {"$regex": f"^{country_normalized}$", "$options": "i"},
        "created_at": {"$gte": start_date.isoformat()}
    })
    
    # Active users (who listened) in this country during period
    active_users_pipeline = [
        {"$match": {
            "start_time": {"$gte": start_date.isoformat()},
            "user_id": {"$ne": None}
        }},
        {"$lookup": {
            "from": "app_users",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "user"
        }},
        {"$unwind": "$user"},
        {"$match": {
            "user.country": {"$regex": f"^{country_normalized}$", "$options": "i"}
        }},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    active_result = await db.listening_sessions.aggregate(active_users_pipeline).to_list(1)
    active_users = active_result[0]["total"] if active_result else 0
    
    # Get expected regions based on country
    expected_regions = []
    if country_normalized.lower() == "tanzania":
        expected_regions = TANZANIA_REGIONS
    elif country_normalized.lower() == "kenya":
        expected_regions = KENYA_REGIONS
    
    return {
        "country": country_normalized,
        "period": period,
        "total_users": total_in_country,
        "new_users_in_period": new_users,
        "active_users_in_period": active_users,
        "regions": [{"region": r["_id"] or "Unknown", "users": r["users"]} for r in regions],
        "cities": [{"city": c["_id"], "users": c["users"]} for c in cities],
        "expected_regions": expected_regions
    }


@router.get("/analytics/location/countries-chart")
async def get_countries_chart_data(
    period: str = Query("30d"),
    limit: int = Query(10, ge=5, le=50)
):
    """Get country distribution data formatted for bar charts"""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90, "all": 365*10}.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # All-time country distribution
    country_pipeline = [
        {"$match": {"country": {"$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$country",
            "total_users": {"$sum": 1}
        }},
        {"$sort": {"total_users": -1}},
        {"$limit": limit}
    ]
    all_time = await db.app_users.aggregate(country_pipeline).to_list(limit)
    
    # New users by country in period
    new_by_country_pipeline = [
        {"$match": {
            "country": {"$ne": None, "$ne": ""},
            "created_at": {"$gte": start_date.isoformat()}
        }},
        {"$group": {
            "_id": "$country",
            "new_users": {"$sum": 1}
        }},
        {"$sort": {"new_users": -1}},
        {"$limit": limit}
    ]
    new_users = await db.app_users.aggregate(new_by_country_pipeline).to_list(limit)
    new_users_map = {n["_id"]: n["new_users"] for n in new_users}
    
    # Format for charts
    chart_data = []
    for item in all_time:
        country = item["_id"]
        chart_data.append({
            "country": country,
            "total_users": item["total_users"],
            "new_users": new_users_map.get(country, 0)
        })
    
    # Total stats
    total_users = sum(c["total_users"] for c in chart_data)
    total_new = sum(c["new_users"] for c in chart_data)
    
    return {
        "period": period,
        "chart_data": chart_data,
        "totals": {
            "total_users": total_users,
            "new_users_in_period": total_new,
            "countries_count": len(chart_data)
        }
    }


@router.get("/analytics/location/cities-chart/{country}")
async def get_cities_chart_data(
    country: str,
    period: str = Query("30d"),
    limit: int = Query(15, ge=5, le=50)
):
    """Get city distribution data for a country formatted for bar charts"""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90, "all": 365*10}.get(period, 30)
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    country_normalized = country.title()
    
    # City distribution
    city_pipeline = [
        {"$match": {
            "country": {"$regex": f"^{country_normalized}$", "$options": "i"},
            "$or": [
                {"city": {"$ne": None, "$ne": ""}},
                {"region": {"$ne": None, "$ne": ""}}
            ]
        }},
        {"$addFields": {
            "location_name": {"$ifNull": ["$city", "$region"]}
        }},
        {"$group": {
            "_id": "$location_name",
            "total_users": {"$sum": 1}
        }},
        {"$sort": {"total_users": -1}},
        {"$limit": limit}
    ]
    cities = await db.app_users.aggregate(city_pipeline).to_list(limit)
    
    # New users by city in period
    new_by_city_pipeline = [
        {"$match": {
            "country": {"$regex": f"^{country_normalized}$", "$options": "i"},
            "$or": [
                {"city": {"$ne": None, "$ne": ""}},
                {"region": {"$ne": None, "$ne": ""}}
            ],
            "created_at": {"$gte": start_date.isoformat()}
        }},
        {"$addFields": {
            "location_name": {"$ifNull": ["$city", "$region"]}
        }},
        {"$group": {
            "_id": "$location_name",
            "new_users": {"$sum": 1}
        }},
        {"$sort": {"new_users": -1}}
    ]
    new_users = await db.app_users.aggregate(new_by_city_pipeline).to_list(100)
    new_users_map = {n["_id"]: n["new_users"] for n in new_users}
    
    # Active users by city in period
    active_by_city_pipeline = [
        {"$match": {
            "start_time": {"$gte": start_date.isoformat()},
            "user_id": {"$ne": None}
        }},
        {"$lookup": {
            "from": "app_users",
            "localField": "user_id",
            "foreignField": "user_id",
            "as": "user"
        }},
        {"$unwind": "$user"},
        {"$match": {
            "user.country": {"$regex": f"^{country_normalized}$", "$options": "i"}
        }},
        {"$addFields": {
            "location_name": {"$ifNull": ["$user.city", "$user.region"]}
        }},
        {"$group": {
            "_id": "$location_name",
            "active_users": {"$addToSet": "$user_id"}
        }},
        {"$project": {
            "active_users": {"$size": "$active_users"}
        }}
    ]
    active_users = await db.listening_sessions.aggregate(active_by_city_pipeline).to_list(100)
    active_users_map = {a["_id"]: a["active_users"] for a in active_users}
    
    # Format for charts
    chart_data = []
    for item in cities:
        city_name = item["_id"]
        if city_name:
            chart_data.append({
                "city": city_name,
                "total_users": item["total_users"],
                "new_users": new_users_map.get(city_name, 0),
                "active_users": active_users_map.get(city_name, 0)
            })
    
    # Total stats for this country
    total_in_country = await db.app_users.count_documents({
        "country": {"$regex": f"^{country_normalized}$", "$options": "i"}
    })
    
    return {
        "country": country_normalized,
        "period": period,
        "chart_data": chart_data,
        "totals": {
            "total_users": total_in_country,
            "cities_count": len(chart_data)
        }
    }


@router.get("/analytics/location/map-data")
async def get_location_map_data():
    """Get location data formatted for map visualization"""
    db = get_db()
    
    # Get users with coordinates
    users_with_coords = await db.app_users.find(
        {
            "location.latitude": {"$ne": None},
            "location.longitude": {"$ne": None}
        },
        {"_id": 0, "location": 1, "country": 1, "city": 1, "region": 1}
    ).limit(1000).to_list(1000)
    
    # Aggregate by location (rounded to reduce points)
    location_clusters = {}
    for user in users_with_coords:
        loc = user.get("location", {})
        lat = loc.get("latitude")
        lon = loc.get("longitude")
        
        if lat and lon:
            # Round to 2 decimal places for clustering
            key = f"{round(lat, 2)},{round(lon, 2)}"
            if key not in location_clusters:
                location_clusters[key] = {
                    "latitude": round(lat, 2),
                    "longitude": round(lon, 2),
                    "city": user.get("city") or loc.get("city") or "",
                    "country": user.get("country") or loc.get("country") or "",
                    "users": 0
                }
            location_clusters[key]["users"] += 1
    
    return {
        "clusters": list(location_clusters.values()),
        "total_points": len(location_clusters)
    }


@router.get("/analytics/location/growth/{country}")
async def get_location_growth_trend(
    country: str,
    period: str = Query("30d")
):
    """Get user growth trend for a specific country"""
    db = get_db()
    from datetime import timedelta
    
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    now = datetime.now(timezone.utc)
    country_normalized = country.title()
    
    # Daily growth
    daily_growth = []
    for i in range(days, 0, -1):
        day = now - timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_start = f"{day_str}T00:00:00"
        day_end = f"{day_str}T23:59:59"
        
        # New users on this day
        new_users = await db.app_users.count_documents({
            "country": {"$regex": f"^{country_normalized}$", "$options": "i"},
            "created_at": {"$gte": day_start, "$lte": day_end}
        })
        
        # Cumulative users up to this day
        cumulative = await db.app_users.count_documents({
            "country": {"$regex": f"^{country_normalized}$", "$options": "i"},
            "created_at": {"$lte": day_end}
        })
        
        daily_growth.append({
            "date": day_str,
            "new_users": new_users,
            "cumulative_users": cumulative
        })
    
    return {
        "country": country_normalized,
        "period": period,
        "daily_growth": daily_growth
    }


@router.get("/analytics/location/realtime-stats")
async def get_realtime_location_stats():
    """
    Get real-time location statistics without caching.
    Use this for live dashboards that need instant updates.
    """
    db = get_db()
    
    # Total users
    total_users = await db.app_users.count_documents({})
    
    # Users with location
    total_with_location = await db.app_users.count_documents({"country": {"$ne": None, "$ne": ""}})
    
    # Country breakdown (real-time)
    country_pipeline = [
        {"$match": {"country": {"$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$country",
            "users": {"$sum": 1}
        }},
        {"$sort": {"users": -1}}
    ]
    countries = await db.app_users.aggregate(country_pipeline).to_list(50)
    
    # Recent location updates (last 24 hours)
    from datetime import timedelta
    yesterday = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    recent_updates = await db.user_locations.count_documents({
        "timestamp": {"$gte": yesterday}
    })
    
    # New users today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    new_today = await db.app_users.count_documents({
        "created_at": {"$gte": today_start}
    })
    
    return {
        "total_users": total_users,
        "users_with_location": total_with_location,
        "location_coverage": round(total_with_location / total_users * 100, 1) if total_users > 0 else 0,
        "countries_count": len(countries),
        "countries": [{"country": c["_id"], "users": c["users"]} for c in countries],
        "recent_location_updates_24h": recent_updates,
        "new_users_today": new_today,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_realtime": True
    }


# ============== DEVICE FINGERPRINTING FOR FRAUD PREVENTION ==============

@router.post("/analytics/register-device")
async def register_device(data: dict, request: Request = None):
    """
    Register device fingerprint for fraud prevention.
    Called on app launch and login.
    
    Body:
    - user_id: Optional user ID
    - device_id: Android ID or unique device identifier
    - device_model: Phone model (e.g., "Samsung Galaxy S21")
    - device_brand: Phone brand (e.g., "Samsung")
    - os_version: OS version (e.g., "Android 12")
    - app_version: App version
    - location: Optional {latitude, longitude, city, country}
    """
    db = get_db()
    
    device_id = data.get("device_id")
    user_id = data.get("user_id")
    
    if not device_id:
        return {"error": "device_id required", "success": False}
    
    # Get IP address
    client_ip = None
    if request:
        client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if not client_ip:
            client_ip = request.client.host if request.client else None
    
    # Build device record
    device_record = {
        "device_id": device_id,
        "device_model": data.get("device_model", "Unknown"),
        "device_brand": data.get("device_brand", "Unknown"),
        "os_version": data.get("os_version", "Unknown"),
        "app_version": data.get("app_version", "Unknown"),
        "platform": data.get("platform", "android"),
        "ip_address": client_ip,
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add location if provided
    location = data.get("location")
    if location:
        device_record["location"] = {
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "city": location.get("city"),
            "country": location.get("country"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    # Add user_id if provided
    if user_id:
        device_record["user_id"] = user_id
        device_record["linked_at"] = datetime.now(timezone.utc).isoformat()
    
    # Check if device exists
    existing = await db.device_fingerprints.find_one({"device_id": device_id})
    
    if existing:
        # Update existing device
        # Track all user_ids that have used this device
        user_ids_on_device = existing.get("all_user_ids", [])
        if user_id and user_id not in user_ids_on_device:
            user_ids_on_device.append(user_id)
        
        device_record["all_user_ids"] = user_ids_on_device
        device_record["first_seen"] = existing.get("first_seen", datetime.now(timezone.utc).isoformat())
        device_record["login_count"] = existing.get("login_count", 0) + 1
        
        await db.device_fingerprints.update_one(
            {"device_id": device_id},
            {"$set": device_record}
        )
        
        # Check for fraud: multiple accounts on same device
        is_suspicious = len(user_ids_on_device) > 2  # More than 2 accounts = suspicious
        
        return {
            "success": True,
            "device_registered": True,
            "is_new_device": False,
            "accounts_on_device": len(user_ids_on_device),
            "is_suspicious": is_suspicious,
            "warning": "Multiple accounts detected on this device" if is_suspicious else None
        }
    else:
        # New device
        device_record["first_seen"] = datetime.now(timezone.utc).isoformat()
        device_record["login_count"] = 1
        device_record["all_user_ids"] = [user_id] if user_id else []
        device_record["created_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.device_fingerprints.insert_one(device_record)
        
        return {
            "success": True,
            "device_registered": True,
            "is_new_device": True,
            "accounts_on_device": 1,
            "is_suspicious": False
        }


@router.get("/analytics/device-fraud-check/{user_id}")
async def check_device_fraud(user_id: str):
    """Check if a user has suspicious device activity"""
    db = get_db()
    
    # Find all devices used by this user
    devices = await db.device_fingerprints.find(
        {"all_user_ids": user_id}
    ).to_list(100)
    
    suspicious_devices = []
    total_accounts_shared = 0
    
    for device in devices:
        all_users = device.get("all_user_ids", [])
        if len(all_users) > 1:
            suspicious_devices.append({
                "device_id": device.get("device_id"),
                "device_model": device.get("device_model"),
                "accounts_count": len(all_users),
                "other_accounts": [u for u in all_users if u != user_id]
            })
            total_accounts_shared += len(all_users) - 1
    
    return {
        "user_id": user_id,
        "devices_used": len(devices),
        "suspicious_devices": len(suspicious_devices),
        "suspicious_device_details": suspicious_devices,
        "total_other_accounts_on_devices": total_accounts_shared,
        "fraud_risk": "high" if total_accounts_shared > 3 else ("medium" if total_accounts_shared > 0 else "low")
    }


# ============== DOWNLOAD TRACKING ==============

@router.post("/analytics/record-download")
async def record_download(data: dict, request: Request = None):
    """
    Record a song/content download.
    
    Body:
    - content_type: "song" | "album" | "teaching"
    - content_id: ID of the content
    - user_id: User who downloaded
    - device_id: Device used for download
    """
    db = get_db()
    
    content_type = data.get("content_type", "song")
    content_id = data.get("content_id")
    user_id = data.get("user_id")
    device_id = data.get("device_id")
    
    if not content_id:
        return {"error": "content_id required", "success": False}
    
    # Get content details
    content_title = "Unknown"
    artist_name = "Unknown"
    
    if content_type == "song":
        song = await db.songs.find_one({"song_id": content_id}, {"_id": 0, "title": 1, "artist_name": 1, "album_id": 1})
        if song:
            content_title = song.get("title", "Unknown")
            artist_name = song.get("artist_name", "Unknown")
    
    # Create download record
    download_record = {
        "download_id": f"dl_{__import__('uuid').uuid4().hex[:12]}",
        "content_type": content_type,
        "content_id": content_id,
        "content_title": content_title,
        "artist_name": artist_name,
        "user_id": user_id,
        "device_id": device_id,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.downloads.insert_one(download_record)
    
    # Update download count on content
    if content_type == "song":
        await db.songs.update_one(
            {"song_id": content_id},
            {"$inc": {"download_count": 1}}
        )
    elif content_type == "album":
        await db.albums.update_one(
            {"album_id": content_id},
            {"$inc": {"download_count": 1}}
        )
    
    # Update user's download count
    if user_id:
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"total_downloads": 1}}
        )
        await db.app_users.update_one(
            {"user_id": user_id},
            {"$inc": {"total_downloads": 1}}
        )
    
    logger.info(f"Download recorded: {content_type}/{content_id} by {user_id or 'anonymous'}")
    
    return {
        "success": True,
        "download_id": download_record["download_id"]
    }


@router.get("/analytics/download-stats")
async def get_download_stats():
    """Get download analytics for admin dashboard"""
    db = get_db()
    
    # Total downloads
    total_downloads = await db.downloads.count_documents({})
    
    # Downloads today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    downloads_today = await db.downloads.count_documents({"downloaded_at": {"$gte": today_start}})
    
    # Downloads this week
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    downloads_week = await db.downloads.count_documents({"downloaded_at": {"$gte": week_ago}})
    
    # Downloads this month
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    downloads_month = await db.downloads.count_documents({"downloaded_at": {"$gte": month_ago}})
    
    # Most downloaded songs (top 10)
    top_songs_pipeline = [
        {"$match": {"content_type": "song"}},
        {"$group": {
            "_id": "$content_id",
            "title": {"$first": "$content_title"},
            "artist": {"$first": "$artist_name"},
            "downloads": {"$sum": 1}
        }},
        {"$sort": {"downloads": -1}},
        {"$limit": 10}
    ]
    top_songs = await db.downloads.aggregate(top_songs_pipeline).to_list(10)
    
    # Downloads by day (last 7 days)
    daily_pipeline = [
        {"$match": {"downloaded_at": {"$gte": week_ago}}},
        {"$addFields": {
            "date": {"$substr": ["$downloaded_at", 0, 10]}
        }},
        {"$group": {
            "_id": "$date",
            "downloads": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_downloads = await db.downloads.aggregate(daily_pipeline).to_list(7)
    
    # Unique users who downloaded
    unique_downloaders = await db.downloads.distinct("user_id", {"user_id": {"$ne": None}})
    
    return {
        "total_downloads": total_downloads,
        "downloads_today": downloads_today,
        "downloads_this_week": downloads_week,
        "downloads_this_month": downloads_month,
        "unique_downloaders": len(unique_downloaders),
        "top_downloaded_songs": [
            {
                "song_id": s["_id"],
                "title": s["title"],
                "artist": s["artist"],
                "downloads": s["downloads"]
            } for s in top_songs
        ],
        "daily_downloads": [{"date": d["_id"], "downloads": d["downloads"]} for d in daily_downloads],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/analytics/user-downloads/{user_id}")
async def get_user_downloads(user_id: str):
    """Get download history for a specific user"""
    db = get_db()
    
    # Get user's downloads
    downloads = await db.downloads.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("downloaded_at", -1).to_list(100)
    
    # Get total count
    total_downloads = await db.downloads.count_documents({"user_id": user_id})
    
    return {
        "user_id": user_id,
        "total_downloads": total_downloads,
        "downloads": downloads
    }


# ============== IMPROVED LIVE LISTENERS TRACKING ==============

@router.post("/analytics/heartbeat")
async def listener_heartbeat(data: dict, request: Request = None):
    """
    Heartbeat endpoint for tracking active listeners.
    Called every 10-15 seconds while user is playing content.
    
    Body:
    - session_id: Active session ID
    - user_id: User ID
    - device_id: Device ID
    - content_type: "song" | "album" | etc
    - content_id: ID of content being played
    - song_title: Title of song
    - artist_name: Artist name
    - position: Current playback position in seconds
    """
    db = get_db()
    
    session_id = data.get("session_id")
    user_id = data.get("user_id")
    device_id = data.get("device_id")
    
    if not session_id:
        session_id = f"live_{__import__('uuid').uuid4().hex[:8]}"
    
    # Get client IP
    client_ip = None
    if request:
        client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if not client_ip:
            client_ip = request.client.host if request.client else None
    
    # Update or create active listener record
    listener_record = {
        "session_id": session_id,
        "user_id": user_id,
        "device_id": device_id,
        "content_type": data.get("content_type", "song"),
        "content_id": data.get("content_id"),
        "song_title": data.get("song_title"),
        "artist_name": data.get("artist_name"),
        "position": data.get("position", 0),
        "ip_address": client_ip,
        "platform": data.get("platform", "app"),
        "last_heartbeat": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.active_listeners.update_one(
        {"session_id": session_id},
        {"$set": listener_record, "$setOnInsert": {"started_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"success": True, "session_id": session_id}


@router.post("/analytics/stop-listening")
async def stop_listening(data: dict):
    """Mark a listening session as ended"""
    db = get_db()
    
    session_id = data.get("session_id")
    if session_id:
        await db.active_listeners.update_one(
            {"session_id": session_id},
            {"$set": {"is_active": False, "ended_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"success": True}


@router.get("/analytics/live-listeners")
async def get_live_listeners():
    """Get current active listeners (real-time)"""
    db = get_db()
    
    # Consider listeners active if heartbeat within last 30 seconds
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=30)).isoformat()
    
    # Get active listeners
    active = await db.active_listeners.find(
        {"last_heartbeat": {"$gte": cutoff}, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    # Count unique users and devices
    unique_users = set()
    unique_devices = set()
    by_content = {}
    
    for listener in active:
        if listener.get("user_id"):
            unique_users.add(listener["user_id"])
        if listener.get("device_id"):
            unique_devices.add(listener["device_id"])
        
        content_id = listener.get("content_id")
        if content_id:
            if content_id not in by_content:
                by_content[content_id] = {
                    "content_id": content_id,
                    "title": listener.get("song_title", "Unknown"),
                    "artist": listener.get("artist_name", "Unknown"),
                    "listeners": 0
                }
            by_content[content_id]["listeners"] += 1
    
    # Sort by listeners
    top_content = sorted(by_content.values(), key=lambda x: x["listeners"], reverse=True)[:10]
    
    return {
        "total_active_listeners": len(active),
        "unique_users": len(unique_users),
        "unique_devices": len(unique_devices),
        "top_playing_now": top_content,
        "listeners": active[:50],  # Return first 50 for display
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


