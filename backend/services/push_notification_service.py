"""
Push Notification Service for Gracefy
Sends push notifications to mobile app users via Expo Push API
Enhanced with delivery tracking and engagement analytics
"""

import httpx
import logging
import uuid
from typing import List, Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"


async def create_notification_record(db, notification_data: dict) -> str:
    """Create a notification record for tracking"""
    notification_id = f"notif_{uuid.uuid4().hex[:12]}"
    
    record = {
        "notification_id": notification_id,
        "title": notification_data.get("title"),
        "body": notification_data.get("body"),
        "type": notification_data.get("type", "general"),
        "campaign_id": notification_data.get("campaign_id"),
        "target_users": notification_data.get("target_users", []),
        "sent_count": 0,
        "delivered_count": 0,
        "opened_count": 0,
        "failed_count": 0,
        "expo_ticket_ids": [],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": None,
        "data": notification_data.get("data", {})
    }
    
    await db.push_notifications.insert_one(record)
    return notification_id


async def update_notification_stats(db, notification_id: str, updates: dict):
    """Update notification statistics"""
    await db.push_notifications.update_one(
        {"notification_id": notification_id},
        {"$set": updates}
    )


async def record_notification_sent(db, notification_id: str, user_id: str, expo_ticket_id: str = None):
    """Record that a notification was sent to a user"""
    await db.push_notification_events.insert_one({
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "notification_id": notification_id,
        "user_id": user_id,
        "event_type": "sent",
        "expo_ticket_id": expo_ticket_id,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


async def record_notification_opened(db, notification_id: str, user_id: str):
    """Record that a user opened/tapped a notification"""
    # Check if already recorded to avoid duplicates
    existing = await db.push_notification_events.find_one({
        "notification_id": notification_id,
        "user_id": user_id,
        "event_type": "opened"
    })
    
    if not existing:
        await db.push_notification_events.insert_one({
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "notification_id": notification_id,
            "user_id": user_id,
            "event_type": "opened",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Increment opened count
        await db.push_notifications.update_one(
            {"notification_id": notification_id},
            {"$inc": {"opened_count": 1}}
        )
        
        return True
    return False


async def send_push_notification(
    push_token: str,
    title: str,
    body: str,
    data: Optional[Dict] = None,
    badge: Optional[int] = None,
    sound: str = "default",
    notification_id: str = None
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
        notification_id: Tracking ID for analytics
    
    Returns:
        Response from Expo push API
    """
    if not push_token or not push_token.startswith("ExponentPushToken"):
        logger.warning(f"Invalid push token: {push_token}")
        return {"error": "Invalid push token"}
    
    # Add tracking data to payload
    tracking_data = data.copy() if data else {}
    if notification_id:
        tracking_data["notification_id"] = notification_id
        tracking_data["track_open"] = True
    
    message = {
        "to": push_token,
        "title": title,
        "body": body,
        "sound": sound,
        "data": tracking_data
    }
    
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
                # Extract ticket ID for receipt checking
                if "data" in result and result["data"].get("status") == "ok":
                    result["ticket_id"] = result["data"].get("id")
            else:
                logger.error(f"Failed to send push: {result}")
            
            return result
    except Exception as e:
        logger.error(f"Error sending push notification: {e}")
        return {"error": str(e)}


async def send_tracked_push_notification(
    db,
    push_token: str,
    user_id: str,
    title: str,
    body: str,
    notification_type: str = "general",
    data: Optional[Dict] = None,
    campaign_id: str = None
) -> Dict:
    """
    Send a push notification with full tracking
    """
    # Create notification record
    notification_id = await create_notification_record(db, {
        "title": title,
        "body": body,
        "type": notification_type,
        "campaign_id": campaign_id,
        "target_users": [user_id],
        "data": data
    })
    
    # Send the notification
    result = await send_push_notification(
        push_token=push_token,
        title=title,
        body=body,
        data=data,
        notification_id=notification_id
    )
    
    # Update stats
    if "error" not in result:
        await update_notification_stats(db, notification_id, {
            "sent_count": 1,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "sent"
        })
        
        # Record sent event
        ticket_id = result.get("ticket_id") or (result.get("data", {}).get("id") if isinstance(result.get("data"), dict) else None)
        await record_notification_sent(db, notification_id, user_id, ticket_id)
    else:
        await update_notification_stats(db, notification_id, {
            "failed_count": 1,
            "status": "failed",
            "error": result.get("error")
        })
    
    result["notification_id"] = notification_id
    return result


async def send_bulk_push_notifications(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict] = None,
    notification_id: str = None
) -> Dict:
    """
    Send push notifications to multiple devices
    """
    # Filter valid tokens
    valid_tokens = [t for t in tokens if t and t.startswith("ExponentPushToken")]
    
    if not valid_tokens:
        return {"success": False, "error": "No valid push tokens", "sent": 0}
    
    # Add tracking data
    tracking_data = data.copy() if data else {}
    if notification_id:
        tracking_data["notification_id"] = notification_id
        tracking_data["track_open"] = True
    
    # Expo allows batches of 100
    batch_size = 100
    results = []
    ticket_ids = []
    
    for i in range(0, len(valid_tokens), batch_size):
        batch = valid_tokens[i:i + batch_size]
        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "sound": "default",
                "data": tracking_data
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
                
                # Collect ticket IDs
                if "data" in batch_result:
                    for item in batch_result["data"]:
                        if item.get("status") == "ok" and item.get("id"):
                            ticket_ids.append(item["id"])
                
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
        "total_tokens": len(valid_tokens),
        "ticket_ids": ticket_ids,
        "notification_id": notification_id
    }


async def send_tracked_bulk_notifications(
    db,
    users: List[Dict],  # List of {user_id, push_token}
    title: str,
    body: str,
    notification_type: str = "campaign",
    data: Optional[Dict] = None,
    campaign_id: str = None
) -> Dict:
    """
    Send bulk notifications with full tracking
    """
    user_ids = [u["user_id"] for u in users]
    tokens = [u["push_token"] for u in users if u.get("push_token")]
    
    # Create notification record
    notification_id = await create_notification_record(db, {
        "title": title,
        "body": body,
        "type": notification_type,
        "campaign_id": campaign_id,
        "target_users": user_ids,
        "data": data
    })
    
    # Send notifications
    result = await send_bulk_push_notifications(
        tokens=tokens,
        title=title,
        body=body,
        data=data,
        notification_id=notification_id
    )
    
    # Update stats
    await update_notification_stats(db, notification_id, {
        "sent_count": result.get("sent", 0),
        "failed_count": result.get("failed", 0),
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "status": "sent" if result.get("sent", 0) > 0 else "failed",
        "expo_ticket_ids": result.get("ticket_ids", [])
    })
    
    return result


async def check_delivery_receipts(db, ticket_ids: List[str]) -> Dict:
    """
    Check delivery receipts from Expo for sent notifications
    Call this after some time to verify delivery
    """
    if not ticket_ids:
        return {"checked": 0}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_RECEIPTS_URL,
                json={"ids": ticket_ids},
                headers={"Content-Type": "application/json"}
            )
            result = response.json()
            
            delivered = 0
            failed = 0
            
            for ticket_id, receipt in result.get("data", {}).items():
                if receipt.get("status") == "ok":
                    delivered += 1
                else:
                    failed += 1
                    logger.warning(f"Delivery failed for {ticket_id}: {receipt}")
            
            return {
                "checked": len(ticket_ids),
                "delivered": delivered,
                "failed": failed,
                "receipts": result.get("data", {})
            }
    except Exception as e:
        logger.error(f"Error checking receipts: {e}")
        return {"error": str(e)}


async def get_notification_analytics(db, notification_id: str = None, days: int = 7) -> Dict:
    """
    Get notification analytics
    """
    from datetime import timedelta
    
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    query = {"created_at": {"$gte": cutoff}}
    if notification_id:
        query["notification_id"] = notification_id
    
    # Get notification stats
    notifications = await db.push_notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    total_sent = sum(n.get("sent_count", 0) for n in notifications)
    total_opened = sum(n.get("opened_count", 0) for n in notifications)
    total_failed = sum(n.get("failed_count", 0) for n in notifications)
    
    open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0
    
    return {
        "period_days": days,
        "total_notifications": len(notifications),
        "total_sent": total_sent,
        "total_opened": total_opened,
        "total_failed": total_failed,
        "open_rate": round(open_rate, 2),
        "notifications": notifications[:20]  # Return last 20 for detail view
    }


# ============== SPECIFIC NOTIFICATION TYPES ==============

async def send_payment_success_notification(db, user_id: str, plan_name: str, amount: float):
    """Send notification when payment is successful"""
    user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0, "push_token": 1, "name": 1})
    
    if not user or not user.get("push_token"):
        logger.info(f"No push token for user {user_id}")
        return None
    
    user_name = user.get("name", "")
    first_name = user_name.split()[0] if user_name else "Karibu"
    
    return await send_tracked_push_notification(
        db=db,
        push_token=user["push_token"],
        user_id=user_id,
        title="Malipo Yamekamilika! 🎉",
        body=f"{first_name}, usajili wako wa {plan_name} umefanikiwa. Furahia muziki wote!",
        notification_type="payment_success",
        data={
            "type": "payment_success",
            "plan_name": plan_name,
            "amount": amount,
            "action": "open_app"
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
    
    return await send_tracked_push_notification(
        db=db,
        push_token=user["push_token"],
        user_id=user_id,
        title="Usajili Unaisha!",
        body=body,
        notification_type="subscription_expiring",
        data={
            "type": "subscription_expiring",
            "days_remaining": days_remaining,
            "action": "open_subscription"
        }
    )


async def send_new_content_notification(db, title: str, body: str, content_type: str, content_id: str):
    """Send notification about new content to all users with push tokens"""
    # Get all users with push tokens
    cursor = db.app_users.find(
        {"push_token": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 1, "push_token": 1}
    )
    
    users = await cursor.to_list(100000)
    
    if not users:
        logger.info("No users with push tokens for new content notification")
        return {"sent": 0}
    
    return await send_tracked_bulk_notifications(
        db=db,
        users=users,
        title=title,
        body=body,
        notification_type="new_content",
        data={
            "type": "new_content",
            "content_type": content_type,
            "content_id": content_id,
            "action": f"open_{content_type}"
        }
    )
