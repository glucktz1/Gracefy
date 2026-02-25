"""
SMS Service for Gracefy - MIA SMS Integration
Tanzania SMS provider: https://sms.mia.co.tz
"""

import os
import httpx
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# MIA SMS Configuration
MIA_SMS_API_TOKEN = os.environ.get("MIA_SMS_API_TOKEN", "")
MIA_SMS_HTTP_ENDPOINT = os.environ.get("MIA_SMS_HTTP_ENDPOINT", "https://sms.mia.co.tz/api/http/")
MIA_SMS_API_V3_ENDPOINT = os.environ.get("MIA_SMS_API_V3_ENDPOINT", "https://sms.mia.co.tz/api/v3/")
MIA_SMS_SENDER_ID = os.environ.get("MIA_SMS_SENDER_ID", "SPIRITSONG")
SMS_TEST_MODE = os.environ.get("SMS_TEST_MODE", "true").lower() == "true"


def normalize_phone_number(phone: str) -> str:
    """Normalize phone number to international format (+255...)"""
    phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    
    if phone.startswith("+"):
        return phone
    elif phone.startswith("255"):
        return "+" + phone
    elif phone.startswith("0"):
        return "+255" + phone[1:]
    else:
        return "+255" + phone


async def send_sms(
    phone: str,
    message: str,
    sender_id: Optional[str] = None,
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Send SMS via MIA SMS API
    
    Args:
        phone: Recipient phone number
        message: SMS message content
        sender_id: Optional sender ID (defaults to config)
        db: Optional database connection for logging
    
    Returns:
        Dict with status, message_id, and other details
    """
    phone = normalize_phone_number(phone)
    sender = sender_id or MIA_SMS_SENDER_ID
    
    result = {
        "success": False,
        "phone": phone,
        "message": message[:160],  # SMS limit
        "sender_id": sender,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "provider": "mia_sms",
        "test_mode": SMS_TEST_MODE
    }
    
    # Test mode - don't actually send SMS
    if SMS_TEST_MODE:
        logger.info(f"[SMS TEST MODE] To: {phone}, Message: {message[:50]}...")
        result["success"] = True
        result["message_id"] = f"test_sms_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        result["status"] = "test_sent"
        result["note"] = "SMS not actually sent - test mode enabled"
        
        # Log to database if available
        if db:
            await log_sms_to_db(db, result)
        
        return result
    
    # Production mode - send via MIA SMS API
    if not MIA_SMS_API_TOKEN:
        logger.error("MIA SMS API token not configured")
        result["error"] = "SMS service not configured"
        return result
    
    try:
        # Try HTTP API endpoint first
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Common bulk SMS API format
            # Format 1: Query parameters
            params = {
                "api_token": MIA_SMS_API_TOKEN,
                "to": phone,
                "from": sender,
                "message": message,
                "type": "plain"  # or "unicode" for special characters
            }
            
            response = await client.get(
                f"{MIA_SMS_HTTP_ENDPOINT}send",
                params=params
            )
            
            logger.info(f"MIA SMS Response: {response.status_code} - {response.text[:200]}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    result["success"] = data.get("status") in ["success", "sent", "queued", True, 1, "1"]
                    result["message_id"] = data.get("message_id") or data.get("id") or data.get("sms_id")
                    result["api_response"] = data
                except:
                    # Some APIs return plain text
                    result["success"] = "success" in response.text.lower() or "sent" in response.text.lower()
                    result["api_response"] = response.text
            else:
                result["error"] = f"API returned status {response.status_code}"
                result["api_response"] = response.text
                
    except httpx.TimeoutException:
        logger.error(f"SMS timeout for {phone}")
        result["error"] = "Request timeout"
    except Exception as e:
        logger.error(f"SMS error for {phone}: {str(e)}")
        result["error"] = str(e)
    
    # Log to database
    if db:
        await log_sms_to_db(db, result)
    
    return result


async def send_sms_v3(
    phone: str,
    message: str,
    sender_id: Optional[str] = None,
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Send SMS via MIA SMS API v3 (OAuth 2.0)
    Alternative endpoint with Bearer token authentication
    """
    phone = normalize_phone_number(phone)
    sender = sender_id or MIA_SMS_SENDER_ID
    
    result = {
        "success": False,
        "phone": phone,
        "message": message[:160],
        "sender_id": sender,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "provider": "mia_sms_v3",
        "test_mode": SMS_TEST_MODE
    }
    
    if SMS_TEST_MODE:
        logger.info(f"[SMS TEST MODE v3] To: {phone}, Message: {message[:50]}...")
        result["success"] = True
        result["message_id"] = f"test_v3_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        result["status"] = "test_sent"
        
        if db:
            await log_sms_to_db(db, result)
        return result
    
    if not MIA_SMS_API_TOKEN:
        result["error"] = "SMS service not configured"
        return result
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {MIA_SMS_API_TOKEN}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            payload = {
                "recipient": phone,
                "sender_id": sender,
                "message": message,
                "type": "plain"
            }
            
            response = await client.post(
                f"{MIA_SMS_API_V3_ENDPOINT}sms/send",
                headers=headers,
                json=payload
            )
            
            logger.info(f"MIA SMS v3 Response: {response.status_code} - {response.text[:200]}")
            
            if response.status_code in [200, 201]:
                try:
                    data = response.json()
                    result["success"] = data.get("status") in ["success", "sent", "queued", True]
                    result["message_id"] = data.get("message_id") or data.get("id")
                    result["api_response"] = data
                except:
                    result["success"] = "success" in response.text.lower()
                    result["api_response"] = response.text
            else:
                result["error"] = f"API returned status {response.status_code}"
                result["api_response"] = response.text
                
    except Exception as e:
        logger.error(f"SMS v3 error for {phone}: {str(e)}")
        result["error"] = str(e)
    
    if db:
        await log_sms_to_db(db, result)
    
    return result


async def send_otp_sms(phone: str, otp: str, db: Optional[Any] = None) -> Dict[str, Any]:
    """Send OTP verification SMS"""
    message = f"Nambari yako ya uthibitisho wa SpiritSongs ni: {otp}. Inaisha baada ya dakika 10."
    return await send_sms(phone, message, db=db)


async def send_welcome_sms(phone: str, name: str, db: Optional[Any] = None) -> Dict[str, Any]:
    """Send welcome SMS to new user"""
    message = f"Karibu {name}! Asante kwa kujiunga na SpiritSongs. Furahia muziki wa kiroho."
    return await send_sms(phone, message, db=db)


async def send_subscription_sms(
    phone: str, 
    plan_name: str, 
    expires_at: str,
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """Send subscription confirmation SMS"""
    message = f"Umejisajili kwa mpango wa {plan_name}. Unaisha: {expires_at}. Asante!"
    return await send_sms(phone, message, db=db)


async def send_bulk_sms(
    recipients: list,
    message: str,
    sender_id: Optional[str] = None,
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """Send SMS to multiple recipients"""
    results = {
        "total": len(recipients),
        "success": 0,
        "failed": 0,
        "details": []
    }
    
    for phone in recipients:
        result = await send_sms(phone, message, sender_id, db)
        if result.get("success"):
            results["success"] += 1
        else:
            results["failed"] += 1
        results["details"].append(result)
    
    return results


async def log_sms_to_db(db, sms_result: Dict[str, Any]):
    """Log SMS to database for tracking"""
    try:
        import uuid
        sms_log = {
            "sms_id": f"sms_{uuid.uuid4().hex[:12]}",
            **sms_result,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.sms_logs.insert_one(sms_log)
    except Exception as e:
        logger.error(f"Failed to log SMS: {e}")


async def get_sms_balance() -> Dict[str, Any]:
    """Check SMS credit balance"""
    if SMS_TEST_MODE:
        return {"balance": 1000, "test_mode": True}
    
    if not MIA_SMS_API_TOKEN:
        return {"error": "SMS service not configured"}
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Try common balance endpoint patterns
            params = {"api_token": MIA_SMS_API_TOKEN}
            response = await client.get(
                f"{MIA_SMS_HTTP_ENDPOINT}balance",
                params=params
            )
            
            if response.status_code == 200:
                try:
                    return response.json()
                except:
                    return {"response": response.text}
            else:
                return {"error": f"API returned {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}


# SMS Settings for admin
def get_sms_settings() -> Dict[str, Any]:
    """Get current SMS configuration (safe for display)"""
    return {
        "provider": "MIA SMS",
        "http_endpoint": MIA_SMS_HTTP_ENDPOINT,
        "api_v3_endpoint": MIA_SMS_API_V3_ENDPOINT,
        "sender_id": MIA_SMS_SENDER_ID,
        "test_mode": SMS_TEST_MODE,
        "configured": bool(MIA_SMS_API_TOKEN)
    }
