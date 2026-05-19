"""
Shared analytics helpers — per-choir, per-leader, per-album play aggregation.

Centralises the listening-session → revenue/plays math so the admin views
(/admin/choirs/{id}, /admin/leaders/{id}/analytics) and the choir/leader
self-service dashboards return identical numbers from a single source of
truth.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional

from core.database import get_db


# Default monetization rates – overridable per-call from admin settings.
DEFAULTS = {
    "tzs_per_play": 5,
    "platform_fee_percentage": 30,
    "minimum_payout": 10000,
}


async def _get_rates(db) -> Dict[str, int]:
    """Read monetization settings (falls back to DEFAULTS)."""
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)]) or {}
    return {
        "tzs_per_play": int(settings.get("tzs_per_play", DEFAULTS["tzs_per_play"])),
        "platform_fee_percentage": int(
            settings.get("platform_fee_percentage", DEFAULTS["platform_fee_percentage"])
        ),
        "minimum_payout": int(settings.get("minimum_payout_threshold", DEFAULTS["minimum_payout"])),
    }


def _net(gross: int, fee_pct: int) -> int:
    return gross - int(gross * fee_pct / 100)


async def get_choir_play_analytics(
    choir_id: str,
    account: Optional[dict] = None,
    months: int = 6,
) -> dict:
    """Aggregate plays / revenue / top content for a choir (singer_id).

    Returns the canonical ``{summary, rates, albums, monthly, top_songs}``
    shape consumed by ChoirDashboard.jsx + the admin ChoirDetailsPage.
    """
    db = get_db()
    rates = await _get_rates(db)
    tzs = rates["tzs_per_play"]
    fee_pct = rates["platform_fee_percentage"]

    # Choir-owned albums (artist_id OR singer_id - schema is inconsistent across legacy uploads).
    own_albums = await db.albums.find(
        {"$or": [{"singer_id": choir_id}, {"artist_id": choir_id}]},
        {"_id": 0, "album_id": 1, "title": 1, "thumbnail": 1, "thumbnail_url": 1, "total_plays": 1},
    ).to_list(500)
    album_ids = [a["album_id"] for a in own_albums]
    album_count = len(own_albums)

    own_songs = []
    if album_ids:
        own_songs = await db.songs.find(
            {"album_id": {"$in": album_ids}},
            {"_id": 0, "song_id": 1, "album_id": 1, "title": 1, "plays": 1, "duration_seconds": 1},
        ).to_list(2000)
    song_ids = [s["song_id"] for s in own_songs]
    song_count = len(own_songs)
    song_to_album = {s["song_id"]: s["album_id"] for s in own_songs}

    plays_by_song: Dict[str, int] = {}
    plays_by_album: Dict[str, int] = {}
    total_plays = 0
    total_minutes = 0

    if song_ids:
        pipeline = [
            {"$match": {"counted_as_play": True, "song_id": {"$in": song_ids}}},
            {"$group": {
                "_id": "$song_id",
                "plays": {"$sum": 1},
                "minutes": {"$sum": {"$divide": [{"$ifNull": ["$duration_seconds", 0]}, 60]}},
            }},
        ]
        async for row in db.listening_sessions.aggregate(pipeline):
            sid = row["_id"]
            plays_by_song[sid] = row["plays"]
            total_plays += row["plays"]
            total_minutes += int(row.get("minutes") or 0)
            aid = song_to_album.get(sid)
            if aid:
                plays_by_album[aid] = plays_by_album.get(aid, 0) + row["plays"]

    # If listening_sessions has nothing recorded for this choir, fall back to
    # the stale counters stored directly on albums.total_plays + songs.plays so
    # historical data isn't dropped.
    if total_plays == 0:
        for a in own_albums:
            p = int(a.get("total_plays") or 0)
            if p > 0:
                plays_by_album[a["album_id"]] = p
                total_plays += p
        for s in own_songs:
            p = int(s.get("plays") or 0)
            if p > 0:
                plays_by_song[s["song_id"]] = p

    gross = total_plays * tzs
    platform_fee = int(gross * fee_pct / 100)
    net = gross - platform_fee

    # Album breakdown (sorted by revenue desc)
    album_breakdown: List[dict] = []
    for a in own_albums:
        p = plays_by_album.get(a["album_id"], 0)
        a_gross = p * tzs
        a_net = _net(a_gross, fee_pct)
        album_breakdown.append({
            "album_id": a["album_id"],
            "title": a.get("title"),
            "thumbnail": a.get("thumbnail") or a.get("thumbnail_url"),
            "plays": p,
            "revenue": a_net,
            "revenue_percentage": round(100 * a_net / net, 1) if net else 0,
        })
    album_breakdown.sort(key=lambda x: x["plays"], reverse=True)

    # Top songs (sorted by plays desc)
    top_songs: List[dict] = []
    for s in own_songs:
        p = plays_by_song.get(s["song_id"], 0)
        if p <= 0:
            continue
        top_songs.append({
            "song_id": s["song_id"],
            "title": s.get("title"),
            "album_id": s.get("album_id"),
            "plays": p,
            "revenue": _net(p * tzs, fee_pct),
        })
    top_songs.sort(key=lambda x: x["plays"], reverse=True)
    top_songs = top_songs[:20]

    # Monthly trend (last `months` months)
    now = datetime.now(timezone.utc)
    monthly = []
    for i in range(months - 1, -1, -1):
        start = (now - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=32)).replace(day=1)
        name = start.strftime("%b")
        m_plays = 0
        if song_ids:
            m_plays = await db.listening_sessions.count_documents({
                "counted_as_play": True,
                "song_id": {"$in": song_ids},
                "start_time": {"$gte": start.isoformat(), "$lt": end.isoformat()},
            })
        m_gross = m_plays * tzs
        monthly.append({
            "month": name,
            "plays": m_plays,
            "gross_revenue": m_gross,
            "net_revenue": _net(m_gross, fee_pct),
        })

    # Follower count if collection exists
    follower_count = 0
    try:
        if "followers" in await db.list_collection_names():
            follower_count = await db.followers.count_documents(
                {"following_id": choir_id, "following_type": {"$in": ["choir", "singer"]}}
            )
    except Exception:
        pass

    summary = {
        "total_plays": total_plays,
        "total_minutes_streamed": total_minutes,
        "gross_revenue": gross,
        "platform_fee": platform_fee,
        "net_revenue": net,
        "current_balance": int((account or {}).get("current_balance", 0)),
        "total_earned": int((account or {}).get("total_earned", net)),
        "total_withdrawn": int((account or {}).get("total_withdrawn", 0)),
        "follower_count": follower_count,
        "album_count": album_count,
        "song_count": song_count,
    }

    return {
        "summary": summary,
        "rates": rates,
        "albums": album_breakdown,
        "top_songs": top_songs,
        "monthly": monthly,
    }


async def get_leader_play_analytics(leader_id: str, months: int = 6) -> dict:
    """Aggregate plays + reach for a religious leader's teachings + neno la leo.

    Returns ``{summary, top_teachings, top_neno, monthly}`` for the admin
    leaders portal and the leader self-service dashboard.
    """
    db = get_db()
    now = datetime.now(timezone.utc)

    # Containers / episodes (teaching lessons)
    teachings = await db.teachings.find(
        {"leader_id": leader_id},
        {"_id": 0, "teaching_id": 1, "title": 1, "play_count": 1, "thumbnail": 1},
    ).to_list(500)
    teaching_ids = [t["teaching_id"] for t in teachings]

    lessons = []
    if teaching_ids:
        lessons = await db.teaching_lessons.find(
            {"teaching_id": {"$in": teaching_ids}},
            {"_id": 0, "lesson_id": 1, "teaching_id": 1, "title": 1, "play_count": 1, "duration_seconds": 1},
        ).to_list(5000)

    # Neno la Leo entries
    neno_entries = await db.neno_la_leo.find(
        {"leader_id": leader_id},
        {"_id": 0, "neno_id": 1, "verse_reference": 1, "word_date": 1, "stats": 1, "is_active": 1},
    ).to_list(500)

    # Plays from listening_sessions, grouped by content_id
    content_ids = [lesson["lesson_id"] for lesson in lessons] + [n["neno_id"] for n in neno_entries]
    plays_by_id: Dict[str, int] = {}
    minutes_total = 0
    if content_ids:
        pipeline = [
            {"$match": {
                "counted_as_play": True,
                "$or": [
                    {"content_id": {"$in": content_ids}},
                    {"song_id": {"$in": content_ids}},
                ],
            }},
            {"$group": {
                "_id": {"$ifNull": ["$content_id", "$song_id"]},
                "plays": {"$sum": 1},
                "minutes": {"$sum": {"$divide": [{"$ifNull": ["$duration_seconds", 0]}, 60]}},
            }},
        ]
        async for row in db.listening_sessions.aggregate(pipeline):
            plays_by_id[row["_id"]] = row["plays"]
            minutes_total += int(row.get("minutes") or 0)

    # Top teachings
    teaching_play_map: Dict[str, int] = {tid: 0 for tid in teaching_ids}
    for lesson in lessons:
        p = plays_by_id.get(lesson["lesson_id"], int(lesson.get("play_count") or 0))
        teaching_play_map[lesson["teaching_id"]] = teaching_play_map.get(lesson["teaching_id"], 0) + p

    top_teachings = sorted(
        [{
            "teaching_id": t["teaching_id"],
            "title": t.get("title"),
            "thumbnail": t.get("thumbnail"),
            "plays": teaching_play_map.get(t["teaching_id"], int(t.get("play_count") or 0)),
        } for t in teachings],
        key=lambda x: x["plays"], reverse=True
    )[:20]

    total_teaching_plays = sum(t["plays"] for t in top_teachings)

    # Top neno
    top_neno = []
    total_neno_plays = 0
    for n in neno_entries:
        stats = n.get("stats") or {}
        plays = plays_by_id.get(n["neno_id"], int(stats.get("total_plays") or 0))
        total_neno_plays += plays
        top_neno.append({
            "neno_id": n["neno_id"],
            "verse_reference": n.get("verse_reference"),
            "word_date": n.get("word_date"),
            "is_active": n.get("is_active", False),
            "plays": plays,
            "reading_plays": stats.get("reading_plays", 0),
            "reflection_plays": stats.get("reflection_plays", 0),
        })
    top_neno.sort(key=lambda x: x["plays"], reverse=True)
    top_neno = top_neno[:20]

    # Monthly trend
    monthly = []
    for i in range(months - 1, -1, -1):
        start = (now - timedelta(days=30 * i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (start + timedelta(days=32)).replace(day=1)
        name = start.strftime("%b")
        m_plays = 0
        if content_ids:
            m_plays = await db.listening_sessions.count_documents({
                "counted_as_play": True,
                "$or": [
                    {"content_id": {"$in": content_ids}},
                    {"song_id": {"$in": content_ids}},
                ],
                "start_time": {"$gte": start.isoformat(), "$lt": end.isoformat()},
            })
        monthly.append({"month": name, "plays": m_plays})

    # Follower count
    follower_count = 0
    try:
        if "followers" in await db.list_collection_names():
            follower_count = await db.followers.count_documents(
                {"following_id": leader_id, "following_type": "leader"}
            )
    except Exception:
        pass

    return {
        "summary": {
            "total_plays": total_teaching_plays + total_neno_plays,
            "teaching_plays": total_teaching_plays,
            "neno_plays": total_neno_plays,
            "total_minutes_streamed": minutes_total,
            "teaching_count": len(teachings),
            "lesson_count": len(lessons),
            "neno_count": len(neno_entries),
            "follower_count": follower_count,
        },
        "top_teachings": top_teachings,
        "top_neno": top_neno,
        "monthly": monthly,
    }
