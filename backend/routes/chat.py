"""
Chat/Support Routes
===================
Handles in-app chat and support conversations.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from core.database import get_db
import jwt
import os

router = APIRouter(prefix="/api/chat", tags=["Chat"])

JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key")

# ============== MODELS ==============

class MessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class ConversationCreate(BaseModel):
    type: str = "support"  # support, user_to_user (future)

# ============== HELPER FUNCTIONS ==============

async def get_current_user(authorization: str = Header(None), db=None):
    """Extract user from JWT token."""
    if not authorization:
        return None
    
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if user_id:
            return user_id
    except:
        pass
    return None

def serialize_conversation(conv: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if conv:
        conv["id"] = str(conv.pop("_id"))
        if "user_id" in conv and conv["user_id"]:
            conv["user_id"] = str(conv["user_id"])
        if "messages" in conv:
            for msg in conv["messages"]:
                if "_id" in msg:
                    msg["id"] = str(msg.pop("_id"))
    return conv

def serialize_message(msg: dict) -> dict:
    """Convert message to JSON-serializable dict."""
    if msg and "_id" in msg:
        msg["id"] = str(msg.pop("_id"))
    return msg

# ============== SUPPORT CHAT ENDPOINTS ==============

@router.get("/support")
async def get_support_chat(
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Get or create support chat for current user."""
    user_id = await get_current_user(authorization, db)
    
    if not user_id:
        # For anonymous users, return empty chat with welcome message
        return {
            "success": True,
            "conversation_id": None,
            "messages": [{
                "id": "welcome",
                "message": "Welcome to SpiritSongs Support! How can we help you today?",
                "sender": "support",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }]
        }
    
    try:
        # Find existing support conversation for user
        conversation = await db.conversations.find_one({
            "user_id": user_id,
            "type": "support"
        })
        
        if conversation:
            return {
                "success": True,
                "conversation_id": str(conversation["_id"]),
                "messages": [serialize_message(m) for m in conversation.get("messages", [])]
            }
        
        # No existing conversation - return welcome message
        return {
            "success": True,
            "conversation_id": None,
            "messages": [{
                "id": "welcome",
                "message": "Welcome to SpiritSongs Support! How can we help you today?",
                "sender": "support",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat: {str(e)}")

@router.post("/support/start")
async def start_support_chat(
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Start a new support chat conversation."""
    user_id = await get_current_user(authorization, db)
    
    try:
        # Check for existing conversation
        if user_id:
            existing = await db.conversations.find_one({
                "user_id": user_id,
                "type": "support"
            })
            if existing:
                return {
                    "success": True,
                    "conversation_id": str(existing["_id"]),
                    "message": "Existing conversation found"
                }
        
        # Create new conversation
        conversation_doc = {
            "user_id": user_id,
            "type": "support",
            "status": "open",
            "messages": [{
                "_id": ObjectId(),
                "message": "Welcome to SpiritSongs Support! How can we help you today?",
                "sender": "support",
                "timestamp": datetime.now(timezone.utc)
            }],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.conversations.insert_one(conversation_doc)
        
        return {
            "success": True,
            "conversation_id": str(result.inserted_id),
            "message": "Support chat started"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start chat: {str(e)}")

# ============== CONVERSATION ENDPOINTS ==============

@router.get("/conversations")
async def get_conversations(
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Get all conversations for current user."""
    user_id = await get_current_user(authorization, db)
    
    if not user_id:
        return {"success": True, "conversations": []}
    
    try:
        cursor = db.conversations.find({"user_id": user_id}).sort("updated_at", -1)
        conversations = await cursor.to_list(length=50)
        
        return {
            "success": True,
            "conversations": [serialize_conversation(c) for c in conversations]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversations: {str(e)}")

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str,
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Get messages in a conversation."""
    try:
        conversation = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "success": True,
            "messages": [serialize_message(m) for m in conversation.get("messages", [])]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")

@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    msg: MessageCreate,
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Send a message in a conversation."""
    user_id = await get_current_user(authorization, db)
    
    try:
        # Create message document
        message_doc = {
            "_id": ObjectId(),
            "message": msg.message,
            "sender": "user",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc)
        }
        
        # Update conversation with new message
        result = await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$push": {"messages": message_doc},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "success": True,
            "message_id": str(message_doc["_id"]),
            "message": "Message sent"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/conversations")
async def admin_get_conversations(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db=Depends(get_db)
):
    """Admin: Get all support conversations."""
    try:
        query = {"type": "support"}
        if status:
            query["status"] = status
        
        total = await db.conversations.count_documents(query)
        skip = (page - 1) * limit
        
        cursor = db.conversations.find(query).sort("updated_at", -1).skip(skip).limit(limit)
        conversations = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "conversations": [serialize_conversation(c) for c in conversations],
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversations: {str(e)}")

@router.post("/admin/conversations/{conversation_id}/reply")
async def admin_reply(
    conversation_id: str,
    msg: MessageCreate,
    db=Depends(get_db)
):
    """Admin: Reply to a support conversation."""
    try:
        message_doc = {
            "_id": ObjectId(),
            "message": msg.message,
            "sender": "support",
            "timestamp": datetime.now(timezone.utc)
        }
        
        result = await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$push": {"messages": message_doc},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "success": True,
            "message_id": str(message_doc["_id"]),
            "message": "Reply sent"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send reply: {str(e)}")

@router.put("/admin/conversations/{conversation_id}/status")
async def admin_update_status(
    conversation_id: str,
    status: str,
    db=Depends(get_db)
):
    """Admin: Update conversation status (open, closed, pending)."""
    try:
        result = await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "success": True,
            "message": f"Status updated to {status}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")
