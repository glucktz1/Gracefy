import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Users, Search, Plus, Edit2, Trash2, MoreVertical, Shield, User, 
  Phone, Mail, Calendar, Clock, CreditCard, Music2, Smartphone, 
  FileText, ChevronLeft, Eye, Ban, CheckCircle, Filter, Download,
  Globe, Crown, Activity, History, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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

// Country flags mapping
const COUNTRY_FLAGS = {
  "Tanzania": "🇹🇿",
  "Kenya": "🇰🇪",
  "Uganda": "🇺🇬",
  "Rwanda": "🇷🇼",
  "Burundi": "🇧🇮",
  "DRC": "🇨🇩",
  "South Africa": "🇿🇦",
  "Nigeria": "🇳🇬",
  "Ghana": "🇬🇭",
  "USA": "🇺🇸",
  "UK": "🇬🇧",
  "default": "🌍"
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState("profile");
  
  // Stats
  const [stats, setStats] = useState(null);
  
  // Filters
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [registerByFilter, setRegisterByFilter] = useState("all");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const itemsPerPage = 10;

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "customer",
    status: "active",
    membership_type: "free",
    country: ""
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        membership_type: membershipFilter !== "all" ? membershipFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        register_by: registerByFilter !== "all" ? registerByFilter : undefined,
      };
      
      const response = await axios.get(`${API}/admin/all-users`, {
        params,
        withCredentials: true
      });
      
      setUsers(response.data.users || []);
      setTotalUsers(response.data.total || response.data.users?.length || 0);
    } catch (error) {
      console.error("Error fetching users:", error);
      // Fallback to old endpoint
      try {
        const response = await axios.get(`${API}/users`, { withCredentials: true });
        setUsers(response.data.users || []);
        setTotalUsers(response.data.users?.length || 0);
      } catch (e) {
        toast.error("Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, membershipFilter, statusFilter, registerByFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/users/stats/summary`, { withCredentials: true });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [fetchUsers, fetchStats]);

  const fetchUserDetails = async (userId) => {
    try {
      const [profileRes, historyRes, transactionsRes, downloadsRes] = await Promise.all([
        axios.get(`${API}/admin/users/${userId}`, { withCredentials: true }).catch(() => null),
        axios.get(`${API}/admin/users/${userId}/listening-history`, { withCredentials: true }).catch(() => ({ data: { history: [] } })),
        axios.get(`${API}/admin/users/${userId}/transactions`, { withCredentials: true }).catch(() => ({ data: { transactions: [] } })),
        axios.get(`${API}/admin/users/${userId}/downloads`, { withCredentials: true }).catch(() => ({ data: { downloads: [] } }))
      ]);
      
      setUserDetails({
        profile: profileRes?.data || viewingUser,
        listeningHistory: historyRes?.data?.history || [],
        transactions: transactionsRes?.data?.transactions || [],
        downloads: downloadsRes?.data?.downloads || []
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      setUserDetails({
        profile: viewingUser,
        listeningHistory: [],
        transactions: [],
        downloads: []
      });
    }
  };

  const handleViewUser = (user) => {
    setViewingUser(user);
    setActiveDetailTab("profile");
    fetchUserDetails(user.user_id);
  };

  const handleBackToList = () => {
    setViewingUser(null);
    setUserDetails(null);
  };

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
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "customer",
      status: "active",
      membership_type: "free",
      country: ""
    });
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "customer",
      status: user.status || "active",
      membership_type: user.membership_type || user.subscription_tier || "free",
      country: user.country || ""
    });
    setIsModalOpen(true);
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await axios.put(`${API}/users/${userId}`, { status: newStatus }, { withCredentials: true });
      toast.success(`User ${newStatus === "suspended" ? "deactivated" : "activated"}`);
      fetchUsers();
      if (viewingUser?.user_id === userId) {
        setViewingUser({ ...viewingUser, status: newStatus });
      }
    } catch (error) {
      toast.error("Failed to update user status");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { withCredentials: true });
      toast.success("User deleted successfully");
      fetchUsers();
      if (viewingUser?.user_id === userId) {
        handleBackToList();
      }
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      suspended: "bg-red-500/20 text-red-400 border-red-500/30",
      inactive: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
      pending: "bg-amber-500/20 text-amber-400 border-amber-500/30"
    };
    return (
      <Badge className={`${styles[status] || styles.pending} border`}>
        {status === "active" ? "Active" : status === "suspended" ? "Inactive" : status}
      </Badge>
    );
  };

  const getMembershipBadge = (type) => {
    const styles = {
      free: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
      premium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      vip: "bg-violet-500/20 text-violet-400 border-violet-500/30"
    };
    return (
      <Badge className={`${styles[type] || styles.free} border`}>
        {type === "premium" ? "Premium" : type === "vip" ? "VIP" : "Free"}
      </Badge>
    );
  };

  const getCountryFlag = (country) => {
    return COUNTRY_FLAGS[country] || COUNTRY_FLAGS.default;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(totalUsers / itemsPerPage);

  // User Detail View
  if (viewingUser) {
    return (
      <div className="page-container animate-fade-in" data-testid="user-detail-view">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={handleBackToList}
            className="text-zinc-400 hover:text-white"
          >
            <ChevronLeft size={20} className="mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold text-white">Users View</h1>
        </div>

        {/* User Profile Card */}
        <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden">
                {viewingUser.picture ? (
                  <img src={viewingUser.picture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={40} className="text-zinc-600" />
                )}
              </div>
              
              {/* User Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {viewingUser.name || "User"}
                </h2>
                <p className="text-zinc-400 flex items-center gap-2 mb-3">
                  <User size={14} /> {viewingUser.user_id}
                </p>
                
                {/* Membership Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-zinc-700 rounded-lg">
                  <Crown size={18} className={viewingUser.membership_type === "premium" ? "text-amber-400" : "text-zinc-400"} />
                  <div>
                    <p className={`font-semibold ${viewingUser.membership_type === "premium" ? "text-amber-400" : "text-emerald-400"}`}>
                      {viewingUser.membership_type === "premium" ? "Premium" : "Free"}
                    </p>
                    <p className="text-xs text-zinc-500">Membership Type</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(viewingUser)}
                  className="border-zinc-700 text-zinc-300"
                >
                  <Edit2 size={14} className="mr-1" /> Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleStatusChange(viewingUser.user_id, viewingUser.status === "active" ? "suspended" : "active")}
                  className={viewingUser.status === "active" ? "border-red-600 text-red-400" : "border-emerald-600 text-emerald-400"}
                >
                  {viewingUser.status === "active" ? (
                    <><Ban size={14} className="mr-1" /> Deactivate</>
                  ) : (
                    <><CheckCircle size={14} className="mr-1" /> Activate</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
          <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
            <TabsTrigger value="profile" className="data-[state=active]:bg-violet-600">
              Profile Details
            </TabsTrigger>
            <TabsTrigger value="membership" className="data-[state=active]:bg-violet-600">
              Membership
            </TabsTrigger>
            <TabsTrigger value="listening" className="data-[state=active]:bg-violet-600">
              Listening History
            </TabsTrigger>
            <TabsTrigger value="downloads" className="data-[state=active]:bg-violet-600">
              Downloads
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-violet-600">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="devices" className="data-[state=active]:bg-violet-600">
              Devices
            </TabsTrigger>
          </TabsList>

          {/* Profile Details Tab */}
          <TabsContent value="profile">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Personal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Name</p>
                    <p className="text-white font-medium">{viewingUser.name || "User"}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Mobile No</p>
                    <p className="text-white font-medium">{viewingUser.phone || "-"}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Email</p>
                    <p className="text-white font-medium">{viewingUser.email || "-"}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">User ID</p>
                    <p className="text-white font-medium">{viewingUser.user_id}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Register By</p>
                    <p className="text-white font-medium flex items-center gap-2">
                      {viewingUser.register_by === "phone" ? (
                        <><Phone size={14} className="text-emerald-400" /> Mobile No</>
                      ) : viewingUser.register_by === "google" ? (
                        <><Globe size={14} className="text-blue-400" /> Google</>
                      ) : (
                        <><Mail size={14} className="text-violet-400" /> Email</>
                      )}
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Country</p>
                    <p className="text-white font-medium">
                      {viewingUser.country ? `${getCountryFlag(viewingUser.country)} ${viewingUser.country}` : "-"}
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Created At</p>
                    <p className="text-white font-medium">{formatDateTime(viewingUser.created_at)}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Status</p>
                    {getStatusBadge(viewingUser.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Membership Tab */}
          <TabsContent value="membership">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg">Membership Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Membership Type</p>
                    {getMembershipBadge(viewingUser.membership_type || viewingUser.subscription_tier || "free")}
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Current Plan</p>
                    <p className="text-white font-medium">{viewingUser.current_plan || "-"}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Plan Start Date</p>
                    <p className="text-white font-medium">{formatDate(viewingUser.plan_start_date || viewingUser.trial_starts_at)}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Plan Expiry At</p>
                    <p className="text-white font-medium">{formatDate(viewingUser.plan_expiry_at || viewingUser.trial_ends_at)}</p>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Trial Status</p>
                    <Badge className={viewingUser.trial_active ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-400"}>
                      {viewingUser.trial_active ? "Active" : "Expired/None"}
                    </Badge>
                  </div>
                  <div className="p-4 bg-zinc-800/30 rounded-lg">
                    <p className="text-xs text-zinc-500 mb-1">Last Active At</p>
                    <p className="text-white font-medium">{formatDateTime(viewingUser.last_active_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Listening History Tab */}
          <TabsContent value="listening">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Music2 size={18} className="text-violet-400" /> Listening History
                </CardTitle>
                <p className="text-xs text-zinc-500">Recent songs and content consumed by this user</p>
              </CardHeader>
              <CardContent>
                {userDetails?.listeningHistory?.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.listeningHistory.slice(0, 15).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-zinc-700 flex items-center justify-center">
                              <Music2 size={20} className="text-zinc-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium">{item.song_title || item.title || "Unknown Track"}</p>
                            <p className="text-xs text-zinc-500">{item.artist_name || "Unknown Artist"}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-400">
                                {item.content_type || "song"}
                              </Badge>
                              <span className="text-[10px] text-zinc-600">{item.platform || "web"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-emerald-400 font-medium">{item.duration_listened || "-"}</p>
                          <p className="text-xs text-zinc-500">{formatDateTime(item.listened_at || item.start_time)}</p>
                          {item.counted_as_play && (
                            <Badge className="bg-violet-500/20 text-violet-400 text-[10px] mt-1">Counted</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <Music2 size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No listening history available</p>
                    <p className="text-xs mt-1">User hasn't played any content yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <CreditCard size={18} className="text-emerald-400" /> Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userDetails?.transactions?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left text-xs text-zinc-500 py-3 px-2">Transaction ID</th>
                          <th className="text-left text-xs text-zinc-500 py-3 px-2">Type</th>
                          <th className="text-left text-xs text-zinc-500 py-3 px-2">Amount</th>
                          <th className="text-left text-xs text-zinc-500 py-3 px-2">Status</th>
                          <th className="text-left text-xs text-zinc-500 py-3 px-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetails.transactions.map((tx, idx) => (
                          <tr key={idx} className="border-b border-zinc-800/50">
                            <td className="py-3 px-2 text-white text-sm">{tx.transaction_id}</td>
                            <td className="py-3 px-2 text-zinc-400 text-sm">{tx.type}</td>
                            <td className="py-3 px-2 text-emerald-400 text-sm">TSh {tx.amount?.toLocaleString()}</td>
                            <td className="py-3 px-2">
                              <Badge className={tx.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}>
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-zinc-500 text-sm">{formatDateTime(tx.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No transactions available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Devices Tab */}
          <TabsContent value="devices">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Smartphone size={18} className="text-blue-400" /> Devices
                </CardTitle>
              </CardHeader>
              <CardContent>
                {viewingUser.devices?.length > 0 ? (
                  <div className="space-y-3">
                    {viewingUser.devices.map((device, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Smartphone size={24} className="text-zinc-400" />
                          <div>
                            <p className="text-white font-medium">{device.name || device.model || "Unknown Device"}</p>
                            <p className="text-xs text-zinc-500">{device.os} • Last active: {formatDateTime(device.last_active)}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-red-400">
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <Smartphone size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No devices registered</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Export function
  const handleExport = async () => {
    try {
      const allUsers = await axios.get(`${API}/admin/users?page=1&limit=10000`, { withCredentials: true });
      const usersData = allUsers.data.users || [];
      
      const csvContent = [
        ["User ID", "Name", "Email", "Phone", "Country", "Membership", "Status", "Register By", "Created At"].join(","),
        ...usersData.map(u => [
          u.user_id,
          `"${(u.name || '').replace(/"/g, '""')}"`,
          u.email || "",
          u.phone || "",
          u.country || "",
          u.membership_type || "free",
          u.status || "active",
          u.register_by || "email",
          u.created_at || ""
        ].join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Users exported successfully");
    } catch (error) {
      toast.error("Failed to export users");
    }
  };

  // Main Users List View
  return (
    <div className="page-container animate-fade-in" data-testid="users-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage {totalUsers.toLocaleString()} registered users</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-300"
            onClick={handleExport}
            data-testid="export-users-btn"
          >
            <Download size={18} className="mr-2" />
            Export
          </Button>
          <Button
            onClick={() => {
              setEditingUser(null);
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-violet-600 hover:bg-violet-700 rounded-full"
            data-testid="add-user-btn"
          >
            <Plus size={18} className="mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Users size={20} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total?.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.active?.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Crown size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.premium?.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">Premium</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-500/20 flex items-center justify-center">
                  <User size={20} className="text-zinc-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.free?.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">Free</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.trial_active?.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">In Trial</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Ban size={20} className="text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.suspended?.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500">Suspended</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
              <Input
                placeholder={`Search ${totalUsers.toLocaleString()} Users`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500"
                data-testid="search-users"
              />
            </div>
            
            {/* Filters */}
            <div className="flex gap-3">
              <Select value={registerByFilter} onValueChange={setRegisterByFilter}>
                <SelectTrigger className="w-[140px] bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue placeholder="Register By" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="phone">Mobile No</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                </SelectContent>
              </Select>

              <Select value={membershipFilter} onValueChange={setMembershipFilter}>
                <SelectTrigger className="w-[160px] bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue placeholder="Membership Type" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users size={48} className="mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400">No users found</p>
              <p className="text-zinc-600 text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left">
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">User ID</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Email ID / Mobile No.</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Membership Type</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Country</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Register By</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Current Plan</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Plan Expiry At</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Last Active At</th>
                    <th className="py-4 px-4 text-xs font-medium text-zinc-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr 
                      key={user.user_id} 
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                      onClick={() => handleViewUser(user)}
                      data-testid={`user-row-${user.user_id}`}
                    >
                      <td className="py-4 px-4">
                        <span className="text-white font-medium">{user.user_id?.substring(0, 12) || "-"}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCountryFlag(user.country)}</span>
                          <span className="text-zinc-300">{user.phone || user.email || "-"}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {getMembershipBadge(user.membership_type || user.subscription_tier || "free")}
                      </td>
                      <td className="py-4 px-4 text-zinc-400">
                        {user.country || "-"}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-zinc-400">
                          {user.register_by === "phone" ? (
                            <><Phone size={14} className="text-emerald-400" /> Mobile No</>
                          ) : user.register_by === "google" ? (
                            <><Globe size={14} className="text-blue-400" /> Google</>
                          ) : (
                            <><Mail size={14} className="text-violet-400" /> Email</>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-violet-400">
                        {user.current_plan || "-"}
                      </td>
                      <td className="py-4 px-4 text-zinc-400">
                        {formatDateTime(user.plan_expiry_at || user.trial_ends_at)}
                      </td>
                      <td className="py-4 px-4 text-zinc-400">
                        {user.last_active_at ? formatDateTime(user.last_active_at) : "-"}
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(user.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-zinc-800">
              <Select value={String(itemsPerPage)} onValueChange={() => {}}>
                <SelectTrigger className="w-[80px] bg-zinc-950 border-zinc-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="text-zinc-400"
                >
                  First
                </Button>
                {[...Array(Math.min(6, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={currentPage === pageNum ? "bg-blue-500 text-white" : "text-zinc-400"}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {totalPages > 6 && (
                  <>
                    <span className="text-zinc-500 px-2">...</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="text-zinc-400"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="text-zinc-400"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editingUser ? "Update user details" : "Create a new user account"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="+255..."
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="text-sm text-zinc-400 mb-1 block">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Membership Type</label>
                  <Select value={formData.membership_type} onValueChange={(v) => setFormData({ ...formData, membership_type: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <label className="text-sm text-zinc-400 mb-1 block">Status</label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="form-group">
                <label className="text-sm text-zinc-400 mb-1 block">Country</label>
                <Select value={formData.country} onValueChange={(v) => setFormData({ ...formData, country: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="Tanzania">🇹🇿 Tanzania</SelectItem>
                    <SelectItem value="Kenya">🇰🇪 Kenya</SelectItem>
                    <SelectItem value="Uganda">🇺🇬 Uganda</SelectItem>
                    <SelectItem value="Rwanda">🇷🇼 Rwanda</SelectItem>
                    <SelectItem value="DRC">🇨🇩 DRC</SelectItem>
                    <SelectItem value="South Africa">🇿🇦 South Africa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                {editingUser ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
