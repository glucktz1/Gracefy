"""
Content management routes for Gracefy (Religious Leaders).
Handles content containers, series, and episodes.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["content"])


# ============== RELIGIOUS LEADERS ==============

@router.get("/leaders")
async def get_leaders(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get list of religious leaders (alias)"""
    return await get_religious_leaders(status, skip, limit)


@router.get("/religious-leaders")
async def get_religious_leaders(
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get list of religious leaders"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = "approved"
    
    leaders = await db.religious_leaders.find(query, {"_id": 0})\
        .sort("followers_count", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.religious_leaders.count_documents(query)
    
    return {"leaders": leaders, "total": total}


@router.get("/leaders/{leader_id}")
async def get_leader(leader_id: str):
    """Get single religious leader (alias)"""
    return await get_religious_leader(leader_id)


@router.get("/religious-leaders/{leader_id}")
async def get_religious_leader(leader_id: str):
    """Get single religious leader"""
    db = get_db()
    
    leader = await db.religious_leaders.find_one({"leader_id": leader_id}, {"_id": 0})
    if not leader:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return leader


@router.post("/leaders")
async def create_leader(data: dict):
    """Create a new religious leader (alias)"""
    return await create_religious_leader(data)


@router.post("/religious-leaders")
async def create_religious_leader(data: dict):
    """Create a new religious leader"""
    db = get_db()
    
    leader = {
        "leader_id": f"lead_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "title": data.get("title"),
        "bio": data.get("bio"),
        "photo": data.get("photo"),
        "church_id": data.get("church_id"),
        "church_name": data.get("church_name"),
        "denomination": data.get("denomination"),
        "email": data.get("email"),
        "phone": data.get("phone"),
        "followers_count": 0,
        "content_count": 0,
        "status": data.get("status", "pending"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.religious_leaders.insert_one(leader)
    leader.pop("_id", None)
    
    return leader


@router.put("/leaders/{leader_id}")
async def update_leader(leader_id: str, data: dict):
    """Update a religious leader (alias)"""
    return await update_religious_leader(leader_id, data)


@router.put("/religious-leaders/{leader_id}")
async def update_religious_leader(leader_id: str, data: dict):
    """Update a religious leader"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("leader_id", None)
    
    result = await db.religious_leaders.update_one(
        {"leader_id": leader_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return {"message": "Leader updated"}


@router.delete("/leaders/{leader_id}")
async def delete_leader(leader_id: str):
    """Delete a religious leader (alias)"""
    return await delete_religious_leader(leader_id)


@router.delete("/religious-leaders/{leader_id}")
async def delete_religious_leader(leader_id: str):
    """Delete a religious leader"""
    db = get_db()
    
    result = await db.religious_leaders.delete_one({"leader_id": leader_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leader not found")
    
    return {"message": "Leader deleted"}


@router.post("/religious-leaders/{leader_id}/approve")
async def approve_leader(leader_id: str, data: dict = None):
    """Approve a religious leader"""
    db = get_db()
    
    await db.religious_leaders.update_one(
        {"leader_id": leader_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": (data or {}).get("approved_by")
        }}
    )
    
    return {"message": "Leader approved"}


@router.post("/religious-leaders/{leader_id}/reject")
async def reject_leader(leader_id: str, data: dict = None):
    """Reject a religious leader"""
    db = get_db()
    
    await db.religious_leaders.update_one(
        {"leader_id": leader_id},
        {"$set": {
            "status": "rejected",
            "admin_notes": (data or {}).get("reason")
        }}
    )
    
    return {"message": "Leader rejected"}


# ============== CONTENT CONTAINERS ==============

@router.get("/content-containers")
async def get_content_containers(
    category: Optional[str] = None,
    author_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200)
):
    """Get content containers (teachings, sermons, etc.)"""
    db = get_db()
    
    query = {}
    if category:
        query["category"] = category
    if author_id:
        query["author_id"] = author_id
    if status:
        query["status"] = status
    else:
        query["status"] = "active"
    
    containers = await db.content_containers.find(query, {"_id": 0})\
        .sort("total_plays", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    total = await db.content_containers.count_documents(query)
    
    return {"containers": containers, "total": total}


@router.get("/content-containers/{container_id}")
async def get_content_container(container_id: str):
    """Get a single content container"""
    db = get_db()
    
    container = await db.content_containers.find_one(
        {"container_id": container_id},
        {"_id": 0}
    )
    
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    return container


@router.get("/content-containers/{container_id}/full")
async def get_content_container_full(container_id: str):
    """Get container with all series and episodes"""
    db = get_db()
    
    container = await db.content_containers.find_one(
        {"container_id": container_id},
        {"_id": 0}
    )
    
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Get series
    series = await db.content_series.find(
        {"container_id": container_id},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(100)
    
    # Get episodes for each series
    for s in series:
        episodes = await db.content_episodes.find(
            {"series_id": s["series_id"]},
            {"_id": 0}
        ).sort("sort_order", 1).to_list(500)
        s["episodes"] = episodes
    
    return {"container": container, "series": series}


@router.post("/content-containers")
async def create_content_container(data: dict):
    """Create a new content container"""
    db = get_db()
    
    container = {
        "container_id": f"cont_{uuid.uuid4().hex[:12]}",
        "name": data.get("name"),
        "description": data.get("description"),
        "thumbnail": data.get("thumbnail"),
        "cover_image": data.get("cover_image"),
        "category": data.get("category", "mafundisho"),
        "author_id": data.get("author_id"),
        "author_name": data.get("author_name"),
        "author_type": data.get("author_type", "leader"),
        "church_id": data.get("church_id"),
        "church_name": data.get("church_name"),
        "series_count": 0,
        "episodes_count": 0,
        "total_plays": 0,
        "total_duration_minutes": 0,
        "status": data.get("status", "active"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_containers.insert_one(container)
    container.pop("_id", None)
    
    return container


@router.put("/content-containers/{container_id}")
async def update_content_container(container_id: str, data: dict):
    """Update a content container"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("container_id", None)
    
    result = await db.content_containers.update_one(
        {"container_id": container_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Container not found")
    
    return {"message": "Container updated"}


@router.delete("/content-containers/{container_id}")
async def delete_content_container(container_id: str):
    """Delete a content container"""
    db = get_db()
    
    result = await db.content_containers.delete_one({"container_id": container_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Delete related series and episodes
    series = await db.content_series.find({"container_id": container_id}, {"series_id": 1}).to_list(100)
    series_ids = [s["series_id"] for s in series]
    
    await db.content_episodes.delete_many({"series_id": {"$in": series_ids}})
    await db.content_series.delete_many({"container_id": container_id})
    
    return {"message": "Container and all content deleted"}


# ============== CONTENT SERIES ==============

@router.get("/content-series/{series_id}")
async def get_content_series(series_id: str):
    """Get a content series with episodes"""
    db = get_db()
    
    series = await db.content_series.find_one({"series_id": series_id}, {"_id": 0})
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    
    episodes = await db.content_episodes.find(
        {"series_id": series_id},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(500)
    
    return {"series": series, "episodes": episodes}


@router.post("/content-series")
async def create_content_series(data: dict):
    """Create a new content series"""
    db = get_db()
    
    container_id = data.get("container_id")
    
    series = {
        "series_id": f"ser_{uuid.uuid4().hex[:12]}",
        "container_id": container_id,
        "title": data.get("title"),
        "description": data.get("description"),
        "thumbnail": data.get("thumbnail"),
        "sort_order": data.get("sort_order", 0),
        "episodes_count": 0,
        "total_plays": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_series.insert_one(series)
    
    # Update container series count
    await db.content_containers.update_one(
        {"container_id": container_id},
        {"$inc": {"series_count": 1}}
    )
    
    series.pop("_id", None)
    return series


@router.put("/content-series/{series_id}")
async def update_content_series(series_id: str, data: dict):
    """Update a content series"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("series_id", None)
    
    result = await db.content_series.update_one(
        {"series_id": series_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Series not found")
    
    return {"message": "Series updated"}


@router.delete("/content-series/{series_id}")
async def delete_content_series(series_id: str):
    """Delete a content series"""
    db = get_db()
    
    series = await db.content_series.find_one({"series_id": series_id})
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    
    await db.content_series.delete_one({"series_id": series_id})
    await db.content_episodes.delete_many({"series_id": series_id})
    
    # Update container series count
    await db.content_containers.update_one(
        {"container_id": series["container_id"]},
        {"$inc": {"series_count": -1}}
    )
    
    return {"message": "Series deleted"}


# ============== CONTENT EPISODES ==============

@router.get("/content-episodes/{episode_id}")
async def get_content_episode(episode_id: str):
    """Get a single episode"""
    db = get_db()
    
    episode = await db.content_episodes.find_one({"episode_id": episode_id}, {"_id": 0})
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    return episode


@router.post("/content-episodes")
async def create_content_episode(data: dict):
    """Create a new content episode"""
    db = get_db()
    
    series_id = data.get("series_id")
    container_id = data.get("container_id")
    
    episode = {
        "episode_id": f"ep_{uuid.uuid4().hex[:12]}",
        "series_id": series_id,
        "container_id": container_id,
        "title": data.get("title"),
        "description": data.get("description"),
        "audio_url": data.get("audio_url"),
        "duration": data.get("duration"),
        "duration_formatted": data.get("duration_formatted"),
        "sort_order": data.get("sort_order", 0),
        "plays": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.content_episodes.insert_one(episode)
    
    # Update counts
    await db.content_series.update_one(
        {"series_id": series_id},
        {"$inc": {"episodes_count": 1}}
    )
    if container_id:
        await db.content_containers.update_one(
            {"container_id": container_id},
            {"$inc": {"episodes_count": 1}}
        )
    
    episode.pop("_id", None)
    return episode


@router.put("/content-episodes/{episode_id}")
async def update_content_episode(episode_id: str, data: dict):
    """Update a content episode"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("episode_id", None)
    
    result = await db.content_episodes.update_one(
        {"episode_id": episode_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    return {"message": "Episode updated"}


@router.delete("/content-episodes/{episode_id}")
async def delete_content_episode(episode_id: str):
    """Delete a content episode"""
    db = get_db()
    
    episode = await db.content_episodes.find_one({"episode_id": episode_id})
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    await db.content_episodes.delete_one({"episode_id": episode_id})
    
    # Update counts
    await db.content_series.update_one(
        {"series_id": episode["series_id"]},
        {"$inc": {"episodes_count": -1}}
    )
    if episode.get("container_id"):
        await db.content_containers.update_one(
            {"container_id": episode["container_id"]},
            {"$inc": {"episodes_count": -1}}
        )
    
    return {"message": "Episode deleted"}


@router.post("/content-episodes/{episode_id}/play")
async def track_episode_play(episode_id: str):
    """Track episode play"""
    db = get_db()
    
    episode = await db.content_episodes.find_one({"episode_id": episode_id})
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    await db.content_episodes.update_one(
        {"episode_id": episode_id},
        {"$inc": {"plays": 1}}
    )
    
    # Update parent counts
    await db.content_series.update_one(
        {"series_id": episode["series_id"]},
        {"$inc": {"total_plays": 1}}
    )
    if episode.get("container_id"):
        await db.content_containers.update_one(
            {"container_id": episode["container_id"]},
            {"$inc": {"total_plays": 1}}
        )
    
    return {"played": True}


# ============== SPECIAL MIXES ==============

@router.get("/special-mixes")
async def get_special_mixes():
    """Get all special mixes"""
    db = get_db()
    
    mixes = await db.special_mixes.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    
    return {"mixes": mixes}


@router.get("/special-mixes/{mix_id}")
async def get_special_mix(mix_id: str):
    """Get a special mix with songs"""
    db = get_db()
    
    mix = await db.special_mixes.find_one({"mix_id": mix_id}, {"_id": 0})
    if not mix:
        raise HTTPException(status_code=404, detail="Mix not found")
    
    # Get songs
    song_ids = mix.get("song_ids", [])
    songs = await db.songs.find(
        {"song_id": {"$in": song_ids}},
        {"_id": 0}
    ).to_list(500)
    
    return {"mix": mix, "songs": songs}


@router.post("/special-mixes")
async def create_special_mix(data: dict):
    """Create a special mix"""
    db = get_db()
    
    # Handle song data - frontend sends 'songs' array with full objects
    # Extract song_ids from songs array and also store full song objects for display
    songs_data = data.get("songs", [])
    song_ids = []
    songs_list = []
    
    for song in songs_data:
        if isinstance(song, dict):
            song_id = song.get("song_id")
            if song_id:
                song_ids.append(song_id)
                songs_list.append({
                    "song_id": song.get("song_id"),
                    "title": song.get("title"),
                    "album_id": song.get("album_id"),
                    "album_title": song.get("album_title"),
                    "artist_name": song.get("artist_name"),
                    "duration": song.get("duration"),
                    "duration_formatted": song.get("duration_formatted"),
                    "audio_url": song.get("audio_url"),
                    "order": song.get("order", 0)
                })
        elif isinstance(song, str):
            # Legacy format - just song_id strings
            song_ids.append(song)
    
    # Also check for song_ids directly if provided
    if not song_ids and data.get("song_ids"):
        song_ids = data.get("song_ids", [])
    
    # Get title - frontend sends 'title', also check 'name' for backwards compatibility
    title = data.get("title") or data.get("name")
    
    mix = {
        "mix_id": f"mix_{uuid.uuid4().hex[:12]}",
        "title": title,
        "name": title,  # Keep for backwards compatibility
        "name_sw": data.get("name_sw"),
        "description": data.get("description"),
        "thumbnail": data.get("thumbnail"),
        "song_ids": song_ids,
        "songs": songs_list,  # Store full song objects for display
        "songs_count": len(song_ids),
        "category_id": data.get("category_id"),
        "category_name": data.get("category_name"),
        "monetization_type": data.get("monetization_type", "standard"),
        "sort_order": data.get("sort_order", 0),
        "is_featured": data.get("is_featured", False),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.special_mixes.insert_one(mix)
    mix.pop("_id", None)
    
    return mix


@router.put("/special-mixes/{mix_id}")
async def update_special_mix(mix_id: str, data: dict):
    """Update a special mix"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("mix_id", None)
    
    # Handle songs array if provided
    songs_data = data.get("songs", [])
    if songs_data:
        song_ids = []
        songs_list = []
        
        for song in songs_data:
            if isinstance(song, dict):
                song_id = song.get("song_id")
                if song_id:
                    song_ids.append(song_id)
                    songs_list.append({
                        "song_id": song.get("song_id"),
                        "title": song.get("title"),
                        "album_id": song.get("album_id"),
                        "album_title": song.get("album_title"),
                        "artist_name": song.get("artist_name"),
                        "duration": song.get("duration"),
                        "duration_formatted": song.get("duration_formatted"),
                        "audio_url": song.get("audio_url"),
                        "order": song.get("order", 0)
                    })
            elif isinstance(song, str):
                song_ids.append(song)
        
        data["song_ids"] = song_ids
        data["songs"] = songs_list
        data["songs_count"] = len(song_ids)
    elif "song_ids" in data:
        data["songs_count"] = len(data["song_ids"])
    
    # Handle title/name field mapping
    if data.get("title") and not data.get("name"):
        data["name"] = data["title"]
    elif data.get("name") and not data.get("title"):
        data["title"] = data["name"]
    
    result = await db.special_mixes.update_one(
        {"mix_id": mix_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mix not found")
    
    return {"message": "Mix updated"}


@router.delete("/special-mixes/{mix_id}")
async def delete_special_mix(mix_id: str):
    """Delete a special mix"""
    db = get_db()
    
    result = await db.special_mixes.delete_one({"mix_id": mix_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mix not found")
    
    return {"message": "Mix deleted"}


@router.get("/special-mixes/{mix_id}/songs")
async def get_special_mix_songs(mix_id: str):
    """Get songs in a special mix for playback"""
    db = get_db()
    
    mix = await db.special_mixes.find_one({"mix_id": mix_id}, {"_id": 0})
    if not mix:
        raise HTTPException(status_code=404, detail="Special mix not found")
    
    return {
        "mix_id": mix_id,
        "title": mix.get("title"),
        "songs": mix.get("songs", [])
    }


@router.get("/layout/special-mixes")
async def get_special_mixes_for_layout():
    """Get special mixes for layout manager selection"""
    db = get_db()
    
    mixes = await db.special_mixes.find(
        {"status": "active"},
        {"_id": 0, "mix_id": 1, "title": 1, "thumbnail": 1, "songs_count": 1, "is_featured": 1}
    ).to_list(100)
    
    return {"mixes": mixes, "total": len(mixes)}


@router.get("/layout/bible-content")
async def get_bible_content_for_layout():
    """Get bible snippets/devotional cards for layout manager selection"""
    db = get_db()
    
    snippets = await db.bible_snippets.find(
        {"status": "active"},
        {"_id": 0, "snippet_id": 1, "heading": 1, "reference": 1, "verse_ref": 1, "book_name": 1}
    ).to_list(100)
    
    cards = await db.bible_devotional_cards.find(
        {"is_active": True},
        {"_id": 0, "card_id": 1, "heading": 1, "reference": 1, "verse_ref": 1}
    ).to_list(100)
    
    all_content = list(snippets) + list(cards)
    return {"content": all_content, "total": len(all_content)}


# ============== DONATION CAMPAIGNS ==============

@router.get("/donation-campaigns")
async def get_donation_campaigns(status: Optional[str] = None):
    """Get donation campaigns"""
    db = get_db()
    
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["active", "completed"]}
    
    campaigns = await db.donation_campaigns.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .to_list(50)
    
    return {"campaigns": campaigns}


@router.get("/donation-campaigns/{campaign_id}")
async def get_donation_campaign(campaign_id: str):
    """Get a donation campaign"""
    db = get_db()
    
    campaign = await db.donation_campaigns.find_one(
        {"campaign_id": campaign_id},
        {"_id": 0}
    )
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return campaign


@router.post("/donation-campaigns")
async def create_donation_campaign(data: dict):
    """Create a donation campaign"""
    db = get_db()
    
    campaign = {
        "campaign_id": f"camp_{uuid.uuid4().hex[:12]}",
        "title": data.get("title"),
        "description": data.get("description"),
        "thumbnail": data.get("thumbnail"),
        "goal_amount": data.get("goal_amount", 0),
        "raised_amount": 0,
        "church_id": data.get("church_id"),
        "church_name": data.get("church_name"),
        "end_date": data.get("end_date"),
        "donors_count": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.donation_campaigns.insert_one(campaign)
    campaign.pop("_id", None)
    
    return campaign


@router.post("/donation-campaigns/{campaign_id}/donate")
async def donate_to_campaign(campaign_id: str, data: dict):
    """Make a donation to a campaign"""
    db = get_db()
    
    campaign = await db.donation_campaigns.find_one({"campaign_id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    donation = {
        "donation_id": f"don_{uuid.uuid4().hex[:12]}",
        "campaign_id": campaign_id,
        "donor_name": data.get("donor_name", "Anonymous"),
        "donor_email": data.get("donor_email"),
        "donor_phone": data.get("donor_phone"),
        "amount": data.get("amount", 0),
        "message": data.get("message"),
        "is_anonymous": data.get("is_anonymous", False),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.donations.insert_one(donation)
    donation.pop("_id", None)
    
    return donation
