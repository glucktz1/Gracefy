"""
Analytics routes for Gracefy Admin Panel.
Dashboard statistics, trends, and user demographics.
"""

from fastapi import APIRouter, Query
from datetime import datetime, timezone
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
    """Get user and content trends for charts"""
    # Mock data for charts - in production, aggregate from actual data
    return {
        "user_growth": [
            {"month": "Jan", "users": 120},
            {"month": "Feb", "users": 180},
            {"month": "Mar", "users": 250},
            {"month": "Apr", "users": 320},
            {"month": "May", "users": 400},
            {"month": "Jun", "users": 480}
        ],
        "content_performance": [
            {"category": "Praise", "plays": 4500},
            {"category": "Sermons", "plays": 3200},
            {"category": "Christmas", "plays": 2800},
            {"category": "Lent", "plays": 1500},
            {"category": "Bible Study", "plays": 2100}
        ],
        "donations_trend": [
            {"month": "Jan", "amount": 5000},
            {"month": "Feb", "amount": 7500},
            {"month": "Mar", "amount": 6200},
            {"month": "Apr", "amount": 8800},
            {"month": "May", "amount": 9500},
            {"month": "Jun", "amount": 11000}
        ]
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
