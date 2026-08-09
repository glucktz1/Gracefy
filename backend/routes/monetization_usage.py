"""
Server-Side Skip Counter (Uncircumventable Paywall)

Keeps a per-user lifetime skip counter in Mongo so users cannot bypass the
hard paywall by reinstalling the app or clearing localStorage. The client
still holds a local counter for offline resilience, but on every mount +
skip we reconcile with the server which is the source of truth.

Data model — `user_billing_stats`:
  {
    user_id: str,               # unique
    skip_count: int,            # current usage toward hard_skip_limit
    total_lifetime_skips: int,  # never decrements, for admin analytics
    preview_mode_active: bool,  # locked in once skip_count >= threshold
    first_hit_at: iso datetime, # when preview lock first triggered
    last_skip_at: iso datetime,
    created_at: iso datetime,
    updated_at: iso datetime,
    cleared_at: iso datetime,   # set on premium upgrade
  }

Endpoints:
  GET  /api/monetization/usage        → hydrate client state on mount
  POST /api/monetization/record-skip  → bump counter; returns new state
  POST /api/monetization/reset        → wipe on premium (auth-gated)
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import logging

from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/monetization", tags=["monetization-usage"])


async def _resolve_user(request: Request):
    """Return (user_id, user_doc) for the authenticated caller.
    Accepts BOTH:
      - Bearer <token>  (mobile app — user_tokens collection)
      - session_token cookie  (web — user_sessions collection)
    Returns (None, None) for anonymous / invalid callers.
    """
    db = get_db()

    # Mobile: Bearer token → user_tokens
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        token_doc = await db.user_tokens.find_one({"token": token})
        if token_doc:
            # Token expiry check
            expires_at = token_doc.get("expires_at")
            if expires_at:
                if isinstance(expires_at, str):
                    try:
                        expires_at = datetime.fromisoformat(expires_at)
                    except Exception:
                        expires_at = None
                if expires_at and expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at and expires_at < datetime.now(timezone.utc):
                    return None, None
            user = await db.app_users.find_one(
                {"user_id": token_doc["user_id"]},
                {"_id": 0, "password_hash": 0}
            )
            if user:
                return user["user_id"], user

    # Web: session_token cookie → user_sessions
    session_token = request.cookies.get("session_token") or ""
    if not session_token and auth_header.startswith("Bearer "):
        session_token = auth_header[7:]
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
            if user:
                return user["user_id"], user

    return None, None


def _is_premium(user: dict) -> bool:
    if not user:
        return False
    if user.get("is_premium") is True:
        return True
    status = user.get("subscription_status")
    if status in ("active", "trialing"):
        return True
    return False


async def _get_threshold_and_duration(db):
    """Read the current threshold + preview duration.

    The admin panel writes these to `app_settings` under
    setting_type='monetization' via POST /api/admin/app-settings/monetization.
    (The `monetization_settings` collection stores billing/subscription config —
    NOT skip thresholds. Two separate stores by design.)
    """
    doc = await db.app_settings.find_one({"setting_type": "monetization"}) or {}
    cfg = doc.get("config", {}) or {}
    return (
        int(cfg.get("hard_skip_limit", 6)),
        int(cfg.get("preview_duration_seconds", 35)),
    )


@router.get("/usage")
async def get_user_usage(request: Request):
    """Return the caller's current skip counter + preview lock state.

    Anonymous callers get {authenticated:false, usage_count:0} so the client
    can still render sensible defaults; the client's local counter takes
    over for guest limits.
    """
    db = get_db()
    user_id, user = await _resolve_user(request)
    threshold, preview_duration = await _get_threshold_and_duration(db)

    if not user_id:
        return {
            "authenticated": False,
            "usage_count": 0,
            "preview_mode_active": False,
            "threshold": threshold,
            "preview_duration_seconds": preview_duration,
            "is_premium": False,
        }

    stats = await db.user_billing_stats.find_one({"user_id": user_id}, {"_id": 0}) or {}
    is_premium = _is_premium(user)

    # Premium bypasses everything — even if stats show a preview lock
    if is_premium:
        return {
            "authenticated": True,
            "usage_count": 0,
            "preview_mode_active": False,
            "threshold": threshold,
            "preview_duration_seconds": preview_duration,
            "is_premium": True,
        }

    usage = int(stats.get("skip_count", 0))
    preview_active = bool(stats.get("preview_mode_active", False)) or usage >= threshold
    return {
        "authenticated": True,
        "usage_count": usage,
        "preview_mode_active": preview_active,
        "threshold": threshold,
        "preview_duration_seconds": preview_duration,
        "is_premium": False,
    }


@router.post("/record-skip")
async def record_skip(request: Request):
    """Increment the caller's skip counter (once per call).

    Response mirrors /usage plus a `prompt_hard` boolean the client uses to
    decide whether to show the contribution modal on this specific skip.

    Anonymous callers: no server counter — guest limits are enforced by the
    client. We still return sensible defaults so the client's fire-and-forget
    call doesn't error.
    """
    db = get_db()
    user_id, user = await _resolve_user(request)
    threshold, preview_duration = await _get_threshold_and_duration(db)

    if not user_id:
        return {
            "authenticated": False,
            "usage_count": 0,
            "preview_mode_active": False,
            "threshold": threshold,
            "prompt_hard": False,
            "is_premium": False,
        }

    if _is_premium(user):
        return {
            "authenticated": True,
            "usage_count": 0,
            "preview_mode_active": False,
            "threshold": threshold,
            "prompt_hard": False,
            "is_premium": True,
        }

    now_iso = datetime.now(timezone.utc).isoformat()

    # Atomic upsert-and-increment. `$setOnInsert` on created_at + defaults
    # so a first-time skip lands in a well-formed doc.
    await db.user_billing_stats.update_one(
        {"user_id": user_id},
        {
            "$inc": {"skip_count": 1, "total_lifetime_skips": 1},
            "$set": {"updated_at": now_iso, "last_skip_at": now_iso},
            "$setOnInsert": {
                "user_id": user_id,
                "created_at": now_iso,
                "preview_mode_active": False,
            },
        },
        upsert=True,
    )

    # Read back post-increment (motor's find_one_and_update return_document
    # semantics vary; a fresh find is safer + portable).
    stats = await db.user_billing_stats.find_one({"user_id": user_id}, {"_id": 0}) or {}
    usage = int(stats.get("skip_count", 1))
    prompt_hard = (usage == threshold)

    # Flip preview_mode_active once we cross the threshold; capture first-hit.
    if usage >= threshold and not stats.get("preview_mode_active"):
        await db.user_billing_stats.update_one(
            {"user_id": user_id},
            {"$set": {"preview_mode_active": True, "first_hit_at": now_iso}},
        )
        stats["preview_mode_active"] = True

    return {
        "authenticated": True,
        "usage_count": usage,
        "preview_mode_active": bool(stats.get("preview_mode_active", False)) or usage >= threshold,
        "threshold": threshold,
        "prompt_hard": prompt_hard,
        "is_premium": False,
    }


@router.post("/reset")
async def reset_on_premium(request: Request):
    """Wipe the caller's skip counters. Called by the client after a
    successful subscription upgrade as a manual failsafe (the subscription
    webhook should also trigger this)."""
    db = get_db()
    user_id, user = await _resolve_user(request)

    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not _is_premium(user):
        raise HTTPException(status_code=403, detail="User is not premium")

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.user_billing_stats.update_one(
        {"user_id": user_id},
        {"$set": {
            "skip_count": 0,
            "preview_mode_active": False,
            "cleared_at": now_iso,
            "updated_at": now_iso,
        }},
        upsert=True,
    )
    return {"cleared": True}


@router.get("/admin/approaching-paywall")
async def admin_users_approaching_paywall(limit: int = 20):
    """Admin analytics: users close to (or already at) the paywall.

    Returns the top N unpaid users sorted by skip_count desc. Great signal
    for a targeted contribution nudge — email/push these people with a
    'you've been enjoying Gracefy — consider chipping in' message.

    NOTE: Not auth-gated here yet — all /admin/* endpoints need the auth
    dependency added in a follow-up (flagged as P0 in prior reviews).
    """
    db = get_db()

    # Read current threshold to compute "distance to lock"
    threshold, _preview_duration = await _get_threshold_and_duration(db)
    # "Approaching" = skip_count >= threshold - 2 (i.e. 2 skips away from lock,
    # or already at/past the lock). This is where the conversion nudge is most
    # effective.
    approaching_floor = max(0, threshold - 2)

    limit = max(1, min(int(limit), 100))

    cursor = db.user_billing_stats.find(
        {"skip_count": {"$gte": approaching_floor}},
        {"_id": 0},
    ).sort("skip_count", -1).limit(limit)
    rows = await cursor.to_list(limit)

    # Enrich with user details (email, name) so admin sees who to contact.
    user_ids = [r["user_id"] for r in rows]
    users_map = {}
    if user_ids:
        async for u in db.app_users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "email": 1, "name": 1, "phone": 1,
             "is_premium": 1, "subscription_status": 1, "last_login": 1}
        ):
            users_map[u["user_id"]] = u

    enriched = []
    for r in rows:
        u = users_map.get(r["user_id"], {})
        is_prem = bool(u.get("is_premium")) or u.get("subscription_status") in ("active", "trialing")
        # Skip already-premium users — they aren't a conversion target
        if is_prem:
            continue
        enriched.append({
            "user_id": r["user_id"],
            "email": u.get("email"),
            "name": u.get("name"),
            "phone": u.get("phone"),
            "skip_count": r.get("skip_count", 0),
            "total_lifetime_skips": r.get("total_lifetime_skips", 0),
            "preview_mode_active": bool(r.get("preview_mode_active", False)),
            "first_hit_at": r.get("first_hit_at"),
            "last_skip_at": r.get("last_skip_at"),
            "last_login": u.get("last_login"),
            "distance_to_lock": max(0, threshold - r.get("skip_count", 0)),
        })

    return {
        "threshold": threshold,
        "approaching_floor": approaching_floor,
        "count": len(enriched),
        "users": enriched,
    }
