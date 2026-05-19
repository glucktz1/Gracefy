"""
Idempotent seed: creates demo accounts for QA + test_credentials.md.

Creates / updates:
  • content_manager@gracefy.test  →  Admin user with content-only permissions
  • priest.demo@gracefy.test       →  Religious leader (approved, can post Neno)
  • choir.demo@gracefy.test        →  Choir account (approved, can upload songs)

All accounts use password: see /app/memory/test_credentials.md
"""

import asyncio
import hashlib
import uuid
from datetime import datetime, timezone
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")


def _hash(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()


CONTENT_MANAGER = {
    "email": "content_manager@gracefy.test",
    "password": "Content@2026",
    "name": "Demo Content Manager",
    "permissions": [
        "content_moderation",
        "content_approval",
        "create_albums",
        "manage_albums",
        "manage_songs",
        "manage_own_content",
        "bulk_upload",
        "view_platform_analytics",
        "view_own_analytics",
        "platform_settings",
        "layout_promotion_control",
        "featured_content",
        "manage_banners",
    ],
}

PRIEST_LEADER = {
    "email": "priest.demo@gracefy.test",
    "password": "Priest@2026",
    "name": "Fr. Demo Priest",
    "title": "Father",
    "denomination": "Catholic",
}

CHOIR_ACCOUNT = {
    "email": "choir.demo@gracefy.test",
    "password": "Choir@2026",
    "name": "Demo Choir",
    "owner_name": "Demo Choir Leader",
    "phone": "+255700000000",
}


async def _seed_content_manager(db):
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.admin_users.find_one({"email": CONTENT_MANAGER["email"]})
    payload = {
        "email": CONTENT_MANAGER["email"],
        "name": CONTENT_MANAGER["name"],
        "username": "content_manager",
        "role": "content_manager",
        "permissions": CONTENT_MANAGER["permissions"],
        "is_super_admin": False,
        "is_active": True,
        "status": "active",
        "allow_empty_password": False,
        "password_hash": _hash(CONTENT_MANAGER["password"]),
        "updated_at": now,
    }
    if existing:
        await db.admin_users.update_one({"email": CONTENT_MANAGER["email"]}, {"$set": payload})
        print(f"✅ Updated content_manager: {CONTENT_MANAGER['email']}")
    else:
        payload["admin_id"] = f"adm_{uuid.uuid4().hex[:12]}"
        payload["user_id"] = payload["admin_id"]
        payload["created_at"] = now
        await db.admin_users.insert_one(payload)
        print(f"✅ Created content_manager: {CONTENT_MANAGER['email']}")


async def _seed_priest(db):
    now = datetime.now(timezone.utc).isoformat()
    # Religious leader profile (visible publicly + linked to neno la leo)
    leader_id = "leader_demo_priest"
    leader_doc = {
        "leader_id": leader_id,
        "name": PRIEST_LEADER["name"],
        "title": PRIEST_LEADER["title"],
        "denomination": PRIEST_LEADER["denomination"],
        "bio": "Demo religious leader for QA. Uploads daily Neno la Leo readings & reflections.",
        "language": "sw",
        "photo_url": "",
        "country": "Tanzania",
        "status": "active",
        "is_active": True,
        "stats": {"total_teachings": 0, "total_neno": 0, "follower_count": 0},
        "updated_at": now,
    }
    if not await db.religious_leaders.find_one({"leader_id": leader_id}):
        leader_doc["created_at"] = now
        await db.religious_leaders.insert_one(leader_doc)
        print(f"✅ Created religious_leader profile: {leader_id}")
    else:
        await db.religious_leaders.update_one({"leader_id": leader_id}, {"$set": leader_doc})
        print(f"✅ Updated religious_leader profile: {leader_id}")

    # Account (login row)
    account_id = "leader_acc_demo"
    account_doc = {
        "account_id": account_id,
        "leader_id": leader_id,
        "email": PRIEST_LEADER["email"],
        "name": PRIEST_LEADER["name"],
        "password_hash": _hash(PRIEST_LEADER["password"]),
        "status": "approved",
        "approved_at": now,
        "is_active": True,
        "updated_at": now,
    }
    if not await db.leader_accounts.find_one({"email": PRIEST_LEADER["email"]}):
        account_doc["created_at"] = now
        await db.leader_accounts.insert_one(account_doc)
        print(f"✅ Created leader_account: {PRIEST_LEADER['email']}")
    else:
        await db.leader_accounts.update_one({"email": PRIEST_LEADER["email"]}, {"$set": account_doc})
        print(f"✅ Updated leader_account: {PRIEST_LEADER['email']}")


async def _seed_choir(db):
    now = datetime.now(timezone.utc).isoformat()
    # Choir profile (in `singers` collection per existing schema)
    singer_id = "choir_demo"
    singer_doc = {
        "singer_id": singer_id,
        "name": CHOIR_ACCOUNT["name"],
        "type": "choir",
        "country": "Tanzania",
        "bio": "Demo choir for QA. Uploads choir albums + songs.",
        "is_active": True,
        "status": "active",
        "updated_at": now,
    }
    if not await db.singers.find_one({"singer_id": singer_id}):
        singer_doc["created_at"] = now
        await db.singers.insert_one(singer_doc)
        print(f"✅ Created singer (choir) profile: {singer_id}")
    else:
        await db.singers.update_one({"singer_id": singer_id}, {"$set": singer_doc})
        print(f"✅ Updated singer (choir) profile: {singer_id}")

    # Choir account (login row)
    account_id = "choir_acc_demo"
    account_doc = {
        "account_id": account_id,
        "choir_id": singer_id,
        "email": CHOIR_ACCOUNT["email"],
        "name": CHOIR_ACCOUNT["name"],
        "owner_name": CHOIR_ACCOUNT["owner_name"],
        "phone": CHOIR_ACCOUNT["phone"],
        "password_hash": _hash(CHOIR_ACCOUNT["password"]),
        "status": "approved",
        "approved_at": now,
        "is_active": True,
        "updated_at": now,
    }
    if not await db.choir_accounts.find_one({"email": CHOIR_ACCOUNT["email"]}):
        account_doc["created_at"] = now
        await db.choir_accounts.insert_one(account_doc)
        print(f"✅ Created choir_account: {CHOIR_ACCOUNT['email']}")
    else:
        await db.choir_accounts.update_one({"email": CHOIR_ACCOUNT["email"]}, {"$set": account_doc})
        print(f"✅ Updated choir_account: {CHOIR_ACCOUNT['email']}")


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    await _seed_content_manager(db)
    await _seed_priest(db)
    await _seed_choir(db)
    print()
    print("🎉 Demo accounts ready. See /app/memory/test_credentials.md")


if __name__ == "__main__":
    sys.path.insert(0, "/app/backend")
    asyncio.run(main())
