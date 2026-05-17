"""
Seed standard home page sections + supplementary categories.
Restores the layout users expect: Radio, Mafundisho, Neno la Leo,
Kwaresma, Pasaka, Krismasi, Choirs etc.

Re-run safe (uses $setOnInsert).
"""
import asyncio
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))

NOW = datetime.now(timezone.utc).isoformat()


# Additional liturgical/seasonal categories
EXTRA_CATEGORIES = [
    {"slug": "kwaresma",  "name": "Kwaresma",  "name_en": "Lent",      "icon": "cross",   "order": 6},
    {"slug": "pasaka",    "name": "Pasaka",    "name_en": "Easter",    "icon": "sparkles", "order": 7},
    {"slug": "krismasi",  "name": "Krismasi",  "name_en": "Christmas", "icon": "star",    "order": 8},
    {"slug": "advent",    "name": "Majilio",   "name_en": "Advent",    "icon": "candle",  "order": 9},
    {"slug": "neno-la-mungu", "name": "Neno la Mungu", "name_en": "Word of God", "icon": "book", "order": 10},
    {"slug": "rosari",    "name": "Rozari",    "name_en": "Rosary",    "icon": "circle",  "order": 11},
]


# Layout sections — order they appear top-to-bottom on home
LAYOUT_SECTIONS = [
    {
        "section_id": "section_hero",
        "name": "hero",
        "section_type": "hero",
        "title": "Hero",
        "title_sw": "Hero",
        "display_name_sw": "Hero",
        "sort_order": 0,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 5,
    },
    {
        "section_id": "section_kwaresma",
        "name": "kwaresma",
        "section_type": "seasonal",
        "title": "Kwaresma",
        "title_sw": "Kwaresma",
        "display_name_sw": "Kwaresma",
        "subtitle": "Nyimbo za Kipindi cha Kwaresma",
        "link_category_id": "cat_kwaresma",
        "sort_order": 2,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 20,
    },
    {
        "section_id": "section_pasaka",
        "name": "pasaka",
        "section_type": "seasonal",
        "title": "Pasaka",
        "title_sw": "Pasaka",
        "display_name_sw": "Pasaka",
        "subtitle": "Nyimbo za Pasaka — Amefufuka!",
        "link_category_id": "cat_pasaka",
        "sort_order": 3,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 20,
    },
    {
        "section_id": "section_mafundisho",
        "name": "mafundisho",
        "section_type": "mafundisho",
        "title": "Mafundisho",
        "title_sw": "Mafundisho",
        "display_name_sw": "Mafundisho",
        "subtitle": "Teachings from leaders",
        "sort_order": 4,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 20,
    },
    {
        "section_id": "section_trending",
        "name": "trending",
        "section_type": "trending",
        "title": "Trending Now",
        "title_sw": "Maarufu Sasa",
        "display_name_sw": "Maarufu Sasa",
        "sort_order": 5,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 12,
    },
    {
        "section_id": "section_most_listened",
        "name": "most_listened",
        "section_type": "trending",  # routed via "most_listened" name match in home.py
        "title": "Zilizosikilizwa Zaidi",
        "title_sw": "Zilizosikilizwa Zaidi",
        "display_name_sw": "Zilizosikilizwa Zaidi",
        "sort_order": 6,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 12,
    },
    {
        "section_id": "section_choirs",
        "name": "choirs",
        "section_type": "choirs",
        "title": "Kwaya",
        "title_sw": "Kwaya",
        "display_name_sw": "Kwaya",
        "sort_order": 7,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 15,
    },
    {
        "section_id": "section_churches",
        "name": "churches",
        "section_type": "churches",
        "title": "Makanisa",
        "title_sw": "Makanisa",
        "display_name_sw": "Makanisa",
        "sort_order": 8,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 15,
    },
    {
        "section_id": "section_radio",
        "name": "radio",
        "section_type": "custom",
        "custom_content_type": "radio",
        "content_type": "radio",
        "title": "Redio",
        "title_sw": "Redio",
        "display_name_sw": "Redio",
        "sort_order": 9,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 10,
    },
    {
        "section_id": "section_bible",
        "name": "bible",
        "section_type": "bible_content",
        "title": "Biblia",
        "title_sw": "Biblia",
        "display_name_sw": "Biblia",
        "sort_order": 10,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
        "limit": 8,
    },
    {
        "section_id": "section_categories",
        "name": "categories",
        "section_type": "categories",
        "title": "Vinjari Kategoria",
        "title_sw": "Vinjari Kategoria",
        "display_name_sw": "Vinjari Kategoria",
        "sort_order": 11,
        "platforms": ["web", "app", "mobile"],
        "is_active": True,
    },
]


async def seed():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=10000)
    db = client[os.environ["DB_NAME"]]
    await client.admin.command("ping")
    host = os.environ["MONGO_URL"].split("@")[-1].split("/")[0]
    print(f"→ Seeding home layout on {host}\n")

    # 1) Additional categories
    print("[1/3] Adding seasonal categories")
    for c in EXTRA_CATEGORIES:
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
            {"slug": c["slug"]}, {"$setOnInsert": cat}, upsert=True
        )
        verb = "Created" if res.upserted_id else "Kept"
        print(f"  ✓ {verb} {c['slug']}")

    # 2) Hero config
    print("\n[2/3] Hero config")
    hero_doc = {
        "config_id": "main",
        "hero_type": "dynamic_content",  # auto-pull from latest albums
        "auto_rotate": True,
        "rotation_interval": 5000,
        "show_navigation": True,
        "content_ids": [],  # admin can pin specific albums
        "created_at": NOW,
        "updated_at": NOW,
    }
    res = await db.hero_config.update_one(
        {"config_id": "main"}, {"$setOnInsert": hero_doc}, upsert=True
    )
    print(f"  ✓ {'Created' if res.upserted_id else 'Kept'} hero_config")

    # 3) Layout sections (drop the temporary recovery section if present)
    print("\n[3/3] Layout sections")
    deleted = await db.layout_sections.delete_many(
        {"section_id": {"$in": ["section_recovered_songs"]}}
    )
    if deleted.deleted_count:
        print("  ✓ Removed legacy recovery section")

    for s in LAYOUT_SECTIONS:
        s["created_at"] = s.get("created_at") or NOW
        s["updated_at"] = NOW
        res = await db.layout_sections.update_one(
            {"section_id": s["section_id"]},
            {"$set": s},  # use $set so we overwrite stale older shape
            upsert=True,
        )
        verb = "Created" if res.upserted_id else "Updated"
        print(f"  ✓ {verb:<8} {s['section_id']:<28} [{s['section_type']}]")

    print("\n✓ Home layout seeded. Restart backend to invalidate caches.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
