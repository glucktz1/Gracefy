from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, Response
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Spirit Songs Admin API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "customer"  # customer, admin, moderator, content_manager
    status: str = "active"  # active, suspended, pending
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    session_id: str = Field(default_factory=lambda: f"sess_{uuid.uuid4().hex}")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    category_id: str = Field(default_factory=lambda: f"cat_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    type: str = "content"  # content, music, sermon, podcast
    icon: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Album(BaseModel):
    model_config = ConfigDict(extra="ignore")
    album_id: str = Field(default_factory=lambda: f"alb_{uuid.uuid4().hex[:12]}")
    title: str
    description: Optional[str] = None
    artist_id: Optional[str] = None
    artist_name: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    thumbnail: Optional[str] = None
    release_date: Optional[str] = None
    monetization_type: str = "free"  # free, standard, premium
    status: str = "active"  # active, inactive
    songs_count: int = 0
    total_plays: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Song(BaseModel):
    model_config = ConfigDict(extra="ignore")
    song_id: str = Field(default_factory=lambda: f"song_{uuid.uuid4().hex[:12]}")
    title: str
    album_id: str
    duration: Optional[int] = None  # in seconds
    duration_formatted: Optional[str] = None  # "3:45" format
    audio_url: Optional[str] = None
    lyrics: Optional[str] = None
    track_number: Optional[int] = None
    plays: int = 0
    likes: int = 0
    status: str = "active"  # active, inactive
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Church(BaseModel):
    model_config = ConfigDict(extra="ignore")
    church_id: str = Field(default_factory=lambda: f"ch_{uuid.uuid4().hex[:12]}")
    name: str
    location: str
    direction: Optional[str] = None
    bio: Optional[str] = None
    priest_name: Optional[str] = None
    priest_photo: Optional[str] = None
    prayer_schedule: Optional[List[dict]] = None
    announcements: Optional[List[dict]] = None
    thumbnail: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, suspended
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReligiousLeader(BaseModel):
    model_config = ConfigDict(extra="ignore")
    leader_id: str = Field(default_factory=lambda: f"lead_{uuid.uuid4().hex[:12]}")
    name: str
    title: str  # pastor, priest, catechist, bishop
    church_id: Optional[str] = None
    church_name: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    followers: int = 0
    is_verified: bool = False
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Singer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    singer_id: str = Field(default_factory=lambda: f"sing_{uuid.uuid4().hex[:12]}")
    name: str
    type: str = "solo"  # solo, choir, band
    church_id: Optional[str] = None
    church_name: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    followers: int = 0
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LiveSeminar(BaseModel):
    model_config = ConfigDict(extra="ignore")
    seminar_id: str = Field(default_factory=lambda: f"sem_{uuid.uuid4().hex[:12]}")
    title: str
    description: Optional[str] = None
    topic: str
    organizer_id: Optional[str] = None
    organizer_name: Optional[str] = None
    date: str
    time: str
    duration: Optional[int] = None  # minutes
    meeting_link: Optional[str] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # weekly, custom
    recurrence_days: Optional[List[str]] = None
    is_paid: bool = False
    price: Optional[float] = None
    max_participants: Optional[int] = None
    registered_count: int = 0
    status: str = "scheduled"  # scheduled, ongoing, completed, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AudioRoom(BaseModel):
    model_config = ConfigDict(extra="ignore")
    room_id: str = Field(default_factory=lambda: f"room_{uuid.uuid4().hex[:12]}")
    title: str
    description: Optional[str] = None
    host_id: Optional[str] = None
    host_name: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    participants_count: int = 0
    status: str = "scheduled"  # scheduled, live, ended
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DonationCampaign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    campaign_id: str = Field(default_factory=lambda: f"camp_{uuid.uuid4().hex[:12]}")
    title: str
    description: str
    goal_amount: float
    raised_amount: float = 0
    thumbnail: Optional[str] = None
    end_date: Optional[str] = None
    recent_donations: Optional[List[dict]] = None  # [{amount, time, anonymous}]
    status: str = "active"  # active, completed, paused
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommunityPost(BaseModel):
    model_config = ConfigDict(extra="ignore")
    post_id: str = Field(default_factory=lambda: f"post_{uuid.uuid4().hex[:12]}")
    user_id: str
    user_name: str
    user_photo: Optional[str] = None
    content: str
    media_urls: Optional[List[str]] = None
    likes: int = 0
    comments_count: int = 0
    status: str = "pending"  # pending, approved, rejected, flagged
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PriestBooking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    booking_id: str = Field(default_factory=lambda: f"book_{uuid.uuid4().hex[:12]}")
    priest_id: str
    priest_name: str
    user_id: str
    user_name: str
    date: str
    time: str
    purpose: str
    notes: Optional[str] = None
    status: str = "pending"  # pending, confirmed, completed, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REVENUE & ANALYTICS MODELS ==============

class RevenueSettings(BaseModel):
    """Platform revenue settings - hourly rates for content types"""
    model_config = ConfigDict(extra="ignore")
    settings_id: str = Field(default_factory=lambda: f"rev_{uuid.uuid4().hex[:12]}")
    premium_rate_per_hour: float = 10.0  # TZS per hour for premium content
    standard_rate_per_hour: float = 5.0  # TZS per hour for standard content
    platform_share_percentage: float = 30.0  # Platform takes 30%, choir gets 70%
    minimum_withdrawal: float = 10000.0  # Minimum amount for withdrawal
    effective_from: str = ""  # Date from which these rates apply
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ListeningSession(BaseModel):
    """Track user listening sessions for revenue calculation"""
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: f"listen_{uuid.uuid4().hex[:12]}")
    user_id: str
    song_id: str
    album_id: str
    choir_id: str  # Singer/choir who owns the album
    content_type: str = "standard"  # premium or standard
    start_time: str = ""
    end_time: Optional[str] = None
    duration_seconds: int = 0
    duration_hours: float = 0.0
    date: str = ""  # YYYY-MM-DD for daily aggregation
    month: str = ""  # YYYY-MM for monthly aggregation
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChoirRevenue(BaseModel):
    """Aggregated revenue data for each choir"""
    model_config = ConfigDict(extra="ignore")
    revenue_id: str = Field(default_factory=lambda: f"chorrev_{uuid.uuid4().hex[:12]}")
    choir_id: str
    choir_name: str
    period: str  # YYYY-MM for monthly
    premium_hours: float = 0.0
    standard_hours: float = 0.0
    total_hours: float = 0.0
    premium_revenue: float = 0.0
    standard_revenue: float = 0.0
    gross_revenue: float = 0.0
    platform_share: float = 0.0
    net_revenue: float = 0.0  # What choir earns
    total_plays: int = 0
    status: str = "pending"  # pending, calculated, paid
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlbumPerformance(BaseModel):
    """Album-level performance metrics"""
    model_config = ConfigDict(extra="ignore")
    performance_id: str = Field(default_factory=lambda: f"albperf_{uuid.uuid4().hex[:12]}")
    album_id: str
    album_title: str
    choir_id: str
    choir_name: str
    period: str  # YYYY-MM
    premium_hours: float = 0.0
    standard_hours: float = 0.0
    total_hours: float = 0.0
    revenue_generated: float = 0.0
    total_plays: int = 0
    unique_listeners: int = 0
    avg_listen_duration: float = 0.0  # Average session duration in minutes
    revenue_percentage: float = 0.0  # % of choir's total revenue
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WithdrawalRequest(BaseModel):
    """Choir withdrawal requests"""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"wd_{uuid.uuid4().hex[:12]}")
    choir_id: str
    choir_name: str
    amount: float
    payment_method: str = "mobile_money"  # mobile_money, bank_transfer
    payment_details: Optional[dict] = None  # {phone, bank_name, account_number, etc.}
    status: str = "pending"  # pending, approved, rejected, completed
    admin_notes: Optional[str] = None
    processed_by: Optional[str] = None
    processed_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChoirAccount(BaseModel):
    """Choir account for login and balance tracking"""
    model_config = ConfigDict(extra="ignore")
    account_id: str = Field(default_factory=lambda: f"acc_{uuid.uuid4().hex[:12]}")
    choir_id: str  # Links to singers collection
    choir_name: str
    email: str
    password_hash: str  # Will use simple hash for demo
    current_balance: float = 0.0
    total_earned: float = 0.0
    total_withdrawn: float = 0.0
    status: str = "pending"  # pending, approved, suspended
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Process session_id from Emergent OAuth and create user session"""
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Get user data from Emergent auth
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_data = auth_response.json()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data
        await db.users.update_one(
            {"email": user_data["email"]},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture")
            }}
        )
    else:
        # Create new user (default role is customer, admin needs to be set manually)
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "role": "admin",  # First user is admin for testing
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", f"token_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_current_user(request: Request):
    """Get current authenticated user"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== DASHBOARD ANALYTICS ==============

@api_router.get("/analytics/overview")
async def get_analytics_overview():
    """Get dashboard analytics overview"""
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
    
    # Get total raised amount
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$raised_amount"}}}]
    donation_result = await db.donation_campaigns.aggregate(pipeline).to_list(1)
    total_raised = donation_result[0]["total"] if donation_result else 0
    
    return {
        "total_users": total_users,
        "total_customers": total_customers,
        "total_system_users": total_system_users,
        "total_songs": total_songs,
        "total_albums": total_albums,
        "total_churches": total_churches,
        "total_leaders": total_leaders,
        "total_donations": total_donations,
        "pending_approvals": pending_approvals,
        "total_raised": total_raised
    }

@api_router.get("/analytics/trends")
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

# ============== USERS MANAGEMENT ==============

@api_router.get("/users")
async def get_users(role: Optional[str] = None, status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all users with optional filters"""
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    return {"users": users, "total": total}

@api_router.post("/users")
async def create_user(user: dict):
    """Create a new system user"""
    user_obj = UserBase(**user)
    doc = user_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)
    return {"user_id": doc["user_id"], "message": "User created successfully"}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, updates: dict):
    """Update user details"""
    updates.pop("_id", None)
    updates.pop("user_id", None)
    result = await db.users.update_one({"user_id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a user"""
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# ============== CATEGORIES MANAGEMENT ==============

@api_router.get("/categories")
async def get_categories(type: Optional[str] = None):
    """Get all categories"""
    query = {}
    if type:
        query["type"] = type
    categories = await db.categories.find(query, {"_id": 0}).to_list(100)
    return {"categories": categories}

@api_router.post("/categories")
async def create_category(category: dict):
    """Create a new category"""
    cat_obj = Category(**category)
    doc = cat_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.categories.insert_one(doc)
    return {"category_id": doc["category_id"], "message": "Category created successfully"}

@api_router.put("/categories/{category_id}")
async def update_category(category_id: str, updates: dict):
    """Update category"""
    updates.pop("_id", None)
    updates.pop("category_id", None)
    result = await db.categories.update_one({"category_id": category_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category updated successfully"}

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete a category"""
    result = await db.categories.delete_one({"category_id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

# ============== ALBUMS MANAGEMENT ==============

@api_router.get("/albums")
async def get_albums(category_id: Optional[str] = None, artist_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all albums"""
    query = {}
    if category_id:
        query["category_id"] = category_id
    if artist_id:
        query["artist_id"] = artist_id
    albums = await db.albums.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.albums.count_documents(query)
    return {"albums": albums, "total": total}

@api_router.get("/albums/{album_id}")
async def get_album(album_id: str):
    """Get single album with songs"""
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    songs = await db.songs.find({"album_id": album_id}, {"_id": 0}).to_list(100)
    return {"album": album, "songs": songs}

@api_router.post("/albums")
async def create_album(album: dict):
    """Create a new album"""
    album_obj = Album(**album)
    doc = album_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.albums.insert_one(doc)
    return {"album_id": doc["album_id"], "message": "Album created successfully"}

@api_router.put("/albums/{album_id}")
async def update_album(album_id: str, updates: dict):
    """Update album"""
    updates.pop("_id", None)
    updates.pop("album_id", None)
    result = await db.albums.update_one({"album_id": album_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    return {"message": "Album updated successfully"}

@api_router.delete("/albums/{album_id}")
async def delete_album(album_id: str):
    """Delete album and its songs"""
    await db.songs.delete_many({"album_id": album_id})
    result = await db.albums.delete_one({"album_id": album_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    return {"message": "Album and songs deleted successfully"}

@api_router.post("/albums/bulk-status")
async def bulk_update_album_status(data: dict):
    """Bulk update album status (activate/deactivate)"""
    album_ids = data.get("album_ids", [])
    status = data.get("status", "active")
    
    if not album_ids:
        raise HTTPException(status_code=400, detail="No album IDs provided")
    
    result = await db.albums.update_many(
        {"album_id": {"$in": album_ids}},
        {"$set": {"status": status}}
    )
    return {"message": f"{result.modified_count} albums updated to {status}"}

@api_router.post("/albums/bulk-delete")
async def bulk_delete_albums(data: dict):
    """Bulk delete albums and their songs"""
    album_ids = data.get("album_ids", [])
    
    if not album_ids:
        raise HTTPException(status_code=400, detail="No album IDs provided")
    
    # Delete all songs from these albums
    await db.songs.delete_many({"album_id": {"$in": album_ids}})
    # Delete the albums
    result = await db.albums.delete_many({"album_id": {"$in": album_ids}})
    return {"message": f"{result.deleted_count} albums deleted"}

# ============== SONGS MANAGEMENT ==============

@api_router.get("/songs")
async def get_songs(album_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all songs"""
    query = {}
    if album_id:
        query["album_id"] = album_id
    songs = await db.songs.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.songs.count_documents(query)
    return {"songs": songs, "total": total}

@api_router.post("/songs")
async def create_song(song: dict):
    """Create a new song"""
    song_obj = Song(**song)
    doc = song_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.songs.insert_one(doc)
    return {"song_id": doc["song_id"], "message": "Song created successfully"}

@api_router.post("/songs/bulk")
async def create_songs_bulk(songs: List[dict]):
    """Create multiple songs at once"""
    created_ids = []
    for song in songs:
        song_obj = Song(**song)
        doc = song_obj.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        await db.songs.insert_one(doc)
        created_ids.append(doc["song_id"])
    return {"song_ids": created_ids, "message": f"{len(created_ids)} songs created successfully"}

@api_router.put("/songs/{song_id}")
async def update_song(song_id: str, updates: dict):
    """Update song"""
    updates.pop("_id", None)
    updates.pop("song_id", None)
    result = await db.songs.update_one({"song_id": song_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"message": "Song updated successfully"}

@api_router.delete("/songs/{song_id}")
async def delete_song(song_id: str):
    """Delete a song"""
    result = await db.songs.delete_one({"song_id": song_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"message": "Song deleted successfully"}

@api_router.post("/songs/bulk-status")
async def bulk_update_song_status(data: dict):
    """Bulk update song status (activate/deactivate)"""
    song_ids = data.get("song_ids", [])
    status = data.get("status", "active")
    
    if not song_ids:
        raise HTTPException(status_code=400, detail="No song IDs provided")
    
    result = await db.songs.update_many(
        {"song_id": {"$in": song_ids}},
        {"$set": {"status": status}}
    )
    return {"message": f"{result.modified_count} songs updated to {status}"}

@api_router.post("/songs/bulk-delete")
async def bulk_delete_songs(data: dict):
    """Bulk delete songs"""
    song_ids = data.get("song_ids", [])
    
    if not song_ids:
        raise HTTPException(status_code=400, detail="No song IDs provided")
    
    result = await db.songs.delete_many({"song_id": {"$in": song_ids}})
    return {"message": f"{result.deleted_count} songs deleted"}

# ============== CHURCHES MANAGEMENT ==============

@api_router.get("/churches")
async def get_churches(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all churches"""
    query = {}
    if status:
        query["status"] = status
    churches = await db.churches.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.churches.count_documents(query)
    return {"churches": churches, "total": total}

@api_router.get("/churches/{church_id}")
async def get_church(church_id: str):
    """Get single church"""
    church = await db.churches.find_one({"church_id": church_id}, {"_id": 0})
    if not church:
        raise HTTPException(status_code=404, detail="Church not found")
    return church

@api_router.post("/churches")
async def create_church(church: dict):
    """Create a new church"""
    church_obj = Church(**church)
    doc = church_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.churches.insert_one(doc)
    return {"church_id": doc["church_id"], "message": "Church created successfully"}

@api_router.put("/churches/{church_id}")
async def update_church(church_id: str, updates: dict):
    """Update church"""
    updates.pop("_id", None)
    updates.pop("church_id", None)
    result = await db.churches.update_one({"church_id": church_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    return {"message": "Church updated successfully"}

@api_router.delete("/churches/{church_id}")
async def delete_church(church_id: str):
    """Delete a church"""
    result = await db.churches.delete_one({"church_id": church_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Church not found")
    return {"message": "Church deleted successfully"}

# ============== RELIGIOUS LEADERS MANAGEMENT ==============

@api_router.get("/leaders")
async def get_leaders(status: Optional[str] = None, is_verified: Optional[bool] = None, skip: int = 0, limit: int = 50):
    """Get all religious leaders"""
    query = {}
    if status:
        query["status"] = status
    if is_verified is not None:
        query["is_verified"] = is_verified
    leaders = await db.religious_leaders.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.religious_leaders.count_documents(query)
    return {"leaders": leaders, "total": total}

@api_router.post("/leaders")
async def create_leader(leader: dict):
    """Create a new religious leader"""
    leader_obj = ReligiousLeader(**leader)
    doc = leader_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.religious_leaders.insert_one(doc)
    return {"leader_id": doc["leader_id"], "message": "Leader created successfully"}

@api_router.put("/leaders/{leader_id}")
async def update_leader(leader_id: str, updates: dict):
    """Update religious leader"""
    updates.pop("_id", None)
    updates.pop("leader_id", None)
    result = await db.religious_leaders.update_one({"leader_id": leader_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    return {"message": "Leader updated successfully"}

@api_router.delete("/leaders/{leader_id}")
async def delete_leader(leader_id: str):
    """Delete a religious leader"""
    result = await db.religious_leaders.delete_one({"leader_id": leader_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    return {"message": "Leader deleted successfully"}

# ============== SINGERS/CHOIRS MANAGEMENT ==============

@api_router.get("/singers")
async def get_singers(type: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all singers/choirs"""
    query = {}
    if type:
        query["type"] = type
    singers = await db.singers.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.singers.count_documents(query)
    return {"singers": singers, "total": total}

@api_router.post("/singers")
async def create_singer(singer: dict):
    """Create a new singer/choir"""
    singer_obj = Singer(**singer)
    doc = singer_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.singers.insert_one(doc)
    return {"singer_id": doc["singer_id"], "message": "Singer created successfully"}

@api_router.put("/singers/{singer_id}")
async def update_singer(singer_id: str, updates: dict):
    """Update singer"""
    updates.pop("_id", None)
    updates.pop("singer_id", None)
    result = await db.singers.update_one({"singer_id": singer_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Singer not found")
    return {"message": "Singer updated successfully"}

@api_router.delete("/singers/{singer_id}")
async def delete_singer(singer_id: str):
    """Delete a singer"""
    result = await db.singers.delete_one({"singer_id": singer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Singer not found")
    return {"message": "Singer deleted successfully"}

# ============== LIVE SEMINARS MANAGEMENT ==============

@api_router.get("/seminars")
async def get_seminars(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all live seminars"""
    query = {}
    if status:
        query["status"] = status
    seminars = await db.live_seminars.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.live_seminars.count_documents(query)
    return {"seminars": seminars, "total": total}

@api_router.post("/seminars")
async def create_seminar(seminar: dict):
    """Create a new live seminar"""
    seminar_obj = LiveSeminar(**seminar)
    doc = seminar_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.live_seminars.insert_one(doc)
    return {"seminar_id": doc["seminar_id"], "message": "Seminar created successfully"}

@api_router.put("/seminars/{seminar_id}")
async def update_seminar(seminar_id: str, updates: dict):
    """Update seminar"""
    updates.pop("_id", None)
    updates.pop("seminar_id", None)
    result = await db.live_seminars.update_one({"seminar_id": seminar_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seminar not found")
    return {"message": "Seminar updated successfully"}

@api_router.delete("/seminars/{seminar_id}")
async def delete_seminar(seminar_id: str):
    """Delete a seminar"""
    result = await db.live_seminars.delete_one({"seminar_id": seminar_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Seminar not found")
    return {"message": "Seminar deleted successfully"}

# ============== AUDIO ROOMS MANAGEMENT ==============

@api_router.get("/audiorooms")
async def get_audio_rooms(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all audio rooms"""
    query = {}
    if status:
        query["status"] = status
    rooms = await db.audio_rooms.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.audio_rooms.count_documents(query)
    return {"rooms": rooms, "total": total}

@api_router.post("/audiorooms")
async def create_audio_room(room: dict):
    """Create a new audio room"""
    room_obj = AudioRoom(**room)
    doc = room_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.audio_rooms.insert_one(doc)
    return {"room_id": doc["room_id"], "message": "Audio room created successfully"}

@api_router.put("/audiorooms/{room_id}")
async def update_audio_room(room_id: str, updates: dict):
    """Update audio room"""
    updates.pop("_id", None)
    updates.pop("room_id", None)
    result = await db.audio_rooms.update_one({"room_id": room_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Audio room not found")
    return {"message": "Audio room updated successfully"}

@api_router.delete("/audiorooms/{room_id}")
async def delete_audio_room(room_id: str):
    """Delete an audio room"""
    result = await db.audio_rooms.delete_one({"room_id": room_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Audio room not found")
    return {"message": "Audio room deleted successfully"}

# ============== DONATION CAMPAIGNS MANAGEMENT ==============

@api_router.get("/donations")
async def get_donation_campaigns(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all donation campaigns"""
    query = {}
    if status:
        query["status"] = status
    campaigns = await db.donation_campaigns.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.donation_campaigns.count_documents(query)
    return {"campaigns": campaigns, "total": total}

@api_router.post("/donations")
async def create_donation_campaign(campaign: dict):
    """Create a new donation campaign"""
    campaign_obj = DonationCampaign(**campaign)
    doc = campaign_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.donation_campaigns.insert_one(doc)
    return {"campaign_id": doc["campaign_id"], "message": "Campaign created successfully"}

@api_router.put("/donations/{campaign_id}")
async def update_donation_campaign(campaign_id: str, updates: dict):
    """Update donation campaign"""
    updates.pop("_id", None)
    updates.pop("campaign_id", None)
    result = await db.donation_campaigns.update_one({"campaign_id": campaign_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign updated successfully"}

@api_router.delete("/donations/{campaign_id}")
async def delete_donation_campaign(campaign_id: str):
    """Delete a donation campaign"""
    result = await db.donation_campaigns.delete_one({"campaign_id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign deleted successfully"}

# ============== COMMUNITY POSTS MODERATION ==============

@api_router.get("/community/posts")
async def get_community_posts(status: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all community posts"""
    query = {}
    if status:
        query["status"] = status
    posts = await db.community_posts.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.community_posts.count_documents(query)
    return {"posts": posts, "total": total}

@api_router.put("/community/posts/{post_id}")
async def update_community_post(post_id: str, updates: dict):
    """Update/moderate community post"""
    updates.pop("_id", None)
    updates.pop("post_id", None)
    result = await db.community_posts.update_one({"post_id": post_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post updated successfully"}

@api_router.delete("/community/posts/{post_id}")
async def delete_community_post(post_id: str):
    """Delete a community post"""
    result = await db.community_posts.delete_one({"post_id": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post deleted successfully"}

# ============== PRIEST BOOKINGS MANAGEMENT ==============

@api_router.get("/bookings")
async def get_priest_bookings(status: Optional[str] = None, priest_id: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Get all priest bookings"""
    query = {}
    if status:
        query["status"] = status
    if priest_id:
        query["priest_id"] = priest_id
    bookings = await db.priest_bookings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.priest_bookings.count_documents(query)
    return {"bookings": bookings, "total": total}

@api_router.put("/bookings/{booking_id}")
async def update_priest_booking(booking_id: str, updates: dict):
    """Update priest booking status"""
    updates.pop("_id", None)
    updates.pop("booking_id", None)
    result = await db.priest_bookings.update_one({"booking_id": booking_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"message": "Booking updated successfully"}

# ============== APPROVALS ==============

@api_router.get("/approvals")
async def get_pending_approvals():
    """Get all pending approvals"""
    churches = await db.churches.find({"status": "pending"}, {"_id": 0}).to_list(100)
    leaders = await db.religious_leaders.find({"status": "pending"}, {"_id": 0}).to_list(100)
    posts = await db.community_posts.find({"status": "pending"}, {"_id": 0}).to_list(100)
    
    return {
        "churches": churches,
        "leaders": leaders,
        "posts": posts,
        "total": len(churches) + len(leaders) + len(posts)
    }

@api_router.post("/approvals/approve")
async def approve_item(data: dict):
    """Approve an item (church, leader, or post)"""
    item_type = data.get("type")
    item_id = data.get("id")
    
    if item_type == "church":
        await db.churches.update_one({"church_id": item_id}, {"$set": {"status": "approved"}})
    elif item_type == "leader":
        await db.religious_leaders.update_one({"leader_id": item_id}, {"$set": {"status": "approved", "is_verified": True}})
    elif item_type == "post":
        await db.community_posts.update_one({"post_id": item_id}, {"$set": {"status": "approved"}})
    else:
        raise HTTPException(status_code=400, detail="Invalid item type")
    
    return {"message": "Item approved successfully"}

@api_router.post("/approvals/reject")
async def reject_item(data: dict):
    """Reject an item"""
    item_type = data.get("type")
    item_id = data.get("id")
    
    if item_type == "church":
        await db.churches.update_one({"church_id": item_id}, {"$set": {"status": "rejected"}})
    elif item_type == "leader":
        await db.religious_leaders.update_one({"leader_id": item_id}, {"$set": {"status": "rejected"}})
    elif item_type == "post":
        await db.community_posts.update_one({"post_id": item_id}, {"$set": {"status": "rejected"}})
    else:
        raise HTTPException(status_code=400, detail="Invalid item type")
    
    return {"message": "Item rejected"}

# ============== FILE UPLOAD (Base64 for now, Firebase can be integrated) ==============

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload file and return URL (stores as base64 in MongoDB for now)"""
    content = await file.read()
    base64_content = base64.b64encode(content).decode('utf-8')
    
    file_doc = {
        "file_id": f"file_{uuid.uuid4().hex[:12]}",
        "filename": file.filename,
        "content_type": file.content_type,
        "data": base64_content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.files.insert_one(file_doc)
    
    # Return a data URL for immediate use
    data_url = f"data:{file.content_type};base64,{base64_content}"
    
    return {
        "file_id": file_doc["file_id"],
        "url": data_url,
        "filename": file.filename
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
