import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Users, Plus, Edit2, Trash2, Shield, User, 
  Mail, Calendar, Key, Eye, EyeOff, X, Check, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Available roles
const ROLES = [
  { value: "admin", label: "Admin", description: "Full system access", color: "bg-red-500" },
  { value: "choir_admin", label: "Choir Admin", description: "Manage choir content", color: "bg-purple-500" },
  { value: "church_admin", label: "Church Admin", description: "Manage church content", color: "bg-blue-500" },
  { value: "content_manager", label: "Content Manager", description: "Manage songs and albums", color: "bg-green-500" },
  { value: "viewer", label: "Viewer", description: "View only access", color: "bg-gray-500" },
  { value: "user", label: "User", description: "Basic user access", color: "bg-zinc-500" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "user",
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/users`, { withCredentials: true });
      setUsers(res.data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update existing user
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        
        await axios.put(`${API}/admin/users/${editingUser.user_id}`, updateData, { 
          withCredentials: true 
        });
        toast.success("User updated successfully");
      } else {
        // Create new user
        if (!formData.password) {
          toast.error("Password is required");
          return;
        }
        
        await axios.post(`${API}/admin/users`, formData, { withCredentials: true });
        toast.success("User created successfully");
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error(error.response?.data?.detail || "Failed to save user");
    }
  };

  const handleDelete = async (userId) => {
    try {
      await axios.delete(`${API}/admin/users/${userId}`, { withCredentials: true });
      toast.success("User deleted successfully");
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      username: "",
      password: "",
      role: "user",
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      password: "",
      role: user.role || "user",
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const getRoleBadge = (role) => {
    const roleConfig = ROLES.find(r => r.value === role) || ROLES[ROLES.length - 1];
    return (
      <Badge className={`${roleConfig.color} text-white`}>
        {roleConfig.label}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: "Active", color: "bg-green-500" },
      inactive: { label: "Inactive", color: "bg-gray-500" },
      suspended: { label: "Suspended", color: "bg-red-500" },
    };
    const config = statusConfig[status] || statusConfig.active;
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>;
  };

  // Stats
  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === "admin").length,
    choirAdmins: users.filter(u => u.role === "choir_admin").length,
    churchAdmins: users.filter(u => u.role === "church_admin").length,
  };

  return (
    <div className="page-container animate-fade-in" data-testid="admin-users-page">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Shield className="text-violet-400" size={28} />
              Admin Users
            </h1>
            <p className="page-subtitle">Manage system users and their roles</p>
          </div>
          <Button onClick={openCreateModal} className="btn-primary" data-testid="create-user-btn">
            <Plus size={18} className="mr-2" />
            Create User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20">
                <Users size={20} className="text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-zinc-500">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Shield size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.admins}</p>
                <p className="text-xs text-zinc-500">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <User size={20} className="text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.choirAdmins}</p>
                <p className="text-xs text-zinc-500">Choir Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <User size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.churchAdmins}</p>
                <p className="text-xs text-zinc-500">Church Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">System Users</CardTitle>
          <CardDescription className="text-zinc-500">
            Users with access to admin panel and content management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No users found</p>
              <Button onClick={openCreateModal} className="mt-4 btn-primary">
                <Plus size={16} className="mr-2" />
                Create First User
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">User</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Role</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Created</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                            {user.picture ? (
                              <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={20} className="text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white">{user.name || user.username || "No name"}</p>
                            {user.username && <p className="text-xs text-zinc-500">@{user.username}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-zinc-300">{user.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(user.status)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-zinc-500 text-sm">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(user)}
                            className="text-zinc-400 hover:text-white"
                            data-testid={`edit-user-${user.user_id}`}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(user)}
                            className="text-zinc-400 hover:text-red-400"
                            data-testid={`delete-user-${user.user_id}`}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit User Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingUser ? "Edit User" : "Create New User"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {editingUser 
                ? "Update user details and role" 
                : "Create a new system user with login credentials"
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
                className="bg-zinc-800 border-zinc-700"
                data-testid="user-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="bg-zinc-800 border-zinc-700"
                required
                disabled={!!editingUser}
                data-testid="user-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Username</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                className="bg-zinc-800 border-zinc-700"
                data-testid="user-username-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Password {editingUser && "(leave empty to keep current)"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "••••••••" : "Enter password"}
                  className="bg-zinc-800 border-zinc-700 pr-10"
                  required={!editingUser}
                  data-testid="user-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Role *</label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700" data-testid="user-role-select">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${role.color}`} />
                        <span>{role.label}</span>
                        <span className="text-xs text-zinc-500">- {role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { resetForm(); setIsModalOpen(false); }}
                className="text-zinc-400"
              >
                Cancel
              </Button>
              <Button type="submit" className="btn-primary" data-testid="save-user-btn">
                {editingUser ? "Update User" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="text-red-400" size={20} />
              Delete User
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm?.name || deleteConfirm?.email}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              onClick={() => handleDelete(deleteConfirm?.user_id)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-btn"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
