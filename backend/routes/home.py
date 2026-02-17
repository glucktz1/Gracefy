"""
Home routes for Gracefy - User home screen data.
Heavily optimized for initial app load performance.
"""

from fastapi import APIRouter, Query
from typing import Optional
import logging
import asyncio

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["home"])

# Optimized projections - only essential fields for lists
ALBUM_LIST_PROJECTION = {
    "_id": 0,
    "album_id": 1,
    "title": 1,
    "artist_name": 1,
    "thumbnail": 1,
    "songs_count": 1,
    "total_plays": 1,
    "tags": 1,
}

CATEGORY_LIST_PROJECTION = {
    "_id": 0,
    "category_id": 1,
    "name": 1,
    "icon": 1,
}

CHOIR_LIST_PROJECTION = {
    "_id": 0,
    "singer_id": 1,
    "name": 1,
    "thumbnail": 1,
    "followers_count": 1,
}

CHURCH_LIST_PROJECTION = {
    "_id": 0,
    "church_id": 1,
    "name": 1,
    "thumbnail": 1,
    "location": 1,
    "followers_count": 1,
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
            item_id = item.get("album_id") or item.get("song_id") or item.get("mix_id") or item.get("container_id")
            if item_id:
                item["thumbnail"] = f"/api/thumbnails/{item_id}"
                item["thumbnail_type"] = "streaming"
            else:
                item["thumbnail_type"] = "base64"
        elif isinstance(thumb, str) and (thumb.startswith("http") or thumb.startswith("/")):
            item["thumbnail_type"] = "url"
    return items


async def fetch_section_content(db, section: dict) -> dict:
    """
    Fetch content for a single section.
    Optimized with minimal projections and parallel queries.
    """
    section_name = section.get("display_name") or section.get("title") or section.get("name", "")
    section_data = {
        "section_id": section["section_id"],
        "type": section["section_type"],
        "name": section_name,
        "title": section_name,
        "description": section.get("description", ""),
        "section_type": section["section_type"],
        "layout_style": section.get("layout_style", "horizontal_small"),  # Add layout_style for frontend rendering
    }
    
    content_count = section.get("content_count", 10)
    section_type = section["section_type"]
    
    # Custom content IDs take priority
    if section.get("content_ids") and len(section["content_ids"]) > 0:
        content_type = section.get("content_type", "albums")
        
        if content_type == "albums":
            items = await db.albums.find(
                {"album_id": {"$in": section["content_ids"]}, "status": "active"},
                ALBUM_LIST_PROJECTION
            ).to_list(50)
        elif content_type == "categories":
            items = await db.categories.find(
                {"category_id": {"$in": section["content_ids"]}},
                CATEGORY_LIST_PROJECTION
            ).to_list(50)
        elif content_type == "choirs":
            items = await db.singers.find(
                {"singer_id": {"$in": section["content_ids"]}},
                CHOIR_LIST_PROJECTION
            ).to_list(50)
            for item in items:
                item["entity_type"] = "choir"
        elif content_type == "churches":
            items = await db.churches.find(
                {"church_id": {"$in": section["content_ids"]}},
                CHURCH_LIST_PROJECTION
            ).to_list(50)
            for item in items:
                item["entity_type"] = "church"
        elif content_type == "special_mixes":
            items = await db.special_mixes.find(
                {"mix_id": {"$in": section["content_ids"]}},
                {"_id": 0, "mix_id": 1, "title": 1, "thumbnail": 1, "song_count": 1}
            ).to_list(50)
            for item in items:
                item["album_id"] = item["mix_id"]
                item["is_special_mix"] = True
        elif content_type == "teachings":
            # Fetch specific teachings by ID
            items = await db.teachings.find(
                {"teaching_id": {"$in": section["content_ids"]}},
                {"_id": 0, "teaching_id": 1, "title": 1, "title_sw": 1, "thumbnail": 1, 
                 "leader_name": 1, "leader_id": 1, "category_id": 1, "description": 1}
            ).to_list(50)
            # Enrich with topic and lesson counts
            for item in items:
                topic_count = await db.teaching_topics.count_documents({"teaching_id": item["teaching_id"]})
                lesson_count = await db.teaching_lessons.count_documents({"teaching_id": item["teaching_id"]})
                item["topic_count"] = topic_count
                item["lesson_count"] = lesson_count
                item["name"] = item.get("title_sw") or item.get("title", "")
        else:
            items = []
        
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = content_type
        
    # Default content by section type
    elif section_type == "quick_access":
        items = await db.categories.find(
            {"status": "active"},
            CATEGORY_LIST_PROJECTION
        ).limit(content_count).to_list(content_count)
        section_data["items"] = items
        section_data["content_type"] = "categories"
        
    elif section_type in ["featured_albums", "trending"]:
        items = await db.albums.find(
            {"status": "active"},
            ALBUM_LIST_PROJECTION
        ).sort("created_at", -1).limit(content_count).to_list(content_count)
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = "albums"
        
    elif section_type == "choirs":
        items = await db.singers.find(
            {},
            CHOIR_LIST_PROJECTION
        ).sort("followers_count", -1).limit(content_count).to_list(content_count)
        for item in items:
            item["entity_type"] = "choir"
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = "choirs"
        
    elif section_type == "churches":
        items = await db.churches.find(
            {"status": "approved"},
            CHURCH_LIST_PROJECTION
        ).sort("followers_count", -1).limit(content_count).to_list(content_count)
        for item in items:
            item["entity_type"] = "church"
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = "churches"
        
    elif section_type == "special_mixes":
        items = await db.special_mixes.find(
            {"status": "active"},
            {"_id": 0, "mix_id": 1, "title": 1, "thumbnail": 1, "songs": 1}
        ).sort("created_at", -1).limit(content_count).to_list(content_count)
        for item in items:
            item["album_id"] = item["mix_id"]
            item["is_special_mix"] = True
            item["song_count"] = len(item.get("songs", []))
            item.pop("songs", None)  # Remove songs array after counting
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = "special_mixes"
        
    elif section_type in ["sermons", "teachings", "mafundisho"]:
        # Fetch teachings with topics and lesson counts
        teachings = await db.teachings.find(
            {"status": "published"},
            {"_id": 0, "teaching_id": 1, "title": 1, "title_sw": 1, "thumbnail": 1, 
             "leader_name": 1, "leader_id": 1, "category_id": 1, "description": 1}
        ).sort("created_at", -1).limit(content_count).to_list(content_count)
        
        # Enrich with topic and lesson counts
        for teaching in teachings:
            topic_count = await db.teaching_topics.count_documents({"teaching_id": teaching["teaching_id"]})
            lesson_count = await db.teaching_lessons.count_documents({"teaching_id": teaching["teaching_id"]})
            teaching["topic_count"] = topic_count
            teaching["lesson_count"] = lesson_count
            # Use title_sw as primary title for display
            teaching["name"] = teaching.get("title_sw") or teaching.get("title", "")
        
        section_data["items"] = optimize_thumbnails(teachings)
        section_data["content_type"] = "teachings"
        
    elif section_type == "hero":
        section_data["background"] = section.get("background_gradient") or section.get("background_color")
        if section.get("content_ids"):
            items = await db.albums.find(
                {"album_id": {"$in": section["content_ids"]}, "status": "active"},
                ALBUM_LIST_PROJECTION
            ).to_list(10)
            section_data["items"] = optimize_thumbnails(items)
        else:
            section_data["items"] = []
        section_data["content_type"] = "albums"
        
    else:
        section_data["items"] = []
        section_data["content_type"] = "unknown"
    
    return section_data


@router.get("/user/home")
async def get_user_home():
    """
    Get home screen data for the mobile app.
    
    OPTIMIZED FOR PERFORMANCE:
    - Aggressive caching (60 seconds)
    - Parallel section queries
    - Minimal field projections
    - Truncated base64 thumbnails
    """
    db = get_db()
    
    # Check cache first
    cache_key = "home:app:main:v2"
    cached_result = await cache.get(cache_key)
    if cached_result:
        logger.debug("Home data served from cache")
        return cached_result
    
    # Get active layout sections
    sections = await db.layout_sections.find(
        {"platforms": "app", "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(20)
    
    # Fetch all section content in parallel for better performance
    section_tasks = [fetch_section_content(db, section) for section in sections]
    home_data = await asyncio.gather(*section_tasks)
    
    # Get burners and hero in parallel
    burners_task = db.layout_burners.find(
        {"platforms": "app", "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(5)
    
    hero_config_task = db.hero_config.find_one({"config_id": "main"}, {"_id": 0})
    
    burners, hero_config = await asyncio.gather(burners_task, hero_config_task)
    
    # Build hero content
    hero_content = {
        "hero_type": "static_banner",
        "auto_rotate": True,
        "rotation_interval": 5000,
        "show_navigation": True,
        "items": []
    }
    
    if hero_config:
        hero_content["hero_type"] = hero_config.get("hero_type", "static_banner")
        hero_content["auto_rotate"] = hero_config.get("auto_rotate", True)
        hero_content["rotation_interval"] = hero_config.get("rotation_interval", 5000)
        hero_content["show_navigation"] = hero_config.get("show_navigation", True)
        
        if hero_config.get("hero_type") == "dynamic_content" and hero_config.get("content_ids"):
            albums = await db.albums.find(
                {"album_id": {"$in": hero_config["content_ids"]}, "status": "active"},
                ALBUM_LIST_PROJECTION
            ).to_list(10)
            hero_content["items"] = optimize_thumbnails(albums)
        else:
            banners = await db.hero_banners.find(
                {"is_active": True},
                {"_id": 0}
            ).sort("order", 1).to_list(10)
            hero_content["items"] = banners
    else:
        banners = await db.hero_banners.find(
            {"is_active": True},
            {"_id": 0}
        ).sort("order", 1).to_list(10)
        hero_content["items"] = banners
    
    response_data = {
        "sections": home_data,
        "burners": burners,
        "hero": hero_content
    }
    
    # Cache for 60 seconds
    await cache.set(cache_key, response_data, 60)
    
    logger.debug(f"Home data generated with {len(home_data)} sections")
    return response_data


@router.get("/home/app")
async def get_home_app():
    """
    Alias for /user/home - Mobile app home endpoint.
    Returns home screen data for the mobile app.
    """
    return await get_user_home()


@router.get("/user/home/quick")
async def get_user_home_quick():
    """
    Lightweight home endpoint - returns only essential data.
    Use this for faster initial load, then fetch details lazily.
    """
    db = get_db()
    
    cache_key = "home:app:quick"
    cached_result = await cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # Only fetch featured albums and categories
    albums_task = db.albums.find(
        {"status": "active"},
        ALBUM_LIST_PROJECTION
    ).sort("created_at", -1).limit(10).to_list(10)
    
    categories_task = db.categories.find(
        {"status": "active"},
        CATEGORY_LIST_PROJECTION
    ).limit(6).to_list(6)
    
    albums, categories = await asyncio.gather(albums_task, categories_task)
    
    result = {
        "featured_albums": optimize_thumbnails(albums),
        "categories": categories,
    }
    
    await cache.set(cache_key, result, 60)
    
    return result


@router.get("/app/download-info")
async def get_app_download_info():
    """Get app download information for web popup"""
    db = get_db()
    
    # Get app download settings from database
    settings = await db.app_settings.find_one({"settings_id": "app_download"}, {"_id": 0})
    
    if not settings:
        # Default settings
        settings = {
            "settings_id": "app_download",
            "android_url": "https://play.google.com/store/apps/details?id=com.spiritsongs.app",
            "ios_url": "https://apps.apple.com/app/gracefy",
            "direct_apk_url": "https://expo.dev/artifacts/eas/nLuShV8eraRvjp1zmFyEbf.apk",
            "message_sw": "Kupakua nyimbo unazotaka na kuzifurahia bila mtandao, pakua app ya Gracefy!",
            "message_en": "Download songs you want and enjoy them offline, download the Gracefy app!",
            "button_text_sw": "Bonyeza hapa kupakua",
            "button_text_en": "Click here to download",
            "enabled": True
        }
        # Save default settings
        await db.app_settings.insert_one(settings)
    
    return settings


@router.put("/admin/app/download-settings")
async def update_app_download_settings(data: dict):
    """Update app download settings (admin only)"""
    db = get_db()
    from datetime import datetime, timezone
    
    update_fields = {}
    allowed_fields = [
        "android_url", "ios_url", "direct_apk_url", 
        "message_sw", "message_en", 
        "button_text_sw", "button_text_en", "enabled"
    ]
    
    for field in allowed_fields:
        if field in data:
            update_fields[field] = data[field]
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.app_settings.update_one(
            {"settings_id": "app_download"},
            {"$set": update_fields},
            upsert=True
        )
    
    settings = await db.app_settings.find_one({"settings_id": "app_download"}, {"_id": 0})
    return settings


@router.get("/layout/sections")
async def get_layout_sections(
    platform: str = Query("app", description="Platform: app or web"),
    type: Optional[str] = None
):
    """Get layout sections for a platform."""
    db = get_db()
    
    query = {"platforms": platform, "is_active": True}
    if type:
        query["section_type"] = type
    
    sections = await db.layout_sections.find(query, {"_id": 0})\
        .sort("sort_order", 1)\
        .to_list(30)
    
    return {"sections": sections}
