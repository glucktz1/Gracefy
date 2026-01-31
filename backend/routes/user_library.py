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
    """Get all liked items"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    likes = await db.user_likes.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return {"likes": likes}


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
    """Get user's playlists"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    playlists = await db.user_playlists.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"playlists": playlists}


@router.post("/library/playlists")
async def create_playlist(request: Request, data: dict):
    """Create a new playlist"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
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


@router.post("/listening/track-play")
async def track_play(request: Request, data: dict):
    """Track song play for listening history and revenue"""
    db = get_db()
    user = await get_user_from_token(request)
    
    song_id = data.get("song_id")
    album_id = data.get("album_id")
    duration = data.get("duration", 0)
    
    if not song_id:
        raise HTTPException(status_code=400, detail="song_id required")
    
    user_id = user["user_id"] if user else "anonymous"
    
    # Create listening session
    session = {
        "session_id": f"listen_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "song_id": song_id,
        "album_id": album_id,
        "duration_seconds": duration,
        "start_time": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.listening_sessions.insert_one(session)
    
    # Update song plays
    await db.songs.update_one({"song_id": song_id}, {"$inc": {"plays": 1}})
    
    # Update album plays
    if album_id:
        await db.albums.update_one({"album_id": album_id}, {"$inc": {"total_plays": 1}})
    
    return {"tracked": True, "session_id": session["session_id"]}


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
