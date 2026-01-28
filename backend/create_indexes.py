"""
Database indexes for optimal query performance.
Run this script once on deployment or after schema changes.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


async def create_indexes():
    """Create all database indexes for optimal performance."""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Creating database indexes for optimal performance...")
    print("=" * 60)
    
    # ============== MUSIC CONTENT ==============
    
    print("\n📀 Albums collection:")
    await db.albums.create_index("album_id", unique=True, background=True)
    await db.albums.create_index("status", background=True)
    await db.albums.create_index("category_id", background=True)
    await db.albums.create_index("artist_id", background=True)
    await db.albums.create_index([("status", 1), ("created_at", -1)], background=True)
    await db.albums.create_index([("total_plays", -1)], background=True)
    print("   ✓ 6 indexes created")
    
    print("\n🎵 Songs collection:")
    await db.songs.create_index("song_id", unique=True, background=True)
    await db.songs.create_index("album_id", background=True)
    await db.songs.create_index("status", background=True)
    await db.songs.create_index([("album_id", 1), ("track_number", 1)], background=True)
    await db.songs.create_index([("album_id", 1), ("status", 1)], background=True)
    await db.songs.create_index("song_categories", background=True)
    await db.songs.create_index([("plays", -1)], background=True)
    print("   ✓ 7 indexes created")
    
    print("\n🏷️ Song categories collection:")
    await db.song_categories.create_index("song_category_id", unique=True, background=True)
    await db.song_categories.create_index("status", background=True)
    print("   ✓ 2 indexes created")
    
    print("\n🔀 Special mixes collection:")
    await db.special_mixes.create_index("mix_id", unique=True, background=True)
    await db.special_mixes.create_index("status", background=True)
    print("   ✓ 2 indexes created")
    
    # ============== USERS & AUTH ==============
    
    print("\n👤 App users collection:")
    await db.app_users.create_index("user_id", unique=True, background=True)
    await db.app_users.create_index("email", unique=True, sparse=True, background=True)
    await db.app_users.create_index("google_id", sparse=True, background=True)
    await db.app_users.create_index("status", background=True)
    await db.app_users.create_index([("created_at", -1)], background=True)
    print("   ✓ 5 indexes created")
    
    print("\n🔑 User tokens collection:")
    await db.user_tokens.create_index("token", unique=True, background=True)
    await db.user_tokens.create_index("user_id", background=True)
    await db.user_tokens.create_index([("created_at", 1)], expireAfterSeconds=86400*30, background=True)  # 30 day TTL
    print("   ✓ 3 indexes created (including TTL)")
    
    print("\n📚 User library collection:")
    await db.user_library.create_index("user_id", unique=True, background=True)
    print("   ✓ 1 index created")
    
    # ============== CHURCHES & CHOIRS ==============
    
    print("\n⛪ Churches collection:")
    await db.churches.create_index("church_id", unique=True, background=True)
    await db.churches.create_index("status", background=True)
    await db.churches.create_index([("followers_count", -1)], background=True)
    print("   ✓ 3 indexes created")
    
    print("\n🎤 Singers (choirs) collection:")
    await db.singers.create_index("singer_id", unique=True, background=True)
    await db.singers.create_index("status", background=True)
    await db.singers.create_index("church_id", background=True)
    await db.singers.create_index([("followers_count", -1)], background=True)
    print("   ✓ 4 indexes created")
    
    # ============== LEADER CONTENT ==============
    
    print("\n📖 Content containers collection:")
    await db.content_containers.create_index("container_id", unique=True, background=True)
    await db.content_containers.create_index("status", background=True)
    await db.content_containers.create_index("author_id", background=True)
    print("   ✓ 3 indexes created")
    
    print("\n📑 Content series collection:")
    await db.content_series.create_index("series_id", unique=True, background=True)
    await db.content_series.create_index("container_id", background=True)
    print("   ✓ 2 indexes created")
    
    print("\n🎧 Content episodes collection:")
    await db.content_episodes.create_index("episode_id", unique=True, background=True)
    await db.content_episodes.create_index("series_id", background=True)
    await db.content_episodes.create_index("container_id", background=True)
    print("   ✓ 3 indexes created")
    
    # ============== LAYOUT & UI ==============
    
    print("\n📱 Layout sections collection:")
    await db.layout_sections.create_index("section_id", unique=True, background=True)
    await db.layout_sections.create_index([("platforms", 1), ("is_active", 1), ("sort_order", 1)], background=True)
    print("   ✓ 2 indexes created")
    
    print("\n🖼️ Hero banners collection:")
    await db.hero_banners.create_index("banner_id", unique=True, background=True)
    await db.hero_banners.create_index([("is_active", 1), ("order", 1)], background=True)
    print("   ✓ 2 indexes created")
    
    # ============== PAYMENTS ==============
    
    print("\n💳 Transactions collection:")
    await db.transactions.create_index("transaction_id", unique=True, background=True)
    await db.transactions.create_index("user_id", background=True)
    await db.transactions.create_index("external_ref", background=True)
    await db.transactions.create_index("status", background=True)
    await db.transactions.create_index([("created_at", -1)], background=True)
    await db.transactions.create_index([("user_id", 1), ("status", 1)], background=True)
    print("   ✓ 6 indexes created")
    
    print("\n📋 Subscription plans collection:")
    await db.subscription_plans.create_index("plan_id", unique=True, background=True)
    await db.subscription_plans.create_index([("is_active", 1), ("sort_order", 1)], background=True)
    print("   ✓ 2 indexes created")
    
    # ============== ANALYTICS ==============
    
    print("\n📊 Page views collection:")
    await db.page_views.create_index("view_id", unique=True, background=True)
    await db.page_views.create_index("session_id", background=True)
    await db.page_views.create_index("user_id", sparse=True, background=True)
    await db.page_views.create_index([("timestamp", -1)], background=True)
    await db.page_views.create_index([("timestamp", 1)], expireAfterSeconds=86400*90, background=True)  # 90 day TTL
    print("   ✓ 5 indexes created (including TTL)")
    
    print("\n🎶 Listening sessions collection:")
    await db.listening_sessions.create_index("session_id", unique=True, background=True)
    await db.listening_sessions.create_index("user_id", sparse=True, background=True)
    await db.listening_sessions.create_index("song_id", background=True)
    await db.listening_sessions.create_index([("started_at", -1)], background=True)
    print("   ✓ 4 indexes created")
    
    print("\n🔔 User notifications collection:")
    await db.user_notifications.create_index("notification_id", unique=True, background=True)
    await db.user_notifications.create_index("user_id", background=True)
    await db.user_notifications.create_index([("user_id", 1), ("read", 1)], background=True)
    await db.user_notifications.create_index([("created_at", -1)], background=True)
    print("   ✓ 4 indexes created")
    
    # ============== BIBLE ==============
    
    print("\n📖 Bible listening history collection:")
    await db.bible_listening_history.create_index("user_id", background=True)
    await db.bible_listening_history.create_index([("user_id", 1), ("listened_at", -1)], background=True)
    print("   ✓ 2 indexes created")
    
    # ============== SYSTEM ==============
    
    print("\n⚙️ App settings collection:")
    await db.app_settings.create_index("setting_key", unique=True, sparse=True, background=True)
    print("   ✓ 1 index created")
    
    print("\n" + "=" * 60)
    print("✅ ALL INDEXES CREATED SUCCESSFULLY!")
    print("=" * 60)
    
    # Print index stats
    collections = await db.list_collection_names()
    total_indexes = 0
    for coll_name in collections:
        try:
            indexes = await db[coll_name].index_information()
            total_indexes += len(indexes)
        except:
            pass
    
    print(f"\n📈 Total indexes across {len(collections)} collections: {total_indexes}")
    
    client.close()


async def verify_indexes():
    """Verify indexes exist and check their stats."""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Verifying database indexes...")
    print("=" * 60)
    
    collections = ['albums', 'songs', 'app_users', 'transactions', 'layout_sections']
    
    for coll_name in collections:
        try:
            indexes = await db[coll_name].index_information()
            print(f"\n{coll_name}: {len(indexes)} indexes")
            for idx_name, idx_info in indexes.items():
                if idx_name != '_id_':
                    keys = [f"{k}:{v}" for k, v in idx_info.get('key', [])]
                    print(f"   - {idx_name}: {', '.join(keys)}")
        except Exception as e:
            print(f"\n{coll_name}: Error - {e}")
    
    client.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        asyncio.run(verify_indexes())
    else:
        asyncio.run(create_indexes())
