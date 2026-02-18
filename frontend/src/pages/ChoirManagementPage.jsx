import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Users, Music2, DollarSign, Clock, Search, Plus, Eye, Edit2,
  CheckCircle, XCircle, MoreVertical, Phone, Building, Church, Key,
  Power, Trash2, Send, MessageSquare, History, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DENOMINATIONS = [
  { value: "roman_catholic", label: "Roman Catholic" },
  { value: "lutheran", label: "Lutheran" },
  { value: "anglican", label: "Anglican" },
  { value: "pentecostal", label: "Pentecostal" },
  { value: "evangelical", label: "Evangelical" },
  { value: "adventist", label: "Seventh-day Adventist" },
  { value: "baptist", label: "Baptist" },
  { value: "methodist", label: "Methodist" },
  { value: "orthodox", label: "Orthodox" },
  { value: "other", label: "Other" }
];

export default function ChoirManagementPage() {
  const navigate = useNavigate();
  const [choirs, setChoirs] = useState([]);
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  
  // New states for choir management
  const [activeTab, setActiveTab] = useState("choirs");
  const [auditLogs, setAuditLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedChoirs, setSelectedChoirs] = useState([]);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [selectedChoirForAction, setSelectedChoirForAction] = useState(null);
  const [notificationForm, setNotificationForm] = useState({
    subject: "",
    message: "",
    type: "info"
  });
  const [selectedChoir, setSelectedChoir] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  
  const [choirForm, setChoirForm] = useState({
    name: "",
    denomination: "",
    church_id: "",
    treasurer_name: "",
    treasurer_phone: "",
    chairman_name: "",
    chairman_phone: "",
    parish_priest_name: "",
    parish_priest_phone: "",
    bio: ""
  });

  const fetchData = async () => {
    try {
      const [choirsRes, churchesRes, logsRes, notifsRes] = await Promise.all([
        axios.get(`${API}/admin/choirs`, { withCredentials: true }),
        axios.get(`${API}/churches`, { withCredentials: true }),
        axios.get(`${API}/admin/choir-audit-logs?limit=50`, { withCredentials: true }).catch(() => ({ data: { logs: [] } })),
        axios.get(`${API}/admin/choir-notifications?limit=50`, { withCredentials: true }).catch(() => ({ data: { notifications: [] } }))
      ]);
      setChoirs(choirsRes.data.choirs || []);
      setChurches(churchesRes.data.churches || []);
      setAuditLogs(logsRes.data.logs || []);
      setNotifications(notifsRes.data.notifications || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load choirs");
    } finally {
      setLoading(false);
    }
  };

  // Disable choir
  const handleDisableChoir = async () => {
    if (!selectedChoirForAction) return;
    try {
      await axios.post(`${API}/admin/choir/${selectedChoirForAction.singer_id}/disable`, 
        { reason: actionReason || "Disabled by admin" },
        { withCredentials: true }
      );
      toast.success(`Choir "${selectedChoirForAction.name}" has been disabled`);
      setIsDisableModalOpen(false);
      setActionReason("");
      setSelectedChoirForAction(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to disable choir");
    }
  };

  // Enable choir
  const handleEnableChoir = async (choir) => {
    try {
      await axios.post(`${API}/admin/choir/${choir.singer_id}/enable`, 
        { reason: "Enabled by admin" },
        { withCredentials: true }
      );
      toast.success(`Choir "${choir.name}" has been enabled`);
      fetchData();
    } catch (error) {
      toast.error("Failed to enable choir");
    }
  };

  // Delete choir
  const handleDeleteChoir = async () => {
    if (!selectedChoirForAction) return;
    try {
      await axios.delete(`${API}/admin/choir/${selectedChoirForAction.singer_id}`, 
        { data: { reason: actionReason || "Deleted by admin" }, withCredentials: true }
      );
      toast.success(`Choir "${selectedChoirForAction.name}" has been deleted`);
      setIsDeleteModalOpen(false);
      setActionReason("");
      setSelectedChoirForAction(null);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete choir");
    }
  };

  // Send notification to choirs
  const handleSendNotification = async () => {
    if (!notificationForm.message || selectedChoirs.length === 0) {
      toast.error("Please select at least one choir and enter a message");
      return;
    }
    try {
      await axios.post(`${API}/admin/choir-notifications/send`, {
        choir_ids: selectedChoirs,
        subject: notificationForm.subject,
        message: notificationForm.message,
        type: notificationForm.type
      }, { withCredentials: true });
      toast.success(`Notification sent to ${selectedChoirs.length} choir(s)`);
      setIsNotificationModalOpen(false);
      setNotificationForm({ subject: "", message: "", type: "info" });
      setSelectedChoirs([]);
      fetchData();
    } catch (error) {
      toast.error("Failed to send notification");
    }
  };

  // Toggle choir selection
  const toggleChoirSelection = (choirId) => {
    setSelectedChoirs(prev => 
      prev.includes(choirId) 
        ? prev.filter(id => id !== choirId)
        : [...prev, choirId]
    );
  };

  // Select all choirs
  const selectAllChoirs = () => {
    const activeChoirs = choirs.filter(c => c.status === 'active').map(c => c.singer_id);
    setSelectedChoirs(activeChoirs);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateChoir = async (e) => {
    e.preventDefault();
    try {
      // Find church name if selected
      let church_name = "";
      if (choirForm.church_id) {
        const church = churches.find(c => c.church_id === choirForm.church_id);
        church_name = church?.name || "";
      }
      
      await axios.post(`${API}/admin/choirs`, {
        ...choirForm,
        church_name
      }, { withCredentials: true });
      
      toast.success("Choir created successfully");
      setIsCreateModalOpen(false);
      setChoirForm({
        name: "", denomination: "", church_id: "", treasurer_name: "",
        treasurer_phone: "", chairman_name: "", chairman_phone: "",
        parish_priest_name: "", parish_priest_phone: "", bio: ""
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create choir");
    }
  };

  const handleUpdateChoir = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/choirs/${selectedChoir.singer_id}`, choirForm, { withCredentials: true });
      toast.success("Choir updated successfully");
      setIsEditModalOpen(false);
      setSelectedChoir(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update choir");
    }
  };

  const handleStatusChange = async (choirId, newStatus) => {
    try {
      await axios.put(`${API}/admin/choirs/${choirId}`, { status: newStatus }, { withCredentials: true });
      toast.success(`Choir ${newStatus}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleApprovalChange = async (choirId, approvalStatus) => {
    try {
      await axios.put(`${API}/admin/choirs/${choirId}`, { approval_status: approvalStatus }, { withCredentials: true });
      toast.success(`Choir ${approvalStatus}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update approval");
    }
  };

  const openEditModal = (choir) => {
    setSelectedChoir(choir);
    setChoirForm({
      name: choir.name || "",
      denomination: choir.denomination || "",
      church_id: choir.church_id || "",
      treasurer_name: choir.treasurer_name || "",
      treasurer_phone: choir.treasurer_phone || "",
      chairman_name: choir.chairman_name || "",
      chairman_phone: choir.chairman_phone || "",
      parish_priest_name: choir.parish_priest_name || "",
      parish_priest_phone: choir.parish_priest_phone || "",
      bio: choir.bio || ""
    });
    setIsEditModalOpen(true);
  };

  const openPasswordReset = (choir) => {
    setSelectedChoir(choir);
    setNewPassword("");
    setIsPasswordResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setResettingPassword(true);
    try {
      // Try choir_accounts first, then singers collection
      const choirId = selectedChoir.choir_id || selectedChoir.singer_id;
      await axios.put(`${API}/admin/choir/${choirId}/reset-password`, 
        { new_password: newPassword }, 
        { withCredentials: true }
      );
      toast.success("Password reset successfully!");
      setIsPasswordResetOpen(false);
      setNewPassword("");
      setSelectedChoir(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const filteredChoirs = choirs.filter(choir => {
    const matchesSearch = choir.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         choir.denomination?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || choir.status === filterStatus || choir.approval_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-emerald-500/20 text-emerald-400",
      inactive: "bg-zinc-500/20 text-zinc-400",
      suspended: "bg-red-500/20 text-red-400",
      pending: "bg-amber-500/20 text-amber-400",
      approved: "bg-emerald-500/20 text-emerald-400",
      rejected: "bg-red-500/20 text-red-400"
    };
    return <Badge className={styles[status] || styles.pending}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  // Summary stats
  const totalChoirs = choirs.length;
  const activeChoirs = choirs.filter(c => c.status === "active").length;
  const pendingApproval = choirs.filter(c => c.approval_status === "pending").length;
  const totalRevenue = choirs.reduce((sum, c) => sum + (c.total_earned || 0), 0);

  return (
    <div className="page-container animate-fade-in" data-testid="choir-management-page">
      <div className="page-header">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="page-title">Choir Management</h1>
            <p className="page-subtitle">Manage all choirs, communications, and audit history</p>
          </div>
          <div className="flex gap-2">
            {selectedChoirs.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => setIsNotificationModalOpen(true)}
                className="border-amber-600 text-amber-400 hover:bg-amber-600/10"
              >
                <Send size={16} className="mr-2" /> Message ({selectedChoirs.length})
              </Button>
            )}
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-choir-btn">
              <Plus size={16} className="mr-2" /> Add Choir
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <Users size={20} className="text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalChoirs}</p>
                <p className="text-xs text-zinc-500">Total Choirs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                <CheckCircle size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{activeChoirs}</p>
                <p className="text-xs text-zinc-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <Clock size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pendingApproval}</p>
                <p className="text-xs text-zinc-500">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center">
                <DollarSign size={20} className="text-pink-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">TZS {totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Total Earned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <Input
            placeholder="Search choirs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white"
            data-testid="choir-search-input"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-white">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Choirs List */}
      <div className="space-y-4">
        {filteredChoirs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p>No choirs found</p>
          </div>
        ) : (
          filteredChoirs.map((choir) => (
            <Card key={choir.singer_id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors" data-testid={`choir-card-${choir.singer_id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-14 h-14 rounded-lg bg-violet-600/20 flex items-center justify-center text-violet-400 font-bold text-xl">
                      {choir.name?.charAt(0) || "C"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white truncate">{choir.name}</h3>
                        {getStatusBadge(choir.status)}
                        {choir.approval_status === "pending" && getStatusBadge("pending")}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">
                        {DENOMINATIONS.find(d => d.value === choir.denomination)?.label || choir.denomination || "No denomination"} 
                        {choir.church_name && ` • ${choir.church_name}`}
                      </p>
                      <div className="flex gap-4 mt-2 text-xs text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Music2 size={12} /> {choir.album_count || 0} albums, {choir.song_count || 0} songs
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {(choir.total_hours || 0).toFixed(1)}h streamed
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign size={12} /> TZS {(choir.total_earned || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/admin/choirs/${choir.singer_id}`)}
                      className="border-zinc-700 text-zinc-300"
                      data-testid={`view-choir-${choir.singer_id}`}
                    >
                      <Eye size={14} className="mr-1" /> View
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-zinc-400">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                        <DropdownMenuItem onClick={() => openEditModal(choir)} className="text-zinc-300 hover:text-white">
                          <Edit2 size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openPasswordReset(choir)} className="text-violet-400 hover:text-violet-300">
                          <Key size={14} className="mr-2" /> Reset Password
                        </DropdownMenuItem>
                        {choir.approval_status === "pending" && (
                          <DropdownMenuItem onClick={() => handleApprovalChange(choir.singer_id, "approved")} className="text-emerald-400">
                            <CheckCircle size={14} className="mr-2" /> Approve
                          </DropdownMenuItem>
                        )}
                        {choir.status === "active" ? (
                          <DropdownMenuItem onClick={() => handleStatusChange(choir.singer_id, "suspended")} className="text-amber-400">
                            <XCircle size={14} className="mr-2" /> Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleStatusChange(choir.singer_id, "active")} className="text-emerald-400">
                            <CheckCircle size={14} className="mr-2" /> Activate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Choir Modal */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedChoir(null);
        }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditModalOpen ? "Edit Choir" : "Add New Choir"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={isEditModalOpen ? handleUpdateChoir : handleCreateChoir}>
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Choir Name *</label>
                  <Input
                    value={choirForm.name}
                    onChange={(e) => setChoirForm({ ...choirForm, name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                    data-testid="choir-name-input"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Denomination</label>
                  <Select value={choirForm.denomination} onValueChange={(v) => setChoirForm({ ...choirForm, denomination: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue placeholder="Select denomination" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {DENOMINATIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Church/Parish</label>
                <Select value={choirForm.church_id} onValueChange={(v) => setChoirForm({ ...choirForm, church_id: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select church" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {churches.map(c => (
                      <SelectItem key={c.church_id} value={c.church_id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Treasurer */}
              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                  <DollarSign size={14} /> Treasurer Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Treasurer Name</label>
                    <Input
                      value={choirForm.treasurer_name}
                      onChange={(e) => setChoirForm({ ...choirForm, treasurer_name: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 text-white"
                      data-testid="treasurer-name-input"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Treasurer Phone</label>
                    <Input
                      value={choirForm.treasurer_phone}
                      onChange={(e) => setChoirForm({ ...choirForm, treasurer_phone: e.target.value })}
                      placeholder="+255..."
                      className="bg-zinc-950 border-zinc-800 text-white"
                      data-testid="treasurer-phone-input"
                    />
                  </div>
                </div>
              </div>

              {/* Chairman */}
              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                  <Users size={14} /> Chairman Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Chairman Name</label>
                    <Input
                      value={choirForm.chairman_name}
                      onChange={(e) => setChoirForm({ ...choirForm, chairman_name: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Chairman Phone</label>
                    <Input
                      value={choirForm.chairman_phone}
                      onChange={(e) => setChoirForm({ ...choirForm, chairman_phone: e.target.value })}
                      placeholder="+255..."
                      className="bg-zinc-950 border-zinc-800 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Parish Priest */}
              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                  <Church size={14} /> Parish Priest/Leader Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Priest/Leader Name</label>
                    <Input
                      value={choirForm.parish_priest_name}
                      onChange={(e) => setChoirForm({ ...choirForm, parish_priest_name: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Priest/Leader Phone</label>
                    <Input
                      value={choirForm.parish_priest_phone}
                      onChange={(e) => setChoirForm({ ...choirForm, parish_priest_phone: e.target.value })}
                      placeholder="+255..."
                      className="bg-zinc-950 border-zinc-800 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="border-t border-zinc-800 pt-4">
                <label className="text-sm text-zinc-400 mb-1 block">Bio/Description</label>
                <Textarea
                  value={choirForm.bio}
                  onChange={(e) => setChoirForm({ ...choirForm, bio: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }} className="border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-choir-btn">
                {isEditModalOpen ? "Update" : "Create"} Choir
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Modal */}
      <Dialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key size={20} className="text-violet-400" />
              Reset Choir Password
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-sm text-zinc-400">Resetting password for:</p>
              <p className="font-semibold text-white">{selectedChoir?.name}</p>
              <p className="text-xs text-zinc-500">{selectedChoir?.email}</p>
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="bg-zinc-950 border-zinc-700"
                data-testid="new-password-input"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsPasswordResetOpen(false)} 
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={resettingPassword || newPassword.length < 6}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="confirm-reset-btn"
            >
              {resettingPassword ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
