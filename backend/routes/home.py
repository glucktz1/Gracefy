"""
Home routes for Gracefy - User home screen data.
Heavily optimized for initial app load performance.
"""

from fastapi import APIRouter, Query, Request
from typing import Optional
from datetime import datetime, timezone
import logging
import asyncio

from core.database import get_db
from core.cache import cache
from services.redis_service import (
    get_cached_home_data,
    set_cached_home_data
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["home"])


@router.get("/debug/home-status")
async def debug_home_status():
    """Debug endpoint to check home data status"""
    db = get_db()
    
    # Count documents
    albums_count = db.albums.count_documents({"status": "active"})
    songs_count = db.songs.count_documents({})
    categories_count = db.categories.count_documents({})
    sections_count = db.layout_sections.count_documents({"is_active": True})
    radio_count = db.radio_stations.count_documents({})
    
    # Check Redis cache
    redis_cached = await get_cached_home_data("web")
    
    return {
        "status": "ok",
        "database": {
            "albums_active": albums_count,
            "songs": songs_count,
            "categories": categories_count,
            "active_sections": sections_count,
            "radio_stations": radio_count
        },
        "redis_cache": "exists" if redis_cached else "empty",
        "message": "If you see this, API is working correctly"
    }


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
        "sort_order": section.get("sort_order", 99),  # Include sort_order for frontend ordering
        "is_active": section.get("is_active", True),  # Include active status
    }
    
    content_count = section.get("content_count", 10)
    section_type = section["section_type"]
    
    # Category mapping: old category IDs <-> song category IDs
    category_mapping = {
        "cat_9912003e1414": "songcat_593f7c13c64a",  # Christimas Songs -> Krismasi
        "cat_66de3ce04e18": "songcat_593f7c13c64a",  # Christmas -> Krismasi
        "cat_f3cce0507446": "songcat_f13791e16795",  # Kwaresma(lent) -> Kwaresma
        "songcat_593f7c13c64a": ["cat_9912003e1414", "cat_66de3ce04e18"],  # Krismasi
        "songcat_f13791e16795": ["cat_f3cce0507446"],  # Kwaresma
    }
    
    # If section has a linked category, fetch albums from that category
    # This works for sections with content_source='category' OR sections with link_category_id set
    # BUT only for album-type sections, not for teachings
    link_category_id = section.get("link_category_id") or section.get("category_id")
    
    # Check if this section should fetch ALBUMS by category (only for album-type sections)
    should_fetch_albums_by_category = link_category_id and (
        section.get("content_type") == "albums" or 
        section_type in ["featured_albums", "trending", "seasonal"]
    ) and section_type not in ["teachings", "sermons", "mafundisho"]
    
    if should_fetch_albums_by_category:
        # Build list of category IDs to search (including mapped ones)
        category_ids = [link_category_id]
        if link_category_id in category_mapping:
            mapped = category_mapping[link_category_id]
            if isinstance(mapped, list):
                category_ids.extend(mapped)
            else:
                category_ids.append(mapped)
        
        # Fetch albums that belong to the linked category
        items = await db.albums.find(
            {
                "$or": [
                    {"category_id": {"$in": category_ids}},
                    {"song_category_id": {"$in": category_ids}}
                ],
                "status": "active"
            },
            ALBUM_LIST_PROJECTION
        ).sort("total_plays", -1).limit(content_count).to_list(content_count)
        for item in items:
            item["entity_type"] = "album"
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = "albums"
        return section_data
    
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
        
    elif section_type == "trending":
        # Trending shows most played albums based on total_plays or stream counts
        section_name_lower = section.get("name", "").lower()
        
        if "most_listened" in section_name_lower or "zilizosikilizwa" in section.get("display_name_sw", "").lower():
            # Most listened - sort by total_plays descending
            items = await db.albums.find(
                {"status": "active", "total_plays": {"$gt": 0}},
                ALBUM_LIST_PROJECTION
            ).sort("total_plays", -1).limit(content_count).to_list(content_count)
            
            # If no albums with plays, get recent albums
            if not items:
                items = await db.albums.find(
                    {"status": "active"},
                    ALBUM_LIST_PROJECTION
                ).sort("created_at", -1).limit(content_count).to_list(content_count)
        else:
            # Default trending - most played
            items = await db.albums.find(
                {"status": "active"},
                ALBUM_LIST_PROJECTION
            ).sort("total_plays", -1).limit(content_count).to_list(content_count)
        
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = "albums"
        
    elif section_type == "featured_albums":
        # Featured albums without a linked category - return empty to avoid showing unrelated content
        # Admins should configure link_category_id or content_ids for this section type
        logger.warning(f"Section '{section_name}' has type 'featured_albums' but no link_category_id or content_ids configured")
        section_data["items"] = []
        section_data["content_type"] = "albums"
        
    elif section_type == "seasonal":
        # Seasonal sections without a linked category - return empty
        # Admins should configure link_category_id for seasonal content
        logger.warning(f"Section '{section_name}' has type 'seasonal' but no link_category_id configured")
        section_data["items"] = []
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
    
    elif section_type == "custom":
        # Handle custom section types based on content_type
        custom_content_type = section.get("content_type", "")
        
        if custom_content_type == "radio":
            # Fetch radio stations (status field may not exist)
            items = await db.radio_stations.find(
                {"$or": [{"status": "active"}, {"status": None}, {"status": {"$exists": False}}]},
                {"_id": 0, "station_id": 1, "name": 1, "thumbnail": 1, "stream_url": 1, "description": 1}
            ).sort("listeners_count", -1).limit(content_count).to_list(content_count)
            for item in items:
                item["entity_type"] = "radio"
            section_data["items"] = optimize_thumbnails(items)
            section_data["content_type"] = "radio"
            
        elif custom_content_type == "songs":
            # Fetch all songs
            items = await db.songs.find(
                {"status": "active"},
                {"_id": 0, "song_id": 1, "title": 1, "thumbnail": 1, "artist_name": 1, "album_id": 1, "duration": 1, "play_count": 1}
            ).sort("created_at", -1).limit(content_count).to_list(content_count)
            
            # Enrich songs with album thumbnails if song doesn't have its own
            album_ids = list(set([s.get("album_id") for s in items if s.get("album_id")]))
            albums_map = {}
            if album_ids:
                albums = await db.albums.find(
                    {"album_id": {"$in": album_ids}},
                    {"_id": 0, "album_id": 1, "thumbnail": 1, "artist_name": 1}
                ).to_list(len(album_ids))
                albums_map = {a["album_id"]: a for a in albums}
            
            for item in items:
                item["entity_type"] = "song"
                # Use album thumbnail if song doesn't have one
                if not item.get("thumbnail") and item.get("album_id"):
                    album = albums_map.get(item["album_id"])
                    if album:
                        item["thumbnail"] = album.get("thumbnail")
                        if not item.get("artist_name"):
                            item["artist_name"] = album.get("artist_name")
            
            section_data["items"] = optimize_thumbnails(items)
            section_data["content_type"] = "songs"
        else:
            section_data["items"] = []
            section_data["content_type"] = "custom"
        
    elif section_type == "bible_content":
        # Fetch bible snippets/content
        items = await db.bible_snippets.find(
            {},
            {"_id": 0, "snippet_id": 1, "title": 1, "content": 1, "book": 1, "chapter": 1, "verse": 1, "thumbnail": 1}
        ).sort("created_at", -1).limit(content_count).to_list(content_count)
        for item in items:
            item["entity_type"] = "bible"
        section_data["items"] = optimize_thumbnails(items)
        section_data["content_type"] = "bible_content"
    
    elif section_type in ["sermons", "teachings", "mafundisho"]:
        # Build query - filter by category if link_category_id or link_category_ids is set
        query = {"status": "published"}
        
        # Support both single and multiple category IDs
        link_category_ids = section.get("link_category_ids", [])
        link_category_id = section.get("link_category_id")
        
        if link_category_ids:
            query["song_category_id"] = {"$in": link_category_ids}
        elif link_category_id:
            query["song_category_id"] = link_category_id
        
        # Fetch teachings with topics and lesson counts
        teachings = await db.teachings.find(
            query,
            {"_id": 0, "teaching_id": 1, "title": 1, "title_sw": 1, "thumbnail": 1, 
             "leader_name": 1, "leader_id": 1, "category_id": 1, "song_category_id": 1, "description": 1}
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
async def get_user_home(platform: str = Query("app", enum=["app", "web"])):
    """
    Get home screen data for app or web.
    
    OPTIMIZED FOR PERFORMANCE:
    - Redis caching (3 minutes TTL) with in-memory fallback
    - Parallel section queries
    - Minimal field projections
    - Truncated base64 thumbnails
    """
    # Try Redis cache first (faster, distributed)
    redis_cached = await get_cached_home_data(platform)
    if redis_cached:
        logger.debug(f"Home data ({platform}) served from Redis cache")
        return redis_cached
    
    db = get_db()
    
    # Fallback to in-memory cache
    cache_key = f"home:{platform}:main:v4"
    cached_result = await cache.get(cache_key)
    if cached_result:
        logger.debug(f"Home data ({platform}) served from memory cache")
        # Also populate Redis cache for next request
        await set_cached_home_data(platform, cached_result)
        return cached_result
    
    # Get active layout sections for the specified platform
    sections = await db.layout_sections.find(
        {"platforms": platform, "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(20)
    
    # Fetch all section content in parallel for better performance
    section_tasks = [fetch_section_content(db, section) for section in sections]
    home_data = await asyncio.gather(*section_tasks)
    
    # Get burners and hero in parallel
    burners_task = db.layout_burners.find(
        {"platforms": platform, "is_active": True},
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
    
    # Cache in both Redis (distributed) and memory (fast local)
    await set_cached_home_data(platform, response_data)
    await cache.set(cache_key, response_data, 120)
    
    logger.debug(f"Home data generated with {len(home_data)} sections")
    return response_data


@router.get("/home/app")
async def get_home_app():
    """
    Alias for /user/home - Mobile app home endpoint.
    Returns home screen data for the mobile app.
    """
    return await get_user_home(platform="app")


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


@router.get("/user/home/geo")
async def get_geo_filtered_home(
    request: Request,
    user_id: Optional[str] = None,
    country: Optional[str] = None,
    platform: str = Query("app", enum=["app", "web"])
):
    """
    Get home feed filtered by user's country.
    Falls back to default content if no country-specific content exists.
    
    Priority: user_country param > user profile > IP detection
    """
    db = get_db()
    
    # Import geo functions
    from routes.geo_content import get_client_ip, get_country_from_ip, DEFAULT_COUNTRY
    
    # Determine user's country
    if country:
        user_country = country.upper()
    elif user_id:
        # Check user profile for country override
        user = await db.app_users.find_one(
            {"user_id": user_id},
            {"_id": 0, "country_override": 1, "country_code": 1}
        )
        if user:
            user_country = user.get("country_override") or user.get("country_code") or DEFAULT_COUNTRY
        else:
            user_country = DEFAULT_COUNTRY
    else:
        # Detect from IP
        client_ip = get_client_ip(request)
        user_country = await get_country_from_ip(client_ip)
    
    # Cache key includes country and platform
    cache_key = f"home:geo:{user_country}:{platform}:v1"
    cached_result = await cache.get(cache_key)
    if cached_result:
        cached_result["from_cache"] = True
        return cached_result
    
    # Get content IDs tagged for this country
    country_content_ids = await db.content_country.distinct(
        "content_id",
        {"country_code": user_country}
    )
    
    # Also include GLOBAL content
    global_content_ids = await db.content_country.distinct(
        "content_id",
        {"country_code": "GLOBAL"}
    )
    
    allowed_content_ids = list(set(country_content_ids + global_content_ids))
    using_fallback = len(allowed_content_ids) == 0
    
    # Get active layout sections for the specified platform
    sections = await db.layout_sections.find(
        {"platforms": platform, "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(20)
    
    home_data = []
    
    for section in sections:
        section_type = section.get("section_type", "")
        section_data = {
            "section_id": section.get("section_id"),
            "section_type": section_type,
            "title": section.get("title", ""),
            "show_see_all": section.get("show_see_all", True),
            "display_type": section.get("display_type", "horizontal_scroll")
        }
        
        content_count = section.get("content_count", 10)
        
        # Apply geo-filter for album-based sections
        if section_type in ["featured_albums", "new_releases", "top_albums", "albums"]:
            # If geo filtering is enabled but no content is tagged
            # OR there's no geo setup at all, show all content
            query = {"status": "active"}
            
            if allowed_content_ids and not using_fallback:
                # Only apply geo filter if we have valid geo content IDs
                query["$or"] = [
                    {"album_id": {"$in": allowed_content_ids}},
                    {"is_geo_default": True},
                    {"country_codes": {"$exists": False}},  # Include content with no country restrictions
                    {"country_codes": {"$in": ["GLOBAL", user_country]}}
                ]
            # else: show all active content (no additional filter)
            
            # Use category filter if section has linked category
            link_category_id = section.get("link_category_id")
            if link_category_id:
                query["$or"] = [
                    {"category_id": link_category_id},
                    {"song_category_id": link_category_id}
                ]
            
            items = await db.albums.find(
                query,
                ALBUM_LIST_PROJECTION
            ).sort("total_plays", -1).limit(content_count).to_list(content_count)
            
            section_data["items"] = optimize_thumbnails(items)
            section_data["content_type"] = "albums"
            
        elif section_type in ["trending", "most_played"]:
            query = {"status": "active"}
            
            # Same logic - be permissive with geo filtering
            if allowed_content_ids and not using_fallback:
                query["$or"] = [
                    {"album_id": {"$in": allowed_content_ids}},
                    {"is_geo_default": True},
                    {"country_codes": {"$exists": False}},
                    {"country_codes": {"$in": ["GLOBAL", user_country]}}
                ]
            
            items = await db.albums.find(
                query,
                ALBUM_LIST_PROJECTION
            ).sort("total_plays", -1).limit(content_count).to_list(content_count)
            
            section_data["items"] = optimize_thumbnails(items)
            section_data["content_type"] = "albums"
            
        else:
            # For non-album sections, use standard fetching
            section_content = await fetch_section_content(db, section)
            section_data = section_content
        
        home_data.append(section_data)
    
    # Get hero content (not geo-filtered)
    hero_config = await db.hero_config.find_one({"config_id": "main"}, {"_id": 0})
    hero_content = {
        "hero_type": "static_banner",
        "auto_rotate": True,
        "rotation_interval": 5000,
        "items": []
    }
    
    if hero_config:
        hero_content["hero_type"] = hero_config.get("hero_type", "static_banner")
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
    
    # Get burners
    burners = await db.layout_burners.find(
        {"platforms": "app", "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(5)
    
    # Track geo analytics
    import uuid
    await db.geo_analytics.insert_one({
        "event_id": f"geo_evt_{uuid.uuid4().hex[:12]}",
        "event_type": "feed_request",
        "user_id": user_id,
        "country_code": user_country,
        "content_type": "home_feed",
        "results_count": sum(len(s.get("items", [])) for s in home_data),
        "used_fallback": using_fallback,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    response_data = {
        "sections": home_data,
        "hero": hero_content,
        "burners": burners,
        "user_country": user_country,
        "using_fallback": using_fallback,
        "from_cache": False
    }
    
    # Cache for 60 seconds
    await cache.set(cache_key, response_data, 60)
    
    return response_data


@router.get("/user/section/{section_id}")
async def get_section_content(
    section_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None)
):
    """
    Get all content for a specific section with pagination and search.
    Used for "See All" functionality on both web and mobile.
    """
    db = get_db()
    
    # Find section configuration
    section = await db.layout_sections.find_one({"section_id": section_id}, {"_id": 0})
    if not section:
        # Try by name as fallback
        section = await db.layout_sections.find_one({"name": section_id}, {"_id": 0})
    
    if not section:
        return {"items": [], "total": 0, "page": page, "limit": limit, "message": "Section not found"}
    
    skip = (page - 1) * limit
    items = []
    total = 0
    content_type = section.get("content_type", "albums")
    section_type = section.get("section_type", "")
    link_category_id = section.get("link_category_id")
    content_ids = section.get("content_ids", [])
    
    # Build search query
    search_query = {}
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        search_query = {"$or": [
            {"title": search_regex},
            {"name": search_regex},
            {"artist_name": search_regex},
        ]}
    
    # Category mapping for old vs new category IDs
    category_mapping = {
        "cat_f3cce0507446": ["songcat_f13791e16795"],  # Lent
        "songcat_f13791e16795": ["cat_f3cce0507446"],
    }
    
    # Determine content source
    if content_ids and len(content_ids) > 0:
        # Manual content IDs
        if content_type == "albums":
            query = {"album_id": {"$in": content_ids}, "status": "active"}
            if search_query:
                query.update(search_query)
            total = await db.albums.count_documents(query)
            items = await db.albums.find(query, ALBUM_LIST_PROJECTION).skip(skip).limit(limit).to_list(limit)
        elif content_type == "choirs":
            query = {"singer_id": {"$in": content_ids}}
            if search_query:
                query.update(search_query)
            total = await db.singers.count_documents(query)
            items = await db.singers.find(query, CHOIR_LIST_PROJECTION).skip(skip).limit(limit).to_list(limit)
        elif content_type == "churches":
            query = {"church_id": {"$in": content_ids}}
            if search_query:
                query.update(search_query)
            total = await db.churches.count_documents(query)
            items = await db.churches.find(query, CHURCH_LIST_PROJECTION).skip(skip).limit(limit).to_list(limit)
        elif content_type == "teachings":
            query = {"teaching_id": {"$in": content_ids}}
            if search_query:
                query.update(search_query)
            total = await db.teachings.count_documents(query)
            items = await db.teachings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
        elif content_type == "special_mixes":
            query = {"mix_id": {"$in": content_ids}}
            if search_query:
                query.update(search_query)
            total = await db.special_mixes.count_documents(query)
            items = await db.special_mixes.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
            
    elif link_category_id:
        # Category linked content
        category_ids = [link_category_id]
        if link_category_id in category_mapping:
            mapped = category_mapping[link_category_id]
            if isinstance(mapped, list):
                category_ids.extend(mapped)
            else:
                category_ids.append(mapped)
        
        query = {
            "$or": [
                {"category_id": {"$in": category_ids}},
                {"song_category_id": {"$in": category_ids}}
            ],
            "status": "active"
        }
        if search_query:
            query = {"$and": [query, search_query]}
        
        total = await db.albums.count_documents(query)
        items = await db.albums.find(query, ALBUM_LIST_PROJECTION).sort("total_plays", -1).skip(skip).limit(limit).to_list(limit)
        content_type = "albums"
        
    elif section_type == "featured_choirs":
        query = search_query if search_query else {}
        total = await db.singers.count_documents(query)
        items = await db.singers.find(query, CHOIR_LIST_PROJECTION).sort("followers_count", -1).skip(skip).limit(limit).to_list(limit)
        content_type = "choirs"
        
    elif section_type == "churches":
        query = search_query if search_query else {}
        total = await db.churches.count_documents(query)
        items = await db.churches.find(query, CHURCH_LIST_PROJECTION).sort("followers_count", -1).skip(skip).limit(limit).to_list(limit)
        content_type = "churches"
        
    elif section_type == "trending":
        query = {"status": "active"}
        if search_query:
            query.update(search_query)
        total = await db.albums.count_documents(query)
        items = await db.albums.find(query, ALBUM_LIST_PROJECTION).sort("total_plays", -1).skip(skip).limit(limit).to_list(limit)
        content_type = "albums"
        
    elif section_type in ["featured_albums", "seasonal", "new_releases"]:
        query = {"status": "active"}
        if search_query:
            query.update(search_query)
        total = await db.albums.count_documents(query)
        items = await db.albums.find(query, ALBUM_LIST_PROJECTION).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        content_type = "albums"
        
    elif section_type == "special_mixes":
        query = search_query if search_query else {}
        total = await db.special_mixes.count_documents(query)
        items = await db.special_mixes.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
        content_type = "special_mixes"
        
    elif section_type == "teachings":
        query = search_query if search_query else {}
        total = await db.teachings.count_documents(query)
        items = await db.teachings.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
        content_type = "teachings"
    
    # Add entity_type to items
    for item in items:
        if content_type == "albums":
            item["entity_type"] = "album"
        elif content_type == "choirs":
            item["entity_type"] = "choir"
        elif content_type == "churches":
            item["entity_type"] = "church"
        elif content_type == "teachings":
            item["entity_type"] = "teaching"
        elif content_type == "special_mixes":
            item["entity_type"] = "special_mix"
    
    return {
        "section": {
            "section_id": section.get("section_id"),
            "name": section.get("name"),
            "title": section.get("title"),
            "section_type": section_type,
            "content_type": content_type
        },
        "items": optimize_thumbnails(items),
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": total > (skip + len(items))
    }

