"""
File upload and CDN routes for Gracefy.
Handles media uploads, CDN integration, and file streaming.
OPTIMIZED: Streaming uploads, chunked transfers, background encoding.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request, BackgroundTasks
from fastapi.responses import StreamingResponse, RedirectResponse
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import os
import io
import logging
import asyncio

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["uploads"])

# Bunny CDN configuration from environment
BUNNY_STORAGE_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "")
BUNNY_API_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_CDN_URL = os.environ.get("BUNNY_CDN_URL", "")
BUNNY_STORAGE_REGION = os.environ.get("BUNNY_STORAGE_REGION", "de")

# Upload chunk size for streaming (1MB chunks for better performance)
UPLOAD_CHUNK_SIZE = 1024 * 1024


def is_cdn_enabled():
    """Check if CDN is properly configured"""
    return bool(BUNNY_STORAGE_ZONE and BUNNY_API_KEY and BUNNY_CDN_URL)


async def stream_upload_to_cdn(file: UploadFile, folder: str, filename: str, content_type: str) -> tuple[str, int]:
    """
    Stream upload to CDN without loading entire file into memory.
    Returns (cdn_url, file_size).
    """
    import httpx
    
    storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
    
    # Read file in chunks and calculate size
    chunks = []
    total_size = 0
    
    while True:
        chunk = await file.read(UPLOAD_CHUNK_SIZE)
        if not chunk:
            break
        chunks.append(chunk)
        total_size += len(chunk)
    
    content = b''.join(chunks)
    
    # Calculate dynamic timeout based on file size (1 min per 20MB, min 30s, max 10 min)
    timeout_seconds = max(30, min(600, (total_size // (20 * 1024 * 1024)) * 60 + 30))
    
    async with httpx.AsyncClient() as client:
        response = await client.put(
            storage_url,
            content=content,
            headers={
                "AccessKey": BUNNY_API_KEY,
                "Content-Type": content_type
            },
            timeout=float(timeout_seconds)
        )
        
        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=500, detail=f"CDN upload failed: {response.status_code}")
    
    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
    return cdn_url, total_size


# ============== OPTIMIZED FILE UPLOAD ==============

@router.post("/upload/fast")
async def fast_upload_file(
    file: UploadFile = File(...),
    folder: str = Form("general"),
    background_tasks: BackgroundTasks = None
):
    """
    Fast file upload with streaming to CDN.
    Optimized for large files with progress tracking support.
    """
    db = get_db()
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    filename = f"{file_id}{ext}"
    
    content_type = file.content_type or "application/octet-stream"
    
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    try:
        cdn_url, file_size = await stream_upload_to_cdn(file, folder, filename, content_type)
        
        # Store file record in background
        file_doc = {
            "file_id": file_id,
            "filename": filename,
            "original_name": file.filename,
            "folder": folder,
            "content_type": content_type,
            "size_bytes": file_size,
            "cdn_url": cdn_url,
            "storage_type": "cdn",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Fire and forget - don't wait for DB insert
        async def save_file_record():
            try:
                await db.files.insert_one(file_doc)
            except Exception as e:
                logger.error(f"Failed to save file record: {e}")
        
        asyncio.create_task(save_file_record())
        
        return {
            "file_id": file_id,
            "filename": filename,
            "url": cdn_url,
            "cdn_url": cdn_url,
            "size_bytes": file_size
        }
    except Exception as e:
        logger.error(f"Fast upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload/audio/fast")
async def fast_audio_upload(
    file: UploadFile = File(...),
    song_id: str = Form(...),
    background_tasks: BackgroundTasks = None
):
    """
    Optimized audio upload - uploads immediately, encoding happens in background.
    Returns CDN URL immediately, HLS transcoding happens asynchronously.
    """
    db = get_db()
    
    # Validate file type
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", 
                     "audio/x-m4a", "audio/aac", "audio/flac", "audio/x-wav"]
    filename_lower = file.filename.lower()
    
    if file.content_type not in allowed_types and not filename_lower.endswith(
        ('.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac')
    ):
        raise HTTPException(status_code=400, detail="Invalid audio type")
    
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured")
    
    try:
        # Upload original file directly to CDN (no encoding delay)
        ext = os.path.splitext(file.filename)[1].lower() or ".mp3"
        audio_filename = f"{song_id}_raw{ext}"
        
        cdn_url, file_size = await stream_upload_to_cdn(
            file, "audio", audio_filename, file.content_type or "audio/mpeg"
        )
        
        # Update song with raw audio URL immediately
        await db.songs.update_one(
            {"song_id": song_id},
            {"$set": {
                "audio_url": cdn_url,
                "audio_size_bytes": file_size,
                "upload_status": "uploaded",
                "hls_status": "pending"
            }}
        )
        
        # Trigger HLS transcoding in background (non-blocking)
        if background_tasks:
            from services.hls_transcoding_service import transcode_song
            background_tasks.add_task(transcode_song, song_id, cdn_url, db)
        
        return {
            "url": cdn_url,
            "size_bytes": file_size,
            "upload_status": "complete",
            "hls_status": "pending",
            "message": "Audio uploaded successfully. HLS transcoding started in background."
        }
        
    except Exception as e:
        logger.error(f"Audio upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/upload/status/{song_id}")
async def get_upload_status(song_id: str):
    """Get upload and transcoding status for a song."""
    db = get_db()
    
    song = await db.songs.find_one(
        {"song_id": song_id},
        {"_id": 0, "song_id": 1, "title": 1, "audio_url": 1, "hls_url": 1, 
         "hls_status": 1, "upload_status": 1, "audio_size_bytes": 1,
         "encoding_status": 1, "encoded": 1}
    )
    
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    return {
        "song_id": song_id,
        "title": song.get("title"),
        "upload_status": song.get("upload_status", "unknown"),
        "encoding_status": song.get("encoding_status", "unknown"),
        "encoded": song.get("encoded", False),
        "hls_status": song.get("hls_status", "unknown"),
        "audio_url": song.get("audio_url"),
        "hls_url": song.get("hls_url"),
        "audio_size_bytes": song.get("audio_size_bytes", 0)
    }


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
    file_size = len(content)
    
    # Check file size limit (500MB max for audio/video)
    if file_size > 500 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 500MB")
    
    # Determine content type
    content_type = file.content_type or "application/octet-stream"
    
    # Calculate dynamic timeout based on file size (1 min per 10MB, min 1 min, max 30 min)
    timeout_seconds = max(60, min(1800, (file_size // (10 * 1024 * 1024)) * 60 + 60))
    
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
                    timeout=float(timeout_seconds)
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
        "size_bytes": file_size
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


@router.post("/upload/base64")
async def upload_base64_image(data: dict):
    """Upload image from base64 data - used for church images etc."""
    db = get_db()
    
    # Accept multiple key names for flexibility
    base64_data = data.get("file_data") or data.get("file") or data.get("data") or data.get("image") or ""
    filename = data.get("filename", f"image_{uuid.uuid4().hex[:12]}.jpg")
    content_type = data.get("content_type", "image/jpeg")
    folder = data.get("folder", "images")
    
    if not base64_data:
        raise HTTPException(status_code=400, detail="No image data provided. Use 'file_data', 'file', 'data', or 'image' key.")
    
    # Remove data URL prefix if present
    if "base64," in base64_data:
        # Extract content type from data URL if not provided
        if base64_data.startswith("data:"):
            mime_part = base64_data.split(";")[0]
            if mime_part:
                content_type = mime_part.replace("data:", "")
        base64_data = base64_data.split("base64,")[1]
    
    try:
        import base64
        content = base64.b64decode(base64_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 data: {str(e)}")
    
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    cdn_filename = f"{file_id}{ext}"
    
    cdn_url = None
    
    # Try CDN upload
    if is_cdn_enabled():
        try:
            import httpx
            storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{cdn_filename}"
            
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
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{cdn_filename}"
                    logger.info(f"Base64 image uploaded to CDN: {cdn_url}")
        except Exception as e:
            logger.error(f"CDN upload failed: {e}")
    
    # Store file record
    file_doc = {
        "file_id": file_id,
        "filename": cdn_filename,
        "original_name": filename,
        "folder": folder,
        "content_type": content_type,
        "size_bytes": len(content),
        "cdn_url": cdn_url,
        "storage_type": "cdn" if cdn_url else "local",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If no CDN, store as base64 for small files
    if not cdn_url and len(content) < 5 * 1024 * 1024:
        file_doc["data_base64"] = base64_data
    
    await db.files.insert_one(file_doc)
    
    return {
        "file_id": file_id,
        "filename": cdn_filename,
        "url": cdn_url or f"/api/files/{file_id}",
        "cdn_url": cdn_url,
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
    """Get CDN usage statistics - counts from actual content collections"""
    db = get_db()
    
    # Count audio files from songs collection
    songs_with_cdn = await db.songs.count_documents({"audio_url": {"$regex": "^https://"}})
    songs_with_internal = await db.songs.count_documents({"audio_url": {"$regex": "^/api/"}})
    songs_no_audio = await db.songs.count_documents({
        "$or": [
            {"audio_url": {"$exists": False}},
            {"audio_url": None},
            {"audio_url": ""}
        ]
    })
    total_songs = await db.songs.count_documents({})
    
    # Count images from albums collection
    albums_with_cdn_thumb = await db.albums.count_documents({"thumbnail": {"$regex": "^https://"}})
    albums_with_base64_thumb = await db.albums.count_documents({"thumbnail": {"$regex": "^data:image"}})
    albums_no_thumb = await db.albums.count_documents({
        "$or": [
            {"thumbnail": {"$exists": False}},
            {"thumbnail": None},
            {"thumbnail": ""}
        ]
    })
    total_albums = await db.albums.count_documents({})
    
    # Count song thumbnails
    songs_with_cdn_thumb = await db.songs.count_documents({"thumbnail": {"$regex": "^https://"}})
    songs_with_base64_thumb = await db.songs.count_documents({"thumbnail": {"$regex": "^data:image"}})
    
    # Files collection stats (for legacy tracking)
    cdn_tracked_files = await db.files.count_documents({"cdn_url": {"$ne": None}})
    local_tracked_files = await db.files.count_documents({"storage_type": "local"})
    total_tracked = await db.files.count_documents({})
    
    # Estimate sizes (from songs and albums)
    songs_size_pipeline = [
        {"$match": {"audio_url": {"$regex": "^https://"}}},
        {"$group": {"_id": None, "count": {"$sum": 1}}}
    ]
    songs_result = await db.songs.aggregate(songs_size_pipeline).to_list(1)
    cdn_audio_count = songs_result[0]["count"] if songs_result else 0
    
    # Build response
    folders = {
        "audio": {
            "count": songs_with_cdn,
            "size_mb": round(songs_with_cdn * 5, 2),  # Estimate ~5MB per song
            "cdn_count": songs_with_cdn,
            "internal_count": songs_with_internal,
            "missing_count": songs_no_audio
        },
        "images": {
            "count": albums_with_cdn_thumb,
            "size_mb": round(albums_with_cdn_thumb * 0.5, 2),  # Estimate ~0.5MB per image
            "cdn_count": albums_with_cdn_thumb,
            "base64_count": albums_with_base64_thumb,
            "missing_count": albums_no_thumb
        },
        "thumbnails": {
            "count": songs_with_cdn_thumb,
            "size_mb": round(songs_with_cdn_thumb * 0.2, 2),  # Estimate ~0.2MB per thumbnail
            "cdn_count": songs_with_cdn_thumb,
            "base64_count": songs_with_base64_thumb
        }
    }
    
    total_cdn_files = songs_with_cdn + albums_with_cdn_thumb + songs_with_cdn_thumb
    total_local_files = songs_with_internal + albums_with_base64_thumb + songs_with_base64_thumb
    
    return {
        "cdn_files": total_cdn_files,
        "local_files": total_local_files,
        "total_size_mb": round((total_cdn_files * 5) + (albums_with_cdn_thumb * 0.5), 2),
        "total_cdn_size_mb": round((songs_with_cdn * 5) + (albums_with_cdn_thumb * 0.5), 2),
        "total_local_size_mb": 0,
        "database_stats": {
            "total_songs": total_songs,
            "songs_on_cdn": songs_with_cdn,
            "songs_on_internal": songs_with_internal,
            "songs_no_audio": songs_no_audio,
            "total_albums": total_albums,
            "albums_with_cdn_images": albums_with_cdn_thumb,
            "albums_with_base64_images": albums_with_base64_thumb,
            "legacy_files_tracked": total_tracked
        },
        "folders": folders,
        "summary": {
            "audio": f"{songs_with_cdn}/{total_songs} songs on CDN",
            "images": f"{albums_with_cdn_thumb}/{total_albums} album images on CDN",
            "thumbnails": f"{songs_with_cdn_thumb} song thumbnails on CDN"
        }
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
    entity_id: str = Form(...),
    background_tasks: BackgroundTasks = None
):
    """
    Upload thumbnail for content (album, song, choir, etc.)
    NON-BLOCKING: DB update happens in background.
    """
    db = get_db()
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid image type")
    
    content = await file.read()
    content_type = file.content_type
    
    # Upload to CDN if available
    if is_cdn_enabled():
        try:
            import httpx
            filename = f"{entity_type}_{entity_id}_thumb.jpg"
            folder = f"thumbnails/{entity_type}"
            # Use main storage URL (not region-specific which may fail)
            storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/{folder}/{filename}"
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    storage_url,
                    content=content,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": content_type
                    },
                    timeout=60.0  # Increased timeout for larger images
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/{folder}/{filename}"
                    
                    # Update entity in background (non-blocking return)
                    async def update_entity_thumbnail():
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
                        
                        try:
                            await db[collection].update_one(
                                {id_field: entity_id},
                                {"$set": {"thumbnail": cdn_url}}
                            )
                        except Exception as e:
                            logger.error(f"Failed to update {entity_type} thumbnail: {e}")
                    
                    # Fire and forget - return immediately
                    asyncio.create_task(update_entity_thumbnail())
                    
                    return {"url": cdn_url, "status": "uploaded"}
                else:
                    logger.error(f"CDN upload failed: {response.status_code}")
        except Exception as e:
            logger.error(f"Thumbnail upload error: {e}")
    
    # Fallback to base64 (for small images only)
    if len(content) > 2 * 1024 * 1024:  # 2MB limit for base64
        raise HTTPException(status_code=400, detail="Image too large. CDN upload failed.")
    
    import base64
    thumbnail_b64 = f"data:{content_type};base64,{base64.b64encode(content).decode('utf-8')}"
    
    return {"url": thumbnail_b64, "type": "base64"}


@router.post("/content/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    song_id: str = Form(...),
    encode: bool = Form(True),  # Enable encoding by default
    background_tasks: BackgroundTasks = None
):
    """
    Upload audio file for a song with optional encoding.
    Converts to MP3 128kbps for optimal streaming.
    NON-BLOCKING: Returns immediately, encoding happens in background.
    """
    db = get_db()
    
    # Validate file type
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/flac"]
    if file.content_type not in allowed_types and not file.filename.lower().endswith(('.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac')):
        raise HTTPException(status_code=400, detail="Invalid audio type. Supported: MP3, WAV, M4A, OGG, AAC, FLAC")
    
    content = await file.read()
    original_size = len(content)
    original_filename = file.filename
    content_type = file.content_type
    
    if not is_cdn_enabled():
        raise HTTPException(status_code=503, detail="CDN not configured for audio uploads")
    
    # Check if encoding is needed
    needs_encoding = encode and content_type not in ["audio/mpeg", "audio/mp3"] and not original_filename.lower().endswith('.mp3')
    
    if needs_encoding:
        # For non-MP3 files: Upload raw first, then encode in background
        import httpx
        
        # Upload original file immediately (no waiting for encoding)
        raw_ext = os.path.splitext(original_filename)[1].lower() or ".wav"
        raw_filename = f"{song_id}_raw{raw_ext}"
        storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/audio/{raw_filename}"
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                storage_url,
                content=content,
                headers={
                    "AccessKey": BUNNY_API_KEY,
                    "Content-Type": content_type or "audio/mpeg"
                },
                timeout=120.0
            )
            
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=500, detail=f"Upload failed: {response.status_code}")
        
        raw_cdn_url = f"{BUNNY_CDN_URL}/audio/{raw_filename}"
        
        # Update song with raw URL immediately (user can start using it)
        await db.songs.update_one(
            {"song_id": song_id},
            {"$set": {
                "audio_url": raw_cdn_url,
                "audio_size_bytes": original_size,
                "original_size_bytes": original_size,
                "encoding_status": "pending",
                "encoded": False
            }}
        )
        
        # Schedule encoding in background (non-blocking)
        if background_tasks:
            background_tasks.add_task(
                encode_audio_background,
                song_id=song_id,
                raw_url=raw_cdn_url,
                content=content,
                original_filename=original_filename
            )
        else:
            # Fallback: use asyncio task
            asyncio.create_task(
                encode_audio_background(song_id, raw_cdn_url, content, original_filename)
            )
        
        return {
            "url": raw_cdn_url,
            "size_bytes": original_size,
            "original_size_bytes": original_size,
            "encoded": False,
            "encoding_status": "pending",
            "message": "Audio uploaded. MP3 encoding started in background."
        }
    else:
        # Already MP3 or encoding disabled: Upload directly
        import httpx
        
        ext = ".mp3" if encode else (os.path.splitext(original_filename)[1].lower() or ".mp3")
        filename = f"{song_id}{ext}"
        storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/audio/{filename}"
        
        async with httpx.AsyncClient() as client:
            response = await client.put(
                storage_url,
                content=content,
                headers={
                    "AccessKey": BUNNY_API_KEY,
                    "Content-Type": "audio/mpeg"
                },
                timeout=120.0
            )
            
            if response.status_code in [200, 201]:
                cdn_url = f"{BUNNY_CDN_URL}/audio/{filename}"
                
                await db.songs.update_one(
                    {"song_id": song_id},
                    {"$set": {
                        "audio_url": cdn_url,
                        "audio_size_bytes": len(content),
                        "original_size_bytes": original_size,
                        "encoded": True,
                        "encoding_status": "complete"
                    }}
                )
                
                return {
                    "url": cdn_url, 
                    "size_bytes": len(content),
                    "original_size_bytes": original_size,
                    "encoded": True,
                    "encoding_status": "complete",
                    "compression_ratio": round(original_size / len(content), 2) if len(content) > 0 else 1
                }
        
        raise HTTPException(status_code=500, detail="Upload failed")


async def encode_audio_background(song_id: str, raw_url: str, content: bytes, original_filename: str):
    """
    Background task to encode audio to MP3 without blocking the event loop.
    Uses run_in_executor to run FFmpeg in a thread pool.
    """
    import tempfile
    import subprocess
    import httpx
    from concurrent.futures import ThreadPoolExecutor
    
    db = get_db()
    
    def run_ffmpeg_encoding(input_path: str, output_path: str) -> bool:
        """Synchronous FFmpeg encoding - runs in thread pool"""
        try:
            process = subprocess.run([
                "ffmpeg", "-y",
                "-i", input_path,
                "-codec:a", "libmp3lame",
                "-b:a", "128k",
                "-ar", "44100",
                "-ac", "2",  # Stereo
                output_path
            ], capture_output=True, timeout=300)
            
            return process.returncode == 0
        except Exception as e:
            logger.error(f"FFmpeg encoding error: {e}")
            return False
    
    try:
        logger.info(f"Starting background encoding for song {song_id}")
        
        # Write content to temp file
        ext = os.path.splitext(original_filename)[1].lower() or ".wav"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_in:
            tmp_in.write(content)
            tmp_in_path = tmp_in.name
        
        tmp_out_path = tmp_in_path + ".mp3"
        
        # Run FFmpeg in thread pool (non-blocking)
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=2) as executor:
            success = await loop.run_in_executor(
                executor,
                run_ffmpeg_encoding,
                tmp_in_path,
                tmp_out_path
            )
        
        if success and os.path.exists(tmp_out_path):
            # Read encoded file
            with open(tmp_out_path, "rb") as f:
                encoded_content = f.read()
            
            # Upload encoded MP3 to CDN
            filename = f"{song_id}.mp3"
            storage_url = f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}/audio/{filename}"
            
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    storage_url,
                    content=encoded_content,
                    headers={
                        "AccessKey": BUNNY_API_KEY,
                        "Content-Type": "audio/mpeg"
                    },
                    timeout=120.0
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = f"{BUNNY_CDN_URL}/audio/{filename}"
                    
                    # Update song with encoded URL
                    await db.songs.update_one(
                        {"song_id": song_id},
                        {"$set": {
                            "audio_url": cdn_url,
                            "audio_size_bytes": len(encoded_content),
                            "encoded": True,
                            "encoding_status": "complete"
                        }}
                    )
                    
                    logger.info(f"Background encoding complete for {song_id}: {len(content)} -> {len(encoded_content)} bytes")
                else:
                    logger.error(f"Failed to upload encoded audio for {song_id}")
                    await db.songs.update_one(
                        {"song_id": song_id},
                        {"$set": {"encoding_status": "failed"}}
                    )
        else:
            logger.warning(f"FFmpeg encoding failed for {song_id}, keeping raw file")
            await db.songs.update_one(
                {"song_id": song_id},
                {"$set": {"encoding_status": "failed"}}
            )
        
        # Cleanup temp files
        try:
            os.unlink(tmp_in_path)
            if os.path.exists(tmp_out_path):
                os.unlink(tmp_out_path)
        except:
            pass
            
    except Exception as e:
        logger.error(f"Background encoding error for {song_id}: {e}")
        await db.songs.update_one(
            {"song_id": song_id},
            {"$set": {"encoding_status": "failed"}}
        )


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
