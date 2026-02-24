"""
Music routes for Gracefy - Albums, Songs, Streaming.
Optimized for high traffic with caching and efficient queries.
"""

from fastapi import APIRouter, HTTPException, Query, Request
from datetime import datetime, timezone
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
    "tags": 1,
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

@router.get("/songs/{song_id}/download")
async def get_song_download_url(song_id: str):
    """Get download URL for a song"""
    db = get_db()
    
    song = await db.songs.find_one(
        {"song_id": song_id},
        {"_id": 0, "song_id": 1, "title": 1, "audio_url": 1, "file_url": 1}
    )
    
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Get the audio URL
    audio_url = song.get("audio_url") or song.get("file_url")
    
    if not audio_url:
        raise HTTPException(status_code=404, detail="No audio file available for this song")
    
    # Generate a filename
    safe_title = "".join(c if c.isalnum() or c in "._- " else "_" for c in (song.get("title") or "song"))
    filename = f"{safe_title}_{song_id}.mp3"
    
    # If the URL is already an internal file stream path, return it as-is
    # Otherwise return a proxy URL
    if audio_url.startswith('/api/files/'):
        download_url = audio_url
    elif audio_url.startswith('http'):
        # CDN URLs need to be proxied through our stream endpoint
        download_url = f"/api/stream/song/{song_id}"
    else:
        # Unknown format, try the file stream
        download_url = audio_url
    
    return {
        "download_url": download_url,
        "direct_url": audio_url,
        "filename": filename,
        "song_id": song_id
    }


@router.get("/stream/song/{song_id}")
async def stream_song(song_id: str, request: Request):
    """Stream a song file - proxies from CDN to handle access issues"""
    import httpx
    from fastapi.responses import StreamingResponse
    
    db = get_db()
    
    song = await db.songs.find_one(
        {"song_id": song_id},
        {"_id": 0, "audio_url": 1, "file_url": 1, "title": 1}
    )
    
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    audio_url = song.get("audio_url") or song.get("file_url")
    
    if not audio_url:
        raise HTTPException(status_code=404, detail="No audio file available")
    
    # Handle range requests for seeking
    range_header = request.headers.get("Range")
    headers = {
        "User-Agent": "Gracefy-App/1.0",
        "Accept": "audio/mpeg, audio/*, */*"
    }
    
    if range_header:
        headers["Range"] = range_header
    
    async def stream_content():
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("GET", audio_url, headers=headers) as response:
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    yield chunk
    
    # Get content info
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            head_response = await client.head(audio_url, headers={"User-Agent": "Gracefy-App/1.0"})
            content_length = head_response.headers.get("Content-Length", "0")
            content_type = head_response.headers.get("Content-Type", "audio/mpeg")
    except:
        content_length = "0"
        content_type = "audio/mpeg"
    
    response_headers = {
        "Content-Type": content_type,
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'attachment; filename="{song.get("title", "song")}.mp3"'
    }
    
    if content_length != "0":
        response_headers["Content-Length"] = content_length
    
    return StreamingResponse(
        stream_content(),
        media_type=content_type,
        headers=response_headers
    )


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
    """Create a new album with optional country tagging."""
    db = get_db()
    
    # Extract country codes if provided
    country_codes = album.pop("country_codes", [])
    is_geo_default = album.pop("is_geo_default", False)
    
    album_obj = Album(**album)
    doc = album_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["is_geo_default"] = is_geo_default
    
    await db.albums.insert_one(doc)
    
    # Add country tags if provided (only if not GLOBAL)
    if country_codes and "GLOBAL" not in country_codes:
        import uuid
        mappings = [
            {
                "id": f"cc_{uuid.uuid4().hex[:12]}",
                "content_id": doc["album_id"],
                "country_code": cc.upper(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            for cc in country_codes
        ]
        await db.content_country.insert_many(mappings)
    
    # Invalidate cache in background (don't wait)
    import asyncio
    asyncio.create_task(invalidate_albums_cache())
    
    return {"album_id": doc["album_id"], "message": "Album created successfully"}


@router.put("/albums/{album_id}")
async def update_album(album_id: str, updates: dict):
    """Update album with optional country tagging."""
    db = get_db()
    
    updates.pop("_id", None)
    updates.pop("album_id", None)
    
    # Extract country codes if provided
    country_codes = updates.pop("country_codes", None)
    
    result = await db.albums.update_one({"album_id": album_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Update country tags if provided (only if not GLOBAL)
    if country_codes is not None:
        import uuid
        # Remove existing mappings
        await db.content_country.delete_many({"content_id": album_id})
        
        # Add new mappings only if specific countries (not GLOBAL)
        if country_codes and "GLOBAL" not in country_codes:
            mappings = [
                {
                    "id": f"cc_{uuid.uuid4().hex[:12]}",
                    "content_id": album_id,
                    "country_code": cc.upper(),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                for cc in country_codes
            ]
            await db.content_country.insert_many(mappings)
    
    # Invalidate cache in background (don't wait)
    import asyncio
    asyncio.create_task(invalidate_albums_cache(album_id))
    
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
