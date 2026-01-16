import { useEffect, useState } from "react";
import axios from "axios";
import { 
  CheckCircle, Church, UserCheck, MessageSquare, Check, X, 
  Music2, CreditCard, Bell, Phone, Building, Crown, Gift, Edit2, Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState({ churches: [], leaders: [], posts: [], total: 0 });
  const [contentRequests, setContentRequests] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [contentEditRequests, setContentEditRequests] = useState([]);
  const [churchLeaderAccounts, setChurchLeaderAccounts] = useState([]);
  const [choirRegistrations, setChoirRegistrations] = useState([]);
  const [notifications, setNotifications] = useState({ notifications: [], unread_count: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  const fetchApprovals = async () => {
    try {
      const [approvalsRes, contentRes, paymentRes, notifRes, editReqRes, leaderAccRes, choirRegRes] = await Promise.all([
        axios.get(`${API}/approvals`, { withCredentials: true }),
        axios.get(`${API}/admin/content-requests?status=pending`, { withCredentials: true }),
        axios.get(`${API}/admin/payment-requests?status=pending`, { withCredentials: true }),
        axios.get(`${API}/admin/notifications?unread_only=true`, { withCredentials: true }),
        axios.get(`${API}/admin/content-edit-requests?status=pending`, { withCredentials: true }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/church-leader/accounts`, { withCredentials: true }).catch(() => ({ data: { accounts: [] } })),
        axios.get(`${API}/admin/choir-registrations`, { withCredentials: true }).catch(() => ({ data: { registrations: [] } }))
      ]);
      setApprovals(approvalsRes.data);
      setContentRequests(contentRes.data.requests || []);
      setPaymentRequests(paymentRes.data.requests || []);
      setNotifications(notifRes.data);
      setContentEditRequests(editReqRes.data.requests || []);
      setChurchLeaderAccounts((leaderAccRes.data.accounts || []).filter(a => a.status === "pending"));
      setChoirRegistrations(choirRegRes.data.registrations || []);
    } catch (error) {
      console.error("Error fetching approvals:", error);
      toast.error("Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApprove = async (type, id) => {
    try {
      await axios.post(`${API}/approvals/approve`, { type, id }, { withCredentials: true });
      toast.success("Approved successfully");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (type, id) => {
    try {
      await axios.post(`${API}/approvals/reject`, { type, id }, { withCredentials: true });
      toast.success("Rejected");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to reject");
    }
  };

  const handleContentAction = async (requestId, status) => {
    try {
      await axios.put(`${API}/admin/content-requests/${requestId}`, { status }, { withCredentials: true });
      toast.success(status === "approved" ? "Content approved and published" : "Content rejected");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to process content request");
    }
  };

  const handlePaymentAction = async (requestId, status) => {
    try {
      await axios.put(`${API}/admin/payment-requests/${requestId}`, { status }, { withCredentials: true });
      toast.success(status === "approved" ? "Payment details approved" : "Payment details rejected");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to process payment request");
    }
  };

  const handleContentEditAction = async (requestId, status, notes = "") => {
    try {
      const endpoint = status === "approved" 
        ? `${API}/admin/content-edit-requests/${requestId}/approve`
        : `${API}/admin/content-edit-requests/${requestId}/reject`;
      await axios.post(endpoint, { admin_notes: notes }, { withCredentials: true });
      toast.success(status === "approved" ? "Edit approved and applied" : "Edit request rejected");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to process edit request");
    }
  };

  const handleChurchLeaderAction = async (accountId, status) => {
    try {
      const endpoint = status === "approved"
        ? `${API}/church-leader/account/${accountId}/approve`
        : `${API}/church-leader/account/${accountId}/reject`;
      await axios.put(endpoint, {}, { withCredentials: true });
      toast.success(status === "approved" ? "Church leader account approved" : "Church leader account rejected");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to process account request");
    }
  };

  const handleChoirRegistrationAction = async (choirId, status, reason = "") => {
    try {
      const endpoint = status === "approved"
        ? `${API}/admin/choir/${choirId}/approve`
        : `${API}/admin/choir/${choirId}/reject`;
      await axios.post(endpoint, { reason }, { withCredentials: true });
      toast.success(status === "approved" ? "Choir registration approved" : "Choir registration rejected");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to process choir registration");
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await axios.put(`${API}/admin/notifications/${notificationId}/read`, {}, { withCredentials: true });
      fetchApprovals();
    } catch (error) {
      console.error("Failed to mark notification read");
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await axios.put(`${API}/admin/notifications/read-all`, {}, { withCredentials: true });
      toast.success("All notifications marked as read");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to mark notifications read");
    }
  };

  const totalPending = approvals.total + contentRequests.length + paymentRequests.length + contentEditRequests.length + churchLeaderAccounts.length + choirRegistrations.length;

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" data-testid="approvals-page">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title">Pending Approvals</h1>
          <p className="page-subtitle">{totalPending} items waiting for review</p>
        </div>
        {notifications.unread_count > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-red-500/20 text-red-400">
              <Bell size={14} className="mr-1" /> {notifications.unread_count} New
            </Badge>
            <Button size="sm" variant="outline" onClick={markAllNotificationsRead} className="border-zinc-700 text-zinc-400">
              Mark All Read
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="all" className="data-[state=active]:bg-violet-600">
            All ({totalPending})
          </TabsTrigger>
          <TabsTrigger value="choirs" className="data-[state=active]:bg-violet-600">
            <Music2 size={14} className="mr-1" /> Choirs ({choirRegistrations.length})
          </TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-violet-600">
            <Music2 size={14} className="mr-1" /> Content ({contentRequests.length})
          </TabsTrigger>
          <TabsTrigger value="edits" className="data-[state=active]:bg-violet-600">
            <Edit2 size={14} className="mr-1" /> Edits ({contentEditRequests.length})
          </TabsTrigger>
          <TabsTrigger value="church-leaders" className="data-[state=active]:bg-violet-600">
            <Key size={14} className="mr-1" /> Leaders ({churchLeaderAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-violet-600">
            <CreditCard size={14} className="mr-1" /> Payment ({paymentRequests.length})
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-violet-600">
            <Bell size={14} className="mr-1" /> Notifications
          </TabsTrigger>
        </TabsList>

        {/* Choir Registrations Tab */}
        <TabsContent value="choirs" className="space-y-4">
          {choirRegistrations.length === 0 ? (
            <div className="empty-state">
              <CheckCircle className="empty-state-icon text-emerald-500" />
              <p className="empty-state-title">No pending choir registrations</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {choirRegistrations.map((reg) => (
                <Card key={reg.choir_id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                          <Music2 size={24} className="text-violet-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{reg.name}</h3>
                          <p className="text-sm text-zinc-400">{reg.email}</p>
                          {reg.phone && <p className="text-sm text-zinc-500">{reg.phone}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                              {reg.type === 'choir' ? 'Church Choir' : reg.type === 'artist' ? 'Solo Artist' : 'Band/Group'}
                            </Badge>
                            <span className="text-xs text-zinc-500">
                              Registered: {new Date(reg.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {reg.description && (
                            <p className="text-sm text-zinc-400 mt-2 max-w-md">{reg.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleChoirRegistrationAction(reg.choir_id, "approved")}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check size={16} className="mr-1" /> Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleChoirRegistrationAction(reg.choir_id, "rejected", "Application rejected by admin")}
                          className="border-red-800 text-red-400 hover:bg-red-900/30"
                        >
                          <X size={16} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all" className="space-y-6">
          {totalPending === 0 ? (
            <div className="empty-state">
              <CheckCircle className="empty-state-icon text-emerald-500" />
              <p className="empty-state-title">All caught up!</p>
              <p className="empty-state-text">No pending approvals at the moment</p>
            </div>
          ) : (
            <>
              {/* Pending Choir Registrations */}
              {choirRegistrations.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Music2 className="text-violet-500" size={20} />
                      Choir Registrations ({choirRegistrations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {choirRegistrations.map((reg) => (
                      <div key={reg.choir_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div>
                          <p className="font-medium text-white">{reg.name}</p>
                          <p className="text-sm text-zinc-400">{reg.email} • {reg.type}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleChoirRegistrationAction(reg.choir_id, "approved")} className="bg-emerald-600 hover:bg-emerald-700">
                            <Check size={14} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleChoirRegistrationAction(reg.choir_id, "rejected")} className="border-red-800 text-red-400">
                            <X size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Choir Content Requests */}
              {contentRequests.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Music2 size={20} className="text-emerald-400" />
                      Choir Content Requests ({contentRequests.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contentRequests.map((req) => (
                        <div key={req.request_id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg" data-testid={`content-request-${req.request_id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                              <Music2 size={24} className="text-emerald-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white">{req.content_data?.title}</h4>
                              <p className="text-sm text-zinc-500">
                                {req.request_type === "album_create" ? "New Album" : "New Song"} • by {req.choir_name}
                              </p>
                              {req.request_type === "album_create" && req.content_data?.monetization_type && (
                                <span className={`text-xs flex items-center gap-1 mt-1 ${req.content_data.monetization_type === "premium" ? "text-amber-400" : "text-violet-400"}`}>
                                  {req.content_data.monetization_type === "premium" ? <Crown size={10} /> : <Gift size={10} />}
                                  {req.content_data.monetization_type}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleContentAction(req.request_id, "approved")} className="bg-emerald-600 hover:bg-emerald-700">
                              <Check size={16} className="mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleContentAction(req.request_id, "rejected")} className="border-red-600 text-red-400 hover:bg-red-600/20">
                              <X size={16} className="mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment Detail Requests */}
              {paymentRequests.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <CreditCard size={20} className="text-violet-400" />
                      Payment Detail Changes ({paymentRequests.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {paymentRequests.map((req) => (
                        <div key={req.request_id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg" data-testid={`payment-request-${req.request_id}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${req.payment_method === "mobile_money" ? "bg-emerald-600/20" : "bg-violet-600/20"}`}>
                              {req.payment_method === "mobile_money" ? <Phone size={24} className="text-emerald-400" /> : <Building size={24} className="text-violet-400" />}
                            </div>
                            <div>
                              <h4 className="font-semibold text-white">{req.choir_name}</h4>
                              <p className="text-sm text-zinc-500">
                                {req.payment_method === "mobile_money" 
                                  ? `Mobile Money: ${req.payment_details?.phone}`
                                  : `Bank: ${req.payment_details?.bank_name} - ${req.payment_details?.account_number}`}
                              </p>
                              {req.otp_verified && <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 text-xs">Phone Verified</Badge>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handlePaymentAction(req.request_id, "approved")} className="bg-emerald-600 hover:bg-emerald-700">
                              <Check size={16} className="mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handlePaymentAction(req.request_id, "rejected")} className="border-red-600 text-red-400 hover:bg-red-600/20">
                              <X size={16} className="mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Churches */}
              {approvals.churches.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Church size={20} className="text-amber-400" />
                      Churches ({approvals.churches.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {approvals.churches.map((church) => (
                        <div key={church.church_id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg" data-testid={`approval-church-${church.church_id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-amber-600/20 flex items-center justify-center">
                              <Church size={24} className="text-amber-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white">{church.name}</h4>
                              <p className="text-sm text-zinc-500">{church.location}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApprove("church", church.church_id)} className="bg-emerald-600 hover:bg-emerald-700">
                              <Check size={16} className="mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReject("church", church.church_id)} className="border-red-600 text-red-400 hover:bg-red-600/20">
                              <X size={16} className="mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Religious Leaders */}
              {approvals.leaders.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <UserCheck size={20} className="text-violet-400" />
                      Religious Leaders ({approvals.leaders.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {approvals.leaders.map((leader) => (
                        <div key={leader.leader_id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg" data-testid={`approval-leader-${leader.leader_id}`}>
                          <div className="flex items-center gap-3">
                            {leader.photo ? (
                              <img src={leader.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-semibold">
                                {leader.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <h4 className="font-semibold text-white">{leader.name}</h4>
                              <p className="text-sm text-zinc-500">{leader.title} • {leader.church_name || "No church"}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApprove("leader", leader.leader_id)} className="bg-emerald-600 hover:bg-emerald-700">
                              <Check size={16} className="mr-1" /> Verify
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReject("leader", leader.leader_id)} className="border-red-600 text-red-400 hover:bg-red-600/20">
                              <X size={16} className="mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Community Posts */}
              {approvals.posts.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <MessageSquare size={20} className="text-emerald-400" />
                      Community Posts ({approvals.posts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {approvals.posts.map((post) => (
                        <div key={post.post_id} className="flex items-start justify-between p-4 bg-zinc-800/50 rounded-lg" data-testid={`approval-post-${post.post_id}`}>
                          <div className="flex items-start gap-3 flex-1">
                            {post.user_photo ? (
                              <img src={post.user_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-semibold">
                                {post.user_name?.charAt(0) || "U"}
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-semibold text-white">{post.user_name}</h4>
                              <p className="text-sm text-zinc-400 line-clamp-2 mt-1">{post.content}</p>
                              <p className="text-xs text-zinc-600 mt-2">{new Date(post.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button size="sm" onClick={() => handleApprove("post", post.post_id)} className="bg-emerald-600 hover:bg-emerald-700">
                              <Check size={16} />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReject("post", post.post_id)} className="border-red-600 text-red-400 hover:bg-red-600/20">
                              <X size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content">
          {contentRequests.length === 0 ? (
            <div className="empty-state">
              <Music2 className="empty-state-icon text-emerald-500" />
              <p className="empty-state-title">No pending content</p>
              <p className="empty-state-text">All choir content requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contentRequests.map((req) => (
                <Card key={req.request_id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                          <Music2 size={24} className="text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{req.content_data?.title}</h4>
                          <p className="text-sm text-zinc-500">
                            {req.request_type === "album_create" ? "New Album" : "New Song"} • by {req.choir_name}
                          </p>
                          {req.content_data?.description && (
                            <p className="text-xs text-zinc-600 mt-1 line-clamp-1">{req.content_data.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleContentAction(req.request_id, "approved")} className="bg-emerald-600 hover:bg-emerald-700">
                          <Check size={16} className="mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleContentAction(req.request_id, "rejected")} className="border-red-600 text-red-400 hover:bg-red-600/20">
                          <X size={16} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Content Edits Tab */}
        <TabsContent value="edits">
          {contentEditRequests.length === 0 ? (
            <div className="empty-state">
              <Edit2 className="empty-state-icon text-violet-500" />
              <p className="empty-state-title">No pending edit requests</p>
              <p className="empty-state-text">All content edit requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contentEditRequests.map((req) => (
                <Card key={req.request_id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-violet-600/20 flex items-center justify-center">
                          <Edit2 size={24} className="text-violet-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">
                            {req.content_type === "album" ? "Album" : "Song"} Edit: {req.updated_data?.title || req.original_data?.title}
                          </h4>
                          <p className="text-sm text-zinc-500">{req.choir_name}</p>
                          <div className="mt-2 text-xs space-y-1">
                            <p className="text-zinc-400">Changes requested:</p>
                            {req.updated_data?.title !== req.original_data?.title && (
                              <p className="text-amber-400">Title: &quot;{req.original_data?.title}&quot; → &quot;{req.updated_data?.title}&quot;</p>
                            )}
                            {req.updated_data?.description !== req.original_data?.description && (
                              <p className="text-amber-400">Description updated</p>
                            )}
                            {req.updated_data?.lyrics !== req.original_data?.lyrics && (
                              <p className="text-amber-400">Lyrics updated</p>
                            )}
                          </div>
                          <p className="text-xs text-zinc-600 mt-2">
                            Submitted: {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleContentEditAction(req.request_id, "approved")} className="bg-emerald-600 hover:bg-emerald-700">
                          <Check size={16} className="mr-1" /> Apply Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleContentEditAction(req.request_id, "rejected")} className="border-red-600 text-red-400 hover:bg-red-600/20">
                          <X size={16} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Church Leaders Tab */}
        <TabsContent value="church-leaders">
          {churchLeaderAccounts.length === 0 ? (
            <div className="empty-state">
              <Key className="empty-state-icon text-violet-500" />
              <p className="empty-state-title">No pending church leader accounts</p>
              <p className="empty-state-text">All church leader account requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {churchLeaderAccounts.map((account) => (
                <Card key={account.account_id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-amber-600/20 flex items-center justify-center">
                          <Church size={24} className="text-amber-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{account.name}</h4>
                          <p className="text-sm text-zinc-400">{account.church_name}</p>
                          <p className="text-xs text-zinc-500">{account.email} • {account.phone || "No phone"}</p>
                          <p className="text-xs text-zinc-600 mt-1">
                            Registered: {new Date(account.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleChurchLeaderAction(account.account_id, "approved")} className="bg-emerald-600 hover:bg-emerald-700">
                          <Check size={16} className="mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleChurchLeaderAction(account.account_id, "rejected")} className="border-red-600 text-red-400 hover:bg-red-600/20">
                          <X size={16} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment">
          {paymentRequests.length === 0 ? (
            <div className="empty-state">
              <CreditCard className="empty-state-icon text-violet-500" />
              <p className="empty-state-title">No pending payment changes</p>
              <p className="empty-state-text">All payment detail requests have been processed</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentRequests.map((req) => (
                <Card key={req.request_id} className="bg-zinc-900/50 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${req.payment_method === "mobile_money" ? "bg-emerald-600/20" : "bg-violet-600/20"}`}>
                          {req.payment_method === "mobile_money" ? <Phone size={24} className="text-emerald-400" /> : <Building size={24} className="text-violet-400" />}
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{req.choir_name}</h4>
                          <p className="text-sm text-zinc-500">
                            {req.payment_method === "mobile_money" 
                              ? `Mobile Money: ${req.payment_details?.phone}`
                              : `Bank: ${req.payment_details?.bank_name} - ${req.payment_details?.account_number}`}
                          </p>
                          {req.otp_verified && <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 text-xs">Phone Verified via OTP</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handlePaymentAction(req.request_id, "approved")} className="bg-emerald-600 hover:bg-emerald-700">
                          <Check size={16} className="mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handlePaymentAction(req.request_id, "rejected")} className="border-red-600 text-red-400 hover:bg-red-600/20">
                          <X size={16} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          {notifications.notifications.length === 0 ? (
            <div className="empty-state">
              <Bell className="empty-state-icon text-zinc-500" />
              <p className="empty-state-title">No notifications</p>
              <p className="empty-state-text">You&apos;re all caught up</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.notifications.map((notif) => (
                <Card key={notif.notification_id} className={`border-zinc-800 ${notif.read ? "bg-zinc-900/30" : "bg-zinc-900/50 border-l-2 border-l-violet-500"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          notif.notification_type === "withdrawal_request" ? "bg-emerald-600/20" :
                          notif.notification_type === "content_request" ? "bg-violet-600/20" : "bg-amber-600/20"
                        }`}>
                          {notif.notification_type === "withdrawal_request" ? <CreditCard size={18} className="text-emerald-400" /> :
                           notif.notification_type === "content_request" ? <Music2 size={18} className="text-violet-400" /> :
                           <CreditCard size={18} className="text-amber-400" />}
                        </div>
                        <div>
                          <p className="text-white">{notif.message}</p>
                          <p className="text-xs text-zinc-500 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                      {!notif.read && (
                        <Button size="sm" variant="ghost" onClick={() => markNotificationRead(notif.notification_id)} className="text-zinc-400 hover:text-white">
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
