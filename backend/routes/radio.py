"""
Radio routes for Gracefy.
Handles live Christian radio streaming integration.
Uses Radio Browser API for station data.
"""

from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
import uuid
import httpx
import logging

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["radio"])

# Radio Browser API base URL
RADIO_BROWSER_API = "https://de1.api.radio-browser.info/json"

# Predefined Christian radio stations from Tanzania and Kenya
# Updated with verified working stream URLs
DEFAULT_CHRISTIAN_STATIONS = [
    {
        "station_id": "radio_maria_tz",
        "name": "Radio Maria Tanzania",
        "country": "Tanzania",
        "country_code": "TZ", 
        "language": "Swahili",
        "tags": ["christian", "catholic", "swahili"],
        "url_resolved": "http://dreamsiteradiocp2.com:8034/stream",
        "favicon": "https://i.imgur.com/YqW3nKd.png",
        "is_featured": True,
        "order": 1
    },
    {
        "station_id": "radio_uhai",
        "name": "Radio Uhai",
        "country": "Tanzania",
        "country_code": "TZ",
        "language": "Swahili",
        "tags": ["christian", "gospel", "swahili"],
        "url_resolved": "https://s2.citrus3.com:8050/stream",
        "favicon": "https://i.imgur.com/JQjZ9Qa.png",
        "is_featured": True,
        "order": 2
    },
    {
        "station_id": "jesus_is_lord_radio",
        "name": "Jesus Is Lord Radio",
        "country": "Kenya",
        "country_code": "KE",
        "language": "Swahili",
        "tags": ["christian", "gospel", "swahili"],
        "url_resolved": "https://s3.radio.co/s97f38db97/listen",
        "favicon": "https://i.imgur.com/8kL5mNp.png",
        "is_featured": True,
        "order": 3
    },
    {
        "station_id": "heaven_fm_tz",
        "name": "Heaven FM Radio",
        "country": "Tanzania",
        "country_code": "TZ",
        "language": "Swahili", 
        "tags": ["christian", "gospel", "swahili"],
        "url_resolved": "http://stream.zeno.fm/eequgfw72hhvv",
        "favicon": "https://i.imgur.com/Dp9fKLm.png",
        "is_featured": True,
        "order": 4
    },
    {
        "station_id": "favour_fm_uganda",
        "name": "Favour FM 104.1",
        "country": "Uganda",
        "country_code": "UG",
        "language": "English",
        "tags": ["christian", "gospel", "english"],
        "url_resolved": "http://us5new.listen2myradio.com:2199/listen.php?port=8138&type=ice&mount=stream",
        "favicon": "https://i.imgur.com/KjN8pLq.png",
        "is_featured": False,
        "order": 5
    },
    {
        "station_id": "voice_of_heaven",
        "name": "Voice Of Heaven",
        "country": "Uganda",
        "country_code": "UG",
        "language": "Swahili",
        "tags": ["christian", "gospel", "swahili"],
        "url_resolved": "http://stream.zeno.fm/s961sfesdmntv",
        "favicon": "https://i.imgur.com/LmR4nHj.png",
        "is_featured": False,
        "order": 6
    },
    {
        "station_id": "prayer_tower_radio",
        "name": "Prayer Tower Radio",
        "country": "Uganda",
        "country_code": "UG",
        "language": "English",
        "tags": ["christian", "prayer", "english"],
        "url_resolved": "http://stream.zeno.fm/ymapb78yznhvv",
        "favicon": "https://i.imgur.com/Nq8rTsP.png",
        "is_featured": False,
        "order": 7
    },
    {
        "station_id": "gospel_kingz",
        "name": "Gospel Kingz",
        "country": "Uganda",
        "country_code": "UG",
        "language": "Swahili",
        "tags": ["christian", "gospel", "swahili"],
        "url_resolved": "http://stream.zeno.fm/vstzctms6rhvv",
        "favicon": "https://i.imgur.com/Qr9sTuV.png",
        "is_featured": False,
        "order": 8
    }
]


@router.get("/radio/stations")
async def get_radio_stations(
    country: Optional[str] = None,
    featured_only: bool = False,
    include_disabled: bool = False
):
    """Get list of available radio stations for users"""
    db = get_db()
    
    # Check cache first
    cache_key = f"radio:stations:{country}:{featured_only}"
    cached = await cache.get(cache_key)
    if cached and not include_disabled:
        return cached
    
    # Get admin-configured stations
    query = {}
    if not include_disabled:
        query["is_enabled"] = True
    if country:
        query["country_code"] = country.upper()
    if featured_only:
        query["is_featured"] = True
    
    stations = await db.radio_stations.find(query, {"_id": 0}).sort("order", 1).to_list(50)
    
    # If no stations configured, seed with defaults
    if not stations and not country:
        await seed_default_stations()
        stations = await db.radio_stations.find(
            {"is_enabled": True} if not include_disabled else {},
            {"_id": 0}
        ).sort("order", 1).to_list(50)
    
    result = {"stations": stations, "total": len(stations)}
    
    if not include_disabled:
        await cache.set(cache_key, result, 300)  # Cache for 5 minutes
    
    return result


@router.get("/radio/stations/{station_id}")
async def get_radio_station(station_id: str):
    """Get single radio station details"""
    db = get_db()
    
    station = await db.radio_stations.find_one(
        {"station_id": station_id},
        {"_id": 0}
    )
    
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    return station


async def seed_default_stations():
    """Seed database with default Christian radio stations"""
    db = get_db()
    
    for station in DEFAULT_CHRISTIAN_STATIONS:
        existing = await db.radio_stations.find_one({"station_id": station["station_id"]})
        if not existing:
            station_doc = {
                **station,
                "is_enabled": True,
                "play_count": 0,
                "total_listen_minutes": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.radio_stations.insert_one(station_doc)
    
    logger.info(f"Seeded {len(DEFAULT_CHRISTIAN_STATIONS)} default radio stations")


# ============== ADMIN RADIO MANAGEMENT ==============

@router.get("/admin/radio/stations")
async def admin_get_all_stations():
    """Get all radio stations for admin management"""
    db = get_db()
    
    stations = await db.radio_stations.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    
    # If empty, seed defaults
    if not stations:
        await seed_default_stations()
        stations = await db.radio_stations.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    
    return {"stations": stations, "total": len(stations)}


@router.post("/admin/radio/stations")
async def admin_add_station(data: dict):
    """Add a new radio station"""
    db = get_db()
    
    station = {
        "station_id": f"radio_{uuid.uuid4().hex[:8]}",
        "name": data.get("name"),
        "country": data.get("country", "Tanzania"),
        "country_code": data.get("country_code", "TZ"),
        "language": data.get("language", "Swahili"),
        "tags": data.get("tags", ["christian"]),
        "url_resolved": data.get("url_resolved") or data.get("stream_url"),
        "favicon": data.get("favicon") or data.get("logo_url"),
        "is_enabled": data.get("is_enabled", True),
        "is_featured": data.get("is_featured", False),
        "order": data.get("order", 99),
        "play_count": 0,
        "total_listen_minutes": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.radio_stations.insert_one(station)
    station.pop("_id", None)
    
    # Invalidate cache
    await cache.delete("radio:stations:None:False")
    await cache.delete("radio:stations:None:True")
    
    return {"success": True, "station": station}


@router.put("/admin/radio/stations/{station_id}")
async def admin_update_station(station_id: str, data: dict):
    """Update a radio station"""
    db = get_db()
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    allowed_fields = ["name", "country", "country_code", "language", "tags", 
                      "url_resolved", "favicon", "is_enabled", "is_featured", "order"]
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
    
    result = await db.radio_stations.update_one(
        {"station_id": station_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # Invalidate cache
    await cache.delete("radio:stations:None:False")
    await cache.delete("radio:stations:None:True")
    
    return {"success": True}


@router.delete("/admin/radio/stations/{station_id}")
async def admin_delete_station(station_id: str):
    """Delete a radio station"""
    db = get_db()
    
    result = await db.radio_stations.delete_one({"station_id": station_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # Invalidate cache
    await cache.delete("radio:stations:None:False")
    await cache.delete("radio:stations:None:True")
    
    return {"success": True}


@router.post("/admin/radio/stations/{station_id}/toggle")
async def admin_toggle_station(station_id: str):
    """Toggle station enabled/disabled status"""
    db = get_db()
    
    station = await db.radio_stations.find_one({"station_id": station_id})
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    new_status = not station.get("is_enabled", True)
    
    await db.radio_stations.update_one(
        {"station_id": station_id},
        {"$set": {"is_enabled": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Invalidate cache
    await cache.delete("radio:stations:None:False")
    await cache.delete("radio:stations:None:True")
    
    return {"success": True, "is_enabled": new_status}


@router.post("/admin/radio/reorder")
async def admin_reorder_stations(data: dict):
    """Reorder radio stations"""
    db = get_db()
    
    station_orders = data.get("stations", [])  # [{station_id, order}, ...]
    
    for item in station_orders:
        await db.radio_stations.update_one(
            {"station_id": item["station_id"]},
            {"$set": {"order": item["order"]}}
        )
    
    # Invalidate cache
    await cache.delete("radio:stations:None:False")
    await cache.delete("radio:stations:None:True")
    
    return {"success": True}


# ============== RADIO ANALYTICS ==============

@router.post("/radio/play")
async def track_radio_play(data: dict):
    """Track when user starts playing a radio station"""
    db = get_db()
    
    station_id = data.get("station_id")
    user_id = data.get("user_id")
    
    if not station_id:
        raise HTTPException(status_code=400, detail="station_id required")
    
    # Create play session
    session = {
        "session_id": f"radio_sess_{uuid.uuid4().hex[:12]}",
        "station_id": station_id,
        "user_id": user_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "duration_seconds": 0,
        "platform": data.get("platform", "unknown")
    }
    
    await db.radio_sessions.insert_one(session)
    
    # Increment play count
    await db.radio_stations.update_one(
        {"station_id": station_id},
        {"$inc": {"play_count": 1}}
    )
    
    return {"success": True, "session_id": session["session_id"]}


@router.post("/radio/stop")
async def track_radio_stop(data: dict):
    """Track when user stops playing a radio station"""
    db = get_db()
    
    session_id = data.get("session_id")
    duration_seconds = data.get("duration_seconds", 0)
    
    if session_id:
        await db.radio_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "duration_seconds": duration_seconds
            }}
        )
        
        # Update total listen minutes
        session = await db.radio_sessions.find_one({"session_id": session_id})
        if session:
            await db.radio_stations.update_one(
                {"station_id": session["station_id"]},
                {"$inc": {"total_listen_minutes": duration_seconds / 60}}
            )
    
    return {"success": True}


@router.get("/admin/radio/analytics")
async def get_radio_analytics():
    """Get radio listening analytics"""
    db = get_db()
    
    # Get all stations with stats
    stations = await db.radio_stations.find(
        {},
        {"_id": 0, "station_id": 1, "name": 1, "play_count": 1, "total_listen_minutes": 1, "is_enabled": 1}
    ).sort("play_count", -1).to_list(50)
    
    # Get total stats
    total_plays = sum(s.get("play_count", 0) for s in stations)
    total_minutes = sum(s.get("total_listen_minutes", 0) for s in stations)
    
    # Get recent sessions count
    from datetime import timedelta
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_sessions = await db.radio_sessions.count_documents({"started_at": {"$gte": yesterday}})
    
    return {
        "total_plays": total_plays,
        "total_listen_minutes": round(total_minutes, 2),
        "total_listen_hours": round(total_minutes / 60, 2),
        "sessions_last_24h": recent_sessions,
        "stations": stations
    }


# ============== SEARCH RADIO BROWSER API ==============

@router.get("/admin/radio/search")
async def search_radio_browser(
    query: str = Query(..., description="Search term"),
    country: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50)
):
    """Search Radio Browser API for stations"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            params = {
                "name": query,
                "limit": limit,
                "order": "clickcount",
                "reverse": "true"
            }
            if country:
                params["country"] = country
            
            # Add Christian/Gospel filter
            params["tag"] = "christian,gospel,religious"
            
            response = await client.get(
                f"{RADIO_BROWSER_API}/stations/search",
                params=params
            )
            
            if response.status_code == 200:
                stations = response.json()
                # Transform to our format
                results = []
                for s in stations:
                    results.append({
                        "name": s.get("name"),
                        "country": s.get("country"),
                        "country_code": s.get("countrycode"),
                        "language": s.get("language"),
                        "tags": s.get("tags", "").split(",") if s.get("tags") else [],
                        "url_resolved": s.get("url_resolved") or s.get("url"),
                        "favicon": s.get("favicon"),
                        "votes": s.get("votes", 0),
                        "click_count": s.get("clickcount", 0)
                    })
                return {"results": results, "total": len(results)}
            else:
                return {"results": [], "total": 0, "error": "API request failed"}
    except Exception as e:
        logger.error(f"Radio Browser search error: {e}")
        return {"results": [], "total": 0, "error": str(e)}
