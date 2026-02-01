"""
File upload and CDN routes for Gracefy.
Handles media uploads, CDN integration, and file streaming.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, RedirectResponse
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import os
import io
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["uploads"])

# Bunny CDN configuration from environment
BUNNY_STORAGE_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "")
BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_CDN_URL = os.environ.get("BUNNY_CDN_URL", "")
BUNNY_STORAGE_REGION = os.environ.get("BUNNY_STORAGE_REGION", "de")


def is_cdn_enabled():
    """Check if CDN is properly configured"""
    return bool(BUNNY_STORAGE_ZONE and BUNNY_API_KEY and BUNNY_CDN_URL)


# ============== FILE UPLOAD ==============

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form("general")
):
    """Upload a file to local storage or CDN"""
    db = get_db()
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    filename = f"{file_id}{ext}"
    
    # Read file content
    content = await file.read()
    
    # Determine content type
    content_type = file.content_type or "application/octet-stream"
    
    # Try CDN upload if enabled
    cdn_url = None
    if is_cdn_enabled():
        try:
            import httpx
            
            # Use main storage URL (region prefix may not resolve in all environments)
            storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    storage_url,
                    content=content,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": content_type
                    },
                    timeout=60.0
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                    logger.info(f"File uploaded to CDN: {cdn_url}")
                else:
                    logger.warning(f"CDN upload failed with status {response.status_code}")
        except Exception as e:
            logger.error(f"CDN upload failed: {e}")
    
    # Store file record
    file_doc = {
        "file_id": file_id,
        "filename": filename,
        "original_name": file.filename,
        "folder": folder,
        "content_type": content_type,
        "size_bytes": len(content),
        "cdn_url": cdn_url,
        "storage_type": "cdn" if cdn_url else "local",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If no CDN, store as base64 (for small files) or reference
    if not cdn_url:
        if len(content) < 5 * 1024 * 1024:  # Under 5MB
            import base64
            file_doc["data_base64"] = base64.b64encode(content).decode('utf-8')
        else:
            file_doc["storage_error"] = "File too large for local storage without CDN"
    
    await db.files.insert_one(file_doc)
    file_doc.pop("_id", None)
    file_doc.pop("data_base64", None)  # Don't return base64 in response
    
    return {
        "file_id": file_id,
        "filename": filename,
        "url": cdn_url or f"/api/files/{file_id}",
        "cdn_url": cdn_url,
        "size_bytes": len(content)
    }


@router.post("/upload/cdn")
async def upload_to_cdn(
    file: UploadFile = File(...),
    folder: str = Form("media")
):
    """Upload directly to CDN"""
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    ext = os.path.splitext(file.filename)[1].lower()
    file_id = f"{uuid.uuid4().hex[:12]}"
    filename = f"{file_id}{ext}"
    
    content = await file.read()
    
    import httpx
    # Use main storage URL (region prefix may not resolve in all environments)
    storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
    
    async with httpx.AsyncClient() as client:
        response = await client.put(
            storage_url,
            content=content,
            headers={
                "AccessKey": BUNNY_API_KEY,
                "Content-Type": file.content_type or "application/octet-stream"
            },
            timeout=120.0
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail=f"CDN upload failed: {response.status_code}")
    
    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
    
    return {
        "url": cdn_url,
        "filename": filename,
        "folder": folder,
        "size_bytes": len(content)
    }


@router.post("/upload/multiple")
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    folder: str = Form("general")
):
    """Upload multiple files"""
    results = []
    
    for file in files:
        try:
            ext = os.path.splitext(file.filename)[1].lower()
            file_id = f"file_{uuid.uuid4().hex[:12]}"
            filename = f"{file_id}{ext}"
            content = await file.read()
            
            cdn_url = None
            if is_cdn_enabled():
                try:
                    import httpx
                    # Use main storage URL (region prefix may not resolve in all environments)
                    storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.put(
                            storage_url,
                            content=content,
                            headers={
                                "AccessKey": BUNNY_API_KEY,
                                "Content-Type": file.content_type or "application/octet-stream"
                            },
                            timeout=60.0
                        )
                        
                        if response.status_code in [200, 201]:
                            cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                except Exception as e:
                    logger.error(f"CDN upload failed for {file.filename}: {e}")
            
            results.append({
                "file_id": file_id,
                "filename": filename,
                "original_name": file.filename,
                "url": cdn_url or f"/api/files/{file_id}",
                "cdn_url": cdn_url,
                "size_bytes": len(content),
                "success": True
            })
        except Exception as e:
            results.append({
                "original_name": file.filename,
                "success": False,
                "error": str(e)
            })
    
    return {"files": results}


# ============== FILE RETRIEVAL ==============

@router.get("/files/{file_id}/stream")
async def stream_file(file_id: str):
    """Stream a file - supports both direct and chunked storage"""
    db = get_db()
    
    file_doc = await db.files.find_one({"file_id": file_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # If CDN URL available, redirect
    if file_doc.get("cdn_url"):
        return RedirectResponse(url=file_doc["cdn_url"])
    
    # Handle chunked storage
    if file_doc.get("storage_type") == "chunked":
        import base64
        
        # Fetch all chunks and reassemble
        chunks = await db.file_chunks.find(
            {"file_id": file_id}
        ).sort("chunk_index", 1).to_list(100)
        
        if not chunks:
            raise HTTPException(status_code=404, detail="File chunks not found")
        
        # Reassemble the file
        content_parts = []
        for chunk in chunks:
            chunk_data = base64.b64decode(chunk["data"])
            content_parts.append(chunk_data)
        
        content = b''.join(content_parts)
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type=file_doc.get("content_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f'inline; filename="{file_doc.get("filename", "file")}"',
                "Content-Length": str(len(content))
            }
        )
    
    # Check for data in different field names (data_base64 or data)
    file_data = file_doc.get("data_base64") or file_doc.get("data")
    
    if file_data:
        import base64
        # Handle both base64 string and already decoded data
        if isinstance(file_data, str):
            content = base64.b64decode(file_data)
        else:
            content = file_data
        return StreamingResponse(
            io.BytesIO(content),
            media_type=file_doc.get("content_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f'inline; filename="{file_doc.get("filename", "file")}"'
            }
        )
    
    raise HTTPException(status_code=404, detail="File content not available")


@router.get("/files/{file_id}")
async def get_file(file_id: str):
    """Get file metadata"""
    db = get_db()
    
    file_doc = await db.files.find_one({"file_id": file_id}, {"_id": 0, "data_base64": 0})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    return file_doc


@router.get("/files/{file_id}/download")
async def download_file(file_id: str):
    """Download a file"""
    db = get_db()
    
    file_doc = await db.files.find_one({"file_id": file_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    # If CDN URL available, redirect
    if file_doc.get("cdn_url"):
        return RedirectResponse(url=file_doc["cdn_url"])
    
    # Check for data in different field names (data_base64 or data)
    file_data = file_doc.get("data_base64") or file_doc.get("data")
    
    if file_data:
        import base64
        # Handle both base64 string and already decoded data
        if isinstance(file_data, str):
            content = base64.b64decode(file_data)
        else:
            content = file_data
        return StreamingResponse(
            io.BytesIO(content),
            media_type=file_doc.get("content_type", "application/octet-stream"),
            headers={
                "Content-Disposition": f'attachment; filename="{file_doc.get("original_name", file_doc.get("filename", "file"))}"'
            }
        )
    
    raise HTTPException(status_code=404, detail="File content not available")


# ============== CDN MANAGEMENT ==============

@router.get("/admin/cdn/status")
async def get_cdn_status():
    """Get CDN status and configuration"""
    return {
        "enabled": is_cdn_enabled(),
        "storage_zone": BUNNY_STORAGE_ZONE or "Not configured",
        "cdn_url": BUNNY_CDN_URL or "Not configured",
        "region": BUNNY_STORAGE_REGION
    }


@router.get("/admin/cdn/stats")
async def get_cdn_stats():
    """Get CDN usage statistics"""
    db = get_db()
    
    # Count files by storage type
    cdn_files = await db.files.count_documents({"cdn_url": {"$ne": None}})
    mongodb_files = await db.files.count_documents({"$and": [
        {"data": {"$exists": True}},
        {"$or": [{"cdn_url": None}, {"cdn_url": {"$exists": False}}]}
    ]})
    local_files = await db.files.count_documents({"storage_type": "local"})
    chunked_files = await db.files.count_documents({"storage_type": "chunked"})
    total_tracked = await db.files.count_documents({})
    
    # Total CDN size
    cdn_size_pipeline = [
        {"$match": {"cdn_url": {"$ne": None}}},
        {"$group": {"_id": None, "total": {"$sum": "$size_bytes"}}}
    ]
    cdn_size_result = await db.files.aggregate(cdn_size_pipeline).to_list(1)
    cdn_size = cdn_size_result[0]["total"] if cdn_size_result else 0
    
    # Total local size
    local_size_pipeline = [
        {"$match": {"$or": [{"cdn_url": None}, {"cdn_url": {"$exists": False}}]}},
        {"$group": {"_id": None, "total": {"$sum": "$size_bytes"}}}
    ]
    local_size_result = await db.files.aggregate(local_size_pipeline).to_list(1)
    local_size = local_size_result[0]["total"] if local_size_result else 0
    
    # Files by folder/type (for backend compatibility)
    folder_pipeline = [
        {"$group": {"_id": "$folder", "count": {"$sum": 1}, "size": {"$sum": "$size_bytes"}}}
    ]
    folder_stats = await db.files.aggregate(folder_pipeline).to_list(20)
    
    # Build folders dict in the structure the frontend expects
    folders = {
        "audio": {"count": 0, "size_mb": 0},
        "images": {"count": 0, "size_mb": 0},
        "thumbnails": {"count": 0, "size_mb": 0}
    }
    by_folder = {}
    for item in folder_stats:
        folder_name = item["_id"] or "general"
        folder_data = {
            "count": item["count"],
            "size_mb": round((item["size"] or 0) / (1024 * 1024), 2)
        }
        by_folder[folder_name] = folder_data
        # Map to known folder types
        if folder_name in ["audio", "teachings"]:
            folders["audio"]["count"] += item["count"]
            folders["audio"]["size_mb"] += folder_data["size_mb"]
        elif folder_name in ["images", "covers", "banners"]:
            folders["images"]["count"] += item["count"]
            folders["images"]["size_mb"] += folder_data["size_mb"]
        elif folder_name in ["thumbnails"]:
            folders["thumbnails"]["count"] += item["count"]
            folders["thumbnails"]["size_mb"] += folder_data["size_mb"]
    
    total_size_mb = round((cdn_size + local_size) / (1024 * 1024), 2)
    
    return {
        "cdn_files": cdn_files,
        "local_files": local_files + chunked_files,
        "total_size_mb": total_size_mb,
        "total_cdn_size_mb": round(cdn_size / (1024 * 1024), 2),
        "total_local_size_mb": round(local_size / (1024 * 1024), 2),
        "database_stats": {
            "mongodb_files": mongodb_files + chunked_files,
            "cdn_files": cdn_files,
            "total_tracked": total_tracked
        },
        "folders": folders,
        "by_folder": by_folder
    }


@router.get("/admin/cdn/files")
async def get_cdn_files(
    folder: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get list of CDN files"""
    db = get_db()
    
    query = {"storage_type": "cdn"}
    if folder:
        query["folder"] = folder
    
    files = await db.files.find(query, {"_id": 0, "data_base64": 0})\
        .sort("created_at", -1)\
        .skip(skip)\
        .limit(limit)\
        .to_list(limit)
    
    return {"files": files}


@router.delete("/admin/cdn/files/{folder}/{filename}")
async def delete_cdn_file(folder: str, filename: str):
    """Delete a file from CDN"""
    db = get_db()
    
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    try:
        import httpx
        storage_url = f"https://{BUNNY_STORAGE_REGION}.storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                storage_url,
                headers={"AccessKey": BUNNY_API_KEY},
                timeout=30.0
            )
            
            if response.status_code not in [200, 204]:
                logger.warning(f"CDN delete returned {response.status_code}")
    except Exception as e:
        logger.error(f"CDN delete error: {e}")
    
    # Remove from database
    await db.files.delete_one({"folder": folder, "filename": filename})
    
    return {"message": "File deleted"}


@router.get("/admin/cdn/migration-status")
async def get_migration_status():
    """Get status of CDN migration"""
    db = get_db()
    
    total_songs = await db.songs.count_documents({})
    cdn_songs = await db.songs.count_documents({"audio_url": {"$regex": "^https://"}})
    
    return {
        "total_songs": total_songs,
        "cdn_songs": cdn_songs,
        "local_songs": total_songs - cdn_songs,
        "migration_percentage": round((cdn_songs / total_songs * 100) if total_songs > 0 else 0, 2)
    }


@router.post("/admin/cdn/migrate")
async def migrate_to_cdn(data: dict):
    """Migrate local files to CDN"""
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    db = get_db()
    limit = data.get("limit", 10)
    
    # Find files without CDN URLs
    files = await db.files.find(
        {"storage_type": "local", "data_base64": {"$exists": True}},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    migrated = 0
    errors = []
    
    for file_doc in files:
        try:
            import base64
            import httpx
            
            content = base64.b64decode(file_doc["data_base64"])
            folder = file_doc.get("folder", "general")
            filename = file_doc["filename"]
            
            storage_url = f"https://{BUNNY_STORAGE_REGION}.storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    storage_url,
                    content=content,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": file_doc.get("content_type", "application/octet-stream")
                    },
                    timeout=60.0
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                    await db.files.update_one(
                        {"file_id": file_doc["file_id"]},
                        {
                            "$set": {"cdn_url": cdn_url, "storage_type": "cdn"},
                            "$unset": {"data_base64": ""}
                        }
                    )
                    migrated += 1
        except Exception as e:
            errors.append({"file_id": file_doc["file_id"], "error": str(e)})
    
    return {
        "migrated": migrated,
        "errors": errors,
        "total_processed": len(files)
    }


# ============== CONTENT UPLOAD HELPERS ==============

@router.post("/content/upload-thumbnail")
async def upload_thumbnail(
    file: UploadFile = File(...),
    entity_type: str = Form("album"),
    entity_id: str = Form(...)
):
    """Upload thumbnail for content (album, song, choir, etc.)"""
    db = get_db()
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid image type")
    
    content = await file.read()
    
    # Resize if needed (placeholder - actual implementation would use Pillow)
    
    # Upload to CDN if available
    if is_cdn_enabled():
        try:
            import httpx
            filename = f"{entity_type}_{entity_id}_thumb.jpg"
            folder = f"thumbnails/{entity_type}"
            storage_url = f"https://{BUNNY_STORAGE_REGION}.storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    storage_url,
                    content=content,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": file.content_type
                    },
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                    
                    # Update entity
                    collection_map = {
                        "album": "albums",
                        "song": "songs",
                        "choir": "singers",
                        "church": "churches"
                    }
                    id_field_map = {
                        "album": "album_id",
                        "song": "song_id",
                        "choir": "singer_id",
                        "church": "church_id"
                    }
                    
                    collection = collection_map.get(entity_type, "albums")
                    id_field = id_field_map.get(entity_type, "album_id")
                    
                    await db[collection].update_one(
                        {id_field: entity_id},
                        {"$set": {"thumbnail": cdn_url}}
                    )
                    
                    return {"url": cdn_url}
        except Exception as e:
            logger.error(f"Thumbnail upload error: {e}")
    
    # Fallback to base64
    import base64
    thumbnail_b64 = f"data:{file.content_type};base64,{base64.b64encode(content).decode('utf-8')}"
    
    return {"url": thumbnail_b64, "type": "base64"}


@router.post("/content/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    song_id: str = Form(...)
):
    """Upload audio file for a song"""
    db = get_db()
    
    # Validate file type
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid audio type")
    
    content = await file.read()
    
    if is_cdn_enabled():
        try:
            import httpx
            ext = os.path.splitext(file.filename)[1].lower() or ".mp3"
            filename = f"{song_id}{ext}"
            folder = "audio"
            storage_url = f"https://{BUNNY_STORAGE_REGION}.storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    storage_url,
                    content=content,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": file.content_type
                    },
                    timeout=120.0
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                    
                    await db.songs.update_one(
                        {"song_id": song_id},
                        {"$set": {"audio_url": cdn_url}}
                    )
                    
                    return {"url": cdn_url, "size_bytes": len(content)}
        except Exception as e:
            logger.error(f"Audio upload error: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    raise HTTPException(status_code=503, detail="CDN not configured for audio uploads")


# ============== THUMBNAILS API ==============

@router.get("/thumbnails/{item_id}")
async def get_thumbnail(item_id: str):
    """Get thumbnail for any item"""
    db = get_db()
    
    # Check cache
    cache_key = f"thumb:{item_id}"
    cached = await cache.get(cache_key)
    if cached:
        if cached.get("type") == "redirect":
            return RedirectResponse(url=cached["url"])
        elif cached.get("data"):
            import base64
            return StreamingResponse(
                io.BytesIO(base64.b64decode(cached["data"])),
                media_type=cached.get("content_type", "image/jpeg")
            )
    
    # Try to find thumbnail
    for collection, id_field in [
        ("albums", "album_id"),
        ("songs", "song_id"),
        ("singers", "singer_id"),
        ("churches", "church_id"),
        ("special_mixes", "mix_id"),
        ("content_containers", "container_id")
    ]:
        doc = await db[collection].find_one({id_field: item_id}, {"_id": 0, "thumbnail": 1})
        if doc and doc.get("thumbnail"):
            thumb = doc["thumbnail"]
            
            # CDN URL
            if thumb.startswith("http"):
                await cache.set(cache_key, {"type": "redirect", "url": thumb}, 3600)
                return RedirectResponse(url=thumb)
            
            # Base64
            if thumb.startswith("data:"):
                parts = thumb.split(",", 1)
                if len(parts) == 2:
                    import base64
                    content_type = parts[0].split(";")[0].replace("data:", "")
                    data = base64.b64decode(parts[1])
                    await cache.set(cache_key, {
                        "type": "base64",
                        "data": parts[1],
                        "content_type": content_type
                    }, 3600)
                    return StreamingResponse(
                        io.BytesIO(data),
                        media_type=content_type
                    )
    
    raise HTTPException(status_code=404, detail="Thumbnail not found")
