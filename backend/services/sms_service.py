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


async def try_sms_endpoint(client: httpx.AsyncClient, endpoint: str, method: str, **kwargs) -> Dict[str, Any]:
    """Try sending SMS to a specific endpoint"""
    try:
        if method == "GET":
            response = await client.get(endpoint, **kwargs)
        else:
            response = await client.post(endpoint, **kwargs)
        
        return {
            "status_code": response.status_code,
            "text": response.text[:500],
            "success": response.status_code in [200, 201, 202]
        }
    except Exception as e:
        return {"error": str(e), "success": False}


async def send_sms(
    phone: str,
    message: str,
    sender_id: Optional[str] = None,
    db: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Send SMS via MIA SMS API
    Tries multiple common API formats
    """
    phone = normalize_phone_number(phone)
    sender = sender_id or MIA_SMS_SENDER_ID
    
    result = {
        "success": False,
        "phone": phone,
        "message": message[:160],
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
        
        if db is not None:
            await log_sms_to_db(db, result)
        
        return result
    
    # Production mode - send via MIA SMS API
    if not MIA_SMS_API_TOKEN:
        logger.error("MIA SMS API token not configured")
        result["error"] = "SMS service not configured"
        return result
    
    base_url = MIA_SMS_HTTP_ENDPOINT.rstrip('/')
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Try multiple endpoint formats commonly used by bulk SMS providers
        
        # Format 1: Query params with api_token (common for many bulk SMS providers)
        endpoints_to_try = [
            # SMS Gateways often use these patterns
            {
                "name": "sms/send POST JSON with api_token",
                "method": "POST",
                "url": f"{base_url}/sms/send",
                "headers": {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                "json": {
                    "api_token": MIA_SMS_API_TOKEN,
                    "recipient": phone,
                    "sender_id": sender,
                    "message": message
                }
            },
            {
                "name": "sms/send POST JSON Bearer",
                "method": "POST",
                "url": f"{base_url}/sms/send",
                "headers": {
                    "Authorization": f"Bearer {MIA_SMS_API_TOKEN}",
                    "Content-Type": "application/json"
                },
                "json": {
                    "recipient": phone,
                    "sender_id": sender,
                    "message": message,
                    "to": phone,
                    "from": sender
                }
            },
            {
                "name": "sms POST JSON with api_key header",
                "method": "POST",
                "url": f"{base_url}/sms",
                "headers": {
                    "api-key": MIA_SMS_API_TOKEN,
                    "Content-Type": "application/json"
                },
                "json": {
                    "to": phone,
                    "from": sender,
                    "message": message
                }
            },
            {
                "name": "send GET with api_token param",
                "method": "GET",
                "url": f"{base_url}/send",
                "params": {
                    "api_token": MIA_SMS_API_TOKEN,
                    "to": phone,
                    "from": sender,
                    "message": message,
                    "type": "plain"
                }
            },
            {
                "name": "sms/send GET params",
                "method": "GET",
                "url": f"{base_url}/sms/send",
                "params": {
                    "api_token": MIA_SMS_API_TOKEN,
                    "recipient": phone,
                    "sender_id": sender,
                    "message": message
                }
            },
            {
                "name": "sendsms POST form data",
                "method": "POST",
                "url": f"{base_url}/sendsms",
                "data": {
                    "api_token": MIA_SMS_API_TOKEN,
                    "to": phone,
                    "from": sender,
                    "message": message
                }
            },
            # Ultimate SMS format
            {
                "name": "campaign/send POST JSON",
                "method": "POST",
                "url": f"{base_url}/campaign/send",
                "headers": {
                    "Authorization": f"Bearer {MIA_SMS_API_TOKEN}",
                    "Content-Type": "application/json"
                },
                "json": {
                    "phone_number": phone,
                    "sender_id": sender,
                    "message": message,
                    "sms_type": "plain"
                }
            },
            # Generic send endpoint with query params
            {
                "name": "direct GET params",
                "method": "GET",
                "url": base_url,
                "params": {
                    "api_token": MIA_SMS_API_TOKEN,
                    "action": "send",
                    "to": phone,
                    "from": sender,
                    "message": message
                }
            }
        ]
        
        for endpoint in endpoints_to_try:
            try:
                kwargs = {}
                if "headers" in endpoint:
                    kwargs["headers"] = endpoint["headers"]
                if "params" in endpoint:
                    kwargs["params"] = endpoint["params"]
                if "json" in endpoint:
                    kwargs["json"] = endpoint["json"]
                if "data" in endpoint:
                    kwargs["data"] = endpoint["data"]
                
                resp = await try_sms_endpoint(client, endpoint["url"], endpoint["method"], **kwargs)
                
                logger.info(f"[SMS] Tried {endpoint['name']}: {resp.get('status_code', 'error')} - {resp.get('text', resp.get('error', ''))[:100]}")
                
                if resp.get("success"):
                    # Check if response indicates success
                    text = resp.get("text", "").lower()
                    if any(word in text for word in ["success", "sent", "queued", "ok", "accepted"]):
                        result["success"] = True
                        result["endpoint_used"] = endpoint["name"]
                        try:
                            import json
                            data = json.loads(resp.get("text", "{}"))
                            result["message_id"] = data.get("message_id") or data.get("id") or data.get("sms_id")
                            result["api_response"] = data
                        except:
                            result["api_response"] = resp.get("text")
                        break
                    elif "404" not in text and "not found" not in text:
                        # This endpoint exists but might have different success criteria
                        result["endpoint_responded"] = endpoint["name"]
                        result["api_response"] = resp.get("text")
                        
            except Exception as e:
                logger.error(f"[SMS] Error with {endpoint['name']}: {str(e)}")
                continue
        
        if not result["success"]:
            result["error"] = "All SMS endpoint attempts failed"
            result["note"] = "Please verify API token and endpoint configuration with MIA SMS provider"
    
    # Log to database
    if db is not None:
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
        
        if db is not None:
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
