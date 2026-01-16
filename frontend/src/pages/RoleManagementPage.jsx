import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Shield, Users, UserCheck, Settings, Lock, Unlock, Plus, Edit2, Trash2,
  Save, Search, Filter, ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  Clock, Eye, Music, DollarSign, BarChart2, Layout, Headphones, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Permission category icons
const CATEGORY_ICONS = {
  "Platform Administration": Settings,
  "Content Creation": Music,
  "Content Moderation": Shield,
  "Analytics & Reports": BarChart2,
  "Revenue & Finance": DollarSign,
  "Layout & Promotion": Layout,
  "Content Access": Headphones,
};

export default function RoleManagementPage() {
  const [roles, setRoles] = useState({ system_roles: [], custom_roles: [] });
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("roles");
  
  // Role Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({
    name: "", description: "", permissions: [], color: "#666666", based_on: ""
  });
  
  // User Role Assignment Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [expandedRole, setExpandedRole] = useState(null);

  const fetchData = async () => {
    try {
      const [rolesRes, permsRes, usersRes, logsRes, statsRes] = await Promise.all([
        axios.get(`${API}/rbac/roles`, { withCredentials: true }),
        axios.get(`${API}/rbac/permissions`, { withCredentials: true }),
        axios.get(`${API}/rbac/users`, { withCredentials: true }),
        axios.get(`${API}/rbac/audit-log?limit=50`, { withCredentials: true }),
        axios.get(`${API}/rbac/stats`, { withCredentials: true })
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data.permissions || []);
      setUsers(usersRes.data.users || []);
      setAuditLogs(logsRes.data.logs || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error fetching RBAC data:", error);
      toast.error("Failed to load role management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group permissions by category
  const groupedPermissions = permissions.reduce((acc, perm) => {
    const cat = perm.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(perm);
    return acc;
  }, {});

  const handleCreateRole = async () => {
    if (!roleForm.name.trim()) {
      toast.error("Role name is required");
      return;
    }
    
    try {
      if (editingRole) {
        await axios.put(`${API}/rbac/roles/${editingRole.role_id}`, roleForm, { withCredentials: true });
        toast.success("Role updated successfully");
      } else {
        await axios.post(`${API}/rbac/roles`, roleForm, { withCredentials: true });
        toast.success("Role created successfully");
      }
      setIsRoleModalOpen(false);
      setEditingRole(null);
      setRoleForm({ name: "", description: "", permissions: [], color: "#666666", based_on: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save role");
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm("Are you sure you want to delete this role?")) return;
    
    try {
      await axios.delete(`${API}/rbac/roles/${roleId}`, { withCredentials: true });
      toast.success("Role deleted successfully");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete role");
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !assignRoleId) {
      toast.error("Please select a role to assign");
      return;
    }
    
    try {
      await axios.post(`${API}/rbac/users/${selectedUser.user_id}/assign-role`, {
        role_id: assignRoleId,
        notes: assignNotes,
        assigned_by: "admin"
      }, { withCredentials: true });
      
      toast.success("Role assigned successfully");
      setIsAssignModalOpen(false);
      setSelectedUser(null);
      setAssignRoleId("");
      setAssignNotes("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign role");
    }
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions || [],
      color: role.color || "#666666",
      based_on: role.based_on || ""
    });
    setIsRoleModalOpen(true);
  };

  const openAssignModal = (user) => {
    setSelectedUser(user);
    setAssignRoleId(user.assigned_role || "");
    setIsAssignModalOpen(true);
  };

  const togglePermission = (permId) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));
  };

  const handleBasedOnChange = (baseRole) => {
    if (baseRole === "none") {
      setRoleForm(prev => ({
        ...prev,
        based_on: null,
        permissions: []
      }));
      return;
    }
    const systemRole = roles.system_roles.find(r => r.role_id === baseRole);
    if (systemRole) {
      setRoleForm(prev => ({
        ...prev,
        based_on: baseRole,
        permissions: [...systemRole.permissions]
      }));
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      (user.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === "all" || user.assigned_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="role-management-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-violet-400" /> Role & Access Management
          </h1>
          <p className="text-zinc-400 mt-1">Manage user roles, permissions, and access controls</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Object.entries(stats.role_stats || {}).slice(0, 6).map(([roleId, data]) => (
          <Card key={roleId} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></div>
                <span className="text-xs text-zinc-400 truncate">{data.name}</span>
              </div>
              <div className="text-2xl font-bold text-white">{data.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="roles" className="data-[state=active]:bg-violet-600">
            <Shield size={16} className="mr-2" /> Roles
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-violet-600">
            <Users size={16} className="mr-2" /> User Assignments
          </TabsTrigger>
          <TabsTrigger value="permissions" className="data-[state=active]:bg-violet-600">
            <Lock size={16} className="mr-2" /> Permissions Matrix
          </TabsTrigger>
          <TabsTrigger value="audit" className="data-[state=active]:bg-violet-600">
            <Clock size={16} className="mr-2" /> Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">System & Custom Roles</h2>
            <Button onClick={() => { setEditingRole(null); setRoleForm({ name: "", description: "", permissions: [], color: "#666666", based_on: "" }); setIsRoleModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
              <Plus size={16} className="mr-2" /> Create Custom Role
            </Button>
          </div>

          {/* System Roles */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">System Roles (Cannot be modified)</h3>
            <div className="grid gap-3">
              {roles.system_roles.map((role) => (
                <Card key={role.role_id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: role.color + '20' }}>
                          <Crown size={20} style={{ color: role.color }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{role.name}</h4>
                            <Badge variant="secondary" className="text-xs">Level {role.level}</Badge>
                            <Badge className="text-xs bg-blue-600/20 text-blue-400 border-blue-600/30">System</Badge>
                          </div>
                          <p className="text-sm text-zinc-400 mt-1">{role.description}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setExpandedRole(expandedRole === role.role_id ? null : role.role_id)}
                      >
                        {expandedRole === role.role_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span className="ml-1 text-xs">{role.permissions?.length || 0} permissions</span>
                      </Button>
                    </div>
                    {expandedRole === role.role_id && (
                      <div className="mt-4 pt-4 border-t border-zinc-800">
                        <div className="flex flex-wrap gap-2">
                          {role.permissions?.map(perm => (
                            <Badge key={perm} variant="outline" className="text-xs bg-zinc-800 text-zinc-300 border-zinc-700">
                              {perm.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Custom Roles */}
          {roles.custom_roles.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Custom Roles</h3>
              <div className="grid gap-3">
                {roles.custom_roles.map((role) => (
                  <Card key={role.role_id} className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: role.color + '20' }}>
                            <Shield size={20} style={{ color: role.color }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-white">{role.name}</h4>
                              <Badge className="text-xs bg-emerald-600/20 text-emerald-400 border-emerald-600/30">Custom</Badge>
                            </div>
                            <p className="text-sm text-zinc-400 mt-1">{role.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditRole(role)}>
                            <Edit2 size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteRole(role.role_id)} className="text-red-400 hover:text-red-300">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={16} />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48 bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.all_roles?.map(role => (
                    <SelectItem key={role.role_id} value={role.role_id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3">
            {filteredUsers.map((user) => (
              <Card key={user.user_id || user.email} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center">
                        <span className="text-violet-400 font-semibold">
                          {(user.name || user.email || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{user.name || "Unnamed User"}</h4>
                        <p className="text-sm text-zinc-400">{user.email || user.phone || "No contact"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        style={{ 
                          backgroundColor: roles.all_roles?.find(r => r.role_id === user.assigned_role)?.color + '20',
                          color: roles.all_roles?.find(r => r.role_id === user.assigned_role)?.color || '#888',
                          borderColor: roles.all_roles?.find(r => r.role_id === user.assigned_role)?.color + '50'
                        }}
                        className="border"
                      >
                        {user.role_name || user.assigned_role}
                      </Badge>
                      <Badge variant="outline" className="text-zinc-400 border-zinc-700">
                        {user.user_type}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => openAssignModal(user)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                        <UserCheck size={14} className="mr-1" /> Change Role
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                No users found matching your filters
              </div>
            )}
          </div>
        </TabsContent>

        {/* Permissions Matrix Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-white">Category Permissions Management</h2>
              <p className="text-sm text-zinc-400">Toggle permissions on/off for each user category</p>
            </div>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-3">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse">
                  Unsaved Changes
                </Badge>
                <Button 
                  onClick={handleSavePermissions} 
                  disabled={savingPermissions}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save size={16} className="mr-2" />
                  {savingPermissions ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </div>

          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white flex items-center gap-2">
                <Shield size={20} className="text-violet-400" />
                Permissions Matrix
              </CardTitle>
              <CardDescription>Click checkboxes to enable/disable permissions for each user category. Changes are saved when you click &quot;Save Changes&quot;.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="permissions-matrix-table">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/80">
                      <th className="text-left p-3 text-zinc-400 font-medium sticky left-0 bg-zinc-950 min-w-52 z-10">Permission</th>
                      {categoryPermissions.map(cat => (
                        <th key={cat.role_id} className="p-3 text-center min-w-28">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                            <span className="text-xs text-zinc-300 font-medium">{cat.name.split(' ')[0]}</span>
                            {cat.is_customized && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/50 text-amber-400">
                                Modified
                              </Badge>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedPermissions).map(([category, perms]) => (
                      <>
                        <tr key={`cat-${category}`} className="bg-zinc-950/50">
                          <td colSpan={categoryPermissions.length + 1} className="p-2 text-xs font-semibold text-violet-400 uppercase tracking-wide">
                            {category}
                          </td>
                        </tr>
                        {perms.map(perm => (
                          <tr key={perm.permission_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                            <td className="p-3 text-sm text-zinc-300 sticky left-0 bg-zinc-900 z-10">
                              <div>
                                <span className="font-medium">{perm.name}</span>
                                <p className="text-xs text-zinc-500 mt-0.5">{perm.description}</p>
                              </div>
                            </td>
                            {categoryPermissions.map(cat => {
                              const isChecked = editedPermissions[cat.role_id]?.includes(perm.permission_id) ?? false;
                              const wasOriginallyChecked = cat.permissions?.includes(perm.permission_id) ?? false;
                              const hasChanged = isChecked !== wasOriginallyChecked;
                              
                              return (
                                <td key={cat.role_id} className="p-3 text-center">
                                  <div className="flex justify-center">
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={() => handlePermissionToggle(cat.role_id, perm.permission_id)}
                                      className={`border-zinc-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 ${hasChanged ? 'ring-2 ring-amber-500/50' : ''}`}
                                      data-testid={`perm-${cat.role_id}-${perm.permission_id}`}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Reset Options */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Reset Permissions</CardTitle>
              <CardDescription>Reset a category&apos;s permissions back to system defaults</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categoryPermissions.filter(c => c.is_customized).map(cat => (
                  <Button
                    key={cat.role_id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetPermissions(cat.role_id)}
                    className="border-zinc-700 text-zinc-300 hover:bg-red-600/20 hover:border-red-500/50 hover:text-red-400"
                  >
                    <Unlock size={14} className="mr-1" />
                    Reset {cat.name}
                  </Button>
                ))}
                {categoryPermissions.filter(c => c.is_customized).length === 0 && (
                  <p className="text-sm text-zinc-500">All categories are using default permissions</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">Role Change Audit Log</CardTitle>
              <CardDescription>Track all role assignments and modifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div key={log.log_id} className="flex items-start gap-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      log.action === 'assign' ? 'bg-emerald-600/20 text-emerald-400' :
                      log.action === 'revoke' ? 'bg-red-600/20 text-red-400' :
                      log.action === 'create_role' ? 'bg-blue-600/20 text-blue-400' :
                      'bg-amber-600/20 text-amber-400'
                    }`}>
                      {log.action === 'assign' ? <UserCheck size={14} /> :
                       log.action === 'revoke' ? <Lock size={14} /> :
                       log.action === 'create_role' ? <Plus size={14} /> :
                       <Edit2 size={14} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white capitalize">{log.action.replace('_', ' ')}</span>
                        <Badge variant="outline" className="text-xs">{log.role_name}</Badge>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        {log.user_name ? `User: ${log.user_name}` : ''} 
                        {log.previous_role_name ? ` (from ${log.previous_role_name})` : ''}
                        {log.reason ? ` — ${log.reason}` : ''}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        By {log.performed_by_name || log.performed_by} • {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <div className="text-center py-8 text-zinc-500">
                    No audit logs yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Role Modal */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingRole ? 'Edit Custom Role' : 'Create Custom Role'}
            </DialogTitle>
            <DialogDescription>
              Define a custom role with specific permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Role Name</label>
                <Input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g., Content Reviewer"
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Base on System Role</label>
                <Select value={roleForm.based_on || "none"} onValueChange={handleBasedOnChange}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select a base role" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="none">None</SelectItem>
                    {roles.system_roles.map(role => (
                      <SelectItem key={role.role_id} value={role.role_id}>{role.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Description</label>
              <Input
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="What is this role for?"
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Role Color</label>
              <div className="flex gap-2">
                {['#9c27b0', '#e91e63', '#f44336', '#4caf50', '#2196f3', '#ff9800', '#795548', '#607d8b'].map(color => (
                  <button
                    key={color}
                    onClick={() => setRoleForm({ ...roleForm, color })}
                    className={`w-8 h-8 rounded-full border-2 ${roleForm.color === color ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Permissions</label>
              <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
                {Object.entries(groupedPermissions).map(([category, perms]) => {
                  const CategoryIcon = CATEGORY_ICONS[category] || Lock;
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-violet-400">
                        <CategoryIcon size={14} />
                        {category}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-6">
                        {perms.map(perm => (
                          <div key={perm.permission_id} className="flex items-center gap-2">
                            <Checkbox
                              checked={roleForm.permissions.includes(perm.permission_id)}
                              onCheckedChange={() => togglePermission(perm.permission_id)}
                              className="border-zinc-600 data-[state=checked]:bg-violet-600"
                            />
                            <span className="text-sm text-zinc-300">{perm.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleModalOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button onClick={handleCreateRole} className="bg-violet-600 hover:bg-violet-700">
              <Save size={16} className="mr-2" /> {editingRole ? 'Update Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Assign Role</DialogTitle>
            <DialogDescription>
              Change role for {selectedUser?.name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Select Role</label>
              <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {roles.all_roles?.map(role => (
                    <SelectItem key={role.role_id} value={role.role_id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: role.color }}></div>
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Notes (optional)</label>
              <Input
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Reason for role change"
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button onClick={handleAssignRole} className="bg-violet-600 hover:bg-violet-700">
              <UserCheck size={16} className="mr-2" /> Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
