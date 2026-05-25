"""
Lightweight geolocation utilities for analytics.

Resolution order (cheapest first):
  1. Cloudflare-injected request headers (CF-IPCountry, CF-IPCity, CF-Region) —
     zero-cost, zero-latency. Set automatically when the request transits CF.
  2. ip-api.com lookup keyed by the client IP — free, no API key,
     ~80ms p95. Results are cached in-process for 24h per IP to avoid hammering.

The fallback NEVER raises — every analytics caller treats geo as best-effort
metadata and must keep working even when both sources are unavailable.

References:
- https://developers.cloudflare.com/fundamentals/reference/http-request-headers/
- https://ip-api.com/docs/api:json (45 req/min from a single source IP, no key)
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import time
from typing import Dict, Optional

import httpx
from fastapi import Request

logger = logging.getLogger(__name__)


# Maps ISO-3166 alpha-2 codes to canonical country names used in the dashboard.
_COUNTRY_CODE_MAP = {
    "TZ": "Tanzania", "KE": "Kenya", "UG": "Uganda", "RW": "Rwanda",
    "BI": "Burundi", "CD": "DR Congo", "ZM": "Zambia", "MW": "Malawi",
    "MZ": "Mozambique", "SS": "South Sudan", "ET": "Ethiopia", "SO": "Somalia",
    "ZA": "South Africa", "NG": "Nigeria", "GH": "Ghana",
    "US": "United States", "GB": "United Kingdom", "CA": "Canada",
    "DE": "Germany", "FR": "France", "NL": "Netherlands",
    "AE": "United Arab Emirates", "SA": "Saudi Arabia",
    "IN": "India", "CN": "China", "AU": "Australia",
}


def _decode(value: Optional[str]) -> Optional[str]:
    """Cloudflare URL-encodes city/region (e.g. 'Dar%20es%20Salaam')."""
    if not value:
        return None
    try:
        from urllib.parse import unquote
        return unquote(value).strip() or None
    except Exception:
        return value.strip() or None


def _extract_ip(request: Request) -> Optional[str]:
    """Best-effort client IP extraction (CF-Connecting-IP > XFF > peer)."""
    headers = request.headers
    ip = (headers.get("cf-connecting-ip") or "").strip()
    if not ip:
        ip = (headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if not ip and getattr(request, "client", None):
        ip = request.client.host or ""
    return ip or None


def _is_public_ip(ip: str) -> bool:
    """Filter out RFC1918 / loopback / link-local. ip-api returns nothing useful for them."""
    try:
        addr = ipaddress.ip_address(ip)
        return not (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_unspecified)
    except ValueError:
        return False


# In-process IP geo cache: {ip: (expires_at_ts, geo_dict)}
# 24h TTL is fine — users rarely change country mid-day on a fixed IP.
_IP_CACHE: Dict[str, tuple] = {}
_IP_CACHE_TTL = 24 * 60 * 60  # 24 hours
_IP_LOOKUP_TIMEOUT = 2.0  # seconds — never let a slow geo lookup hold up tracking


async def _lookup_ip_api(ip: str) -> Dict[str, Optional[str]]:
    """Single async lookup against ip-api.com. Returns {} on any error/timeout."""
    if not ip or not _is_public_ip(ip):
        return {}

    # Cache hit
    cached = _IP_CACHE.get(ip)
    if cached and cached[0] > time.time():
        return cached[1]

    url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,query"
    try:
        async with httpx.AsyncClient(timeout=_IP_LOOKUP_TIMEOUT) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return {}
            data = resp.json() or {}
            if data.get("status") != "success":
                return {}
            geo = {
                "country": data.get("country") or _COUNTRY_CODE_MAP.get((data.get("countryCode") or "").upper()),
                "region": data.get("regionName"),
                "city": data.get("city"),
                "ip": data.get("query") or ip,
                "source": "ip-api",
            }
            _IP_CACHE[ip] = (time.time() + _IP_CACHE_TTL, geo)
            return geo
    except (httpx.TimeoutException, httpx.HTTPError, asyncio.TimeoutError) as e:
        logger.debug(f"ip-api lookup timed out for {ip}: {e}")
        return {}
    except Exception as e:
        logger.warning(f"ip-api lookup failed for {ip}: {e}")
        return {}


async def resolve_geo(request: Optional[Request]) -> Dict[str, Optional[str]]:
    """Return {country, region, city, ip, source} for the request.

    Tries Cloudflare headers first (cheap), falls back to ip-api.com when the
    country is missing. All keys may be None if both sources are unavailable.
    Never raises.
    """
    if request is None:
        return {"country": None, "region": None, "city": None, "ip": None, "source": None}

    headers = request.headers
    ip = _extract_ip(request)

    # --- Cloudflare path ---
    cc = (headers.get("cf-ipcountry") or "").strip().upper()
    country: Optional[str] = None
    if cc and cc not in ("XX", "T1"):
        country = _COUNTRY_CODE_MAP.get(cc, cc)

    region = _decode(headers.get("cf-region"))
    city = _decode(headers.get("cf-ipcity"))

    if country:
        return {
            "country": country,
            "region": region,
            "city": city,
            "ip": ip,
            "source": "cloudflare",
        }

    # --- IP-API fallback ---
    if ip:
        geo = await _lookup_ip_api(ip)
        if geo.get("country"):
            # Prefer CF region/city if present, else IP-API ones
            return {
                "country": geo["country"],
                "region": region or geo.get("region"),
                "city": city or geo.get("city"),
                "ip": ip,
                "source": geo.get("source", "ip-api"),
            }

    return {
        "country": None,
        "region": region,
        "city": city,
        "ip": ip,
        "source": None,
    }
