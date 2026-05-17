"""
CDN browser endpoints for admin.
Lets the admin pick already-uploaded Bunny CDN files (audio, images, HLS)
during album/song/teaching/neno creation instead of re-uploading.
"""
from datetime import datetime, timezone
from typing import Optional, List

import logging
import os
import uuid

import httpx
import requests
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/cdn/browse", tags=["Admin CDN Browser"])


BUNNY_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "")
BUNNY_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_CDN = (os.environ.get("BUNNY_CDN_URL") or "").rstrip("/")
BUNNY_HOST = "https://storage.bunnycdn.com"

AUDIO_EXTS = (".mp3", ".m4a", ".aac", ".wav", ".ogg", ".webm", ".opus")
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".bmp")

KIND_FOLDERS = {
    "audio": ["audio", "general", "teachings", "neno"],
    "image": ["images", "thumbnails", "general", "churches", "branding"],
    "hls": ["hls"],
}

KIND_DEFAULT_FOLDER = {
    "audio": "audio",
    "image": "images",
}


async def _check_admin(request: Request):
    from core.database import get_db
    db = get_db()
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token or not session_token.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    session = await db.admin_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid admin session")


def _list_folder(folder: str) -> list[dict]:
    if not BUNNY_KEY or not BUNNY_ZONE:
        return []
    folder = folder.strip("/")
    url = f"{BUNNY_HOST}/{BUNNY_ZONE}/{folder}/"
    try:
        r = requests.get(url, headers={"AccessKey": BUNNY_KEY, "Accept": "application/json"}, timeout=15)
        if not r.ok:
            return []
        return r.json() or []
    except Exception:
        return []


@router.get("/files")
async def list_cdn_files(
    request: Request,
    kind: str = Query("image", enum=["image", "audio", "hls", "all"]),
    folder: Optional[str] = None,
    search: Optional[str] = None,
):
    """List Bunny CDN files for the admin picker, enriched with
    DB-tracked friendly names (original_name) when available."""
    await _check_admin(request)
    from core.database import get_db
    db = get_db()

    if not BUNNY_KEY or not BUNNY_CDN:
        raise HTTPException(status_code=500, detail="Bunny CDN not configured on server")

    folders_to_scan = [folder] if folder else KIND_FOLDERS.get(kind, [])
    if kind == "all":
        folders_to_scan = list({*KIND_FOLDERS["audio"], *KIND_FOLDERS["image"], *KIND_FOLDERS["hls"]})

    # Pre-fetch DB rows for friendly names (cdn_url -> {original_name, display_name})
    db_rows = await db.files.find(
        {"cdn_url": {"$ne": None}},
        {"_id": 0, "cdn_url": 1, "original_name": 1, "display_name": 1, "folder": 1, "file_id": 1},
    ).to_list(5000)
    name_map = {}
    for row in db_rows:
        url = row.get("cdn_url")
        if url:
            name_map[url] = {
                "display_name": row.get("display_name") or row.get("original_name") or "",
                "original_name": row.get("original_name") or "",
                "file_id": row.get("file_id") or "",
            }

    items: list[dict] = []
    for f in folders_to_scan:
        for e in _list_folder(f):
            if e.get("IsDirectory"):
                if kind == "hls" and f == "hls":
                    name = e.get("ObjectName", "")
                    url = f"{BUNNY_CDN}/{f}/{name}/master.m3u8"
                    items.append({
                        "name": name,
                        "display_name": name_map.get(url, {}).get("display_name") or name,
                        "folder": f,
                        "url": url,
                        "kind": "hls",
                        "size": 0,
                        "modified": e.get("LastChanged") or e.get("DateCreated"),
                    })
                continue
            name = e.get("ObjectName", "")
            lower = name.lower()
            size = int(e.get("Length") or 0)
            if size < 128:
                continue  # skip empty / 0-byte placeholders

            if kind == "image" and not lower.endswith(IMAGE_EXTS):
                continue
            if kind == "audio" and not lower.endswith(AUDIO_EXTS):
                continue
            if kind == "all" and not (lower.endswith(IMAGE_EXTS) or lower.endswith(AUDIO_EXTS)):
                continue

            if search and search.lower() not in lower:
                # Also match against friendly display name (if we have it)
                url_candidate = f"{BUNNY_CDN}/{f}/{name}"
                if search.lower() not in (name_map.get(url_candidate, {}).get("display_name") or "").lower():
                    continue

            file_kind = "image" if lower.endswith(IMAGE_EXTS) else (
                "audio" if lower.endswith(AUDIO_EXTS) else "other"
            )
            url = f"{BUNNY_CDN}/{f}/{name}"
            meta = name_map.get(url, {})
            items.append({
                "name": name,
                "display_name": meta.get("display_name") or name,
                "original_name": meta.get("original_name") or "",
                "file_id": meta.get("file_id") or "",
                "folder": f,
                "url": url,
                "kind": file_kind,
                "size": size,
                "modified": e.get("LastChanged") or e.get("DateCreated"),
            })

    items.sort(key=lambda x: (x.get("modified") or ""), reverse=True)

    return {
        "files": items,
        "total": len(items),
        "kind": kind,
        "folders_scanned": folders_to_scan,
        "cdn_base": BUNNY_CDN,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/folders")
async def list_cdn_folders(request: Request):
    await _check_admin(request)
    if not BUNNY_KEY or not BUNNY_ZONE:
        raise HTTPException(status_code=500, detail="Bunny CDN not configured on server")
    root = _list_folder("")
    return {"folders": [{"name": e.get("ObjectName")} for e in root if e.get("IsDirectory")]}


# ----------------- BULK UPLOAD -----------------

async def _upload_one_to_bunny(content: bytes, folder: str, filename: str, content_type: str) -> Optional[str]:
    """PUT a single file to Bunny Storage. Returns the public CDN URL on success."""
    if not BUNNY_KEY or not BUNNY_ZONE or not BUNNY_CDN:
        return None
    folder = folder.strip("/")
    storage_url = f"{BUNNY_HOST}/{BUNNY_ZONE}/{folder}/{filename}"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.put(
                storage_url,
                content=content,
                headers={
                    "AccessKey": BUNNY_KEY,
                    "Content-Type": content_type or "application/octet-stream",
                },
                timeout=600.0,
            )
        except Exception as e:
            logger.error(f"Bunny upload error: {e}")
            return None
    if r.status_code not in (200, 201):
        logger.warning(f"Bunny upload failed {r.status_code}: {r.text[:200]}")
        return None
    return f"{BUNNY_CDN}/{folder}/{filename}"


def _sanitize_filename(name: str) -> str:
    """Make filename URL-safe but human-readable.
    Keeps the original-name as-is in DB; the CDN filename is the sanitized version.
    """
    base = os.path.basename(name or "file").strip()
    keep = "_-."
    out = "".join(c if (c.isalnum() or c in keep or c == " ") else "_" for c in base)
    out = out.replace(" ", "_")
    while "__" in out:
        out = out.replace("__", "_")
    return out[:120] or f"file_{uuid.uuid4().hex[:8]}"


@router.post("/bulk-upload")
async def bulk_upload(
    request: Request,
    files: List[UploadFile] = File(..., description="Files to upload"),
    folder: Optional[str] = Form(None, description="Target folder (defaults by content type)"),
    kind: Optional[str] = Form(None, description="image|audio — sets default folder if folder not given"),
    keep_original_name: bool = Form(True, description="Use sanitized original filename on CDN"),
):
    """Bulk upload files to Bunny CDN, tracking each in db.files with original_name."""
    await _check_admin(request)
    from core.database import get_db
    db = get_db()

    if not BUNNY_KEY or not BUNNY_CDN or not BUNNY_ZONE:
        raise HTTPException(status_code=500, detail="Bunny CDN not configured")

    default_folder = folder or KIND_DEFAULT_FOLDER.get((kind or "").lower()) or "general"

    uploaded, failed = [], []

    for f in files:
        try:
            content = await f.read()
            size = len(content)
            ct = f.content_type or "application/octet-stream"

            # Decide target folder per-file if not explicitly given
            target_folder = folder
            if not target_folder:
                if ct.startswith("audio/"):
                    target_folder = "audio"
                elif ct.startswith("image/"):
                    target_folder = "images"
                else:
                    target_folder = default_folder

            ext = os.path.splitext(f.filename or "")[1].lower()
            if keep_original_name and f.filename:
                # Preserve the user-friendly name with a uniqueness prefix to avoid clashes.
                short_id = uuid.uuid4().hex[:6]
                cdn_filename = f"{short_id}_{_sanitize_filename(f.filename)}"
            else:
                cdn_filename = f"file_{uuid.uuid4().hex[:12]}{ext}"

            cdn_url = await _upload_one_to_bunny(content, target_folder, cdn_filename, ct)
            if not cdn_url:
                failed.append({"name": f.filename, "error": "CDN upload failed"})
                continue

            # Track row in db.files so the picker shows the friendly name
            file_id = f"file_{uuid.uuid4().hex[:12]}"
            await db.files.insert_one({
                "file_id": file_id,
                "filename": cdn_filename,
                "original_name": f.filename or cdn_filename,
                "display_name": f.filename or cdn_filename,
                "folder": target_folder,
                "content_type": ct,
                "size_bytes": size,
                "cdn_url": cdn_url,
                "storage_type": "cdn",
                "uploaded_via": "bulk_admin_picker",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

            uploaded.append({
                "file_id": file_id,
                "name": cdn_filename,
                "display_name": f.filename or cdn_filename,
                "folder": target_folder,
                "url": cdn_url,
                "size": size,
                "kind": "image" if ct.startswith("image/") else ("audio" if ct.startswith("audio/") else "other"),
            })

        except Exception as e:
            logger.exception("Bulk upload item failed")
            failed.append({"name": getattr(f, "filename", "?"), "error": str(e)})

    return {
        "uploaded": uploaded,
        "failed": failed,
        "total_uploaded": len(uploaded),
        "total_failed": len(failed),
    }


@router.put("/files/rename")
async def rename_cdn_file(request: Request, data: dict):
    """Set / update display_name for a CDN file (does NOT rename the file on Bunny,
    only the friendly label shown in the picker). Useful for labeling existing files."""
    await _check_admin(request)
    from core.database import get_db
    db = get_db()
    cdn_url = data.get("cdn_url")
    display_name = (data.get("display_name") or "").strip()
    if not cdn_url or not display_name:
        raise HTTPException(status_code=400, detail="cdn_url and display_name required")

    # Upsert a label row
    await db.files.update_one(
        {"cdn_url": cdn_url},
        {
            "$set": {"display_name": display_name, "updated_at": datetime.now(timezone.utc).isoformat()},
            "$setOnInsert": {
                "file_id": f"file_{uuid.uuid4().hex[:12]}",
                "cdn_url": cdn_url,
                "filename": cdn_url.rsplit("/", 1)[-1],
                "original_name": display_name,
                "folder": cdn_url.split("/")[-2] if "/" in cdn_url else "general",
                "storage_type": "cdn",
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        },
        upsert=True,
    )
    return {"cdn_url": cdn_url, "display_name": display_name}
