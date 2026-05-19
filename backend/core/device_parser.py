"""
Device parsing helper.

Returns a friendly device name (Samsung, iPhone, Infinix, etc.) from a raw
User-Agent string. Pure regex - no external user-agent library so it works
in low-bandwidth environments and on cold serverless starts.

We intentionally keep the brand list small + Africa-aware. New brands can be
appended at the bottom of ``_ANDROID_BRANDS`` without risk - first match wins.
"""

import re
from typing import Optional, Dict


_IPHONE_RE = re.compile(r"iPhone(?:\s?OS\s?(\d+_\d+))?", re.IGNORECASE)
_IPAD_RE = re.compile(r"iPad", re.IGNORECASE)

# Order matters - first match wins. Most specific tokens first.
_ANDROID_BRANDS = [
    ("Samsung", re.compile(r"(SM-[A-Z0-9]+|Samsung|SAMSUNG|Galaxy)", re.IGNORECASE)),
    ("Tecno", re.compile(r"(TECNO|Tecno|Camon|Spark\s?\d|Pova)", re.IGNORECASE)),
    ("Infinix", re.compile(r"(Infinix|INFINIX|Hot\s?\d{1,2}|Note\s?\d{1,2}\s?Pro)", re.IGNORECASE)),
    ("Itel", re.compile(r"(Itel|ITEL)", re.IGNORECASE)),
    ("Huawei", re.compile(r"(Huawei|HUAWEI|HONOR\s?\d|Mate\s?\d{1,2})", re.IGNORECASE)),
    ("Honor", re.compile(r"\bHONOR\b", re.IGNORECASE)),
    ("Xiaomi", re.compile(r"(Xiaomi|XIAOMI|Redmi|POCO|MI\s?\d{1,2})", re.IGNORECASE)),
    ("OPPO", re.compile(r"(OPPO|Oppo|CPH\d+|RMX\d+|Realme)", re.IGNORECASE)),
    ("vivo", re.compile(r"\bvivo\b", re.IGNORECASE)),
    ("OnePlus", re.compile(r"OnePlus", re.IGNORECASE)),
    ("Google", re.compile(r"(Pixel|GoogleNexus)", re.IGNORECASE)),
    ("Nokia", re.compile(r"Nokia", re.IGNORECASE)),
    ("Sony", re.compile(r"(Sony|SonyEricsson|Xperia)", re.IGNORECASE)),
    ("LG", re.compile(r"\bLG-?[A-Z0-9]+\b", re.IGNORECASE)),
    ("Motorola", re.compile(r"(Moto\s?[GEXZ]|Motorola)", re.IGNORECASE)),
]


def parse_device(user_agent: Optional[str]) -> Dict[str, Optional[str]]:
    """Return ``{brand, model, os, type, raw}`` from a User-Agent string.

    All fields may be None. ``type`` is one of: ``phone``, ``tablet``, ``desktop``, ``unknown``.
    Never raises.
    """
    if not user_agent:
        return {"brand": None, "model": None, "os": None, "type": "unknown", "raw": None}

    ua = user_agent.strip()
    out = {"raw": ua, "brand": None, "model": None, "os": None, "type": "desktop"}

    # iOS first (cleanest signal)
    if _IPHONE_RE.search(ua):
        out["brand"] = "Apple"
        out["model"] = "iPhone"
        out["os"] = "iOS"
        out["type"] = "phone"
        m = re.search(r"iPhone\s?OS\s?(\d+_\d+)|OS\s?(\d+_\d+)\s?like\s?Mac", ua)
        if m:
            out["os"] = f"iOS {(m.group(1) or m.group(2) or '').replace('_', '.')}"
        return out

    if _IPAD_RE.search(ua):
        out["brand"] = "Apple"
        out["model"] = "iPad"
        out["os"] = "iPadOS"
        out["type"] = "tablet"
        return out

    # Android branch
    if "android" in ua.lower():
        out["os"] = "Android"
        out["type"] = "tablet" if "tablet" in ua.lower() else "phone"
        ver = re.search(r"Android\s?(\d+(?:\.\d+)?)", ua)
        if ver:
            out["os"] = f"Android {ver.group(1)}"
        for brand_name, pattern in _ANDROID_BRANDS:
            m = pattern.search(ua)
            if m:
                out["brand"] = brand_name
                # Try to grab the model token after "; ModelName)"
                model_match = re.search(r";\s?([^;]*?" + re.escape(m.group(0)) + r"[^;)]*)\s?(?:Build|\))", ua, re.IGNORECASE)
                if model_match:
                    out["model"] = model_match.group(1).strip()
                else:
                    out["model"] = m.group(0)
                return out
        out["brand"] = "Android"
        out["model"] = "Android Device"
        return out

    # Desktop OS detection
    ualow = ua.lower()
    if "windows" in ualow:
        out["os"] = "Windows"
    elif "macintosh" in ualow or "mac os x" in ualow:
        out["os"] = "macOS"
        out["brand"] = "Apple"
    elif "linux" in ualow:
        out["os"] = "Linux"
    elif "cros" in ualow:
        out["os"] = "ChromeOS"

    # Browser hint as "brand" for desktop entries (helps the admin dashboard)
    if "Edg/" in ua:
        out["brand"] = out["brand"] or "Edge"
    elif "Chrome/" in ua and "Edg/" not in ua:
        out["brand"] = out["brand"] or "Chrome"
    elif "Safari/" in ua and "Chrome/" not in ua:
        out["brand"] = out["brand"] or "Safari"
    elif "Firefox/" in ua:
        out["brand"] = out["brand"] or "Firefox"

    return out


def device_label(parsed: Dict[str, Optional[str]]) -> str:
    """Build a short human-readable label like ``Samsung Galaxy S21 (Android 13)``."""
    brand = parsed.get("brand")
    model = parsed.get("model")
    os_ = parsed.get("os")
    if brand and model and brand.lower() not in model.lower():
        head = f"{brand} {model}"
    elif model:
        head = model
    elif brand:
        head = brand
    else:
        head = "Unknown device"
    return f"{head}{(' · ' + os_) if os_ else ''}"
