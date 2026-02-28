"""
Push Notification Service for Gracefy
Sends push notifications to mobile app users via Expo Push API
"""

import httpx
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push_notification(
    push_token: str,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    badge: Optional[int] = None,
    sound: str = "default"
) -> Dict:
    """
    Send a push notification to a single device
    
    Args:
        push_token: Expo push token (ExponentPushToken[xxx])
        title: Notification title
        body: Notification body message
        data: Optional data payload
        badge: Optional badge count
        sound: Sound to play ('default' or 'sound.wav')
    
    Returns:
        Response from Expo push API
    """
    if not push_token or not push_token.startswith("ExponentPushToken"):
        logger.warning(f"Invalid push token: {push_token}")
        return {"error": "Invalid push token"}
    
    message = {
        "to": push_token,
        "title": title,
        "body": body,
        "sound": sound,
    }
    
    if data:
        message["data"] = data
    
    if badge is not None:
        message["badge"] = badge
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=message,
                headers={"Content-Type": "application/json"}
            )
            result = response.json()
            
            if response.status_code == 200:
                logger.info(f"Push notification sent successfully to {push_token[:20]}...")
            else:
                logger.error(f"Failed to send push: {result}")
            
            return result
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return {"error": str(e)}


async def send_bulk_push_notifications(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict] = None
) -> Dict:
    """
    Send push notifications to multiple devices
    
    Args:
        tokens: List of Expo push tokens
        title: Notification title
        body: Notification body
        data: Optional data payload
    
    Returns:
        Summary of results
    """
    # Filter valid tokens
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    
    if not valid_tokens:
        return {"success": False, "error": "No valid push tokens", "sent": 0}
    
    # Expo allows batches of 100
    batch_size = 100
    results = []
    
    for i in range(0, len(valid_tokens), batch_size):
        batch = valid_tokens[i:i + batch_size]
        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "sound": "default",
                "data": data or {}
            }
            for token in batch
        ]
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=messages,
                    headers={"Content-Type": "application/json"}
                )
                batch_result = response.json()
                results.append(batch_result)
                logger.info(f"Sent batch of {len(batch)} push notifications")
        except Exception as e:
            logger.error(f"Error sending batch push: {e}")
            results.append({"error": str(e)})
    
    # Count successes and failures
    success_count = 0
    error_count = 0
    
    for result in results:
        if isinstance(result, dict) and "data" in result:
            for item in result.get("data", []):
                if item.get("status") == "ok":
                    success_count += 1
                else:
                    error_count += 1
    
    return {
        "success": True,
        "sent": success_count,
        "failed": error_count,
        "total_tokens": len(valid_tokens)
    }


async def send_payment_success_notification(db, user_id: str, plan_name: str, amount: float):
    """Send notification when payment is successful"""
    user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0, "push_token": 1, "name": 1})
    
    if not user or not user.get("push_token"):
        logger.info(f"No push token for user {user_id}")
        return None
    
    user_name = user.get("name", "")
    first_name = user_name.split()[0] if user_name else "Karibu"
    
    return await send_push_notification(
        push_token=user["push_token"],
        title="Malipo Yamekamilika! 🎉",
        body=f"{first_name}, usajili wako wa {plan_name} umefanikiwa. Furahia muziki wote!",
        data={
            "type": "payment_success",
            "plan_name": plan_name,
            "amount": amount
        }
    )


async def send_subscription_expiring_notification(db, user_id: str, days_remaining: int):
    """Send notification when subscription is about to expire"""
    user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0, "push_token": 1, "name": 1})
    
    if not user or not user.get("push_token"):
        return None
    
    user_name = user.get("name", "")
    first_name = user_name.split()[0] if user_name else ""
    
    if days_remaining == 1:
        body = f"{first_name}, usajili wako unaisha kesho! Huisha leo kuendelea kusikiliza."
    else:
        body = f"{first_name}, usajili wako unaisha siku {days_remaining}. Huisha sasa!"
    
    return await send_push_notification(
        push_token=user["push_token"],
        title="Usajili Unaisha!",
        body=body,
        data={
            "type": "subscription_expiring",
            "days_remaining": days_remaining
        }
    )


async def send_new_content_notification(db, title: str, body: str, content_type: str, content_id: str):
    """Send notification about new content to all users with push tokens"""
    # Get all users with push tokens
    cursor = db.app_users.find(
        {"push_token": {"$exists": True, "$ne": None}},
        {"_id": 0, "push_token": 1}
    )
    
    tokens = [user["push_token"] async for user in cursor]
    
    if not tokens:
        logger.info("No users with push tokens for new content notification")
        return {"sent": 0}
    
    return await send_bulk_push_notifications(
        tokens=tokens,
        title=title,
        body=body,
        data={
            "type": "new_content",
            "content_type": content_type,
            "content_id": content_id
        }
    )
