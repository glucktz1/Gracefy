"""
AI-Powered Chat/Support Routes
==============================
Handles in-app chat with AI responses using Emergent LLM.
Includes knowledge bank for context-aware responses.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from core.database import get_db
from dotenv import load_dotenv
import jwt
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ============== MODELS ==============

class MessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

class KnowledgeEntryCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    content: str = Field(..., min_length=10, max_length=10000)
    category: str = Field(default="general")
    keywords: List[str] = []
    is_active: bool = True

class SatisfactionRating(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    feedback: Optional[str] = None

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
                if "timestamp" in msg and hasattr(msg["timestamp"], "isoformat"):
                    msg["timestamp"] = msg["timestamp"].isoformat()
    return conv

def serialize_message(msg: dict) -> dict:
    """Convert message to JSON-serializable dict."""
    if msg and "_id" in msg:
        msg["id"] = str(msg.pop("_id"))
    if msg and "timestamp" in msg and hasattr(msg["timestamp"], "isoformat"):
        msg["timestamp"] = msg["timestamp"].isoformat()
    return msg

async def get_knowledge_context(db, user_message: str) -> str:
    """Get relevant knowledge base entries for context."""
    try:
        # Search knowledge bank for relevant entries
        keywords = user_message.lower().split()
        
        # Find active knowledge entries
        entries = await db.knowledge_bank.find({
            "is_active": True,
            "$or": [
                {"keywords": {"$in": keywords}},
                {"title": {"$regex": "|".join(keywords[:5]), "$options": "i"}},
                {"content": {"$regex": "|".join(keywords[:3]), "$options": "i"}}
            ]
        }).limit(5).to_list(5)
        
        if not entries:
            # Get general entries if no specific match
            entries = await db.knowledge_bank.find({
                "is_active": True,
                "category": "general"
            }).limit(3).to_list(3)
        
        if entries:
            context = "Relevant knowledge:\n"
            for entry in entries:
                context += f"- {entry['title']}: {entry['content'][:500]}\n"
            return context
        
        return ""
    except Exception as e:
        logger.error(f"Error getting knowledge context: {e}")
        return ""

async def get_ai_response(db, user_message: str, conversation_history: List[dict] = None) -> str:
    """Generate AI response using Emergent LLM."""
    if not EMERGENT_LLM_KEY:
        return get_fallback_response(user_message)
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Get knowledge context
        knowledge_context = await get_knowledge_context(db, user_message)
        
        # Build system message
        system_message = """You are a helpful AI assistant for SpiritSongs/Gracefy, a Christian music streaming app. 
You help users with:
- App navigation and features
- Music playback and downloads
- Bible reading and audio features
- Subscription and payment questions
- Technical issues and troubleshooting
- General inquiries about the app

Be friendly, helpful, and concise. Respond in the same language the user writes in (Swahili or English).
If you don't know something specific, suggest contacting human support.

""" + knowledge_context

        # Create chat instance
        session_id = f"support_{datetime.now().timestamp()}"
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_message
        ).with_model("gemini", "gemini-3-flash-preview")
        
        # Add conversation history context if available
        context_msg = ""
        if conversation_history and len(conversation_history) > 0:
            recent_msgs = conversation_history[-6:]  # Last 3 exchanges
            for msg in recent_msgs:
                role = "User" if msg.get("sender") == "user" else "Assistant"
                context_msg += f"{role}: {msg.get('message', '')}\n"
        
        # Build the prompt
        full_message = user_message
        if context_msg:
            full_message = f"Previous conversation:\n{context_msg}\n\nUser's new message: {user_message}"
        
        # Send message and get response
        user_msg = UserMessage(text=full_message)
        response = await chat.send_message(user_msg)
        
        return response if response else get_fallback_response(user_message)
        
    except Exception as e:
        logger.error(f"AI response error: {e}")
        return get_fallback_response(user_message)

def get_fallback_response(user_message: str) -> str:
    """Fallback responses when AI is unavailable."""
    lower_msg = user_message.lower()
    
    if any(word in lower_msg for word in ['subscription', 'payment', 'plan', 'usajili', 'malipo']):
        return "Kwa maswali ya usajili na malipo, tafadhali nenda Profile > Subscription Plans. Kama una tatizo la malipo, tuma maoni kupitia Feedback."
    
    if any(word in lower_msg for word in ['download', 'offline', 'pakua']):
        return "Kupakua nyimbo kwa kusikiliza offline, bonyeza ikoni ya download kwenye wimbo wowote. Nyimbo zilizopakiwa zitapatikana katika Library > Downloads."
    
    if any(word in lower_msg for word in ['bible', 'biblia', 'verse', 'aya']):
        return "Unaweza kupata sehemu ya Biblia kutoka navigation ya chini. Tuna Biblia kamili na kipengele cha kusoma kwa sauti!"
    
    if any(word in lower_msg for word in ['bug', 'error', 'crash', 'tatizo', 'kosa']):
        return "Pole kusikia una tatizo! Tafadhali tuma ripoti ya kina kupitia Settings > Send Feedback ukichagua 'Bug Report'."
    
    if any(word in lower_msg for word in ['hello', 'hi', 'hey', 'habari', 'mambo']):
        return "Habari! Karibu kwenye Msaada wa SpiritSongs. Ninawezaje kukusaidia leo?"
    
    return "Asante kwa kuwasiliana nasi! Timu yetu ya msaada itakagua ujumbe wako na kujibu hivi karibuni. Kwa msaada wa haraka, unaweza pia kutuma email support@spiritsongs.app"

# ============== USER CHAT ENDPOINTS ==============

@router.get("/support")
async def get_support_chat(
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Get or create support chat for current user."""
    user_id = await get_current_user(authorization, db)
    
    if not user_id:
        return {
            "success": True,
            "conversation_id": None,
            "messages": [{
                "id": "welcome",
                "message": "Karibu kwenye Msaada wa SpiritSongs! Ninawezaje kukusaidia leo?",
                "sender": "ai",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }]
        }
    
    try:
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
        
        return {
            "success": True,
            "conversation_id": None,
            "messages": [{
                "id": "welcome",
                "message": "Karibu kwenye Msaada wa SpiritSongs! Ninawezaje kukusaidia leo?",
                "sender": "ai",
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
        
        conversation_doc = {
            "user_id": user_id,
            "type": "support",
            "status": "open",
            "messages": [{
                "_id": ObjectId(),
                "message": "Karibu kwenye Msaada wa SpiritSongs! Ninawezaje kukusaidia leo?",
                "sender": "ai",
                "timestamp": datetime.now(timezone.utc)
            }],
            "satisfaction_rating": None,
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

@router.post("/support/message")
async def send_support_message(
    msg: MessageCreate,
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Send a message and get AI response."""
    user_id = await get_current_user(authorization, db)
    
    try:
        # Find or create conversation
        conversation = None
        if user_id:
            conversation = await db.conversations.find_one({
                "user_id": user_id,
                "type": "support"
            })
        
        if not conversation:
            # Create new conversation
            conversation_doc = {
                "user_id": user_id,
                "type": "support",
                "status": "open",
                "messages": [],
                "satisfaction_rating": None,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            result = await db.conversations.insert_one(conversation_doc)
            conversation = {"_id": result.inserted_id, "messages": []}
        
        conv_id = conversation["_id"]
        
        # Add user message
        user_message_doc = {
            "_id": ObjectId(),
            "message": msg.message,
            "sender": "user",
            "timestamp": datetime.now(timezone.utc)
        }
        
        await db.conversations.update_one(
            {"_id": conv_id},
            {
                "$push": {"messages": user_message_doc},
                "$set": {"updated_at": datetime.now(timezone.utc), "status": "open"}
            }
        )
        
        # Get AI response
        conversation_history = conversation.get("messages", [])
        ai_response = await get_ai_response(db, msg.message, conversation_history)
        
        # Add AI response
        ai_message_doc = {
            "_id": ObjectId(),
            "message": ai_response,
            "sender": "ai",
            "timestamp": datetime.now(timezone.utc)
        }
        
        await db.conversations.update_one(
            {"_id": conv_id},
            {
                "$push": {"messages": ai_message_doc},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return {
            "success": True,
            "conversation_id": str(conv_id),
            "user_message": serialize_message(user_message_doc),
            "ai_response": serialize_message(ai_message_doc)
        }
    except Exception as e:
        logger.error(f"Send message error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

@router.post("/support/handover/{conversation_id}")
async def request_human_handover(
    conversation_id: str,
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Request handover to human agent."""
    try:
        result = await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {
                    "status": "pending_human",
                    "handover_requested_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                },
                "$push": {
                    "messages": {
                        "_id": ObjectId(),
                        "message": "Ombi lako la kuzungumza na mtaalamu wa msaada limepokelewa. Tutakujibu hivi karibuni.",
                        "sender": "system",
                        "timestamp": datetime.now(timezone.utc)
                    }
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "success": True,
            "message": "Handover request submitted"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to request handover: {str(e)}")

@router.post("/support/satisfaction/{conversation_id}")
async def submit_satisfaction(
    conversation_id: str,
    rating: SatisfactionRating,
    authorization: str = Header(None),
    db=Depends(get_db)
):
    """Submit customer satisfaction rating."""
    try:
        satisfaction_doc = {
            "rating": rating.rating,
            "feedback": rating.feedback,
            "submitted_at": datetime.now(timezone.utc)
        }
        
        result = await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$set": {
                    "satisfaction_rating": satisfaction_doc,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {
            "success": True,
            "message": "Thank you for your feedback!"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit rating: {str(e)}")

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
    """Send a message in a conversation (with AI response)."""
    user_id = await get_current_user(authorization, db)
    
    try:
        conversation = await db.conversations.find_one({"_id": ObjectId(conversation_id)})
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Add user message
        user_message_doc = {
            "_id": ObjectId(),
            "message": msg.message,
            "sender": "user",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc)
        }
        
        await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {
                "$push": {"messages": user_message_doc},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        # Get AI response if not waiting for human
        ai_response_doc = None
        if conversation.get("status") != "pending_human":
            conversation_history = conversation.get("messages", [])
            ai_response = await get_ai_response(db, msg.message, conversation_history)
            
            ai_response_doc = {
                "_id": ObjectId(),
                "message": ai_response,
                "sender": "ai",
                "timestamp": datetime.now(timezone.utc)
            }
            
            await db.conversations.update_one(
                {"_id": ObjectId(conversation_id)},
                {
                    "$push": {"messages": ai_response_doc},
                    "$set": {"updated_at": datetime.now(timezone.utc)}
                }
            )
        
        return {
            "success": True,
            "user_message": serialize_message(user_message_doc),
            "ai_response": serialize_message(ai_response_doc) if ai_response_doc else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

# ============== KNOWLEDGE BANK ENDPOINTS ==============

@router.get("/admin/knowledge-bank")
async def get_knowledge_bank(
    category: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db=Depends(get_db)
):
    """Admin: Get knowledge bank entries."""
    try:
        query = {}
        if category:
            query["category"] = category
        
        total = await db.knowledge_bank.count_documents(query)
        skip = (page - 1) * limit
        
        cursor = db.knowledge_bank.find(query).sort("created_at", -1).skip(skip).limit(limit)
        entries = await cursor.to_list(length=limit)
        
        # Serialize
        for entry in entries:
            entry["id"] = str(entry.pop("_id"))
        
        return {
            "success": True,
            "entries": entries,
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get knowledge bank: {str(e)}")

@router.post("/admin/knowledge-bank")
async def create_knowledge_entry(
    entry: KnowledgeEntryCreate,
    db=Depends(get_db)
):
    """Admin: Create a knowledge bank entry."""
    try:
        entry_doc = {
            "title": entry.title,
            "content": entry.content,
            "category": entry.category,
            "keywords": entry.keywords,
            "is_active": entry.is_active,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.knowledge_bank.insert_one(entry_doc)
        
        return {
            "success": True,
            "id": str(result.inserted_id),
            "message": "Knowledge entry created"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create entry: {str(e)}")

@router.put("/admin/knowledge-bank/{entry_id}")
async def update_knowledge_entry(
    entry_id: str,
    entry: KnowledgeEntryCreate,
    db=Depends(get_db)
):
    """Admin: Update a knowledge bank entry."""
    try:
        result = await db.knowledge_bank.update_one(
            {"_id": ObjectId(entry_id)},
            {
                "$set": {
                    "title": entry.title,
                    "content": entry.content,
                    "category": entry.category,
                    "keywords": entry.keywords,
                    "is_active": entry.is_active,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        return {
            "success": True,
            "message": "Knowledge entry updated"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update entry: {str(e)}")

@router.delete("/admin/knowledge-bank/{entry_id}")
async def delete_knowledge_entry(
    entry_id: str,
    db=Depends(get_db)
):
    """Admin: Delete a knowledge bank entry."""
    try:
        result = await db.knowledge_bank.delete_one({"_id": ObjectId(entry_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        return {
            "success": True,
            "message": "Knowledge entry deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")

# ============== ADMIN CHAT ENDPOINTS ==============

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
        
        # Enrich with user info
        enriched = []
        for conv in conversations:
            serialized = serialize_conversation(conv)
            
            if conv.get("user_id"):
                try:
                    user = await db.users.find_one(
                        {"_id": ObjectId(conv["user_id"])},
                        {"name": 1, "email": 1, "phone": 1}
                    )
                    if user:
                        serialized["user_name"] = user.get("name", "")
                        serialized["user_email"] = user.get("email", "")
                        serialized["user_phone"] = user.get("phone", "")
                except:
                    pass
            
            enriched.append(serialized)
        
        return {
            "success": True,
            "conversations": enriched,
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
    """Admin: Reply to a support conversation (human agent)."""
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
                "$set": {
                    "updated_at": datetime.now(timezone.utc),
                    "status": "open"  # Mark as active after human reply
                }
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
    """Admin: Update conversation status."""
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

@router.get("/admin/satisfaction-stats")
async def get_satisfaction_stats(db=Depends(get_db)):
    """Admin: Get customer satisfaction statistics."""
    try:
        pipeline = [
            {"$match": {"satisfaction_rating": {"$ne": None}}},
            {"$group": {
                "_id": "$satisfaction_rating.rating",
                "count": {"$sum": 1}
            }}
        ]
        
        results = await db.conversations.aggregate(pipeline).to_list(10)
        
        total_rated = sum(r["count"] for r in results)
        avg_rating = 0
        if total_rated > 0:
            avg_rating = sum(r["_id"] * r["count"] for r in results) / total_rated
        
        ratings_dist = {str(r["_id"]): r["count"] for r in results}
        
        return {
            "success": True,
            "stats": {
                "total_rated": total_rated,
                "average_rating": round(avg_rating, 2),
                "distribution": ratings_dist
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
