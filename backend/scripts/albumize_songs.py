"""
Per-song albumization + image allocation.

For every song in the database:
  - Creates a new album with `title = song.title`, `album_id = album_<short_id>`
  - Re-points the song to that new album_id
  - Assigns a CDN image as the song & album thumbnail (round-robin across available images)

Idempotent: re-running will skip songs that already have a unique album + thumbnail.
By default it processes all songs; pass --only-recovered to limit to ones tagged
{recovered: true}.

Run:
    cd /app/backend
    python scripts/albumize_songs.py            # all songs
    python scripts/albumize_songs.py --only-recovered
    python scripts/albumize_songs.py --dry-run
"""
import argparse
import asyncio
import os
import random
import uuid
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))

BUNNY_ZONE = os.environ["BUNNY_STORAGE_ZONE"]
BUNNY_KEY = os.environ["BUNNY_API_KEY"]
BUNNY_CDN = os.environ["BUNNY_CDN_URL"].rstrip("/")
BUNNY_HOST = "https://storage.bunnycdn.com"

NOW = datetime.now(timezone.utc).isoformat()
HEADERS = {"AccessKey": BUNNY_KEY, "Accept": "application/json"}
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic")


def list_folder(path: str):
    r = requests.get(f"{BUNNY_HOST}/{BUNNY_ZONE}/{path.strip('/')}/", headers=HEADERS, timeout=15)
    return r.json() if r.ok else []


def gather_images() -> list[str]:
    """Collect valid (non-zero) image URLs from all relevant CDN folders."""
    urls = []
    for folder in ["images", "thumbnails", "general"]:
        for f in list_folder(folder):
            if f.get("IsDirectory"):
                continue
            name = f["ObjectName"]
            if not any(name.lower().endswith(e) for e in IMG_EXTS):
                continue
            if (f.get("Length") or 0) < 1024:  # skip 0-byte / corrupt
                continue
            urls.append(f"{BUNNY_CDN}/{folder}/{name}")
    return urls


async def albumize(only_recovered: bool, dry: bool):
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]
    await client.admin.command("ping")
    host = mongo_url.split("@")[-1].split("/")[0]
    print(f"\n→ Albumizing songs in '{db_name}' on {host}")
    print(f"  Filter: {'only recovered' if only_recovered else 'all songs'}")
    if dry:
        print("  DRY RUN — no DB writes\n")
    else:
        print()

    # Get all available images
    image_pool = gather_images()
    random.seed(42)  # deterministic so re-runs assign same image to same song
    random.shuffle(image_pool)
    print(f"  Image pool: {len(image_pool)} CDN images available\n")
    if not image_pool:
        print("✗ No images found. Aborting.")
        client.close()
        return

    # Find songs
    query = {"recovered": True} if only_recovered else {}
    songs = await db.songs.find(query, {"_id": 0}).to_list(2000)
    print(f"  Songs to process: {len(songs)}\n")

    created_albums, updated_songs, skipped = 0, 0, 0

    for idx, song in enumerate(songs):
        song_id = song["song_id"]
        title = song.get("title") or f"Untitled {song_id[-6:]}"
        suffix = song_id.replace("song_", "")[:12]
        new_album_id = f"album_{suffix}"

        # If the song already lives in its own album with a thumbnail, skip
        if song.get("album_id") == new_album_id and song.get("thumbnail"):
            skipped += 1
            continue

        # Pick deterministic thumbnail
        thumb = image_pool[idx % len(image_pool)]
        artist_id = song.get("artist_id") or song.get("singer_id") or "singer_recovered"
        artist_name = song.get("artist_name") or song.get("singer_name") or "Recovered Catalog"

        # Build per-song album
        album_doc = {
            "album_id": new_album_id,
            "title": title,
            "title_sw": title,
            "singer_id": artist_id,
            "artist_id": artist_id,
            "singer_name": artist_name,
            "artist_name": artist_name,
            "thumbnail": thumb,
            "category_id": song.get("category_id") or "cat_nyimbo",
            "category_name": song.get("category_name") or "Nyimbo",
            "status": "active",
            "is_active": True,
            "is_public": True,
            "song_count": 1,
            "play_count": 0,
            "created_at": song.get("created_at") or NOW,
            "updated_at": NOW,
            "recovered": bool(song.get("recovered")),
        }

        if dry:
            print(f"  [dry] album_{suffix} ← '{title}' (thumb={thumb.rsplit('/',1)[-1][:24]}...)")
            created_albums += 1
            updated_songs += 1
            continue

        # Upsert album
        await db.albums.update_one(
            {"album_id": new_album_id},
            {"$set": album_doc},
            upsert=True,
        )
        created_albums += 1

        # Update song to point at new album + use same thumbnail
        await db.songs.update_one(
            {"song_id": song_id},
            {
                "$set": {
                    "album_id": new_album_id,
                    "album_title": title,
                    "thumbnail": thumb,
                    "updated_at": NOW,
                }
            },
        )
        updated_songs += 1

    print(f"\n  ✓ Albums created/updated: {created_albums}")
    print(f"  ✓ Songs re-pointed:       {updated_songs}")
    print(f"  ✓ Already done (skipped): {skipped}")

    # Clean up: delete the legacy bulk album if it's now empty
    if not dry:
        legacy = await db.albums.find_one({"album_id": "album_recovered"})
        if legacy:
            remaining = await db.songs.count_documents({"album_id": "album_recovered"})
            if remaining == 0:
                await db.albums.delete_one({"album_id": "album_recovered"})
                print("  ✓ Removed legacy 'album_recovered' (empty)")
            else:
                print(f"  ! 'album_recovered' still has {remaining} songs — left untouched")

    print("\n✓ Done. Refresh the app — every song now appears as its own album with a cover.")
    print("  Note: admin can still rename songs/albums via /admin panel.")
    client.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--only-recovered", action="store_true", help="Only process songs tagged {recovered: true}")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(albumize(args.only_recovered, args.dry_run))


if __name__ == "__main__":
    main()
