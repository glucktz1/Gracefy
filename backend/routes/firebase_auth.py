"""
Firebase Authentication Routes for Gracefy Mobile App
Handles Firebase Auth integration for email/password and Google Sign-In
"""

from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
import uuid
import logging

from core.database import get_db
from services.firebase_service import (
    verify_firebase_token,
    get_firebase_user,
    send_fcm_notification,
    send_fcm_multicast,
    send_fcm_to_topic,
    send_tracked_fcm_notification,
    send_tracked_fcm_multicast
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/firebase", tags=["firebase-auth"])

TOKEN_EXPIRY_DAYS = 30


@router.post("/auth/verify")
async def verify_firebase_auth(request: Request):
    """
    Verify Firebase ID token and create/update user in MongoDB
    This is the main auth endpoint for mobile app
    
    Expected body: { "id_token": "firebase_id_token_here" }
    """
    db = get_db()
    data = await request.json()
    
    id_token = data.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Firebase ID token required")
    
    # Verify the token with Firebase
    decoded_token = await verify_firebase_token(id_token)
    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
    
    firebase_uid = decoded_token.get("uid")
    email = decoded_token.get("email")
    name = decoded_token.get("name", decoded_token.get("display_name", ""))
    picture = decoded_token.get("picture")
    phone = decoded_token.get("phone_number")
    email_verified = decoded_token.get("email_verified", False)
    
    # Check sign-in provider
    sign_in_provider = decoded_token.get("firebase", {}).get("sign_in_provider", "password")
    is_google = sign_in_provider == "google.com"
    
    # Find or create user
    existing_user = await db.app_users.find_one({"firebase_uid": firebase_uid})
    
    if existing_user:
        # Update existing user
        user_id = existing_user["user_id"]
        update_data = {
            "email": email,
            "name": name or existing_user.get("name"),
            "picture": picture or existing_user.get("picture"),
            "email_verified": email_verified,
            "last_login": datetime.now(timezone.utc).isoformat(),
            "google_connected": is_google or existing_user.get("google_connected", False)
        }
        if phone:
            update_data["phone"] = phone
        
        await db.app_users.update_one(
            {"firebase_uid": firebase_uid},
            {"$set": update_data}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        
        # Check if free trial is enabled
        settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
        trial_enabled = settings.get("free_trial_enabled", True) if settings else True
        trial_days = settings.get("free_trial_days", 7) if settings else 7
        
        trial_expires_at = None
        trial_status = None
        if trial_enabled and trial_days > 0:
            trial_expires_at = (datetime.now(timezone.utc) + timedelta(days=trial_days)).isoformat()
            trial_status = "active"
        
        new_user = {
            "user_id": user_id,
            "firebase_uid": firebase_uid,
            "email": email,
            "phone": phone,
            "name": name,
            "picture": picture,
            "subscription_type": "free",
            "subscription_expires": None,
            "email_verified": email_verified,
            "google_connected": is_google,
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
            "last_login": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        await db.app_users.insert_one(new_user)
        logger.info(f"New Firebase user created: {email}")
    
    # Generate app token for API calls
    app_token = f"tok_{uuid.uuid4().hex}"
    await db.user_tokens.insert_one({
        "token": app_token,
        "user_id": user_id,
        "firebase_uid": firebase_uid,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRY_DAYS)).isoformat()
    })
    
    # Get user data
    user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    return {
        "success": True,
        "token": app_token,
        "user": user,
        "is_new_user": existing_user is None,
        "trial_started": existing_user is None and trial_enabled,
        "trial_days": trial_days if (existing_user is None and trial_enabled) else 0
    }


@router.post("/fcm/token")
async def save_fcm_token(request: Request):
    """
    Save FCM token for push notifications
    
    Expected body: {
        "user_id": "user_xxx",
        "fcm_token": "fcm_token_here",
        "platform": "android" | "ios",
        "device_name": "Device name"
    }
    """
    db = get_db()
    data = await request.json()
    
    user_id = data.get("user_id")
    fcm_token = data.get("fcm_token")
    platform = data.get("platform", "android")
    device_name = data.get("device_name", "Unknown")
    
    if not user_id or not fcm_token:
        raise HTTPException(status_code=400, detail="user_id and fcm_token required")
    
    # Verify user exists
    user = await db.app_users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update user with FCM token
    await db.app_users.update_one(
        {"user_id": user_id},
        {"$set": {
            "fcm_token": fcm_token,
            "push_platform": platform,
            "push_device_name": device_name,
            "fcm_token_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"FCM token saved for user {user_id}")
    
    return {"success": True, "message": "FCM token saved"}


@router.delete("/fcm/token/{user_id}")
async def remove_fcm_token(user_id: str):
    """Remove FCM token (on logout)"""
    db = get_db()
    
    await db.app_users.update_one(
        {"user_id": user_id},
        {"$unset": {"fcm_token": "", "push_platform": "", "push_device_name": ""}}
    )
    
    return {"success": True, "message": "FCM token removed"}


# ============== ADMIN NOTIFICATION ENDPOINTS ==============

@router.post("/admin/send-notification")
async def admin_send_notification(request: Request):
    """
    Send push notification to specific users or all users
    
    Expected body: {
        "title": "Notification title",
        "body": "Notification body",
        "target": "all" | "premium" | "free" | "user_ids",
        "user_ids": ["user_id1", "user_id2"],  // if target is "user_ids"
        "notification_type": "release" | "billing" | "promo" | "general",
        "data": {},  // optional extra data
        "image_url": "https://..."  // optional
    }
    """
    db = get_db()
    data = await request.json()
    
    # Verify admin (simplified - add proper auth in production)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    title = data.get("title")
    body = data.get("body")
    target = data.get("target", "all")
    user_ids = data.get("user_ids", [])
    notification_type = data.get("notification_type", "general")
    extra_data = data.get("data", {})
    image_url = data.get("image_url")
    
    if not title or not body:
        raise HTTPException(status_code=400, detail="title and body required")
    
    # Build query based on target
    query = {"fcm_token": {"$exists": True, "$ne": None}}
    
    if target == "premium":
        query["subscription_type"] = "premium"
    elif target == "free":
        query["subscription_type"] = "free"
    elif target == "user_ids":
        if not user_ids:
            raise HTTPException(status_code=400, detail="user_ids required for target='user_ids'")
        query["user_id"] = {"$in": user_ids}
    
    # Get users with FCM tokens
    users = await db.app_users.find(
        query,
        {"_id": 0, "user_id": 1, "fcm_token": 1, "name": 1}
    ).to_list(100000)
    
    if not users:
        return {
            "success": False,
            "message": "No users with FCM tokens found for this target",
            "sent": 0
        }
    
    # Send notifications
    result = await send_tracked_fcm_multicast(
        db=db,
        users=users,
        title=title,
        body=body,
        notification_type=notification_type,
        data=extra_data,
        image_url=image_url
    )
    
    return {
        "success": True,
        "sent": result.get("sent", 0),
        "failed": result.get("failed", 0),
        "total_target": len(users),
        "notification_id": result.get("notification_id")
    }


@router.post("/admin/send-topic-notification")
async def admin_send_topic_notification(request: Request):
    """
    Send push notification to a topic (e.g., all_users, premium_users)
    """
    data = await request.json()
    
    topic = data.get("topic", "all_users")
    title = data.get("title")
    body = data.get("body")
    extra_data = data.get("data", {})
    image_url = data.get("image_url")
    
    if not title or not body:
        raise HTTPException(status_code=400, detail="title and body required")
    
    result = await send_fcm_to_topic(
        topic=topic,
        title=title,
        body=body,
        data=extra_data,
        image_url=image_url
    )
    
    return result


@router.get("/admin/notification-stats")
async def get_notification_stats():
    """Get push notification statistics"""
    db = get_db()
    
    total_users = await db.app_users.count_documents({})
    users_with_fcm = await db.app_users.count_documents({
        "fcm_token": {"$exists": True, "$ne": None}
    })
    
    # Platform breakdown
    android_users = await db.app_users.count_documents({"push_platform": "android"})
    ios_users = await db.app_users.count_documents({"push_platform": "ios"})
    
    # Recent notifications
    recent_notifications = await db.push_notifications.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_users": total_users,
        "users_with_fcm_tokens": users_with_fcm,
        "coverage_percentage": round((users_with_fcm / total_users * 100) if total_users > 0 else 0, 1),
        "platform_breakdown": {
            "android": android_users,
            "ios": ios_users
        },
        "recent_notifications": recent_notifications
    }


# ============== FIREBASE CONFIG FOR MOBILE ==============

@router.get("/config")
async def get_firebase_config():
    """
    Return Firebase configuration for mobile app
    This is public but only returns non-sensitive config
    """
    return {
        "apiKey": "AIzaSyD_5EWohUb1rTuONZvyJIwGZQ3ettf29DE",
        "authDomain": "gracefyapp-824ff.firebaseapp.com",
        "projectId": "gracefyapp-824ff",
        "storageBucket": "gracefyapp-824ff.firebasestorage.app",
        "messagingSenderId": "478977168051",
        "appId": "1:478977168051:web:4a6f2e39ca9a29cbca96c6",
        "vapidKey": "BERvTaRmgaDvWYitKhhtTqsuZoW7QDPA3q2c2WTl7B30_k0oCl7isZuIH3tVksGDE2ODw9D-OfUs64PzG3EqVP8"
    }
