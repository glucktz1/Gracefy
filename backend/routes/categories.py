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
    """Get all content categories. Cached 5 minutes (categories rarely change)."""
    db = get_db()
    
    cache_key = f"categories:list:{type}:{status}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
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
    
    result = {"categories": categories}
    await cache.set(cache_key, result, 300)
    return result


@router.get("/categories/{category_id}")
async def get_category(category_id: str):
    """Get single category"""
    db = get_db()
    
    category = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return category


@router.get("/categories/{category_id}/content")
async def get_category_content(category_id: str, limit: int = Query(50)):
    """Get all songs and albums in a category"""
    db = get_db()
    
    category = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Get albums in this category
    albums = await db.albums.find(
        {"categories": category_id, "status": "published"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get songs in this category (either directly or via album)
    album_ids = [a.get("album_id") for a in albums if a.get("album_id")]
    songs = await db.songs.find(
        {
            "$or": [
                {"categories": category_id},
                {"album_id": {"$in": album_ids}}
            ],
            "status": "published"
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "category": category,
        "songs": songs,
        "albums": albums,
        "total_songs": len(songs),
        "total_albums": len(albums)
    }


@router.get("/category/{category_id}/all-songs")
async def get_all_songs_in_category(category_id: str, limit: int = Query(200, ge=1, le=500)):
    """
    Spotify-style "category page" payload — every song that belongs to any
    album in this category, enriched with the album's thumbnail/title so the
    client can render a clean list and "Play All".

    Always tries to return at least one representative cover so the Quick
    Access card has a thumbnail even if the category record has none.
    """
    db = get_db()

    # Categories live in two collections depending on type:
    # `song_categories` for song-style cats (songcat_*) used by albums via
    # the `category_id` field, and `categories` for content categories.
    category = None
    if category_id.startswith("songcat_"):
        category = await db.song_categories.find_one(
            {"song_category_id": category_id}, {"_id": 0}
        )
    if not category:
        category = await db.categories.find_one({"category_id": category_id}, {"_id": 0})
    if not category:
        # Last-ditch: fall back to song_categories regardless of prefix
        category = await db.song_categories.find_one(
            {"song_category_id": category_id}, {"_id": 0}
        )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Cache by category id — songs in a category don't churn often.
    cache_key = f"category:all_songs:{category_id}:{limit}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # Albums in this category. The data model uses `category_id` (singular)
    # on albums and the value matches the song_category_id. Status is `active`.
    albums = await db.albums.find(
        {"category_id": category_id, "status": "active"},
        {"_id": 0, "album_id": 1, "title": 1, "thumbnail": 1, "artist_name": 1}
    ).sort("created_at", -1).to_list(500)

    album_ids = [a["album_id"] for a in albums if a.get("album_id")]
    albums_map = {a["album_id"]: a for a in albums}

    # Songs in this category come from TWO sources:
    #   1. Any song inside an album tagged with this category (album.category_id).
    #   2. Songs DIRECTLY tagged via songs.song_categories (a per-song list).
    # We union both so the page shows EVERY relevant song, no matter how the
    # admin tagged it.
    song_filters = []
    if album_ids:
        song_filters.append({"album_id": {"$in": album_ids}})
    song_filters.append({"song_categories": category_id})

    songs = await db.songs.find(
        {"$or": song_filters, "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    # If any of the union'd songs reference albums we haven't loaded yet, pull
    # their metadata too so thumbnails/titles still appear in the list.
    extra_album_ids = list({s.get("album_id") for s in songs if s.get("album_id") and s.get("album_id") not in albums_map})
    if extra_album_ids:
        extra_albums = await db.albums.find(
            {"album_id": {"$in": extra_album_ids}},
            {"_id": 0, "album_id": 1, "title": 1, "thumbnail": 1, "artist_name": 1}
        ).to_list(len(extra_album_ids))
        for a in extra_albums:
            albums_map[a["album_id"]] = a

    # Enrich every song with album metadata + a thumbnail fallback so the
    # client never sees a blank card.
    for s in songs:
        aid = s.get("album_id")
        if aid and aid in albums_map:
            a = albums_map[aid]
            if not s.get("thumbnail"):
                s["thumbnail"] = a.get("thumbnail")
            s["album_thumbnail"] = a.get("thumbnail")
            s["album_title"] = a.get("title")
            if not s.get("artist_name"):
                s["artist_name"] = a.get("artist_name")

    # Pick a representative thumbnail for the category card:
    # explicit category.thumbnail → first album with a thumbnail → first song
    cover = category.get("thumbnail")
    if not cover:
        for a in albums:
            if a.get("thumbnail"):
                cover = a["thumbnail"]
                break
    if not cover:
        for s in songs:
            if s.get("thumbnail"):
                cover = s["thumbnail"]
                break

    # Filter out songs without any playable source so "Play All" never trips
    playable = [
        s for s in songs
        if (s.get("audio_url") and s["audio_url"].strip())
        or (s.get("hls_url") and s["hls_url"].strip())
    ]

    # Normalize a `category_id` field on the response so the client doesn't
    # need to care whether it came from `categories` or `song_categories`.
    cat_out = dict(category)
    cat_out["category_id"] = category.get("category_id") or category.get("song_category_id") or category_id

    result = {
        "category": cat_out,
        "cover": cover,
        "songs": playable,
        "total_songs": len(playable),
        "total_albums": len(albums),
    }
    await cache.set(cache_key, result, 120)
    return result


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
async def get_song_categories(with_counts: bool = False):
    """Get all song categories.

    Pass `with_counts=true` to include `total_songs` on each category — used by
    the Quick Access tile badge so users see availability before tapping in.
    Counts come from BOTH album.category_id and songs.song_categories so the
    badge matches what /category/{id}/all-songs would actually return.
    """
    db = get_db()

    cache_key = f"song_categories:list:{'wc' if with_counts else 'nc'}"
    cached = await cache.get(cache_key)
    if cached:
        return cached

    categories = await db.song_categories.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(50)

    if with_counts and categories:
        cat_ids = [c.get("song_category_id") for c in categories if c.get("song_category_id")]

        # Build {cat_id -> [album_ids]} in one pass
        albums = await db.albums.find(
            {"category_id": {"$in": cat_ids}, "status": "active"},
            {"_id": 0, "album_id": 1, "category_id": 1}
        ).to_list(2000)
        albums_by_cat = {}
        for a in albums:
            albums_by_cat.setdefault(a["category_id"], []).append(a["album_id"])

        # Count songs per category (album_id OR song_categories membership)
        # and aggregate `plays` across those songs so we can sort by "most
        # streamed" — used by the Quick Access grid to surface the top-3 hot
        # categories on both web and mobile.
        for c in categories:
            cid = c.get("song_category_id")
            album_ids = albums_by_cat.get(cid, [])
            or_filters = [{"song_categories": cid}]
            if album_ids:
                or_filters.append({"album_id": {"$in": album_ids}})
            match = {"$or": or_filters, "status": "active"}
            count = await db.songs.count_documents(match)
            plays_agg = await db.songs.aggregate([
                {"$match": match},
                {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$plays", 0]}}}}
            ]).to_list(1)
            c["total_songs"] = count
            c["total_plays"] = (plays_agg[0]["total"] if plays_agg else 0) or 0

        # Sort categories by total_plays DESC so top-streamed float to the
        # top for the Quick Access "top 3" tiles. `sort_order` still applies
        # as a tie-breaker for the admin-curated positioning.
        categories.sort(
            key=lambda c: (-(c.get("total_plays") or 0), c.get("sort_order") or 999)
        )

    result = {"categories": categories}
    # Short cache — counts can change as admins add songs.
    await cache.set(cache_key, result, 60)
    return result


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
