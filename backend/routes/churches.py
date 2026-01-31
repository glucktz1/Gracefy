"""
Church management routes for Gracefy.
Handles churches, announcements, and church leader accounts.
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
router = APIRouter(prefix="/api", tags=["churches"])


# ============== PUBLIC CHURCH ENDPOINTS ==============

@router.get("/churches")
async def get_churches(
    status: Optional[str] = None,
    denomination: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get list of churches"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = "approved"
    if denomination:
        query["denomination"] = denomination
    
    churches = await db.churches.find(query, {"_id": 0})\
        .sort("followers_count", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.churches.count_documents(query)
    
    return {"churches": churches, "total": total, "skip": skip, "limit": limit}


@router.get("/churches/{church_id}")
async def get_church(church_id: str):
    """Get single church details"""
    db = get_db()
    
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    return church


@router.get("/churches/{church_id}/full")
async def get_church_full(church_id: str):
    """Get full church details with announcements and related data"""
    db = get_db()
    
    # Get church
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    # Get recent announcements
    announcements = await db.church_announcements.find(
        {"church_id": church_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get choirs associated with this church
    choirs = await db.singers.find(
        {"church_id": church_id},
        {"_id": 0, "singer_id": 1, "name": 1, "thumbnail": 1, "followers_count": 1}
    ).to_list(20)
    
    # Get leaders associated with this church
    leaders = await db.religious_leaders.find(
        {"church_id": church_id},
        {"_id": 0, "leader_id": 1, "name": 1, "title": 1, "photo": 1}
    ).to_list(10)
    
    return {
        "church": church,
        "announcements": announcements,
        "choirs": choirs,
        "leaders": leaders
    }


# ============== CHURCH ANNOUNCEMENTS ==============

@router.get("/churches/{church_id}/announcements")
async def get_church_announcements(
    church_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Get announcements for a church"""
    db = get_db()
    
    announcements = await db.church_announcements.find(
        {"church_id": church_id, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.church_announcements.count_documents(
        {"church_id": church_id, "status": "active"}
    )
    
    return {"announcements": announcements, "total": total}


@router.post("/churches/{church_id}/announcements")
async def create_church_announcement(church_id: str, data: dict):
    """Create a new church announcement"""
    db = get_db()
    
    # Verify church exists
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    announcement = {
        "announcement_id": f"ann_{uuid.uuid4().hex[:12]}",
        "church_id": church_id,
        "church_name": church.get("name"),
        "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "title": data.get("title", ""),
        "content": data.get("content"),
        "image_url": data.get("image_url"),
        "announcement_type": data.get("announcement_type", "general"),
        "category": data.get("category", "general"),
        "description": data.get("description"),
        "time": data.get("time"),
        "location": data.get("location"),
        "contact_person": data.get("contact_person"),
        "contact_phone": data.get("contact_phone"),
        "is_recurring": data.get("is_recurring", False),
        "recurrence_pattern": data.get("recurrence_pattern"),
        "status": "active",
        "created_by": data.get("created_by"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": data.get("expires_at")
    }
    
    await db.church_announcements.insert_one(announcement)
    announcement.pop("_id", None)
    
    return announcement


@router.put("/churches/{church_id}/announcements/{announcement_id}")
async def update_church_announcement(church_id: str, announcement_id: str, data: dict):
    """Update a church announcement"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("announcement_id", None)
    data.pop("church_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.church_announcements.update_one(
        {"announcement_id": announcement_id, "church_id": church_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    return {"message": "Announcement updated successfully"}


@router.delete("/churches/{church_id}/announcements/{announcement_id}")
async def delete_church_announcement(church_id: str, announcement_id: str):
    """Delete a church announcement"""
    db = get_db()
    
    result = await db.church_announcements.delete_one(
        {"announcement_id": announcement_id, "church_id": church_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    return {"message": "Announcement deleted successfully"}


# ============== ADMIN CHURCH MANAGEMENT ==============

@router.post("/churches")
async def create_church(data: dict):
    """Create a new church"""
    db = get_db()
    
    church = {
        "church_id": f"ch_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "denomination": data.get("denomination"),
        "location": data.get("location"),
        "address": data.get("address"),
        "city": data.get("city"),
        "country": data.get("country", "Tanzania"),
        "direction": data.get("direction"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "google_maps_url": data.get("google_maps_url"),
        "bio": data.get("bio"),
        "leader_name": data.get("leader_name"),
        "leader_title": data.get("leader_title"),
        "leader_phone": data.get("leader_phone"),
        "leader_email": data.get("leader_email"),
        "leader_photo": data.get("leader_photo"),
        "thumbnail": data.get("thumbnail"),
        "cover_image": data.get("cover_image"),
        "gallery_images": data.get("gallery_images", []),
        "prayer_schedule": data.get("prayer_schedule", []),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "website": data.get("website"),
        "followers_count": 0,
        "submitted_by": data.get("submitted_by"),
        "submitted_by_email": data.get("submitted_by_email"),
        "status": data.get("status", "pending"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.churches.insert_one(church)
    church.pop("_id", None)
    
    return church


@router.put("/churches/{church_id}")
async def update_church(church_id: str, data: dict):
    """Update a church"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("church_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.churches.update_one({"church_id": church_id}, {"$set": data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    
    return {"message": "Church updated successfully"}


@router.delete("/churches/{church_id}")
async def delete_church(church_id: str):
    """Delete a church"""
    db = get_db()
    
    result = await db.churches.delete_one({"church_id": church_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    
    return {"message": "Church deleted successfully"}


@router.post("/churches/{church_id}/approve")
async def approve_church(church_id: str, data: dict = None):
    """Approve a church registration"""
    db = get_db()
    
    church = await db.churches.find_one({"church_id": church_id})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    await db.churches.update_one(
        {"church_id": church_id},
        {"$set": {
            "status": "approved",
            "approved_by": (data or {}).get("approved_by"),
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "admin_notes": (data or {}).get("admin_notes")
        }}
    )
    
    return {"message": "Church approved successfully"}


@router.post("/churches/{church_id}/reject")
async def reject_church(church_id: str, data: dict = None):
    """Reject a church registration"""
    db = get_db()
    
    church = await db.churches.find_one({"church_id": church_id})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    await db.churches.update_one(
        {"church_id": church_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": (data or {}).get("reason", "Registration rejected")
        }}
    )
    
    return {"message": "Church rejected"}


# ============== CHURCH LEADER ACCOUNTS ==============

@router.post("/church-leader/register")
async def register_church_leader(data: dict):
    """Register a new church leader account"""
    db = get_db()
    
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")
    church_id = data.get("church_id")
    
    if not all([email, password, name, church_id]):
        raise HTTPException(status_code=400, detail="All fields required")
    
    # Check if email exists
    existing = await db.church_leader_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get church info
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = {
        "account_id": f"church_acc_{uuid.uuid4().hex[:12]}",
        "church_id": church_id,
        "church_name": church.get("name"),
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "phone": data.get("phone"),
        "role": "leader",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.church_leader_accounts.insert_one(account)
    del account["password_hash"]
    account.pop("_id", None)
    
    return account


@router.post("/church-leader/login")
async def login_church_leader(data: dict):
    """Login church leader"""
    db = get_db()
    
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    account = await db.church_leader_accounts.find_one({"email": email})
    if not account:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if account["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account pending approval")
    
    # Generate token
    token = f"chleader_{uuid.uuid4().hex}"
    await db.church_leader_tokens.insert_one({
        "token": token,
        "account_id": account["account_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    })
    
    del account["password_hash"]
    account.pop("_id", None)
    
    return {"account": account, "token": token}


@router.get("/church-leader/me")
async def get_church_leader_profile(request: Request):
    """Get current church leader profile"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.church_leader_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.church_leader_accounts.find_one(
        {"account_id": token_doc["account_id"]},
        {"_id": 0, "password_hash": 0}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    # Get church details
    church = await db.churches.find_one(
        {"church_id": account["church_id"]},
        {"_id": 0}
    )
    
    return {"account": account, "church": church}


@router.post("/church-leader/logout")
async def logout_church_leader(request: Request):
    """Logout church leader"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        await db.church_leader_tokens.delete_one({"token": token})
    
    return {"message": "Logged out successfully"}


@router.get("/church-leader/my-announcements")
async def get_my_announcements(request: Request):
    """Get announcements for church leader's church"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.church_leader_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.church_leader_accounts.find_one({"account_id": token_doc["account_id"]})
    
    announcements = await db.church_announcements.find(
        {"church_id": account["church_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"announcements": announcements}


@router.post("/church-leader/announcements")
async def create_leader_announcement(request: Request, data: dict):
    """Create announcement as church leader"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.church_leader_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.church_leader_accounts.find_one({"account_id": token_doc["account_id"]})
    
    if not account or account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    
    # Get church name
    church = await db.churches.find_one({"church_id": account["church_id"]}, {"_id": 0})
    
    announcement = {
        "announcement_id": f"ann_{uuid.uuid4().hex[:12]}",
        "church_id": account["church_id"],
        "church_name": church.get("name") if church else None,
        "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "title": data.get("title", ""),
        "content": data.get("content"),
        "image_url": data.get("image_url"),
        "announcement_type": data.get("announcement_type", "general"),
        "category": data.get("category", "general"),
        "status": "active",
        "created_by": account["account_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.church_announcements.insert_one(announcement)
    announcement.pop("_id", None)
    
    return announcement


# ============== ADMIN CHURCH LEADER MANAGEMENT ==============

@router.get("/church-leader/accounts")
async def get_church_leader_accounts():
    """Get all church leader accounts (admin)"""
    db = get_db()
    
    accounts = await db.church_leader_accounts.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).to_list(500)
    
    return {"accounts": accounts}


@router.put("/church-leader/account/{account_id}/approve")
async def approve_church_leader(account_id: str, data: dict = None):
    """Approve church leader account"""
    db = get_db()
    
    result = await db.church_leader_accounts.update_one(
        {"account_id": account_id},
        {"$set": {
            "status": "approved",
            "approved_by": (data or {}).get("approved_by"),
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"message": "Account approved"}


@router.put("/church-leader/account/{account_id}/reject")
async def reject_church_leader(account_id: str, data: dict = None):
    """Reject church leader account"""
    db = get_db()
    
    result = await db.church_leader_accounts.update_one(
        {"account_id": account_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": (data or {}).get("reason")
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return {"message": "Account rejected"}
