"""
Rebuild Gracefy catalog from Bunny CDN.

Scans the Bunny storage zone and creates DB rows so that all uploaded media
is playable/visible in the app, even after a fresh database.

It is IDEMPOTENT — re-running won't create duplicates.

What it creates:
    - One "Recovered Catalog" singer + album to host orphan songs
    - songs: one row per `hls/song_*` folder (HLS playable) and per `audio/*` mp3
    - teachings: one row per `teachings/*` audio file
    - neno_la_leo: one row per `neno/*` audio file (linked to first available leader, or unassigned)
    - bible_snippets is NOT touched (separate bible flow)

Run:
    cd /app/backend && python scripts/rebuild_catalog_from_cdn.py [--dry-run]
"""
import argparse
import asyncio
import os
import sys
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


def list_folder(path: str):
    """List a Bunny storage folder. Returns [] on error."""
    r = requests.get(f"{BUNNY_HOST}/{BUNNY_ZONE}/{path.strip('/')}/", headers=HEADERS, timeout=15)
    if not r.ok:
        return []
    return r.json()


def cdn_url(path: str) -> str:
    return f"{BUNNY_CDN}/{path.lstrip('/')}"


def pretty_id(file_id: str) -> str:
    """Turn 'song_03ee102b6e8e' or 'file_51fb8cffb0bb' into a friendly title."""
    base = file_id.replace(".mp3", "").replace(".m4a", "").replace(".webm", "")
    parts = base.split("_")
    if len(parts) > 1 and len(parts[-1]) >= 8:
        return f"Recovered #{parts[-1][:6].upper()}"
    return base


async def ensure_recovery_singer(db, dry: bool) -> str:
    singer = await db.singers.find_one({"singer_id": "singer_recovered"})
    if singer:
        return singer["singer_id"]
    if dry:
        print("  [dry] would create singer_recovered")
        return "singer_recovered"
    await db.singers.insert_one({
        "singer_id": "singer_recovered",
        "name": "Recovered Catalog",
        "bio": "Songs recovered from CDN after database reset. Please re-label via admin panel.",
        "photo_url": "",
        "followers_count": 0,
        "is_verified": False,
        "created_at": NOW,
        "updated_at": NOW,
    })
    print("  ✓ Created singer 'Recovered Catalog'")
    return "singer_recovered"


async def ensure_recovery_album(db, singer_id: str, dry: bool) -> str:
    album = await db.albums.find_one({"album_id": "album_recovered"})
    if album:
        return album["album_id"]
    if dry:
        print("  [dry] would create album_recovered")
        return "album_recovered"
    await db.albums.insert_one({
        "album_id": "album_recovered",
        "title": "Recovered Catalog",
        "singer_id": singer_id,
        "artist_id": singer_id,
        "singer_name": "Recovered Catalog",
        "artist_name": "Recovered Catalog",
        "thumbnail": "",
        "category_id": "cat_nyimbo",
        "category_name": "Nyimbo",
        "status": "active",
        "is_active": True,
        "is_public": True,
        "song_count": 0,
        "created_at": NOW,
        "updated_at": NOW,
        "recovered": True,
    })
    print("  ✓ Created album 'Recovered Catalog'")
    return "album_recovered"


async def rebuild_songs(db, album_id: str, singer_id: str, dry: bool):
    """For every hls/song_xxx/ folder, create a song row with HLS + best-effort MP3."""
    hls_entries = list_folder("hls")
    audio_entries = {a["ObjectName"]: a for a in list_folder("audio") if not a.get("IsDirectory")}
    general_entries = {g["ObjectName"]: g for g in list_folder("general") if not g.get("IsDirectory")}

    print(f"  Found {len(hls_entries)} HLS song folders")
    print(f"  Found {len(audio_entries)} audio/ MP3s")
    print(f"  Found {len(general_entries)} general/ files")

    created, kept = 0, 0
    order = 1
    for entry in hls_entries:
        if not entry.get("IsDirectory"):
            continue
        song_id = entry["ObjectName"]  # e.g. "song_03ee102b6e8e"
        existing = await db.songs.find_one({"song_id": song_id})
        if existing:
            kept += 1
            order += 1
            continue

        hls_url = cdn_url(f"hls/{song_id}/master.m3u8")
        # Try to find a matching MP3 fallback (same suffix)
        suffix = song_id.split("_")[-1]
        mp3_url = ""
        for name in list(audio_entries.keys()) + list(general_entries.keys()):
            if suffix in name:
                mp3_url = cdn_url(f"{'audio' if name in audio_entries else 'general'}/{name}")
                break

        song = {
            "song_id": song_id,
            "title": pretty_id(song_id),
            "title_sw": pretty_id(song_id),
            "album_id": album_id,
            "album_title": "Recovered Catalog",
            "singer_id": singer_id,
            "artist_id": singer_id,
            "singer_name": "Recovered Catalog",
            "artist_name": "Recovered Catalog",
            "hls_url": hls_url,
            "audio_url": mp3_url or hls_url,
            "thumbnail": "",
            "duration": 0,
            "track_number": order,
            "category_id": "cat_nyimbo",
            "category_name": "Nyimbo",
            "status": "active",
            "is_active": True,
            "is_public": True,
            "play_count": 0,
            "like_count": 0,
            "created_at": NOW,
            "updated_at": NOW,
            "recovered": True,  # tag so you can find them in admin
        }
        order += 1
        if dry:
            print(f"  [dry] would create song {song_id}")
            created += 1
            continue
        await db.songs.insert_one(song)
        created += 1

    if not dry and created > 0:
        await db.albums.update_one(
            {"album_id": album_id},
            {"$set": {"song_count": created + kept, "updated_at": NOW}},
        )
    print(f"  ✓ Songs: {created} created, {kept} already existed")


async def rebuild_teachings(db, dry: bool):
    entries = [e for e in list_folder("teachings") if not e.get("IsDirectory")]
    if not entries:
        print("  (no teaching files)")
        return
    created, kept = 0, 0
    for e in entries:
        name = e["ObjectName"]
        teaching_id = f"teaching_recovered_{name.replace('.', '_')[:32]}"
        if await db.teachings.find_one({"teaching_id": teaching_id}):
            kept += 1
            continue
        doc = {
            "teaching_id": teaching_id,
            "title": pretty_id(name),
            "title_sw": pretty_id(name),
            "audio_url": cdn_url(f"teachings/{name}"),
            "thumbnail": "",
            "duration": 0,
            "leader_id": "",
            "leader_name": "Unassigned",
            "is_active": True,
            "is_public": True,
            "play_count": 0,
            "monetization_type": "free",
            "created_at": NOW,
            "updated_at": NOW,
            "recovered": True,
        }
        if dry:
            print(f"  [dry] would create teaching {teaching_id}")
            created += 1
            continue
        await db.teachings.insert_one(doc)
        created += 1
    print(f"  ✓ Teachings: {created} created, {kept} already existed")


async def rebuild_neno(db, dry: bool):
    entries = [e for e in list_folder("neno") if not e.get("IsDirectory")]
    if not entries:
        print("  (no neno files)")
        return
    # Use the first available leader if any
    leader = await db.religious_leaders.find_one({}, sort=[("created_at", 1)])
    leader_id = leader["leader_id"] if leader else ""
    leader_name = (leader.get("name") if leader else None) or "Unassigned"

    created, kept = 0, 0
    for e in entries:
        name = e["ObjectName"]
        neno_id = f"neno_recovered_{name.replace('.', '_')[:32]}"
        if await db.neno_la_leo.find_one({"neno_id": neno_id}):
            kept += 1
            continue
        # Best-effort: figure out reading vs reflection from filename hint
        is_reflection = "reflection" in name.lower()
        url = cdn_url(f"neno/{name}")
        doc = {
            "neno_id": neno_id,
            "leader_id": leader_id,
            "leader_name": leader_name,
            "book": "Luka",
            "chapter": 1,
            "verse_start": 1,
            "verse_end": 1,
            "verse_reference": "Luka 1:1",
            "word_date": NOW[:10],
            "word_day_name": "Recovered",
            "publish_date": NOW[:10],
            "publish_time": "06:00",
            "publish_datetime": NOW,
            "reading_audio_url": "" if is_reflection else url,
            "reflection_audio_url": url if is_reflection else "",
            "notes": f"Recovered from CDN file: {name}. Please relabel.",
            "is_active": False,           # leave inactive — admin must review first
            "expires_at": NOW,
            "stats": {"total_plays": 0, "reading_plays": 0, "reflection_plays": 0},
            "created_at": NOW,
            "updated_at": NOW,
            "recovered": True,
        }
        if dry:
            print(f"  [dry] would create neno {neno_id}")
            created += 1
            continue
        await db.neno_la_leo.insert_one(doc)
        created += 1
    print(f"  ✓ Neno la Leo: {created} created (inactive), {kept} already existed")


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true", help="Just print what would happen")
    args = p.parse_args()
    dry = args.dry_run

    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]
    await client.admin.command("ping")
    host = mongo_url.split("@")[-1].split("/")[0]
    print(f"\n→ Rebuilding catalog into '{db_name}' on {host}")
    print(f"  CDN zone: {BUNNY_ZONE} ({BUNNY_CDN})")
    if dry:
        print("  DRY RUN — no DB writes will happen\n")
    else:
        print()

    print("[1/4] Recovery singer + album")
    singer_id = await ensure_recovery_singer(db, dry)
    album_id = await ensure_recovery_album(db, singer_id, dry)

    print("\n[2/4] Songs (from hls/)")
    await rebuild_songs(db, album_id, singer_id, dry)

    print("\n[3/4] Teachings (from teachings/)")
    await rebuild_teachings(db, dry)

    print("\n[4/4] Neno la Leo (from neno/)")
    await rebuild_neno(db, dry)

    print("\n✓ Rebuild complete.")
    print("  Next: log in to /admin → rename songs/teachings, set thumbnails, assign leaders to neno entries.")
    print("  All recovered docs are tagged {recovered: true} for easy filtering.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
