"""
CDN Management Routes - Data audit, migration, and cleanup tools
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from datetime import datetime, timezone
from typing import Optional, List
import os
import logging
import httpx
import asyncio
import base64
import uuid

from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["cdn-management"])

# CDN Config
BUNNY_STORAGE_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "gracefy-media")
BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_CDN_URL = os.environ.get("BUNNY_CDN_URL", "https://gracefy-cdn.b-cdn.net")
BUNNY_STORAGE_REGION = os.environ.get("BUNNY_STORAGE_REGION", "de")


def is_cdn_enabled():
    return bool(BUNNY_API_KEY and BUNNY_STORAGE_ZONE)


async def check_url_accessible(url: str, timeout: float = 10.0) -> dict:
    """Check if a URL is accessible"""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.head(url, headers={"User-Agent": "Gracefy-Audit/1.0"})
            return {
                "accessible": response.status_code == 200,
                "status_code": response.status_code,
                "content_length": response.headers.get("Content-Length", "0")
            }
    except httpx.TimeoutException:
        return {"accessible": False, "status_code": 0, "error": "timeout"}
    except Exception as e:
        return {"accessible": False, "status_code": 0, "error": str(e)}


# ============== DATA AUDIT ==============

@router.get("/admin/cdn/audit/songs")
async def audit_song_audio_urls(
    test_urls: bool = Query(False, description="Actually test if URLs are accessible (slower)"),
    limit: int = Query(0, description="Limit songs to audit (0 = all)")
):
    """
    Comprehensive audit of all song audio URLs.
    Categorizes songs by their audio URL status.
    """
    db = get_db()
    
    # Get all songs
    query = {}
    songs_cursor = db.songs.find(query, {
        "_id": 0, 
        "song_id": 1, 
        "title": 1, 
        "album_id": 1,
        "audio_url": 1, 
        "file_url": 1,
        "status": 1
    })
    
    if limit > 0:
        songs_cursor = songs_cursor.limit(limit)
    
    songs = await songs_cursor.to_list(10000)
    
    # Categorize songs
    results = {
        "total_songs": len(songs),
        "categories": {
            "cdn_url": [],           # Has CDN URL (https://...cdn...)
            "internal_file_url": [], # Has /api/files/... URL
            "base64_audio": [],      # Has base64 audio data
            "no_audio_url": [],      # No audio URL at all
            "other_url": [],         # Other URL format
        },
        "cdn_accessibility": {
            "accessible": [],
            "forbidden_403": [],
            "not_found_404": [],
            "other_error": [],
            "not_tested": []
        },
        "summary": {}
    }
    
    # Check each song
    for song in songs:
        audio_url = song.get("audio_url") or song.get("file_url") or ""
        song_info = {
            "song_id": song.get("song_id"),
            "title": song.get("title"),
            "album_id": song.get("album_id"),
            "audio_url": audio_url[:100] if audio_url else None,  # Truncate for display
            "status": song.get("status", "unknown")
        }
        
        # Categorize by URL type
        if not audio_url or audio_url.strip() == "":
            results["categories"]["no_audio_url"].append(song_info)
        elif audio_url.startswith("data:audio"):
            results["categories"]["base64_audio"].append(song_info)
        elif "cdn" in audio_url.lower() or audio_url.startswith("https://gracefy-cdn"):
            results["categories"]["cdn_url"].append(song_info)
            
            # Test accessibility if requested
            if test_urls:
                check = await check_url_accessible(audio_url)
                song_info["check_result"] = check
                if check["accessible"]:
                    results["cdn_accessibility"]["accessible"].append(song_info)
                elif check.get("status_code") == 403:
                    results["cdn_accessibility"]["forbidden_403"].append(song_info)
                elif check.get("status_code") == 404:
                    results["cdn_accessibility"]["not_found_404"].append(song_info)
                else:
                    results["cdn_accessibility"]["other_error"].append(song_info)
            else:
                results["cdn_accessibility"]["not_tested"].append(song_info)
                
        elif audio_url.startswith("/api/files/"):
            results["categories"]["internal_file_url"].append(song_info)
        else:
            results["categories"]["other_url"].append(song_info)
    
    # Build summary
    results["summary"] = {
        "total_songs": len(songs),
        "with_cdn_url": len(results["categories"]["cdn_url"]),
        "with_internal_url": len(results["categories"]["internal_file_url"]),
        "with_base64": len(results["categories"]["base64_audio"]),
        "no_audio": len(results["categories"]["no_audio_url"]),
        "other": len(results["categories"]["other_url"]),
    }
    
    if test_urls:
        results["summary"]["cdn_accessible"] = len(results["cdn_accessibility"]["accessible"])
        results["summary"]["cdn_forbidden"] = len(results["cdn_accessibility"]["forbidden_403"])
        results["summary"]["cdn_not_found"] = len(results["cdn_accessibility"]["not_found_404"])
        results["summary"]["cdn_other_error"] = len(results["cdn_accessibility"]["other_error"])
    
    return results


@router.get("/admin/cdn/audit/images")
async def audit_image_urls(limit: int = Query(0, description="Limit items to audit")):
    """
    Audit all images/thumbnails in the database.
    Checks albums, songs, choirs, churches for image storage type.
    """
    db = get_db()
    
    results = {
        "collections": {},
        "summary": {
            "total_items": 0,
            "with_cdn_image": 0,
            "with_base64_image": 0,
            "with_internal_url": 0,
            "no_image": 0
        }
    }
    
    # Collections to check
    collections_config = [
        ("albums", "album_id", "thumbnail"),
        ("songs", "song_id", "thumbnail"),
        ("singers", "singer_id", "thumbnail"),
        ("churches", "church_id", "thumbnail"),
        ("special_mixes", "mix_id", "thumbnail"),
        ("content_containers", "container_id", "thumbnail"),
        ("hero_sections", "section_id", "image"),
    ]
    
    for collection_name, id_field, image_field in collections_config:
        query = {}
        cursor = db[collection_name].find(query, {"_id": 0, id_field: 1, "title": 1, "name": 1, image_field: 1})
        if limit > 0:
            cursor = cursor.limit(limit)
        
        items = await cursor.to_list(5000)
        
        collection_results = {
            "total": len(items),
            "cdn_url": [],
            "base64": [],
            "internal_url": [],
            "no_image": []
        }
        
        for item in items:
            image_url = item.get(image_field, "")
            item_info = {
                "id": item.get(id_field),
                "title": item.get("title") or item.get("name"),
                "image_preview": (image_url[:50] + "...") if image_url and len(image_url) > 50 else image_url
            }
            
            if not image_url or image_url.strip() == "":
                collection_results["no_image"].append(item_info)
                results["summary"]["no_image"] += 1
            elif image_url.startswith("data:image"):
                collection_results["base64"].append(item_info)
                results["summary"]["with_base64_image"] += 1
            elif image_url.startswith("http"):
                collection_results["cdn_url"].append(item_info)
                results["summary"]["with_cdn_image"] += 1
            elif image_url.startswith("/api/"):
                collection_results["internal_url"].append(item_info)
                results["summary"]["with_internal_url"] += 1
            else:
                collection_results["no_image"].append(item_info)
                results["summary"]["no_image"] += 1
            
            results["summary"]["total_items"] += 1
        
        results["collections"][collection_name] = {
            "total": len(items),
            "cdn_count": len(collection_results["cdn_url"]),
            "base64_count": len(collection_results["base64"]),
            "internal_count": len(collection_results["internal_url"]),
            "no_image_count": len(collection_results["no_image"]),
            # Only include sample items to keep response manageable
            "base64_samples": collection_results["base64"][:10],
            "no_image_samples": collection_results["no_image"][:10],
        }
    
    return results


@router.get("/admin/cdn/audit/full")
async def full_cdn_audit(test_cdn_urls: bool = Query(False)):
    """
    Complete CDN audit - songs, images, and storage status
    """
    db = get_db()
    
    # Run both audits
    songs_audit = await audit_song_audio_urls(test_urls=test_cdn_urls, limit=0)
    images_audit = await audit_image_urls(limit=0)
    
    # Get files collection stats
    files_count = await db.files.count_documents({})
    cdn_files = await db.files.count_documents({"cdn_url": {"$ne": None}})
    local_files = await db.files.count_documents({"storage_type": "local"})
    
    return {
        "audit_date": datetime.now(timezone.utc).isoformat(),
        "songs_audit": songs_audit["summary"],
        "images_audit": images_audit["summary"],
        "files_collection": {
            "total_files": files_count,
            "cdn_files": cdn_files,
            "local_files": local_files
        },
        "detailed_songs": songs_audit,
        "detailed_images": images_audit
    }


# ============== CLEANUP & MIGRATION ==============

@router.post("/admin/cdn/disable-invalid-songs")
async def disable_songs_without_audio(
    dry_run: bool = Query(True, description="If true, only report what would be disabled")
):
    """
    Disable songs that have no valid audio URL.
    Sets status to 'disabled_no_audio' so they can be re-enabled later.
    """
    db = get_db()
    
    # Find songs with no audio
    songs = await db.songs.find({
        "$or": [
            {"audio_url": {"$exists": False}},
            {"audio_url": None},
            {"audio_url": ""},
            {"audio_url": {"$regex": "^$"}}
        ]
    }, {"_id": 0, "song_id": 1, "title": 1, "album_id": 1, "status": 1}).to_list(10000)
    
    if dry_run:
        return {
            "dry_run": True,
            "would_disable": len(songs),
            "songs": songs[:50]  # Show first 50
        }
    
    # Disable the songs
    result = await db.songs.update_many(
        {
            "$or": [
                {"audio_url": {"$exists": False}},
                {"audio_url": None},
                {"audio_url": ""},
                {"audio_url": {"$regex": "^$"}}
            ]
        },
        {
            "$set": {
                "status": "disabled_no_audio",
                "disabled_at": datetime.now(timezone.utc).isoformat(),
                "disabled_reason": "No valid audio URL"
            }
        }
    )
    
    return {
        "disabled_count": result.modified_count,
        "songs_affected": [s["song_id"] for s in songs[:50]]
    }


@router.post("/admin/cdn/migrate-base64-images")
async def migrate_base64_images_to_cdn(
    collection: str = Query("albums", description="Collection to migrate"),
    limit: int = Query(10, description="Max items to migrate per call"),
    dry_run: bool = Query(True, description="Preview only")
):
    """
    Migrate base64 images to CDN for a specific collection.
    """
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    db = get_db()
    
    # Collection config
    config = {
        "albums": ("album_id", "thumbnail"),
        "songs": ("song_id", "thumbnail"),
        "singers": ("singer_id", "thumbnail"),
        "churches": ("church_id", "thumbnail"),
    }
    
    if collection not in config:
        raise HTTPException(status_code=400, detail=f"Invalid collection. Valid: {list(config.keys())}")
    
    id_field, image_field = config[collection]
    
    # Find items with base64 images
    items = await db[collection].find({
        image_field: {"$regex": "^data:image"}
    }, {"_id": 0, id_field: 1, "title": 1, "name": 1, image_field: 1}).limit(limit).to_list(limit)
    
    if dry_run:
        return {
            "dry_run": True,
            "collection": collection,
            "items_to_migrate": len(items),
            "sample_ids": [item.get(id_field) for item in items[:10]]
        }
    
    # Migrate each item
    migrated = []
    errors = []
    
    for item in items:
        item_id = item.get(id_field)
        base64_data = item.get(image_field, "")
        
        try:
            # Parse base64
            if "," in base64_data:
                header, data = base64_data.split(",", 1)
                content_type = header.split(";")[0].replace("data:", "")
            else:
                data = base64_data
                content_type = "image/jpeg"
            
            image_bytes = base64.b64decode(data)
            
            # Determine extension
            ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
            ext = ext_map.get(content_type, ".jpg")
            
            # Upload to CDN
            filename = f"{collection}_{item_id}_{uuid.uuid4().hex[:8]}{ext}"
            folder = f"thumbnails/{collection}"
            storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.put(
                    storage_url,
                    content=image_bytes,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": content_type
                    }
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                    
                    # Update database
                    await db[collection].update_one(
                        {id_field: item_id},
                        {"$set": {
                            image_field: cdn_url,
                            f"{image_field}_migrated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    migrated.append({
                        "id": item_id,
                        "cdn_url": cdn_url,
                        "size_bytes": len(image_bytes)
                    })
                else:
                    errors.append({
                        "id": item_id,
                        "error": f"CDN upload failed: {response.status_code}"
                    })
                    
        except Exception as e:
            errors.append({
                "id": item_id,
                "error": str(e)
            })
    
    return {
        "collection": collection,
        "migrated_count": len(migrated),
        "error_count": len(errors),
        "migrated": migrated,
        "errors": errors
    }


@router.post("/admin/cdn/upload-song-audio")
async def upload_song_audio_to_cdn(
    song_id: str = Query(..., description="Song ID to upload audio for"),
    audio_base64: str = Query(None, description="Base64 encoded audio data"),
):
    """
    Upload audio file to CDN and update song record.
    Used for re-uploading or fixing broken audio.
    """
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    db = get_db()
    
    # Get song
    song = await db.songs.find_one({"song_id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if not audio_base64:
        raise HTTPException(status_code=400, detail="audio_base64 required")
    
    try:
        # Decode base64
        if "," in audio_base64:
            _, data = audio_base64.split(",", 1)
        else:
            data = audio_base64
        
        audio_bytes = base64.b64decode(data)
        
        # Upload to CDN
        filename = f"{song_id}_{uuid.uuid4().hex[:8]}.mp3"
        folder = "audio"
        storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.put(
                storage_url,
                content=audio_bytes,
                headers={
                    "AccessKey": BUNNY_API_KEY,
                    "Content-Type": "audio/mpeg"
                }
            )
            
            if response.status_code in [200, 201]:
                cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                
                # Update song
                await db.songs.update_one(
                    {"song_id": song_id},
                    {"$set": {
                        "audio_url": cdn_url,
                        "audio_uploaded_at": datetime.now(timezone.utc).isoformat(),
                        "status": "active"
                    }}
                )
                
                return {
                    "success": True,
                    "song_id": song_id,
                    "cdn_url": cdn_url,
                    "size_bytes": len(audio_bytes)
                }
            else:
                raise HTTPException(
                    status_code=500, 
                    detail=f"CDN upload failed: {response.status_code} - {response.text}"
                )
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/cdn/test-and-fix-urls")
async def test_and_fix_cdn_urls(
    limit: int = Query(50, description="Max songs to test"),
    fix_broken: bool = Query(False, description="Attempt to fix broken URLs by re-uploading")
):
    """
    Test CDN URLs and optionally attempt to fix broken ones.
    For songs with internal /api/files/ URLs, migrate them to CDN.
    """
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    db = get_db()
    
    # Get songs with CDN URLs
    songs = await db.songs.find({
        "audio_url": {"$regex": "^https://"}
    }, {"_id": 0, "song_id": 1, "title": 1, "audio_url": 1}).limit(limit).to_list(limit)
    
    results = {
        "tested": 0,
        "accessible": [],
        "broken": [],
        "fixed": [],
        "fix_errors": []
    }
    
    for song in songs:
        results["tested"] += 1
        audio_url = song.get("audio_url", "")
        
        check = await check_url_accessible(audio_url)
        
        if check["accessible"]:
            results["accessible"].append({
                "song_id": song["song_id"],
                "title": song["title"]
            })
        else:
            broken_info = {
                "song_id": song["song_id"],
                "title": song["title"],
                "url": audio_url,
                "status_code": check.get("status_code"),
                "error": check.get("error")
            }
            results["broken"].append(broken_info)
            
            if fix_broken:
                # For now, just mark as needing fix
                # In future, could try to re-upload if we have the file
                await db.songs.update_one(
                    {"song_id": song["song_id"]},
                    {"$set": {
                        "cdn_status": "broken",
                        "cdn_error": check.get("error") or f"HTTP {check.get('status_code')}",
                        "cdn_checked_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
    
    return results


@router.get("/admin/cdn/broken-songs")
async def get_broken_cdn_songs():
    """Get list of songs with broken CDN URLs"""
    db = get_db()
    
    songs = await db.songs.find(
        {"cdn_status": "broken"},
        {"_id": 0, "song_id": 1, "title": 1, "album_id": 1, "audio_url": 1, "cdn_error": 1, "cdn_checked_at": 1}
    ).to_list(500)
    
    return {
        "count": len(songs),
        "songs": songs
    }


@router.post("/admin/cdn/migrate-internal-to-cdn")
async def migrate_internal_files_to_cdn(
    limit: int = Query(10, description="Max files to migrate"),
    dry_run: bool = Query(True)
):
    """
    Migrate songs with internal /api/files/ URLs to CDN.
    Downloads from internal URL and re-uploads to CDN.
    """
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    db = get_db()
    
    # Find songs with internal file URLs
    songs = await db.songs.find({
        "audio_url": {"$regex": "^/api/files/"}
    }, {"_id": 0, "song_id": 1, "title": 1, "audio_url": 1}).limit(limit).to_list(limit)
    
    if dry_run:
        return {
            "dry_run": True,
            "songs_to_migrate": len(songs),
            "songs": songs
        }
    
    migrated = []
    errors = []
    
    for song in songs:
        song_id = song["song_id"]
        internal_url = song["audio_url"]
        
        try:
            # Extract file_id from URL
            # /api/files/file_abc123 -> file_abc123
            file_id = internal_url.split("/")[-1]
            
            # Get file from database
            file_doc = await db.files.find_one({"file_id": file_id})
            
            if not file_doc:
                errors.append({"song_id": song_id, "error": f"File not found: {file_id}"})
                continue
            
            # Get file content
            file_data = file_doc.get("data_base64") or file_doc.get("data")
            if not file_data:
                errors.append({"song_id": song_id, "error": "No file data in database"})
                continue
            
            if isinstance(file_data, str):
                audio_bytes = base64.b64decode(file_data)
            else:
                audio_bytes = file_data
            
            # Upload to CDN
            filename = f"{song_id}_{uuid.uuid4().hex[:8]}.mp3"
            folder = "audio"
            storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.put(
                    storage_url,
                    content=audio_bytes,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": "audio/mpeg"
                    }
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                    
                    await db.songs.update_one(
                        {"song_id": song_id},
                        {"$set": {
                            "audio_url": cdn_url,
                            "audio_migrated_at": datetime.now(timezone.utc).isoformat(),
                            "previous_audio_url": internal_url
                        }}
                    )
                    
                    migrated.append({
                        "song_id": song_id,
                        "title": song["title"],
                        "cdn_url": cdn_url
                    })
                else:
                    errors.append({
                        "song_id": song_id,
                        "error": f"CDN upload failed: {response.status_code}"
                    })
                    
        except Exception as e:
            errors.append({"song_id": song_id, "error": str(e)})
    
    return {
        "migrated_count": len(migrated),
        "error_count": len(errors),
        "migrated": migrated,
        "errors": errors
    }
