"""
Feedback Management Routes
==========================
Handles user feedback, bug reports, feature requests, and support tickets.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
from core.database import get_db

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])

# ============== MODELS ==============

class FeedbackCreate(BaseModel):
    type: str = Field(..., description="Type: bug_report, feature_request, general, complaint, praise")
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=10, max_length=5000)
    category: Optional[str] = None  # app, music, payment, bible, etc.
    device_info: Optional[str] = None
    app_version: Optional[str] = None
    contact_email: Optional[str] = None
    screenshots: Optional[List[str]] = []

class FeedbackUpdate(BaseModel):
    status: Optional[str] = None  # new, in_review, resolved, closed, wont_fix
    priority: Optional[str] = None  # low, medium, high, critical
    admin_notes: Optional[str] = None
    assigned_to: Optional[str] = None

class FeedbackResponse(BaseModel):
    response_message: str = Field(..., min_length=1, max_length=2000)

# ============== HELPER FUNCTIONS ==============

def serialize_feedback(feedback: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if feedback:
        feedback["id"] = str(feedback.pop("_id"))
        if "user_id" in feedback and feedback["user_id"]:
            feedback["user_id"] = str(feedback["user_id"])
        if "assigned_to" in feedback and feedback["assigned_to"]:
            feedback["assigned_to"] = str(feedback["assigned_to"])
    return feedback

# ============== USER ENDPOINTS ==============

@router.post("/submit")
async def submit_feedback(feedback: FeedbackCreate, db=Depends(get_db)):
    """Submit feedback from mobile app or web (can be anonymous or authenticated)."""
    try:
        feedback_doc = {
            "type": feedback.type,
            "subject": feedback.subject,
            "message": feedback.message,
            "category": feedback.category,
            "device_info": feedback.device_info,
            "app_version": feedback.app_version,
            "contact_email": feedback.contact_email,
            "screenshots": feedback.screenshots or [],
            "status": "new",
            "priority": "medium",
            "admin_notes": "",
            "assigned_to": None,
            "responses": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        result = await db.feedback.insert_one(feedback_doc)
        
        return {
            "success": True,
            "message": "Thank you for your feedback! We'll review it shortly.",
            "feedback_id": str(result.inserted_id)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")

# ============== ADMIN ENDPOINTS ==============

@router.get("/admin/list")
async def list_feedback(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    type: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    db=Depends(get_db)
):
    """List all feedback with filters and pagination (Admin only)."""
    try:
        query = {}
        
        if status and status != "all":
            query["status"] = status
        if type and type != "all":
            query["type"] = type
        if priority and priority != "all":
            query["priority"] = priority
        if search:
            query["$or"] = [
                {"subject": {"$regex": search, "$options": "i"}},
                {"message": {"$regex": search, "$options": "i"}},
                {"contact_email": {"$regex": search, "$options": "i"}}
            ]
        
        total = await db.feedback.count_documents(query)
        skip = (page - 1) * limit
        
        cursor = db.feedback.find(query).sort("created_at", -1).skip(skip).limit(limit)
        feedback_list = await cursor.to_list(length=limit)
        
        return {
            "success": True,
            "feedback": [serialize_feedback(f) for f in feedback_list],
            "total": total,
            "page": page,
            "total_pages": (total + limit - 1) // limit,
            "has_more": skip + limit < total
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch feedback: {str(e)}")

@router.get("/admin/{feedback_id}")
async def get_feedback_detail(feedback_id: str, db=Depends(get_db)):
    """Get detailed feedback by ID (Admin only)."""
    try:
        feedback = await db.feedback.find_one({"_id": ObjectId(feedback_id)})
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        return {
            "success": True,
            "feedback": serialize_feedback(feedback)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch feedback: {str(e)}")

@router.put("/admin/{feedback_id}")
async def update_feedback(feedback_id: str, update: FeedbackUpdate, db=Depends(get_db)):
    """Update feedback status, priority, notes, or assignment (Admin only)."""
    try:
        update_doc = {"updated_at": datetime.now(timezone.utc)}
        
        if update.status:
            update_doc["status"] = update.status
        if update.priority:
            update_doc["priority"] = update.priority
        if update.admin_notes is not None:
            update_doc["admin_notes"] = update.admin_notes
        if update.assigned_to is not None:
            update_doc["assigned_to"] = update.assigned_to
        
        result = await db.feedback.update_one(
            {"_id": ObjectId(feedback_id)},
            {"$set": update_doc}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        return {
            "success": True,
            "message": "Feedback updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update feedback: {str(e)}")

@router.post("/admin/{feedback_id}/respond")
async def respond_to_feedback(feedback_id: str, response: FeedbackResponse, db=Depends(get_db)):
    """Add an admin response to feedback (Admin only)."""
    try:
        response_doc = {
            "message": response.response_message,
            "responded_at": datetime.now(timezone.utc),
            "responded_by": "admin"  # Can be enhanced to include actual admin ID
        }
        
        result = await db.feedback.update_one(
            {"_id": ObjectId(feedback_id)},
            {
                "$push": {"responses": response_doc},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        return {
            "success": True,
            "message": "Response added successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add response: {str(e)}")

@router.delete("/admin/{feedback_id}")
async def delete_feedback(feedback_id: str, db=Depends(get_db)):
    """Delete feedback (Admin only)."""
    try:
        result = await db.feedback.delete_one({"_id": ObjectId(feedback_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        return {
            "success": True,
            "message": "Feedback deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete feedback: {str(e)}")

@router.get("/admin/stats/overview")
async def get_feedback_stats(db=Depends(get_db)):
    """Get feedback statistics overview (Admin only)."""
    try:
        # Get counts by status
        pipeline_status = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_counts = await db.feedback.aggregate(pipeline_status).to_list(length=20)
        
        # Get counts by type
        pipeline_type = [
            {"$group": {"_id": "$type", "count": {"$sum": 1}}}
        ]
        type_counts = await db.feedback.aggregate(pipeline_type).to_list(length=20)
        
        # Get counts by priority
        pipeline_priority = [
            {"$group": {"_id": "$priority", "count": {"$sum": 1}}}
        ]
        priority_counts = await db.feedback.aggregate(pipeline_priority).to_list(length=20)
        
        # Total count
        total = await db.feedback.count_documents({})
        
        # New this week
        from datetime import timedelta
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        new_this_week = await db.feedback.count_documents({"created_at": {"$gte": week_ago}})
        
        return {
            "success": True,
            "stats": {
                "total": total,
                "new_this_week": new_this_week,
                "by_status": {item["_id"]: item["count"] for item in status_counts if item["_id"]},
                "by_type": {item["_id"]: item["count"] for item in type_counts if item["_id"]},
                "by_priority": {item["_id"]: item["count"] for item in priority_counts if item["_id"]}
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")
