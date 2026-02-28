"""
User library routes for Gracefy.
Handles favorites, playlists, history, and user content.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["library"])


async def get_user_from_token(request: Request):
    """Helper to get user from auth token"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return None
    
    return await db.app_users.find_one(
        {"user_id": token_doc["user_id"]},
        {"_id": 0, "password_hash": 0}
    )


# ============== FAVORITES ==============

@router.post("/user/favorites/add")
async def add_favorite(request: Request, data: dict):
    """Add item to favorites"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    item_type = data.get("type", "song")
    item_id = data.get("id")
    
    if not item_id:
        raise HTTPException(status_code=400, detail="Item ID required")
    
    favorite = {
        "type": item_type,
        "id": item_id,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.app_users.update_one(
        {"user_id": user["user_id"]},
        {"$addToSet": {"favorites": favorite}}
    )
    
    return {"message": "Added to favorites"}


@router.post("/user/favorites/remove")
async def remove_favorite(request: Request, data: dict):
    """Remove item from favorites"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    item_id = data.get("id")
    
    await db.app_users.update_one(
        {"user_id": user["user_id"]},
        {"$pull": {"favorites": {"id": item_id}}}
    )
    
    return {"message": "Removed from favorites"}


@router.get("/user/favorites")
async def get_favorites(request: Request):
    """Get user's favorites"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    favorites = user.get("favorites", [])
    
    # Enrich with item details
    enriched = []
    for fav in favorites:
        item_type = fav.get("type", "song")
        item_id = fav.get("id")
        
        if item_type == "song":
            item = await db.songs.find_one({"song_id": item_id}, {"_id": 0})
        elif item_type == "album":
            item = await db.albums.find_one({"album_id": item_id}, {"_id": 0})
        else:
            item = None
        
        if item:
            enriched.append({**fav, "item": item})
    
    return {"favorites": enriched}


# ============== USER LIBRARY ==============

@router.get("/user/library")
async def get_user_library(request: Request):
    """Get user's complete library"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = user["user_id"]
    
    # Get playlists
    playlists = await db.user_playlists.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get liked songs
    likes = await db.user_likes.find(
        {"user_id": user_id, "item_type": "song"},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    liked_song_ids = [like["item_id"] for like in likes]
    liked_songs = await db.songs.find(
        {"song_id": {"$in": liked_song_ids}},
        {"_id": 0}
    ).to_list(50)
    
    # Get recently played
    history = await db.listening_sessions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("start_time", -1).limit(20).to_list(20)
    
    # Get downloads (from user record)
    downloads = user.get("downloads", [])
    
    # Enrich favorites with item details
    raw_favorites = user.get("favorites", [])
    enriched_favorites = []
    for fav in raw_favorites:
        item_type = fav.get("type", "song")
        item_id = fav.get("id")
        
        if item_type == "song":
            item = await db.songs.find_one({"song_id": item_id}, {"_id": 0})
            if item:
                # Get album info for the song
                album = await db.albums.find_one(
                    {"album_id": item.get("album_id")}, 
                    {"_id": 0, "thumbnail": 1, "title": 1, "artist_name": 1}
                )
                enriched_favorites.append({
                    "type": item_type,
                    "id": item_id,
                    "item": item,
                    "album": album
                })
        elif item_type == "album":
            item = await db.albums.find_one({"album_id": item_id}, {"_id": 0})
            if item:
                enriched_favorites.append({
                    "type": item_type,
                    "id": item_id,
                    "item": item
                })
    
    return {
        "playlists": playlists,
        "liked_songs": liked_songs,
        "recently_played": history,
        "downloads": downloads,
        "favorites": enriched_favorites
    }


# ============== LIKES ==============

@router.get("/library/likes")
async def get_likes(request: Request):
    """Get all liked songs with full song details"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get all likes for this user
    likes = await db.user_likes.find(
        {"user_id": user["user_id"], "item_type": "song"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Get song IDs
    song_ids = [like["item_id"] for like in likes if like.get("item_id")]
    
    if not song_ids:
        return {"songs": [], "likes": []}
    
    # Fetch full song details
    songs = await db.songs.find(
        {"song_id": {"$in": song_ids}},
        {"_id": 0}
    ).to_list(200)
    
    # Create a map for ordering
    songs_map = {s["song_id"]: s for s in songs}
    
    # Return songs in the order they were liked (most recent first)
    ordered_songs = []
    for like in likes:
        song_id = like.get("item_id")
        if song_id and song_id in songs_map:
            song = songs_map[song_id]
            # Add album info if needed
            if song.get("album_id"):
                album = await db.albums.find_one(
                    {"album_id": song["album_id"]},
                    {"_id": 0, "title": 1, "artist_name": 1, "thumbnail": 1}
                )
                if album:
                    song["album_title"] = album.get("title")
                    if not song.get("artist_name"):
                        song["artist_name"] = album.get("artist_name")
                    if not song.get("thumbnail"):
                        song["thumbnail"] = album.get("thumbnail")
            ordered_songs.append(song)
    
    return {"songs": ordered_songs, "likes": likes}


@router.post("/library/like/{song_id}")
async def like_song(song_id: str, request: Request):
    """Like a song"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if already liked
    existing = await db.user_likes.find_one({
        "user_id": user["user_id"],
        "item_id": song_id,
        "item_type": "song"
    })
    
    if existing:
        return {"message": "Already liked", "liked": True}
    
    await db.user_likes.insert_one({
        "like_id": f"like_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "item_id": song_id,
        "item_type": "song",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Increment song likes
    await db.songs.update_one({"song_id": song_id}, {"$inc": {"likes": 1}})
    
    return {"message": "Song liked", "liked": True}


@router.delete("/library/like/{song_id}")
async def unlike_song(song_id: str, request: Request):
    """Unlike a song"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.user_likes.delete_one({
        "user_id": user["user_id"],
        "item_id": song_id,
        "item_type": "song"
    })
    
    if result.deleted_count > 0:
        await db.songs.update_one({"song_id": song_id}, {"$inc": {"likes": -1}})
    
    return {"message": "Song unliked", "liked": False}


# ============== PLAYLISTS ==============

@router.get("/library/playlists")
async def get_playlists(request: Request):
    """Get user's playlists with song count"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    playlists = await db.user_playlists.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add accurate song count and first song thumbnail for each playlist
    for playlist in playlists:
        song_ids = playlist.get("songs", [])
        
        # Get actual count of existing songs
        if song_ids:
            actual_count = await db.songs.count_documents({"song_id": {"$in": song_ids}})
            playlist["song_count"] = actual_count
        else:
            playlist["song_count"] = 0
        
        # Get thumbnail from first song if playlist doesn't have one
        if not playlist.get("thumbnail") and song_ids:
            first_song = await db.songs.find_one(
                {"song_id": song_ids[0]},
                {"thumbnail": 1, "thumbnail_url": 1}
            )
            if first_song:
                playlist["thumbnail"] = first_song.get("thumbnail") or first_song.get("thumbnail_url")
    
    return {"playlists": playlists}


@router.post("/library/playlists")
async def create_playlist(request: Request, data: dict):
    """Create a new playlist - requires premium when billing is enabled"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check billing status - if billing is enabled, check user's premium status
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    billing_enabled = settings.get("billing_enabled", False) if settings else False
    
    if billing_enabled:
        # Check if user is premium
        user_id = user["user_id"]
        subscription = user.get("subscription", {})
        is_premium = user.get("is_premium", False)
        
        # Check if subscription is active and not expired
        if subscription.get("status") == "active" and subscription.get("expires_at"):
            from datetime import datetime, timezone
            expires_at = datetime.fromisoformat(subscription["expires_at"].replace("Z", "+00:00"))
            is_premium = expires_at > datetime.now(timezone.utc)
        
        if not is_premium:
            raise HTTPException(
                status_code=403, 
                detail="Playlist creation requires a Premium subscription"
            )
    
    playlist = {
        "playlist_id": f"pl_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.get("name", "My Playlist"),
        "description": data.get("description"),
        "thumbnail": data.get("thumbnail"),
        "songs": [],
        "is_public": data.get("is_public", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_playlists.insert_one(playlist)
    playlist.pop("_id", None)
    
    return playlist


@router.get("/user/playlist/{playlist_id}")
async def get_playlist(playlist_id: str, request: Request):
    """Get playlist with songs"""
    db = get_db()
    
    playlist = await db.user_playlists.find_one({"playlist_id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Get songs
    song_ids = playlist.get("songs", [])
    songs = await db.songs.find(
        {"song_id": {"$in": song_ids}},
        {"_id": 0}
    ).to_list(500)
    
    # Update song_count to reflect actual songs that exist
    playlist["song_count"] = len(songs)
    
    return {"playlist": playlist, "songs": songs}


@router.post("/library/playlists/{playlist_id}/songs/{song_id}")
async def add_song_to_playlist(playlist_id: str, song_id: str, request: Request):
    """Add song to playlist"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify ownership
    playlist = await db.user_playlists.find_one({
        "playlist_id": playlist_id,
        "user_id": user["user_id"]
    })
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    await db.user_playlists.update_one(
        {"playlist_id": playlist_id},
        {"$addToSet": {"songs": song_id}}
    )
    
    return {"message": "Song added to playlist"}


@router.delete("/library/playlists/{playlist_id}/songs/{song_id}")
async def remove_song_from_playlist(playlist_id: str, song_id: str, request: Request):
    """Remove song from playlist"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.user_playlists.update_one(
        {"playlist_id": playlist_id, "user_id": user["user_id"]},
        {"$pull": {"songs": song_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    return {"message": "Song removed from playlist"}


@router.post("/user/playlist/create")
async def create_user_playlist(request: Request, data: dict):
    """Create playlist (alias)"""
    return await create_playlist(request, data)


@router.post("/user/playlist/{playlist_id}/add")
async def add_to_user_playlist(playlist_id: str, request: Request, data: dict):
    """Add song to playlist (alias)"""
    song_id = data.get("song_id")
    if not song_id:
        raise HTTPException(status_code=400, detail="song_id required")
    return await add_song_to_playlist(playlist_id, song_id, request)


# ============== LISTENING HISTORY ==============

@router.get("/library/history")
async def get_listening_history(request: Request):
    """Get listening history"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    history = await db.listening_sessions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("start_time", -1).limit(100).to_list(100)
    
    return {"history": history}


# ============== REAL-TIME STREAM TRACKING ==============
# These endpoints track active streams from all devices and platforms

@router.post("/listening/start-stream")
async def start_stream(request: Request, data: dict):
    """
    Called immediately when playback starts on any device/platform.
    Creates an active stream record for real-time analytics.
    
    Body:
    - song_id: ID of the song being played
    - device_id: Unique device identifier (generated client-side)
    - platform: "android" | "ios" | "web" | "pwa"
    - album_id: Optional album ID
    """
    db = get_db()
    user = await get_user_from_token(request)
    
    song_id = data.get("song_id")
    device_id = data.get("device_id", f"unknown_{uuid.uuid4().hex[:8]}")
    platform = data.get("platform", "unknown")
    album_id = data.get("album_id")
    
    if not song_id:
        raise HTTPException(status_code=400, detail="song_id required")
    
    user_id = user["user_id"] if user else f"anonymous_{device_id}"
    
    # Create unique stream ID combining user and device
    stream_id = f"stream_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    # Get song and choir info
    song = await db.songs.find_one(
        {"song_id": song_id}, 
        {"_id": 0, "title": 1, "artist_name": 1, "choir_id": 1, "album_id": 1}
    )
    
    choir_id = None
    if song and song.get("choir_id"):
        choir_id = song["choir_id"]
    elif album_id or (song and song.get("album_id")):
        album = await db.albums.find_one(
            {"album_id": album_id or song.get("album_id")}, 
            {"_id": 0, "singer_id": 1}
        )
        if album:
            choir_id = album.get("singer_id")
    
    # Create active stream record
    stream = {
        "stream_id": stream_id,
        "user_id": user_id,
        "device_id": device_id,
        "song_id": song_id,
        "song_title": song.get("title") if song else None,
        "artist_name": song.get("artist_name") if song else None,
        "album_id": album_id or (song.get("album_id") if song else None),
        "choir_id": choir_id,
        "platform": platform,
        "start_time": now.isoformat(),
        "last_heartbeat": now.isoformat(),
        "is_active": True,
        "created_at": now.isoformat()
    }
    
    # Store in active_streams collection (for real-time tracking)
    await db.active_streams.insert_one(stream)
    
    logger.info(f"Stream started: {stream_id} - {song.get('title') if song else song_id} by {user_id} on {platform}/{device_id}")
    
    return {
        "stream_id": stream_id,
        "message": "Stream started"
    }


@router.post("/listening/heartbeat")
async def stream_heartbeat(request: Request, data: dict):
    """
    Called periodically (every 30s) to keep stream active.
    Updates last_heartbeat timestamp.
    """
    db = get_db()
    
    stream_id = data.get("stream_id")
    position = data.get("position", 0)  # Current position in seconds
    
    if not stream_id:
        raise HTTPException(status_code=400, detail="stream_id required")
    
    now = datetime.now(timezone.utc)
    
    result = await db.active_streams.update_one(
        {"stream_id": stream_id},
        {"$set": {
            "last_heartbeat": now.isoformat(),
            "position_seconds": position
        }}
    )
    
    return {
        "success": result.modified_count > 0,
        "stream_id": stream_id
    }


@router.post("/listening/end-stream")
async def end_stream(request: Request, data: dict):
    """
    Called when playback stops or user navigates away.
    Marks stream as inactive and records final duration.
    """
    db = get_db()
    
    stream_id = data.get("stream_id")
    duration = data.get("duration", 0)  # Total duration listened in seconds
    
    if not stream_id:
        raise HTTPException(status_code=400, detail="stream_id required")
    
    now = datetime.now(timezone.utc)
    
    # Update active stream
    stream = await db.active_streams.find_one_and_update(
        {"stream_id": stream_id},
        {"$set": {
            "is_active": False,
            "end_time": now.isoformat(),
            "duration_seconds": duration
        }},
        return_document=True
    )
    
    if stream:
        logger.info(f"Stream ended: {stream_id} - {duration}s")
    
    return {
        "stream_id": stream_id,
        "duration": duration,
        "counted": duration >= 45
    }


@router.get("/listening/active-streams")
async def get_active_streams():
    """
    Get all currently active streams (for admin dashboard).
    Streams are considered active if heartbeat within last 2 minutes.
    """
    db = get_db()
    from datetime import timedelta
    
    now = datetime.now(timezone.utc)
    two_min_ago = (now - timedelta(minutes=2)).isoformat()
    
    # Get active streams with recent heartbeat
    active = await db.active_streams.find(
        {
            "is_active": True,
            "last_heartbeat": {"$gte": two_min_ago}
        },
        {"_id": 0}
    ).to_list(1000)
    
    # Count unique listeners and devices
    unique_users = len(set(s["user_id"] for s in active))
    unique_devices = len(set(s["device_id"] for s in active))
    
    # Platform breakdown
    platforms = {}
    for s in active:
        p = s.get("platform", "unknown")
        platforms[p] = platforms.get(p, 0) + 1
    
    return {
        "timestamp": now.isoformat(),
        "total_streams": len(active),
        "unique_listeners": unique_users,
        "unique_devices": unique_devices,
        "platforms": platforms,
        "streams": active[:20]  # Return first 20 for display
    }


@router.post("/listening/track-play")
async def track_play(request: Request, data: dict):
    """
    Track song play for listening history and revenue.
    Only counts as a valid play if played for 45+ seconds.
    Updates song play_count and creates a listening session.
    
    Revenue calculation depends on monetization_mode setting:
    - time_based: Revenue calculated per play (rate × hours)
    - percentage_based: Revenue calculated periodically (choir_minutes/total_minutes × revenue_pool)
    """
    db = get_db()
    user = await get_user_from_token(request)
    
    song_id = data.get("song_id")
    album_id = data.get("album_id")
    duration = data.get("duration", 0)  # Duration in seconds
    platform = data.get("platform", "app")
    
    if not song_id:
        raise HTTPException(status_code=400, detail="song_id required")
    
    user_id = user["user_id"] if user else "anonymous"
    subscription_type = user.get("subscription_type", "free") if user else "free"
    
    # Get song to find choir/album info
    song = await db.songs.find_one(
        {"song_id": song_id}, 
        {"_id": 0, "is_premium": 1, "choir_id": 1, "album_id": 1}
    )
    
    # Get album to find choir_id if not on song
    song_album_id = song.get("album_id") if song else None
    if not album_id and song_album_id:
        album_id = song_album_id
    
    choir_id = None
    if song and song.get("choir_id"):
        choir_id = song["choir_id"]
    elif album_id:
        album = await db.albums.find_one({"album_id": album_id}, {"_id": 0, "singer_id": 1})
        if album:
            choir_id = album.get("singer_id")
    
    is_premium_content = song.get("is_premium", False) if song else False
    
    # Create listening session
    session_id = f"listen_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    
    session = {
        "session_id": session_id,
        "user_id": user_id,
        "song_id": song_id,
        "album_id": album_id,
        "choir_id": choir_id,  # Store choir for percentage-based calculation
        "content_type": "song",
        "content_id": song_id,
        "duration_seconds": duration,
        "platform": platform,
        "subscription_type": subscription_type,
        "is_premium_content": is_premium_content,
        "start_time": now.isoformat(),
        "end_time": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "counted_as_play": duration >= 45,  # Only count if 45+ seconds
        "created_at": now.isoformat()
    }
    
    await db.listening_sessions.insert_one(session)
    
    play_counted = False
    revenue_earned = 0
    
    # Only count as a play if duration >= 45 seconds
    if duration >= 45:
        # Update song play_count
        result = await db.songs.update_one(
            {"song_id": song_id}, 
            {"$inc": {"play_count": 1, "plays": 1}}
        )
        play_counted = result.modified_count > 0
        
        # Update album total_plays if available
        if album_id:
            await db.albums.update_one(
                {"album_id": album_id}, 
                {"$inc": {"total_plays": 1, "play_count": 1}}
            )
        
        # Get revenue settings to determine monetization mode
        settings = await db.revenue_settings.find_one({}, sort=[("created_at", -1)])
        if not settings:
            settings = {
                "monetization_mode": "time_based",
                "premium_rate_per_hour": 10,
                "standard_rate_per_hour": 5,
                "platform_share_percentage": 30,
                "choir_share_percentage": 70
            }
        
        monetization_mode = settings.get("monetization_mode", "time_based")
        
        if monetization_mode == "time_based":
            # OPTION 1: Time-Based Earning
            # Calculate revenue for this play: rate_per_hour × duration_in_hours
            duration_hours = duration / 3600
            
            if subscription_type == "premium" or is_premium_content:
                rate_per_hour = settings.get("premium_rate_per_hour", 10)
            else:
                rate_per_hour = settings.get("standard_rate_per_hour", 5)
            
            revenue_earned = round(duration_hours * rate_per_hour, 4)
            platform_share_pct = settings.get("platform_share_percentage", 30) / 100
            choir_revenue = round(revenue_earned * (1 - platform_share_pct), 4)
            
            # Update session with revenue info
            await db.listening_sessions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "revenue_earned": revenue_earned,
                    "choir_revenue": choir_revenue,
                    "monetization_mode": "time_based"
                }}
            )
            
            # Credit choir account immediately for time-based
            if choir_id and choir_revenue > 0:
                await db.choir_accounts.update_one(
                    {"choir_id": choir_id},
                    {
                        "$inc": {
                            "current_balance": choir_revenue,
                            "total_earned": choir_revenue,
                            "total_plays": 1
                        },
                        "$setOnInsert": {
                            "choir_id": choir_id,
                            "created_at": now.isoformat()
                        }
                    },
                    upsert=True
                )
        else:
            # OPTION 2: Percentage-Based Earning
            # Revenue is calculated periodically, not per-play
            # Just store the session data for later calculation
            await db.listening_sessions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "monetization_mode": "percentage_based",
                    "revenue_calculated": False  # Will be True after periodic calculation
                }}
            )
            
            # Update choir play count (no revenue yet)
            if choir_id:
                await db.choir_accounts.update_one(
                    {"choir_id": choir_id},
                    {
                        "$inc": {"total_plays": 1},
                        "$setOnInsert": {
                            "choir_id": choir_id,
                            "created_at": now.isoformat()
                        }
                    },
                    upsert=True
                )
    
    return {
        "tracked": True, 
        "session_id": session_id,
        "play_counted": play_counted,
        "duration_seconds": duration,
        "minimum_required": 45,
        "revenue_earned": revenue_earned if settings.get("monetization_mode") == "time_based" and duration >= 45 else 0,
        "monetization_mode": settings.get("monetization_mode", "time_based") if duration >= 45 else None
    }


@router.get("/user/daily-plays")
async def get_daily_plays(request: Request):
    """Get user's daily play count"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        return {"plays_today": 0, "limit": None}
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    plays_today = await db.listening_sessions.count_documents({
        "user_id": user["user_id"],
        "date": today
    })
    
    # Get user's daily limit based on subscription
    subscription_type = user.get("subscription_type", "free")
    
    # Get settings for limits
    settings = await db.feature_controls.find_one({})
    limits = None
    if settings and settings.get("controls"):
        tier = "premium" if subscription_type == "premium" else "free"
        tier_controls = settings["controls"].get(tier, {})
        if tier_controls.get("daily_song_limit_enabled"):
            limits = tier_controls.get("daily_song_limit")
    
    return {
        "plays_today": plays_today,
        "limit": limits,
        "subscription_type": subscription_type
    }


# ============== FOLLOW/UNFOLLOW ==============

@router.post("/user/follow")
async def follow_entity(request: Request, data: dict):
    """Follow a church or choir"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    entity_type = data.get("entity_type")  # church, choir
    entity_id = data.get("entity_id")
    
    if not entity_type or not entity_id:
        raise HTTPException(status_code=400, detail="entity_type and entity_id required")
    
    # Check if already following
    existing = await db.user_follows.find_one({
        "user_id": user["user_id"],
        "entity_type": entity_type,
        "entity_id": entity_id
    })
    
    if existing:
        return {"message": "Already following", "following": True}
    
    # Get entity name
    entity_name = None
    if entity_type == "church":
        entity = await db.churches.find_one({"church_id": entity_id}, {"_id": 0, "name": 1})
        entity_name = entity.get("name") if entity else None
    elif entity_type == "choir":
        entity = await db.singers.find_one({"singer_id": entity_id}, {"_id": 0, "name": 1})
        entity_name = entity.get("name") if entity else None
    
    follow = {
        "follow_id": f"fol_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "user_name": user.get("name"),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "notifications_enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_follows.insert_one(follow)
    
    # Increment follower count
    if entity_type == "church":
        await db.churches.update_one({"church_id": entity_id}, {"$inc": {"followers_count": 1}})
    elif entity_type == "choir":
        await db.singers.update_one({"singer_id": entity_id}, {"$inc": {"followers_count": 1}})
    
    return {"message": "Now following", "following": True}


@router.delete("/user/unfollow")
async def unfollow_entity(request: Request, data: dict):
    """Unfollow a church or choir"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    entity_type = data.get("entity_type")
    entity_id = data.get("entity_id")
    
    result = await db.user_follows.delete_one({
        "user_id": user["user_id"],
        "entity_type": entity_type,
        "entity_id": entity_id
    })
    
    if result.deleted_count > 0:
        if entity_type == "church":
            await db.churches.update_one({"church_id": entity_id}, {"$inc": {"followers_count": -1}})
        elif entity_type == "choir":
            await db.singers.update_one({"singer_id": entity_id}, {"$inc": {"followers_count": -1}})
    
    return {"message": "Unfollowed", "following": False}


@router.get("/user/following")
async def get_following(request: Request):
    """Get entities user is following"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    following = await db.user_follows.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(500)
    
    return {"following": following}


@router.get("/user/is-following/{entity_type}/{entity_id}")
async def is_following(entity_type: str, entity_id: str, request: Request):
    """Check if user is following an entity"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        return {"following": False}
    
    follow = await db.user_follows.find_one({
        "user_id": user["user_id"],
        "entity_type": entity_type,
        "entity_id": entity_id
    })
    
    return {"following": follow is not None}


# ============== NOTIFICATIONS ==============

@router.get("/user/notifications")
async def get_user_notifications(request: Request):
    """Get user notifications"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    notifications = await db.user_notifications.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    unread_count = await db.user_notifications.count_documents({
        "user_id": user["user_id"],
        "is_read": False
    })
    
    return {"notifications": notifications, "unread_count": unread_count}


@router.post("/user/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark notification as read"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.user_notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "Marked as read"}


@router.post("/user/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.user_notifications.update_many(
        {"user_id": user["user_id"]},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "All marked as read"}


@router.delete("/user/notifications/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Delete a notification"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.user_notifications.delete_one({
        "notification_id": notification_id,
        "user_id": user["user_id"]
    })
    
    return {"message": "Notification deleted"}
