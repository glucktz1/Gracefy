"""
Religious Leaders management routes for Gracefy.
Handles leader profiles, content management, portal access, analytics, and revenue.
"""

from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import hashlib
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["leaders"])

# Predefined denominations
DENOMINATIONS = [
    {"id": "catholic", "name": "Catholic", "name_sw": "Katoliki"},
    {"id": "lutheran", "name": "Lutheran", "name_sw": "Kilutheri"},
    {"id": "moravian", "name": "Moravian", "name_sw": "Kimoraviani"},
    {"id": "anglican", "name": "Anglican", "name_sw": "Anglikana"},
    {"id": "pentecostal", "name": "Pentecostal", "name_sw": "Kipentekoste"},
    {"id": "adventist", "name": "Seventh Day Adventist", "name_sw": "Waadventista"},
    {"id": "baptist", "name": "Baptist", "name_sw": "Kibaptisti"},
    {"id": "methodist", "name": "Methodist", "name_sw": "Kimethodisti"},
    {"id": "evangelical", "name": "Evangelical", "name_sw": "Kiinjilisti"},
    {"id": "orthodox", "name": "Orthodox", "name_sw": "Othodoksi"},
    {"id": "other", "name": "Other", "name_sw": "Nyingine"},
]

# ============== DENOMINATION ENDPOINTS ==============

@router.get("/denominations")
async def get_denominations():
    """Get list of denominations"""
    return {"denominations": DENOMINATIONS}


# ============== ADMIN: LEADER MANAGEMENT ==============

@router.get("/admin/leaders")
async def get_leaders(
    denomination: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get list of religious leaders (admin)"""
    db = get_db()
    
    query = {}
    if denomination:
        query["denomination"] = denomination
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"parish_name": {"$regex": search, "$options": "i"}},
            {"diocese": {"$regex": search, "$options": "i"}}
        ]
    
    leaders = await db.religious_leaders.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.religious_leaders.count_documents(query)
    
    return {"leaders": leaders, "total": total, "skip": skip, "limit": limit}


@router.get("/admin/leaders/{leader_id}")
async def get_leader(leader_id: str):
    """Get single leader details + play analytics (admin)."""
    db = get_db()
    from core.play_analytics import get_leader_play_analytics

    leader = await db.religious_leaders.find_one({"leader_id": leader_id}, {"_id": 0})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")

    teachings = await db.teachings.find(
        {"leader_id": leader_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    account = await db.leader_accounts.find_one(
        {"leader_id": leader_id},
        {"_id": 0, "password_hash": 0}
    )

    analytics = await get_leader_play_analytics(leader_id)

    return {
        "leader": leader,
        "teachings": teachings,
        "account": account,
        "analytics": analytics,
    }


@router.get("/admin/leaders/{leader_id}/analytics")
async def get_admin_leader_analytics(leader_id: str):
    """Standalone leader analytics endpoint (admin)."""
    from core.play_analytics import get_leader_play_analytics
    return await get_leader_play_analytics(leader_id)


@router.post("/admin/leaders")
async def create_leader(data: dict):
    """Create a new religious leader"""
    db = get_db()
    
    name = data.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Leader name is required")
    
    leader_id = f"leader_{uuid.uuid4().hex[:12]}"
    
    leader = {
        "leader_id": leader_id,
        "name": data.get("name"),
        "name_sw": data.get("name_sw"),
        "title": data.get("title"),  # e.g., "Father", "Pastor", "Bishop"
        "profile_image": data.get("profile_image"),
        "bio": data.get("bio"),
        "bio_sw": data.get("bio_sw"),
        
        # Church/Religious info
        "denomination": data.get("denomination"),
        "denomination_other": data.get("denomination_other"),  # If "other" selected
        "diocese": data.get("diocese"),
        "parish_name": data.get("parish_name"),
        "parish_location": data.get("parish_location"),
        "region": data.get("region"),
        "country": data.get("country", "Tanzania"),
        
        # Payment settings
        "is_paid": data.get("is_paid", False),
        "payment_method": data.get("payment_method"),  # "bank" or "mobile_money"
        "payment_details": data.get("payment_details", {}),
        # For bank: bank_name, account_name, account_number, branch
        # For mobile_money: provider, phone_number, account_name
        
        # Revenue
        "revenue_share_percentage": data.get("revenue_share_percentage", 60),  # Same as choirs
        "current_balance": 0.0,
        "total_earned": 0.0,
        "total_withdrawn": 0.0,
        
        # Stats
        "followers_count": 0,
        "total_plays": 0,
        "teachings_count": 0,
        
        # Status
        "status": data.get("status", "active"),
        "is_featured": data.get("is_featured", False),
        
        # Timestamps
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.religious_leaders.insert_one(leader)
    leader.pop("_id", None)
    
    return leader


@router.put("/admin/leaders/{leader_id}")
async def update_leader(leader_id: str, data: dict):
    """Update a religious leader"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("leader_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.religious_leaders.update_one(
        {"leader_id": leader_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    # Also update leader_name in teachings if name changed
    if "name" in data:
        await db.teachings.update_many(
            {"leader_id": leader_id},
            {"$set": {"leader_name": data["name"]}}
        )
    
    return {"message": "Leader updated successfully"}


@router.delete("/admin/leaders/{leader_id}")
async def delete_leader(leader_id: str):
    """Delete a religious leader"""
    db = get_db()
    
    result = await db.religious_leaders.delete_one({"leader_id": leader_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    # Also delete associated account
    await db.leader_accounts.delete_many({"leader_id": leader_id})
    await db.leader_tokens.delete_many({"leader_id": leader_id})
    
    return {"message": "Leader deleted successfully"}


# ============== LEADER ACCOUNT MANAGEMENT ==============

@router.post("/leader/account/create")
async def create_leader_account(data: dict):
    """Create a login account for a leader"""
    db = get_db()
    
    leader_id = data.get("leader_id")
    email = data.get("email")
    password = data.get("password")
    
    if not all([leader_id, email, password]):
        raise HTTPException(status_code=400, detail="All fields required")
    
    # Check if account exists
    existing = await db.leader_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get leader info
    leader = await db.religious_leaders.find_one({"leader_id": leader_id}, {"_id": 0})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = {
        "account_id": f"lacc_{uuid.uuid4().hex[:12]}",
        "leader_id": leader_id,
        "leader_name": leader.get("name"),
        "email": email,
        "password_hash": password_hash,
        "denomination": leader.get("denomination"),
        "diocese": leader.get("diocese"),
        "parish_name": leader.get("parish_name"),
        "current_balance": 0.0,
        "total_earned": 0.0,
        "total_withdrawn": 0.0,
        "status": "pending",  # pending, approved, suspended
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leader_accounts.insert_one(account)
    del account["password_hash"]
    account.pop("_id", None)
    
    return account


@router.post("/admin/leader-accounts/{account_id}/approve")
async def approve_leader_account(account_id: str):
    """Approve a leader account"""
    db = get_db()
    
    result = await db.leader_accounts.update_one(
        {"account_id": account_id},
        {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"message": "Account approved"}


@router.get("/admin/leader-accounts")
async def get_leader_accounts(status: Optional[str] = None):
    """Get all leader accounts (admin)"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    accounts = await db.leader_accounts.find(query, {"_id": 0, "password_hash": 0})\
        .sort("created_at", -1).to_list(200)
    
    return {"accounts": accounts}


# ============== LEADER PORTAL: AUTHENTICATION ==============

@router.post("/leader/login")
async def login_leader(data: dict):
    """Login leader account"""
    db = get_db()
    
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    account = await db.leader_accounts.find_one({"email": email})
    if not account:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if account["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    # Generate token
    token = f"leader_{uuid.uuid4().hex}"
    await db.leader_tokens.insert_one({
        "token": token,
        "account_id": account["account_id"],
        "leader_id": account["leader_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    del account["password_hash"]
    account.pop("_id", None)
    
    # Get leader details
    leader = await db.religious_leaders.find_one(
        {"leader_id": account["leader_id"]},
        {"_id": 0}
    )
    
    return {"account": account, "leader": leader, "token": token}


@router.get("/leader/me")
async def get_leader_profile(request: Request):
    """Get current leader account profile"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.leader_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.leader_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    # Get leader details
    leader = await db.religious_leaders.find_one(
        {"leader_id": account["leader_id"]},
        {"_id": 0}
    )
    
    return {"account": account, "leader": leader}


@router.post("/leader/logout")
async def logout_leader(request: Request):
    """Logout leader account"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        await db.leader_tokens.delete_one({"token": token})
    
    return {"message": "Logged out successfully"}


# ============== LEADER PORTAL: CONTENT MANAGEMENT ==============

async def get_leader_from_token(request: Request):
    """Helper to get leader from auth token"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.leader_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return token_doc["leader_id"], token_doc["account_id"]


@router.get("/leader/teachings")
async def get_leader_teachings(request: Request, status: Optional[str] = None):
    """Get leader's own teachings"""
    db = get_db()
    
    leader_id, _ = await get_leader_from_token(request)
    
    query = {"leader_id": leader_id}
    if status:
        query["status"] = status
    
    teachings = await db.teachings.find(query, {"_id": 0})\
        .sort("created_at", -1).to_list(100)
    
    return {"teachings": teachings}


@router.post("/leader/teachings")
async def submit_leader_teaching(request: Request, data: dict):
    """Submit a new teaching for admin approval"""
    db = get_db()
    
    leader_id, account_id = await get_leader_from_token(request)
    
    # Get leader info
    leader = await db.religious_leaders.find_one({"leader_id": leader_id}, {"_id": 0})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    teaching = {
        "teaching_id": f"teach_{uuid.uuid4().hex[:12]}",
        "title": data.get("title"),
        "title_sw": data.get("title_sw"),
        "description": data.get("description"),
        "description_sw": data.get("description_sw"),
        "thumbnail": data.get("thumbnail"),
        "leader_id": leader_id,
        "leader_name": leader.get("name"),
        "category_id": data.get("category_id"),
        "category_name": data.get("category_name"),
        "monetization_type": data.get("monetization_type", "free"),
        "release_date": data.get("release_date"),
        "status": "pending_approval",  # Needs admin approval
        "submitted_by": "leader",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "is_featured": False,
        "view_count": 0,
        "listen_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.teachings.insert_one(teaching)
    teaching.pop("_id", None)
    
    return teaching


@router.get("/leader/teachings/{teaching_id}")
async def get_leader_teaching_detail(request: Request, teaching_id: str):
    """Get detail of a specific teaching (leader portal)"""
    db = get_db()
    
    leader_id, _ = await get_leader_from_token(request)
    
    teaching = await db.teachings.find_one(
        {"teaching_id": teaching_id, "leader_id": leader_id},
        {"_id": 0}
    )
    
    if not teaching:
        raise HTTPException(status_code=404, detail="Teaching not found")
    
    # Get topics and lessons
    topics = await db.teaching_topics.find(
        {"teaching_id": teaching_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    lessons = await db.teaching_lessons.find(
        {"teaching_id": teaching_id},
        {"_id": 0}
    ).sort("order", 1).to_list(500)
    
    return {"teaching": teaching, "topics": topics, "lessons": lessons}


# ============== LEADER PORTAL: ANALYTICS ==============

@router.get("/leader/analytics")
async def get_leader_analytics(request: Request, period: str = "30d"):
    """Get leader's play analytics (self-service).

    Uses the canonical ``core.play_analytics.get_leader_play_analytics`` so
    leader-portal and admin views surface identical numbers. The legacy
    keys (total_teachings, total_plays, current_balance, teaching_breakdown)
    are returned for backward compat with LeaderDashboardPage.
    """
    db = get_db()
    from core.play_analytics import get_leader_play_analytics

    leader_id, _ = await get_leader_from_token(request)

    analytics = await get_leader_play_analytics(leader_id)
    summary = analytics["summary"]

    leader = await db.religious_leaders.find_one(
        {"leader_id": leader_id},
        {"_id": 0, "current_balance": 1, "total_earned": 1, "total_withdrawn": 1}
    ) or {}

    return {
        "period": period,
        "summary": summary,
        "top_teachings": analytics["top_teachings"],
        "top_neno": analytics["top_neno"],
        "monthly": analytics["monthly"],
        # Legacy keys ---------------------------------------------------------
        "total_teachings": summary["teaching_count"],
        "total_plays": summary["total_plays"],
        "total_duration_minutes": summary["total_minutes_streamed"],
        "unique_listeners": summary["follower_count"],
        "current_balance": leader.get("current_balance", 0),
        "total_earned": leader.get("total_earned", 0),
        "total_withdrawn": leader.get("total_withdrawn", 0),
        "teaching_breakdown": [
            {"teaching_id": t["teaching_id"], "title": t["title"],
             "plays": t["plays"], "duration_minutes": 0}
            for t in analytics["top_teachings"]
        ],
    }


@router.get("/leader/revenue")
async def get_leader_revenue(request: Request):
    """Get leader's revenue details"""
    db = get_db()
    
    leader_id, _ = await get_leader_from_token(request)
    
    leader = await db.religious_leaders.find_one(
        {"leader_id": leader_id},
        {"_id": 0, "current_balance": 1, "total_earned": 1, "total_withdrawn": 1, 
         "revenue_share_percentage": 1, "payment_method": 1, "payment_details": 1}
    )
    
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    # Get withdrawal history
    withdrawals = await db.leader_withdrawals.find(
        {"leader_id": leader_id},
        {"_id": 0}
    ).sort("requested_at", -1).limit(20).to_list(20)
    
    return {
        "current_balance": leader.get("current_balance", 0),
        "total_earned": leader.get("total_earned", 0),
        "total_withdrawn": leader.get("total_withdrawn", 0),
        "revenue_share_percentage": leader.get("revenue_share_percentage", 60),
        "payment_method": leader.get("payment_method"),
        "payment_details": leader.get("payment_details", {}),
        "withdrawals": withdrawals
    }


@router.post("/leader/withdraw")
async def request_leader_withdrawal(request: Request, data: dict):
    """Request a withdrawal"""
    db = get_db()
    
    leader_id, account_id = await get_leader_from_token(request)
    
    amount = data.get("amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    # Check balance
    leader = await db.religious_leaders.find_one(
        {"leader_id": leader_id},
        {"_id": 0, "current_balance": 1, "payment_method": 1, "payment_details": 1, "name": 1}
    )
    
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    if leader.get("current_balance", 0) < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if not leader.get("payment_method") or not leader.get("payment_details"):
        raise HTTPException(status_code=400, detail="Payment details not configured")
    
    withdrawal = {
        "withdrawal_id": f"lwd_{uuid.uuid4().hex[:12]}",
        "leader_id": leader_id,
        "leader_name": leader.get("name"),
        "amount": amount,
        "payment_method": leader.get("payment_method"),
        "payment_details": leader.get("payment_details"),
        "status": "pending",  # pending, approved, completed, rejected
        "requested_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leader_withdrawals.insert_one(withdrawal)
    withdrawal.pop("_id", None)
    
    return withdrawal


@router.put("/leader/payment-details")
async def update_leader_payment_details(request: Request, data: dict):
    """Update leader's payment details"""
    db = get_db()
    
    leader_id, _ = await get_leader_from_token(request)
    
    update_data = {
        "payment_method": data.get("payment_method"),
        "payment_details": data.get("payment_details", {}),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.religious_leaders.update_one(
        {"leader_id": leader_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return {"message": "Payment details updated"}


# ============== PUBLIC: LEADER LISTINGS ==============

@router.get("/leaders")
async def get_public_leaders(
    denomination: Optional[str] = None,
    featured: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get public list of religious leaders"""
    db = get_db()
    
    # Include both "active" and "approved" status
    query = {"status": {"$in": ["active", "approved"]}}
    if denomination:
        query["denomination"] = denomination
    if featured is not None:
        query["is_featured"] = featured
    
    leaders = await db.religious_leaders.find(
        query,
        {"_id": 0, "payment_details": 0, "current_balance": 0, "total_earned": 0, "total_withdrawn": 0}
    ).sort("followers_count", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.religious_leaders.count_documents(query)
    
    return {"leaders": leaders, "total": total}


@router.get("/leaders/{leader_id}")
async def get_public_leader(leader_id: str):
    """Get public leader profile"""
    db = get_db()
    
    leader = await db.religious_leaders.find_one(
        {"leader_id": leader_id, "status": "active"},
        {"_id": 0, "payment_details": 0, "current_balance": 0, "total_earned": 0, "total_withdrawn": 0}
    )
    
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    # Get leader's published teachings
    teachings = await db.teachings.find(
        {"leader_id": leader_id, "status": "published"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"leader": leader, "teachings": teachings}


# ============== ADMIN: LEADER CONTENT APPROVAL ==============

@router.get("/admin/pending-teachings")
async def get_pending_teachings():
    """Get teachings pending approval"""
    db = get_db()
    
    teachings = await db.teachings.find(
        {"status": "pending_approval"},
        {"_id": 0}
    ).sort("submitted_at", -1).to_list(100)
    
    return {"teachings": teachings}


@router.post("/admin/teachings/{teaching_id}/approve")
async def approve_teaching(teaching_id: str):
    """Approve a pending teaching"""
    db = get_db()
    
    result = await db.teachings.update_one(
        {"teaching_id": teaching_id, "status": "pending_approval"},
        {"$set": {
            "status": "published",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teaching not found or already processed")
    
    # Update leader's teaching count
    teaching = await db.teachings.find_one({"teaching_id": teaching_id}, {"leader_id": 1})
    if teaching and teaching.get("leader_id"):
        await db.religious_leaders.update_one(
            {"leader_id": teaching["leader_id"]},
            {"$inc": {"teachings_count": 1}}
        )
    
    return {"message": "Teaching approved"}


@router.post("/admin/teachings/{teaching_id}/reject")
async def reject_teaching(teaching_id: str, data: dict):
    """Reject a pending teaching"""
    db = get_db()
    
    result = await db.teachings.update_one(
        {"teaching_id": teaching_id, "status": "pending_approval"},
        {"$set": {
            "status": "rejected",
            "rejection_reason": data.get("reason", ""),
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teaching not found or already processed")
    
    return {"message": "Teaching rejected"}


# ============== ADMIN: LEADER WITHDRAWALS ==============

@router.get("/admin/leader-withdrawals")
async def get_leader_withdrawals(status: Optional[str] = None):
    """Get leader withdrawal requests"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.leader_withdrawals.find(query, {"_id": 0})\
        .sort("requested_at", -1).to_list(100)
    
    return {"withdrawals": withdrawals}


@router.post("/admin/leader-withdrawals/{withdrawal_id}/process")
async def process_leader_withdrawal(withdrawal_id: str, data: dict):
    """Process a leader withdrawal request"""
    db = get_db()
    
    action = data.get("action")  # "approve" or "reject"
    
    withdrawal = await db.leader_withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal already processed")
    
    if action == "approve":
        # Deduct from leader balance
        await db.religious_leaders.update_one(
            {"leader_id": withdrawal["leader_id"]},
            {
                "$inc": {
                    "current_balance": -withdrawal["amount"],
                    "total_withdrawn": withdrawal["amount"]
                }
            }
        )
        
        await db.leader_withdrawals.update_one(
            {"withdrawal_id": withdrawal_id},
            {"$set": {
                "status": "completed",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "transaction_ref": data.get("transaction_ref")
            }}
        )
        
        return {"message": "Withdrawal approved and processed"}
    
    elif action == "reject":
        await db.leader_withdrawals.update_one(
            {"withdrawal_id": withdrawal_id},
            {"$set": {
                "status": "rejected",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": data.get("reason", "")
            }}
        )
        
        return {"message": "Withdrawal rejected"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
