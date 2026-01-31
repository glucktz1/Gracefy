"""
Music routes for Gracefy - Albums, Songs, Streaming.
Optimized for high traffic with caching and efficient queries.
"""

from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional, List
import logging

from core.database import get_db
from core.cache import cache, cached, invalidate_albums_cache, invalidate_songs_cache
from models.schemas import Album, Song

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["music"])

# Optimized projections for list queries (exclude large fields)
ALBUM_LIST_PROJECTION = {
    "_id": 0,
    "album_id": 1,
    "title": 1,
    "description": 1,
    "artist_id": 1,
    "artist_name": 1,
    "category_id": 1,
    "category_name": 1,
    "thumbnail": 1,
    "release_date": 1,
    "monetization_type": 1,
    "status": 1,
    "songs_count": 1,
    "total_plays": 1,
    "created_at": 1
}

SONG_LIST_PROJECTION = {
    "_id": 0,
    "song_id": 1,
    "title": 1,
    "album_id": 1,
    "duration": 1,
    "duration_formatted": 1,
    "audio_url": 1,
    "track_number": 1,
    "plays": 1,
    "likes": 1,
    "status": 1,
    "song_categories": 1,
    "song_category_names": 1,
}


def optimize_thumbnails(items: list) -> list:
    """
    Optimize thumbnails by converting large base64 data to streaming URLs.
    CDN URLs are kept as-is, base64 thumbnails are converted to streaming endpoint.
    """
    for item in items:
        thumb = item.get("thumbnail", "")
        if isinstance(thumb, str) and thumb.startswith("data:image"):
            # For base64 thumbnails, use the thumbnail streaming endpoint instead
            # This avoids sending large base64 data in list responses
            item_id = item.get("album_id") or item.get("song_id") or item.get("mix_id") or item.get("container_id")
            if item_id:
                item["thumbnail"] = f"/api/thumbnails/{item_id}"
                item["thumbnail_type"] = "streaming"
            else:
                # Keep full base64 if no ID to create streaming URL
                item["thumbnail_type"] = "base64"
        elif isinstance(thumb, str) and (thumb.startswith("http") or thumb.startswith("/")):
            item["thumbnail_type"] = "url"
    return items


# ============== ALBUMS ==============

@router.get("/albums")
async def get_albums(
    category_id: Optional[str] = None,
    artist_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    include_inactive: bool = Query(False)
):
    """Get albums with pagination. Cached for 2 minutes."""
    db = get_db()
    
    # Try cache first
    cache_key = f"albums:list:{category_id}:{artist_id}:{skip}:{limit}:{include_inactive}"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # Build query
    query = {}
    if not include_inactive:
        query["status"] = "active"
    if category_id:
        query["category_id"] = category_id
    if artist_id:
        query["artist_id"] = artist_id
    
    # Execute query with pagination
    cursor = db.albums.find(query, ALBUM_LIST_PROJECTION)
    cursor = cursor.sort("created_at", -1).skip(skip).limit(limit)
    
    # Run count and fetch in parallel for better performance
    albums = await cursor.to_list(limit)
    total = await db.albums.count_documents(query)
    
    albums = optimize_thumbnails(albums)
    
    result = {
        "albums": albums,
        "total": total,
        "skip": skip,
        "limit": limit
    }
    
    # Cache for 2 minutes
    await cache.set(cache_key, result, 120)
    
    return result


@router.get("/albums/all-songs")
async def get_albums_with_songs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """
    Get all albums with their songs.
    Used by Special Mixes page to select songs.
    """
    db = get_db()
    
    # Cache key
    cache_key = f"albums:with_songs:{skip}:{limit}"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # Get albums with status active or not specified
    albums = await db.albums.find(
        {"$or": [{"status": "active"}, {"status": {"$exists": False}}]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get songs for each album
    for album in albums:
        songs = await db.songs.find(
            {"album_id": album["album_id"], "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
            {"_id": 0}
        ).to_list(100)
        album["songs"] = songs
    
    # Optimize thumbnails
    albums = optimize_thumbnails(albums)
    
    result = {
        "albums": albums,
        "total": len(albums)
    }
    
    # Cache for 2 minutes
    await cache.set(cache_key, result, 120)
    
    return result


@router.get("/albums/songs-by-category")
async def get_albums_with_songs_by_category(
    song_category_id: str = Query(..., description="Song category ID to filter by"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500)
):
    """Get albums with songs filtered by song category (Christmas, Easter, etc.)"""
    db = get_db()
    
    cache_key = f"albums:by_song_category:{song_category_id}:{skip}:{limit}"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # Get all songs in this category
    songs_in_category = await db.songs.find(
        {"song_categories": song_category_id, "$or": [{"status": "active"}, {"status": {"$exists": False}}]},
        {"_id": 0}
    ).to_list(500)
    
    # Get unique album IDs
    album_ids = list(set(s.get("album_id") for s in songs_in_category if s.get("album_id")))
    
    # Get albums
    albums = await db.albums.find(
        {"album_id": {"$in": album_ids}},
        {"_id": 0}
    ).to_list(limit)
    
    # Add songs to each album
    for album in albums:
        album["songs"] = [s for s in songs_in_category if s.get("album_id") == album.get("album_id")]
    
    # Optimize thumbnails
    albums = optimize_thumbnails(albums)
    
    # Get category info
    category = await db.song_categories.find_one(
        {"song_category_id": song_category_id},
        {"_id": 0}
    )
    
    result = {
        "category": category,
        "albums": albums,
        "total": len(albums)
    }
    
    await cache.set(cache_key, result, 120)
    
    return result


@router.get("/albums/{album_id}")
async def get_album(album_id: str):
    """Get single album with songs. Cached for 5 minutes."""
    db = get_db()
    
    # Try cache
    cache_key = f"album_detail:{album_id}"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return cached_result
    
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Get active songs sorted by track number
    songs = await db.songs.find(
        {"album_id": album_id, "status": "active"},
        SONG_LIST_PROJECTION
    ).sort("track_number", 1).to_list(100)
    
    result = {"album": album, "songs": songs}
    
    # Cache for 5 minutes
    await cache.set(cache_key, result, 300)
    
    return result


# ============== SONGS ==============

@router.get("/songs")
async def get_songs(
    album_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get songs with pagination."""
    db = get_db()
    
    query = {"status": "active"}
    if album_id:
        query["album_id"] = album_id
    
    songs = await db.songs.find(query, SONG_LIST_PROJECTION)\
        .sort("track_number", 1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.songs.count_documents(query)
    
    return {"songs": songs, "total": total, "skip": skip, "limit": limit}


@router.post("/albums")
async def create_album(album: dict):
    """Create a new album."""
    db = get_db()
    
    album_obj = Album(**album)
    doc = album_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.albums.insert_one(doc)
    await invalidate_albums_cache()
    
    return {"album_id": doc["album_id"], "message": "Album created successfully"}


@router.put("/albums/{album_id}")
async def update_album(album_id: str, updates: dict):
    """Update album."""
    db = get_db()
    
    updates.pop("_id", None)
    updates.pop("album_id", None)
    
    result = await db.albums.update_one({"album_id": album_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    
    await invalidate_albums_cache(album_id)
    
    return {"message": "Album updated successfully"}


@router.delete("/albums/{album_id}")
async def delete_album(album_id: str):
    """Delete album and its songs."""
    db = get_db()
    
    await db.songs.delete_many({"album_id": album_id})
    result = await db.albums.delete_one({"album_id": album_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    
    await invalidate_albums_cache()
    
    return {"message": "Album and songs deleted successfully"}


@router.post("/songs")
async def create_song(song: dict):
    """Create a new song."""
    db = get_db()
    
    song_obj = Song(**song)
    doc = song_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.songs.insert_one(doc)
    
    # Update album song count
    await db.albums.update_one(
        {"album_id": doc["album_id"]},
        {"$inc": {"songs_count": 1}}
    )
    
    await invalidate_songs_cache()
    await invalidate_albums_cache(doc["album_id"])
    
    return {"song_id": doc["song_id"], "message": "Song created successfully"}


@router.put("/songs/{song_id}")
async def update_song(song_id: str, updates: dict):
    """Update song."""
    db = get_db()
    
    updates.pop("_id", None)
    updates.pop("song_id", None)
    
    result = await db.songs.update_one({"song_id": song_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    
    await invalidate_songs_cache(song_id)
    
    return {"message": "Song updated successfully"}


@router.delete("/songs/{song_id}")
async def delete_song(song_id: str):
    """Delete song."""
    db = get_db()
    
    song = await db.songs.find_one({"song_id": song_id})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    await db.songs.delete_one({"song_id": song_id})
    
    # Update album song count
    if song.get("album_id"):
        await db.albums.update_one(
            {"album_id": song["album_id"]},
            {"$inc": {"songs_count": -1}}
        )
    
    await invalidate_songs_cache()
    
    return {"message": "Song deleted successfully"}
