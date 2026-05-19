"""
Shared FastAPI dependencies for admin / staff authentication.

Used by routes/auth.py, routes/neno_la_leo.py and any future admin endpoint
that needs to gate by login session + (optionally) a granular permission.

Why this module exists:
    Admin login (POST /api/admin/users/login) writes a session into
    ``admin_sessions`` and issues a token prefixed with ``admin_``.
    Several legacy endpoints previously checked ``user_sessions`` and the
    ``users`` collection, which made them return 401/403 even for a
    correctly-logged-in admin. This module fixes that by accepting BOTH
    admin sessions and legacy user_sessions.
"""

from typing import List, Optional, Set
from datetime import datetime, timezone
from fastapi import HTTPException, Request

from core.database import get_db


# Super-admin has implicit "*" - matches any permission check.
_WILDCARD = "*"


def _extract_token(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token


async def get_current_admin(request: Request) -> dict:
    """Return the authenticated admin user dict (no password_hash).

    Looks up the session in ``admin_sessions`` first (tokens starting with
    ``admin_``), then falls back to legacy ``user_sessions`` for backward
    compatibility with older admin accounts.

    Raises 401 if no valid session is found.
    """
    db = get_db()
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Admin sessions ----------------------------------------------------------
    if token.startswith("admin_"):
        sess = await db.admin_sessions.find_one({"session_token": token}, {"_id": 0})
        if not sess:
            raise HTTPException(status_code=401, detail="Invalid admin session")

        expires_at = sess.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at and expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Admin session expired")

        admin = await db.admin_users.find_one(
            {"admin_id": sess["admin_id"]},
            {"_id": 0, "password_hash": 0},
        )
        if not admin:
            raise HTTPException(status_code=401, detail="Admin user not found")

        # Normalise: super_admin gets wildcard permission so everything passes.
        if not admin.get("permissions"):
            admin["permissions"] = [_WILDCARD] if admin.get("is_super_admin") else []
        admin["role"] = admin.get("role") or "admin"
        return admin

    # Legacy user_sessions (admins created via old flow) ----------------------
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = await db.users.find_one(
        {"user_id": sess["user_id"]},
        {"_id": 0, "password_hash": 0},
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("role") == "user":  # plain end users don't get admin access
        raise HTTPException(status_code=403, detail="Admin access required")

    if not user.get("permissions"):
        user["permissions"] = [_WILDCARD] if user.get("role") in ("admin", "super_admin") else []
    return user


def _has_any(perms: Set[str], required: List[str]) -> bool:
    if _WILDCARD in perms:
        return True
    return any(r in perms for r in required)


def require_permissions(*required: str):
    """FastAPI dependency factory that gates an endpoint behind one or more
    permissions. Pass any of: ``"user_management"``, ``"content_moderation"``, ...

    Caller passes if their permission set contains ``"*"`` or ANY of the
    required permissions. Pass no arguments to allow any logged-in admin.
    """
    required_list = list(required)

    async def _dep(request: Request) -> dict:
        admin = await get_current_admin(request)
        if not required_list:
            return admin
        perms = set(admin.get("permissions") or [])
        if not _has_any(perms, required_list):
            raise HTTPException(
                status_code=403,
                detail=f"Missing required permission: {' or '.join(required_list)}",
            )
        return admin

    return _dep


# Shortcut: dependency with no required perms (any logged-in admin).
require_admin = require_permissions()
