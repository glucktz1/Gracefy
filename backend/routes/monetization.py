"""
Monetization routes for Gracefy.
Handles subscriptions, plans, billing settings, and revenue tracking.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["monetization"])


# ============== SUBSCRIPTION PLANS ==============

@router.get("/subscription-plans")
async def get_subscription_plans(
    active_only: bool = Query(True)
):
    """Get all subscription plans (returns empty if billing is disabled)"""
    db = get_db()
    
    # Check if billing is enabled
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    billing_enabled = settings.get("billing_enabled", True) if settings else True
    
    # If billing is disabled, return empty plans
    if not billing_enabled:
        return {
            "plans": [],
            "billing_enabled": False,
            "message": "Billing is currently disabled"
        }
    
    query = {}
    if active_only:
        query["is_active"] = True
    
    plans = await db.subscription_plans.find(query, {"_id": 0})\
        .sort("sort_order", 1)\
        .to_list(20)
    
    return {
        "plans": plans,
        "billing_enabled": True
    }


@router.get("/monetization/plans")
async def get_monetization_plans():
    """
    Get subscription plans for mobile app.
    Returns empty plans if billing is disabled.
    """
    db = get_db()
    
    # Check if billing is enabled
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    billing_enabled = settings.get("billing_enabled", True) if settings else True
    
    # If billing is disabled, return empty plans
    if not billing_enabled:
        return {
            "plans": [],
            "billing_enabled": False,
            "message": "Billing is currently disabled"
        }
    
    # Get active plans
    plans = await db.subscription_plans.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(20)
    
    return {
        "plans": plans,
        "billing_enabled": True,
        "free_trial_enabled": settings.get("free_trial_enabled", True) if settings else True,
        "free_trial_days": settings.get("free_trial_days", 7) if settings else 7
    }


@router.get("/subscription-plans/{plan_id}")
async def get_subscription_plan(plan_id: str):
    """Get a single subscription plan"""
    db = get_db()
    
    plan = await db.subscription_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return plan


@router.post("/subscription-plans")
async def create_subscription_plan(data: dict):
    """Create a new subscription plan"""
    db = get_db()
    
    plan = {
        "plan_id": f"plan_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "display_name": data.get("display_name"),
        "description": data.get("description"),
        "price": data.get("price", 0),
        "currency": data.get("currency", "TZS"),
        "duration_days": data.get("duration_days", 30),
        "features": data.get("features", []),
        "is_active": data.get("is_active", True),
        "is_featured": data.get("is_featured", False),
        "sort_order": data.get("sort_order", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.subscription_plans.insert_one(plan)
    plan.pop("_id", None)
    
    return plan


@router.put("/subscription-plans/{plan_id}")
async def update_subscription_plan(plan_id: str, data: dict):
    """Update a subscription plan"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("plan_id", None)
    
    result = await db.subscription_plans.update_one(
        {"plan_id": plan_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {"message": "Plan updated"}


@router.delete("/subscription-plans/{plan_id}")
async def delete_subscription_plan(plan_id: str):
    """Delete a subscription plan"""
    db = get_db()
    
    result = await db.subscription_plans.delete_one({"plan_id": plan_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {"message": "Plan deleted"}


# ============== MONETIZATION SETTINGS ==============

@router.get("/monetization-settings")
async def get_monetization_settings():
    """Get monetization settings"""
    db = get_db()
    
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    if settings:
        settings.pop("_id", None)
    
    # Default settings
    if not settings:
        settings = {
            "billing_enabled": True,
            "free_trial_enabled": True,
            "free_trial_days": 7,
            "minimum_payout_threshold": 10000,
            "platform_commission_percent": 30,
            "revenue_share_percent": 70,
            "supported_currencies": ["TZS", "USD"],
            "default_currency": "TZS"
        }
    
    return settings


@router.post("/monetization-settings")
async def save_monetization_settings(data: dict):
    """Save monetization settings"""
    db = get_db()
    
    settings = {
        "billing_enabled": data.get("billing_enabled", True),
        "free_trial_enabled": data.get("free_trial_enabled", True),
        "free_trial_days": data.get("free_trial_days", 7),
        "minimum_payout_threshold": data.get("minimum_payout_threshold", 10000),
        "platform_commission_percent": data.get("platform_commission_percent", 30),
        "revenue_share_percent": data.get("revenue_share_percent", 70),
        "supported_currencies": data.get("supported_currencies", ["TZS", "USD"]),
        "default_currency": data.get("default_currency", "TZS"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Insert new settings document (keeps history)
    settings["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.monetization_settings.insert_one(settings)
    settings.pop("_id", None)
    
    return settings


@router.get("/billing-status")
async def get_billing_status():
    """Get billing status for the app"""
    db = get_db()
    
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    
    return {
        "billing_enabled": settings.get("billing_enabled", True) if settings else True,
        "free_trial_enabled": settings.get("free_trial_enabled", True) if settings else True,
        "free_trial_days": settings.get("free_trial_days", 7) if settings else 7
    }


# ============== TRANSACTIONS ==============

@router.get("/transactions")
async def get_transactions(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get transactions"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    
    transactions = await db.transactions.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.transactions.count_documents(query)
    
    return {"transactions": transactions, "total": total}


@router.get("/transactions/{transaction_id}")
async def get_transaction(transaction_id: str):
    """Get a single transaction"""
    db = get_db()
    
    transaction = await db.transactions.find_one(
        {"transaction_id": transaction_id},
        {"_id": 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return transaction


# ============== FEATURE CONTROLS ==============

@router.get("/feature-controls")
async def get_feature_controls():
    """Get feature access controls"""
    db = get_db()
    
    controls = await db.feature_controls.find_one({}, {"_id": 0})
    
    if not controls:
        controls = {
            "controls": {
                "free": {
                    "can_play_music": True,
                    "can_download": False,
                    "daily_song_limit_enabled": True,
                    "daily_song_limit": 10,
                    "device_limit_enabled": False,
                    "device_limit": 1,
                    "can_skip_ads": False,
                    "can_listen_bible": True
                },
                "premium": {
                    "can_play_music": True,
                    "can_download": True,
                    "daily_song_limit_enabled": False,
                    "daily_song_limit": None,
                    "device_limit_enabled": True,
                    "device_limit": 5,
                    "can_skip_ads": True,
                    "can_listen_bible": True
                }
            }
        }
    
    return controls


@router.post("/feature-controls")
async def save_feature_controls(data: dict):
    """Save feature controls"""
    db = get_db()
    
    await db.feature_controls.update_one(
        {},
        {"$set": {
            "controls": data.get("controls", {}),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Feature controls saved"}


# ============== USER SUBSCRIPTION ==============

@router.get("/user/subscription")
async def get_user_subscription(request: Request):
    """Get current user's subscription status"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"subscription_type": "free", "is_subscribed": False}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"subscription_type": "free", "is_subscribed": False}
    
    user = await db.app_users.find_one(
        {"user_id": token_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user:
        return {"subscription_type": "free", "is_subscribed": False}
    
    subscription_type = user.get("subscription_type", "free")
    expires = user.get("subscription_expires")
    
    # Check if expired
    is_subscribed = False
    if subscription_type != "free" and expires:
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires)
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        is_subscribed = expires > datetime.now(timezone.utc)
    
    # Check trial
    trial_active = False
    trial = user.get("trial")
    if trial and trial.get("status") == "active":
        trial_expires = trial.get("expires_at")
        if trial_expires:
            if isinstance(trial_expires, str):
                trial_expires = datetime.fromisoformat(trial_expires)
            if trial_expires.tzinfo is None:
                trial_expires = trial_expires.replace(tzinfo=timezone.utc)
            trial_active = trial_expires > datetime.now(timezone.utc)
    
    return {
        "subscription_type": subscription_type,
        "is_subscribed": is_subscribed,
        "subscription_expires": expires.isoformat() if expires else None,
        "trial_active": trial_active,
        "trial": trial
    }


@router.post("/user/upgrade-subscription")
async def upgrade_subscription(request: Request, data: dict):
    """Upgrade user subscription (after payment)"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = token_doc["user_id"]
    plan_id = data.get("plan_id")
    transaction_id = data.get("transaction_id")
    
    # Verify transaction
    transaction = await db.transactions.find_one({
        "transaction_id": transaction_id,
        "user_id": user_id,
        "status": "completed"
    })
    
    if not transaction:
        raise HTTPException(status_code=400, detail="Valid completed transaction required")
    
    # Get plan
    plan = await db.subscription_plans.find_one({"plan_id": plan_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Calculate expiry
    duration_days = plan.get("duration_days", 30)
    expires_at = datetime.now(timezone.utc) + timedelta(days=duration_days)
    
    # Update user
    await db.app_users.update_one(
        {"user_id": user_id},
        {"$set": {
            "subscription_type": "premium",
            "subscription_plan_id": plan_id,
            "subscription_expires": expires_at.isoformat(),
            "subscription_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Subscription upgraded",
        "subscription_type": "premium",
        "expires_at": expires_at.isoformat()
    }


# ============== REVENUE REPORTS ==============

@router.get("/admin/revenue/summary")
async def get_revenue_summary():
    """Get revenue summary for admin"""
    db = get_db()
    
    # Total revenue
    total_pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    total_result = await db.transactions.aggregate(total_pipeline).to_list(1)
    total_revenue = total_result[0]["total"] if total_result else 0
    
    # This month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_pipeline = [
        {"$match": {
            "status": "completed",
            "created_at": {"$gte": month_start.isoformat()}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    month_result = await db.transactions.aggregate(month_pipeline).to_list(1)
    month_revenue = month_result[0]["total"] if month_result else 0
    
    # Active subscribers
    active_subs = await db.app_users.count_documents({
        "subscription_type": "premium",
        "subscription_expires": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    # Total transactions
    total_transactions = await db.transactions.count_documents({"status": "completed"})
    
    return {
        "total_revenue": total_revenue,
        "month_revenue": month_revenue,
        "active_subscribers": active_subs,
        "total_transactions": total_transactions
    }


@router.get("/admin/revenue/by-period")
async def get_revenue_by_period(
    period: str = Query("30d", description="Period: 7d, 30d, 90d, 365d")
):
    """Get revenue grouped by period"""
    db = get_db()
    
    days = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}.get(period, 30)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    pipeline = [
        {"$match": {
            "status": "completed",
            "created_at": {"$gte": start_date}
        }},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "revenue": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(365)
    
    return {
        "period": period,
        "data": [
            {"date": r["_id"], "revenue": r["revenue"], "transactions": r["count"]}
            for r in results
        ]
    }


@router.get("/admin/revenue/by-plan")
async def get_revenue_by_plan():
    """Get revenue grouped by plan"""
    db = get_db()
    
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$plan_id",
            "plan_name": {"$first": "$plan_name"},
            "revenue": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"revenue": -1}}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(20)
    
    return {
        "data": [
            {
                "plan_id": r["_id"],
                "plan_name": r["plan_name"],
                "revenue": r["revenue"],
                "subscribers": r["count"]
            }
            for r in results
        ]
    }


@router.get("/admin/revenue/choir-payouts")
async def get_choir_payouts():
    """Get pending choir payouts"""
    db = get_db()
    
    # Get accounts with balance
    accounts = await db.choir_accounts.find(
        {"current_balance": {"$gt": 0}},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    total_pending = sum(a.get("current_balance", 0) for a in accounts)
    
    return {
        "accounts_with_balance": len(accounts),
        "total_pending_payout": total_pending,
        "accounts": accounts
    }



# ============== FRONTEND-EXPECTED REVENUE ENDPOINTS ==============
# These endpoints match what the RevenueAnalyticsPage.jsx expects

@router.get("/revenue/admin/overview")
async def get_revenue_admin_overview():
    """Get revenue overview for admin dashboard"""
    db = get_db()
    
    # Total revenue
    total_pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    total_result = await db.transactions.aggregate(total_pipeline).to_list(1)
    total_revenue = total_result[0]["total"] if total_result else 0
    total_transactions = total_result[0]["count"] if total_result else 0
    
    # This month revenue
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    month_result = await db.transactions.aggregate(month_pipeline).to_list(1)
    month_revenue = month_result[0]["total"] if month_result else 0
    month_transactions = month_result[0]["count"] if month_result else 0
    
    # Active subscribers
    active_subscribers = await db.app_users.count_documents({
        "subscription_type": "premium",
        "subscription_expires": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    # Total listening hours (from sessions)
    listen_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]
    listen_result = await db.listening_sessions.aggregate(listen_pipeline).to_list(1)
    total_listen_hours = round((listen_result[0]["total"] if listen_result else 0) / 3600, 1)
    
    # Pending choir payouts
    payout_pipeline = [
        {"$match": {"current_balance": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$current_balance"}}}
    ]
    payout_result = await db.choir_accounts.aggregate(payout_pipeline).to_list(1)
    pending_payouts = payout_result[0]["total"] if payout_result else 0
    
    return {
        "total_revenue": total_revenue,
        "total_transactions": total_transactions,
        "month_revenue": month_revenue,
        "month_transactions": month_transactions,
        "active_subscribers": active_subscribers,
        "total_listen_hours": total_listen_hours,
        "pending_payouts": pending_payouts,
        "currency": "TZS"
    }


@router.get("/revenue/admin/daily")
async def get_revenue_daily(days: int = Query(30, ge=1, le=365)):
    """Get daily revenue data for charts"""
    db = get_db()
    
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": start_date}}},
        {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {
            "_id": "$date",
            "revenue": {"$sum": "$amount"},
            "transactions": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(days)
    
    return {
        "daily_data": [
            {"date": r["_id"], "revenue": r["revenue"], "transactions": r["transactions"]}
            for r in results
        ],
        "period_days": days
    }


@router.get("/revenue/admin/choirs")
async def get_choir_revenues():
    """Get choir revenue breakdown"""
    db = get_db()
    
    # Get all choir accounts with their earnings
    accounts = await db.choir_accounts.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).to_list(200)
    
    choir_data = []
    for account in accounts:
        choir = await db.singers.find_one(
            {"singer_id": account.get("choir_id")},
            {"_id": 0, "singer_id": 1, "name": 1, "total_plays": 1, "thumbnail": 1}
        )
        if choir:
            choir_data.append({
                "choir_id": account.get("choir_id"),
                "name": choir.get("name"),
                "thumbnail": choir.get("thumbnail"),
                "total_plays": choir.get("total_plays", 0),
                "total_earned": account.get("total_earned", 0),
                "current_balance": account.get("current_balance", 0),
                "total_withdrawn": account.get("total_withdrawn", 0)
            })
    
    # Sort by total earned
    choir_data.sort(key=lambda x: x.get("total_earned", 0), reverse=True)
    
    return {"choirs": choir_data, "total": len(choir_data)}


@router.get("/revenue/settings")
async def get_revenue_settings():
    """Get revenue sharing settings"""
    db = get_db()
    
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    
    if not settings:
        # Default settings
        settings = {
            "premium_rate_per_hour": 10,  # TZS per hour for premium
            "standard_rate_per_hour": 5,  # TZS per hour for standard
            "platform_share_percentage": 30,
            "minimum_withdrawal": 10000,
            "currency": "TZS"
        }
    
    return settings


@router.post("/revenue/settings")
async def update_revenue_settings(data: dict):
    """Update revenue sharing settings"""
    db = get_db()
    
    settings = {
        "premium_rate_per_hour": data.get("premium_rate_per_hour", 10),
        "standard_rate_per_hour": data.get("standard_rate_per_hour", 5),
        "platform_share_percentage": data.get("platform_share_percentage", 30),
        "minimum_withdrawal": data.get("minimum_withdrawal", 10000),
        "effective_from": data.get("effective_from", datetime.now(timezone.utc).isoformat()[:10]),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": data.get("updated_by", "admin")
    }
    
    await db.revenue_settings.insert_one(settings)
    settings.pop("_id", None)
    
    return settings


@router.post("/demo/generate-listening-data")
async def generate_demo_listening_data():
    """Generate demo listening data for testing analytics"""
    db = get_db()
    import random
    
    # Get some songs
    songs = await db.songs.find({}, {"_id": 0, "song_id": 1}).limit(20).to_list(20)
    
    # Get some users
    users = await db.app_users.find({}, {"_id": 0, "user_id": 1}).limit(50).to_list(50)
    
    if not songs:
        return {"error": "No songs found", "generated": 0}
    
    sessions_created = 0
    for _ in range(100):
        song = random.choice(songs) if songs else None
        user = random.choice(users) if users else None
        
        if song:
            duration = random.randint(30, 300)
            days_ago = random.randint(0, 30)
            session_time = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23))
            
            session = {
                "session_id": f"demo_session_{uuid.uuid4().hex[:12]}",
                "content_type": "song",
                "content_id": song.get("song_id"),
                "user_id": user.get("user_id") if user else None,
                "duration_seconds": duration,
                "platform": random.choice(["app", "web", "ios", "android"]),
                "start_time": session_time.isoformat(),
                "end_time": (session_time + timedelta(seconds=duration)).isoformat(),
                "counted_as_play": duration >= 45
            }
            
            await db.listening_sessions.insert_one(session)
            sessions_created += 1
            
            # Update song play count
            if duration >= 45:
                await db.songs.update_one(
                    {"song_id": song.get("song_id")},
                    {"$inc": {"play_count": 1}}
                )
    
    return {"message": "Demo data generated", "sessions_created": sessions_created}
