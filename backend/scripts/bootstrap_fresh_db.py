"""
Bootstrap script for a fresh MongoDB cluster.
Run this ONCE after pointing MONGO_URL at a new/empty database.

Usage:
    cd /app/backend
    python scripts/bootstrap_fresh_db.py

What it creates (idempotent — safe to re-run):
    - Admin user: admin@gracefy.life (empty password — change after first login)
    - app_settings: guest_limits, billing (off), app_config (store links)
    - auth_settings: registration enabled, password min 6
    - Default categories: Wimbo, Mafundisho, Biblia, Watoto, Kwaya
    - Critical performance indexes on hot collections

It does NOT recreate any content (albums, songs, leaders) — those come from
your old DB via mongorestore, or via the admin panel.
"""
import asyncio
import hashlib
import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


# Make sure we load /app/backend/.env regardless of cwd
_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))


NOW = datetime.now(timezone.utc).isoformat()


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


async def ensure_admin(db):
    """Create the bootstrap admin if missing."""
    existing = await db.admin_users.find_one({"email": "admin@gracefy.life"})
    if existing:
        print(f"  ✓ admin@gracefy.life already exists (admin_id={existing.get('admin_id')})")
        return existing["admin_id"]

    admin_id = f"admin_{uuid.uuid4().hex[:12]}"
    admin_doc = {
        "admin_id": admin_id,
        "email": "admin@gracefy.life",
        "name": "Gracefy Admin",
        "role": "admin",
        "permissions": [
            "user_management",
            "content_management",
            "analytics",
            "settings",
            "billing",
            "advertising",
        ],
        "status": "active",
        "password_hash": "",          # empty hash combined with allow_empty_password
        "allow_empty_password": True,  # for first-login; change in production
        "created_at": NOW,
        "updated_at": NOW,
    }
    await db.admin_users.insert_one(admin_doc)
    print("  ✓ Created admin admin@gracefy.life (empty password — CHANGE AFTER LOGIN)")
    return admin_id


async def ensure_app_settings(db):
    """Seed app_settings docs the public API depends on."""
    docs = [
        {
            "setting_type": "guest_limits",
            "config": {
                "max_plays": 5,
                "max_skips": 5,
                "max_listen_minutes": 30,
                "max_plays_mobile": 3,
                "max_skips_mobile": 3,
            },
            "updated_at": NOW,
        },
        {
            "setting_type": "billing",
            "enabled": False,                     # default OFF — "Huduma Bure!"
            "config": {"currency": "TZS"},
            "updated_at": NOW,
        },
        {
            "setting_type": "app_config",
            "config": {
                "playstore_url": "https://play.google.com/store/apps/details?id=com.gracefy.app",
                "appstore_url": "",
                "app_download_message": "",
                "app_version": "1.0.178",
            },
            "updated_at": NOW,
        },
    ]
    for d in docs:
        res = await db.app_settings.update_one(
            {"setting_type": d["setting_type"]},
            {"$setOnInsert": d},
            upsert=True,
        )
        verb = "Created" if res.upserted_id else "Kept"
        print(f"  ✓ {verb} app_settings/{d['setting_type']}")


async def ensure_auth_settings(db):
    doc = {
        "settings_id": "auth_settings",
        "registration_enabled": True,
        "password_min_length": 6,
        "google_oauth_enabled": True,
        "guest_browsing_enabled": True,
        "updated_at": NOW,
    }
    res = await db.auth_settings.update_one(
        {"settings_id": "auth_settings"},
        {"$setOnInsert": doc},
        upsert=True,
    )
    verb = "Created" if res.upserted_id else "Kept"
    print(f"  ✓ {verb} auth_settings")


async def ensure_categories(db):
    """Seed minimal default categories so the UI has something to render."""
    defaults = [
        {"slug": "nyimbo", "name": "Nyimbo", "name_en": "Songs", "icon": "music", "order": 1},
        {"slug": "mafundisho", "name": "Mafundisho", "name_en": "Teachings", "icon": "book-open", "order": 2},
        {"slug": "biblia", "name": "Biblia", "name_en": "Bible", "icon": "book", "order": 3},
        {"slug": "kwaya", "name": "Kwaya", "name_en": "Choirs", "icon": "users", "order": 4},
        {"slug": "watoto", "name": "Watoto", "name_en": "Children", "icon": "smile", "order": 5},
    ]
    for c in defaults:
        cat = {
            "category_id": f"cat_{c['slug']}",
            "name": c["name"],
            "name_en": c["name_en"],
            "slug": c["slug"],
            "icon": c["icon"],
            "display_order": c["order"],
            "is_active": True,
            "created_at": NOW,
            "updated_at": NOW,
        }
        res = await db.categories.update_one(
            {"slug": c["slug"]},
            {"$setOnInsert": cat},
            upsert=True,
        )
        verb = "Created" if res.upserted_id else "Kept"
        print(f"  ✓ {verb} category /{c['slug']}")


async def ensure_indexes(db):
    """Create indexes that hot endpoints rely on."""
    plan = {
        # Auth
        "users":                  [("user_id", 1), ("email", 1)],
        "admin_users":            [("admin_id", 1), ("email", 1)],
        "user_sessions":          [("session_token", 1), ("user_id", 1)],
        "admin_sessions":         [("session_token", 1)],
        # Content
        "albums":                 [("album_id", 1), ("singer_id", 1), ("created_at", -1)],
        "songs":                  [("song_id", 1), ("album_id", 1)],
        "singers":                [("singer_id", 1)],
        "choirs":                 [("choir_id", 1)],
        "churches":               [("church_id", 1)],
        "categories":             [("category_id", 1), ("slug", 1)],
        "religious_leaders":      [("leader_id", 1), ("email", 1)],
        "leader_tokens":          [("token", 1), ("leader_id", 1)],
        "neno_la_leo":            [("neno_id", 1), ("leader_id", 1), ("publish_datetime", 1), ("is_active", 1)],
        "teachings":              [("teaching_id", 1), ("leader_id", 1)],
        # User-generated
        "playlists":              [("playlist_id", 1), ("user_id", 1)],
        "user_library_items":     [("user_id", 1)],
        "liked_songs":            [("user_id", 1)],
        "follows":                [("user_id", 1)],
        # Settings
        "app_settings":           [("setting_type", 1)],
        "auth_settings":          [("settings_id", 1)],
    }
    for coll, fields in plan.items():
        for f in fields:
            try:
                idx_name = await db[coll].create_index([f], background=True)
                print(f"  ✓ {coll}.{f[0]} indexed ({idx_name})")
            except Exception as e:
                print(f"  ! {coll}.{f[0]} index skipped: {e}")


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("✗ MONGO_URL or DB_NAME missing in /app/backend/.env")
        sys.exit(1)

    safe_host = mongo_url.split("@")[-1].split("/")[0] if "@" in mongo_url else mongo_url.split("//")[-1].split("/")[0]
    print(f"\n→ Bootstrapping database '{db_name}' on {safe_host}\n")

    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]

    # Quick ping
    try:
        await client.admin.command("ping")
    except Exception as e:
        print(f"✗ Could not connect to MongoDB: {e}")
        sys.exit(1)
    print("✓ Connected to MongoDB\n")

    print("[1/5] Admin user")
    await ensure_admin(db)

    print("\n[2/5] App settings")
    await ensure_app_settings(db)

    print("\n[3/5] Auth settings")
    await ensure_auth_settings(db)

    print("\n[4/5] Default categories")
    await ensure_categories(db)

    print("\n[5/5] Indexes")
    await ensure_indexes(db)

    print("\n✓ Bootstrap complete. You can now log in at /admin/login with admin@gracefy.life (empty password).")
    print("  IMPORTANT: change the admin password immediately after first login.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
