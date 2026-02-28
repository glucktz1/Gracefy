"""
Authentication routes for Gracefy.
Handles admin panel auth, mobile app auth, OTP, and password reset.
"""

from fastapi import APIRouter, HTTPException, Request, Response
from datetime import datetime, timezone, timedelta
import uuid
import hashlib
import random
import logging
import httpx
import os

from core.database import get_db
from core.cache import cache

# Import SMS service
try:
    from services.sms_service import send_otp_sms, send_sms, get_sms_settings
except ImportError:
    send_otp_sms = None
    send_sms = None
    get_sms_settings = None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["auth"])

# Session configuration
SESSION_EXPIRY_DAYS = 7
TOKEN_EXPIRY_DAYS = 30


# ============== ADMIN PANEL AUTH ==============

@router.post("/auth/session")
async def process_session(request: Request, response: Response):
    """Process session_id from Emergent OAuth and create user session"""
    db = get_db()
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Get user data from Emergent auth
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_data = auth_response.json()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data
        await db.users.update_one(
            {"email": user_data["email"]},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture")
            }}
        )
    else:
        # Create new user - only glucktz1904@gmail.com gets admin role
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        admin_email = "glucktz1904@gmail.com"
        is_admin = user_data["email"].lower() == admin_email.lower()
        
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "role": "admin" if is_admin else "user",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", f"token_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}


@router.get("/auth/me")
async def get_current_user(request: Request):
    """Get current authenticated admin user"""
    db = get_db()
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # First check admin_sessions for admin users
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
                admin_user["role"] = "admin"
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


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout admin user"""
    db = get_db()
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Delete from both session collections
        await db.user_sessions.delete_one({"session_token": session_token})
        await db.admin_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    response.delete_cookie(key="admin_email", path="/")
    return {"message": "Logged out successfully"}


# ============== ADMIN USER MANAGEMENT ==============

VALID_ROLES = ["admin", "choir_admin", "church_admin", "content_manager", "viewer", "user"]

@router.get("/admin/users")
async def get_admin_users(request: Request):
    """Get all admin/system users"""
    db = get_db()
    
    # Verify admin access
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    current_user = await db.users.find_one({"user_id": session["user_id"]})
    if not current_user or current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all system users
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    
    return {"users": users, "total": len(users)}


@router.post("/admin/users")
async def create_admin_user(request: Request, data: dict):
    """Create a new admin/system user with username and password"""
    db = get_db()
    
    # Verify admin access
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    current_user = await db.users.find_one({"user_id": session["user_id"]})
    if not current_user or current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate input
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")
    name = data.get("name")
    role = data.get("role", "user")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username already exists (if provided)
    if username:
        existing_username = await db.users.find_one({"username": username})
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already taken")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "username": username,
        "name": name or username or email.split("@")[0],
        "password_hash": password_hash,
        "role": role,
        "status": "active",
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    user.pop("_id", None)
    user.pop("password_hash", None)
    
    logger.info(f"Admin user created: {email} with role {role} by {current_user['email']}")
    
    return user


@router.put("/admin/users/{user_id}")
async def update_admin_user(request: Request, user_id: str, data: dict):
    """Update an admin/system user"""
    db = get_db()
    
    # Verify admin access
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    current_user = await db.users.find_one({"user_id": session["user_id"]})
    if not current_user or current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find user to update
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prepare update
    update_data = {}
    
    if "name" in data:
        update_data["name"] = data["name"]
    if "role" in data and data["role"] in VALID_ROLES:
        update_data["role"] = data["role"]
    if "status" in data and data["status"] in ["active", "inactive", "suspended"]:
        update_data["status"] = data["status"]
    if "password" in data and data["password"]:
        update_data["password_hash"] = hashlib.sha256(data["password"].encode()).hexdigest()
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return updated_user


@router.delete("/admin/users/{user_id}")
async def delete_admin_user(request: Request, user_id: str):
    """Delete an admin/system user"""
    db = get_db()
    
    # Verify admin access
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    current_user = await db.users.find_one({"user_id": session["user_id"]})
    if not current_user or current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Cannot delete yourself
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete any sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": "User deleted successfully"}


@router.post("/admin/users/login")
async def admin_user_login(data: dict, response: Response):
    """Login with username/email and password for admin users"""
    db = get_db()
    
    email = data.get("email") or data.get("username")
    password = data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email/username and password required")
    
    # First check admin_users collection
    admin_user = await db.admin_users.find_one({"email": email})
    
    if admin_user:
        # Verify password
        if not admin_user.get("password_hash"):
            raise HTTPException(status_code=401, detail="This account uses OAuth login")
        
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        if admin_user["password_hash"] != password_hash:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if admin_user.get("status") != "active":
            raise HTTPException(status_code=403, detail="Account is not active")
        
        # Create session
        session_token = f"admin_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
        
        session_doc = {
            "session_id": f"sess_{uuid.uuid4().hex}",
            "admin_id": admin_user["admin_id"],
            "user_id": admin_user["admin_id"],
            "email": admin_user["email"],
            "role": "admin",
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.admin_sessions.insert_one(session_doc)
        
        # Set cookies
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
        )
        response.set_cookie(
            key="admin_email",
            value=admin_user["email"],
            httponly=False,
            secure=True,
            samesite="none",
            path="/",
            max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
        )
        
        return {
            "token": session_token,
            "user": {
                "admin_id": admin_user["admin_id"],
                "email": admin_user["email"],
                "name": admin_user.get("name"),
                "role": "admin",
                "permissions": admin_user.get("permissions", [])
            }
        }
    
    # Fallback to users collection
    user = await db.users.find_one({"$or": [{"email": email}, {"username": email}]})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user has password_hash (created by admin)
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="This account uses OAuth login")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account is not active")
    
    # Create session
    session_token = f"token_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex}",
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60
    )
    
    user.pop("_id", None)
    user.pop("password_hash", None)
    
    return {"user": user, "session_token": session_token}


# ============== MOBILE APP AUTH ==============

@router.post("/user/register")
async def register_user(data: dict):
    """Register a new user with email/password or phone"""
    db = get_db()
    
    # Check if registration is enabled
    auth_settings = await db.auth_settings.find_one({"settings_id": "auth_settings"})
    if auth_settings and not auth_settings.get("registration_enabled", True):
        raise HTTPException(status_code=403, detail="New registrations are currently disabled")
    
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    name = data.get("name", "")
    
    if not password or (not email and not phone):
        raise HTTPException(status_code=400, detail="Email or phone and password required")
    
    # Check if email registration is enabled
    if email and not await check_auth_method_enabled("email"):
        raise HTTPException(status_code=403, detail="Email registration is currently disabled")
    
    # Check if phone registration is enabled
    if phone and not await check_auth_method_enabled("phone"):
        raise HTTPException(status_code=403, detail="Phone registration is currently disabled")
    
    # Check password length
    min_length = auth_settings.get("password_min_length", 6) if auth_settings else 6
    if len(password) < min_length:
        raise HTTPException(status_code=400, detail=f"Password must be at least {min_length} characters")
    
    # Check if user exists
    if email:
        existing = await db.app_users.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    if phone:
        existing = await db.app_users.find_one({"phone": phone})
        if existing:
            raise HTTPException(status_code=400, detail="Phone already registered")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Check if free trial is enabled
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    trial_enabled = settings.get("free_trial_enabled", True) if settings else True
    trial_days = settings.get("free_trial_days", 7) if settings else 7
    
    # Calculate trial expiry
    trial_expires_at = None
    trial_status = None
    if trial_enabled and trial_days > 0:
        trial_expires_at = (datetime.now(timezone.utc) + timedelta(days=trial_days)).isoformat()
        trial_status = "active"
    
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "phone": phone,
        "name": name,
        "password_hash": password_hash,
        "picture": None,
        "subscription_type": "free",
        "subscription_expires": None,
        "trial": {
            "status": trial_status,
            "started_at": datetime.now(timezone.utc).isoformat() if trial_enabled else None,
            "expires_at": trial_expires_at,
            "days_granted": trial_days if trial_enabled else 0,
        } if trial_enabled else None,
        "favorites": [],
        "playlists": [],
        "recently_played": [],
        "downloads": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.app_users.insert_one(user)
    del user["password_hash"]
    user.pop("_id", None)
    
    # Generate token
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_tokens.insert_one({
        "token": token,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS)).isoformat()
    })
    
    return {
        "user": user, 
        "token": token,
        "trial_started": trial_enabled,
        "trial_days": trial_days if trial_enabled else 0,
        "trial_expires_at": trial_expires_at
    }


@router.post("/user/login")
async def login_user(data: dict):
    """Login user with email/phone and password"""
    db = get_db()
    
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")
    
    if not password or (not email and not phone):
        raise HTTPException(status_code=400, detail="Credentials required")
    
    # Check if email/password login is enabled
    if email and not await check_auth_method_enabled("email"):
        raise HTTPException(status_code=403, detail="Email/password login is currently disabled")
    
    # Check if phone login is enabled
    if phone and not await check_auth_method_enabled("phone"):
        raise HTTPException(status_code=403, detail="Phone login is currently disabled")
    
    query = {"email": email} if email else {"phone": phone}
    user = await db.app_users.find_one(query)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user["password_hash"] != password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_tokens.insert_one({
        "token": token,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS)).isoformat()
    })
    
    del user["password_hash"]
    user.pop("_id", None)
    
    return {"user": user, "token": token}


@router.get("/user/me")
async def get_user_profile(request: Request):
    """Get current user profile"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.replace("Bearer ", "")
    token_doc = await db.user_tokens.find_one({"token": token})
    
    if not token_doc:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.app_users.find_one({"user_id": token_doc["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


@router.post("/user/logout")
async def user_logout(request: Request):
    """Logout mobile app user"""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        await db.user_tokens.delete_one({"token": token})
    
    return {"message": "Logged out successfully"}


# ============== OTP AUTHENTICATION ==============

@router.post("/auth/send-otp")
async def send_otp_endpoint(data: dict):
    """Send OTP to phone number for authentication"""
    db = get_db()
    
    phone = data.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")
    
    # Normalize phone
    phone = phone.replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        if phone.startswith("0"):
            phone = "+255" + phone[1:]
        else:
            phone = "+255" + phone
    
    # Generate OTP
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    # Store OTP
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {
            "otp": otp,
            "expires_at": expires_at.isoformat(),
            "verified": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Send SMS via MIA SMS service
    sms_result = None
    sms_sent = False
    
    if send_otp_sms:
        try:
            sms_result = await send_otp_sms(phone, otp, db)
            sms_sent = sms_result.get("success", False)
            logger.info(f"[OTP SMS] Phone: {phone}, Sent: {sms_sent}, Result: {sms_result.get('status', 'unknown')}")
        except Exception as e:
            logger.error(f"[OTP SMS Error] Phone: {phone}, Error: {str(e)}")
    else:
        logger.warning("[OTP] SMS service not available, OTP not sent")
    
    response = {
        "message": "OTP sent successfully" if sms_sent else "OTP generated (SMS delivery pending)",
        "phone": phone,
        "expires_in": 600,
        "sms_sent": sms_sent
    }
    
    # Include OTP in response for development/testing when SMS fails
    if not sms_sent or (sms_result and sms_result.get("test_mode")):
        response["demo_otp"] = otp
        response["note"] = "OTP included for testing. Remove in production."
    
    return response


@router.post("/auth/verify-otp")
async def verify_otp(data: dict):
    """Verify OTP and authenticate user"""
    db = get_db()
    
    phone = data.get("phone")
    otp = data.get("otp")
    
    if not phone or not otp:
        raise HTTPException(status_code=400, detail="Phone and OTP required")
    
    # Normalize phone
    phone = phone.replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        if phone.startswith("0"):
            phone = "+255" + phone[1:]
        else:
            phone = "+255" + phone
    
    # Find OTP
    otp_doc = await db.otp_codes.find_one({"phone": phone})
    if not otp_doc:
        raise HTTPException(status_code=400, detail="No OTP sent to this number")
    
    # Check if expired
    expires_at = datetime.fromisoformat(otp_doc["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Verify OTP
    if otp_doc["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Mark as verified
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {"verified": True}}
    )
    
    # Find or create user
    user = await db.app_users.find_one({"phone": phone})
    
    if not user:
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "phone": phone,
            "email": None,
            "name": "",
            "subscription_type": "free",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        await db.app_users.insert_one(user)
    
    user.pop("_id", None)
    user.pop("password_hash", None)
    
    # Generate token
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_tokens.insert_one({
        "token": token,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS)).isoformat()
    })
    
    return {"user": user, "token": token, "message": "OTP verified successfully"}


# ============== PASSWORD RESET ==============

@router.post("/auth/forgot-password/send")
async def forgot_password_send(data: dict):
    """Send password reset OTP"""
    db = get_db()
    
    email = data.get("email")
    phone = data.get("phone")
    
    if not email and not phone:
        raise HTTPException(status_code=400, detail="Email or phone required")
    
    # Find user
    query = {"email": email} if email else {"phone": phone}
    user = await db.app_users.find_one(query)
    
    if not user:
        # Don't reveal if user exists
        return {"message": "If account exists, reset code has been sent"}
    
    # Generate reset code
    reset_code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    await db.password_resets.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "reset_code": reset_code,
            "expires_at": expires_at.isoformat(),
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # In production, send email/SMS
    logger.info(f"[PASSWORD RESET] User: {user['user_id']}, Code: {reset_code}")
    
    return {
        "message": "Reset code sent successfully",
        "expires_in": 900,
        "demo_code": reset_code  # Remove in production
    }


@router.post("/auth/forgot-password/verify")
async def forgot_password_verify(data: dict):
    """Verify password reset code"""
    db = get_db()
    
    email = data.get("email")
    phone = data.get("phone")
    code = data.get("code")
    
    if not code or (not email and not phone):
        raise HTTPException(status_code=400, detail="Email/phone and code required")
    
    # Find user
    query = {"email": email} if email else {"phone": phone}
    user = await db.app_users.find_one(query)
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Find reset code
    reset_doc = await db.password_resets.find_one({"user_id": user["user_id"]})
    
    if not reset_doc:
        raise HTTPException(status_code=400, detail="No reset code found")
    
    if reset_doc.get("used"):
        raise HTTPException(status_code=400, detail="Reset code already used")
    
    # Check expiry
    expires_at = datetime.fromisoformat(reset_doc["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset code expired")
    
    if reset_doc["reset_code"] != code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    
    # Generate reset token
    reset_token = f"reset_{uuid.uuid4().hex}"
    
    await db.password_resets.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"reset_token": reset_token}}
    )
    
    return {"message": "Code verified", "reset_token": reset_token}


@router.post("/auth/forgot-password/reset")
async def forgot_password_reset(data: dict):
    """Reset password with verified token"""
    db = get_db()
    
    reset_token = data.get("reset_token")
    new_password = data.get("new_password")
    
    if not reset_token or not new_password:
        raise HTTPException(status_code=400, detail="Reset token and new password required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Find reset doc
    reset_doc = await db.password_resets.find_one({"reset_token": reset_token})
    
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    
    if reset_doc.get("used"):
        raise HTTPException(status_code=400, detail="Reset token already used")
    
    # Check expiry
    expires_at = datetime.fromisoformat(reset_doc["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token expired")
    
    # Update password
    password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    
    await db.app_users.update_one(
        {"user_id": reset_doc["user_id"]},
        {"$set": {"password_hash": password_hash}}
    )
    
    # Mark reset as used
    await db.password_resets.update_one(
        {"user_id": reset_doc["user_id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Invalidate all existing tokens
    await db.user_tokens.delete_many({"user_id": reset_doc["user_id"]})
    
    return {"message": "Password reset successfully. Please login with your new password."}


# ============== GOOGLE AUTH (Mobile App) ==============

@router.get("/user/auth/google-start")
async def google_auth_start(redirect_uri: str = None, platform: str = "mobile"):
    """Start Google OAuth flow - returns the auth URL to open in browser"""
    # Use the backend callback URL as the redirect for Emergent
    backend_callback = f"{os.environ.get('BACKEND_URL', 'https://mafundisho-player.preview.emergentagent.com')}/api/user/auth/google-callback"
    
    # Store the mobile redirect for later use
    auth_url = f"https://demobackend.emergentagent.com/auth/v1/env/oauth/google?redirect_uri={backend_callback}&platform={platform}"
    
    if redirect_uri:
        # Encode the mobile redirect for passing through
        auth_url += f"&mobile_redirect={redirect_uri}"
    
    return {"auth_url": auth_url}

@router.get("/user/auth/google-callback")
async def google_auth_callback(request: Request):
    """
    Handle Google OAuth callback for mobile app.
    auth.emergentagent.com redirects here with session_id in hash fragment.
    This page extracts session_id from hash and processes login.
    """
    from fastapi.responses import HTMLResponse
    
    mobile_redirect = request.query_params.get("mobile_redirect", "gracefy://auth")
    session_id = request.query_params.get("session_id")
    
    # If session_id is provided as query param, process directly
    if session_id:
        return await process_mobile_google_login(session_id, mobile_redirect)
    
    # Otherwise, return HTML that extracts session_id from hash and redirects
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gracefy - Inasindika...</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: white;
            }}
            .container {{
                text-align: center;
                padding: 20px;
            }}
            .spinner {{
                width: 50px;
                height: 50px;
                border: 3px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: #8b5cf6;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }}
            @keyframes spin {{
                to {{ transform: rotate(360deg); }}
            }}
            .error {{
                color: #ef4444;
                display: none;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="spinner"></div>
            <p id="status">Inakamilisha uingiaji...</p>
            <p class="error" id="error"></p>
        </div>
        <script>
            (function() {{
                const hash = window.location.hash;
                const mobile_redirect = "{mobile_redirect}";
                
                // Extract session_id from hash
                const match = hash.match(/session_id=([^&]+)/);
                
                if (match && match[1]) {{
                    const sessionId = match[1];
                    // Call backend to process login
                    fetch('/api/user/auth/mobile-login', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{ session_id: sessionId }})
                    }})
                    .then(r => r.json())
                    .then(data => {{
                        if (data.token) {{
                            // Redirect to mobile app with token
                            const redirectUrl = mobile_redirect + '?token=' + data.token + '&user_id=' + data.user_id;
                            document.getElementById('status').textContent = 'Inakuelekeza kwenye app...';
                            window.location.href = redirectUrl;
                        }} else {{
                            throw new Error(data.detail || 'Login failed');
                        }}
                    }})
                    .catch(err => {{
                        document.getElementById('status').style.display = 'none';
                        document.getElementById('error').style.display = 'block';
                        document.getElementById('error').textContent = 'Kosa: ' + err.message;
                    }});
                }} else {{
                    document.getElementById('status').style.display = 'none';
                    document.getElementById('error').style.display = 'block';
                    document.getElementById('error').textContent = 'Session ID haikupatikana. Tafadhali jaribu tena.';
                }}
            }})();
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@router.post("/user/auth/mobile-login")
async def mobile_google_login(request: Request):
    """Process mobile Google login with session_id"""
    # Check if Google login is enabled
    if not await check_auth_method_enabled("google"):
        raise HTTPException(status_code=403, detail="Google login is currently disabled")
    
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    return await process_mobile_google_login(session_id, None)


async def process_mobile_google_login(session_id: str, mobile_redirect: str = None):
    """Common function to process mobile Google login"""
    db = get_db()
    
    # Check if Google login is enabled
    if not await check_auth_method_enabled("google"):
        raise HTTPException(status_code=403, detail="Google login is currently disabled")
    
    # Get user data from Emergent auth
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_data = auth_response.json()
    
    email = user_data.get("email")
    name = user_data.get("name", "")
    picture = user_data.get("picture")
    
    # Find or create user in app_users collection
    existing_user = await db.app_users.find_one({"email": email})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.app_users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "google_connected": True}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "phone": None,
            "subscription_type": "free",
            "google_connected": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        await db.app_users.insert_one(user)
    
    # Generate token
    token = f"tok_{uuid.uuid4().hex}"
    await db.user_tokens.insert_one({
        "token": token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS)).isoformat()
    })
    
    # If mobile redirect is provided, redirect there with token
    if mobile_redirect:
        from fastapi.responses import RedirectResponse
        redirect_url = f"{mobile_redirect}?token={token}&user_id={user_id}"
        return RedirectResponse(url=redirect_url)
    
    # Get full user object for response
    user = await db.app_users.find_one(
        {"user_id": user_id},
        {"_id": 0, "password_hash": 0}
    )
    
    return {
        "token": token, 
        "user_id": user_id, 
        "email": email, 
        "name": name,
        "user": user  # Include full user object for frontend
    }


@router.post("/user/auth/google-callback")
async def google_auth_callback_post(request: Request):
    """Handle Google OAuth callback (POST version)"""
    data = await request.json()
    session_id = data.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    return await process_mobile_google_login(session_id, None)


@router.get("/user/auth/me")
async def get_app_user_auth(request: Request):
    """Get current authenticated app user"""
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



# ============== AUTH SETTINGS MANAGEMENT ==============

DEFAULT_AUTH_SETTINGS = {
    "settings_id": "auth_settings",
    "email_password_enabled": True,
    "google_enabled": True,
    "phone_enabled": False,
    "guest_access_enabled": True,
    "registration_enabled": True,
    "require_email_verification": False,
    "require_phone_verification": False,
    "max_login_attempts": 5,
    "lockout_duration_minutes": 15,
    "password_min_length": 6,
    "created_at": None,
    "updated_at": None
}

@router.get("/admin/auth-settings")
async def get_auth_settings():
    """Get authentication settings for admin panel"""
    db = get_db()
    
    settings = await db.auth_settings.find_one(
        {"settings_id": "auth_settings"},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults if not configured
        return DEFAULT_AUTH_SETTINGS
    
    # Merge with defaults to ensure all fields exist
    merged = {**DEFAULT_AUTH_SETTINGS, **settings}
    return merged


@router.put("/admin/auth-settings")
async def update_auth_settings(request: Request):
    """Update authentication settings"""
    db = get_db()
    data = await request.json()
    
    # Validate data
    allowed_fields = [
        "email_password_enabled",
        "google_enabled", 
        "phone_enabled",
        "guest_access_enabled",
        "registration_enabled",
        "require_email_verification",
        "require_phone_verification",
        "max_login_attempts",
        "lockout_duration_minutes",
        "password_min_length"
    ]
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.auth_settings.update_one(
        {"settings_id": "auth_settings"},
        {
            "$set": update_data,
            "$setOnInsert": {
                "settings_id": "auth_settings",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    # Clear cache if any
    cache.delete("auth_settings")
    
    # Get updated settings
    settings = await db.auth_settings.find_one(
        {"settings_id": "auth_settings"},
        {"_id": 0}
    )
    
    return {"success": True, "settings": {**DEFAULT_AUTH_SETTINGS, **settings}}


@router.get("/auth/available-methods")
async def get_available_auth_methods():
    """
    Public endpoint to get which authentication methods are enabled.
    Used by frontend and mobile app to show/hide login options.
    """
    db = get_db()
    
    try:
        settings = await db.auth_settings.find_one(
            {"settings_id": "auth_settings"},
            {"_id": 0}
        )
        
        if not settings:
            settings = DEFAULT_AUTH_SETTINGS
        
        methods = {
            "email_password": settings.get("email_password_enabled", True),
            "google": settings.get("google_enabled", True),
            "phone": settings.get("phone_enabled", False),
            "guest": settings.get("guest_access_enabled", True),
            "registration_enabled": settings.get("registration_enabled", True)
        }
        
        return methods
    except Exception:
        # Return defaults on error
        return {
            "email_password": True,
            "google": True,
            "phone": False,
            "guest": True,
            "registration_enabled": True
        }


# ============== VALIDATION MIDDLEWARE ==============

async def check_auth_method_enabled(method: str) -> bool:
    """Check if a specific auth method is enabled"""
    db = get_db()
    
    settings = await db.auth_settings.find_one(
        {"settings_id": "auth_settings"},
        {"_id": 0}
    )
    
    if not settings:
        return True  # Default to enabled
    
    method_map = {
        "email": settings.get("email_password_enabled", True),
        "google": settings.get("google_enabled", True),
        "phone": settings.get("phone_enabled", False),
        "guest": settings.get("guest_access_enabled", True)
    }
    
    return method_map.get(method, True)


# ============== SMS SERVICE ADMIN ENDPOINTS ==============

@router.get("/admin/sms/settings")
async def get_sms_config():
    """Get SMS service configuration (admin only)"""
    if get_sms_settings:
        return get_sms_settings()
    return {"error": "SMS service not available", "configured": False}


@router.post("/admin/sms/test")
async def send_test_sms(data: dict):
    """Send a test SMS message (admin only)"""
    db = get_db()
    
    phone = data.get("phone")
    message = data.get("message", "Test message from SpiritSongs")
    
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")
    
    if not send_sms:
        raise HTTPException(status_code=500, detail="SMS service not available")
    
    result = await send_sms(phone, message, db=db)
    return result


@router.get("/admin/sms/logs")
async def get_sms_logs(
    limit: int = 50,
    status: str = None
):
    """Get SMS logs for debugging and monitoring"""
    db = get_db()
    
    query = {}
    if status:
        query["success"] = status == "success"
    
    logs = await db.sms_logs.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"logs": logs, "count": len(logs)}


@router.get("/admin/sms/balance")
async def check_sms_balance():
    """Check SMS credit balance"""
    try:
        from services.sms_service import get_sms_balance
        return await get_sms_balance()
    except ImportError:
        return {"error": "SMS service not available"}



# ============== PUSH NOTIFICATIONS ==============

@router.post("/user/push-token")
async def save_push_token(request: Request, data: dict):
    """Save user's push notification token"""
    db = get_db()
    
    user_id = data.get("user_id")
    push_token = data.get("push_token")
    platform = data.get("platform", "unknown")
    device_name = data.get("device_name", "Unknown Device")
    
    if not user_id or not push_token:
        raise HTTPException(status_code=400, detail="user_id and push_token required")
    
    # Verify user exists
    user = await db.app_users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user with push token
    await db.app_users.update_one(
        {"user_id": user_id},
        {"$set": {
            "push_token": push_token,
            "push_platform": platform,
            "push_device_name": device_name,
            "push_token_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Push token saved for user {user_id}")
    
    return {"success": True, "message": "Push token saved"}


@router.delete("/user/push-token")
async def remove_push_token(request: Request):
    """Remove user's push token (on logout)"""
    db = get_db()
    
    # Get user from token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    user = await db.app_users.find_one({"token": token})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Remove push token
    await db.app_users.update_one(
        {"user_id": user["user_id"]},
        {"$unset": {"push_token": "", "push_platform": "", "push_device_name": ""}}
    )
    
    return {"success": True, "message": "Push token removed"}


@router.get("/admin/push-tokens/stats")
async def get_push_token_stats():
    """Get push notification statistics"""
    db = get_db()
    
    total_users = await db.app_users.count_documents({})
    users_with_tokens = await db.app_users.count_documents({"push_token": {"$exists": True, "$ne": None}})
    
    # Platform breakdown
    android_users = await db.app_users.count_documents({"push_platform": "android"})
    ios_users = await db.app_users.count_documents({"push_platform": "ios"})
    
    return {
        "total_users": total_users,
        "users_with_push_tokens": users_with_tokens,
        "coverage_percentage": round((users_with_tokens / total_users * 100) if total_users > 0 else 0, 1),
        "platform_breakdown": {
            "android": android_users,
            "ios": ios_users
        }
    }
