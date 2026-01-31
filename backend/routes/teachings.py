"""
Teachings and Reflections routes for Gracefy.
Manages religious teachings (Mafundisho na Tafakari) with topics and lessons.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from datetime import datetime, timezone
from typing import Optional
import uuid
import base64

from core.database import get_db

router = APIRouter(prefix="/api", tags=["teachings"])

# Teaching Categories
TEACHING_CATEGORIES = [
    {"id": "ndoa", "name": "Mafundisho ya Ndoa", "name_en": "Marriage Teachings"},
    {"id": "katekesi", "name": "Katekesi", "name_en": "Catechism"},
    {"id": "tafakari", "name": "Tafakari ya Neno", "name_en": "Word Reflection"},
    {"id": "maisha", "name": "Maisha ya Kiroho", "name_en": "Spiritual Life"},
    {"id": "familia", "name": "Familia ya Kikristo", "name_en": "Christian Family"},
    {"id": "vijana", "name": "Mafundisho kwa Vijana", "name_en": "Youth Teachings"},
    {"id": "sala", "name": "Maisha ya Sala", "name_en": "Prayer Life"},
    {"id": "other", "name": "Mengineyo", "name_en": "Others"},
]

# Monetization Types
MONETIZATION_TYPES = [
    {"id": "free", "name": "Bure", "name_en": "Free"},
    {"id": "premium", "name": "Premium", "name_en": "Premium"},
    {"id": "donation", "name": "Mchango", "name_en": "Donation Based"},
]


@router.get("/teachings/categories")
async def get_teaching_categories():
    """Get available teaching categories"""
    return {"categories": TEACHING_CATEGORIES}


@router.get("/teachings/monetization-types")
async def get_monetization_types():
    """Get available monetization types"""
    return {"types": MONETIZATION_TYPES}


@router.get("/teachings/stats")
async def get_teachings_stats():
    """Get teachings statistics"""
    db = get_db()
    
    total_teachings = await db.teachings.count_documents({})
    total_topics = await db.teaching_topics.count_documents({})
    total_lessons = await db.teaching_lessons.count_documents({})
    published = await db.teachings.count_documents({"status": "published"})
    draft = await db.teachings.count_documents({"status": "draft"})
    
    # Category breakdown
    category_pipeline = [
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}}
    ]
    category_stats = await db.teachings.aggregate(category_pipeline).to_list(20)
    
    return {
        "total_teachings": total_teachings,
        "total_topics": total_topics,
        "total_lessons": total_lessons,
        "published": published,
        "draft": draft,
        "by_category": {item["_id"]: item["count"] for item in category_stats if item["_id"]}
    }


@router.get("/teachings")
async def get_teachings(
    category: Optional[str] = None,
    leader_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all teachings with optional filters"""
    db = get_db()
    
    query = {}
    if category:
        query["category_id"] = category
    if leader_id:
        query["leader_id"] = leader_id
    if status:
        query["status"] = status
    
    teachings = await db.teachings.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.teachings.count_documents(query)
    
    # Enrich with topic and lesson counts
    for teaching in teachings:
        topic_count = await db.teaching_topics.count_documents({"teaching_id": teaching["teaching_id"]})
        teaching["topic_count"] = topic_count
    
    return {"teachings": teachings, "total": total}


@router.get("/teachings/{teaching_id}")
async def get_teaching(teaching_id: str):
    """Get a single teaching with its topics and lessons"""
    db = get_db()
    
    teaching = await db.teachings.find_one({"teaching_id": teaching_id}, {"_id": 0})
    if not teaching:
        raise HTTPException(status_code=404, detail="Teaching not found")
    
    # Get topics with their lessons
    topics = await db.teaching_topics.find(
        {"teaching_id": teaching_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    for topic in topics:
        lessons = await db.teaching_lessons.find(
            {"topic_id": topic["topic_id"]},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
        topic["lessons"] = lessons
    
    teaching["topics"] = topics
    return teaching


@router.post("/teachings")
async def create_teaching(data: dict):
    """Create a new teaching"""
    db = get_db()
    
    teaching = {
        "teaching_id": f"teach_{uuid.uuid4().hex[:12]}",
        "title": data.get("title"),
        "title_sw": data.get("title_sw"),
        "description": data.get("description"),
        "description_sw": data.get("description_sw"),
        "thumbnail": data.get("thumbnail"),
        "leader_id": data.get("leader_id"),
        "leader_name": data.get("leader_name"),
        "category_id": data.get("category_id"),
        "category_name": data.get("category_name"),
        "monetization_type": data.get("monetization_type", "free"),
        "release_date": data.get("release_date"),
        "status": data.get("status", "draft"),
        "is_featured": data.get("is_featured", False),
        "view_count": 0,
        "listen_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.teachings.insert_one(teaching)
    teaching.pop("_id", None)
    
    return teaching


@router.put("/teachings/{teaching_id}")
async def update_teaching(teaching_id: str, data: dict):
    """Update a teaching"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("teaching_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.teachings.update_one(
        {"teaching_id": teaching_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Teaching not found")
    
    return {"message": "Teaching updated"}


@router.delete("/teachings/{teaching_id}")
async def delete_teaching(teaching_id: str):
    """Delete a teaching and all its topics and lessons"""
    db = get_db()
    
    # Get all topics for this teaching
    topics = await db.teaching_topics.find({"teaching_id": teaching_id}).to_list(100)
    
    # Delete all lessons for all topics
    for topic in topics:
        await db.teaching_lessons.delete_many({"topic_id": topic["topic_id"]})
    
    # Delete all topics
    await db.teaching_topics.delete_many({"teaching_id": teaching_id})
    
    # Delete the teaching
    result = await db.teachings.delete_one({"teaching_id": teaching_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Teaching not found")
    
    return {"message": "Teaching and all its content deleted"}


# ============== TOPICS (MADA) ==============

@router.get("/teachings/{teaching_id}/topics")
async def get_teaching_topics(teaching_id: str):
    """Get all topics for a teaching"""
    db = get_db()
    
    topics = await db.teaching_topics.find(
        {"teaching_id": teaching_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # Get lesson count for each topic
    for topic in topics:
        lesson_count = await db.teaching_lessons.count_documents({"topic_id": topic["topic_id"]})
        topic["lesson_count"] = lesson_count
    
    return {"topics": topics}


@router.post("/teachings/{teaching_id}/topics")
async def create_topic(teaching_id: str, data: dict):
    """Create a new topic (Mada) for a teaching"""
    db = get_db()
    
    # Check teaching exists
    teaching = await db.teachings.find_one({"teaching_id": teaching_id})
    if not teaching:
        raise HTTPException(status_code=404, detail="Teaching not found")
    
    # Get next order number
    last_topic = await db.teaching_topics.find_one(
        {"teaching_id": teaching_id},
        sort=[("order", -1)]
    )
    next_order = (last_topic["order"] + 1) if last_topic else 1
    
    topic = {
        "topic_id": f"topic_{uuid.uuid4().hex[:12]}",
        "teaching_id": teaching_id,
        "title": data.get("title"),
        "title_sw": data.get("title_sw") or f"Mada ya {next_order}",
        "description": data.get("description"),
        "order": data.get("order", next_order),
        "status": data.get("status", "draft"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.teaching_topics.insert_one(topic)
    topic.pop("_id", None)
    
    return topic


@router.put("/teachings/{teaching_id}/topics/{topic_id}")
async def update_topic(teaching_id: str, topic_id: str, data: dict):
    """Update a topic"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("topic_id", None)
    data.pop("teaching_id", None)
    
    result = await db.teaching_topics.update_one(
        {"topic_id": topic_id, "teaching_id": teaching_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    return {"message": "Topic updated"}


@router.delete("/teachings/{teaching_id}/topics/{topic_id}")
async def delete_topic(teaching_id: str, topic_id: str):
    """Delete a topic and all its lessons"""
    db = get_db()
    
    # Delete all lessons for this topic
    await db.teaching_lessons.delete_many({"topic_id": topic_id})
    
    # Delete the topic
    result = await db.teaching_topics.delete_one({"topic_id": topic_id, "teaching_id": teaching_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    return {"message": "Topic and all its lessons deleted"}


# ============== LESSONS (SEHEMU/LESSON) ==============

@router.get("/teachings/{teaching_id}/topics/{topic_id}/lessons")
async def get_topic_lessons(teaching_id: str, topic_id: str):
    """Get all lessons for a topic"""
    db = get_db()
    
    lessons = await db.teaching_lessons.find(
        {"topic_id": topic_id},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"lessons": lessons}


@router.post("/teachings/{teaching_id}/topics/{topic_id}/lessons")
async def create_lesson(teaching_id: str, topic_id: str, data: dict):
    """Create a new lesson (Sehemu) for a topic"""
    db = get_db()
    
    # Check topic exists
    topic = await db.teaching_topics.find_one({"topic_id": topic_id, "teaching_id": teaching_id})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    # Get next order number
    last_lesson = await db.teaching_lessons.find_one(
        {"topic_id": topic_id},
        sort=[("order", -1)]
    )
    next_order = (last_lesson["order"] + 1) if last_lesson else 1
    
    lesson = {
        "lesson_id": f"lesson_{uuid.uuid4().hex[:12]}",
        "topic_id": topic_id,
        "teaching_id": teaching_id,
        "title": data.get("title") or f"Lesson {next_order}",
        "title_sw": data.get("title_sw") or f"Sehemu ya {next_order}",
        "description": data.get("description"),
        "audio_url": data.get("audio_url"),
        "audio_file_id": data.get("audio_file_id"),
        "duration": data.get("duration", 0),
        "duration_formatted": data.get("duration_formatted", "0:00"),
        "order": data.get("order", next_order),
        "status": data.get("status", "draft"),
        "listen_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.teaching_lessons.insert_one(lesson)
    lesson.pop("_id", None)
    
    return lesson


@router.put("/teachings/{teaching_id}/topics/{topic_id}/lessons/{lesson_id}")
async def update_lesson(teaching_id: str, topic_id: str, lesson_id: str, data: dict):
    """Update a lesson"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("lesson_id", None)
    data.pop("topic_id", None)
    data.pop("teaching_id", None)
    
    result = await db.teaching_lessons.update_one(
        {"lesson_id": lesson_id, "topic_id": topic_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return {"message": "Lesson updated"}


@router.delete("/teachings/{teaching_id}/topics/{topic_id}/lessons/{lesson_id}")
async def delete_lesson(teaching_id: str, topic_id: str, lesson_id: str):
    """Delete a lesson"""
    db = get_db()
    
    result = await db.teaching_lessons.delete_one({"lesson_id": lesson_id, "topic_id": topic_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    return {"message": "Lesson deleted"}


# ============== AUDIO UPLOAD ==============

@router.post("/teachings/upload-audio")
async def upload_teaching_audio(
    file: UploadFile = File(...),
    lesson_id: str = Form(None),
    topic_id: str = Form(None),
    teaching_id: str = Form(None)
):
    """Upload audio file for a lesson"""
    db = get_db()
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Check file size (max 50MB)
    if file_size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50MB")
    
    # Create file record
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    file_doc = {
        "file_id": file_id,
        "filename": file.filename,
        "content_type": file.content_type or "audio/mpeg",
        "size_bytes": file_size,
        "data": base64.b64encode(content).decode('utf-8'),
        "upload_type": "teaching_audio",
        "teaching_id": teaching_id,
        "topic_id": topic_id,
        "lesson_id": lesson_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.files.insert_one(file_doc)
    
    audio_url = f"/api/files/{file_id}/stream"
    
    # If lesson_id provided, update the lesson
    if lesson_id:
        await db.teaching_lessons.update_one(
            {"lesson_id": lesson_id},
            {"$set": {
                "audio_url": audio_url,
                "audio_file_id": file_id
            }}
        )
    
    return {
        "file_id": file_id,
        "url": audio_url,
        "filename": file.filename,
        "size_bytes": file_size
    }


# ============== BULK LESSON CREATION ==============

@router.post("/teachings/{teaching_id}/topics/{topic_id}/lessons/bulk")
async def create_lessons_bulk(teaching_id: str, topic_id: str, data: dict):
    """Create multiple lessons at once"""
    db = get_db()
    
    # Check topic exists
    topic = await db.teaching_topics.find_one({"topic_id": topic_id, "teaching_id": teaching_id})
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    
    lessons_data = data.get("lessons", [])
    created_lessons = []
    
    # Get current max order
    last_lesson = await db.teaching_lessons.find_one(
        {"topic_id": topic_id},
        sort=[("order", -1)]
    )
    current_order = (last_lesson["order"] if last_lesson else 0)
    
    for i, lesson_data in enumerate(lessons_data):
        current_order += 1
        lesson = {
            "lesson_id": f"lesson_{uuid.uuid4().hex[:12]}",
            "topic_id": topic_id,
            "teaching_id": teaching_id,
            "title": lesson_data.get("title") or f"Lesson {current_order}",
            "title_sw": lesson_data.get("title_sw") or f"Sehemu ya {current_order}",
            "description": lesson_data.get("description"),
            "audio_url": lesson_data.get("audio_url"),
            "audio_file_id": lesson_data.get("audio_file_id"),
            "duration": lesson_data.get("duration", 0),
            "duration_formatted": lesson_data.get("duration_formatted", "0:00"),
            "order": current_order,
            "status": "draft",
            "listen_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.teaching_lessons.insert_one(lesson)
        lesson.pop("_id", None)
        created_lessons.append(lesson)
    
    return {"lessons": created_lessons, "count": len(created_lessons)}


# ============== STATISTICS ==============

@router.get("/teachings/stats")
async def get_teachings_stats():
    """Get teachings statistics"""
    db = get_db()
    
    total_teachings = await db.teachings.count_documents({})
    total_topics = await db.teaching_topics.count_documents({})
    total_lessons = await db.teaching_lessons.count_documents({})
    published = await db.teachings.count_documents({"status": "published"})
    draft = await db.teachings.count_documents({"status": "draft"})
    
    # Category breakdown
    category_pipeline = [
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}}
    ]
    category_stats = await db.teachings.aggregate(category_pipeline).to_list(20)
    
    return {
        "total_teachings": total_teachings,
        "total_topics": total_topics,
        "total_lessons": total_lessons,
        "published": published,
        "draft": draft,
        "by_category": {item["_id"]: item["count"] for item in category_stats if item["_id"]}
    }
