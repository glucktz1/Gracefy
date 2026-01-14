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

# ============== REVENUE SETTINGS MANAGEMENT ==============

@api_router.get("/revenue/settings")
async def get_revenue_settings():
    """Get current revenue settings"""
    settings = await db.revenue_settings.find_one(
        {}, 
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    if not settings:
        # Return default settings
        return {
            "premium_rate_per_hour": 10.0,
            "standard_rate_per_hour": 5.0,
            "platform_share_percentage": 30.0,
            "minimum_withdrawal": 10000.0,
            "effective_from": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
    return settings

@api_router.post("/revenue/settings")
async def update_revenue_settings(settings: dict):
    """Update revenue settings (admin only)"""
    settings_obj = RevenueSettings(**settings)
    doc = settings_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["effective_from"] = settings.get("effective_from", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    await db.revenue_settings.insert_one(doc)
    return {"settings_id": doc["settings_id"], "message": "Settings updated successfully"}

@api_router.get("/revenue/settings/history")
async def get_revenue_settings_history():
    """Get history of revenue settings changes"""
    settings = await db.revenue_settings.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"settings": settings}

# ============== LISTENING SESSIONS (for tracking) ==============

@api_router.post("/listening/start")
async def start_listening_session(data: dict):
    """Start a listening session when user plays a song"""
    song_id = data.get("song_id")
    user_id = data.get("user_id", "anonymous")
    
    # Get song and album info
    song = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    album = await db.albums.find_one({"album_id": song["album_id"]}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    now = datetime.now(timezone.utc)
    session = ListeningSession(
        user_id=user_id,
        song_id=song_id,
        album_id=song["album_id"],
        choir_id=album.get("artist_id", ""),
        content_type=album.get("monetization_type", "standard"),
        start_time=now.isoformat(),
        date=now.strftime("%Y-%m-%d"),
        month=now.strftime("%Y-%m")
    )
    doc = session.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.listening_sessions.insert_one(doc)
    
    # Increment play count
    await db.songs.update_one({"song_id": song_id}, {"$inc": {"plays": 1}})
    
    return {"session_id": doc["session_id"]}

@api_router.post("/listening/end")
async def end_listening_session(data: dict):
    """End a listening session and calculate duration"""
    session_id = data.get("session_id")
    
    session = await db.listening_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    now = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(session["start_time"].replace("Z", "+00:00"))
    duration_seconds = int((now - start_time).total_seconds())
    duration_hours = duration_seconds / 3600
    
    await db.listening_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "end_time": now.isoformat(),
            "duration_seconds": duration_seconds,
            "duration_hours": duration_hours
        }}
    )
    
    return {"duration_seconds": duration_seconds, "duration_hours": round(duration_hours, 4)}

# ============== ADMIN REVENUE ANALYTICS ==============

@api_router.get("/revenue/admin/overview")
async def get_admin_revenue_overview():
    """Get platform-wide revenue overview for admin"""
    # Get current settings
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Aggregate listening data
    pipeline = [
        {"$group": {
            "_id": "$content_type",
            "total_hours": {"$sum": "$duration_hours"},
            "total_sessions": {"$sum": 1}
        }}
    ]
    listening_stats = await db.listening_sessions.aggregate(pipeline).to_list(10)
    
    premium_hours = 0
    standard_hours = 0
    total_sessions = 0
    
    for stat in listening_stats:
        if stat["_id"] == "premium":
            premium_hours = stat["total_hours"]
        else:
            standard_hours = stat["total_hours"]
        total_sessions += stat["total_sessions"]
    
    total_hours = premium_hours + standard_hours
    
    # Calculate revenues
    premium_revenue = premium_hours * settings["premium_rate_per_hour"]
    standard_revenue = standard_hours * settings["standard_rate_per_hour"]
    gross_revenue = premium_revenue + standard_revenue
    platform_share = gross_revenue * (settings["platform_share_percentage"] / 100)
    choir_payouts = gross_revenue - platform_share
    
    # Get unique days with activity
    active_days_pipeline = [
        {"$group": {"_id": "$date"}},
        {"$count": "days"}
    ]
    active_days_result = await db.listening_sessions.aggregate(active_days_pipeline).to_list(1)
    active_days = active_days_result[0]["days"] if active_days_result else 1
    
    # Top performing choirs
    choir_pipeline = [
        {"$group": {
            "_id": "$choir_id",
            "total_hours": {"$sum": "$duration_hours"},
            "total_plays": {"$sum": 1}
        }},
        {"$sort": {"total_hours": -1}},
        {"$limit": 5}
    ]
    top_choirs_data = await db.listening_sessions.aggregate(choir_pipeline).to_list(5)
    
    # Enrich with choir names
    top_choirs = []
    for choir in top_choirs_data:
        singer = await db.singers.find_one({"singer_id": choir["_id"]}, {"_id": 0})
        if singer:
            choir_revenue = choir["total_hours"] * settings["standard_rate_per_hour"]
            top_choirs.append({
                "choir_id": choir["_id"],
                "name": singer["name"],
                "total_hours": round(choir["total_hours"], 2),
                "total_plays": choir["total_plays"],
                "revenue": round(choir_revenue, 2)
            })
    
    # Top performing albums
    album_pipeline = [
        {"$group": {
            "_id": "$album_id",
            "total_hours": {"$sum": "$duration_hours"},
            "total_plays": {"$sum": 1}
        }},
        {"$sort": {"total_hours": -1}},
        {"$limit": 5}
    ]
    top_albums_data = await db.listening_sessions.aggregate(album_pipeline).to_list(5)
    
    top_albums = []
    for album_data in top_albums_data:
        album = await db.albums.find_one({"album_id": album_data["_id"]}, {"_id": 0})
        if album:
            top_albums.append({
                "album_id": album_data["_id"],
                "title": album["title"],
                "artist": album.get("artist_name", "Unknown"),
                "total_hours": round(album_data["total_hours"], 2),
                "total_plays": album_data["total_plays"]
            })
    
    return {
        "summary": {
            "total_listening_hours": round(total_hours, 2),
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "total_sessions": total_sessions,
            "gross_revenue": round(gross_revenue, 2),
            "platform_earnings": round(platform_share, 2),
            "choir_payouts": round(choir_payouts, 2),
            "avg_earning_per_hour": round(platform_share / max(total_hours, 1), 2),
            "avg_earning_per_day": round(platform_share / max(active_days, 1), 2),
            "active_days": active_days
        },
        "rates": {
            "premium_rate": settings["premium_rate_per_hour"],
            "standard_rate": settings["standard_rate_per_hour"],
            "platform_share": settings["platform_share_percentage"]
        },
        "top_choirs": top_choirs,
        "top_albums": top_albums
    }

@api_router.get("/revenue/admin/daily")
async def get_admin_daily_revenue(days: int = 30):
    """Get daily revenue breakdown for admin"""
    # Get listening data grouped by date
    pipeline = [
        {"$group": {
            "_id": {"date": "$date", "type": "$content_type"},
            "hours": {"$sum": "$duration_hours"},
            "plays": {"$sum": 1}
        }},
        {"$sort": {"_id.date": -1}},
        {"$limit": days * 2}  # Account for premium + standard per day
    ]
    
    daily_data = await db.listening_sessions.aggregate(pipeline).to_list(days * 2)
    
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Organize by date
    by_date = {}
    for item in daily_data:
        date = item["_id"]["date"]
        if date not in by_date:
            by_date[date] = {"date": date, "premium_hours": 0, "standard_hours": 0, "plays": 0}
        
        if item["_id"]["type"] == "premium":
            by_date[date]["premium_hours"] = round(item["hours"], 2)
        else:
            by_date[date]["standard_hours"] = round(item["hours"], 2)
        by_date[date]["plays"] += item["plays"]
    
    # Calculate revenue for each day
    result = []
    for date, data in sorted(by_date.items(), reverse=True)[:days]:
        revenue = (data["premium_hours"] * settings["premium_rate_per_hour"] + 
                   data["standard_hours"] * settings["standard_rate_per_hour"])
        result.append({
            **data,
            "total_hours": round(data["premium_hours"] + data["standard_hours"], 2),
            "revenue": round(revenue, 2)
        })
    
    return {"daily_data": result}

@api_router.get("/revenue/admin/choirs")
async def get_all_choirs_revenue():
    """Get revenue breakdown for all choirs (admin view)"""
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Get all singers/choirs
    singers = await db.singers.find({}, {"_id": 0}).to_list(100)
    
    choir_revenues = []
    for singer in singers:
        # Get listening stats for this choir
        pipeline = [
            {"$match": {"choir_id": singer["singer_id"]}},
            {"$group": {
                "_id": "$content_type",
                "hours": {"$sum": "$duration_hours"},
                "plays": {"$sum": 1}
            }}
        ]
        stats = await db.listening_sessions.aggregate(pipeline).to_list(10)
        
        premium_hours = 0
        standard_hours = 0
        total_plays = 0
        
        for stat in stats:
            if stat["_id"] == "premium":
                premium_hours = stat["hours"]
            else:
                standard_hours = stat["hours"]
            total_plays += stat["plays"]
        
        gross = (premium_hours * settings["premium_rate_per_hour"] + 
                 standard_hours * settings["standard_rate_per_hour"])
        platform_share = gross * (settings["platform_share_percentage"] / 100)
        net = gross - platform_share
        
        # Get choir account balance
        account = await db.choir_accounts.find_one({"choir_id": singer["singer_id"]}, {"_id": 0})
        
        choir_revenues.append({
            "choir_id": singer["singer_id"],
            "name": singer["name"],
            "type": singer["type"],
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "total_hours": round(premium_hours + standard_hours, 2),
            "total_plays": total_plays,
            "gross_revenue": round(gross, 2),
            "platform_share": round(platform_share, 2),
            "net_revenue": round(net, 2),
            "current_balance": account["current_balance"] if account else 0,
            "account_status": account["status"] if account else "no_account"
        })
    
    # Sort by net revenue
    choir_revenues.sort(key=lambda x: x["net_revenue"], reverse=True)
    
    return {"choirs": choir_revenues}

# ============== CHOIR ACCOUNT MANAGEMENT ==============

@api_router.post("/choir/account/create")
async def create_choir_account(data: dict):
    """Create account for a choir (admin creates, choir gets credentials)"""
    import hashlib
    
    choir_id = data.get("choir_id")
    email = data.get("email")
    password = data.get("password")
    
    # Check if choir exists
    singer = await db.singers.find_one({"singer_id": choir_id}, {"_id": 0})
    if not singer:
        raise HTTPException(status_code=404, detail="Choir not found")
    
    # Check if account already exists
    existing = await db.choir_accounts.find_one({"choir_id": choir_id})
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists for this choir")
    
    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = ChoirAccount(
        choir_id=choir_id,
        choir_name=singer["name"],
        email=email,
        password_hash=password_hash,
        status="approved"  # Admin-created accounts are auto-approved
    )
    doc = account.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.choir_accounts.insert_one(doc)
    
    return {"account_id": doc["account_id"], "message": "Choir account created successfully"}

@api_router.post("/choir/login")
async def choir_login(data: dict, response: Response):
    """Choir login endpoint"""
    import hashlib
    
    email = data.get("email")
    password = data.get("password")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    account = await db.choir_accounts.find_one({
        "email": email,
        "password_hash": password_hash
    }, {"_id": 0})
    
    if not account:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if account["status"] != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    
    # Create session
    session_token = f"choir_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "account_id": account["account_id"],
        "choir_id": account["choir_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.choir_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="choir_session",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {
        "choir_id": account["choir_id"],
        "choir_name": account["choir_name"],
        "email": account["email"],
        "session_token": session_token
    }

@api_router.get("/choir/me")
async def get_choir_profile(request: Request):
    """Get current choir profile"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    account = await db.choir_accounts.find_one({"account_id": session["account_id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    return {
        "choir_id": account["choir_id"],
        "choir_name": account["choir_name"],
        "email": account["email"],
        "current_balance": account["current_balance"],
        "total_earned": account["total_earned"],
        "total_withdrawn": account["total_withdrawn"],
        "status": account["status"]
    }

@api_router.post("/choir/logout")
async def choir_logout(request: Request, response: Response):
    """Choir logout"""
    session_token = request.cookies.get("choir_session")
    if session_token:
        await db.choir_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="choir_session", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/choir/accounts")
async def get_all_choir_accounts():
    """Get all choir accounts (admin view)"""
    accounts = await db.choir_accounts.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"accounts": accounts}

@api_router.put("/choir/account/{account_id}")
async def update_choir_account(account_id: str, updates: dict):
    """Update choir account status (admin)"""
    updates.pop("_id", None)
    updates.pop("account_id", None)
    updates.pop("password_hash", None)
    
    result = await db.choir_accounts.update_one({"account_id": account_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account updated"}

# ============== CHOIR REVENUE ANALYTICS ==============

@api_router.get("/choir/revenue/{choir_id}")
async def get_choir_revenue(choir_id: str):
    """Get revenue analytics for a specific choir"""
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Get overall stats
    pipeline = [
        {"$match": {"choir_id": choir_id}},
        {"$group": {
            "_id": "$content_type",
            "hours": {"$sum": "$duration_hours"},
            "plays": {"$sum": 1}
        }}
    ]
    stats = await db.listening_sessions.aggregate(pipeline).to_list(10)
    
    premium_hours = 0
    standard_hours = 0
    total_plays = 0
    
    for stat in stats:
        if stat["_id"] == "premium":
            premium_hours = stat["hours"]
        else:
            standard_hours = stat["hours"]
        total_plays += stat["plays"]
    
    gross = (premium_hours * settings["premium_rate_per_hour"] + 
             standard_hours * settings["standard_rate_per_hour"])
    platform_share = gross * (settings["platform_share_percentage"] / 100)
    net = gross - platform_share
    
    # Get account info
    account = await db.choir_accounts.find_one({"choir_id": choir_id}, {"_id": 0, "password_hash": 0})
    
    # Get album performance
    album_pipeline = [
        {"$match": {"choir_id": choir_id}},
        {"$group": {
            "_id": "$album_id",
            "premium_hours": {"$sum": {"$cond": [{"$eq": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "standard_hours": {"$sum": {"$cond": [{"$ne": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "total_plays": {"$sum": 1}
        }},
        {"$sort": {"total_plays": -1}}
    ]
    album_stats = await db.listening_sessions.aggregate(album_pipeline).to_list(50)
    
    albums_performance = []
    for album_stat in album_stats:
        album = await db.albums.find_one({"album_id": album_stat["_id"]}, {"_id": 0})
        if album:
            album_revenue = (album_stat["premium_hours"] * settings["premium_rate_per_hour"] + 
                           album_stat["standard_hours"] * settings["standard_rate_per_hour"])
            albums_performance.append({
                "album_id": album_stat["_id"],
                "title": album["title"],
                "monetization_type": album.get("monetization_type", "standard"),
                "premium_hours": round(album_stat["premium_hours"], 2),
                "standard_hours": round(album_stat["standard_hours"], 2),
                "total_hours": round(album_stat["premium_hours"] + album_stat["standard_hours"], 2),
                "total_plays": album_stat["total_plays"],
                "revenue": round(album_revenue, 2),
                "revenue_percentage": round((album_revenue / max(gross, 1)) * 100, 1)
            })
    
    # Monthly breakdown
    monthly_pipeline = [
        {"$match": {"choir_id": choir_id}},
        {"$group": {
            "_id": "$month",
            "premium_hours": {"$sum": {"$cond": [{"$eq": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "standard_hours": {"$sum": {"$cond": [{"$ne": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "plays": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}},
        {"$limit": 12}
    ]
    monthly_data = await db.listening_sessions.aggregate(monthly_pipeline).to_list(12)
    
    monthly_revenue = []
    for month in monthly_data:
        month_gross = (month["premium_hours"] * settings["premium_rate_per_hour"] + 
                      month["standard_hours"] * settings["standard_rate_per_hour"])
        month_net = month_gross * (1 - settings["platform_share_percentage"] / 100)
        monthly_revenue.append({
            "month": month["_id"],
            "premium_hours": round(month["premium_hours"], 2),
            "standard_hours": round(month["standard_hours"], 2),
            "plays": month["plays"],
            "gross_revenue": round(month_gross, 2),
            "net_revenue": round(month_net, 2)
        })
    
    return {
        "summary": {
            "total_hours": round(premium_hours + standard_hours, 2),
            "premium_hours": round(premium_hours, 2),
            "standard_hours": round(standard_hours, 2),
            "total_plays": total_plays,
            "gross_revenue": round(gross, 2),
            "platform_share": round(platform_share, 2),
            "net_revenue": round(net, 2),
            "current_balance": account["current_balance"] if account else 0,
            "total_withdrawn": account["total_withdrawn"] if account else 0
        },
        "rates": {
            "premium_rate": settings["premium_rate_per_hour"],
            "standard_rate": settings["standard_rate_per_hour"],
            "platform_share": settings["platform_share_percentage"]
        },
        "albums": albums_performance,
        "monthly": monthly_revenue
    }

# ============== WITHDRAWAL REQUESTS ==============

@api_router.post("/withdrawal/request")
async def create_withdrawal_request(data: dict, request: Request):
    """Create a withdrawal request (choir)"""
    # Get choir from session
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    account = await db.choir_accounts.find_one({"account_id": session["account_id"]}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    amount = data.get("amount", 0)
    
    # Get minimum withdrawal
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    min_withdrawal = settings.get("minimum_withdrawal", 10000) if settings else 10000
    
    if amount < min_withdrawal:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is TZS {min_withdrawal}")
    
    if amount > account["current_balance"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    withdrawal = WithdrawalRequest(
        choir_id=account["choir_id"],
        choir_name=account["choir_name"],
        amount=amount,
        payment_method=data.get("payment_method", "mobile_money"),
        payment_details=data.get("payment_details", {})
    )
    doc = withdrawal.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.withdrawal_requests.insert_one(doc)
    
    return {"request_id": doc["request_id"], "message": "Withdrawal request submitted"}

@api_router.get("/withdrawal/requests")
async def get_withdrawal_requests(status: Optional[str] = None):
    """Get all withdrawal requests (admin)"""
    query = {}
    if status:
        query["status"] = status
    requests = await db.withdrawal_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests}

@api_router.get("/withdrawal/my-requests")
async def get_my_withdrawal_requests(request: Request):
    """Get withdrawal requests for current choir"""
    session_token = request.cookies.get("choir_session")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.choir_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    requests = await db.withdrawal_requests.find(
        {"choir_id": session["choir_id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"requests": requests}

@api_router.put("/withdrawal/{request_id}")
async def process_withdrawal(request_id: str, data: dict):
    """Process withdrawal request (admin)"""
    status = data.get("status")  # approved, rejected, completed
    admin_notes = data.get("admin_notes", "")
    processed_by = data.get("processed_by", "admin")
    
    withdrawal = await db.withdrawal_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Request not found")
    
    updates = {
        "status": status,
        "admin_notes": admin_notes,
        "processed_by": processed_by,
        "processed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.withdrawal_requests.update_one({"request_id": request_id}, {"$set": updates})
    
    # If completed, update choir account balance
    if status == "completed":
        await db.choir_accounts.update_one(
            {"choir_id": withdrawal["choir_id"]},
            {
                "$inc": {
                    "current_balance": -withdrawal["amount"],
                    "total_withdrawn": withdrawal["amount"]
                }
            }
        )
    
    return {"message": f"Withdrawal request {status}"}

# ============== SIMULATE LISTENING DATA (for demo) ==============

@api_router.post("/demo/generate-listening-data")
async def generate_demo_listening_data():
    """Generate demo listening data for testing analytics"""
    import random
    
    # Get all albums and songs
    albums = await db.albums.find({}, {"_id": 0}).to_list(100)
    
    if not albums:
        return {"message": "No albums found. Create some albums first."}
    
    generated = 0
    now = datetime.now(timezone.utc)
    
    for album in albums:
        songs = await db.songs.find({"album_id": album["album_id"]}, {"_id": 0}).to_list(50)
        
        # Generate random listening sessions for the past 30 days
        for day_offset in range(30):
            date = now - timedelta(days=day_offset)
            num_sessions = random.randint(5, 50)
            
            for _ in range(num_sessions):
                song = random.choice(songs) if songs else None
                if not song:
                    continue
                
                duration_seconds = random.randint(60, 600)  # 1-10 minutes
                duration_hours = duration_seconds / 3600
                
                session = {
                    "session_id": f"listen_{uuid.uuid4().hex[:12]}",
                    "user_id": f"user_{random.randint(1, 100)}",
                    "song_id": song["song_id"],
                    "album_id": album["album_id"],
                    "choir_id": album.get("artist_id", ""),
                    "content_type": album.get("monetization_type", "standard"),
                    "start_time": date.isoformat(),
                    "end_time": (date + timedelta(seconds=duration_seconds)).isoformat(),
                    "duration_seconds": duration_seconds,
                    "duration_hours": duration_hours,
                    "date": date.strftime("%Y-%m-%d"),
                    "month": date.strftime("%Y-%m"),
                    "created_at": date.isoformat()
                }
                await db.listening_sessions.insert_one(session)
                generated += 1
                
                # Update song plays
                await db.songs.update_one({"song_id": song["song_id"]}, {"$inc": {"plays": 1}})
    
    # Update choir account balances based on new data
    settings = await db.revenue_settings.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    if not settings:
        settings = {"premium_rate_per_hour": 10.0, "standard_rate_per_hour": 5.0, "platform_share_percentage": 30.0}
    
    # Calculate and update choir balances
    choir_pipeline = [
        {"$group": {
            "_id": "$choir_id",
            "premium_hours": {"$sum": {"$cond": [{"$eq": ["$content_type", "premium"]}, "$duration_hours", 0]}},
            "standard_hours": {"$sum": {"$cond": [{"$ne": ["$content_type", "premium"]}, "$duration_hours", 0]}}
        }}
    ]
    choir_stats = await db.listening_sessions.aggregate(choir_pipeline).to_list(100)
    
    for choir in choir_stats:
        if not choir["_id"]:
            continue
        gross = (choir["premium_hours"] * settings["premium_rate_per_hour"] + 
                 choir["standard_hours"] * settings["standard_rate_per_hour"])
        net = gross * (1 - settings["platform_share_percentage"] / 100)
        
        await db.choir_accounts.update_one(
            {"choir_id": choir["_id"]},
            {"$set": {"current_balance": round(net, 2), "total_earned": round(net, 2)}}
        )
    
    return {"message": f"Generated {generated} listening sessions"}

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
