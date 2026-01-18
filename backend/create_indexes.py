# Performance Optimization Script for MongoDB
# Run this to create indexes and optimize queries

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
    """Create database indexes for optimal query performance"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("Creating database indexes...")
    
    # Albums indexes
    print("\n1. Albums collection:")
    await db.albums.create_index("album_id", unique=True)
    await db.albums.create_index("status")
    await db.albums.create_index("category_id")
    await db.albums.create_index("artist_id")
    await db.albums.create_index([("created_at", -1)])
    await db.albums.create_index([("total_plays", -1)])
    await db.albums.create_index([("status", 1), ("created_at", -1)])
    print("   ✓ Created 7 indexes")
    
    # Songs indexes
    print("\n2. Songs collection:")
    await db.songs.create_index("song_id", unique=True)
    await db.songs.create_index("album_id")
    await db.songs.create_index("status")
    await db.songs.create_index([("play_count", -1)])
    await db.songs.create_index([("album_id", 1), ("track_number", 1)])
    print("   ✓ Created 5 indexes")
    
    # Users indexes
    print("\n3. Users collection:")
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("status")
    await db.users.create_index("role")
    await db.users.create_index([("created_at", -1)])
    print("   ✓ Created 5 indexes")
    
    # Sessions indexes
    print("\n4. Sessions collection:")
    await db.sessions.create_index("session_id", unique=True)
    await db.sessions.create_index("user_id")
    await db.sessions.create_index("session_token")
    await db.sessions.create_index([("expires_at", 1)], expireAfterSeconds=0)  # TTL index
    print("   ✓ Created 4 indexes (including TTL)")
    
    # Churches indexes
    print("\n5. Churches collection:")
    await db.churches.create_index("church_id", unique=True)
    await db.churches.create_index("status")
    await db.churches.create_index("denomination")
    await db.churches.create_index([("created_at", -1)])
    print("   ✓ Created 4 indexes")
    
    # Choirs indexes
    print("\n6. Choirs collection:")
    await db.choirs.create_index("choir_id", unique=True)
    await db.choirs.create_index("status")
    await db.choirs.create_index("church_id")
    await db.choirs.create_index([("total_plays", -1)])
    print("   ✓ Created 4 indexes")
    
    # Categories indexes
    print("\n7. Categories collection:")
    await db.categories.create_index("category_id", unique=True)
    await db.categories.create_index("status")
    await db.categories.create_index("type")
    print("   ✓ Created 3 indexes")
    
    # Layout sections indexes
    print("\n8. Layout sections collection:")
    await db.layout_sections.create_index("section_id", unique=True)
    await db.layout_sections.create_index("is_active")
    await db.layout_sections.create_index([("sort_order", 1)])
    print("   ✓ Created 3 indexes")
    
    # User library indexes
    print("\n9. User library collection:")
    await db.user_library.create_index("user_id", unique=True)
    await db.user_library.create_index([("user_id", 1), ("liked_songs", 1)])
    print("   ✓ Created 2 indexes")
    
    # Streaming sessions indexes
    print("\n10. Streaming sessions collection:")
    await db.streaming_sessions.create_index("session_id", unique=True)
    await db.streaming_sessions.create_index("user_id")
    await db.streaming_sessions.create_index([("started_at", -1)])
    await db.streaming_sessions.create_index([("ended_at", 1)], expireAfterSeconds=86400*7)  # 7 day TTL
    print("   ✓ Created 4 indexes")
    
    # Analytics indexes
    print("\n11. Analytics collection:")
    await db.analytics_events.create_index([("timestamp", -1)])
    await db.analytics_events.create_index("event_type")
    await db.analytics_events.create_index([("timestamp", 1)], expireAfterSeconds=86400*90)  # 90 day TTL
    print("   ✓ Created 3 indexes")
    
    # Notifications indexes
    print("\n12. User notifications collection:")
    await db.user_notifications.create_index("user_id")
    await db.user_notifications.create_index([("user_id", 1), ("read", 1)])
    await db.user_notifications.create_index([("created_at", -1)])
    print("   ✓ Created 3 indexes")
    
    # System settings index
    print("\n13. System settings collection:")
    await db.system_settings.create_index("setting_id", unique=True)
    print("   ✓ Created 1 index")
    
    print("\n" + "="*50)
    print("✅ All indexes created successfully!")
    print("="*50)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_indexes())
