"""
Firebase Service for Gracefy
Handles Firebase Admin SDK initialization, authentication, and FCM notifications
"""

import firebase_admin
from firebase_admin import credentials, auth, messaging
import logging
import os
from typing import Optional, Dict, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Firebase app instance
_firebase_app = None

def get_firebase_app():
    """Get or initialize Firebase Admin SDK"""
    global _firebase_app
    
    if _firebase_app is not None:
        return _firebase_app
    
    # Check if already initialized
    if firebase_admin._apps:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    
    try:
        # Get the path to the service account file
        cred_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'firebase-admin.json')
        
        if not os.path.exists(cred_path):
            logger.error(f"Firebase credentials file not found at {cred_path}")
            return None
        
        cred = credentials.Certificate(cred_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized successfully")
        return _firebase_app
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        return None


# ============== AUTHENTICATION ==============

async def verify_firebase_token(id_token: str) -> Optional[Dict]:
    """
    Verify a Firebase ID token and return the decoded token
    
    Args:
        id_token: The Firebase ID token from the client
        
    Returns:
        Decoded token dict with user info, or None if invalid
    """
    app = get_firebase_app()
    if not app:
        logger.error("Firebase not initialized")
        return None
    
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except auth.ExpiredIdTokenError:
        logger.warning("Firebase token expired")
        return None
    except auth.RevokedIdTokenError:
        logger.warning("Firebase token revoked")
        return None
    except auth.InvalidIdTokenError as e:
        logger.warning(f"Invalid Firebase token: {e}")
        return None
    except Exception as e:
        logger.error(f"Error verifying Firebase token: {e}")
        return None


async def get_firebase_user(uid: str) -> Optional[Dict]:
    """Get Firebase user by UID"""
    app = get_firebase_app()
    if not app:
        return None
    
    try:
        user = auth.get_user(uid)
        return {
            "uid": user.uid,
            "email": user.email,
            "email_verified": user.email_verified,
            "display_name": user.display_name,
            "photo_url": user.photo_url,
            "phone_number": user.phone_number,
            "disabled": user.disabled,
            "provider_data": [
                {
                    "provider_id": p.provider_id,
                    "uid": p.uid,
                    "email": p.email,
                    "display_name": p.display_name,
                    "photo_url": p.photo_url
                }
                for p in user.provider_data
            ]
        }
    except auth.UserNotFoundError:
        logger.warning(f"Firebase user not found: {uid}")
        return None
    except Exception as e:
        logger.error(f"Error getting Firebase user: {e}")
        return None


async def create_firebase_user(email: str, password: str, display_name: str = None) -> Optional[Dict]:
    """Create a new Firebase user"""
    app = get_firebase_app()
    if not app:
        return None
    
    try:
        user = auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
            email_verified=False
        )
        return {
            "uid": user.uid,
            "email": user.email,
            "display_name": user.display_name
        }
    except auth.EmailAlreadyExistsError:
        logger.warning(f"Email already exists: {email}")
        return {"error": "email_exists"}
    except Exception as e:
        logger.error(f"Error creating Firebase user: {e}")
        return {"error": str(e)}


async def delete_firebase_user(uid: str) -> bool:
    """Delete a Firebase user"""
    app = get_firebase_app()
    if not app:
        return False
    
    try:
        auth.delete_user(uid)
        logger.info(f"Deleted Firebase user: {uid}")
        return True
    except auth.UserNotFoundError:
        logger.warning(f"Firebase user not found for deletion: {uid}")
        return False
    except Exception as e:
        logger.error(f"Error deleting Firebase user: {e}")
        return False


async def set_custom_claims(uid: str, claims: Dict) -> bool:
    """Set custom claims for a Firebase user (e.g., admin role)"""
    app = get_firebase_app()
    if not app:
        return False
    
    try:
        auth.set_custom_user_claims(uid, claims)
        logger.info(f"Set custom claims for user {uid}: {claims}")
        return True
    except Exception as e:
        logger.error(f"Error setting custom claims: {e}")
        return False


# ============== FCM PUSH NOTIFICATIONS ==============

async def send_fcm_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    image_url: Optional[str] = None
) -> Dict:
    """
    Send a push notification to a single device via FCM
    
    Args:
        token: FCM device token
        title: Notification title
        body: Notification body
        data: Optional data payload
        image_url: Optional image URL for notification
        
    Returns:
        Result dict with success status and message_id
    """
    app = get_firebase_app()
    if not app:
        return {"success": False, "error": "Firebase not initialized"}
    
    if not token:
        return {"success": False, "error": "No FCM token provided"}
    
    try:
        # Build the notification
        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url
        )
        
        # Build the message
        message = messaging.Message(
            notification=notification,
            data=data or {},
            token=token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    priority='high',
                    channel_id='default'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1
                    )
                )
            )
        )
        
        # Send the message
        response = messaging.send(message)
        logger.info(f"FCM notification sent successfully: {response}")
        
        return {
            "success": True,
            "message_id": response
        }
    except messaging.UnregisteredError:
        logger.warning(f"FCM token unregistered: {token[:20]}...")
        return {"success": False, "error": "token_unregistered", "should_remove_token": True}
    except messaging.SenderIdMismatchError:
        logger.error("FCM sender ID mismatch")
        return {"success": False, "error": "sender_id_mismatch"}
    except Exception as e:
        logger.error(f"Error sending FCM notification: {e}")
        return {"success": False, "error": str(e)}


async def send_fcm_multicast(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict] = None,
    image_url: Optional[str] = None
) -> Dict:
    """
    Send push notifications to multiple devices via FCM
    
    Args:
        tokens: List of FCM device tokens
        title: Notification title
        body: Notification body
        data: Optional data payload
        image_url: Optional image URL
        
    Returns:
        Result dict with success/failure counts
    """
    app = get_firebase_app()
    if not app:
        return {"success": False, "error": "Firebase not initialized"}
    
    if not tokens:
        return {"success": False, "error": "No tokens provided", "sent": 0, "failed": 0}
    
    # Filter valid tokens
    valid_tokens = [t for t in tokens if t and len(t) > 10]
    
    if not valid_tokens:
        return {"success": False, "error": "No valid tokens", "sent": 0, "failed": 0}
    
    try:
        # Build the notification
        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url
        )
        
        # Build the multicast message
        message = messaging.MulticastMessage(
            notification=notification,
            data=data or {},
            tokens=valid_tokens,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    priority='high',
                    channel_id='default'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        badge=1
                    )
                )
            )
        )
        
        # Send the multicast
        response = messaging.send_each_for_multicast(message)
        
        # Collect failed tokens for cleanup
        failed_tokens = []
        for idx, result in enumerate(response.responses):
            if not result.success:
                failed_tokens.append({
                    "token": valid_tokens[idx][:20] + "...",
                    "error": str(result.exception) if result.exception else "Unknown error"
                })
        
        logger.info(f"FCM multicast sent: {response.success_count} success, {response.failure_count} failed")
        
        return {
            "success": True,
            "sent": response.success_count,
            "failed": response.failure_count,
            "total": len(valid_tokens),
            "failed_tokens": failed_tokens[:10]  # Return first 10 failures for debugging
        }
    except Exception as e:
        logger.error(f"Error sending FCM multicast: {e}")
        return {"success": False, "error": str(e), "sent": 0, "failed": len(valid_tokens)}


async def send_fcm_to_topic(
    topic: str,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    image_url: Optional[str] = None
) -> Dict:
    """
    Send a push notification to a topic (all subscribed devices)
    
    Args:
        topic: Topic name (e.g., "new_releases", "premium_users")
        title: Notification title
        body: Notification body
        data: Optional data payload
        image_url: Optional image URL
    """
    app = get_firebase_app()
    if not app:
        return {"success": False, "error": "Firebase not initialized"}
    
    try:
        notification = messaging.Notification(
            title=title,
            body=body,
            image=image_url
        )
        
        message = messaging.Message(
            notification=notification,
            data=data or {},
            topic=topic,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    priority='high',
                    channel_id='default'
                )
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default'
                    )
                )
            )
        )
        
        response = messaging.send(message)
        logger.info(f"FCM topic notification sent to {topic}: {response}")
        
        return {
            "success": True,
            "message_id": response,
            "topic": topic
        }
    except Exception as e:
        logger.error(f"Error sending FCM topic notification: {e}")
        return {"success": False, "error": str(e)}


async def subscribe_to_topic(tokens: List[str], topic: str) -> Dict:
    """Subscribe devices to a topic"""
    app = get_firebase_app()
    if not app:
        return {"success": False, "error": "Firebase not initialized"}
    
    try:
        response = messaging.subscribe_to_topic(tokens, topic)
        return {
            "success": True,
            "success_count": response.success_count,
            "failure_count": response.failure_count
        }
    except Exception as e:
        logger.error(f"Error subscribing to topic: {e}")
        return {"success": False, "error": str(e)}


async def unsubscribe_from_topic(tokens: List[str], topic: str) -> Dict:
    """Unsubscribe devices from a topic"""
    app = get_firebase_app()
    if not app:
        return {"success": False, "error": "Firebase not initialized"}
    
    try:
        response = messaging.unsubscribe_from_topic(tokens, topic)
        return {
            "success": True,
            "success_count": response.success_count,
            "failure_count": response.failure_count
        }
    except Exception as e:
        logger.error(f"Error unsubscribing from topic: {e}")
        return {"success": False, "error": str(e)}


# ============== TRACKED NOTIFICATIONS ==============

async def send_tracked_fcm_notification(
    db,
    token: str,
    user_id: str,
    title: str,
    body: str,
    notification_type: str = "general",
    data: Optional[Dict] = None,
    image_url: Optional[str] = None
) -> Dict:
    """
    Send an FCM notification with tracking in MongoDB
    """
    import uuid
    
    # Create notification record
    notification_id = f"notif_{uuid.uuid4().hex[:12]}"
    
    # Add tracking data
    tracking_data = data.copy() if data else {}
    tracking_data["notification_id"] = notification_id
    tracking_data["type"] = notification_type
    
    record = {
        "notification_id": notification_id,
        "title": title,
        "body": body,
        "type": notification_type,
        "target_users": [user_id],
        "sent_count": 0,
        "delivered_count": 0,
        "opened_count": 0,
        "failed_count": 0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": None,
        "data": tracking_data
    }
    
    await db.push_notifications.insert_one(record)
    
    # Send notification
    result = await send_fcm_notification(
        token=token,
        title=title,
        body=body,
        data=tracking_data,
        image_url=image_url
    )
    
    # Update record
    if result.get("success"):
        await db.push_notifications.update_one(
            {"notification_id": notification_id},
            {"$set": {
                "sent_count": 1,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "status": "sent",
                "message_id": result.get("message_id")
            }}
        )
    else:
        await db.push_notifications.update_one(
            {"notification_id": notification_id},
            {"$set": {
                "failed_count": 1,
                "status": "failed",
                "error": result.get("error")
            }}
        )
    
    result["notification_id"] = notification_id
    return result


async def send_tracked_fcm_multicast(
    db,
    users: List[Dict],  # [{user_id, fcm_token}, ...]
    title: str,
    body: str,
    notification_type: str = "campaign",
    data: Optional[Dict] = None,
    image_url: Optional[str] = None
) -> Dict:
    """
    Send FCM notifications to multiple users with tracking
    """
    import uuid
    
    user_ids = [u["user_id"] for u in users]
    tokens = [u.get("fcm_token") for u in users if u.get("fcm_token")]
    
    notification_id = f"notif_{uuid.uuid4().hex[:12]}"
    
    tracking_data = data.copy() if data else {}
    tracking_data["notification_id"] = notification_id
    tracking_data["type"] = notification_type
    
    record = {
        "notification_id": notification_id,
        "title": title,
        "body": body,
        "type": notification_type,
        "target_users": user_ids,
        "sent_count": 0,
        "failed_count": 0,
        "opened_count": 0,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.push_notifications.insert_one(record)
    
    # Send multicast
    result = await send_fcm_multicast(
        tokens=tokens,
        title=title,
        body=body,
        data=tracking_data,
        image_url=image_url
    )
    
    # Update record
    await db.push_notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {
            "sent_count": result.get("sent", 0),
            "failed_count": result.get("failed", 0),
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "sent" if result.get("sent", 0) > 0 else "failed"
        }}
    )
    
    result["notification_id"] = notification_id
    return result
