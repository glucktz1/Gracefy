"""
Categories and song categories routes for Gracefy.
Handles content categories and song-specific categories (Christmas, Lent, etc.)
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["categories"])


# Default song categories
DEFAULT_SONG_CATEGORIES = [
    {"name": "Christmas", "name_sw": "Krismas", "color": "#DC2626", "sort_order": 1},
    {"name": "Easter", "name_sw": "Pasaka", "color": "#7C3AED", "sort_order": 2},
    {"name": "Lent", "name_sw": "Kwaresma", "color": "#6366F1", "sort_order": 3},
    {"name": "Pentecost", "name_sw": "Pentekoste", "color": "#EF4444", "sort_order": 4},
    {"name": "Mary", "name_sw": "Bikira Maria", "color": "#3B82F6", "sort_order": 5},
    {"name": "Praise & Worship", "name_sw": "Sifa na Ibada", "color": "#F59E0B", "sort_order": 6},
    {"name": "Mass Songs", "name_sw": "Nyimbo za Misa", "color": "#10B981", "sort_order": 7},
    {"name": "Adoration", "name_sw": "Ibada ya Ekaristia", "color": "#EC4899", "sort_order": 8},
]


# ============== CONTENT CATEGORIES ==============

@router.get("/categories")
async def get_categories(
    type: Optional[str] = None,
    status: Optional[str] = None
):
    """Get all content categories"""
    db = get_db()
    
    query = {}
    if type:
        query["type"] = type
    if status:
        query["status"] = status
    else:
        query["status"] = "active"
    
    categories = await db.categories.find(query, {"_id": 0})\
        .sort("sort_order", 1)\
        .to_list(100)
    
    return {"categories": categories}


@router.get("/categories/{category_id}")
async def get_category(category_id: str):
    """Get single category"""
    db = get_db()
    
    category = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return category


@router.post("/categories")
async def create_category(data: dict):
    """Create a new category"""
    db = get_db()
    
    category = {
        "category_id": f"cat_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "name_sw": data.get("name_sw"),
        "description": data.get("description"),
        "type": data.get("type", "content"),
        "icon": data.get("icon"),
        "thumbnail": data.get("thumbnail"),
        "sort_order": data.get("sort_order", 0),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.categories.insert_one(category)
    category.pop("_id", None)
    
    return category


@router.put("/categories/{category_id}")
async def update_category(category_id: str, data: dict):
    """Update a category"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("category_id", None)
    
    result = await db.categories.update_one(
        {"category_id": category_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category updated"}


@router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    """Delete a category"""
    db = get_db()
    
    result = await db.categories.delete_one({"category_id": category_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category deleted"}


# ============== SONG CATEGORIES ==============

@router.get("/song-categories")
async def get_song_categories():
    """Get all song categories"""
    db = get_db()
    
    categories = await db.song_categories.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    
    return {"categories": categories}


@router.get("/song-categories/all")
async def get_all_song_categories():
    """Get all song categories including inactive"""
    db = get_db()
    
    categories = await db.song_categories.find({}, {"_id": 0})\
        .sort("sort_order", 1)\
        .to_list(100)
    
    return {"categories": categories}


@router.get("/song-categories/{category_id}")
async def get_song_category(category_id: str):
    """Get single song category"""
    db = get_db()
    
    category = await db.song_categories.find_one(
        {"song_category_id": category_id},
        {"_id": 0}
    )
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return category


@router.post("/song-categories")
async def create_song_category(data: dict):
    """Create a new song category"""
    db = get_db()
    
    category = {
        "song_category_id": f"songcat_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "name_sw": data.get("name_sw"),
        "description": data.get("description"),
        "color": data.get("color", "#6366f1"),
        "icon": data.get("icon"),
        "sort_order": data.get("sort_order", 0),
        "is_system": False,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.song_categories.insert_one(category)
    category.pop("_id", None)
    
    return category


@router.put("/song-categories/{category_id}")
async def update_song_category(category_id: str, data: dict):
    """Update a song category"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("song_category_id", None)
    
    result = await db.song_categories.update_one(
        {"song_category_id": category_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category updated"}


@router.delete("/song-categories/{category_id}")
async def delete_song_category(category_id: str):
    """Delete a song category"""
    db = get_db()
    
    # Check if it's a system category
    category = await db.song_categories.find_one({"song_category_id": category_id})
    if category and category.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system category")
    
    result = await db.song_categories.delete_one({"song_category_id": category_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category deleted"}


@router.post("/song-categories/sync-defaults")
async def sync_default_song_categories():
    """Sync default song categories (create if not exists)"""
    db = get_db()
    
    created = 0
    for cat_data in DEFAULT_SONG_CATEGORIES:
        existing = await db.song_categories.find_one({"name": cat_data["name"]})
        if not existing:
            category = {
                "song_category_id": f"songcat_{uuid.uuid4().hex[:12]}",
                **cat_data,
                "is_system": True,
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.song_categories.insert_one(category)
            created += 1
    
    return {"message": f"Synced default categories. Created {created} new."}


# ============== SINGERS (Choirs/Artists) ==============

@router.get("/singers")
async def get_singers(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get all singers/choirs with aggregated stats"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["active", "approved", "pending"]}
    
    singers = await db.singers.find(query, {"_id": 0})\
        .sort("followers_count", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    # Enrich each singer with real album/song/play counts
    for singer in singers:
        singer_id = singer.get("singer_id")
        singer_name = singer.get("name")
        
        # Count albums by this singer (using artist_id or artist_name)
        albums_by_id = await db.albums.count_documents({"artist_id": singer_id, "status": {"$ne": "disabled"}})
        albums_by_name = await db.albums.count_documents({"artist_name": singer_name, "status": {"$ne": "disabled"}}) if singer_name else 0
        singer["albums_count"] = max(albums_by_id, albums_by_name)
        
        # Get all album IDs for this singer
        album_ids = []
        if albums_by_id > 0:
            albums = await db.albums.find({"artist_id": singer_id}, {"album_id": 1}).to_list(100)
            album_ids.extend([a["album_id"] for a in albums])
        if albums_by_name > 0 and singer_name:
            albums = await db.albums.find({"artist_name": singer_name}, {"album_id": 1}).to_list(100)
            album_ids.extend([a["album_id"] for a in albums if a["album_id"] not in album_ids])
        
        # Count songs in those albums
        if album_ids:
            singer["songs_count"] = await db.songs.count_documents({
                "album_id": {"$in": album_ids},
                "status": {"$ne": "disabled_no_audio"}
            })
            
            # Sum total plays from songs
            plays_pipeline = [
                {"$match": {"album_id": {"$in": album_ids}, "status": {"$ne": "disabled_no_audio"}}},
                {"$group": {"_id": None, "total_plays": {"$sum": {"$ifNull": ["$plays", 0]}}}}
            ]
            plays_result = await db.songs.aggregate(plays_pipeline).to_list(1)
            singer["total_plays"] = plays_result[0]["total_plays"] if plays_result else 0
        else:
            singer["songs_count"] = 0
            singer["total_plays"] = 0
    
    total = await db.singers.count_documents(query)
    
    return {"singers": singers, "total": total}


@router.get("/singers/{singer_id}")
async def get_singer(singer_id: str):
    """Get single singer with aggregated stats"""
    db = get_db()
    
    singer = await db.singers.find_one({"singer_id": singer_id}, {"_id": 0})
    if not singer:
        raise HTTPException(status_code=404, detail="Singer not found")
    
    singer_name = singer.get("name")
    
    # Count albums by this singer
    albums_by_id = await db.albums.count_documents({"artist_id": singer_id, "status": {"$ne": "disabled"}})
    albums_by_name = await db.albums.count_documents({"artist_name": singer_name, "status": {"$ne": "disabled"}}) if singer_name else 0
    singer["albums_count"] = max(albums_by_id, albums_by_name)
    
    # Get all album IDs for this singer
    album_ids = []
    if albums_by_id > 0:
        albums = await db.albums.find({"artist_id": singer_id}, {"album_id": 1}).to_list(100)
        album_ids.extend([a["album_id"] for a in albums])
    if albums_by_name > 0 and singer_name:
        albums = await db.albums.find({"artist_name": singer_name}, {"album_id": 1}).to_list(100)
        album_ids.extend([a["album_id"] for a in albums if a["album_id"] not in album_ids])
    
    # Count songs and plays
    if album_ids:
        singer["songs_count"] = await db.songs.count_documents({
            "album_id": {"$in": album_ids},
            "status": {"$ne": "disabled_no_audio"}
        })
        
        # Sum total plays from songs
        plays_pipeline = [
            {"$match": {"album_id": {"$in": album_ids}, "status": {"$ne": "disabled_no_audio"}}},
            {"$group": {"_id": None, "total_plays": {"$sum": {"$ifNull": ["$plays", 0]}}}}
        ]
        plays_result = await db.songs.aggregate(plays_pipeline).to_list(1)
        singer["total_plays"] = plays_result[0]["total_plays"] if plays_result else 0
        
        # Get albums with song counts
        singer["albums"] = []
        for album_id in album_ids[:20]:  # Limit to 20 albums
            album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
            if album:
                # Count songs and plays for this album
                album_songs = await db.songs.count_documents({"album_id": album_id, "status": {"$ne": "disabled_no_audio"}})
                album_plays_result = await db.songs.aggregate([
                    {"$match": {"album_id": album_id, "status": {"$ne": "disabled_no_audio"}}},
                    {"$group": {"_id": None, "plays": {"$sum": {"$ifNull": ["$plays", 0]}}}}
                ]).to_list(1)
                album["songs_count"] = album_songs
                album["total_plays"] = album_plays_result[0]["plays"] if album_plays_result else 0
                singer["albums"].append(album)
    else:
        singer["songs_count"] = 0
        singer["total_plays"] = 0
        singer["albums"] = []
    
    return singer


@router.post("/singers")
async def create_singer(data: dict):
    """Create a new singer"""
    db = get_db()
    
    singer = {
        "singer_id": f"sing_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "type": data.get("type", "choir"),
        "denomination": data.get("denomination"),
        "church_id": data.get("church_id"),
        "church_name": data.get("church_name"),
        "bio": data.get("bio"),
        "thumbnail": data.get("thumbnail"),
        "cover_image": data.get("cover_image"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "followers_count": 0,
        "albums_count": 0,
        "songs_count": 0,
        "total_plays": 0,
        "status": data.get("status", "active"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.singers.insert_one(singer)
    singer.pop("_id", None)
    
    return singer


@router.put("/singers/{singer_id}")
async def update_singer(singer_id: str, data: dict):
    """Update a singer"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("singer_id", None)
    
    result = await db.singers.update_one(
        {"singer_id": singer_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Singer not found")
    
    return {"message": "Singer updated"}


@router.delete("/singers/{singer_id}")
async def delete_singer(singer_id: str):
    """Delete a singer"""
    db = get_db()
    
    result = await db.singers.delete_one({"singer_id": singer_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Singer not found")
    
    return {"message": "Singer deleted"}


# ============== USERS (Admin) ==============

@router.get("/users")
async def get_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get all users"""
    db = get_db()
    
    query = {}
    if role:
        query["role"] = role
    if status:
        query["status"] = status
    
    users = await db.users.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.users.count_documents(query)
    
    return {"users": users, "total": total}


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get single user"""
    db = get_db()
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.post("/users")
async def create_user(data: dict):
    """Create a new user"""
    db = get_db()
    
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": data.get("email"),
        "name": data.get("name"),
        "picture": data.get("picture"),
        "role": data.get("role", "customer"),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    user.pop("_id", None)
    
    return user


@router.put("/users/{user_id}")
async def update_user(user_id: str, data: dict):
    """Update a user"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("user_id", None)
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Delete a user"""
    db = get_db()
    
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}
