"""
Recommendation Engine for Gracefy.
Handles content recommendations based on configurable criteria.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import random
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["recommendations"])


# ============== RECOMMENDATION SETTINGS ==============

@router.get("/admin/recommendation-settings")
async def get_recommendation_settings():
    """Get recommendation engine settings"""
    db = get_db()
    
    settings = await db.recommendation_settings.find_one({}, {"_id": 0})
    
    # Default settings if none exist
    if not settings:
        settings = {
            "enabled": True,
            "primary_criteria": "similar_genre",
            "secondary_criteria": "popularity",
            "tertiary_criteria": "recent",
            "weights": {
                "genre_match": 40,
                "artist_match": 20,
                "popularity": 25,
                "recency": 15
            },
            "include_from_same_album": True,
            "include_from_same_artist": True,
            "include_trending": True,
            "exclude_recently_played": True,
            "recently_played_hours": 2,
            "recommendation_pool_size": 50,
            "shuffle_recommendations": False,
            "prefer_premium_content": False,
            "boost_new_releases_days": 14,
            "min_plays_for_trending": 10,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
    return settings


@router.post("/admin/recommendation-settings")
async def save_recommendation_settings(data: dict):
    """Save recommendation engine settings"""
    db = get_db()
    
    settings = {
        "enabled": data.get("enabled", True),
        "primary_criteria": data.get("primary_criteria", "similar_genre"),
        "secondary_criteria": data.get("secondary_criteria", "popularity"),
        "tertiary_criteria": data.get("tertiary_criteria", "recent"),
        "weights": {
            "genre_match": int(data.get("weights", {}).get("genre_match", 40)),
            "artist_match": int(data.get("weights", {}).get("artist_match", 20)),
            "popularity": int(data.get("weights", {}).get("popularity", 25)),
            "recency": int(data.get("weights", {}).get("recency", 15))
        },
        "include_from_same_album": data.get("include_from_same_album", True),
        "include_from_same_artist": data.get("include_from_same_artist", True),
        "include_trending": data.get("include_trending", True),
        "exclude_recently_played": data.get("exclude_recently_played", True),
        "recently_played_hours": int(data.get("recently_played_hours", 2)),
        "recommendation_pool_size": int(data.get("recommendation_pool_size", 50)),
        "shuffle_recommendations": data.get("shuffle_recommendations", False),
        "prefer_premium_content": data.get("prefer_premium_content", False),
        "boost_new_releases_days": int(data.get("boost_new_releases_days", 14)),
        "min_plays_for_trending": int(data.get("min_plays_for_trending", 10)),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert settings
    await db.recommendation_settings.update_one(
        {},
        {"$set": settings},
        upsert=True
    )
    
    # Clear recommendation cache
    await cache.delete("recommendations:*")
    
    return {"success": True, "settings": settings}


# ============== TAG MANAGEMENT ==============

@router.get("/admin/tags")
async def get_all_tags():
    """Get all available tags"""
    db = get_db()
    
    # Default system tags
    default_tags = [
        {"tag_id": "tag_nyimbo", "name": "Nyimbo", "color": "#8B5CF6", "is_system": True},
        {"tag_id": "tag_album", "name": "Album", "color": "#3B82F6", "is_system": True},
        {"tag_id": "tag_mpya", "name": "Mpya", "color": "#10B981", "is_system": True},
        {"tag_id": "tag_pasaka", "name": "Pasaka", "color": "#F59E0B", "is_system": True},
        {"tag_id": "tag_kwaresma", "name": "Kwaresma", "color": "#EF4444", "is_system": True},
        {"tag_id": "tag_krismasi", "name": "Krismasi", "color": "#EC4899", "is_system": True},
        {"tag_id": "tag_trending", "name": "Trending", "color": "#F97316", "is_system": True},
        {"tag_id": "tag_featured", "name": "Featured", "color": "#6366F1", "is_system": True},
    ]
    
    # Get custom tags from database
    custom_tags = await db.tags.find({"is_system": {"$ne": True}}, {"_id": 0}).to_list(100)
    
    # Merge and return
    all_tags = default_tags + custom_tags
    
    return {"tags": all_tags}


@router.post("/admin/tags")
async def create_tag(data: dict):
    """Create a new custom tag"""
    db = get_db()
    
    import uuid
    tag = {
        "tag_id": f"tag_{uuid.uuid4().hex[:8]}",
        "name": data.get("name"),
        "color": data.get("color", "#6B7280"),
        "description": data.get("description", ""),
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tags.insert_one(tag)
    tag.pop("_id", None)
    
    return tag


@router.delete("/admin/tags/{tag_id}")
async def delete_tag(tag_id: str):
    """Delete a custom tag (not system tags)"""
    db = get_db()
    
    # Don't allow deleting system tags
    if tag_id.startswith("tag_") and tag_id in [
        "tag_nyimbo", "tag_album", "tag_mpya", "tag_pasaka", 
        "tag_kwaresma", "tag_krismasi", "tag_trending", "tag_featured"
    ]:
        raise HTTPException(status_code=400, detail="Cannot delete system tags")
    
    result = await db.tags.delete_one({"tag_id": tag_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Remove tag from all albums
    await db.albums.update_many(
        {"tags": tag_id},
        {"$pull": {"tags": tag_id}}
    )
    
    return {"success": True}


@router.put("/albums/{album_id}/tags")
async def update_album_tags(album_id: str, data: dict):
    """Update tags for an album"""
    db = get_db()
    
    tags = data.get("tags", [])
    
    result = await db.albums.update_one(
        {"album_id": album_id},
        {"$set": {"tags": tags}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Clear cache
    await cache.delete("albums:*")
    
    return {"success": True, "tags": tags}


# ============== RECOMMENDATION ENGINE ==============

@router.get("/recommendations/next-songs")
async def get_next_song_recommendations(
    current_song_id: str,
    user_id: Optional[str] = None,
    limit: int = 10
):
    """
    Get recommended next songs based on current song.
    This is used by the player to determine what to play next.
    """
    db = get_db()
    
    # Get settings
    settings = await db.recommendation_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {"enabled": True, "primary_criteria": "similar_genre"}
    
    if not settings.get("enabled", True):
        # If recommendations disabled, just return random songs
        songs = await db.songs.find(
            {"status": "active", "song_id": {"$ne": current_song_id}},
            {"_id": 0}
        ).limit(limit).to_list(limit)
        return {"songs": songs, "criteria_used": "random"}
    
    # Get current song details
    current_song = await db.songs.find_one({"song_id": current_song_id}, {"_id": 0})
    if not current_song:
        # Return random songs if current song not found
        songs = await db.songs.find({"status": "active"}, {"_id": 0}).limit(limit).to_list(limit)
        return {"songs": songs, "criteria_used": "random"}
    
    # Get album info for genre/category matching
    album = await db.albums.find_one(
        {"album_id": current_song.get("album_id")},
        {"_id": 0, "category_id": 1, "category_name": 1, "artist_id": 1, "tags": 1}
    )
    
    recommendations = []
    criteria_used = []
    
    # Build exclusion list
    exclude_ids = [current_song_id]
    
    # Exclude recently played songs if configured
    if settings.get("exclude_recently_played") and user_id:
        hours = settings.get("recently_played_hours", 2)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        recent_sessions = await db.listening_sessions.find(
            {
                "user_id": user_id,
                "content_type": "song",
                "start_time": {"$gte": cutoff.isoformat()}
            },
            {"content_id": 1}
        ).to_list(50)
        exclude_ids.extend([s["content_id"] for s in recent_sessions])
    
    weights = settings.get("weights", {})
    
    # 1. Songs from same album (if enabled)
    if settings.get("include_from_same_album") and current_song.get("album_id"):
        same_album_songs = await db.songs.find(
            {
                "album_id": current_song["album_id"],
                "song_id": {"$nin": exclude_ids},
                "status": "active"
            },
            {"_id": 0}
        ).to_list(10)
        
        for song in same_album_songs:
            song["_score"] = 100  # Highest priority for same album
            song["_reason"] = "same_album"
        recommendations.extend(same_album_songs)
        if same_album_songs:
            criteria_used.append("same_album")
    
    # 2. Songs from same category/genre
    if album and album.get("category_id"):
        # Find albums with same category
        similar_albums = await db.albums.find(
            {"category_id": album["category_id"], "status": "active"},
            {"album_id": 1}
        ).to_list(20)
        
        similar_album_ids = [a["album_id"] for a in similar_albums]
        
        genre_songs = await db.songs.find(
            {
                "album_id": {"$in": similar_album_ids},
                "song_id": {"$nin": exclude_ids + [s["song_id"] for s in recommendations]},
                "status": "active"
            },
            {"_id": 0}
        ).limit(20).to_list(20)
        
        for song in genre_songs:
            song["_score"] = weights.get("genre_match", 40)
            song["_reason"] = "similar_genre"
        recommendations.extend(genre_songs)
        if genre_songs:
            criteria_used.append("similar_genre")
    
    # 3. Songs from same artist (if enabled)
    if settings.get("include_from_same_artist") and album and album.get("artist_id"):
        # Find albums by same artist
        artist_albums = await db.albums.find(
            {"artist_id": album["artist_id"], "status": "active"},
            {"album_id": 1}
        ).to_list(10)
        
        artist_album_ids = [a["album_id"] for a in artist_albums]
        
        artist_songs = await db.songs.find(
            {
                "album_id": {"$in": artist_album_ids},
                "song_id": {"$nin": exclude_ids + [s["song_id"] for s in recommendations]},
                "status": "active"
            },
            {"_id": 0}
        ).limit(15).to_list(15)
        
        for song in artist_songs:
            song["_score"] = weights.get("artist_match", 20)
            song["_reason"] = "same_artist"
        recommendations.extend(artist_songs)
        if artist_songs:
            criteria_used.append("same_artist")
    
    # 4. Trending songs (if enabled)
    if settings.get("include_trending"):
        min_plays = settings.get("min_plays_for_trending", 10)
        trending_songs = await db.songs.find(
            {
                "plays": {"$gte": min_plays},
                "song_id": {"$nin": exclude_ids + [s["song_id"] for s in recommendations]},
                "status": "active"
            },
            {"_id": 0}
        ).sort("plays", -1).limit(10).to_list(10)
        
        for song in trending_songs:
            song["_score"] = weights.get("popularity", 25)
            song["_reason"] = "trending"
        recommendations.extend(trending_songs)
        if trending_songs:
            criteria_used.append("trending")
    
    # 5. New releases boost
    if settings.get("boost_new_releases_days", 0) > 0:
        days = settings["boost_new_releases_days"]
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        new_albums = await db.albums.find(
            {"created_at": {"$gte": cutoff.isoformat()}, "status": "active"},
            {"album_id": 1}
        ).to_list(10)
        
        new_album_ids = [a["album_id"] for a in new_albums]
        
        if new_album_ids:
            new_songs = await db.songs.find(
                {
                    "album_id": {"$in": new_album_ids},
                    "song_id": {"$nin": exclude_ids + [s["song_id"] for s in recommendations]},
                    "status": "active"
                },
                {"_id": 0}
            ).limit(10).to_list(10)
            
            for song in new_songs:
                song["_score"] = weights.get("recency", 15) + 10  # Boost for recency
                song["_reason"] = "new_release"
            recommendations.extend(new_songs)
            if new_songs:
                criteria_used.append("new_release")
    
    # Remove duplicates and sort by score
    seen = set()
    unique_recommendations = []
    for song in recommendations:
        if song["song_id"] not in seen:
            seen.add(song["song_id"])
            unique_recommendations.append(song)
    
    # Sort by score (highest first)
    unique_recommendations.sort(key=lambda x: x.get("_score", 0), reverse=True)
    
    # Shuffle if configured
    if settings.get("shuffle_recommendations"):
        random.shuffle(unique_recommendations)
    
    # Limit results
    final_recommendations = unique_recommendations[:limit]
    
    # Clean up internal fields and enrich with album thumbnails
    album_ids = list(set([s.get("album_id") for s in final_recommendations if s.get("album_id")]))
    albums_map = {}
    if album_ids:
        albums = await db.albums.find(
            {"album_id": {"$in": album_ids}},
            {"_id": 0, "album_id": 1, "thumbnail": 1, "title": 1, "artist_name": 1}
        ).to_list(len(album_ids))
        albums_map = {a["album_id"]: a for a in albums}
    
    for song in final_recommendations:
        song.pop("_score", None)
        song.pop("_reason", None)
        # Add album thumbnail if song doesn't have its own
        if song.get("album_id") and song["album_id"] in albums_map:
            album_data = albums_map[song["album_id"]]
            if not song.get("thumbnail"):
                song["thumbnail"] = album_data.get("thumbnail")
            song["album_thumbnail"] = album_data.get("thumbnail")
            song["album_title"] = album_data.get("title")
            if not song.get("artist_name"):
                song["artist_name"] = album_data.get("artist_name")
    
    # Filter out songs with NO playable source (no audio_url AND no hls_url).
    # These cause the player to throw "no supported sources" mid-autoplay.
    playable = []
    skipped = 0
    for s in final_recommendations:
        if (s.get("audio_url") and s["audio_url"].strip()) or (s.get("hls_url") and s["hls_url"].strip()):
            playable.append(s)
        else:
            skipped += 1
    if skipped:
        logger.info(f"[Recommendations] Filtered out {skipped} song(s) with no playable source")
    
    return {
        "songs": playable,
        "criteria_used": criteria_used,
        "total_pool": len(unique_recommendations)
    }


@router.get("/recommendations/for-user")
async def get_user_recommendations(user_id: str, limit: int = 20):
    """
    Get personalized recommendations for a user based on their listening history.
    """
    db = get_db()
    
    # Get user's listening history
    recent_sessions = await db.listening_sessions.find(
        {"user_id": user_id, "content_type": "song", "counted_as_play": True},
        {"content_id": 1}
    ).sort("start_time", -1).limit(50).to_list(50)
    
    if not recent_sessions:
        # No history - return popular songs
        songs = await db.songs.find(
            {"status": "active"},
            {"_id": 0}
        ).sort("plays", -1).limit(limit).to_list(limit)
        return {"songs": songs, "personalized": False}
    
    # Get most played songs' albums
    played_song_ids = [s["content_id"] for s in recent_sessions]
    played_songs = await db.songs.find(
        {"song_id": {"$in": played_song_ids}},
        {"album_id": 1}
    ).to_list(50)
    
    album_ids = list(set([s["album_id"] for s in played_songs if s.get("album_id")]))
    
    # Get categories from these albums
    albums = await db.albums.find(
        {"album_id": {"$in": album_ids}},
        {"category_id": 1, "artist_id": 1}
    ).to_list(50)
    
    category_ids = list(set([a["category_id"] for a in albums if a.get("category_id")]))
    artist_ids = list(set([a["artist_id"] for a in albums if a.get("artist_id")]))
    
    # Find similar albums
    similar_albums = await db.albums.find(
        {
            "$or": [
                {"category_id": {"$in": category_ids}},
                {"artist_id": {"$in": artist_ids}}
            ],
            "status": "active"
        },
        {"album_id": 1}
    ).to_list(30)
    
    similar_album_ids = [a["album_id"] for a in similar_albums]
    
    # Get songs from similar albums (excluding already played)
    recommendations = await db.songs.find(
        {
            "album_id": {"$in": similar_album_ids},
            "song_id": {"$nin": played_song_ids},
            "status": "active"
        },
        {"_id": 0}
    ).sort("plays", -1).limit(limit).to_list(limit)
    
    return {"songs": recommendations, "personalized": True}


@router.get("/recommendations/trending")
async def get_trending_content(limit: int = 20):
    """Get trending songs and albums"""
    db = get_db()
    
    settings = await db.recommendation_settings.find_one({}, {"_id": 0})
    min_plays = settings.get("min_plays_for_trending", 10) if settings else 10
    
    # Get trending songs
    trending_songs = await db.songs.find(
        {"plays": {"$gte": min_plays}, "status": "active"},
        {"_id": 0}
    ).sort("plays", -1).limit(limit).to_list(limit)
    
    # Get trending albums
    trending_albums = await db.albums.find(
        {"total_plays": {"$gte": min_plays}, "status": "active"},
        {"_id": 0}
    ).sort("total_plays", -1).limit(limit).to_list(limit)
    
    return {
        "songs": trending_songs,
        "albums": trending_albums
    }
