"""
Lightweight geolocation utilities for analytics.

Resolves country / region / city from Cloudflare-injected request headers
without any external API call (zero-cost, zero-latency).

If the request is not behind Cloudflare (e.g. local dev / direct origin hit),
all values return None and the caller can fall back to client-supplied data.

Cloudflare reference: https://developers.cloudflare.com/fundamentals/reference/http-request-headers/
"""

from typing import Dict, Optional
from fastapi import Request


# Maps ISO-3166 alpha-2 codes (from CF-IPCountry) to canonical country names
# used across the Gracefy analytics dashboard. Only the ones we render in UI
# are normalised; everything else passes through as the raw code.
_COUNTRY_CODE_MAP = {
    "TZ": "Tanzania",
    "KE": "Kenya",
    "UG": "Uganda",
    "RW": "Rwanda",
    "BI": "Burundi",
    "CD": "DR Congo",
    "ZM": "Zambia",
    "MW": "Malawi",
    "MZ": "Mozambique",
    "SS": "South Sudan",
    "ET": "Ethiopia",
    "SO": "Somalia",
    "ZA": "South Africa",
    "NG": "Nigeria",
    "GH": "Ghana",
    "US": "United States",
    "GB": "United Kingdom",
    "CA": "Canada",
    "DE": "Germany",
    "FR": "France",
    "NL": "Netherlands",
    "AE": "United Arab Emirates",
    "SA": "Saudi Arabia",
    "IN": "India",
    "CN": "China",
    "AU": "Australia",
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


def resolve_geo(request: Optional[Request]) -> Dict[str, Optional[str]]:
    """Return {country, region, city, ip} resolved from Cloudflare headers.

    All values may be None if the request was not proxied through Cloudflare.
    Never raises - safe to call from any analytics endpoint.
    """
    if request is None:
        return {"country": None, "region": None, "city": None, "ip": None}

    headers = request.headers

    # Country (ISO-3166 alpha-2). Cloudflare sets "XX" for unknown / Tor exit nodes.
    cc = (headers.get("cf-ipcountry") or "").strip().upper()
    country: Optional[str] = None
    if cc and cc not in ("XX", "T1"):
        country = _COUNTRY_CODE_MAP.get(cc, cc)

    region = _decode(headers.get("cf-region"))
    city = _decode(headers.get("cf-ipcity"))

    # Client IP (CF-Connecting-IP > X-Forwarded-For > peer)
    ip = headers.get("cf-connecting-ip") or ""
    if not ip:
        ip = (headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if not ip and getattr(request, "client", None):
        ip = request.client.host or ""

    return {
        "country": country,
        "region": region,
        "city": city,
        "ip": ip or None,
    }
