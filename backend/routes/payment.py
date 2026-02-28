"""
Payment routes for Gracefy - Azam Pay integration.
Handles mobile money payments for subscriptions.
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging
import uuid
import os

from core.database import get_db
from core.cache import cache
from models.schemas import Transaction

# Import push notification service
try:
    from services.push_notification_service import send_payment_success_notification
except ImportError:
    send_payment_success_notification = None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["payment"])

# MNO detection by phone prefix
MNO_PREFIXES = {
    'Vodacom': ['74', '75', '76'],
    'Tigo': ['65', '67', '71'],
    'Airtel': ['68', '69', '78', '79'],
    'Halotel': ['62'],
    'TTCL': ['73'],
    'Zantel': ['77'],
}


def normalize_phone_tz(phone: str) -> str:
    """Normalize Tanzanian phone number to +255XXXXXXXXX format."""
    phone = ''.join(c for c in phone if c.isdigit() or c == '+')
    if phone.startswith('+255'):
        return phone
    elif phone.startswith('255'):
        return '+' + phone
    elif phone.startswith('0'):
        return '+255' + phone[1:]
    else:
        raise ValueError(f"Invalid Tanzanian phone format: {phone}")


def get_mno_from_phone(phone: str) -> str:
    """Detect MNO from Tanzanian phone number prefix."""
    normalized = normalize_phone_tz(phone)
    prefix = normalized[4:6]  # Get first 2 digits after +255
    
    for mno, prefixes in MNO_PREFIXES.items():
        if prefix in prefixes:
            return mno
    
    return 'Vodacom'  # Default


# Default subscription plans
DEFAULT_PLANS = {
    "plan_daily": {"plan_id": "plan_daily", "name": "daily", "display_name": "Siku 1", "price": 500, "duration_days": 1},
    "plan_weekly": {"plan_id": "plan_weekly", "name": "weekly", "display_name": "Wiki 1", "price": 2000, "duration_days": 7},
    "plan_monthly": {"plan_id": "plan_monthly", "name": "monthly", "display_name": "Mwezi 1", "price": 5000, "duration_days": 30},
    "plan_yearly": {"plan_id": "plan_yearly", "name": "yearly", "display_name": "Mwaka 1", "price": 50000, "duration_days": 365}
}


@router.post("/payment/azampay/checkout")
async def azampay_checkout(data: dict):
    """
    Initiate Azam Pay mobile money checkout.
    User receives USSD prompt on their phone to authorize payment.
    """
    db = get_db()
    
    user_id = data.get("user_id")
    plan_id = data.get("plan_id")
    phone_number = data.get("phone_number")
    
    if not all([user_id, plan_id, phone_number]):
        raise HTTPException(status_code=400, detail="Missing required fields: user_id, plan_id, phone_number")
    
    # Normalize phone number
    try:
        normalized_phone = normalize_phone_tz(phone_number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Detect MNO
    mno = get_mno_from_phone(normalized_phone)
    
    # Get subscription plan
    plan = await db.subscription_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        plan = DEFAULT_PLANS.get(plan_id)
    
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Get user info
    user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0})
    
    # Generate unique external reference
    external_id = f"GRC{uuid.uuid4().hex[:12].upper()}"
    
    # Create transaction record
    txn = Transaction(
        user_id=user_id,
        user_email=user.get("email") if user else None,
        user_phone=normalized_phone,
        gateway_id="azampay",
        gateway_name=f"Azam Pay ({mno})",
        gateway_type="mobile_money",
        payment_method="azampay",
        amount=plan["price"],
        currency="TZS",
        amount_usd=round(plan["price"] / 2500, 2),
        plan_id=plan_id,
        plan_name=plan.get("display_name", plan.get("name", "Premium")),
        plan_duration_days=plan.get("duration_days", 30),
        status="pending",
        phone_number=normalized_phone,
        external_ref=external_id,
        initiated_at=datetime.now(timezone.utc).isoformat()
    )
    
    doc = txn.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["mno"] = mno
    await db.transactions.insert_one(doc)
    
    # Check test mode
    use_test_mode = os.environ.get("AZAMPAY_TEST_MODE", "true").lower() == "true"
    
    if use_test_mode:
        logger.info(f"[TEST MODE] Simulating Azam Pay checkout for {normalized_phone}")
        
        await db.transactions.update_one(
            {"transaction_id": doc["transaction_id"]},
            {"$set": {"azampay_test_mode": True}}
        )
        
        return {
            "success": True,
            "transaction_id": doc["transaction_id"],
            "external_id": external_id,
            "amount": plan["price"],
            "currency": "TZS",
            "mno": mno,
            "phone": normalized_phone,
            "message": f"[DEMO] Thibitisha malipo kwenye simu yako ya {mno}. Utapokea ujumbe wa USSD.",
            "message_en": f"[DEMO] Confirm payment on your {mno} phone.",
            "status": "pending",
            "test_mode": True,
        }
    
    # Production mode - Call Azam Pay API
    try:
        from azampay import Azampay
        
        azampay_client = Azampay(
            app_name="Gracefy",
            client_id=os.environ.get("AZAMPAY_CLIENT_ID"),
            client_secret=os.environ.get("AZAMPAY_CLIENT_SECRET"),
            x_api_key=os.environ.get("AZAMPAY_TOKEN"),
            sandbox=False
        )
        
        checkout_response = azampay_client.mobile_checkout(
            amount=int(plan["price"]),
            mobile=normalized_phone.replace("+", ""),
            external_id=external_id,
            provider=mno
        )
        
        logger.info(f"Azam Pay checkout response: {checkout_response}")
        
        await db.transactions.update_one(
            {"transaction_id": doc["transaction_id"]},
            {"$set": {
                "azampay_response": checkout_response,
                "azampay_txn_id": checkout_response.get("transactionId")
            }}
        )
        
        return {
            "success": True,
            "transaction_id": doc["transaction_id"],
            "external_id": external_id,
            "amount": plan["price"],
            "currency": "TZS",
            "mno": mno,
            "phone": normalized_phone,
            "message": f"Thibitisha malipo kwenye simu yako ya {mno}. Utapokea ujumbe wa USSD.",
            "status": "pending"
        }
        
    except Exception as e:
        logger.error(f"Azam Pay checkout error: {str(e)}")
        
        await db.transactions.update_one(
            {"transaction_id": doc["transaction_id"]},
            {"$set": {"status": "failed", "failure_reason": str(e)}}
        )
        
        raise HTTPException(
            status_code=500,
            detail=f"Payment initiation failed. Please try again."
        )


@router.post("/payment/callback/azampay")
async def azampay_callback(request: Request):
    """Handle Azam Pay payment callback/webhook."""
    db = get_db()
    
    try:
        body = await request.json()
        logger.info(f"Azam Pay callback received: {body}")
        
        external_id = body.get("utilityref") or body.get("externalId") or body.get("reference")
        transaction_status = body.get("transactionstatus", "").lower()
        azam_txn_id = body.get("transactionId") or body.get("mnoreference")
        message = body.get("message", "")
        
        if not external_id:
            logger.error("Azam Pay callback missing external_id")
            return {"received": True, "error": "Missing reference"}
        
        txn = await db.transactions.find_one({"external_ref": external_id}, {"_id": 0})
        if not txn:
            logger.error(f"Transaction not found for external_id: {external_id}")
            return {"received": True, "error": "Transaction not found"}
        
        # Map status
        status_map = {
            "success": "completed",
            "successful": "completed",
            "completed": "completed",
            "failed": "failed",
            "failure": "failed",
            "cancelled": "cancelled",
        }
        payment_status = status_map.get(transaction_status, "pending")
        
        update_data = {
            "status": payment_status,
            "azampay_callback": body,
            "callback_received_at": datetime.now(timezone.utc).isoformat()
        }
        
        if azam_txn_id:
            update_data["azampay_txn_id"] = azam_txn_id
        
        if payment_status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            
            # Activate subscription
            user_id = txn["user_id"]
            plan_duration = txn["plan_duration_days"]
            plan_name = txn["plan_name"]
            expires_at = (datetime.now(timezone.utc) + timedelta(days=plan_duration)).isoformat()
            
            await db.app_users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "subscription.status": "active",
                    "subscription.plan_id": txn["plan_id"],
                    "subscription.plan_name": plan_name,
                    "subscription.started_at": datetime.now(timezone.utc).isoformat(),
                    "subscription.expires_at": expires_at,
                    "subscription.last_payment_id": txn["transaction_id"],
                    "is_premium": True
                }}
            )
            
            # Get user details for notification
            user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
            user_name = user.get("name") or user.get("email") or user.get("phone", "Unknown User")
            
            # Create admin notification for successful payment
            await db.admin_notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "type": "payment_success",
                "title": "New Payment Received!",
                "message": f"{user_name} subscribed to {plan_name} - {txn.get('amount', 0):,.0f} TZS",
                "data": {
                    "user_id": user_id,
                    "user_name": user_name,
                    "plan_name": plan_name,
                    "amount": txn.get("amount", 0),
                    "transaction_id": txn["transaction_id"]
                },
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            logger.info(f"Subscription activated for user {user_id}")
        
        elif payment_status == "failed":
            update_data["failure_reason"] = message or "Payment failed"
        
        await db.transactions.update_one(
            {"transaction_id": txn["transaction_id"]},
            {"$set": update_data}
        )
        
        return {"received": True, "status": "processed", "payment_status": payment_status}
        
    except Exception as e:
        logger.error(f"Azam Pay callback error: {str(e)}")
        return {"received": True, "error": str(e)}


@router.get("/payment/azampay/status/{transaction_id}")
async def azampay_status(transaction_id: str):
    """Check Azam Pay transaction status."""
    db = get_db()
    
    txn = await db.transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {
        "transaction_id": txn["transaction_id"],
        "external_id": txn.get("external_ref"),
        "status": txn["status"],
        "amount": txn["amount"],
        "currency": txn["currency"],
        "phone": txn.get("phone_number"),
        "mno": txn.get("mno"),
        "plan": txn["plan_name"],
        "initiated_at": txn.get("initiated_at"),
        "completed_at": txn.get("completed_at"),
        "failure_reason": txn.get("failure_reason"),
        "test_mode": txn.get("azampay_test_mode", False)
    }


@router.post("/payment/azampay/test-confirm/{transaction_id}")
async def azampay_test_confirm(transaction_id: str, data: dict = None):
    """[TEST MODE] Simulate payment confirmation."""
    db = get_db()
    
    txn = await db.transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if not txn.get("azampay_test_mode"):
        raise HTTPException(status_code=400, detail="Only for test mode transactions")
    
    if txn.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Transaction already processed: {txn.get('status')}")
    
    action = (data or {}).get("action", "confirm")
    
    if action == "confirm":
        update_data = {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "azampay_txn_id": f"TEST_{uuid.uuid4().hex[:8].upper()}"
        }
        
        await db.transactions.update_one(
            {"transaction_id": transaction_id},
            {"$set": update_data}
        )
        
        # Activate subscription
        user_id = txn["user_id"]
        expires_at = (datetime.now(timezone.utc) + timedelta(days=txn["plan_duration_days"])).isoformat()
        
        await db.app_users.update_one(
            {"user_id": user_id},
            {"$set": {
                "subscription.status": "active",
                "subscription.plan_id": txn["plan_id"],
                "subscription.plan_name": txn["plan_name"],
                "subscription.started_at": datetime.now(timezone.utc).isoformat(),
                "subscription.expires_at": expires_at,
                "subscription.last_payment_id": transaction_id,
                "is_premium": True
            }}
        )
        
        # Get user details for notification
        user = await db.app_users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        user_name = user.get("name") or user.get("email") or user.get("phone", "Unknown User")
        plan_name = txn["plan_name"]
        
        # Create admin notification for successful payment
        await db.admin_notifications.insert_one({
            "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
            "type": "payment_success",
            "title": "New Payment Received!",
            "message": f"{user_name} subscribed to {plan_name} - {txn.get('amount', 0):,.0f} TZS",
            "data": {
                "user_id": user_id,
                "user_name": user_name,
                "plan_name": plan_name,
                "amount": txn.get("amount", 0),
                "transaction_id": transaction_id,
                "test_mode": True
            },
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"[TEST] Subscription activated for user {user_id}, notification created")
        
        return {
            "success": True,
            "message": "Malipo yamekamilika! Akaunti yako imefunguliwa.",
            "status": "completed",
            "expires_at": expires_at
        }
    else:
        await db.transactions.update_one(
            {"transaction_id": transaction_id},
            {"$set": {"status": "failed", "failure_reason": "User cancelled (TEST)"}}
        )
        
        return {"success": False, "message": "Malipo yameshindikana", "status": "failed"}


@router.get("/user/transactions")
async def get_user_transactions(request: Request):
    """Get transactions for current user."""
    db = get_db()
    
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"transactions": []}
    
    token = auth_header[7:]
    token_doc = await db.user_tokens.find_one({"token": token})
    if not token_doc:
        return {"transactions": []}
    
    user_id = token_doc.get("user_id")
    transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"transactions": transactions}


@router.get("/monetization/plans")
async def get_subscription_plans():
    """
    Get available subscription plans.
    Returns empty plans if billing is disabled.
    """
    db = get_db()
    
    # Check if billing is enabled first
    settings = await db.monetization_settings.find_one({}, sort=[("created_at", -1)])
    billing_enabled = settings.get("billing_enabled", True) if settings else True
    
    # If billing is disabled, return empty plans
    if not billing_enabled:
        return {
            "plans": [],
            "billing_enabled": False,
            "message": "Billing is currently disabled"
        }
    
    # Check cache
    cached = await cache.get("subscription_plans")
    if cached and cached.get("billing_enabled", True):
        return cached
    
    plans = await db.subscription_plans.find(
        {"is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(10)
    
    # If no plans in DB, return defaults
    if not plans:
        plans = list(DEFAULT_PLANS.values())
    
    result = {
        "plans": plans,
        "billing_enabled": True,
        "free_trial_enabled": settings.get("free_trial_enabled", True) if settings else True,
        "free_trial_days": settings.get("free_trial_days", 7) if settings else 7
    }
    await cache.set("subscription_plans", result, 300)
    
    return result


@router.get("/monetization/settings")
async def get_monetization_settings():
    """Get monetization settings."""
    db = get_db()
    
    settings = await db.monetization_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "free_tier_enabled": True,
            "trial_days": 7,
            "default_currency": "TZS",
        }
    


# ============== AZAM PAY SETTINGS ==============

@router.get("/admin/payment/azampay/settings")
async def get_azampay_settings():
    """Get Azam Pay configuration settings for admin."""
    db = get_db()
    
    settings = await db.payment_gateway_settings.find_one(
        {"gateway": "azampay"}, 
        {"_id": 0, "client_secret": 0, "api_key": 0}  # Don't expose secrets in GET
    )
    
    if not settings:
        return {
            "gateway": "azampay",
            "enabled": True,
            "app_name": "",
            "client_id": "",
            "is_production": False,
            "has_credentials": False,
            "supported_mnos": ["Vodacom", "Tigo", "Airtel", "Halotel"]
        }
    
    # Check if credentials are set
    full_settings = await db.payment_gateway_settings.find_one({"gateway": "azampay"}, {"_id": 0})
    has_credentials = bool(
        full_settings.get("client_id") and 
        full_settings.get("client_secret") and 
        full_settings.get("api_key")
    )
    
    return {
        **settings,
        "has_credentials": has_credentials,
        "supported_mnos": ["Vodacom", "Tigo", "Airtel", "Halotel", "TTCL", "Zantel"]
    }


@router.post("/admin/payment/azampay/settings")
async def save_azampay_settings(data: dict):
    """Save Azam Pay configuration settings."""
    db = get_db()
    
    # Validate required fields if enabling
    enabled = data.get("enabled", True)
    is_production = data.get("is_production", False)
    
    settings = {
        "gateway": "azampay",
        "enabled": enabled,
        "app_name": data.get("app_name", "").strip(),
        "client_id": data.get("client_id", "").strip(),
        "client_secret": data.get("client_secret", "").strip(),
        "api_key": data.get("api_key", "").strip(),
        "is_production": is_production,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": data.get("admin_id", "admin")
    }
    
    # Validate credentials if enabling production mode
    if enabled and is_production:
        if not all([settings["app_name"], settings["client_id"], settings["client_secret"], settings["api_key"]]):
            raise HTTPException(
                status_code=400, 
                detail="All credentials (App Name, Client ID, Client Secret, API Key) are required for production mode"
            )
    
    # Upsert settings
    await db.payment_gateway_settings.update_one(
        {"gateway": "azampay"},
        {"$set": settings},
        upsert=True
    )
    
    # Also update environment-based config marker
    await db.system_config.update_one(
        {"config_key": "azampay_configured"},
        {"$set": {
            "config_key": "azampay_configured",
            "value": enabled and bool(settings["client_id"]),
            "is_production": is_production,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Azam Pay settings saved successfully",
        "is_production": is_production,
        "has_credentials": bool(settings["client_id"] and settings["client_secret"] and settings["api_key"])
    }


@router.post("/admin/payment/azampay/test-connection")
async def test_azampay_connection():
    """Test Azam Pay API connection with stored credentials."""
    db = get_db()
    
    settings = await db.payment_gateway_settings.find_one({"gateway": "azampay"}, {"_id": 0})
    
    if not settings:
        raise HTTPException(status_code=400, detail="Azam Pay not configured")
    
    if not all([settings.get("client_id"), settings.get("client_secret"), settings.get("api_key")]):
        raise HTTPException(status_code=400, detail="Missing credentials")
    
    # In production, this would make a test API call to Azam Pay
    # For now, we just validate the credentials format
    import httpx
    
    base_url = "https://checkout.azampay.co.tz" if settings.get("is_production") else "https://sandbox.azampay.co.tz"
    
    try:
        # Attempt to get auth token to verify credentials
        async with httpx.AsyncClient(timeout=30.0) as client:
            auth_response = await client.post(
                f"{base_url}/AppRegistration/GenerateToken",
                json={
                    "appName": settings["app_name"],
                    "clientId": settings["client_id"],
                    "clientSecret": settings["client_secret"]
                },
                headers={"Content-Type": "application/json"}
            )
            
            if auth_response.status_code == 200:
                return {
                    "success": True,
                    "message": "Connection successful! Azam Pay credentials are valid.",
                    "mode": "production" if settings.get("is_production") else "sandbox"
                }
            else:
                return {
                    "success": False,
                    "message": f"Connection failed: {auth_response.text}",
                    "status_code": auth_response.status_code
                }
    except httpx.TimeoutException:
        return {
            "success": False,
            "message": "Connection timed out. Please try again.",
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection error: {str(e)}",
        }


@router.get("/admin/payment/gateways")
async def get_all_payment_gateways():
    """Get all configured payment gateways with status."""
    db = get_db()
    
    # Get all gateway settings
    gateways = []
    
    # Azam Pay
    azampay = await db.payment_gateway_settings.find_one({"gateway": "azampay"}, {"_id": 0, "client_secret": 0, "api_key": 0})
    gateways.append({
        "id": "azampay",
        "name": "Azam Pay",
        "description": "Mobile money & bank payments (Tanzania)",
        "enabled": azampay.get("enabled", False) if azampay else False,
        "configured": bool(azampay.get("client_id")) if azampay else False,
        "is_production": azampay.get("is_production", False) if azampay else False,
        "supported_methods": ["Vodacom M-Pesa", "Tigo Pesa", "Airtel Money", "Halotel Halopesa", "Bank Transfer"]
    })
    
    # Stripe (placeholder)
    stripe_settings = await db.payment_gateway_settings.find_one({"gateway": "stripe"}, {"_id": 0})
    gateways.append({
        "id": "stripe",
        "name": "Stripe",
        "description": "Card & international payments",
        "enabled": stripe_settings.get("enabled", False) if stripe_settings else False,
        "configured": bool(stripe_settings.get("secret_key")) if stripe_settings else False,
        "is_production": stripe_settings.get("is_production", False) if stripe_settings else False,
        "supported_methods": ["Visa", "Mastercard", "Apple Pay", "Google Pay"]
    })
    
    # PayPal (placeholder)
    paypal_settings = await db.payment_gateway_settings.find_one({"gateway": "paypal"}, {"_id": 0})
    gateways.append({
        "id": "paypal",
        "name": "PayPal",
        "description": "PayPal & card payments",
        "enabled": paypal_settings.get("enabled", False) if paypal_settings else False,
        "configured": bool(paypal_settings.get("client_id")) if paypal_settings else False,
        "is_production": paypal_settings.get("is_production", False) if paypal_settings else False,
        "supported_methods": ["PayPal", "Credit/Debit Cards"]
    })
    
    return {"gateways": gateways}


# ============== ADMIN NOTIFICATIONS ==============

@router.get("/admin/notifications")
async def get_admin_notifications(limit: int = 50, unread_only: bool = False):
    """Get admin notifications for payments and other events."""
    db = get_db()
    
    query = {}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.admin_notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Count unread
    unread_count = await db.admin_notifications.count_documents({"is_read": False})
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.post("/admin/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read."""
    db = get_db()
    
    result = await db.admin_notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": result.modified_count > 0}


@router.post("/admin/notifications/mark-all-read")
async def mark_all_notifications_read():
    """Mark all notifications as read."""
    db = get_db()
    
    result = await db.admin_notifications.update_many(
        {"is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "marked_count": result.modified_count}


@router.get("/admin/notifications/settings")
async def get_notification_settings():
    """Get admin notification settings."""
    db = get_db()
    
    settings = await db.admin_settings.find_one({"setting_id": "notifications"}, {"_id": 0})
    
    if not settings:
        settings = {
            "setting_id": "notifications",
            "payment_notifications": True,
            "sound_enabled": True,
            "browser_notifications": True
        }
        await db.admin_settings.insert_one(settings)
    
    return settings


@router.put("/admin/notifications/settings")
async def update_notification_settings(settings: dict):
    """Update admin notification settings."""
    db = get_db()
    
    await db.admin_settings.update_one(
        {"setting_id": "notifications"},
        {"$set": {
            **settings,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "settings": settings}
