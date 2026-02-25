"""
Branding routes for Gracefy - Logo and brand asset management
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from datetime import datetime, timezone
import uuid
import os
import httpx
import base64

from core.database import get_db
from core.cache import cache

router = APIRouter(prefix="/api", tags=["branding"])

# Default branding settings
DEFAULT_BRANDING = {
    "app_name": "Gracefy",
    "tagline": "Christian Music Streaming",
    "logo_url": "/gracefy-icon.png",
    "logo_with_text_url": "/gracefy-logo-dark.png",
    "favicon_url": "/favicon.ico",
    "primary_color": "#8b5cf6",
    "secondary_color": "#06b6d4",
    "theme": "dark"
}

# Bunny CDN config for uploads
BUNNY_STORAGE_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "gracefy-media")
BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_CDN_URL = os.environ.get("BUNNY_CDN_URL", "https://gracefy-cdn.b-cdn.net")
BUNNY_STORAGE_REGION = os.environ.get("BUNNY_STORAGE_REGION", "de")


@router.get("/branding")
async def get_branding():
    """
    Get current branding settings.
    Used by all pages to fetch logo and brand assets.
    """
    db = get_db()
    
    # Try cache first
    cache_key = "branding:settings"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # Fetch from database
    branding = await db.branding_settings.find_one({"setting_id": "main"}, {"_id": 0})
    
    if not branding:
        # Return defaults
        branding = {**DEFAULT_BRANDING, "setting_id": "main"}
        await db.branding_settings.insert_one(branding)
    
    # Cache for 5 minutes
    await cache.set(cache_key, branding, 300)
    
    return branding


@router.put("/admin/branding")
async def update_branding(data: dict):
    """
    Update branding settings (admin only).
    """
    db = get_db()
    
    # Fields that can be updated
    allowed_fields = [
        "app_name", "tagline", "logo_url", "logo_with_text_url", 
        "favicon_url", "primary_color", "secondary_color", "theme"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.branding_settings.update_one(
        {"setting_id": "main"},
        {"$set": update_data},
        upsert=True
    )
    
    # Clear cache
    await cache.delete("branding:settings")
    
    # Fetch updated settings
    branding = await db.branding_settings.find_one({"setting_id": "main"}, {"_id": 0})
    
    return {
        "success": True,
        "message": "Branding updated successfully",
        "branding": branding
    }


@router.post("/admin/branding/upload-logo")
async def upload_logo(file: UploadFile = File(...), logo_type: str = "icon"):
    """
    Upload a new logo image.
    logo_type: 'icon' (just icon), 'full' (icon + text), 'favicon'
    """
    db = get_db()
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read file content
    content = await file.read()
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"branding/{logo_type}_{uuid.uuid4().hex[:8]}.{ext}"
    
    # Upload to Bunny CDN
    try:
        storage_url = f"https://{BUNNY_STORAGE_REGION}.storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{filename}"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.put(
                storage_url,
                content=content,
                headers={
                    "AccessKey": BUNNY_API_KEY,
                    "Content-Type": file.content_type
                }
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=500, detail=f"Upload failed: {response.text}")
        
        # CDN URL
        cdn_url = f"{BUNNY_CDN_URL}/{filename}"
        
        # Update branding settings
        field_map = {
            "icon": "logo_url",
            "full": "logo_with_text_url",
            "favicon": "favicon_url"
        }
        
        field_name = field_map.get(logo_type, "logo_url")
        
        await db.branding_settings.update_one(
            {"setting_id": "main"},
            {"$set": {
                field_name: cdn_url,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        # Clear cache
        await cache.delete("branding:settings")
        
        return {
            "success": True,
            "url": cdn_url,
            "logo_type": logo_type,
            "field_updated": field_name
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")


@router.post("/admin/branding/upload-logo-url")
async def upload_logo_from_url(data: dict):
    """
    Set logo from an external URL (no upload, just update settings).
    """
    db = get_db()
    
    url = data.get("url")
    logo_type = data.get("logo_type", "icon")
    
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    field_map = {
        "icon": "logo_url",
        "full": "logo_with_text_url",
        "favicon": "favicon_url"
    }
    
    field_name = field_map.get(logo_type, "logo_url")
    
    await db.branding_settings.update_one(
        {"setting_id": "main"},
        {"$set": {
            field_name: url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Clear cache
    await cache.delete("branding:settings")
    
    # Fetch updated settings
    branding = await db.branding_settings.find_one({"setting_id": "main"}, {"_id": 0})
    
    return {
        "success": True,
        "url": url,
        "field_updated": field_name,
        "branding": branding
    }


@router.post("/admin/branding/reset")
async def reset_branding():
    """Reset branding to defaults."""
    db = get_db()
    
    await db.branding_settings.update_one(
        {"setting_id": "main"},
        {"$set": {
            **DEFAULT_BRANDING,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Clear cache
    await cache.delete("branding:settings")
    
    return {
        "success": True,
        "message": "Branding reset to defaults",
        "branding": DEFAULT_BRANDING
    }
