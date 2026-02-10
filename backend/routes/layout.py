"""
Layout management routes for Gracefy.
Handles home page sections, burners, hero configuration.
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging

from core.database import get_db
from core.cache import cache
try:
    from core.redis_cache import invalidate_home_cache
except ImportError:
    async def invalidate_home_cache():
        pass

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["layout"])

# Default sections for initialization
DEFAULT_SECTIONS = [
    {"name": "hero", "display_name": "Featured Content", "section_type": "hero", "sort_order": 0},
    {"name": "quick_access", "display_name": "Makundi", "display_name_en": "Categories", "section_type": "quick_access", "sort_order": 1},
    {"name": "featured_albums", "display_name": "Nyimbo Mpya", "display_name_en": "New Music", "section_type": "featured_albums", "sort_order": 2},
    {"name": "choirs", "display_name": "Kwaya Maarufu", "display_name_en": "Popular Choirs", "section_type": "choirs", "sort_order": 3},
    {"name": "churches", "display_name": "Makanisa", "display_name_en": "Churches", "section_type": "churches", "sort_order": 4},
    {"name": "special_mixes", "display_name": "Makusanyo Maalum", "display_name_en": "Special Mixes", "section_type": "special_mixes", "sort_order": 5},
    {"name": "trending", "display_name": "Zinazotrendii", "display_name_en": "Trending", "section_type": "trending", "sort_order": 6},
]


# ============== SECTIONS ==============

@router.get("/layout/sections")
async def get_layout_sections(
    platform: str = Query("app", description="Platform: app or web"),
    type: Optional[str] = None,
    include_inactive: bool = Query(False, description="Include inactive sections (for admin)")
):
    """Get layout sections for a platform"""
    db = get_db()
    
    query = {"platforms": platform}
    # Only filter by is_active if not including inactive (for admin panel)
    if not include_inactive:
        query["is_active"] = True
    if type:
        query["section_type"] = type
    
    sections = await db.layout_sections.find(query, {"_id": 0})\
        .sort("sort_order", 1)\
        .to_list(50)
    
    return {"sections": sections}


@router.get("/layout/sections/{section_id}")
async def get_section(section_id: str):
    """Get a specific section"""
    db = get_db()
    
    section = await db.layout_sections.find_one({"section_id": section_id}, {"_id": 0})
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    return section


@router.post("/layout/sections")
async def create_section(data: dict):
    """Create a new layout section"""
    db = get_db()
    
    section = {
        "section_id": f"section_{uuid.uuid4().hex[:12]}",
        "name": data.get("name", ""),
        "display_name": data.get("display_name", ""),
        "display_name_en": data.get("display_name_en"),
        "section_type": data.get("section_type", "custom"),
        "layout_style": data.get("layout_style", "horizontal_small"),  # horizontal_small, horizontal_large, grid, vertical_list
        "description": data.get("description"),
        "platforms": data.get("platforms", ["app", "web"]),
        "is_active": data.get("is_active", True),
        "sort_order": data.get("sort_order", 0),
        "content_type": data.get("content_type"),
        "content_ids": data.get("content_ids", []),
        "content_count": data.get("content_count", 10),
        "content_source": data.get("content_source", "manual"),
        "background_image": data.get("background_image"),
        "background_color": data.get("background_color"),
        "background_gradient": data.get("background_gradient"),
        "link_type": data.get("link_type"),
        "link_target": data.get("link_target"),
        "schedule_start": data.get("schedule_start"),
        "schedule_end": data.get("schedule_end"),
        "clicks_count": 0,
        "views_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.layout_sections.insert_one(section)
    await invalidate_home_cache()
    section.pop("_id", None)
    
    return section


@router.put("/layout/sections/{section_id}")
async def update_section(section_id: str, data: dict):
    """Update a layout section"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("section_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    
    await invalidate_home_cache()
    return {"message": "Section updated successfully"}


@router.delete("/layout/sections/{section_id}")
async def delete_section(section_id: str):
    """Delete a layout section"""
    db = get_db()
    
    result = await db.layout_sections.delete_one({"section_id": section_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    
    await invalidate_home_cache()
    return {"message": "Section deleted successfully"}


@router.post("/layout/sections/reorder")
async def reorder_sections(data: dict):
    """Reorder sections by updating sort_order"""
    db = get_db()
    
    # Support both "section_ids" and "section_order" for compatibility
    section_ids = data.get("section_ids") or data.get("section_order", [])
    
    if not section_ids:
        raise HTTPException(status_code=400, detail="No section IDs provided")
    
    for index, section_id in enumerate(section_ids):
        await db.layout_sections.update_one(
            {"section_id": section_id},
            {"$set": {"sort_order": index}}
        )
    
    await invalidate_home_cache()
    return {"message": "Sections reordered successfully", "updated": len(section_ids)}


@router.post("/layout/sections/sync-defaults")
async def sync_default_sections():
    """Sync default sections (create if not exists)"""
    db = get_db()
    
    created = 0
    for section_data in DEFAULT_SECTIONS:
        existing = await db.layout_sections.find_one({"name": section_data["name"]})
        if not existing:
            section = {
                "section_id": f"section_{uuid.uuid4().hex[:12]}",
                **section_data,
                "platforms": ["app", "web"],
                "is_active": True,
                "content_ids": [],
                "content_count": 10,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.layout_sections.insert_one(section)
            created += 1
    
    return {"message": f"Synced default sections. Created {created} new sections."}


@router.post("/layout/sections/reset-all")
async def reset_all_sections():
    """Reset all sections to defaults (destructive)"""
    db = get_db()
    
    await db.layout_sections.delete_many({})
    
    for section_data in DEFAULT_SECTIONS:
        section = {
            "section_id": f"section_{uuid.uuid4().hex[:12]}",
            **section_data,
            "platforms": ["app", "web"],
            "is_active": True,
            "content_ids": [],
            "content_count": 10,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.layout_sections.insert_one(section)
    
    await invalidate_home_cache()
    return {"message": "All sections reset to defaults"}


@router.put("/layout/sections/{section_id}/toggle")
async def toggle_section(section_id: str):
    """Toggle section active status"""
    db = get_db()
    
    section = await db.layout_sections.find_one({"section_id": section_id})
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    new_status = not section.get("is_active", True)
    
    await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$set": {"is_active": new_status}}
    )
    
    await invalidate_home_cache()
    return {"message": f"Section {'activated' if new_status else 'deactivated'}", "is_active": new_status}


@router.post("/layout/sections/{section_id}/assign-content")
async def assign_section_content(section_id: str, data: dict):
    """Assign content to a section"""
    db = get_db()
    
    content_ids = data.get("content_ids", [])
    content_type = data.get("content_type")
    
    result = await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$set": {
            "content_ids": content_ids,
            "content_type": content_type,
            "content_source": "manual",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    
    await invalidate_home_cache()
    return {"message": "Content assigned successfully"}


# ============== BURNERS (Promotional Banners) ==============

@router.get("/layout/burners")
async def get_burners(
    platform: str = Query("app"),
    active_only: bool = Query(True)
):
    """Get promotional burners"""
    db = get_db()
    
    query = {"platforms": platform}
    if active_only:
        query["is_active"] = True
    
    burners = await db.layout_burners.find(query, {"_id": 0})\
        .sort("sort_order", 1)\
        .to_list(20)
    
    return {"burners": burners}


@router.get("/layout/burners/{burner_id}")
async def get_burner(burner_id: str):
    """Get a specific burner"""
    db = get_db()
    
    burner = await db.layout_burners.find_one({"burner_id": burner_id}, {"_id": 0})
    if not burner:
        raise HTTPException(status_code=404, detail="Burner not found")
    
    return burner


@router.post("/layout/burners")
async def create_burner(data: dict):
    """Create a new promotional burner"""
    db = get_db()
    
    burner = {
        "burner_id": f"burner_{uuid.uuid4().hex[:12]}",
        "name": data.get("name", ""),
        "icon": data.get("icon"),
        "icon_color": data.get("icon_color", "#a855f7"),
        "headline": data.get("headline", ""),
        "subtitle": data.get("subtitle"),
        "cta_text": data.get("cta_text", ""),
        "cta_link": data.get("cta_link", ""),
        "cta_link_type": data.get("cta_link_type", "page"),
        "background_type": data.get("background_type", "gradient"),
        "background_color": data.get("background_color", "#1e1b4b"),
        "background_gradient": data.get("background_gradient"),
        "background_image": data.get("background_image"),
        "text_color": data.get("text_color", "#ffffff"),
        "button_style": data.get("button_style", "solid"),
        "button_color": data.get("button_color", "#ffffff"),
        "button_text_color": data.get("button_text_color", "#000000"),
        "border_radius": data.get("border_radius", "16px"),
        "platforms": data.get("platforms", ["app", "web"]),
        "is_active": data.get("is_active", True),
        "sort_order": data.get("sort_order", 0),
        "section_id": data.get("section_id"),
        "schedule_start": data.get("schedule_start"),
        "schedule_end": data.get("schedule_end"),
        "clicks_count": 0,
        "impressions_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.layout_burners.insert_one(burner)
    await invalidate_home_cache()
    burner.pop("_id", None)
    
    return burner


@router.put("/layout/burners/{burner_id}")
async def update_burner(burner_id: str, data: dict):
    """Update a burner"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("burner_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Burner not found")
    
    await invalidate_home_cache()
    return {"message": "Burner updated successfully"}


@router.delete("/layout/burners/{burner_id}")
async def delete_burner(burner_id: str):
    """Delete a burner"""
    db = get_db()
    
    result = await db.layout_burners.delete_one({"burner_id": burner_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Burner not found")
    
    await invalidate_home_cache()
    return {"message": "Burner deleted successfully"}


@router.put("/layout/burners/{burner_id}/toggle")
async def toggle_burner(burner_id: str):
    """Toggle burner active status"""
    db = get_db()
    
    burner = await db.layout_burners.find_one({"burner_id": burner_id})
    if not burner:
        raise HTTPException(status_code=404, detail="Burner not found")
    
    new_status = not burner.get("is_active", True)
    
    await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$set": {"is_active": new_status}}
    )
    
    await invalidate_home_cache()
    return {"message": f"Burner {'activated' if new_status else 'deactivated'}", "is_active": new_status}


# ============== HERO CONFIGURATION ==============

@router.get("/layout/hero-config")
async def get_hero_config():
    """Get hero section configuration"""
    db = get_db()
    
    config = await db.hero_config.find_one({"config_id": "main"}, {"_id": 0})
    
    if not config:
        config = {
            "config_id": "main",
            "hero_type": "static_banner",
            "auto_rotate": True,
            "rotation_interval": 5000,
            "show_navigation": True,
            "content_ids": []
        }
    
    return config


@router.post("/layout/hero-config")
async def save_hero_config(data: dict):
    """Save hero section configuration"""
    db = get_db()
    
    config = {
        "config_id": "main",
        "hero_type": data.get("hero_type", "static_banner"),
        "auto_rotate": data.get("auto_rotate", True),
        "rotation_interval": data.get("rotation_interval", 5000),
        "show_navigation": data.get("show_navigation", True),
        "content_ids": data.get("content_ids", []),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.hero_config.update_one(
        {"config_id": "main"},
        {"$set": config},
        upsert=True
    )
    
    await invalidate_home_cache()
    return {"message": "Hero configuration saved"}


@router.post("/layout/hero-banner")
async def create_hero_banner(data: dict):
    """Create a new hero banner"""
    db = get_db()
    
    banner = {
        "banner_id": f"banner_{uuid.uuid4().hex[:12]}",
        "title": data.get("title", ""),
        "subtitle": data.get("subtitle"),
        "image_url": data.get("image_url"),
        "link_type": data.get("link_type"),
        "link_target": data.get("link_target"),
        "is_active": data.get("is_active", True),
        "order": data.get("order", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.hero_banners.insert_one(banner)
    await invalidate_home_cache()
    banner.pop("_id", None)
    
    return banner


@router.get("/layout/hero-banners")
async def get_hero_banners():
    """Get all hero banners"""
    db = get_db()
    
    banners = await db.hero_banners.find({}, {"_id": 0}).sort("order", 1).to_list(20)
    return {"banners": banners}


@router.put("/layout/hero-banner/{banner_id}")
async def update_hero_banner(banner_id: str, data: dict):
    """Update a hero banner"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("banner_id", None)
    
    result = await db.hero_banners.update_one({"banner_id": banner_id}, {"$set": data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    await invalidate_home_cache()
    return {"message": "Banner updated"}


@router.delete("/layout/hero-banner/{banner_id}")
async def delete_hero_banner(banner_id: str):
    """Delete a hero banner"""
    db = get_db()
    
    result = await db.hero_banners.delete_one({"banner_id": banner_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner not found")
    
    await invalidate_home_cache()
    return {"message": "Banner deleted"}


@router.get("/layout/hero-content")
async def get_hero_content():
    """
    Get hero content for the mobile app carousel.
    Returns featured albums or custom banners based on hero config.
    Each item includes link_type and link_target for navigation.
    Note: Large base64 thumbnails are stripped for performance - use external image_url.
    """
    db = get_db()
    
    # Get hero config
    config = await db.hero_config.find_one({"config_id": "main"}, {"_id": 0})
    hero_type = config.get("hero_type", "album_carousel") if config else "album_carousel"
    
    response = {
        "hero_type": hero_type,
        "auto_rotate": config.get("auto_rotate", True) if config else True,
        "rotation_interval": config.get("rotation_interval", 5000) if config else 5000,
        "show_navigation": config.get("show_navigation", True) if config else True,
        "items": []
    }
    
    # Helper function to clean large base64 data
    def clean_base64(url):
        if url and isinstance(url, str) and url.startswith('data:') and len(url) > 5000:
            return None  # Will use placeholder
        return url
    
    if hero_type == "album_carousel" or hero_type == "static_banner":
        # Get featured albums
        albums = await db.albums.find(
            {"status": "active"},
            {"_id": 0, "album_id": 1, "title": 1, "thumbnail": 1, "thumbnail_url": 1, 
             "artist_name": 1, "choir_name": 1, "description": 1, "release_date": 1}
        ).sort("created_at", -1).limit(6).to_list(6)
        
        for album in albums:
            # Prefer URL over base64 for performance
            thumbnail = clean_base64(album.get("thumbnail_url")) or clean_base64(album.get("thumbnail"))
            album["thumbnail"] = thumbnail
            album["artist_name"] = album.get("artist_name") or album.get("choir_name") or "Unknown"
            # Add navigation metadata for album items
            album["link_type"] = "album"
            album["link_target"] = album.get("album_id")
        
        response["items"] = albums
    else:
        # Get custom banners - they already have link_type and link_target
        banners = await db.hero_banners.find(
            {"is_active": True},
            {"_id": 0}
        ).sort("order", 1).to_list(10)
        
        # Process banners - strip large base64 thumbnails for performance
        for banner in banners:
            # Clean all image fields
            banner["image_url"] = clean_base64(banner.get("image_url"))
            banner["thumbnail"] = clean_base64(banner.get("thumbnail"))
            # Use first available image
            banner["thumbnail"] = banner.get("thumbnail") or banner.get("image_url")
        
        response["items"] = banners
    
    return response


# ============== HOME FILTERS ==============

@router.get("/layout/home-filters")
async def get_home_filters():
    """Get home screen filter configuration"""
    db = get_db()
    
    # Check cache
    cached = await cache.get("home_filters")
    if cached:
        return cached
    
    # Get all song categories
    all_categories = await db.song_categories.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(50)
    
    # Get filter config
    filter_config = await db.home_filter_config.find_one({"config_id": "main"}, {"_id": 0})
    
    if filter_config:
        enabled_ids = set(filter_config.get("enabled_filter_ids", []))
        for cat in all_categories:
            cat["enabled"] = cat.get("song_category_id") in enabled_ids
    else:
        for cat in all_categories:
            cat["enabled"] = True
    
    result = {"filters": all_categories, "config": filter_config}
    await cache.set("home_filters", result, 120)
    
    return result


@router.post("/layout/home-filters")
async def create_home_filter(data: dict):
    """Create a new home filter category"""
    db = get_db()
    
    filter_id = f"filter_{uuid.uuid4().hex[:12]}"
    
    filter_cat = {
        "song_category_id": filter_id,
        "filter_id": filter_id,  # Alias for frontend compatibility
        "name": data.get("name"),
        "name_en": data.get("name_en", data.get("name")),
        "name_sw": data.get("name_sw", data.get("name")),
        "description": data.get("description", ""),
        "filter_type": data.get("filter_type", "song_category"),
        "category_id": data.get("category_id", ""),
        "content_type": data.get("content_type", ""),
        "color": data.get("color", "#6366f1"),
        "icon": data.get("icon", "music"),
        "sort_order": data.get("sort_order", 0),
        "is_system": False,
        "is_active": data.get("is_active", True),
        "status": "active" if data.get("is_active", True) else "inactive",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.song_categories.insert_one(filter_cat)
    await cache.delete("home_filters")
    filter_cat.pop("_id", None)
    
    return filter_cat


@router.put("/layout/home-filters/{filter_id}")
async def update_home_filter(filter_id: str, data: dict):
    """Update a home filter category"""
    db = get_db()
    
    data.pop("_id", None)
    data.pop("song_category_id", None)
    
    result = await db.song_categories.update_one(
        {"song_category_id": filter_id},
        {"$set": data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    await cache.delete("home_filters")
    return {"message": "Filter updated"}


@router.put("/layout/home-filters/{filter_id}/toggle")
async def toggle_home_filter(filter_id: str, data: dict):
    """Toggle a home filter's active status"""
    db = get_db()
    
    is_active = data.get("is_active", True)
    status = "active" if is_active else "inactive"
    
    result = await db.song_categories.update_one(
        {"song_category_id": filter_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    await cache.delete("home_filters")
    return {"message": f"Filter {'activated' if is_active else 'deactivated'}"}


@router.delete("/layout/home-filters/{filter_id}")
async def delete_home_filter(filter_id: str):
    """Delete a home filter category"""
    db = get_db()
    
    # Don't allow deleting system filters
    filter_cat = await db.song_categories.find_one({"song_category_id": filter_id})
    if filter_cat and filter_cat.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system filter")
    
    result = await db.song_categories.delete_one({"song_category_id": filter_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Filter not found")
    
    await cache.delete("home_filters")
    return {"message": "Filter deleted"}


@router.put("/layout/home-filters-config")
async def update_home_filters_config(data: dict):
    """Update which filters are enabled on home screen"""
    db = get_db()
    
    config = {
        "config_id": "main",
        "enabled_filter_ids": data.get("enabled_filter_ids", []),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.home_filter_config.update_one(
        {"config_id": "main"},
        {"$set": config},
        upsert=True
    )
    
    await cache.delete("home_filters")
    await invalidate_home_cache()
    
    return {"message": "Filter configuration updated"}


# ============== ANALYTICS TRACKING ==============

@router.post("/layout/sections/{section_id}/track-click")
async def track_section_click(section_id: str):
    """Track click on a section"""
    db = get_db()
    
    await db.layout_sections.update_one(
        {"section_id": section_id},
        {"$inc": {"clicks_count": 1}}
    )
    return {"tracked": True}


@router.post("/layout/burners/{burner_id}/track-click")
async def track_burner_click(burner_id: str):
    """Track click on a burner"""
    db = get_db()
    
    await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$inc": {"clicks_count": 1}}
    )
    return {"tracked": True}


@router.post("/layout/burners/{burner_id}/track-impression")
async def track_burner_impression(burner_id: str):
    """Track impression of a burner"""
    db = get_db()
    
    await db.layout_burners.update_one(
        {"burner_id": burner_id},
        {"$inc": {"impressions_count": 1}}
    )
    return {"tracked": True}
