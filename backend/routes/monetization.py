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

# Alias for frontend compatibility
@router.get("/monetization/settings")
async def get_monetization_settings_alias():
    """Alias for get_monetization_settings"""
    return await get_monetization_settings()


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
    """Get billing status for the app - used by mobile and web to check billing mode"""
    db = get_db()
    
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    
    if not settings:
        settings = {}
    
    return {
        "billing_enabled": settings.get("billing_enabled", True),
        "billing_mode": settings.get("billing_mode", "full"),  # full, app_redirect, disabled
        "app_billing_enabled": settings.get("app_billing_enabled", True),
        "web_billing_enabled": settings.get("web_billing_enabled", True),
        "web_redirect_url": settings.get("web_redirect_url", "https://www.gracefy.net"),
        "free_trial_enabled": settings.get("free_trial_enabled", True),
        "free_trial_days": settings.get("free_trial_days", 7),
        "premium_features": settings.get("premium_features", {
            "downloads": True,
            "playlists": True,
            "skip_limit": 3,
            "offline_mode": True,
            "high_quality": True
        })
    }


@router.get("/user/subscription-status")
async def get_user_subscription_status(user_id: str = Query(...)):
    """Get user's subscription status and plan details"""
    db = get_db()
    
    user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription = user.get("subscription", {})
    
    # Check if subscription is active and not expired
    is_active = False
    if subscription.get("status") == "active" and subscription.get("expires_at"):
        expires_at = datetime.fromisoformat(subscription["expires_at"].replace("Z", "+00:00"))
        is_active = expires_at > datetime.now(timezone.utc)
        if not is_active:
            # Update expired subscription
            await db.app_users.update_one(
                {"user_id": user_id},
                {"$set": {"subscription.status": "expired", "is_premium": False}}
            )
    
    # Get billing settings
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    billing_enabled = settings.get("billing_enabled", True) if settings else True
    
    # If billing is disabled, everyone is "premium"
    if not billing_enabled:
        return {
            "has_subscription": True,
            "is_premium": True,
            "subscription": {"status": "free_access", "plan_name": "Bure"},
            "billing_enabled": False,
            "message": "Huduma ni bure kwa sasa"
        }
    
    return {
        "has_subscription": is_active,
        "is_premium": is_active or user.get("is_premium", False),
        "subscription": {
            "status": subscription.get("status", "none"),
            "plan_id": subscription.get("plan_id"),
            "plan_name": subscription.get("plan_name"),
            "started_at": subscription.get("started_at"),
            "expires_at": subscription.get("expires_at"),
        } if subscription else None,
        "billing_enabled": billing_enabled
    }


@router.get("/subscription/current")
async def get_current_subscription(user_id: str = Query(...)):
    """Get user's current subscription details (Vifurushi Vyangu)"""
    return await get_user_subscription_status(user_id)


# ============== TRIAL SETTINGS ==============

@router.get("/monetization/trial-settings")
async def get_trial_settings():
    """Get free trial settings"""
    db = get_db()
    
    settings = await db.monetization_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    
    return {
        "free_trial_enabled": settings.get("free_trial_enabled", True) if settings else True,
        "free_trial_days": settings.get("free_trial_days", 7) if settings else 7
    }


@router.put("/monetization/trial-settings")
async def update_trial_settings(data: dict):
    """Update free trial settings"""
    db = get_db()
    
    await db.monetization_settings.update_one(
        {},
        {"$set": {
            "free_trial_enabled": data.get("free_trial_enabled", True),
            "free_trial_days": data.get("free_trial_days", 7),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Trial settings updated"}


# ============== REVENUE SETTINGS ==============

@router.get("/admin/revenue-settings")
async def get_revenue_settings():
    """Get revenue calculation settings"""
    db = get_db()
    
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    
    # Default settings if none exist
    if not settings:
        settings = {
            "monetization_mode": "time_based",
            "premium_rate_per_hour": 10.0,
            "standard_rate_per_hour": 5.0,
            "platform_share_percentage": 30,
            "choir_share_percentage": 70,
            "minimum_play_seconds": 45,
            "currency": "TZS"
        }
    
    return settings


@router.post("/admin/revenue-settings")
async def save_revenue_settings(data: dict):
    """Save revenue calculation settings"""
    db = get_db()
    
    settings = {
        "monetization_mode": data.get("monetization_mode", "time_based"),
        "premium_rate_per_hour": float(data.get("premium_rate_per_hour", 10.0)),
        "standard_rate_per_hour": float(data.get("standard_rate_per_hour", 5.0)),
        "platform_share_percentage": int(data.get("platform_share_percentage", 30)),
        "choir_share_percentage": int(data.get("choir_share_percentage", 70)),
        "minimum_play_seconds": int(data.get("minimum_play_seconds", 45)),
        "currency": data.get("currency", "TZS"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.revenue_settings.insert_one(settings)
    settings.pop("_id", None)
    
    # Clear cache
    await cache.delete("analytics:*")
    
    return settings


@router.get("/monetization/trial-stats")
async def get_trial_stats():
    """Get trial usage statistics"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    
    # Get users on trial
    active_trials = await db.app_users.count_documents({
        "subscription_type": "trial",
        "trial_ends_at": {"$gt": now.isoformat()}
    })
    
    # Get trial conversions (users who upgraded from trial)
    converted_users = await db.app_users.count_documents({
        "subscription_type": "premium",
        "previous_subscription_type": "trial"
    })
    
    # Get expired trials
    expired_trials = await db.app_users.count_documents({
        "trial_ends_at": {"$lt": now.isoformat()},
        "subscription_type": {"$ne": "premium"}
    })
    
    # Trial starts in last 30 days
    recent_trial_starts = await db.app_users.count_documents({
        "trial_started_at": {"$gte": thirty_days_ago}
    })
    
    return {
        "active_trials": active_trials,
        "converted_users": converted_users,
        "expired_trials": expired_trials,
        "recent_trial_starts": recent_trial_starts,
        "conversion_rate": round((converted_users / max(converted_users + expired_trials, 1)) * 100, 1)
    }


# ============== RATE HISTORY ==============

@router.get("/monetization/rate-history")
async def get_rate_history():
    """Get history of rate changes"""
    db = get_db()
    
    # Get all settings documents (which form the history)
    history = await db.monetization_settings.find(
        {},
        {"_id": 0, "premium_rate_per_hour": 1, "standard_rate_per_hour": 1, 
         "platform_fee_percentage": 1, "created_at": 1, "updated_at": 1}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {"history": history}


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

# Alias for frontend compatibility
@router.get("/monetization/feature-controls")
async def get_monetization_feature_controls():
    """Alias for get_feature_controls"""
    return await get_feature_controls()


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

# Alias for frontend compatibility
@router.put("/monetization/feature-controls")
async def update_monetization_feature_controls(data: dict):
    """Alias for save_feature_controls"""
    return await save_feature_controls(data)


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
    """Get revenue sharing settings including monetization options"""
    db = get_db()
    
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    
    if not settings:
        # Default settings with new monetization options
        settings = {
            # Monetization Options
            "monetization_mode": "time_based",  # "time_based" (Option 1) or "percentage_based" (Option 2)
            "pay_per_content_enabled": False,  # Option 3
            
            # Option 1: Time-Based Earning Settings
            "premium_rate_per_hour": 10,  # TZS per hour for premium subscribers
            "standard_rate_per_hour": 5,  # TZS per hour for standard users
            
            # Option 2: Percentage-Based Earning Settings
            "choir_share_percentage": 70,  # Choir gets 70%
            "platform_share_percentage": 30,  # Platform gets 30%
            
            # Option 3: Pay-Per-Content Settings
            "bundle_platform_fee_percentage": 20,  # Platform keeps 20% of bundle purchases
            
            # General Settings
            "minimum_withdrawal": 10000,
            "currency": "TZS"
        }
    
    return settings


@router.post("/revenue/settings")
async def update_revenue_settings(data: dict):
    """Update revenue sharing settings including monetization options"""
    db = get_db()
    
    # Validate: Option 1 and 2 cannot be enabled together
    monetization_mode = data.get("monetization_mode", "time_based")
    if monetization_mode not in ["time_based", "percentage_based"]:
        monetization_mode = "time_based"
    
    settings = {
        # Monetization Options
        "monetization_mode": monetization_mode,
        "pay_per_content_enabled": data.get("pay_per_content_enabled", False),
        
        # Option 1: Time-Based Earning Settings
        "premium_rate_per_hour": data.get("premium_rate_per_hour", 10),
        "standard_rate_per_hour": data.get("standard_rate_per_hour", 5),
        
        # Option 2: Percentage-Based Earning Settings
        "choir_share_percentage": data.get("choir_share_percentage", 70),
        "platform_share_percentage": data.get("platform_share_percentage", 30),
        
        # Option 3: Pay-Per-Content Settings
        "bundle_platform_fee_percentage": data.get("bundle_platform_fee_percentage", 20),
        
        # General Settings
        "minimum_withdrawal": data.get("minimum_withdrawal", 10000),
        "currency": data.get("currency", "TZS"),
        
        # Metadata
        "effective_from": data.get("effective_from", datetime.now(timezone.utc).isoformat()[:10]),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": data.get("updated_by", "admin")
    }
    
    await db.revenue_settings.insert_one(settings)
    settings.pop("_id", None)
    
    return settings


# ============== CONTENT BUNDLES (Option 3: Pay-Per-Content) ==============

@router.get("/admin/content-bundles")
async def get_content_bundles(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """Get all content bundles"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    bundles = await db.content_bundles.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.content_bundles.count_documents(query)
    
    # Enrich with content details
    for bundle in bundles:
        content_ids = bundle.get("content_ids", [])
        content_type = bundle.get("content_type", "album")
        
        if content_type == "album":
            items = await db.albums.find(
                {"album_id": {"$in": content_ids}},
                {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1}
            ).to_list(len(content_ids))
        else:
            items = await db.songs.find(
                {"song_id": {"$in": content_ids}},
                {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1}
            ).to_list(len(content_ids))
        
        bundle["content_items"] = items
        bundle["content_count"] = len(items)
        
        # Get purchase stats
        purchases = await db.bundle_purchases.count_documents({
            "bundle_id": bundle["bundle_id"],
            "status": "completed"
        })
        bundle["total_purchases"] = purchases
    
    return {"bundles": bundles, "total": total}


@router.post("/admin/content-bundles")
async def create_content_bundle(data: dict):
    """Create a new content bundle for pay-per-content"""
    db = get_db()
    
    bundle_id = f"bundle_{uuid.uuid4().hex[:12]}"
    
    bundle = {
        "bundle_id": bundle_id,
        "name": data.get("name"),
        "description": data.get("description", ""),
        "content_type": data.get("content_type", "album"),  # "album" or "song"
        "content_ids": data.get("content_ids", []),  # List of album_ids or song_ids
        "price": data.get("price", 0),
        "currency": data.get("currency", "TZS"),
        "choir_id": data.get("choir_id"),  # Primary beneficiary
        "thumbnail": data.get("thumbnail"),
        "status": data.get("status", "active"),  # "active", "inactive", "draft"
        "access_duration_days": data.get("access_duration_days"),  # None = lifetime
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_bundles.insert_one(bundle)
    bundle.pop("_id", None)
    
    # Mark content as paid
    if bundle["content_type"] == "album":
        await db.albums.update_many(
            {"album_id": {"$in": bundle["content_ids"]}},
            {"$set": {"is_paid_content": True, "bundle_id": bundle_id}}
        )
    else:
        await db.songs.update_many(
            {"song_id": {"$in": bundle["content_ids"]}},
            {"$set": {"is_paid_content": True, "bundle_id": bundle_id}}
        )
    
    return bundle


@router.put("/admin/content-bundles/{bundle_id}")
async def update_content_bundle(bundle_id: str, data: dict):
    """Update a content bundle"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("bundle_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Get current bundle to handle content changes
    current_bundle = await db.content_bundles.find_one({"bundle_id": bundle_id})
    if not current_bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    # If content_ids changed, update the content items
    if "content_ids" in data:
        old_content_ids = current_bundle.get("content_ids", [])
        new_content_ids = data.get("content_ids", [])
        content_type = data.get("content_type", current_bundle.get("content_type", "album"))
        
        collection = db.albums if content_type == "album" else db.songs
        id_field = "album_id" if content_type == "album" else "song_id"
        
        # Remove paid flag from old content not in new list
        removed_ids = [cid for cid in old_content_ids if cid not in new_content_ids]
        if removed_ids:
            await collection.update_many(
                {id_field: {"$in": removed_ids}},
                {"$unset": {"is_paid_content": "", "bundle_id": ""}}
            )
        
        # Add paid flag to new content
        if new_content_ids:
            await collection.update_many(
                {id_field: {"$in": new_content_ids}},
                {"$set": {"is_paid_content": True, "bundle_id": bundle_id}}
            )
    
    result = await db.content_bundles.update_one(
        {"bundle_id": bundle_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    return {"message": "Bundle updated"}


@router.delete("/admin/content-bundles/{bundle_id}")
async def delete_content_bundle(bundle_id: str):
    """Delete a content bundle"""
    db = get_db()
    
    bundle = await db.content_bundles.find_one({"bundle_id": bundle_id})
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    # Remove paid flag from content
    content_type = bundle.get("content_type", "album")
    content_ids = bundle.get("content_ids", [])
    
    collection = db.albums if content_type == "album" else db.songs
    id_field = "album_id" if content_type == "album" else "song_id"
    
    if content_ids:
        await collection.update_many(
            {id_field: {"$in": content_ids}},
            {"$unset": {"is_paid_content": "", "bundle_id": ""}}
        )
    
    await db.content_bundles.delete_one({"bundle_id": bundle_id})
    
    return {"message": "Bundle deleted"}


@router.get("/content-bundles")
async def get_public_bundles():
    """Get active content bundles for app users"""
    db = get_db()
    
    bundles = await db.content_bundles.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with content preview
    for bundle in bundles:
        content_ids = bundle.get("content_ids", [])[:5]  # First 5 items as preview
        content_type = bundle.get("content_type", "album")
        
        if content_type == "album":
            items = await db.albums.find(
                {"album_id": {"$in": content_ids}},
                {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1}
            ).to_list(5)
        else:
            items = await db.songs.find(
                {"song_id": {"$in": content_ids}},
                {"_id": 0, "song_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1}
            ).to_list(5)
        
        bundle["content_preview"] = items
        bundle["total_content"] = len(bundle.get("content_ids", []))
    
    return {"bundles": bundles}


@router.get("/content-bundles/{bundle_id}")
async def get_bundle_detail(bundle_id: str):
    """Get bundle details"""
    db = get_db()
    
    bundle = await db.content_bundles.find_one(
        {"bundle_id": bundle_id, "status": "active"},
        {"_id": 0}
    )
    
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    # Get all content
    content_ids = bundle.get("content_ids", [])
    content_type = bundle.get("content_type", "album")
    
    if content_type == "album":
        items = await db.albums.find(
            {"album_id": {"$in": content_ids}},
            {"_id": 0}
        ).to_list(len(content_ids))
    else:
        items = await db.songs.find(
            {"song_id": {"$in": content_ids}},
            {"_id": 0}
        ).to_list(len(content_ids))
    
    bundle["content_items"] = items
    
    return bundle


@router.post("/content-bundles/{bundle_id}/purchase")
async def purchase_bundle(bundle_id: str, request: Request, data: dict):
    """Purchase a content bundle"""
    db = get_db()
    
    # Get user
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = token_doc["user_id"]
    
    # Get bundle
    bundle = await db.content_bundles.find_one(
        {"bundle_id": bundle_id, "status": "active"},
        {"_id": 0}
    )
    
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    
    # Check if already purchased
    existing = await db.bundle_purchases.find_one({
        "user_id": user_id,
        "bundle_id": bundle_id,
        "status": "completed"
    })
    
    if existing:
        # Check if access is still valid
        if existing.get("access_expires"):
            if existing["access_expires"] > datetime.now(timezone.utc).isoformat():
                return {"message": "Already purchased", "purchase_id": existing["purchase_id"]}
        else:
            return {"message": "Already purchased", "purchase_id": existing["purchase_id"]}
    
    # Get revenue settings
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    platform_fee_pct = settings.get("bundle_platform_fee_percentage", 20) if settings else 20
    
    # Calculate revenue split
    bundle_price = bundle.get("price", 0)
    platform_revenue = round(bundle_price * (platform_fee_pct / 100), 2)
    choir_revenue = round(bundle_price - platform_revenue, 2)
    
    # Create purchase record
    purchase_id = f"purchase_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    access_expires = None
    if bundle.get("access_duration_days"):
        access_expires = (now + timedelta(days=bundle["access_duration_days"])).isoformat()
    
    purchase = {
        "purchase_id": purchase_id,
        "user_id": user_id,
        "bundle_id": bundle_id,
        "bundle_name": bundle.get("name"),
        "amount": bundle_price,
        "currency": bundle.get("currency", "TZS"),
        "platform_revenue": platform_revenue,
        "choir_revenue": choir_revenue,
        "choir_id": bundle.get("choir_id"),
        "payment_method": data.get("payment_method"),
        "payment_reference": data.get("payment_reference"),
        "status": "completed",  # In production, would be "pending" until payment confirmed
        "access_expires": access_expires,
        "created_at": now.isoformat()
    }
    
    await db.bundle_purchases.insert_one(purchase)
    purchase.pop("_id", None)
    
    # Grant access to user
    await db.app_users.update_one(
        {"user_id": user_id},
        {"$addToSet": {"purchased_bundles": {
            "bundle_id": bundle_id,
            "purchased_at": now.isoformat(),
            "access_expires": access_expires
        }}}
    )
    
    # Credit choir account
    choir_id = bundle.get("choir_id")
    if choir_id and choir_revenue > 0:
        await db.choir_accounts.update_one(
            {"choir_id": choir_id},
            {
                "$inc": {
                    "current_balance": choir_revenue,
                    "total_earned": choir_revenue,
                    "bundle_revenue": choir_revenue
                },
                "$setOnInsert": {
                    "choir_id": choir_id,
                    "created_at": now.isoformat()
                }
            },
            upsert=True
        )
    
    return {
        "message": "Purchase successful",
        "purchase_id": purchase_id,
        "access_expires": access_expires
    }


@router.get("/user/purchased-bundles")
async def get_user_purchased_bundles(request: Request):
    """Get user's purchased bundles"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"bundles": [], "purchased_content_ids": []}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"bundles": [], "purchased_content_ids": []}
    
    user_id = token_doc["user_id"]
    
    # Get purchases
    purchases = await db.bundle_purchases.find(
        {"user_id": user_id, "status": "completed"},
        {"_id": 0}
    ).to_list(100)
    
    # Filter out expired purchases
    now = datetime.now(timezone.utc).isoformat()
    valid_purchases = []
    purchased_content_ids = []
    
    for p in purchases:
        if p.get("access_expires") and p["access_expires"] < now:
            continue  # Skip expired
        valid_purchases.append(p)
        
        # Get bundle to extract content_ids
        bundle = await db.content_bundles.find_one(
            {"bundle_id": p["bundle_id"]},
            {"_id": 0, "content_ids": 1}
        )
        if bundle:
            purchased_content_ids.extend(bundle.get("content_ids", []))
    
    return {
        "bundles": valid_purchases,
        "purchased_content_ids": list(set(purchased_content_ids))
    }


@router.get("/content/{content_type}/{content_id}/access")
async def check_content_access(content_type: str, content_id: str, request: Request):
    """Check if user has access to paid content"""
    db = get_db()
    
    # Check if content is paid
    collection = db.albums if content_type == "album" else db.songs
    id_field = "album_id" if content_type == "album" else "song_id"
    
    content = await collection.find_one({id_field: content_id}, {"_id": 0})
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # If not paid content, access is granted
    if not content.get("is_paid_content"):
        return {"has_access": True, "is_paid_content": False}
    
    # Check user authentication
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {
            "has_access": False,
            "is_paid_content": True,
            "bundle_id": content.get("bundle_id"),
            "message": "Authentication required"
        }
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {
            "has_access": False,
            "is_paid_content": True,
            "bundle_id": content.get("bundle_id"),
            "message": "Invalid token"
        }
    
    user_id = token_doc["user_id"]
    bundle_id = content.get("bundle_id")
    
    # Check if user has purchased the bundle
    purchase = await db.bundle_purchases.find_one({
        "user_id": user_id,
        "bundle_id": bundle_id,
        "status": "completed"
    })
    
    if not purchase:
        # Get bundle info for the error response
        bundle = await db.content_bundles.find_one(
            {"bundle_id": bundle_id},
            {"_id": 0, "name": 1, "price": 1, "currency": 1}
        )
        return {
            "has_access": False,
            "is_paid_content": True,
            "bundle_id": bundle_id,
            "bundle": bundle,
            "message": "Purchase required"
        }
    
    # Check if access has expired
    if purchase.get("access_expires"):
        if purchase["access_expires"] < datetime.now(timezone.utc).isoformat():
            return {
                "has_access": False,
                "is_paid_content": True,
                "bundle_id": bundle_id,
                "message": "Access expired",
                "expired_at": purchase["access_expires"]
            }
    
    return {"has_access": True, "is_paid_content": True, "purchase_id": purchase["purchase_id"]}


# ============== REVENUE CALCULATION (DUAL MODE) ==============

@router.post("/revenue/calculate-choir-earnings")
async def calculate_choir_earnings(data: dict = None):
    """
    Calculate earnings for all choirs based on active monetization mode.
    Can be called manually or scheduled.
    
    Option 1 (Time-Based): choir_earning = listening_hours × rate_per_hour
    Option 2 (Percentage-Based): choir_earning = (choir_minutes/total_minutes) × (total_revenue × choir_share%)
    """
    db = get_db()
    
    period = data.get("period", "30d") if data else "30d"
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get current settings
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {
            "monetization_mode": "time_based",
            "premium_rate_per_hour": 10,
            "standard_rate_per_hour": 5,
            "choir_share_percentage": 70,
            "platform_share_percentage": 30
        }
    
    monetization_mode = settings.get("monetization_mode", "time_based")
    
    # Get all choirs with their content
    choirs = await db.singers.find({}, {"_id": 0, "singer_id": 1, "name": 1}).to_list(500)
    
    results = []
    
    if monetization_mode == "time_based":
        # Option 1: Time-Based Earning
        # choir_earning = listening_hours × rate_per_hour
        
        premium_rate = settings.get("premium_rate_per_hour", 10)
        standard_rate = settings.get("standard_rate_per_hour", 5)
        
        for choir in choirs:
            choir_id = choir["singer_id"]
            
            # Get albums by this choir
            albums = await db.albums.find({"singer_id": choir_id}, {"_id": 0, "album_id": 1}).to_list(100)
            album_ids = [a["album_id"] for a in albums]
            
            if not album_ids:
                continue
            
            # Get songs from these albums
            songs = await db.songs.find({"album_id": {"$in": album_ids}}, {"_id": 0, "song_id": 1}).to_list(500)
            song_ids = [s["song_id"] for s in songs]
            
            if not song_ids:
                continue
            
            # Calculate listening time by subscription type
            listen_pipeline = [
                {"$match": {
                    "song_id": {"$in": song_ids},
                    "counted_as_play": True,
                    "start_time": {"$gte": start_date}
                }},
                {"$group": {
                    "_id": "$subscription_type",
                    "total_seconds": {"$sum": "$duration_seconds"},
                    "play_count": {"$sum": 1}
                }}
            ]
            listen_data = await db.listening_sessions.aggregate(listen_pipeline).to_list(10)
            
            # Calculate earnings
            total_earning = 0
            premium_hours = 0
            standard_hours = 0
            
            for ld in listen_data:
                hours = ld["total_seconds"] / 3600
                if ld["_id"] == "premium":
                    premium_hours = hours
                    total_earning += hours * premium_rate
                else:
                    standard_hours = hours
                    total_earning += hours * standard_rate
            
            results.append({
                "choir_id": choir_id,
                "choir_name": choir["name"],
                "calculation_mode": "time_based",
                "premium_hours": round(premium_hours, 2),
                "standard_hours": round(standard_hours, 2),
                "total_hours": round(premium_hours + standard_hours, 2),
                "total_earning": round(total_earning, 2),
                "play_count": sum(ld["play_count"] for ld in listen_data)
            })
    
    else:
        # Option 2: Percentage-Based Earning
        # choir_earning = (choir_minutes/total_minutes) × (total_revenue × choir_share%)
        
        choir_share_pct = settings.get("choir_share_percentage", 70) / 100
        
        # Get total platform listening minutes
        total_minutes_pipeline = [
            {"$match": {"counted_as_play": True, "start_time": {"$gte": start_date}}},
            {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
        ]
        total_result = await db.listening_sessions.aggregate(total_minutes_pipeline).to_list(1)
        total_platform_minutes = (total_result[0]["total"] / 60) if total_result else 0
        
        # Get total subscription revenue in period
        revenue_pipeline = [
            {"$match": {"status": "completed", "created_at": {"$gte": start_date}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        revenue_result = await db.transactions.aggregate(revenue_pipeline).to_list(1)
        total_subscription_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        # Pool available for choirs
        choir_pool = total_subscription_revenue * choir_share_pct
        
        for choir in choirs:
            choir_id = choir["singer_id"]
            
            # Get albums by this choir
            albums = await db.albums.find({"singer_id": choir_id}, {"_id": 0, "album_id": 1}).to_list(100)
            album_ids = [a["album_id"] for a in albums]
            
            if not album_ids:
                continue
            
            # Get songs from these albums
            songs = await db.songs.find({"album_id": {"$in": album_ids}}, {"_id": 0, "song_id": 1}).to_list(500)
            song_ids = [s["song_id"] for s in songs]
            
            if not song_ids:
                continue
            
            # Get choir's listening minutes
            choir_minutes_pipeline = [
                {"$match": {
                    "song_id": {"$in": song_ids},
                    "counted_as_play": True,
                    "start_time": {"$gte": start_date}
                }},
                {"$group": {
                    "_id": None,
                    "total_seconds": {"$sum": "$duration_seconds"},
                    "play_count": {"$sum": 1}
                }}
            ]
            choir_result = await db.listening_sessions.aggregate(choir_minutes_pipeline).to_list(1)
            
            if not choir_result:
                continue
            
            choir_minutes = choir_result[0]["total_seconds"] / 60
            play_count = choir_result[0]["play_count"]
            
            # Calculate choir's share
            # (choir_minutes / total_platform_minutes) × choir_pool
            if total_platform_minutes > 0:
                choir_share_ratio = choir_minutes / total_platform_minutes
                choir_earning = choir_pool * choir_share_ratio
            else:
                choir_share_ratio = 0
                choir_earning = 0
            
            results.append({
                "choir_id": choir_id,
                "choir_name": choir["name"],
                "calculation_mode": "percentage_based",
                "choir_minutes": round(choir_minutes, 2),
                "total_platform_minutes": round(total_platform_minutes, 2),
                "share_percentage": round(choir_share_ratio * 100, 4),
                "total_subscription_revenue": total_subscription_revenue,
                "choir_pool": round(choir_pool, 2),
                "total_earning": round(choir_earning, 2),
                "play_count": play_count
            })
    
    # Sort by earnings
    results.sort(key=lambda x: x["total_earning"], reverse=True)
    
    return {
        "monetization_mode": monetization_mode,
        "period": period,
        "calculations": results,
        "total_choir_earnings": sum(r["total_earning"] for r in results),
        "settings_used": {
            "mode": monetization_mode,
            "premium_rate_per_hour": settings.get("premium_rate_per_hour") if monetization_mode == "time_based" else None,
            "standard_rate_per_hour": settings.get("standard_rate_per_hour") if monetization_mode == "time_based" else None,
            "choir_share_percentage": settings.get("choir_share_percentage") if monetization_mode == "percentage_based" else None
        }
    }


@router.get("/admin/monetization-summary")
async def get_monetization_summary():
    """Get comprehensive monetization summary for admin dashboard"""
    db = get_db()
    
    # Get current settings
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {
            "monetization_mode": "time_based",
            "pay_per_content_enabled": False,
            "premium_rate_per_hour": 10,
            "standard_rate_per_hour": 5,
            "choir_share_percentage": 70,
            "platform_share_percentage": 30,
            "bundle_platform_fee_percentage": 20
        }
    
    # Calculate 30-day stats
    days_30_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    # Subscription revenue
    sub_revenue_pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": days_30_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    sub_result = await db.transactions.aggregate(sub_revenue_pipeline).to_list(1)
    subscription_revenue = sub_result[0]["total"] if sub_result else 0
    subscription_count = sub_result[0]["count"] if sub_result else 0
    
    # Bundle revenue
    bundle_revenue_pipeline = [
        {"$match": {"status": "completed", "created_at": {"$gte": days_30_ago}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$amount"},
            "platform_revenue": {"$sum": "$platform_revenue"},
            "choir_revenue": {"$sum": "$choir_revenue"},
            "count": {"$sum": 1}
        }}
    ]
    bundle_result = await db.bundle_purchases.aggregate(bundle_revenue_pipeline).to_list(1)
    bundle_revenue = bundle_result[0]["total"] if bundle_result else 0
    bundle_platform_revenue = bundle_result[0]["platform_revenue"] if bundle_result else 0
    bundle_choir_revenue = bundle_result[0]["choir_revenue"] if bundle_result else 0
    bundle_count = bundle_result[0]["count"] if bundle_result else 0
    
    # Active bundles
    active_bundles = await db.content_bundles.count_documents({"status": "active"})
    
    # Total listening hours
    listen_pipeline = [
        {"$match": {"counted_as_play": True, "start_time": {"$gte": days_30_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$duration_seconds"}}}
    ]
    listen_result = await db.listening_sessions.aggregate(listen_pipeline).to_list(1)
    total_listen_hours = round((listen_result[0]["total"] if listen_result else 0) / 3600, 1)
    
    return {
        "settings": settings,
        "period": "30d",
        "subscription_monetization": {
            "mode": settings.get("monetization_mode"),
            "mode_description": "Time-Based (hourly rate)" if settings.get("monetization_mode") == "time_based" else "Percentage-Based (revenue share)",
            "total_revenue": subscription_revenue,
            "transaction_count": subscription_count,
            "total_listen_hours": total_listen_hours
        },
        "bundle_monetization": {
            "enabled": settings.get("pay_per_content_enabled", False),
            "active_bundles": active_bundles,
            "total_revenue": bundle_revenue,
            "platform_revenue": bundle_platform_revenue,
            "choir_revenue": bundle_choir_revenue,
            "purchase_count": bundle_count
        },
        "total_revenue": subscription_revenue + bundle_revenue,
        "rules": {
            "option_1_name": "Time-Based Earning",
            "option_1_description": "Choir earning = listening hours × rate per hour",
            "option_2_name": "Percentage-Based Earning", 
            "option_2_description": "Choir earning = (choir minutes / total platform minutes) × 70% of subscription revenue",
            "option_3_name": "Pay-Per-Content Bundle",
            "option_3_description": "Users pay for specific content bundles, revenue goes directly to content owner minus platform fee",
            "compatibility": "Option 1 and 2 are mutually exclusive. Option 3 can be combined with either."
        }
    }

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
