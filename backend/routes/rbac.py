"""
Role-Based Access Control (RBAC) routes for Gracefy Admin.
Handles roles, permissions, user assignments, and audit logging.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from core.database import get_db
from core.cache import cache

router = APIRouter(prefix="/api", tags=["rbac"])

# Default system roles with their permissions
SYSTEM_ROLES = {
    "super_admin": {
        "role_id": "role_super_admin",
        "name": "Super Admin",
        "description": "Full system access with all permissions",
        "permissions": ["*"],  # All permissions
        "is_system": True,
        "color": "#E91E63",
        "user_count": 0
    },
    "admin": {
        "role_id": "role_admin",
        "name": "Administrator",
        "description": "Administrative access to most features",
        "permissions": [
            "user_management", "content_moderation", "content_approval",
            "view_analytics", "manage_albums", "manage_songs", "platform_settings"
        ],
        "is_system": True,
        "color": "#9C27B0",
        "user_count": 0
    },
    "moderator": {
        "role_id": "role_moderator",
        "name": "Content Moderator",
        "description": "Content review and moderation",
        "permissions": [
            "content_moderation", "content_approval", "view_analytics"
        ],
        "is_system": True,
        "color": "#2196F3",
        "user_count": 0
    },
    "choir_admin": {
        "role_id": "role_choir_admin",
        "name": "Choir Administrator",
        "description": "Manage own choir content",
        "permissions": [
            "create_albums", "manage_own_content", "view_own_analytics"
        ],
        "is_system": True,
        "color": "#4CAF50",
        "user_count": 0
    },
    "user": {
        "role_id": "role_user",
        "name": "Regular User",
        "description": "Standard user with basic access",
        "permissions": ["view_content", "create_playlists", "download_content"],
        "is_system": True,
        "color": "#607D8B",
        "user_count": 0
    }
}

# All available permissions grouped by category
PERMISSION_CATEGORIES = [
    {
        "category": "Platform Administration",
        "permissions": [
            {"id": "platform_settings", "name": "Platform Settings", "description": "Modify platform configuration"},
            {"id": "user_management", "name": "User Management", "description": "Manage user accounts"},
            {"id": "role_management", "name": "Role Management", "description": "Create and modify roles"},
        ]
    },
    {
        "category": "Content Creation",
        "permissions": [
            {"id": "create_albums", "name": "Create Albums", "description": "Upload and publish albums"},
            {"id": "manage_own_content", "name": "Manage Own Content", "description": "Edit own uploaded content"},
            {"id": "bulk_upload", "name": "Bulk Upload", "description": "Upload multiple files at once"},
        ]
    },
    {
        "category": "Content Moderation",
        "permissions": [
            {"id": "content_moderation", "name": "Content Moderation", "description": "Review and moderate content"},
            {"id": "content_approval", "name": "Content Approval", "description": "Approve pending submissions"},
            {"id": "delete_content", "name": "Delete Content", "description": "Remove content from platform"},
        ]
    },
    {
        "category": "Analytics & Reports",
        "permissions": [
            {"id": "view_analytics", "name": "View Analytics", "description": "Access platform analytics"},
            {"id": "view_own_analytics", "name": "View Own Analytics", "description": "View analytics for own content"},
            {"id": "view_all_revenue_reports", "name": "Revenue Reports", "description": "Access financial reports"},
            {"id": "export_reports", "name": "Export Reports", "description": "Download analytics reports"},
        ]
    },
    {
        "category": "Revenue & Finance",
        "permissions": [
            {"id": "manage_subscriptions", "name": "Manage Subscriptions", "description": "Handle subscription plans"},
            {"id": "process_payments", "name": "Process Payments", "description": "Handle payment operations"},
            {"id": "manage_donations", "name": "Manage Donations", "description": "Oversee donation system"},
        ]
    },
    {
        "category": "Layout & Promotion",
        "permissions": [
            {"id": "layout_promotion_control", "name": "Layout Control", "description": "Manage home page layout"},
            {"id": "manage_banners", "name": "Manage Banners", "description": "Update promotional banners"},
            {"id": "featured_content", "name": "Featured Content", "description": "Select featured content"},
        ]
    },
    {
        "category": "Content Access",
        "permissions": [
            {"id": "view_content", "name": "View Content", "description": "Access platform content"},
            {"id": "download_content", "name": "Download Content", "description": "Download music files"},
            {"id": "create_playlists", "name": "Create Playlists", "description": "Create and manage playlists"},
            {"id": "premium_content", "name": "Premium Content", "description": "Access premium features"},
        ]
    }
]


@router.get("/rbac/roles")
async def get_roles():
    """Get all system and custom roles"""
    db = get_db()
    
    # Get custom roles from DB
    custom_roles = await db.roles.find({}, {"_id": 0}).to_list(50)
    
    # Count users per role
    system_roles = []
    for role_key, role_data in SYSTEM_ROLES.items():
        role = dict(role_data)
        user_count = await db.users.count_documents({"role": role_key})
        role["user_count"] = user_count
        system_roles.append(role)
    
    for role in custom_roles:
        user_count = await db.users.count_documents({"role": role.get("role_id")})
        role["user_count"] = user_count
    
    # Combine all roles for frontend filter dropdown
    all_roles = system_roles + custom_roles
    
    return {
        "system_roles": system_roles,
        "custom_roles": custom_roles,
        "all_roles": all_roles
    }


@router.get("/rbac/permissions")
async def get_permissions():
    """Get all available permissions as flat array with category"""
    # Flatten the permissions for frontend consumption
    flat_permissions = []
    for category in PERMISSION_CATEGORIES:
        cat_name = category["category"]
        for perm in category["permissions"]:
            flat_permissions.append({
                "permission_id": perm["id"],
                "name": perm["name"],
                "description": perm["description"],
                "category": cat_name
            })
    
    return {
        "permissions": flat_permissions,
        "categories": PERMISSION_CATEGORIES  # Also return original structure for backwards compatibility
    }


@router.get("/rbac/users")
async def get_users_with_roles(
    role: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get users with their role assignments"""
    db = get_db()
    
    query = {}
    if role and role != "all":
        query["role"] = role
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    users = await db.users.find(query, {
        "_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1, "phone": 1,
        "permissions": 1, "status": 1, "created_at": 1, "last_login": 1
    }).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents(query)
    
    # Enrich with role details and add frontend-expected fields
    for user in users:
        role_key = user.get("role", "user")
        # Add assigned_role field that frontend expects
        user["assigned_role"] = role_key
        # Determine user type (admin, choir, regular user)
        if role_key in ["admin", "super_admin"]:
            user["user_type"] = "Admin"
        elif role_key == "choir_admin":
            user["user_type"] = "Choir"
        else:
            user["user_type"] = "User"
        
        if role_key in SYSTEM_ROLES:
            user["role_name"] = SYSTEM_ROLES[role_key]["name"]
            user["role_color"] = SYSTEM_ROLES[role_key]["color"]
        else:
            custom_role = await db.roles.find_one({"role_id": role_key})
            if custom_role:
                user["role_name"] = custom_role.get("name", role_key)
                user["role_color"] = custom_role.get("color", "#666666")
            else:
                user["role_name"] = "User"
                user["role_color"] = "#607D8B"
    
    return {"users": users, "total": total}


@router.post("/rbac/roles")
async def create_role(data: dict):
    """Create a new custom role"""
    db = get_db()
    
    role_id = f"role_{uuid.uuid4().hex[:12]}"
    role = {
        "role_id": role_id,
        "name": data.get("name"),
        "description": data.get("description", ""),
        "permissions": data.get("permissions", []),
        "color": data.get("color", "#666666"),
        "based_on": data.get("based_on"),
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": data.get("created_by")
    }
    
    await db.roles.insert_one(role)
    role.pop("_id", None)
    
    # Log the action
    await log_rbac_action(db, "role_created", role_id, data.get("created_by"), {"role_name": role["name"]})
    
    return role


@router.put("/rbac/roles/{role_id}")
async def update_role(role_id: str, data: dict):
    """Update a custom role"""
    db = get_db()
    
    # Cannot update system roles
    if role_id.replace("role_", "") in SYSTEM_ROLES:
        raise HTTPException(status_code=403, detail="Cannot modify system roles")
    
    update_data = {
        "name": data.get("name"),
        "description": data.get("description"),
        "permissions": data.get("permissions"),
        "color": data.get("color"),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.roles.update_one(
        {"role_id": role_id},
        {"$set": {k: v for k, v in update_data.items() if v is not None}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    await log_rbac_action(db, "role_updated", role_id, data.get("updated_by"), update_data)
    
    return {"message": "Role updated successfully"}


@router.delete("/rbac/roles/{role_id}")
async def delete_role(role_id: str):
    """Delete a custom role"""
    db = get_db()
    
    # Cannot delete system roles
    if role_id.replace("role_", "") in SYSTEM_ROLES:
        raise HTTPException(status_code=403, detail="Cannot delete system roles")
    
    # Check if any users have this role
    user_count = await db.users.count_documents({"role": role_id})
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role: {user_count} users have this role")
    
    result = await db.roles.delete_one({"role_id": role_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    
    await log_rbac_action(db, "role_deleted", role_id, None, {})
    
    return {"message": "Role deleted successfully"}


@router.post("/rbac/assign-role")
async def assign_role_to_user(data: dict):
    """Assign a role to a user"""
    db = get_db()
    
    user_id = data.get("user_id")
    role_id = data.get("role_id")
    assigned_by = data.get("assigned_by")
    notes = data.get("notes", "")
    
    if not user_id or not role_id:
        raise HTTPException(status_code=400, detail="user_id and role_id required")
    
    # Get previous role
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    previous_role = user.get("role", "user")
    
    # Update user role
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": role_id,
            "role_updated_at": datetime.now(timezone.utc).isoformat(),
            "role_updated_by": assigned_by
        }}
    )
    
    await log_rbac_action(db, "role_assigned", user_id, assigned_by, {
        "previous_role": previous_role,
        "new_role": role_id,
        "notes": notes
    })
    
    return {"message": "Role assigned successfully", "user_id": user_id, "role": role_id}


@router.post("/rbac/users/{user_id}/assign-role")
async def assign_role_to_user_by_id(user_id: str, data: dict):
    """Assign a role to a specific user (by path parameter)"""
    db = get_db()
    
    role_id = data.get("role_id")
    assigned_by = data.get("assigned_by", "admin")
    notes = data.get("notes", "")
    
    if not role_id:
        raise HTTPException(status_code=400, detail="role_id required")
    
    # Get previous role
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    previous_role = user.get("role", "user")
    
    # Update user role
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "role": role_id,
            "role_updated_at": datetime.now(timezone.utc).isoformat(),
            "role_updated_by": assigned_by
        }}
    )
    
    await log_rbac_action(db, "role_assigned", user_id, assigned_by, {
        "previous_role": previous_role,
        "new_role": role_id,
        "notes": notes
    })
    
    return {"message": "Role assigned successfully", "user_id": user_id, "role": role_id}


@router.get("/rbac/audit-log")
async def get_audit_log(
    action: Optional[str] = None,
    limit: int = 50
):
    """Get RBAC audit log"""
    db = get_db()
    
    query = {}
    if action:
        query["action"] = action
    
    logs = await db.rbac_audit_log.find(query, {"_id": 0})\
        .sort("timestamp", -1)\
        .limit(limit)\
        .to_list(limit)
    
    return {"logs": logs}


@router.get("/rbac/stats")
async def get_rbac_stats():
    """Get RBAC statistics"""
    db = get_db()
    
    total_users = await db.users.count_documents({})
    total_custom_roles = await db.roles.count_documents({})
    
    # Users by role
    role_pipeline = [
        {"$group": {"_id": "$role", "count": {"$sum": 1}}}
    ]
    role_distribution = await db.users.aggregate(role_pipeline).to_list(20)
    
    # Recent changes
    recent_changes = await db.rbac_audit_log.count_documents({
        "timestamp": {"$gte": (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)).isoformat()}
    })
    
    # Build role_stats in the format the frontend expects
    role_stats = {}
    for item in role_distribution:
        role_key = item["_id"] or "user"
        if role_key in SYSTEM_ROLES:
            role_data = SYSTEM_ROLES[role_key]
            role_stats[role_key] = {
                "name": role_data["name"],
                "color": role_data["color"],
                "count": item["count"]
            }
        else:
            # Custom role - try to find it in DB
            custom_role = await db.roles.find_one({"role_id": role_key})
            if custom_role:
                role_stats[role_key] = {
                    "name": custom_role.get("name", role_key),
                    "color": custom_role.get("color", "#607D8B"),
                    "count": item["count"]
                }
            else:
                role_stats[role_key] = {
                    "name": role_key.replace("_", " ").title(),
                    "color": "#607D8B",
                    "count": item["count"]
                }
    
    return {
        "total_users": total_users,
        "total_system_roles": len(SYSTEM_ROLES),
        "total_custom_roles": total_custom_roles,
        "role_distribution": {item["_id"] or "user": item["count"] for item in role_distribution},
        "role_stats": role_stats,
        "recent_changes_today": recent_changes
    }


async def log_rbac_action(db, action: str, target_id: str, performed_by: str, details: dict):
    """Log an RBAC action for audit purposes"""
    log_entry = {
        "log_id": f"log_{uuid.uuid4().hex[:12]}",
        "action": action,
        "target_id": target_id,
        "performed_by": performed_by,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.rbac_audit_log.insert_one(log_entry)
