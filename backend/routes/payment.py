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
    
    return settings
