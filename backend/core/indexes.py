"""
MongoDB index management for Gracefy.

Idempotently creates the indexes that materially affect analytics + real-time
query latency. Safe to call on every startup - MongoDB skips existing indexes.
"""

import logging
from core.database import get_db

logger = logging.getLogger(__name__)


# (collection, keys, options)
_INDEX_SPECS = [
    # --- Real-time listener tracking ---
    ("active_streams", [("is_active", 1), ("last_heartbeat", -1)], {"name": "rt_active_hb"}),
    ("active_streams", [("stream_id", 1)], {"name": "rt_stream_id", "unique": False}),
    ("active_streams", [("user_id", 1), ("last_heartbeat", -1)], {"name": "rt_user_hb"}),
    ("active_listeners", [("session_id", 1)], {"name": "al_session_id"}),
    ("active_listeners", [("is_active", 1), ("last_heartbeat", -1)], {"name": "al_active_hb"}),

    # --- Listening sessions / play counting ---
    ("listening_sessions", [("session_id", 1)], {"name": "ls_session_id"}),
    ("listening_sessions", [("start_time", -1)], {"name": "ls_start_time"}),
    ("listening_sessions", [("counted_as_play", 1), ("start_time", -1)], {"name": "ls_counted_time"}),
    ("listening_sessions", [("user_id", 1), ("start_time", -1)], {"name": "ls_user_time"}),
    ("listening_sessions", [("song_id", 1)], {"name": "ls_song_id"}),

    # --- Catalog lookups ---
    ("songs", [("song_id", 1)], {"name": "songs_song_id"}),
    ("songs", [("plays", -1)], {"name": "songs_plays_desc"}),
    # Hot listing query: filter by status + album_id, sort by track_number.
    ("songs", [("status", 1), ("album_id", 1), ("track_number", 1)], {"name": "songs_status_album_track"}),
    ("songs", [("album_id", 1)], {"name": "songs_album_id"}),
    ("albums", [("album_id", 1)], {"name": "albums_album_id"}),
    # Hot listing query: filter by status + category, sort by created_at DESC.
    ("albums", [("status", 1), ("category_id", 1), ("created_at", -1)], {"name": "albums_status_cat_created"}),
    ("albums", [("created_at", -1)], {"name": "albums_created_at"}),
    ("singers", [("singer_id", 1)], {"name": "singers_singer_id"}),

    # --- Downloads (for data-usage analytics + per-user counts) ---
    ("downloads", [("downloaded_at", -1)], {"name": "dl_downloaded_at"}),
    ("downloads", [("user_id", 1), ("downloaded_at", -1)], {"name": "dl_user_time"}),
    ("downloads", [("content_id", 1)], {"name": "dl_content_id"}),

    # --- User/location analytics ---
    ("app_users", [("user_id", 1)], {"name": "au_user_id"}),
    ("app_users", [("country", 1)], {"name": "au_country"}),
    ("app_users", [("created_at", -1)], {"name": "au_created_at"}),
    ("user_locations", [("user_id", 1), ("timestamp", -1)], {"name": "ul_user_time"}),
    ("user_locations", [("country", 1)], {"name": "ul_country"}),

    # --- Auth tokens ---
    ("user_tokens", [("token", 1)], {"name": "ut_token"}),
]


async def ensure_indexes() -> int:
    """Create all required indexes. Returns number of indexes created/verified."""
    db = get_db()
    created = 0
    for coll, keys, opts in _INDEX_SPECS:
        try:
            await db[coll].create_index(keys, **opts)
            created += 1
        except Exception as e:
            # IndexOptionsConflict / IndexKeySpecsConflict means it exists with
            # different name - safe to ignore. Anything else we log but never crash.
            logger.warning(f"Index ensure skipped for {coll}/{opts.get('name')}: {e}")
    logger.info(f"📚 Analytics indexes ensured: {created}/{len(_INDEX_SPECS)}")
    return created
