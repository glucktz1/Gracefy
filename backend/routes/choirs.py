"""
Choir management routes for Gracefy.
Handles choir accounts, content management, and revenue.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid
import hashlib
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["choirs"])


# ============== PUBLIC CHOIR ENDPOINTS ==============

@router.get("/choirs")
async def get_choirs(
    denomination: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get list of choirs/artists"""
    db = get_db()
    
    query = {"status": "active"}
    if denomination:
        query["denomination"] = denomination
    
    choirs = await db.singers.find(query, {"_id": 0})\
        .sort("followers_count", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.singers.count_documents(query)
    
    return {"choirs": choirs, "total": total, "skip": skip, "limit": limit}


@router.get("/choirs/{choir_id}")
async def get_choir(choir_id: str):
    """Get single choir details"""
    db = get_db()
    
    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    # Get albums
    albums = await db.albums.find(
        {"artist_id": choir_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"choir": choir, "albums": albums}


@router.get("/choirs/{choir_id}/songs")
async def get_choir_songs(choir_id: str):
    """Get all songs by a choir"""
    db = get_db()
    
    # Get all albums by this choir
    albums = await db.albums.find(
        {"artist_id": choir_id, "status": "active"},
        {"_id": 0, "album_id": 1}
    ).to_list(100)
    
    album_ids = [a["album_id"] for a in albums]
    
    # Get all songs from those albums
    songs = await db.songs.find(
        {"album_id": {"$in": album_ids}, "status": "active"},
        {"_id": 0}
    ).sort("plays", -1).to_list(500)
    
    return {"songs": songs, "total": len(songs)}


# ============== CHOIR ACCOUNT MANAGEMENT ==============

@router.post("/choir/account/create")
async def create_choir_account(data: dict):
    """Create a new choir account"""
    db = get_db()
    
    choir_id = data.get("choir_id")
    email = data.get("email")
    password = data.get("password")
    
    if not all([choir_id, email, password]):
        raise HTTPException(status_code=400, detail="All fields required")
    
    # Check if account exists
    existing = await db.choir_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get choir info
    choir = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not choir:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = {
        "account_id": f"acc_{uuid.uuid4().hex[:12]}",
        "choir_id": choir_id,
        "choir_name": choir.get("name"),
        "email": email,
        "password_hash": password_hash,
        "denomination": choir.get("denomination"),
        "treasurer_name": choir.get("treasurer_name"),
        "treasurer_phone": choir.get("treasurer_phone"),
        "chairman_name": choir.get("chairman_name"),
        "chairman_phone": choir.get("chairman_phone"),
        "parish_priest_name": choir.get("parish_priest_name"),
        "parish_priest_phone": choir.get("parish_priest_phone"),
        "current_balance": 0.0,
        "total_earned": 0.0,
        "total_withdrawn": 0.0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.choir_accounts.insert_one(account)
    del account["password_hash"]
    account.pop("_id", None)
    
    return account


@router.post("/choir/login")
async def login_choir(data: dict):
    """Login choir account"""
    db = get_db()
    
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    account = await db.choir_accounts.find_one({"email": email})
    if not account:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if account["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    # Generate token
    token = f"choir_{uuid.uuid4().hex}"
    await db.choir_tokens.insert_one({
        "token": token,
        "account_id": account["account_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    del account["password_hash"]
    account.pop("_id", None)
    
    return {"account": account, "token": token}


@router.get("/choir/me")
async def get_choir_profile(request: Request):
    """Get current choir account profile"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    # Get choir details
    choir = await db.singers.find_one(
        {"singer_id": account["choir_id"]},
        {"_id": 0}
    )
    
    return {"account": account, "choir": choir}


@router.post("/choir/logout")
async def logout_choir(request: Request):
    """Logout choir account"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        await db.choir_tokens.delete_one({"token": token})
    
    return {"message": "Logged out successfully"}


@router.get("/choir/payment-details")
async def get_choir_payment_details(request: Request):
    """Get choir's payment details"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Verify account exists first
    account_exists = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "account_id": 1, "payment_details": 1, "payment_method": 1}
    )
    
    if not account_exists or not account_exists.get("account_id"):
        raise HTTPException(status_code=401, detail="Account not found")
    
    return {
        "payment_method": account_exists.get("payment_method", "mobile_money"),
        "payment_details": account_exists.get("payment_details", {})
    }


@router.post("/choir/payment-details")
async def update_choir_payment_details(request: Request, data: dict):
    """Update choir's payment details"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    update_data = {
        "payment_method": data.get("payment_method", "mobile_money"),
        "payment_details": {
            "phone": data.get("phone", ""),
            "bank_name": data.get("bank_name", ""),
            "account_number": data.get("account_number", ""),
            "account_name": data.get("account_name", "")
        }
    }
    
    await db.choir_accounts.update_one(
        {"account_id": token_doc["account_id"]},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Payment details updated"}


# ============== CHOIR CONTENT MANAGEMENT ==============

@router.post("/choir/albums/create")
async def create_choir_album(request: Request, data: dict):
    """Create album request from choir portal"""
    db = get_db()
    
    # Get current choir account
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one({"account_id": token_doc["account_id"]})
    if not account or account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    
    # Create content request
    content_request = {
        "request_id": f"content_{uuid.uuid4().hex[:12]}",
        "choir_id": account["choir_id"],
        "choir_name": account["choir_name"],
        "request_type": "album_create",
        "content_data": {
            "title": data.get("title"),
            "description": data.get("description"),
            "thumbnail": data.get("thumbnail"),
            "category_id": data.get("category_id"),
            "monetization_type": data.get("monetization_type", "standard"),
        },
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.choir_content_requests.insert_one(content_request)
    content_request.pop("_id", None)
    
    return content_request


@router.post("/choir/songs/upload")
async def upload_choir_song(request: Request, data: dict):
    """Upload song request from choir portal"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one({"account_id": token_doc["account_id"]})
    if not account or account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    
    content_request = {
        "request_id": f"content_{uuid.uuid4().hex[:12]}",
        "choir_id": account["choir_id"],
        "choir_name": account["choir_name"],
        "request_type": "song_upload",
        "content_data": {
            "album_id": data.get("album_id"),
            "title": data.get("title"),
            "audio_url": data.get("audio_url"),
            "duration": data.get("duration"),
            "duration_formatted": data.get("duration_formatted"),
            "lyrics": data.get("lyrics"),
            "track_number": data.get("track_number"),
        },
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.choir_content_requests.insert_one(content_request)
    content_request.pop("_id", None)
    
    return content_request


@router.get("/choir/my-content-requests")
async def get_my_content_requests(request: Request):
    """Get content requests for current choir"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one({"account_id": token_doc["account_id"]})
    
    requests = await db.choir_content_requests.find(
        {"choir_id": account["choir_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"requests": requests}


@router.get("/choir/my-albums")
async def get_my_albums(request: Request):
    """Get albums for current choir"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one({"account_id": token_doc["account_id"]})
    
    albums = await db.albums.find(
        {"artist_id": account["choir_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"albums": albums}


# ============== CHOIR REVENUE ==============

@router.get("/choir/revenue/{choir_id}")
async def get_choir_revenue(choir_id: str):
    """Get revenue data for a choir"""
    db = get_db()
    
    # Get account
    account = await db.choir_accounts.find_one(
        {"choir_id": choir_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not account:
        return {
            "choir_id": choir_id,
            "current_balance": 0,
            "total_earned": 0,
            "total_withdrawn": 0,
            "monthly_revenue": []
        }
    
    # Get monthly revenue
    monthly = await db.choir_revenue.find(
        {"choir_id": choir_id},
        {"_id": 0}
    ).sort("period", -1).limit(12).to_list(12)
    
    # Get album performance
    albums = await db.album_performance.find(
        {"choir_id": choir_id},
        {"_id": 0}
    ).sort("revenue_generated", -1).limit(10).to_list(10)
    
    return {
        "choir_id": choir_id,
        "current_balance": account.get("current_balance", 0),
        "total_earned": account.get("total_earned", 0),
        "total_withdrawn": account.get("total_withdrawn", 0),
        "monthly_revenue": monthly,
        "top_albums": albums
    }


# ============== WITHDRAWAL REQUESTS ==============

@router.post("/withdrawal/request")
async def create_withdrawal_request(request: Request, data: dict):
    """Create withdrawal request"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one({"account_id": token_doc["account_id"]})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    amount = data.get("amount", 0)
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    if amount > account.get("current_balance", 0):
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Get minimum withdrawal threshold
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    min_threshold = settings.get("minimum_payout_threshold", 10000) if settings else 10000
    
    if amount < min_threshold:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum withdrawal amount is TZS {min_threshold:,.0f}"
        )
    
    withdrawal = {
        "request_id": f"wd_{uuid.uuid4().hex[:12]}",
        "choir_id": account["choir_id"],
        "choir_name": account["choir_name"],
        "amount": amount,
        "payment_method": data.get("payment_method", "mobile_money"),
        "payment_details": account.get("payment_details"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.withdrawal_requests.insert_one(withdrawal)
    withdrawal.pop("_id", None)
    
    return withdrawal


@router.get("/withdrawal/my-requests")
async def get_my_withdrawal_requests(request: Request):
    """Get withdrawal requests for current choir"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one({"account_id": token_doc["account_id"]})
    
    requests = await db.withdrawal_requests.find(
        {"choir_id": account["choir_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"requests": requests}


# ============== CHOIR REGISTRATION (Self-service) ==============

@router.post("/choir/register")
async def register_choir(data: dict):
    """Register a new choir (self-service)"""
    db = get_db()
    
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    
    if not all([name, email, password]):
        raise HTTPException(status_code=400, detail="Name, email and password required")
    
    # Check if email exists
    existing = await db.choir_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered / Barua pepe tayari imesajiliwa")
    
    # Create choir/singer record
    choir = {
        "singer_id": f"sing_{uuid.uuid4().hex[:12]}",
        "name": name,
        "type": data.get("type", "choir"),
        "denomination": data.get("denomination"),
        "church_id": data.get("church_id"),
        "church_name": data.get("church_name"),
        "location": data.get("location"),
        "country": data.get("country", "Tanzania"),
        "email": email,
        "phone": data.get("phone"),
        "bio": data.get("description") or data.get("bio"),
        # Leadership
        "treasurer_name": data.get("treasurer_name"),
        "treasurer_phone": data.get("treasurer_phone"),
        "chairman_name": data.get("chairman_name"),
        "chairman_phone": data.get("chairman_phone"),
        "chairman_email": data.get("chairman_email"),
        "parish_priest_name": data.get("parish_priest_name"),
        "parish_priest_title": data.get("parish_priest_title"),
        "parish_priest_phone": data.get("parish_priest_phone"),
        # Stats
        "followers_count": 0,
        "total_plays": 0,
        "albums_count": 0,
        "songs_count": 0,
        "status": "pending",
        "approval_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.singers.insert_one(choir)
    
    # Create account with payment details
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = {
        "account_id": f"acc_{uuid.uuid4().hex[:12]}",
        "choir_id": choir["singer_id"],
        "choir_name": name,
        "email": email,
        "password_hash": password_hash,
        "denomination": data.get("denomination"),
        # Leadership
        "treasurer_name": data.get("treasurer_name"),
        "treasurer_phone": data.get("treasurer_phone"),
        "chairman_name": data.get("chairman_name"),
        "chairman_phone": data.get("chairman_phone"),
        "chairman_email": data.get("chairman_email"),
        "parish_priest_name": data.get("parish_priest_name"),
        "parish_priest_title": data.get("parish_priest_title"),
        "parish_priest_phone": data.get("parish_priest_phone"),
        # Payment details
        "payment_method": data.get("payment_method", "mobile"),
        "mobile_network": data.get("mobile_network"),
        "mobile_number": data.get("mobile_number"),
        "mobile_registered_name": data.get("mobile_registered_name"),
        "bank_name": data.get("bank_name"),
        "bank_account_number": data.get("bank_account_number"),
        "bank_account_name": data.get("bank_account_name"),
        # Financial
        "current_balance": 0.0,
        "total_earned": 0.0,
        "total_withdrawn": 0.0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.choir_accounts.insert_one(account)
    
    choir.pop("_id", None)
    del account["password_hash"]
    account.pop("_id", None)
    
    return {"choir": choir, "account": account, "message": "Registration submitted for approval"}


# ============== LAYOUT ENDPOINTS ==============

@router.get("/layout/choirs")
async def get_layout_choirs():
    """Get choirs for layout assignment"""
    db = get_db()
    
    choirs = await db.singers.find(
        {"status": "active"},
        {"_id": 0, "singer_id": 1, "name": 1, "thumbnail": 1, "followers_count": 1}
    ).sort("followers_count", -1).limit(100).to_list(100)
    
    return {"choirs": choirs}


# ============== ADMIN CHOIR ACCOUNT ENDPOINTS ==============

@router.get("/choir/accounts")
async def get_all_choir_accounts():
    """Get all choir accounts (admin view)"""
    db = get_db()
    
    accounts = await db.choir_accounts.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    return {"accounts": accounts}


@router.put("/choir/account/{account_id}")
async def update_choir_account(account_id: str, updates: dict):
    """Update choir account status (admin)"""
    db = get_db()
    
    updates.pop("_id", None)
    updates.pop("account_id", None)
    updates.pop("password_hash", None)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.choir_accounts.update_one(
        {"account_id": account_id},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"message": "Account updated"}


@router.delete("/choir/account/{account_id}")
async def delete_choir_account(account_id: str):
    """Delete a choir account (admin)"""
    db = get_db()
    
    result = await db.choir_accounts.delete_one({"account_id": account_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"message": "Account deleted"}



# ============== CHOIR NOTIFICATIONS (CHOIR SIDE) ==============

@router.get("/choir/notifications")
async def get_choir_notifications(request: Request):
    """Get notifications for the logged-in choir"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "choir_id": 1}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    notifications = await db.choir_notifications.find(
        {"choir_id": account["choir_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    unread_count = sum(1 for n in notifications if not n.get("is_read"))
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.put("/choir/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "choir_id": 1}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    result = await db.choir_notifications.update_one(
        {"notification_id": notification_id, "choir_id": account["choir_id"]},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}


@router.post("/choir/notifications/{notification_id}/reply")
async def reply_to_notification(notification_id: str, request: Request, data: dict):
    """Choir replies to an admin notification"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "choir_id": 1, "choir_name": 1}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    message = data.get("message", "")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    response = {
        "response_id": f"resp_{uuid.uuid4().hex[:8]}",
        "message": message,
        "from": "choir",
        "from_name": account.get("choir_name", "Choir"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.choir_notifications.update_one(
        {"notification_id": notification_id, "choir_id": account["choir_id"]},
        {
            "$push": {"responses": response},
            "$set": {"has_choir_response": True}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "response": response}


# ============== CHOIR PROFILE & INFO ==============

@router.get("/choir/full-profile")
async def get_choir_full_profile(request: Request):
    """Get comprehensive choir profile including leaders and payment details"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    # Get choir/singer details
    choir = await db.singers.find_one(
        {"singer_id": account["choir_id"]},
        {"_id": 0}
    )
    
    # Get church details if linked
    church = None
    if choir and choir.get("church_id"):
        church = await db.churches.find_one(
            {"church_id": choir["church_id"]},
            {"_id": 0, "name": 1, "address": 1, "parish": 1, "diocese": 1, "denomination": 1}
        )
    
    # Get choir leaders
    leaders = await db.choir_leaders.find(
        {"choir_id": account["choir_id"]},
        {"_id": 0}
    ).to_list(10)
    
    return {
        "account": account,
        "choir": choir,
        "church": church,
        "leaders": leaders,
        "payment_info": {
            "method": account.get("payment_method", "mobile_money"),
            "details": account.get("payment_details", {})
        }
    }


@router.post("/choir/leaders")
async def add_choir_leader(request: Request, data: dict):
    """Add a leader to the choir"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "choir_id": 1}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    leader = {
        "leader_id": f"leader_{uuid.uuid4().hex[:8]}",
        "choir_id": account["choir_id"],
        "name": data.get("name"),
        "role": data.get("role", "Leader"),  # Chairperson, Secretary, Treasurer, etc.
        "phone": data.get("phone"),
        "email": data.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.choir_leaders.insert_one(leader)
    leader.pop("_id", None)
    
    return {"success": True, "leader": leader}


@router.delete("/choir/leaders/{leader_id}")
async def remove_choir_leader(leader_id: str, request: Request):
    """Remove a leader from the choir"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "choir_id": 1}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    result = await db.choir_leaders.delete_one({
        "leader_id": leader_id,
        "choir_id": account["choir_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return {"success": True}

