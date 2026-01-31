"""
Bible reading and TTS routes for Gracefy.
Handles Bible content, text-to-speech, and listening tracking.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from typing import Optional
import uuid
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["bible"])


# ============== BIBLE CONTENT ==============

@router.get("/bible/stats")
async def get_bible_stats():
    """Get Bible statistics"""
    db = get_db()
    
    books_count = await db.bible_books.count_documents({})
    verses_count = await db.bible_verses.count_documents({})
    
    # Return both formats for backwards compatibility
    return {
        "books_count": books_count,
        "verses_count": verses_count,
        "book_count": books_count,  # Frontend expects this format
        "verse_count": verses_count,  # Frontend expects this format
        "has_data": books_count > 0
    }


@router.get("/bible/books")
async def get_bible_books():
    """Get list of all Bible books"""
    db = get_db()
    
    cache_key = "bible:books"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    books = await db.bible_books.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    
    result = {"books": books}
    await cache.set(cache_key, result, 3600)
    
    return result


@router.get("/bible/books/{book_name}/chapters")
async def get_book_chapters(book_name: str):
    """Get chapters for a book"""
    db = get_db()
    
    book = await db.bible_books.find_one({"name": book_name}, {"_id": 0})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Support both chapter_count and chapters field names
    chapters = book.get("chapter_count") or book.get("chapters", 0)
    return {"book": book, "chapters": chapters}


@router.get("/bible/books/{book_name}/chapters/{chapter}")
async def get_chapter_verses(book_name: str, chapter: int):
    """Get all verses in a chapter"""
    db = get_db()
    
    cache_key = f"bible:chapter:{book_name}:{chapter}"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # Use book_name field (actual DB field)
    verses = await db.bible_verses.find(
        {"book_name": book_name, "chapter": chapter},
        {"_id": 0}
    ).sort("verse", 1).to_list(200)
    
    result = {"book": book_name, "chapter": chapter, "verses": verses}
    await cache.set(cache_key, result, 3600)
    
    return result


@router.get("/bible/verse/{book_name}/{chapter}/{verse}")
async def get_verse(book_name: str, chapter: int, verse: int):
    """Get a specific verse"""
    db = get_db()
    
    verse_doc = await db.bible_verses.find_one(
        {"book_name": book_name, "chapter": chapter, "verse": verse},
        {"_id": 0}
    )
    
    if not verse_doc:
        raise HTTPException(status_code=404, detail="Verse not found")
    
    return verse_doc


@router.get("/bible/passage/{book_name}/{chapter}/{start_verse}/{end_verse}")
async def get_passage(book_name: str, chapter: int, start_verse: int, end_verse: int):
    """Get a passage (range of verses)"""
    db = get_db()
    
    verses = await db.bible_verses.find(
        {
            "book_name": book_name,
            "chapter": chapter,
            "verse": {"$gte": start_verse, "$lte": end_verse}
        },
        {"_id": 0}
    ).sort("verse", 1).to_list(100)
    
    return {"book": book_name, "chapter": chapter, "verses": verses}


@router.get("/bible/search")
async def search_bible(
    q: str = Query(..., min_length=3),
    limit: int = Query(50, ge=1, le=200)
):
    """Search Bible verses"""
    db = get_db()
    
    # Text search
    verses = await db.bible_verses.find(
        {"text": {"$regex": q, "$options": "i"}},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    return {"query": q, "results": verses, "total": len(verses)}


# ============== TEXT-TO-SPEECH ==============

@router.get("/bible/tts/voices")
async def get_tts_voices():
    """Get available TTS voices"""
    return {
        "voices": [
            {"id": "sw-KE-Female", "name": "Swahili (Kenya) - Female", "language": "sw-KE"},
            {"id": "sw-TZ-Female", "name": "Swahili (Tanzania) - Female", "language": "sw-TZ"},
            {"id": "en-US-Female", "name": "English (US) - Female", "language": "en-US"},
        ],
        "default": "sw-KE-Female"
    }


@router.get("/bible/tts/cache-stats")
async def get_tts_cache_stats():
    """Get TTS cache statistics"""
    db = get_db()
    
    total_cached = await db.bible_tts_cache.count_documents({})
    total_size_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$size_bytes"}}}]
    size_result = await db.bible_tts_cache.aggregate(total_size_pipeline).to_list(1)
    total_size = size_result[0]["total"] if size_result else 0
    
    return {
        "cached_passages": total_cached,
        "total_size_mb": round(total_size / (1024 * 1024), 2)
    }


@router.post("/bible/tts/generate")
async def generate_tts(data: dict):
    """Generate TTS for text"""
    db = get_db()
    
    text = data.get("text")
    voice = data.get("voice", "sw-KE-Female")
    
    if not text:
        raise HTTPException(status_code=400, detail="Text required")
    
    # Check cache
    cache_key = f"bible_tts:{voice}:{hash(text)}"
    cached = await db.bible_tts_cache.find_one({"cache_key": cache_key}, {"_id": 0})
    
    if cached:
        return {"audio_url": cached.get("audio_url"), "cached": True}
    
    # Generate TTS (placeholder - actual implementation would call TTS service)
    audio_url = f"/api/bible/tts/audio/{uuid.uuid4().hex[:12]}"
    
    # Cache result
    await db.bible_tts_cache.insert_one({
        "cache_key": cache_key,
        "text": text,
        "voice": voice,
        "audio_url": audio_url,
        "size_bytes": len(text) * 100,  # Estimate
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"audio_url": audio_url, "cached": False}


@router.post("/bible/tts/verse")
async def generate_verse_tts(data: dict):
    """Generate TTS for a specific verse"""
    db = get_db()
    
    book = data.get("book")
    chapter = data.get("chapter")
    verse = data.get("verse")
    voice = data.get("voice", "sw-KE-Female")
    
    if not all([book, chapter, verse]):
        raise HTTPException(status_code=400, detail="Book, chapter and verse required")
    
    # Get verse text
    verse_doc = await db.bible_verses.find_one(
        {"book": book, "chapter": chapter, "verse": verse},
        {"_id": 0}
    )
    
    if not verse_doc:
        raise HTTPException(status_code=404, detail="Verse not found")
    
    text = verse_doc.get("text", "")
    
    # Check cache
    cache_key = f"bible_tts:verse:{book}:{chapter}:{verse}:{voice}"
    cached = await db.bible_tts_cache.find_one({"cache_key": cache_key}, {"_id": 0})
    
    if cached:
        return {"audio_url": cached.get("audio_url"), "verse": verse_doc, "cached": True}
    
    # Generate TTS placeholder
    audio_url = f"/api/bible/tts/audio/{uuid.uuid4().hex[:12]}"
    
    return {"audio_url": audio_url, "verse": verse_doc, "cached": False}


@router.post("/bible/tts/passage")
async def generate_passage_tts(data: dict):
    """Generate TTS for a passage"""
    db = get_db()
    
    book = data.get("book")
    chapter = data.get("chapter")
    start_verse = data.get("start_verse")
    end_verse = data.get("end_verse")
    voice = data.get("voice", "sw-KE-Female")
    
    if not all([book, chapter, start_verse, end_verse]):
        raise HTTPException(status_code=400, detail="Book, chapter, start and end verse required")
    
    # Get verses
    verses = await db.bible_verses.find(
        {
            "book": book,
            "chapter": chapter,
            "verse": {"$gte": start_verse, "$lte": end_verse}
        },
        {"_id": 0}
    ).sort("verse", 1).to_list(100)
    
    if not verses:
        raise HTTPException(status_code=404, detail="Passage not found")
    
    # Combine text
    text = " ".join([v.get("text", "") for v in verses])
    
    # Check cache
    cache_key = f"bible_tts:passage:{book}:{chapter}:{start_verse}-{end_verse}:{voice}"
    cached = await db.bible_tts_cache.find_one({"cache_key": cache_key}, {"_id": 0})
    
    if cached:
        return {"audio_url": cached.get("audio_url"), "verses": verses, "cached": True}
    
    # Generate TTS placeholder
    audio_url = f"/api/bible/tts/audio/{uuid.uuid4().hex[:12]}"
    
    return {"audio_url": audio_url, "verses": verses, "cached": False}


@router.post("/bible/tts/passage-range")
async def generate_passage_range_tts(data: dict):
    """Generate TTS for passage with range specification"""
    return await generate_passage_tts(data)


# ============== BIBLE SNIPPETS ==============

@router.get("/bible/snippets")
async def get_bible_snippets(
    category: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """Get Bible snippets/daily verses"""
    db = get_db()
    
    query = {"status": "active"}
    if category:
        query["category"] = category
    
    snippets = await db.bible_snippets.find(query, {"_id": 0})\
        .sort("created_at", -1)\
        .limit(limit)\
        .to_list(limit)
    
    return {"snippets": snippets}


@router.get("/bible/snippets/{snippet_id}")
async def get_bible_snippet(snippet_id: str):
    """Get a specific Bible snippet"""
    db = get_db()
    
    snippet = await db.bible_snippets.find_one({"snippet_id": snippet_id}, {"_id": 0})
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    return snippet


@router.get("/bible/featured-snippets")
async def get_featured_snippets():
    """Get featured/daily Bible snippets"""
    db = get_db()
    
    snippets = await db.bible_snippets.find(
        {"is_featured": True, "status": "active"},
        {"_id": 0}
    ).sort("featured_order", 1).limit(5).to_list(5)
    
    return {"snippets": snippets}


# ============== ADMIN BIBLE MANAGEMENT ==============

@router.post("/admin/bible/initialize")
async def initialize_bible():
    """Initialize Bible data (admin only)"""
    return {"message": "Bible initialization not implemented - use data import"}


@router.post("/admin/bible/snippets")
async def create_bible_snippet(data: dict):
    """Create a Bible snippet"""
    db = get_db()
    
    snippet = {
        "snippet_id": f"snippet_{uuid.uuid4().hex[:12]}",
        "title": data.get("title"),
        "reference": data.get("reference"),
        "text": data.get("text"),
        "text_sw": data.get("text_sw"),
        "category": data.get("category", "daily"),
        "is_featured": data.get("is_featured", False),
        "featured_order": data.get("featured_order", 0),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bible_snippets.insert_one(snippet)
    snippet.pop("_id", None)
    
    return snippet


@router.get("/admin/bible/snippets")
async def get_admin_bible_snippets():
    """Get all Bible snippets for admin"""
    db = get_db()
    
    snippets = await db.bible_snippets.find({}, {"_id": 0})\
        .sort("created_at", -1)\
        .to_list(200)
    
    return {"snippets": snippets}


@router.put("/admin/bible/snippets/{snippet_id}")
async def update_bible_snippet(snippet_id: str, data: dict):
    """Update a Bible snippet"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("snippet_id", None)
    
    result = await db.bible_snippets.update_one({"snippet_id": snippet_id}, {"$set": data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    return {"message": "Snippet updated"}


@router.delete("/admin/bible/snippets/{snippet_id}")
async def delete_bible_snippet(snippet_id: str):
    """Delete a Bible snippet"""
    db = get_db()
    
    result = await db.bible_snippets.delete_one({"snippet_id": snippet_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    return {"message": "Snippet deleted"}


@router.get("/admin/bible/settings")
async def get_bible_settings():
    """Get Bible settings"""
    db = get_db()
    
    settings = await db.bible_settings.find_one({"settings_id": "main"}, {"_id": 0})
    
    if not settings:
        settings = {
            "settings_id": "main",
            "default_voice": "sw-KE-Female",
            "auto_play_enabled": True,
            "daily_prompt_enabled": True,
            "prompt_interval_hours": 24
        }
    
    return settings


@router.put("/admin/bible/settings")
async def update_bible_settings(data: dict):
    """Update Bible settings"""
    db = get_db()
    
    data["settings_id"] = "main"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.bible_settings.update_one(
        {"settings_id": "main"},
        {"$set": data},
        upsert=True
    )
    
    return {"message": "Settings updated"}


@router.get("/admin/bible/analytics")
async def get_bible_analytics():
    """Get Bible usage analytics"""
    db = get_db()
    
    total_listeners = await db.bible_listening.count_documents({})
    today = datetime.utcnow().date().isoformat()
    today_listeners = await db.bible_listening.count_documents({"daily_date": today})
    
    # Total listening time
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_seconds"}}}]
    total_result = await db.bible_listening.aggregate(pipeline).to_list(1)
    total_seconds = total_result[0]["total"] if total_result else 0
    
    return {
        "total_listeners": total_listeners,
        "today_listeners": today_listeners,
        "total_listening_hours": round(total_seconds / 3600, 2)
    }


@router.get("/admin/bible/listening-stats")
async def get_bible_listening_stats():
    """Get overall Bible listening statistics"""
    db = get_db()
    
    total_listeners = await db.bible_listening.count_documents({})
    today = datetime.utcnow().date().isoformat()
    today_listeners = await db.bible_listening.count_documents({
        "daily_date": today,
        "daily_seconds": {"$gt": 0}
    })
    
    # Total time
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_seconds"}}}]
    total_result = await db.bible_listening.aggregate(pipeline).to_list(1)
    total_seconds = total_result[0]["total"] if total_result else 0
    
    # Prompts shown today
    prompts_today = await db.bible_listening.count_documents({
        "daily_date": today,
        "prompt_count": {"$gt": 0}
    })
    
    return {
        "total_listeners": total_listeners,
        "today_listeners": today_listeners,
        "total_listening_hours": round(total_seconds / 3600, 2),
        "prompts_shown_today": prompts_today
    }


# ============== LISTENING TRACKING ==============

@router.get("/bible/listening-status")
async def get_listening_status(request: Request):
    """Get Bible listening status for current user"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"has_listened_today": False, "prompt_shown": False}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"has_listened_today": False, "prompt_shown": False}
    
    user_id = token_doc["user_id"]
    today = datetime.utcnow().date().isoformat()
    
    listening = await db.bible_listening.find_one({
        "user_id": user_id,
        "daily_date": today
    }, {"_id": 0})
    
    if listening:
        return {
            "has_listened_today": listening.get("daily_seconds", 0) > 0,
            "prompt_shown": listening.get("prompt_shown_today", False),
            "total_seconds": listening.get("total_seconds", 0),
            "daily_seconds": listening.get("daily_seconds", 0)
        }
    
    return {"has_listened_today": False, "prompt_shown": False}


@router.post("/bible/listening-track")
async def track_bible_listening(request: Request, data: dict):
    """Track Bible listening time"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"tracked": False}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"tracked": False}
    
    user_id = token_doc["user_id"]
    seconds = data.get("seconds", 0)
    today = datetime.utcnow().date().isoformat()
    
    result = await db.bible_listening.update_one(
        {"user_id": user_id, "daily_date": today},
        {
            "$inc": {
                "daily_seconds": seconds,
                "total_seconds": seconds
            },
            "$setOnInsert": {
                "user_id": user_id,
                "daily_date": today,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"tracked": True, "seconds_added": seconds}


@router.post("/bible/listening-history")
async def save_listening_history(request: Request, data: dict):
    """Save Bible listening history entry"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"saved": False}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"saved": False}
    
    user_id = token_doc["user_id"]
    
    history = {
        "history_id": f"bh_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "book": data.get("book"),
        "chapter": data.get("chapter"),
        "verse_start": data.get("verse_start"),
        "verse_end": data.get("verse_end"),
        "duration_seconds": data.get("duration_seconds", 0),
        "completed": data.get("completed", False),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bible_listening_history.insert_one(history)
    
    return {"saved": True}


@router.get("/bible/listening-history/{user_id}")
async def get_user_listening_history(user_id: str):
    """Get Bible listening history for a user"""
    db = get_db()
    
    history = await db.bible_listening_history.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"history": history}


@router.post("/bible/prompt-shown")
async def mark_prompt_shown(request: Request):
    """Mark that Bible listening prompt was shown"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"marked": False}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"marked": False}
    
    user_id = token_doc["user_id"]
    today = datetime.utcnow().date().isoformat()
    
    await db.bible_listening.update_one(
        {"user_id": user_id, "daily_date": today},
        {
            "$set": {"prompt_shown_today": True},
            "$inc": {"prompt_count": 1},
            "$setOnInsert": {
                "user_id": user_id,
                "daily_date": today,
                "daily_seconds": 0,
                "total_seconds": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"marked": True}
