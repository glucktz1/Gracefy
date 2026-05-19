"""
Geo-Filtered Content Delivery Module for Gracefy.
Handles country-based content filtering, user geolocation, and regional analytics.
"""

from fastapi import APIRouter, HTTPException, Query, Request, Depends
from datetime import datetime, timezone
from typing import Optional, List
import uuid
import logging
import httpx

from core.database import get_db
from core.cache import cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["geo-content"])

# ISO 3166-1 alpha-2 country codes for validation
VALID_COUNTRY_CODES = {
    "AF", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ",
    "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "BN",
    "BG", "BF", "BI", "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL", "CN", "CO", "KM", "CG",
    "CD", "CR", "CI", "HR", "CU", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ",
    "ER", "EE", "ET", "FK", "FO", "FJ", "FI", "FR", "GA", "GM", "GE", "DE", "GH", "GI", "GR",
    "GL", "GD", "GU", "GT", "GN", "GW", "GY", "HT", "HN", "HK", "HU", "IS", "IN", "ID", "IR",
    "IQ", "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA",
    "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MK", "MG", "MW", "MY", "MV", "ML",
    "MT", "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA",
    "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "NU", "NO", "OM", "PK", "PW", "PA", "PG", "PY",
    "PE", "PH", "PL", "PT", "PR", "QA", "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM", "ST",
    "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO", "ZA", "SS", "ES", "LK", "SD",
    "SR", "SZ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR",
    "TM", "TV", "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU", "VE", "VN", "YE", "ZM", "ZW",
    "GLOBAL"  # Special code for global/default content
}

# Default fallback country code
DEFAULT_COUNTRY = "GLOBAL"

# Cache TTL for geolocation (1 hour)
GEO_CACHE_TTL = 3600


# ============== IP GEOLOCATION SERVICE ==============

async def get_country_from_ip(ip_address: str) -> str:
    """
    Detect country from IP address using free geolocation API.
    Returns ISO country code or DEFAULT_COUNTRY on failure.
    """
    # Check cache first
    cache_key = f"geo:ip:{ip_address}"
    cached_country = await cache.get(cache_key)
    if cached_country:
        return cached_country
    
    # Skip localhost/private IPs
    if ip_address in ["127.0.0.1", "localhost", "::1"] or ip_address.startswith("192.168.") or ip_address.startswith("10."):
        return DEFAULT_COUNTRY
    
    try:
        # Use ip-api.com (free, no API key required, 45 requests/minute)
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"http://ip-api.com/json/{ip_address}?fields=status,countryCode")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    country_code = data.get("countryCode", DEFAULT_COUNTRY)
                    # Cache the result
                    await cache.set(cache_key, country_code, GEO_CACHE_TTL)
                    return country_code
    except Exception as e:
        logger.warning(f"Geolocation failed for {ip_address}: {e}")
    
    return DEFAULT_COUNTRY


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    # Cloudflare provides the most reliable client IP
    cf_ip = request.headers.get("CF-Connecting-IP") or request.headers.get("cf-connecting-ip")
    if cf_ip:
        return cf_ip.strip()

    # Check X-Forwarded-For header (common for proxies/load balancers)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fall back to direct client IP
    return request.client.host if request.client else "127.0.0.1"


def get_cf_country(request: Request) -> Optional[str]:
    """Return ISO-3166 alpha-2 country code from Cloudflare's CF-IPCountry header.
    Returns None if the request isn't proxied through Cloudflare or the code is invalid.
    """
    cc = (request.headers.get("CF-IPCountry") or request.headers.get("cf-ipcountry") or "").strip().upper()
    if not cc or cc in ("XX", "T1"):
        return None
    return cc if cc in VALID_COUNTRY_CODES else None


# ============== USER COUNTRY DETECTION ==============

@router.get("/geo/detect-country")
async def detect_user_country(request: Request):
    """
    Detect user's country from IP address.

    Prefers Cloudflare's ``CF-IPCountry`` header (zero-latency, free) and
    only falls back to the external ip-api lookup when not behind Cloudflare.
    """
    cf_country = get_cf_country(request)
    if cf_country:
        return {
            "country_code": cf_country,
            "detected_from": "cloudflare",
            "ip_address": "cloudflare",
        }

    client_ip = get_client_ip(request)
    country_code = await get_country_from_ip(client_ip)

    return {
        "country_code": country_code,
        "detected_from": "ip",
        "ip_address": client_ip if client_ip not in ["127.0.0.1", "localhost"] else "local"
    }


@router.get("/geo/user-country")
async def get_user_country(
    request: Request,
    user_id: Optional[str] = None
):
    """
    Get user's effective country (override > profile > IP detection).
    Priority: 1. Manual override, 2. Profile setting, 3. IP detection
    """
    db = get_db()
    
    # If user is logged in, check their profile first
    if user_id:
        user = await db.app_users.find_one(
            {"user_id": user_id},
            {"_id": 0, "country_override": 1, "country_code": 1}
        )
        if user:
            # Manual override takes highest priority
            if user.get("country_override"):
                return {
                    "country_code": user["country_override"],
                    "source": "override",
                    "can_override": True
                }
            # Profile country
            if user.get("country_code"):
                return {
                    "country_code": user["country_code"],
                    "source": "profile",
                    "can_override": True
                }
    
    # Fall back to IP detection
    client_ip = get_client_ip(request)
    country_code = await get_country_from_ip(client_ip)
    
    return {
        "country_code": country_code,
        "source": "ip_detection",
        "can_override": True
    }


@router.post("/geo/user-country-override")
async def update_user_country_override(data: dict):
    """
    Allow user to manually override their detected country.
    Override takes priority over IP detection.
    """
    db = get_db()
    
    user_id = data.get("user_id")
    country_code = data.get("country_code", "").upper()
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    
    # Validate country code
    if country_code and country_code not in VALID_COUNTRY_CODES:
        raise HTTPException(status_code=400, detail=f"Invalid country code: {country_code}")
    
    # Update user's country override
    update_data = {
        "country_override": country_code if country_code else None,
        "country_override_at": datetime.now(timezone.utc).isoformat() if country_code else None
    }
    
    result = await db.app_users.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Track analytics
    await db.geo_analytics.insert_one({
        "event_id": f"geo_evt_{uuid.uuid4().hex[:12]}",
        "event_type": "country_override",
        "user_id": user_id,
        "country_code": country_code,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Country override updated",
        "country_code": country_code,
        "is_cleared": not country_code
    }


# ============== CONTENT COUNTRY TAGGING ==============

@router.get("/geo/content-countries/{content_id}")
async def get_content_countries(content_id: str):
    """Get country tags for a specific content item."""
    db = get_db()
    
    # Find content country mappings
    mappings = await db.content_country.find(
        {"content_id": content_id},
        {"_id": 0}
    ).to_list(300)
    
    country_codes = [m["country_code"] for m in mappings]
    
    # Check if content is marked as default fallback
    # Check in albums first, then songs
    content = await db.albums.find_one({"album_id": content_id}, {"_id": 0, "is_geo_default": 1})
    if not content:
        content = await db.songs.find_one({"song_id": content_id}, {"_id": 0, "is_geo_default": 1})
    
    return {
        "content_id": content_id,
        "country_codes": country_codes,
        "is_default_fallback": content.get("is_geo_default", False) if content else False
    }


@router.post("/admin/geo/set-content-countries")
async def admin_set_content_countries(data: dict):
    """
    Admin endpoint to set country tags for content.
    Supports single or bulk operations.
    """
    db = get_db()
    
    content_id = data.get("content_id")
    content_ids = data.get("content_ids", [])
    country_codes = data.get("country_codes", [])
    
    # Validate country codes
    for code in country_codes:
        if code.upper() not in VALID_COUNTRY_CODES:
            raise HTTPException(status_code=400, detail=f"Invalid country code: {code}")
    
    # Normalize to uppercase
    country_codes = [c.upper() for c in country_codes]
    
    # Handle single content
    if content_id:
        content_ids = [content_id]
    
    if not content_ids:
        raise HTTPException(status_code=400, detail="content_id or content_ids required")
    
    updated_count = 0
    for cid in content_ids:
        # Remove existing mappings
        await db.content_country.delete_many({"content_id": cid})
        
        # Add new mappings
        if country_codes:
            mappings = [
                {
                    "id": f"cc_{uuid.uuid4().hex[:12]}",
                    "content_id": cid,
                    "country_code": cc,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                for cc in country_codes
            ]
            await db.content_country.insert_many(mappings)
        
        updated_count += 1
    
    return {
        "message": f"Country tags updated for {updated_count} content items",
        "content_ids": content_ids,
        "country_codes": country_codes
    }


@router.post("/admin/geo/toggle-default-content")
async def admin_toggle_default_content(data: dict):
    """
    Admin endpoint to mark/unmark content as default fallback.
    Default content is shown when no country-specific content exists.
    """
    db = get_db()
    
    content_id = data.get("content_id")
    content_ids = data.get("content_ids", [])
    is_default = data.get("is_default", False)
    content_type = data.get("content_type", "album")  # album, song, mix
    
    if content_id:
        content_ids = [content_id]
    
    if not content_ids:
        raise HTTPException(status_code=400, detail="content_id or content_ids required")
    
    # Determine collection
    collection = db.albums if content_type == "album" else db.songs if content_type == "song" else db.special_mixes
    id_field = "album_id" if content_type == "album" else "song_id" if content_type == "song" else "mix_id"
    
    # Update content
    result = await collection.update_many(
        {id_field: {"$in": content_ids}},
        {"$set": {"is_geo_default": is_default}}
    )
    
    return {
        "message": f"Default flag updated for {result.modified_count} items",
        "is_default": is_default,
        "content_ids": content_ids
    }


@router.post("/admin/geo/bulk-update-countries")
async def admin_bulk_update_countries(data: dict):
    """
    Bulk update country tags for multiple content items.
    Supports add, remove, or replace operations.
    """
    db = get_db()
    
    content_ids = data.get("content_ids", [])
    country_codes = data.get("country_codes", [])
    operation = data.get("operation", "replace")  # add, remove, replace
    
    if not content_ids:
        raise HTTPException(status_code=400, detail="content_ids required")
    
    # Validate and normalize country codes
    country_codes = [c.upper() for c in country_codes]
    for code in country_codes:
        if code not in VALID_COUNTRY_CODES:
            raise HTTPException(status_code=400, detail=f"Invalid country code: {code}")
    
    updated_count = 0
    
    for cid in content_ids:
        if operation == "replace":
            # Remove all existing and add new
            await db.content_country.delete_many({"content_id": cid})
            if country_codes:
                mappings = [
                    {
                        "id": f"cc_{uuid.uuid4().hex[:12]}",
                        "content_id": cid,
                        "country_code": cc,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    for cc in country_codes
                ]
                await db.content_country.insert_many(mappings)
        
        elif operation == "add":
            # Add new countries (avoid duplicates)
            for cc in country_codes:
                existing = await db.content_country.find_one({"content_id": cid, "country_code": cc})
                if not existing:
                    await db.content_country.insert_one({
                        "id": f"cc_{uuid.uuid4().hex[:12]}",
                        "content_id": cid,
                        "country_code": cc,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
        
        elif operation == "remove":
            # Remove specified countries
            await db.content_country.delete_many({
                "content_id": cid,
                "country_code": {"$in": country_codes}
            })
        
        updated_count += 1
    
    return {
        "message": f"Bulk update completed for {updated_count} items",
        "operation": operation,
        "country_codes": country_codes
    }


# ============== LOCALIZED CONTENT FEED ==============

@router.get("/geo/localized-feed")
async def get_localized_feed(
    request: Request,
    user_id: Optional[str] = None,
    user_country: Optional[str] = None,
    content_type: str = Query("albums", enum=["albums", "songs", "all"]),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0)
):
    """
    Get content feed filtered by user's country.
    Falls back to default content if no country-specific content exists.
    """
    db = get_db()
    
    # Determine user's country
    if user_country:
        country_code = user_country.upper()
    elif user_id:
        user_country_data = await get_user_country(request, user_id)
        country_code = user_country_data["country_code"]
    else:
        client_ip = get_client_ip(request)
        country_code = await get_country_from_ip(client_ip)
    
    # Get content IDs tagged for this country
    country_content_ids = await db.content_country.distinct(
        "content_id",
        {"country_code": country_code}
    )
    
    # Also include GLOBAL content
    global_content_ids = await db.content_country.distinct(
        "content_id",
        {"country_code": "GLOBAL"}
    )
    
    # Combine country-specific and global content
    allowed_content_ids = list(set(country_content_ids + global_content_ids))
    
    result = {
        "country_code": country_code,
        "using_fallback": False,
        "albums": [],
        "songs": []
    }
    
    # Build query - if no country tags exist for content, include it (legacy content)
    # or if content is marked as default fallback
    
    if content_type in ["albums", "all"]:
        # Find albums: either tagged for country, or no tags (legacy), or is_geo_default
        albums_query = {
            "status": "active",
            "$or": [
                {"album_id": {"$in": allowed_content_ids}},
                {"is_geo_default": True}
            ]
        }
        
        # If no country-specific content, fall back to defaults
        if not allowed_content_ids:
            albums_query = {
                "status": "active",
                "is_geo_default": True
            }
            result["using_fallback"] = True
        
        albums = await db.albums.find(
            albums_query,
            {
                "_id": 0, "album_id": 1, "title": 1, "artist_name": 1,
                "thumbnail": 1, "songs_count": 1, "total_plays": 1, "tags": 1,
                "is_geo_default": 1
            }
        ).sort("total_plays", -1).skip(skip).limit(limit).to_list(limit)
        
        result["albums"] = albums
    
    if content_type in ["songs", "all"]:
        songs_query = {
            "status": {"$ne": "disabled"},
            "$or": [
                {"song_id": {"$in": allowed_content_ids}},
                {"is_geo_default": True}
            ]
        }
        
        if not allowed_content_ids:
            songs_query = {
                "status": {"$ne": "disabled"},
                "is_geo_default": True
            }
            result["using_fallback"] = True
        
        songs = await db.songs.find(
            songs_query,
            {
                "_id": 0, "song_id": 1, "title": 1, "album_id": 1,
                "duration_formatted": 1, "plays": 1, "is_geo_default": 1
            }
        ).sort("plays", -1).skip(skip).limit(limit).to_list(limit)
        
        result["songs"] = songs
    
    # Track analytics
    await db.geo_analytics.insert_one({
        "event_id": f"geo_evt_{uuid.uuid4().hex[:12]}",
        "event_type": "feed_request",
        "user_id": user_id,
        "country_code": country_code,
        "content_type": content_type,
        "results_count": len(result.get("albums", [])) + len(result.get("songs", [])),
        "used_fallback": result["using_fallback"],
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return result


@router.get("/geo/fallback-content")
async def get_fallback_content(
    content_type: str = Query("albums", enum=["albums", "songs", "all"]),
    limit: int = Query(50, ge=1, le=200)
):
    """
    Get default fallback content (content marked as is_geo_default).
    Used when no country-specific content exists.
    """
    db = get_db()
    
    result = {"albums": [], "songs": []}
    
    if content_type in ["albums", "all"]:
        albums = await db.albums.find(
            {"status": "active", "is_geo_default": True},
            {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "thumbnail": 1, "total_plays": 1}
        ).sort("total_plays", -1).limit(limit).to_list(limit)
        result["albums"] = albums
    
    if content_type in ["songs", "all"]:
        songs = await db.songs.find(
            {"status": {"$ne": "disabled"}, "is_geo_default": True},
            {"_id": 0, "song_id": 1, "title": 1, "album_id": 1, "plays": 1}
        ).sort("plays", -1).limit(limit).to_list(limit)
        result["songs"] = songs
    
    return result


# ============== GEO ANALYTICS ==============

@router.get("/geo/analytics/overview")
async def get_geo_analytics_overview():
    """
    Get overview of geo-content analytics.
    """
    db = get_db()
    
    # Cache key
    cache_key = "geo:analytics:overview"
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # Total content with country tags
    tagged_content_count = len(await db.content_country.distinct("content_id"))
    
    # Total default fallback content
    default_albums = await db.albums.count_documents({"is_geo_default": True})
    default_songs = await db.songs.count_documents({"is_geo_default": True})
    
    # Countries with content
    countries_with_content = await db.content_country.distinct("country_code")
    
    # Total feed requests (last 30 days)
    from datetime import timedelta
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    feed_requests = await db.geo_analytics.count_documents({
        "event_type": "feed_request",
        "timestamp": {"$gte": thirty_days_ago}
    })
    
    # Fallback usage count
    fallback_usage = await db.geo_analytics.count_documents({
        "event_type": "feed_request",
        "used_fallback": True,
        "timestamp": {"$gte": thirty_days_ago}
    })
    
    result = {
        "tagged_content_count": tagged_content_count,
        "default_albums_count": default_albums,
        "default_songs_count": default_songs,
        "countries_with_content": len(countries_with_content),
        "country_list": sorted(countries_with_content),
        "feed_requests_30d": feed_requests,
        "fallback_usage_30d": fallback_usage,
        "fallback_rate": round(fallback_usage / feed_requests * 100, 2) if feed_requests > 0 else 0
    }
    
    await cache.set(cache_key, result, 300)  # 5 minute cache
    return result


@router.get("/geo/analytics/plays-by-country")
async def get_plays_by_country(
    days: int = Query(30, ge=1, le=365)
):
    """
    Get play counts grouped by country.
    """
    db = get_db()
    
    from datetime import timedelta
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Aggregate plays by country from listening sessions
    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$country_code",
            "play_count": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"},
            "total_duration": {"$sum": "$duration_seconds"}
        }},
        {"$project": {
            "country_code": "$_id",
            "play_count": 1,
            "unique_users": {"$size": "$unique_users"},
            "total_duration": 1,
            "_id": 0
        }},
        {"$sort": {"play_count": -1}}
    ]
    
    results = await db.listening_sessions.aggregate(pipeline).to_list(300)
    
    return {
        "period_days": days,
        "data": results
    }


@router.get("/geo/analytics/users-by-country")
async def get_users_by_country():
    """
    Get active user counts by country.
    """
    db = get_db()
    
    # Aggregate users by country
    pipeline = [
        {"$match": {"country_code": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$country_code",
            "user_count": {"$sum": 1}
        }},
        {"$project": {
            "country_code": "$_id",
            "user_count": 1,
            "_id": 0
        }},
        {"$sort": {"user_count": -1}}
    ]
    
    results = await db.app_users.aggregate(pipeline).to_list(300)
    
    # Also count users with country override
    override_pipeline = [
        {"$match": {"country_override": {"$exists": True, "$ne": None}}},
        {"$group": {
            "_id": "$country_override",
            "override_count": {"$sum": 1}
        }},
        {"$project": {
            "country_code": "$_id",
            "override_count": 1,
            "_id": 0
        }}
    ]
    
    override_results = await db.app_users.aggregate(override_pipeline).to_list(300)
    override_map = {r["country_code"]: r["override_count"] for r in override_results}
    
    # Merge override counts
    for r in results:
        r["override_count"] = override_map.get(r["country_code"], 0)
    
    return {"data": results}


@router.get("/geo/analytics/content-gaps")
async def get_content_availability_gaps():
    """
    Identify countries where users exist but no content is tagged.
    """
    db = get_db()
    
    # Get countries with users
    user_countries = await db.app_users.distinct("country_code")
    user_countries = [c for c in user_countries if c]
    
    # Get countries with content
    content_countries = await db.content_country.distinct("country_code")
    
    # Find gaps
    gaps = [c for c in user_countries if c not in content_countries and c != "GLOBAL"]
    
    # Get user counts for gap countries
    gap_details = []
    for country in gaps:
        user_count = await db.app_users.count_documents({"country_code": country})
        gap_details.append({
            "country_code": country,
            "user_count": user_count,
            "has_content": False
        })
    
    # Sort by user count (most users first)
    gap_details.sort(key=lambda x: x["user_count"], reverse=True)
    
    return {
        "total_gap_countries": len(gaps),
        "gaps": gap_details,
        "countries_with_users": len(user_countries),
        "countries_with_content": len(content_countries)
    }


@router.get("/geo/analytics/top-content-by-country")
async def get_top_content_by_country(
    country_code: str,
    content_type: str = Query("albums", enum=["albums", "songs"]),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Get top performing content in a specific country.
    """
    db = get_db()
    
    country_code = country_code.upper()
    if country_code not in VALID_COUNTRY_CODES:
        raise HTTPException(status_code=400, detail="Invalid country code")
    
    # Get content IDs for this country
    content_ids = await db.content_country.distinct(
        "content_id",
        {"country_code": country_code}
    )
    
    if content_type == "albums":
        items = await db.albums.find(
            {"album_id": {"$in": content_ids}, "status": "active"},
            {"_id": 0, "album_id": 1, "title": 1, "artist_name": 1, "total_plays": 1, "thumbnail": 1}
        ).sort("total_plays", -1).limit(limit).to_list(limit)
    else:
        items = await db.songs.find(
            {"song_id": {"$in": content_ids}, "status": {"$ne": "disabled"}},
            {"_id": 0, "song_id": 1, "title": 1, "album_id": 1, "plays": 1}
        ).sort("plays", -1).limit(limit).to_list(limit)
    
    return {
        "country_code": country_code,
        "content_type": content_type,
        "items": items
    }


@router.get("/geo/analytics/fallback-usage")
async def get_fallback_usage_stats(
    days: int = Query(30, ge=1, le=365)
):
    """
    Get statistics on fallback content usage by country.
    Shows which countries are relying on default content.
    """
    db = get_db()
    
    from datetime import timedelta
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Aggregate fallback usage by country
    pipeline = [
        {
            "$match": {
                "event_type": "feed_request",
                "used_fallback": True,
                "timestamp": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": "$country_code",
                "fallback_count": {"$sum": 1}
            }
        },
        {
            "$project": {
                "country_code": "$_id",
                "fallback_count": 1,
                "_id": 0
            }
        },
        {"$sort": {"fallback_count": -1}}
    ]
    
    results = await db.geo_analytics.aggregate(pipeline).to_list(300)
    
    return {
        "period_days": days,
        "data": results
    }


# ============== ADMIN - LIST ALL COUNTRIES ==============

@router.get("/geo/countries")
async def get_all_countries():
    """
    Get list of all valid ISO country codes with names.
    """
    # Common country names (subset for display)
    country_names = {
        "AF": "Afghanistan", "AL": "Albania", "DZ": "Algeria", "AR": "Argentina",
        "AU": "Australia", "AT": "Austria", "BD": "Bangladesh", "BE": "Belgium",
        "BR": "Brazil", "CA": "Canada", "CN": "China", "CO": "Colombia",
        "CD": "DR Congo", "EG": "Egypt", "ET": "Ethiopia", "FR": "France",
        "DE": "Germany", "GH": "Ghana", "GR": "Greece", "IN": "India",
        "ID": "Indonesia", "IR": "Iran", "IQ": "Iraq", "IE": "Ireland",
        "IL": "Israel", "IT": "Italy", "JP": "Japan", "KE": "Kenya",
        "MY": "Malaysia", "MX": "Mexico", "MA": "Morocco", "NL": "Netherlands",
        "NG": "Nigeria", "PK": "Pakistan", "PH": "Philippines", "PL": "Poland",
        "PT": "Portugal", "RO": "Romania", "RU": "Russia", "SA": "Saudi Arabia",
        "ZA": "South Africa", "KR": "South Korea", "ES": "Spain", "SD": "Sudan",
        "SE": "Sweden", "CH": "Switzerland", "TW": "Taiwan", "TZ": "Tanzania",
        "TH": "Thailand", "TR": "Turkey", "UG": "Uganda", "UA": "Ukraine",
        "AE": "UAE", "GB": "United Kingdom", "US": "United States", "VN": "Vietnam",
        "ZM": "Zambia", "ZW": "Zimbabwe", "GLOBAL": "Global (All Countries)"
    }
    
    countries = []
    for code in sorted(VALID_COUNTRY_CODES):
        countries.append({
            "code": code,
            "name": country_names.get(code, code)
        })
    
    return {"countries": countries}


# ============== DATABASE INDEXES ==============

@router.post("/geo/create-indexes")
async def create_geo_indexes():
    """
    Create database indexes for geo-content module.
    Should be called once during setup.
    """
    db = get_db()
    
    try:
        # Index on content_country for fast lookups
        await db.content_country.create_index("content_id")
        await db.content_country.create_index("country_code")
        await db.content_country.create_index([("content_id", 1), ("country_code", 1)], unique=True)
        
        # Index on geo_analytics
        await db.geo_analytics.create_index("event_type")
        await db.geo_analytics.create_index("country_code")
        await db.geo_analytics.create_index("timestamp")
        await db.geo_analytics.create_index([("event_type", 1), ("country_code", 1)])
        
        # Index on albums for geo filtering
        await db.albums.create_index("is_geo_default")
        
        # Index on songs for geo filtering
        await db.songs.create_index("is_geo_default")
        
        # Index on app_users for country
        await db.app_users.create_index("country_code")
        await db.app_users.create_index("country_override")
        
        return {"message": "Geo-content indexes created successfully"}
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== GEO CONTENT SETTINGS ==============

@router.get("/geo/settings")
async def get_geo_settings():
    """
    Get geo-content filtering settings.
    """
    db = get_db()
    
    settings = await db.geo_settings.find_one({"settings_id": "geo_content"}, {"_id": 0})
    
    if not settings:
        # Default settings
        settings = {
            "settings_id": "geo_content",
            "geo_filtering_enabled": True,
            "default_fallback_enabled": True,
            "auto_detect_country": True,
            "allow_country_override": True,
            "priority_countries": ["TZ", "KE", "UG", "NG", "GH", "ZA"],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.geo_settings.insert_one(settings)
    
    return settings


@router.put("/admin/geo/settings")
async def update_geo_settings(data: dict):
    """
    Update geo-content filtering settings (admin only).
    """
    db = get_db()
    
    allowed_fields = [
        "geo_filtering_enabled",
        "default_fallback_enabled", 
        "auto_detect_country",
        "allow_country_override",
        "priority_countries"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.geo_settings.update_one(
        {"settings_id": "geo_content"},
        {"$set": update_data},
        upsert=True
    )
    
    return await get_geo_settings()

