import { useEffect, useState } from "react";
import axios from "axios";
import { 
  User, Plus, Edit2, Trash2, MoreVertical, Search, Building2, 
  MapPin, CreditCard, Eye, CheckCircle, XCircle, Upload, Users,
  DollarSign, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ReligiousLeadersPage() {
  const [leaders, setLeaders] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [denominations, setDenominations] = useState([]);
  const [pendingTeachings, setPendingTeachings] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [selectedLeader, setSelectedLeader] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDenomination, setFilterDenomination] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("leaders");

  const [formData, setFormData] = useState({
    name: "",
    name_sw: "",
    title: "",
    profile_image: "",
    bio: "",
    bio_sw: "",
    denomination: "",
    denomination_other: "",
    diocese: "",
    parish_name: "",
    parish_location: "",
    region: "",
    country: "Tanzania",
    is_paid: false,
    payment_method: "",
    payment_details: {},
    revenue_share_percentage: 60,
    is_featured: false,
    status: "active"
  });

  const [accountFormData, setAccountFormData] = useState({
    leader_id: "",
    email: "",
    password: ""
  });

  // Fetch all data
  const fetchData = async () => {
    try {
      const [leadersRes, denomsRes, accountsRes, pendingRes, withdrawalsRes] = await Promise.all([
        axios.get(`${API}/admin/leaders`, { withCredentials: true }),
        axios.get(`${API}/denominations`, { withCredentials: true }),
        axios.get(`${API}/admin/leader-accounts`, { withCredentials: true }),
        axios.get(`${API}/admin/pending-teachings`, { withCredentials: true }),
        axios.get(`${API}/admin/leader-withdrawals`, { withCredentials: true })
      ]);
      setLeaders(leadersRes.data.leaders || []);
      setDenominations(denomsRes.data.denominations || []);
      setAccounts(accountsRes.data.accounts || []);
      setPendingTeachings(pendingRes.data.teachings || []);
      setWithdrawals(withdrawalsRes.data.withdrawals || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter leaders
  const filteredLeaders = leaders.filter(leader => {
    const matchesSearch = !searchQuery || 
      leader.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leader.parish_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      leader.diocese?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDenom = filterDenomination === "all" || leader.denomination === filterDenomination;
    const matchesStatus = filterStatus === "all" || leader.status === filterStatus;
    return matchesSearch && matchesDenom && matchesStatus;
  });

  // Handle leader form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLeader) {
        await axios.put(`${API}/admin/leaders/${editingLeader.leader_id}`, formData, { withCredentials: true });
        toast.success("Leader updated successfully");
      } else {
        await axios.post(`${API}/admin/leaders`, formData, { withCredentials: true });
        toast.success("Leader created successfully");
      }
      setIsModalOpen(false);
      setEditingLeader(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  // Handle account creation
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/leader/account/create`, accountFormData, { withCredentials: true });
      toast.success("Account created successfully");
      setIsAccountModalOpen(false);
      setAccountFormData({ leader_id: "", email: "", password: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create account");
    }
  };

  // Approve account
  const handleApproveAccount = async (accountId) => {
    try {
      await axios.post(`${API}/admin/leader-accounts/${accountId}/approve`, {}, { withCredentials: true });
      toast.success("Account approved");
      fetchData();
    } catch (error) {
      toast.error("Failed to approve account");
    }
  };

  // Approve/Reject teaching
  const handleTeachingAction = async (teachingId, action) => {
    try {
      if (action === "approve") {
        await axios.post(`${API}/admin/teachings/${teachingId}/approve`, {}, { withCredentials: true });
        toast.success("Teaching approved");
      } else {
        await axios.post(`${API}/admin/teachings/${teachingId}/reject`, { reason: "Rejected by admin" }, { withCredentials: true });
        toast.success("Teaching rejected");
      }
      fetchData();
    } catch (error) {
      toast.error("Failed to process teaching");
    }
  };

  // Process withdrawal
  const handleWithdrawal = async (withdrawalId, action) => {
    try {
      await axios.post(`${API}/admin/leader-withdrawals/${withdrawalId}/process`, { action }, { withCredentials: true });
      toast.success(action === "approve" ? "Withdrawal approved" : "Withdrawal rejected");
      fetchData();
    } catch (error) {
      toast.error("Failed to process withdrawal");
    }
  };

  // Delete leader
  const handleDelete = async (leaderId) => {
    if (!window.confirm("Are you sure you want to delete this leader?")) return;
    try {
      await axios.delete(`${API}/admin/leaders/${leaderId}`, { withCredentials: true });
      toast.success("Leader deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete leader");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      name_sw: "",
      title: "",
      profile_image: "",
      bio: "",
      bio_sw: "",
      denomination: "",
      denomination_other: "",
      diocese: "",
      parish_name: "",
      parish_location: "",
      region: "",
      country: "Tanzania",
      is_paid: false,
      payment_method: "",
      payment_details: {},
      revenue_share_percentage: 60,
      is_featured: false,
      status: "active"
    });
  };

  const handleEdit = (leader) => {
    setEditingLeader(leader);
    setFormData({
      name: leader.name || "",
      name_sw: leader.name_sw || "",
      title: leader.title || "",
      profile_image: leader.profile_image || "",
      bio: leader.bio || "",
      bio_sw: leader.bio_sw || "",
      denomination: leader.denomination || "",
      denomination_other: leader.denomination_other || "",
      diocese: leader.diocese || "",
      parish_name: leader.parish_name || "",
      parish_location: leader.parish_location || "",
      region: leader.region || "",
      country: leader.country || "Tanzania",
      is_paid: leader.is_paid || false,
      payment_method: leader.payment_method || "",
      payment_details: leader.payment_details || {},
      revenue_share_percentage: leader.revenue_share_percentage || 60,
      is_featured: leader.is_featured || false,
      status: leader.status || "active"
    });
    setIsModalOpen(true);
  };

  const getDenominationName = (id) => {
    const denom = denominations.find(d => d.id === id);
    return denom?.name || id;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <User className="w-8 h-8 text-violet-500" />
          <div>
            <h1 className="text-2xl font-bold">Religious Leaders</h1>
            <p className="text-zinc-400 text-sm">Manage religious leaders and their content</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setEditingLeader(null); setIsModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700" data-testid="add-leader-btn">
          <Plus size={18} className="mr-2" /> Add Leader
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-800">
          <TabsTrigger value="leaders" className="data-[state=active]:bg-violet-600">
            <Users size={16} className="mr-2" /> Leaders ({leaders.length})
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-violet-600">
            <User size={16} className="mr-2" /> Accounts ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-violet-600">
            <BookOpen size={16} className="mr-2" /> Pending Approvals ({pendingTeachings.length})
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="data-[state=active]:bg-violet-600">
            <DollarSign size={16} className="mr-2" /> Withdrawals ({withdrawals.filter(w => w.status === 'pending').length})
          </TabsTrigger>
        </TabsList>

        {/* Leaders Tab */}
        <TabsContent value="leaders" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" size={18} />
              <Input
                placeholder="Search leaders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-700"
              />
            </div>
            <Select value={filterDenomination} onValueChange={setFilterDenomination}>
              <SelectTrigger className="w-48 bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Denomination" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all">All Denominations</SelectItem>
                {denominations.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leaders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeaders.map(leader => (
              <Card key={leader.leader_id} className="bg-zinc-900 border-zinc-800 hover:border-violet-500/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                      {leader.profile_image ? (
                        <img src={leader.profile_image} alt={leader.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-8 h-8 text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold truncate">{leader.title} {leader.name}</h3>
                          <p className="text-sm text-zinc-400">{getDenominationName(leader.denomination)}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-zinc-900 border-zinc-700">
                            <DropdownMenuItem onClick={() => handleEdit(leader)}>
                              <Edit2 size={14} className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedLeader(leader); setAccountFormData({ leader_id: leader.leader_id, email: "", password: "" }); setIsAccountModalOpen(true); }}>
                              <User size={14} className="mr-2" /> Create Account
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(leader.leader_id)} className="text-red-400">
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <Building2 size={12} /> {leader.parish_name || "No parish"}
                        </p>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                          <MapPin size={12} /> {leader.diocese || "No diocese"}, {leader.region || ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className={leader.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                          {leader.status}
                        </Badge>
                        {leader.is_featured && <Badge className="bg-amber-500/20 text-amber-400">Featured</Badge>}
                        {leader.is_paid && <Badge className="bg-blue-500/20 text-blue-400">Paid</Badge>}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        <span>{leader.teachings_count || 0} teachings</span>
                        <span>{leader.total_plays || 0} plays</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {filteredLeaders.length === 0 && (
            <div className="text-center py-12 text-zinc-400">
              <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No leaders found</p>
            </div>
          )}
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="bg-zinc-900 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Leader</th>
                  <th className="px-4 py-3 text-left text-sm">Email</th>
                  <th className="px-4 py-3 text-left text-sm">Status</th>
                  <th className="px-4 py-3 text-left text-sm">Created</th>
                  <th className="px-4 py-3 text-left text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {accounts.map(account => (
                  <tr key={account.account_id} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-3">{account.leader_name}</td>
                    <td className="px-4 py-3 text-zinc-400">{account.email}</td>
                    <td className="px-4 py-3">
                      <Badge className={account.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : account.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>
                        {account.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {new Date(account.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {account.status === 'pending' && (
                        <Button size="sm" onClick={() => handleApproveAccount(account.account_id)} className="bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle size={14} className="mr-1" /> Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {accounts.length === 0 && (
              <div className="text-center py-8 text-zinc-400">No accounts found</div>
            )}
          </div>
        </TabsContent>

        {/* Pending Approvals Tab */}
        <TabsContent value="pending" className="space-y-4">
          <div className="space-y-4">
            {pendingTeachings.map(teaching => (
              <Card key={teaching.teaching_id} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{teaching.title}</h3>
                      <p className="text-sm text-zinc-400">By {teaching.leader_name}</p>
                      <p className="text-xs text-zinc-500 mt-1">{teaching.description?.substring(0, 100)}...</p>
                      <p className="text-xs text-zinc-500 mt-2">
                        Submitted: {new Date(teaching.submitted_at || teaching.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleTeachingAction(teaching.teaching_id, 'approve')} className="bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle size={14} className="mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleTeachingAction(teaching.teaching_id, 'reject')} className="border-red-500 text-red-400 hover:bg-red-500/10">
                        <XCircle size={14} className="mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {pendingTeachings.length === 0 && (
              <div className="text-center py-12 text-zinc-400">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pending teachings</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals" className="space-y-4">
          <div className="bg-zinc-900 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">Leader</th>
                  <th className="px-4 py-3 text-left text-sm">Amount</th>
                  <th className="px-4 py-3 text-left text-sm">Method</th>
                  <th className="px-4 py-3 text-left text-sm">Status</th>
                  <th className="px-4 py-3 text-left text-sm">Requested</th>
                  <th className="px-4 py-3 text-left text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {withdrawals.map(withdrawal => (
                  <tr key={withdrawal.withdrawal_id} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-3">{withdrawal.leader_name}</td>
                    <td className="px-4 py-3 font-medium">TZS {withdrawal.amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-400 capitalize">{withdrawal.payment_method?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <Badge className={
                        withdrawal.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 
                        withdrawal.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 
                        'bg-red-500/20 text-red-400'
                      }>
                        {withdrawal.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">
                      {new Date(withdrawal.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {withdrawal.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleWithdrawal(withdrawal.withdrawal_id, 'approve')} className="bg-emerald-600 hover:bg-emerald-700">
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleWithdrawal(withdrawal.withdrawal_id, 'reject')} className="border-red-500 text-red-400">
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {withdrawals.length === 0 && (
              <div className="text-center py-8 text-zinc-400">No withdrawal requests</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Leader Form Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLeader ? 'Edit Leader' : 'Add New Leader'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Title</label>
                <Select value={formData.title} onValueChange={(v) => setFormData({ ...formData, title: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="Father">Father</SelectItem>
                    <SelectItem value="Pastor">Pastor</SelectItem>
                    <SelectItem value="Bishop">Bishop</SelectItem>
                    <SelectItem value="Reverend">Reverend</SelectItem>
                    <SelectItem value="Mchungaji">Mchungaji</SelectItem>
                    <SelectItem value="Askofu">Askofu</SelectItem>
                    <SelectItem value="Sheikh">Sheikh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Profile Image URL</label>
              <Input
                value={formData.profile_image}
                onChange={(e) => setFormData({ ...formData, profile_image: e.target.value })}
                placeholder="https://..."
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Bio</label>
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Leader biography..."
                className="bg-zinc-950 border-zinc-800"
                rows={3}
              />
            </div>

            {/* Church/Religious Info */}
            <div className="border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-medium text-violet-400 mb-3 flex items-center gap-2">
                <Building2 size={16} /> Church/Religious Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Denomination *</label>
                  <Select value={formData.denomination} onValueChange={(v) => setFormData({ ...formData, denomination: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800">
                      <SelectValue placeholder="Select denomination" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {denominations.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name} ({d.name_sw})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.denomination === 'other' && (
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Other Denomination</label>
                    <Input
                      value={formData.denomination_other}
                      onChange={(e) => setFormData({ ...formData, denomination_other: e.target.value })}
                      placeholder="Enter denomination"
                      className="bg-zinc-950 border-zinc-800"
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Diocese</label>
                  <Input
                    value={formData.diocese}
                    onChange={(e) => setFormData({ ...formData, diocese: e.target.value })}
                    placeholder="Diocese name"
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Parish/Church Name</label>
                  <Input
                    value={formData.parish_name}
                    onChange={(e) => setFormData({ ...formData, parish_name: e.target.value })}
                    placeholder="Parish or church name"
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Parish Location</label>
                  <Input
                    value={formData.parish_location}
                    onChange={(e) => setFormData({ ...formData, parish_location: e.target.value })}
                    placeholder="e.g., Kinondoni, Dar es Salaam"
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Region</label>
                  <Input
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder="e.g., Dar es Salaam"
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Country</label>
                  <Input
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Tanzania"
                    className="bg-zinc-950 border-zinc-800"
                  />
                </div>
              </div>
            </div>

            {/* Payment Settings */}
            <div className="border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-medium text-violet-400 mb-3 flex items-center gap-2">
                <CreditCard size={16} /> Payment Settings
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <Switch
                  checked={formData.is_paid}
                  onCheckedChange={(v) => setFormData({ ...formData, is_paid: v })}
                />
                <span className="text-sm">Leader receives payment for content</span>
              </div>

              {formData.is_paid && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Payment Method</label>
                    <Select value={formData.payment_method} onValueChange={(v) => setFormData({ ...formData, payment_method: v })}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.payment_method === 'mobile_money' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Provider</label>
                        <Select 
                          value={formData.payment_details.provider || ""} 
                          onValueChange={(v) => setFormData({ ...formData, payment_details: { ...formData.payment_details, provider: v } })}
                        >
                          <SelectTrigger className="bg-zinc-950 border-zinc-800">
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800">
                            <SelectItem value="mpesa">M-Pesa</SelectItem>
                            <SelectItem value="tigopesa">Tigo Pesa</SelectItem>
                            <SelectItem value="airtel">Airtel Money</SelectItem>
                            <SelectItem value="halopesa">Halo Pesa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Phone Number</label>
                        <Input
                          value={formData.payment_details.phone_number || ""}
                          onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, phone_number: e.target.value } })}
                          placeholder="0712345678"
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm text-zinc-400 mb-1 block">Account Name</label>
                        <Input
                          value={formData.payment_details.account_name || ""}
                          onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_name: e.target.value } })}
                          placeholder="Name on account"
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </div>
                    </div>
                  )}

                  {formData.payment_method === 'bank' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Bank Name</label>
                        <Input
                          value={formData.payment_details.bank_name || ""}
                          onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, bank_name: e.target.value } })}
                          placeholder="e.g., CRDB Bank"
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Branch</label>
                        <Input
                          value={formData.payment_details.branch || ""}
                          onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, branch: e.target.value } })}
                          placeholder="Branch name"
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Account Number</label>
                        <Input
                          value={formData.payment_details.account_number || ""}
                          onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_number: e.target.value } })}
                          placeholder="Account number"
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Account Name</label>
                        <Input
                          value={formData.payment_details.account_name || ""}
                          onChange={(e) => setFormData({ ...formData, payment_details: { ...formData.payment_details, account_name: e.target.value } })}
                          placeholder="Name on account"
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Revenue Share Percentage</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.revenue_share_percentage}
                      onChange={(e) => setFormData({ ...formData, revenue_share_percentage: parseInt(e.target.value) || 60 })}
                      className="bg-zinc-950 border-zinc-800 w-32"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Leader receives {formData.revenue_share_percentage}% of content revenue</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Settings */}
            <div className="border-t border-zinc-800 pt-4 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(v) => setFormData({ ...formData, is_featured: v })}
                />
                <span className="text-sm">Featured Leader</span>
              </div>
              <div>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                {editingLeader ? 'Update' : 'Create'} Leader
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Account Modal */}
      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Create Leader Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <p className="text-sm text-zinc-400">Creating account for: <strong>{selectedLeader?.name}</strong></p>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Email *</label>
              <Input
                type="email"
                value={accountFormData.email}
                onChange={(e) => setAccountFormData({ ...accountFormData, email: e.target.value })}
                placeholder="leader@email.com"
                className="bg-zinc-950 border-zinc-800"
                required
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Password *</label>
              <Input
                type="password"
                value={accountFormData.password}
                onChange={(e) => setAccountFormData({ ...accountFormData, password: e.target.value })}
                placeholder="Password"
                className="bg-zinc-950 border-zinc-800"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAccountModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
