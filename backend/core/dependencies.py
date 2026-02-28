"""
Shared dependencies for all routers in Gracefy.
Provides authentication helpers, database access, and common utilities.
"""

from fastapi import Request, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import logging

from core.database import get_db

logger = logging.getLogger(__name__)


async def get_current_admin_user(request: Request):
    """
    Dependency to get current authenticated admin user.
    Used for admin panel endpoints.
    """
    db = get_db()
    
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # First check admin_sessions for admin users (tokens starting with admin_)
    if session_token.startswith("admin_"):
        admin_session = await db.admin_sessions.find_one({"session_token": session_token}, {"_id": 0})
        
        if admin_session:
            expires_at = admin_session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
            
            admin_user = await db.admin_users.find_one(
                {"admin_id": admin_session["admin_id"]}, 
                {"_id": 0, "password_hash": 0}
            )
            
            if admin_user:
                admin_user["role"] = admin_user.get("role", "admin")
                return admin_user
    
    # Check regular user sessions
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_current_app_user(request: Request):
    """
    Dependency to get current authenticated mobile app user.
    Used for mobile app endpoints.
    """
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Check token expiry
    expires_at = token_doc.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token expired")
    
    user = await db.app_users.find_one(
        {"user_id": token_doc["user_id"]}, 
        {"_id": 0, "password_hash": 0}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_optional_app_user(request: Request) -> Optional[dict]:
    """
    Dependency to optionally get current app user.
    Returns None if not authenticated instead of raising an error.
    """
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    
    if not token_doc:
        return None
    
    user = await db.app_users.find_one(
        {"user_id": token_doc["user_id"]}, 
        {"_id": 0, "password_hash": 0}
    )
    
    return user


async def get_current_choir_account(request: Request):
    """
    Dependency to get current authenticated choir account.
    Used for choir portal endpoints.
    """
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.choir_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.choir_accounts.find_one(
        {"account_id": token_doc["account_id"]}, 
        {"_id": 0, "password_hash": 0}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    if account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    
    return account


async def get_current_church_leader(request: Request):
    """
    Dependency to get current authenticated church leader.
    Used for church leader portal endpoints.
    """
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header[7:]
    token_doc = await db.church_leader_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    account = await db.church_leader_accounts.find_one(
        {"account_id": token_doc["account_id"]}, 
        {"_id": 0, "password_hash": 0}
    )
    
    if not account:
        raise HTTPException(status_code=401, detail="Account not found")
    
    if account.get("status") != "approved":
        raise HTTPException(status_code=403, detail="Account not approved")
    
    return account


def check_permission(user: dict, permission: str) -> bool:
    """Check if user has a specific permission based on their role."""
    from models.schemas import ROLE_PERMISSIONS
    
    role = user.get("role", "listener_free")
    permissions = ROLE_PERMISSIONS.get(role, [])
    return permission in permissions


def require_permission(permission: str):
    """Dependency factory to require a specific permission."""
    async def permission_checker(user: dict = Depends(get_current_admin_user)):
        if not check_permission(user, permission):
            raise HTTPException(
                status_code=403, 
                detail=f"Permission denied: {permission} required"
            )
        return user
    return permission_checker
