"""
Neno la Leo (Word of the Day) Routes
Handles religious leaders management and daily word content
"""

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid
import hashlib
import os
import httpx

router = APIRouter(prefix="/api/neno-la-leo", tags=["Neno la Leo"])

from core.database import get_db

# ==================== MODELS ====================

class ReligiousLeaderCreate(BaseModel):
    name: str
    title: str  # Fr., Pastor, Rev., Sheikh, etc.
    email: str
    phone: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    church_or_organization: Optional[str] = None

class ReligiousLeaderUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    church_or_organization: Optional[str] = None
    is_active: Optional[bool] = None

class NenoLaLeoCreate(BaseModel):
    leader_id: str
    book: str  # e.g., "Mathayo", "Luka"
    chapter: int
    verse_start: int
    verse_end: int
    word_date: str  # Date this word is for (YYYY-MM-DD)
    publish_date: str  # When to publish (YYYY-MM-DD)
    publish_time: str  # Time to publish (HH:MM)
    reading_audio_url: Optional[str] = None
    reflection_audio_url: Optional[str] = None
    notes: Optional[str] = None

class NenoLaLeoUpdate(BaseModel):
    book: Optional[str] = None
    chapter: Optional[int] = None
    verse_start: Optional[int] = None
    verse_end: Optional[int] = None
    word_date: Optional[str] = None
    publish_date: Optional[str] = None
    publish_time: Optional[str] = None
    reading_audio_url: Optional[str] = None
    reflection_audio_url: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_leader_id() -> str:
    return f"leader_{uuid.uuid4().hex[:12]}"

def generate_neno_id() -> str:
    return f"neno_{uuid.uuid4().hex[:12]}"

async def get_leader_from_token(request: Request):
    """Get religious leader from auth token (uses existing leaders.py auth)"""
    db = get_db()
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]
    token_doc = await db.leader_tokens.find_one({"token": token})
    if not token_doc:
        return None
    
    leader = await db.religious_leaders.find_one(
        {"leader_id": token_doc["leader_id"]},
        {"_id": 0, "password_hash": 0}
    )
    return leader


async def require_admin(request: Request):
    """Ensure caller is an authenticated admin (cookie or Bearer)."""
    db = get_db()
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token or not session_token.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    admin_session = await db.admin_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not admin_session:
        raise HTTPException(status_code=401, detail="Invalid admin session")
    expires_at = admin_session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Admin session expired")
    return admin_session

def format_verse_reference(book: str, chapter: int, verse_start: int, verse_end: int) -> str:
    """Format verse reference like 'Luka 2:15-19'"""
    if verse_start == verse_end:
        return f"{book} {chapter}:{verse_start}"
    return f"{book} {chapter}:{verse_start}-{verse_end}"

def get_swahili_day_name(date_obj: datetime) -> str:
    """Get Swahili day name"""
    days = {
        0: "Jumatatu",
        1: "Jumanne", 
        2: "Jumatano",
        3: "Alhamisi",
        4: "Ijumaa",
        5: "Jumamosi",
        6: "Jumapili"
    }
    return days.get(date_obj.weekday(), "")

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/leaders")
async def get_all_leaders(request: Request, _admin=Depends(require_admin)):
    """Get all religious leaders (Admin only)"""
    db = get_db()
    leaders = await db.religious_leaders.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(100)
    return {"leaders": leaders, "total": len(leaders)}

@router.post("/admin/leaders")
async def create_leader(request: Request, data: ReligiousLeaderCreate, _admin=Depends(require_admin)):
    """Create a new religious leader (Admin only)"""
    db = get_db()
    
    # Check if email already exists
    existing = await db.religious_leaders.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate temporary password
    temp_password = uuid.uuid4().hex[:8]
    
    leader = {
        "leader_id": generate_leader_id(),
        "name": data.name,
        "title": data.title,
        "email": data.email,
        "phone": data.phone,
        "bio": data.bio,
        "photo_url": data.photo_url,
        "church_or_organization": data.church_or_organization,
        "password_hash": hash_password(temp_password),
        "is_active": True,
        "is_approved": True,  # Admin-created leaders are auto-approved
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total_neno": 0,
            "total_plays": 0,
            "total_reading_plays": 0,
            "total_reflection_plays": 0
        }
    }
    
    await db.religious_leaders.insert_one(leader)
    leader.pop("_id", None)
    leader.pop("password_hash", None)
    
    return {
        "message": "Leader created successfully",
        "leader": leader,
        "temporary_password": temp_password  # Send this to the leader
    }

@router.put("/admin/leaders/{leader_id}")
async def update_leader(leader_id: str, data: ReligiousLeaderUpdate, _admin=Depends(require_admin)):
    """Update a religious leader (Admin only)"""
    db = get_db()
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.religious_leaders.update_one(
        {"leader_id": leader_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return {"message": "Leader updated successfully"}

@router.delete("/admin/leaders/{leader_id}")
async def delete_leader(leader_id: str, _admin=Depends(require_admin)):
    """Delete a religious leader (Admin only)"""
    db = get_db()
    result = await db.religious_leaders.delete_one({"leader_id": leader_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return {"message": "Leader deleted successfully"}

@router.get("/admin/pending-leaders")
async def get_pending_leaders(_admin=Depends(require_admin)):
    """Get leaders pending approval (Admin only)"""
    db = get_db()
    leaders = await db.religious_leaders.find(
        {"is_approved": False},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(50)
    return {"leaders": leaders, "total": len(leaders)}

@router.post("/admin/leaders/{leader_id}/approve")
async def approve_leader(leader_id: str, _admin=Depends(require_admin)):
    """Approve a pending leader (Admin only)"""
    db = get_db()
    result = await db.religious_leaders.update_one(
        {"leader_id": leader_id},
        {"$set": {"is_approved": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return {"message": "Leader approved successfully"}

# ==================== ADMIN NENO LA LEO MANAGEMENT ====================

@router.get("/admin/neno")
async def get_all_neno(request: Request, status: Optional[str] = None, _admin=Depends(require_admin)):
    """Get all Neno la Leo entries (Admin only)"""
    db = get_db()
    
    query = {}
    if status == "active":
        query["is_active"] = True
    elif status == "inactive":
        query["is_active"] = False
    elif status == "scheduled":
        query["is_active"] = False
        query["publish_datetime"] = {"$gt": datetime.now(timezone.utc).isoformat()}
    
    neno_list = await db.neno_la_leo.find(
        query,
        {"_id": 0}
    ).sort("word_date", -1).to_list(100)
    
    # Enrich with leader info
    for neno in neno_list:
        leader = await db.religious_leaders.find_one(
            {"leader_id": neno.get("leader_id")},
            {"_id": 0, "name": 1, "title": 1, "photo_url": 1}
        )
        neno["leader"] = leader
    
    return {"neno_list": neno_list, "total": len(neno_list)}

@router.post("/admin/neno")
async def create_neno(data: NenoLaLeoCreate, _admin=Depends(require_admin)):
    """Create a new Neno la Leo entry (Admin only)"""
    db = get_db()
    
    # Verify leader exists
    leader = await db.religious_leaders.find_one({"leader_id": data.leader_id})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    # Parse dates
    publish_datetime = datetime.fromisoformat(f"{data.publish_date}T{data.publish_time}:00")
    word_date_obj = datetime.fromisoformat(data.word_date)
    
    # Check if should be active now
    is_active = datetime.now(timezone.utc) >= publish_datetime.replace(tzinfo=timezone.utc)
    
    neno = {
        "neno_id": generate_neno_id(),
        "leader_id": data.leader_id,
        "book": data.book,
        "chapter": data.chapter,
        "verse_start": data.verse_start,
        "verse_end": data.verse_end,
        "verse_reference": format_verse_reference(data.book, data.chapter, data.verse_start, data.verse_end),
        "word_date": data.word_date,
        "word_day_name": get_swahili_day_name(word_date_obj),
        "publish_date": data.publish_date,
        "publish_time": data.publish_time,
        "publish_datetime": publish_datetime.isoformat(),
        "reading_audio_url": data.reading_audio_url,
        "reflection_audio_url": data.reflection_audio_url,
        "notes": data.notes,
        "is_active": is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin",
        "stats": {
            "reading_plays": 0,
            "reflection_plays": 0,
            "total_plays": 0
        },
        "expires_at": (word_date_obj + timedelta(days=30)).isoformat()  # Auto-expire after 30 days
    }
    
    await db.neno_la_leo.insert_one(neno)
    neno.pop("_id", None)
    
    # Update leader stats
    await db.religious_leaders.update_one(
        {"leader_id": data.leader_id},
        {"$inc": {"stats.total_neno": 1}}
    )
    
    return {"message": "Neno la Leo created successfully", "neno": neno}

@router.put("/admin/neno/{neno_id}")
async def update_neno(neno_id: str, data: NenoLaLeoUpdate, _admin=Depends(require_admin)):
    """Update a Neno la Leo entry (Admin only)"""
    db = get_db()
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # Recalculate verse reference if needed
    if any(k in update_data for k in ["book", "chapter", "verse_start", "verse_end"]):
        neno = await db.neno_la_leo.find_one({"neno_id": neno_id})
        if neno:
            book = update_data.get("book", neno["book"])
            chapter = update_data.get("chapter", neno["chapter"])
            verse_start = update_data.get("verse_start", neno["verse_start"])
            verse_end = update_data.get("verse_end", neno["verse_end"])
            update_data["verse_reference"] = format_verse_reference(book, chapter, verse_start, verse_end)
    
    # Recalculate publish datetime if dates changed
    if "publish_date" in update_data or "publish_time" in update_data:
        neno = await db.neno_la_leo.find_one({"neno_id": neno_id})
        if neno:
            pub_date = update_data.get("publish_date", neno["publish_date"])
            pub_time = update_data.get("publish_time", neno["publish_time"])
            update_data["publish_datetime"] = datetime.fromisoformat(f"{pub_date}T{pub_time}:00").isoformat()
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.neno_la_leo.update_one(
        {"neno_id": neno_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Neno not found")
    
    return {"message": "Neno la Leo updated successfully"}

@router.delete("/admin/neno/{neno_id}")
async def delete_neno(neno_id: str, _admin=Depends(require_admin)):
    """Delete a Neno la Leo entry (Admin only)"""
    db = get_db()
    
    neno = await db.neno_la_leo.find_one({"neno_id": neno_id})
    if not neno:
        raise HTTPException(status_code=404, detail="Neno not found")
    
    await db.neno_la_leo.delete_one({"neno_id": neno_id})
    
    # Update leader stats (floor at 0)
    leader = await db.religious_leaders.find_one({"leader_id": neno["leader_id"]}, {"stats.total_neno": 1})
    current_count = (leader or {}).get("stats", {}).get("total_neno", 0)
    if current_count > 0:
        await db.religious_leaders.update_one(
            {"leader_id": neno["leader_id"]},
            {"$inc": {"stats.total_neno": -1}}
        )
    
    return {"message": "Neno la Leo deleted successfully"}

# ==================== LEADER PORTAL ENDPOINTS ====================
# Note: Authentication is handled by routes/leaders.py
# This module uses the existing leader_tokens to scope Neno la Leo actions.

@router.get("/leader/my-neno")
async def get_leader_neno(request: Request):
    """Get all Neno la Leo created by current leader"""
    leader = await get_leader_from_token(request)
    if not leader:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db()
    neno_list = await db.neno_la_leo.find(
        {"leader_id": leader["leader_id"]},
        {"_id": 0}
    ).sort("word_date", -1).to_list(100)
    
    return {"neno_list": neno_list, "total": len(neno_list)}

@router.post("/leader/neno")
async def leader_create_neno(request: Request, data: NenoLaLeoCreate):
    """Create a new Neno la Leo entry (by leader)"""
    leader = await get_leader_from_token(request)
    if not leader:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db()
    
    # Override leader_id with authenticated leader
    data.leader_id = leader["leader_id"]
    
    # Parse dates
    publish_datetime = datetime.fromisoformat(f"{data.publish_date}T{data.publish_time}:00")
    word_date_obj = datetime.fromisoformat(data.word_date)
    
    is_active = datetime.now(timezone.utc) >= publish_datetime.replace(tzinfo=timezone.utc)
    
    neno = {
        "neno_id": generate_neno_id(),
        "leader_id": leader["leader_id"],
        "book": data.book,
        "chapter": data.chapter,
        "verse_start": data.verse_start,
        "verse_end": data.verse_end,
        "verse_reference": format_verse_reference(data.book, data.chapter, data.verse_start, data.verse_end),
        "word_date": data.word_date,
        "word_day_name": get_swahili_day_name(word_date_obj),
        "publish_date": data.publish_date,
        "publish_time": data.publish_time,
        "publish_datetime": publish_datetime.isoformat(),
        "reading_audio_url": data.reading_audio_url,
        "reflection_audio_url": data.reflection_audio_url,
        "notes": data.notes,
        "is_active": is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "leader",
        "stats": {
            "reading_plays": 0,
            "reflection_plays": 0,
            "total_plays": 0
        },
        "expires_at": (word_date_obj + timedelta(days=30)).isoformat()
    }
    
    await db.neno_la_leo.insert_one(neno)
    neno.pop("_id", None)
    
    # Update leader stats
    await db.religious_leaders.update_one(
        {"leader_id": leader["leader_id"]},
        {"$inc": {"stats.total_neno": 1}}
    )
    
    return {"message": "Neno la Leo created successfully", "neno": neno}

@router.put("/leader/neno/{neno_id}")
async def leader_update_neno(request: Request, neno_id: str, data: NenoLaLeoUpdate):
    """Update own Neno la Leo entry"""
    leader = await get_leader_from_token(request)
    if not leader:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db()
    
    # Verify ownership
    neno = await db.neno_la_leo.find_one({"neno_id": neno_id, "leader_id": leader["leader_id"]})
    if not neno:
        raise HTTPException(status_code=404, detail="Neno not found or not owned by you")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.neno_la_leo.update_one(
        {"neno_id": neno_id},
        {"$set": update_data}
    )
    
    return {"message": "Neno la Leo updated successfully"}

@router.get("/leader/analytics")
async def get_leader_analytics(request: Request):
    """Get analytics for current leader"""
    leader = await get_leader_from_token(request)
    if not leader:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_db()
    
    # Get all neno by this leader
    neno_list = await db.neno_la_leo.find(
        {"leader_id": leader["leader_id"]},
        {"_id": 0}
    ).to_list(1000)
    
    total_reading_plays = sum(n.get("stats", {}).get("reading_plays", 0) for n in neno_list)
    total_reflection_plays = sum(n.get("stats", {}).get("reflection_plays", 0) for n in neno_list)
    
    # Get recent plays (last 30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent_neno = [n for n in neno_list if n.get("created_at", "") >= thirty_days_ago]
    
    return {
        "total_neno": len(neno_list),
        "active_neno": len([n for n in neno_list if n.get("is_active")]),
        "total_reading_plays": total_reading_plays,
        "total_reflection_plays": total_reflection_plays,
        "total_plays": total_reading_plays + total_reflection_plays,
        "recent_neno_count": len(recent_neno),
        "top_neno": sorted(neno_list, key=lambda x: x.get("stats", {}).get("total_plays", 0), reverse=True)[:5]
    }

# ==================== USER ENDPOINTS ====================

@router.get("/active")
async def get_active_neno():
    """Get all active Neno la Leo for users (last 30 days)"""
    db = get_db()
    
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    
    # Auto-activate scheduled neno
    await db.neno_la_leo.update_many(
        {
            "is_active": False,
            "publish_datetime": {"$lte": now.isoformat()}
        },
        {"$set": {"is_active": True}}
    )
    
    # Auto-deactivate expired neno (older than 30 days)
    await db.neno_la_leo.update_many(
        {
            "is_active": True,
            "expires_at": {"$lt": now.isoformat()}
        },
        {"$set": {"is_active": False}}
    )
    
    # Get active neno
    neno_list = await db.neno_la_leo.find(
        {
            "is_active": True,
            "word_date": {"$gte": thirty_days_ago[:10]}  # Just date part
        },
        {"_id": 0}
    ).sort("word_date", -1).to_list(50)
    
    # Enrich with leader info
    for neno in neno_list:
        leader = await db.religious_leaders.find_one(
            {"leader_id": neno.get("leader_id")},
            {"_id": 0, "name": 1, "title": 1, "photo_url": 1}
        )
        neno["leader"] = leader
        # Format display
        neno["display_date"] = f"{neno.get('word_day_name', '')} {neno.get('word_date', '')}"
        neno["leader_display"] = f"{leader.get('title', '')} {leader.get('name', '')}" if leader else "Unknown"
    
    return {"neno_list": neno_list, "total": len(neno_list)}

@router.get("/{neno_id}")
async def get_single_neno(neno_id: str):
    """Get a single Neno la Leo by ID"""
    db = get_db()
    
    neno = await db.neno_la_leo.find_one(
        {"neno_id": neno_id, "is_active": True},
        {"_id": 0}
    )
    
    if not neno:
        raise HTTPException(status_code=404, detail="Neno not found")
    
    # Get leader info
    leader = await db.religious_leaders.find_one(
        {"leader_id": neno.get("leader_id")},
        {"_id": 0, "name": 1, "title": 1, "photo_url": 1, "bio": 1}
    )
    neno["leader"] = leader
    
    return neno

@router.post("/{neno_id}/play")
async def track_neno_play(neno_id: str, audio_type: str = "reading"):
    """Track play count for Neno la Leo"""
    db = get_db()
    
    if audio_type not in ["reading", "reflection"]:
        raise HTTPException(status_code=400, detail="audio_type must be 'reading' or 'reflection'")
    
    update_field = f"stats.{audio_type}_plays"
    
    result = await db.neno_la_leo.update_one(
        {"neno_id": neno_id},
        {
            "$inc": {
                update_field: 1,
                "stats.total_plays": 1
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Neno not found")
    
    # Also update leader stats
    neno = await db.neno_la_leo.find_one({"neno_id": neno_id})
    if neno:
        leader_field = f"stats.total_{audio_type}_plays"
        await db.religious_leaders.update_one(
            {"leader_id": neno["leader_id"]},
            {"$inc": {leader_field: 1, "stats.total_plays": 1}}
        )
    
    return {"message": "Play tracked"}

# ==================== AUDIO UPLOAD ====================

@router.post("/upload-audio")
async def upload_neno_audio(
    request: Request,
    file: UploadFile = File(...),
    audio_type: str = Form(...)  # "reading" or "reflection"
):
    """Upload audio file for Neno la Leo"""
    
    if audio_type not in ["reading", "reflection"]:
        raise HTTPException(status_code=400, detail="Invalid audio type")
    
    # Validate file type
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")
    
    # Read file content
    content = await file.read()
    
    # Upload to Bunny CDN
    bunny_api_key = os.environ.get("BUNNY_API_KEY")
    bunny_storage_zone = os.environ.get("BUNNY_STORAGE_ZONE")
    bunny_cdn_url = os.environ.get("BUNNY_CDN_URL")
    
    if not all([bunny_api_key, bunny_storage_zone, bunny_cdn_url]):
        raise HTTPException(status_code=500, detail="Storage not configured")
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "mp3"
    filename = f"neno/{audio_type}_{uuid.uuid4().hex}.{ext}"
    
    # Upload to Bunny
    async with httpx.AsyncClient() as client:
        response = await client.put(
            f"https://storage.bunnycdn.com/{bunny_storage_zone}/{filename}",
            content=content,
            headers={
                "AccessKey": bunny_api_key,
                "Content-Type": file.content_type
            }
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail="Failed to upload audio")
    
    audio_url = f"{bunny_cdn_url}/{filename}"
    
    return {
        "message": "Audio uploaded successfully",
        "audio_url": audio_url,
        "audio_type": audio_type
    }
