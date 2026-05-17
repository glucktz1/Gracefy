"""
CDN browser endpoints for admin.
Lets the admin pick already-uploaded Bunny CDN files (audio, images, HLS)
during album/song/teaching/neno creation instead of re-uploading.
"""
from datetime import datetime, timezone
from typing import Optional

import os
import requests
from fastapi import APIRouter, HTTPException, Query, Request


router = APIRouter(prefix="/api/admin/cdn/browse", tags=["Admin CDN Browser"])


BUNNY_ZONE = os.environ.get("BUNNY_STORAGE_ZONE", "")
BUNNY_KEY = os.environ.get("BUNNY_API_KEY", "")
BUNNY_CDN = (os.environ.get("BUNNY_CDN_URL") or "").rstrip("/")
BUNNY_HOST = "https://storage.bunnycdn.com"

AUDIO_EXTS = (".mp3", ".m4a", ".aac", ".wav", ".ogg", ".webm", ".opus")
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".bmp")

# Map "kind" → folders to scan
KIND_FOLDERS = {
    "audio": ["audio", "general", "teachings", "neno"],
    "image": ["images", "thumbnails", "general", "churches", "branding"],
    "hls": ["hls"],
}


def _require_admin(request: Request):
    """Lightweight admin gate (matches the cookie-based session check in other routes)."""
    from core.database import get_db  # local import to avoid circulars during module load
    return get_db  # placeholder; actual check below


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
    """List Bunny CDN files for the admin picker.

    Returns a flat list of {name, url, folder, size, kind, modified}.
    Only files matching the requested kind's extensions are returned.
    """
    await _check_admin(request)

    if not BUNNY_KEY or not BUNNY_CDN:
        raise HTTPException(status_code=500, detail="Bunny CDN not configured on server")

    folders_to_scan = [folder] if folder else KIND_FOLDERS.get(kind, [])
    if kind == "all":
        folders_to_scan = list({*KIND_FOLDERS["audio"], *KIND_FOLDERS["image"], *KIND_FOLDERS["hls"]})

    items: list[dict] = []
    for f in folders_to_scan:
        entries = _list_folder(f)
        for e in entries:
            if e.get("IsDirectory"):
                # For HLS, every directory IS the item we want (song_id)
                if kind == "hls" and f == "hls":
                    name = e.get("ObjectName", "")
                    items.append({
                        "name": name,
                        "folder": f,
                        "url": f"{BUNNY_CDN}/{f}/{name}/master.m3u8",
                        "kind": "hls",
                        "size": 0,
                        "modified": e.get("LastChanged") or e.get("DateCreated"),
                    })
                continue
            name = e.get("ObjectName", "")
            lower = name.lower()
            size = int(e.get("Length") or 0)
            if size < 256:
                continue  # skip empty / placeholder files

            if kind == "image":
                if not lower.endswith(IMAGE_EXTS):
                    continue
            elif kind == "audio":
                if not lower.endswith(AUDIO_EXTS):
                    continue
            elif kind == "all":
                if not (lower.endswith(IMAGE_EXTS) or lower.endswith(AUDIO_EXTS)):
                    continue

            if search and search.lower() not in lower:
                continue

            file_kind = "image" if lower.endswith(IMAGE_EXTS) else (
                "audio" if lower.endswith(AUDIO_EXTS) else "other"
            )
            items.append({
                "name": name,
                "folder": f,
                "url": f"{BUNNY_CDN}/{f}/{name}",
                "kind": file_kind,
                "size": size,
                "modified": e.get("LastChanged") or e.get("DateCreated"),
            })

    # Sort newest first
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
    """Return the top-level CDN folders + their item counts (rough)."""
    await _check_admin(request)
    if not BUNNY_KEY or not BUNNY_ZONE:
        raise HTTPException(status_code=500, detail="Bunny CDN not configured on server")
    root = _list_folder("")
    folders = []
    for e in root:
        if e.get("IsDirectory"):
            name = e.get("ObjectName")
            folders.append({"name": name})
    return {"folders": folders}
