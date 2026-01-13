import { useEffect, useState } from "react";
import axios from "axios";
import { Users, Search, Plus, Edit2, Trash2, MoreVertical, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("customers");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "customer",
    status: "active"
  });

  const fetchUsers = async () => {
    try {
      const roleFilter = activeTab === "customers" ? "customer" : undefined;
      const response = await axios.get(`${API}/users`, {
        params: { role: roleFilter },
        withCredentials: true
      });
      
      if (activeTab === "customers") {
        setUsers(response.data.users.filter(u => u.role === "customer"));
      } else {
        setUsers(response.data.users.filter(u => u.role !== "customer"));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.user_id}`, formData, { withCredentials: true });
        toast.success("User updated successfully");
      } else {
        await axios.post(`${API}/users`, formData, { withCredentials: true });
        toast.success("User created successfully");
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ name: "", email: "", role: "customer", status: "active" });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { withCredentials: true });
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await axios.put(`${API}/users/${userId}`, { status: newStatus }, { withCredentials: true });
      toast.success(`User ${newStatus === "suspended" ? "suspended" : "activated"}`);
      fetchUsers();
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const styles = {
      active: "badge-success",
      suspended: "badge-error",
      pending: "badge-warning"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: "badge-violet",
      moderator: "badge-info",
      content_manager: "badge-warning",
      customer: "badge-success"
    };
    return <span className={`badge ${styles[role] || "badge-info"}`}>{role.replace("_", " ")}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="users-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Users Management</h1>
          <p className="page-subtitle">Manage customers and system users</p>
        </div>
        <Button
          onClick={() => {
            setEditingUser(null);
            setFormData({ name: "", email: "", role: activeTab === "customers" ? "customer" : "admin", status: "active" });
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-user-btn"
        >
          <Plus size={18} className="mr-2" />
          Add User
        </Button>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === "customers" ? "active" : ""}`}
          onClick={() => setActiveTab("customers")}
          data-testid="customers-tab"
        >
          <User size={16} className="inline mr-2" />
          Customers
        </button>
        <button
          className={`tab-btn ${activeTab === "system" ? "active" : ""}`}
          onClick={() => setActiveTab("system")}
          data-testid="system-users-tab"
        >
          <Shield size={16} className="inline mr-2" />
          System Users
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500"
          data-testid="search-users"
        />
      </div>

      {/* Users Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <Users className="empty-state-icon" />
              <p className="empty-state-title">No users found</p>
              <p className="empty-state-text">
                {searchQuery ? "Try a different search term" : "Add your first user to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id} data-testid={`user-row-${user.user_id}`}>
                      <td>
                        <div className="flex items-center gap-3">
                          {user.picture ? (
                            <img src={user.picture} alt="" className="avatar" />
                          ) : (
                            <div className="avatar-placeholder">
                              {user.name?.charAt(0) || "U"}
                            </div>
                          )}
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </td>
                      <td className="text-zinc-400">{user.email}</td>
                      <td>{getRoleBadge(user.role)}</td>
                      <td>{getStatusBadge(user.status)}</td>
                      <td className="text-zinc-500 text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="action-btn" data-testid={`user-actions-${user.user_id}`}>
                              <MoreVertical size={18} className="text-zinc-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                            <DropdownMenuItem onClick={() => handleEdit(user)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                              <Edit2 size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleStatusChange(user.user_id, user.status === "active" ? "suspended" : "active")}
                              className="text-zinc-300 focus:text-white focus:bg-zinc-800"
                            >
                              <Shield size={14} className="mr-2" />
                              {user.status === "active" ? "Suspend" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(user.user_id)}
                              className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="user-name-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="user-email-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="content_manager">Content Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="user-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-user-btn">
                {editingUser ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
