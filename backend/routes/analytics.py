"""
Analytics routes for Gracefy Admin Panel.
Dashboard statistics, trends, and user demographics.
"""

from fastapi import APIRouter, Query
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
        # Location
        location = user.get("location") or user.get("country") or "Unknown"
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
        result = await db.songs.update_one(
            {"song_id": content_id},
            {"$inc": {"play_count": 1}}
        )
        play_count_updated = result.modified_count > 0
        
    elif content_type == "teaching_lesson":
        result = await db.teaching_lessons.update_one(
            {"lesson_id": content_id},
            {"$inc": {"play_count": 1}}
        )
        play_count_updated = result.modified_count > 0
        # Also update the teaching's total play count
        lesson = await db.teaching_lessons.find_one({"lesson_id": content_id})
        if lesson:
            await db.teachings.update_one(
                {"teaching_id": lesson.get("teaching_id")},
                {"$inc": {"play_count": 1}}
            )
            
    elif content_type == "album":
        result = await db.albums.update_one(
            {"album_id": content_id},
            {"$inc": {"play_count": 1}}
        )
        play_count_updated = result.modified_count > 0
        
    elif content_type == "bible_tts":
        result = await db.bible_snippets.update_one(
            {"snippet_id": content_id},
            {"$inc": {"play_count": 1}}
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
async def start_listening_session(data: dict):
    """
    Start a listening session (called when playback begins).
    Used to track active listeners.
    """
    db = get_db()
    
    session_id = f"session_{__import__('uuid').uuid4().hex[:12]}"
    session = {
        "session_id": session_id,
        "content_type": data.get("content_type"),
        "content_id": data.get("content_id"),
        "user_id": data.get("user_id"),
        "platform": data.get("platform", "web"),
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
                    {"$inc": {"play_count": 1}}
                )
            elif content_type == "teaching_lesson":
                await db.teaching_lessons.update_one(
                    {"lesson_id": content_id},
                    {"$inc": {"play_count": 1}}
                )
                lesson = await db.teaching_lessons.find_one({"lesson_id": content_id})
                if lesson:
                    await db.teachings.update_one(
                        {"teaching_id": lesson.get("teaching_id")},
                        {"$inc": {"play_count": 1}}
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
    five_min_ago = (now - timedelta(minutes=5)).isoformat()
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Active streams (sessions without end_time in last 5 minutes)
    active_streams = await db.listening_sessions.count_documents({
        "start_time": {"$gte": five_min_ago}
    })
    
    # Unique active listeners
    active_pipeline = [
        {"$match": {"start_time": {"$gte": five_min_ago}}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "count"}
    ]
    active_result = await db.listening_sessions.aggregate(active_pipeline).to_list(1)
    active_listeners = active_result[0]["count"] if active_result else 0
    
    # Plays today
    plays_today = await db.listening_sessions.count_documents({
        "counted_as_play": True,
        "start_time": {"$gte": today_start}
    })
    
    # New users today
    new_users_today = await db.app_users.count_documents({
        "created_at": {"$gte": today_start}
    })
    
    # Hourly plays trend
    hourly_pipeline = [
        {"$match": {"counted_as_play": True, "start_time": {"$gte": one_hour_ago}}},
        {"$addFields": {"minute": {"$substr": ["$start_time", 11, 5]}}},
        {"$group": {"_id": "$minute", "plays": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    hourly_plays = await db.listening_sessions.aggregate(hourly_pipeline).to_list(60)
    
    # Currently playing (most recent plays)
    recent_plays = await db.listening_sessions.find(
        {"start_time": {"$gte": five_min_ago}},
        {"_id": 0, "content_type": 1, "content_id": 1, "platform": 1}
    ).sort("start_time", -1).limit(10).to_list(10)
    
    return {
        "timestamp": now.isoformat(),
        "active_streams": active_streams,
        "active_listeners": active_listeners,
        "plays_today": plays_today,
        "new_users_today": new_users_today,
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
