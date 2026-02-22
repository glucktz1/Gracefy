"""
User browse and search routes for Gracefy mobile app.
Handles browse, search, and user content discovery.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import Optional, List
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["browse"])


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


# ============== BROWSE ==============

@router.get("/user/browse/categories")
async def browse_categories():
    """Get categories for browse screen - uses song_categories as primary"""
    db = get_db()
    
    # Use song_categories as the primary category source
    categories = await db.song_categories.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    
    # Map song_category_id to category_id for compatibility
    for cat in categories:
        if "song_category_id" in cat and "category_id" not in cat:
            cat["category_id"] = cat["song_category_id"]
    
    return {
        "categories": categories
    }


@router.get("/user/browse/category/{category_id}")
async def browse_category(category_id: str):
    """Get content for a specific category"""
    db = get_db()
    
    # Map old category IDs to new song category IDs if needed
    # Also map song category IDs to old category IDs for album lookup
    category_mapping = {
        # Old categories -> song categories
        "cat_9912003e1414": "songcat_593f7c13c64a",  # Christimas Songs -> Krismasi
        "cat_66de3ce04e18": "songcat_593f7c13c64a",  # Christmas -> Krismasi
        "cat_f3cce0507446": "songcat_f13791e16795",  # Kwaresma(lent) -> Kwaresma
        # Reverse mapping: song categories -> old categories
        "songcat_593f7c13c64a": ["cat_9912003e1414", "cat_66de3ce04e18"],  # Krismasi -> both Christmas cats
        "songcat_f13791e16795": ["cat_f3cce0507446"],  # Kwaresma
    }
    
    # Build query to find albums
    category_ids_to_search = [category_id]
    
    # If this is a song category, also search for mapped old category IDs
    if category_id in category_mapping and isinstance(category_mapping[category_id], list):
        category_ids_to_search.extend(category_mapping[category_id])
    # If this is an old category, also search for mapped song category
    elif category_id in category_mapping and isinstance(category_mapping[category_id], str):
        category_ids_to_search.append(category_mapping[category_id])
    
    # Get albums in this category (check category_id, song_category_id, and mapped IDs)
    albums = await db.albums.find(
        {
            "$or": [
                {"category_id": {"$in": category_ids_to_search}},
                {"song_category_id": {"$in": category_ids_to_search}}
            ],
            "status": "active"
        },
        {"_id": 0}
    ).sort("total_plays", -1).limit(50).to_list(50)
    
    # Get category info - check both collections
    category = await db.song_categories.find_one(
        {"$or": [{"song_category_id": category_id}, {"category_id": category_id}]},
        {"_id": 0}
    )
    if not category:
        category = await db.categories.find_one(
            {"category_id": category_id},
            {"_id": 0}
        )
    
    return {
        "category": category,
        "albums": albums
    }


# ============== SEARCH ==============

@router.get("/user/search")
async def search(
    q: str = Query(..., min_length=1),
    type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """Search for songs, albums, choirs, churches"""
    db = get_db()
    
    results = {
        "query": q,
        "songs": [],
        "albums": [],
        "choirs": [],
        "churches": []
    }
    
    search_regex = {"$regex": q, "$options": "i"}
    
    if not type or type == "song":
        songs = await db.songs.find(
            {"title": search_regex, "status": "active"},
            {"_id": 0}
        ).limit(limit).to_list(limit)
        results["songs"] = songs
    
    if not type or type == "album":
        albums = await db.albums.find(
            {"$or": [
                {"title": search_regex},
                {"artist_name": search_regex}
            ], "status": "active"},
            {"_id": 0}
        ).limit(limit).to_list(limit)
        results["albums"] = albums
    
    if not type or type == "choir":
        choirs = await db.singers.find(
            {"name": search_regex, "status": {"$in": ["active", "approved"]}},
            {"_id": 0}
        ).limit(limit).to_list(limit)
        results["choirs"] = choirs
    
    if not type or type == "church":
        churches = await db.churches.find(
            {"name": search_regex, "status": "approved"},
            {"_id": 0}
        ).limit(limit).to_list(limit)
        results["churches"] = churches
    
    return results


# ============== USER CONTENT ==============

@router.get("/user/content")
async def get_user_content(request: Request):
    """Get content for authenticated user (teachings, sermons)"""
    db = get_db()
    user = await get_user_from_token(request)
    
    # Get content containers
    containers = await db.content_containers.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("total_plays", -1).limit(20).to_list(20)
    
    return {"containers": containers}


@router.get("/user/content/{container_id}")
async def get_user_content_detail(container_id: str, request: Request):
    """Get detailed content container for user"""
    db = get_db()
    
    container = await db.content_containers.find_one(
        {"container_id": container_id},
        {"_id": 0}
    )
    
    if not container:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Get series
    series = await db.content_series.find(
        {"container_id": container_id},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    
    # Get episodes for each series
    for s in series:
        episodes = await db.content_episodes.find(
            {"series_id": s["series_id"]},
            {"_id": 0}
        ).sort("sort_order", 1).to_list(100)
        s["episodes"] = episodes
    
    return {"container": container, "series": series}


@router.get("/user/album/{album_id}")
async def get_user_album(album_id: str, request: Request):
    """Get album details for user"""
    db = get_db()
    user = await get_user_from_token(request)
    
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    songs = await db.songs.find(
        {"album_id": album_id, "status": "active"},
        {"_id": 0}
    ).sort("track_number", 1).to_list(100)
    
    # Check if user has liked any songs
    if user:
        liked_ids = set()
        likes = await db.user_likes.find(
            {"user_id": user["user_id"], "item_type": "song"},
            {"item_id": 1}
        ).to_list(1000)
        liked_ids = {l["item_id"] for l in likes}
        
        for song in songs:
            song["is_liked"] = song.get("song_id") in liked_ids
    
    return {"album": album, "songs": songs}


# ============== SUBSCRIPTION STATUS ==============

@router.get("/user/subscription-status")
async def get_subscription_status(request: Request):
    """Get user's subscription status"""
    db = get_db()
    user = await get_user_from_token(request)
    
    if not user:
        return {
            "subscription_type": "free",
            "is_subscribed": False,
            "can_download": False
        }
    
    subscription_type = user.get("subscription_type", "free")
    expires = user.get("subscription_expires")
    
    is_subscribed = False
    if subscription_type != "free" and expires:
        from datetime import datetime, timezone
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires)
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        is_subscribed = expires > datetime.now(timezone.utc)
    
    # Check trial
    trial_active = False
    trial = user.get("trial")
    if trial and trial.get("status") == "active":
        trial_expires = trial.get("expires_at")
        if trial_expires:
            if isinstance(trial_expires, str):
                trial_expires = datetime.fromisoformat(trial_expires)
            if trial_expires.tzinfo is None:
                trial_expires = trial_expires.replace(tzinfo=timezone.utc)
            trial_active = trial_expires > datetime.now(timezone.utc)
    
    # Determine capabilities
    can_download = is_subscribed or subscription_type == "premium"
    
    return {
        "subscription_type": subscription_type,
        "is_subscribed": is_subscribed,
        "trial_active": trial_active,
        "can_download": can_download,
        "subscription_expires": expires.isoformat() if expires else None
    }


# ============== LISTENING TRACKING ==============

@router.post("/listening/start")
async def start_listening(request: Request, data: dict):
    """Track start of listening session"""
    db = get_db()
    user = await get_user_from_token(request)
    
    import uuid
    
    session = {
        "session_id": f"ls_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"] if user else data.get("user_id", "anonymous"),
        "song_id": data.get("song_id"),
        "album_id": data.get("album_id"),
        "content_type": data.get("content_type"),  # "song", "teaching_lesson", "bible_tts"
        "content_id": data.get("content_id"),
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": None,
        "duration_seconds": 0,
        "counted_as_play": False,
        "platform": data.get("platform", "web"),
        "device_info": data.get("device_info")
    }
    
    await db.listening_sessions.insert_one(session)
    session.pop("_id", None)
    
    return {"session_id": session["session_id"]}


@router.post("/listening/end")
async def end_listening(request: Request, data: dict = None):
    """Track end of listening session - counts as play if 45+ seconds"""
    db = get_db()
    
    MINIMUM_PLAY_SECONDS = 45  # Play counts only if played 45+ seconds
    
    # Handle beacon requests which send as text/plain
    if data is None:
        try:
            body = await request.body()
            import json
            data = json.loads(body.decode('utf-8'))
        except Exception:
            return {"tracked": False}
    
    session_id = data.get("session_id")
    duration = data.get("duration_seconds", 0)
    
    if not session_id:
        return {"tracked": False}
    
    # Update session with end time and duration
    counted_as_play = duration >= MINIMUM_PLAY_SECONDS
    
    await db.listening_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "end_time": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": duration,
            "counted_as_play": counted_as_play
        }}
    )
    
    # If duration >= 45 seconds, count as play
    if counted_as_play:
        session = await db.listening_sessions.find_one({"session_id": session_id})
        if session:
            song_id = session.get("song_id")
            album_id = session.get("album_id")
            content_type = session.get("content_type")
            content_id = session.get("content_id")
            
            # Handle song plays
            if song_id:
                await db.songs.update_one({"song_id": song_id}, {"$inc": {"plays": 1, "play_count": 1}})
                
                # Also update choir/artist play count
                song = await db.songs.find_one({"song_id": song_id})
                if song and song.get("album_id"):
                    album = await db.albums.find_one({"album_id": song.get("album_id")})
                    if album:
                        await db.albums.update_one({"album_id": album["album_id"]}, {"$inc": {"play_count": 1}})
                        if album.get("artist_id"):
                            await db.singers.update_one(
                                {"singer_id": album.get("artist_id")},
                                {"$inc": {"total_plays": 1}}
                            )
                        
            if album_id:
                await db.albums.update_one({"album_id": album_id}, {"$inc": {"total_plays": 1}})
            
            # Handle teaching lesson plays
            if content_type == "teaching_lesson" and content_id:
                await db.teaching_lessons.update_one(
                    {"lesson_id": content_id},
                    {"$inc": {"play_count": 1}}
                )
                # Also update the parent teaching's play count
                lesson = await db.teaching_lessons.find_one({"lesson_id": content_id})
                if lesson:
                    await db.teachings.update_one(
                        {"teaching_id": lesson.get("teaching_id")},
                        {"$inc": {"play_count": 1}}
                    )
    
    return {
        "tracked": True,
        "counted_as_play": counted_as_play,
        "duration_seconds": duration,
        "minimum_required": MINIMUM_PLAY_SECONDS
    }


# ============== TRANSLATIONS ==============

@router.get("/translations")
async def get_translations(
    language: str = Query("sw", description="Language code")
):
    """Get UI translations for the app"""
    db = get_db()
    
    translations = await db.translations.find_one(
        {"language": language},
        {"_id": 0}
    )
    
    if not translations:
        # Return empty translations
        return {"language": language, "strings": {}}
    
    return translations
