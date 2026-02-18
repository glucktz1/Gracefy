import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  TrendingUp, DollarSign, Clock, Music2, LogOut, Wallet,
  Crown, Gift, CreditCard, Phone, Building, Upload, Plus,
  CheckCircle, XCircle, AlertCircle, PlayCircle, Timer, Users, Edit2, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ChoirDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [contentRequests, setContentRequests] = useState([]);
  const [myAlbums, setMyAlbums] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [fullProfile, setFullProfile] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");

  // Modal states
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  // Form states
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    payment_method: "mobile_money",
    payment_details: { phone: "", bank_name: "", account_number: "" }
  });
  const [paymentForm, setPaymentForm] = useState({
    payment_method: "mobile_money",
    phone: "",
    bank_name: "",
    account_number: "",
    account_name: ""
  });
  const [otpForm, setOtpForm] = useState({ otp_id: "", otp_code: "", phone: "" });
  const [albumForm, setAlbumForm] = useState({
    title: "",
    description: "",
    category_id: "",
    monetization_type: "standard",
    release_date: ""
  });
  const [songForm, setSongForm] = useState({
    title: "",
    album_id: "",
    duration_formatted: "",
    lyrics: ""
  });
  const [songAudioFile, setSongAudioFile] = useState(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Edit request states
  const [isEditAlbumModalOpen, setIsEditAlbumModalOpen] = useState(false);
  const [isEditSongModalOpen, setIsEditSongModalOpen] = useState(false);
  const [editAlbumForm, setEditAlbumForm] = useState({ title: "", description: "", category_id: "" });
  const [editSongForm, setEditSongForm] = useState({ title: "", duration_formatted: "", lyrics: "" });
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [myEditRequests, setMyEditRequests] = useState([]);

  const choirId = localStorage.getItem("choir_id");
  const sessionToken = localStorage.getItem("choir_session");

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      
      const [profileRes, revenueRes, withdrawalsRes, paymentRes, contentRes, albumsRes, catRes, editReqRes, notifRes, fullProfileRes] = await Promise.all([
        axios.get(`${API}/choir/me`, { headers, withCredentials: true }),
        axios.get(`${API}/choir/revenue/${choirId}`, { headers, withCredentials: true }),
        axios.get(`${API}/withdrawal/my-requests`, { headers, withCredentials: true }),
        axios.get(`${API}/choir/payment-details`, { headers, withCredentials: true }),
        axios.get(`${API}/choir/my-content-requests`, { headers, withCredentials: true }),
        axios.get(`${API}/choir/my-albums`, { headers, withCredentials: true }),
        axios.get(`${API}/categories`, { headers, withCredentials: true }),
        axios.get(`${API}/choir/my-edit-requests`, { headers, withCredentials: true }).catch(() => ({ data: { requests: [] } })),
        axios.get(`${API}/choir/notifications`, { headers, withCredentials: true }).catch(() => ({ data: { notifications: [], unread_count: 0 } })),
        axios.get(`${API}/choir/full-profile`, { headers, withCredentials: true }).catch(() => ({ data: null }))
      ]);
      
      // Merge account and choir data into profile
      const { account, choir } = profileRes.data;
      setProfile({
        ...account,
        ...choir,
        choir_name: account?.choir_name || choir?.name
      });
      setRevenue(revenueRes.data);
      setWithdrawals(withdrawalsRes.data.requests || []);
      setPaymentDetails(paymentRes.data);
      setContentRequests(contentRes.data.requests || []);
      setMyAlbums(albumsRes.data.albums || []);
      setCategories(catRes.data.categories || []);
      setMyEditRequests(editReqRes.data.requests || []);
      setNotifications(notifRes.data.notifications || []);
      setUnreadCount(notifRes.data.unread_count || 0);
      setFullProfile(fullProfileRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error("Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error("Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle notification reply
  const handleNotificationReply = async () => {
    if (!selectedNotification || !replyMessage.trim()) return;
    
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      await axios.post(
        `${API}/choir/notifications/${selectedNotification.notification_id}/reply`,
        { message: replyMessage },
        { headers, withCredentials: true }
      );
      toast.success("Reply sent successfully");
      setReplyMessage("");
      fetchData(); // Refresh to get updated notification
    } catch (error) {
      toast.error("Failed to send reply");
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      await axios.put(
        `${API}/choir/notifications/${notificationId}/read`,
        {},
        { headers, withCredentials: true }
      );
      setNotifications(prev => prev.map(n => 
        n.notification_id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  useEffect(() => {
    if (!sessionToken || !choirId) {
      navigate("/choir/login", { replace: true });
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, choirId, navigate]);

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/choir/logout`, {}, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        withCredentials: true
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("choir_session");
    localStorage.removeItem("choir_id");
    localStorage.removeItem("choir_name");
    navigate("/choir/login", { replace: true });
  };

  // OTP Request for Mobile Money
  const handleRequestOtp = async () => {
    if (!paymentForm.phone) {
      toast.error("Please enter phone number");
      return;
    }
    try {
      const res = await axios.post(`${API}/choir/payment-details/request-otp`, 
        { phone_number: paymentForm.phone },
        { headers: { Authorization: `Bearer ${sessionToken}` }, withCredentials: true }
      );
      setOtpForm({ ...otpForm, otp_id: res.data.otp_id, phone: paymentForm.phone });
      setIsOtpModalOpen(true);
      toast.success(`OTP sent! (Mock: ${res.data.mock_otp})`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    try {
      await axios.post(`${API}/choir/payment-details/verify-otp`, 
        { otp_id: otpForm.otp_id, otp_code: otpForm.otp_code },
        { headers: { Authorization: `Bearer ${sessionToken}` }, withCredentials: true }
      );
      toast.success("Phone verified!");
      // Now submit payment details
      await submitPaymentDetails(otpForm.otp_id);
      setIsOtpModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid OTP");
    }
  };

  // Submit Payment Details
  const submitPaymentDetails = async (otpId = null) => {
    try {
      const payload = {
        payment_method: paymentForm.payment_method,
        payment_details: paymentForm.payment_method === "mobile_money" 
          ? { phone: paymentForm.phone }
          : { bank_name: paymentForm.bank_name, account_number: paymentForm.account_number, account_name: paymentForm.account_name },
        otp_id: otpId
      };
      
      await axios.post(`${API}/choir/payment-details/submit`, payload,
        { headers: { Authorization: `Bearer ${sessionToken}` }, withCredentials: true }
      );
      toast.success("Payment details submitted for approval");
      setIsPaymentModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit payment details");
    }
  };

  const handleBankDetailsSubmit = async () => {
    if (!paymentForm.bank_name || !paymentForm.account_number) {
      toast.error("Please fill all bank details");
      return;
    }
    await submitPaymentDetails();
  };

  // Withdrawal Request
  const handleWithdrawRequest = async (e) => {
    e.preventDefault();
    try {
      const amount = parseFloat(withdrawForm.amount);
      if (amount > (profile?.current_balance || 0)) {
        toast.error("Insufficient balance");
        return;
      }

      await axios.post(`${API}/withdrawal/request`, {
        amount,
        payment_method: withdrawForm.payment_method,
        payment_details: withdrawForm.payment_method === "mobile_money" 
          ? { phone: withdrawForm.payment_details.phone }
          : { bank_name: withdrawForm.payment_details.bank_name, account_number: withdrawForm.payment_details.account_number }
      }, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        withCredentials: true
      });

      toast.success("Withdrawal request submitted - Priest will be notified");
      setIsWithdrawModalOpen(false);
      setWithdrawForm({ amount: "", payment_method: "mobile_money", payment_details: { phone: "", bank_name: "", account_number: "" } });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit request");
    }
  };

  // Create Album Request
  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/choir/albums/create`, albumForm,
        { headers: { Authorization: `Bearer ${sessionToken}` }, withCredentials: true }
      );
      toast.success("Album creation request submitted for approval");
      setIsAlbumModalOpen(false);
      setAlbumForm({ title: "", description: "", category_id: "", monetization_type: "standard", release_date: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit album request");
    }
  };

  // Upload Song Request
  const handleUploadSong = async (e) => {
    e.preventDefault();
    
    if (!songForm.title) {
      toast.error("Please enter a song title");
      return;
    }
    
    try {
      let audioUrl = null;
      
      // Upload audio file first if provided
      if (songAudioFile) {
        setUploadingAudio(true);
        const formData = new FormData();
        formData.append("file", songAudioFile);
        
        const uploadRes = await axios.post(`${API}/upload`, formData, {
          headers: { 
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data"
          },
          withCredentials: true
        });
        
        audioUrl = uploadRes.data.url;
        setUploadingAudio(false);
      }
      
      // Submit song with audio URL
      await axios.post(`${API}/choir/songs/upload`, {
        ...songForm,
        audio_url: audioUrl
      }, { 
        headers: { Authorization: `Bearer ${sessionToken}` }, 
        withCredentials: true 
      });
      
      toast.success("Song upload request submitted for approval");
      setIsSongModalOpen(false);
      setSongForm({ title: "", album_id: "", duration_formatted: "", lyrics: "" });
      setSongAudioFile(null);
      fetchData();
    } catch (error) {
      setUploadingAudio(false);
      toast.error(error.response?.data?.detail || "Failed to submit song request");
    }
  };

  // Open edit album modal
  const openEditAlbumModal = (album) => {
    setEditingAlbum(album);
    setEditAlbumForm({
      title: album.title || "",
      description: album.description || "",
      category_id: album.category_id || ""
    });
    setIsEditAlbumModalOpen(true);
  };

  // Open edit song modal
  const openEditSongModal = (song, album) => {
    setEditingSong({ ...song, album_title: album?.title });
    setEditSongForm({
      title: song.title || "",
      duration_formatted: song.duration_formatted || "",
      lyrics: song.lyrics || ""
    });
    setIsEditSongModalOpen(true);
  };

  // Submit album edit request
  const handleSubmitAlbumEdit = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      await axios.post(`${API}/choir/albums/${editingAlbum.album_id}/edit-request`, editAlbumForm, {
        headers,
        withCredentials: true
      });
      toast.success("Album edit request submitted for approval");
      setIsEditAlbumModalOpen(false);
      setEditingAlbum(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit edit request");
    }
  };

  // Submit song edit request
  const handleSubmitSongEdit = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      await axios.post(`${API}/choir/songs/${editingSong.song_id}/edit-request`, editSongForm, {
        headers,
        withCredentials: true
      });
      toast.success("Song edit request submitted for approval");
      setIsEditSongModalOpen(false);
      setEditingSong(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit edit request");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      rejected: "bg-red-500/20 text-red-400 border-red-500/30"
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles.pending}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const summary = revenue?.summary || {};
  const rates = revenue?.rates || {};
  const albums = revenue?.albums || [];
  const monthly = revenue?.monthly || [];

  // Prepare pie chart data
  const pieData = [
    { name: "Your Earnings", value: summary.net_revenue || 0, color: "#10b981" },
    { name: "Platform Share", value: summary.platform_share || 0, color: "#6366f1" }
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-bold">
              {profile?.choir_name?.charAt(0) || "C"}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{profile?.choir_name}</h1>
              <p className="text-xs text-zinc-500">{profile?.email}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white" data-testid="choir-logout-btn">
            <LogOut size={16} className="mr-2" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <div className="bg-gradient-to-r from-emerald-900/40 to-violet-900/40 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-zinc-400 text-sm mb-1">Available Balance</p>
              <p className="text-4xl font-bold text-white" data-testid="current-balance">
                TZS {(profile?.current_balance || 0).toLocaleString()}
              </p>
              <div className="flex gap-4 mt-3 text-sm flex-wrap">
                <span className="text-zinc-400">Total Earned: <span className="text-emerald-400">TZS {(profile?.total_earned || 0).toLocaleString()}</span></span>
                <span className="text-zinc-400">Withdrawn: <span className="text-zinc-300">TZS {(profile?.total_withdrawn || 0).toLocaleString()}</span></span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setIsPaymentModalOpen(true)} variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white" data-testid="update-payment-btn">
                <CreditCard size={16} className="mr-2" /> Payment Details
              </Button>
              <Button
                onClick={() => setIsWithdrawModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-6"
                disabled={!profile?.current_balance || profile.current_balance < (rates.minimum_withdrawal || 10000)}
                data-testid="request-withdrawal-btn"
              >
                <Wallet size={18} className="mr-2" /> Withdraw
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-emerald-600" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-emerald-600" data-testid="tab-content">My Content</TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-emerald-600" data-testid="tab-requests">Requests</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                      <DollarSign size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">TZS {(summary.net_revenue || 0).toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">Actual Revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                      <Clock size={20} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{summary.total_hours || 0}h {Math.round((summary.total_minutes || 0) % 60)}m</p>
                      <p className="text-xs text-zinc-500">Stream Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center">
                      <PlayCircle size={20} className="text-pink-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{summary.unique_streams_count || 0}</p>
                      <p className="text-xs text-zinc-500">Unique Streams (&gt;45s)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                      <Music2 size={20} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{summary.all_streams_count || 0}</p>
                      <p className="text-xs text-zinc-500">Total Plays</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly Revenue Chart */}
              <Card className="bg-zinc-900/50 border-zinc-800 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-white text-base">Monthly Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {monthly.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={[...monthly].reverse()}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
                        <YAxis stroke="#71717a" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="net_revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGradient)" name="Net Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-zinc-500">No data yet</div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Split Pie */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base">Revenue Split</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" labelLine={false}>
                        {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} formatter={(v) => `TZS ${v.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded bg-emerald-500"></div><span className="text-zinc-400">Your Earnings ({100 - (rates.platform_share || 30)}%)</span></div>
                    <div className="flex items-center gap-2 text-xs"><div className="w-3 h-3 rounded bg-indigo-500"></div><span className="text-zinc-400">Platform ({rates.platform_share || 30}%)</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Album Performance */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Album Performance</CardTitle>
              </CardHeader>
              <CardContent>
                {albums.length > 0 ? (
                  <div className="space-y-4">
                    {albums.map((album) => (
                      <div key={album.album_id} className="p-4 bg-zinc-800/30 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                              <Music2 size={18} className="text-violet-400" />
                            </div>
                            <div>
                              <h4 className="font-medium text-white">{album.title}</h4>
                              <span className={`text-xs flex items-center gap-1 ${album.monetization_type === "premium" ? "text-amber-400" : "text-violet-400"}`}>
                                {album.monetization_type === "premium" ? <><Crown size={10} /> Premium</> : <><Gift size={10} /> Standard</>}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-400 font-semibold">TZS {album.revenue?.toLocaleString()}</p>
                            <p className="text-xs text-zinc-500">{album.revenue_percentage}% of total</p>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-400 mb-1">
                          <span>{album.total_hours}h listened</span>
                          <span>{album.total_plays} plays</span>
                        </div>
                        <Progress value={album.revenue_percentage} className="h-1.5 bg-zinc-700" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-500">No album performance data yet</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">My Albums & Songs</h2>
              <div className="flex gap-2">
                <Button onClick={() => setIsAlbumModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="create-album-btn">
                  <Plus size={16} className="mr-2" /> New Album
                </Button>
                <Button onClick={() => setIsSongModalOpen(true)} variant="outline" className="border-zinc-700 text-zinc-300" disabled={myAlbums.length === 0} data-testid="upload-song-btn">
                  <Upload size={16} className="mr-2" /> Upload Song
                </Button>
              </div>
            </div>

            {myAlbums.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myAlbums.map((album) => (
                  <Card key={album.album_id} className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                          <Music2 size={24} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-white truncate">{album.title}</h4>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => openEditAlbumModal(album)}
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-violet-400"
                              title="Edit Album"
                            >
                              <Edit2 size={14} />
                            </Button>
                          </div>
                          <p className="text-xs text-zinc-500">{album.songs_count || 0} songs</p>
                          <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${album.monetization_type === "premium" ? "bg-amber-500/20 text-amber-400" : "bg-violet-500/20 text-violet-400"}`}>
                            {album.monetization_type}
                          </span>
                        </div>
                      </div>
                      {/* Songs in Album */}
                      {album.songs && album.songs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                          {album.songs.map((song) => (
                            <div key={song.song_id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-zinc-400">
                                <PlayCircle size={12} />
                                <span className="truncate max-w-[150px]">{song.title}</span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => openEditSongModal(song, album)}
                                className="h-6 w-6 p-0 text-zinc-500 hover:text-violet-400"
                                title="Edit Song"
                              >
                                <Edit2 size={12} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-8 text-center">
                  <Music2 size={48} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-zinc-500">You don&apos;t have any albums yet</p>
                  <Button onClick={() => setIsAlbumModalOpen(true)} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
                    Create Your First Album
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Withdrawal History */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base">Withdrawal History</CardTitle>
                </CardHeader>
                <CardContent>
                  {withdrawals.length > 0 ? (
                    <div className="space-y-3">
                      {withdrawals.slice(0, 5).map((wd) => (
                        <div key={wd.request_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                          <div>
                            <p className="text-white font-medium">TZS {wd.amount?.toLocaleString()}</p>
                            <p className="text-xs text-zinc-500">{new Date(wd.created_at).toLocaleDateString()}</p>
                          </div>
                          {getStatusBadge(wd.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-zinc-500">No withdrawal history</div>
                  )}
                </CardContent>
              </Card>

              {/* Content Requests */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base">Content Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  {contentRequests.length > 0 ? (
                    <div className="space-y-3">
                      {contentRequests.slice(0, 5).map((req) => (
                        <div key={req.request_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                          <div>
                            <p className="text-white font-medium">{req.content_data?.title}</p>
                            <p className="text-xs text-zinc-500">{req.request_type === "album_create" ? "Album" : "Song"} • {new Date(req.created_at).toLocaleDateString()}</p>
                          </div>
                          {getStatusBadge(req.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-zinc-500">No content requests</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Edit Requests */}
            {myEditRequests.length > 0 && (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <FileText size={18} className="text-violet-400" />
                    Edit Requests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {myEditRequests.map((req) => (
                      <div key={req.request_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div>
                          <p className="text-white font-medium">{req.updated_data?.title || req.original_data?.title}</p>
                          <p className="text-xs text-zinc-500">
                            {req.content_type === "album" ? "Album" : "Song"} Edit • {new Date(req.created_at).toLocaleDateString()}
                          </p>
                          {req.admin_notes && (
                            <p className="text-xs text-amber-400 mt-1">{req.admin_notes}</p>
                          )}
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Details Status */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Payment Details</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentDetails?.current_method ? (
                  <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      {paymentDetails.current_method === "mobile_money" ? <Phone size={20} className="text-emerald-400" /> : <Building size={20} className="text-violet-400" />}
                      <div>
                        <p className="text-white font-medium">{paymentDetails.current_method === "mobile_money" ? "Mobile Money" : "Bank Transfer"}</p>
                        <p className="text-xs text-zinc-500">
                          {paymentDetails.current_method === "mobile_money" 
                            ? paymentDetails.current_details?.phone 
                            : `${paymentDetails.current_details?.bank_name} - ${paymentDetails.current_details?.account_number}`}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(paymentDetails.details_status)}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <AlertCircle size={32} className="mx-auto text-amber-400 mb-2" />
                    <p className="text-zinc-400">No payment details set up</p>
                    <Button onClick={() => setIsPaymentModalOpen(true)} className="mt-3 bg-emerald-600 hover:bg-emerald-700">Set Up Payment</Button>
                  </div>
                )}
                {paymentDetails?.pending_request && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-amber-400 text-sm flex items-center gap-2"><Timer size={14} /> Update pending admin approval</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Withdrawal Modal */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWithdrawRequest}>
            <div className="space-y-4 py-4">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <p className="text-sm text-zinc-400">Available Balance</p>
                <p className="text-2xl font-bold text-emerald-400">TZS {(profile?.current_balance || 0).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Amount (TZS)</label>
                <Input type="number" value={withdrawForm.amount} onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" required min={rates.minimum_withdrawal || 10000} max={profile?.current_balance || 0} data-testid="withdraw-amount-input" />
                <p className="text-xs text-zinc-500 mt-1">Minimum: TZS {(rates.minimum_withdrawal || 10000).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Payment Method</label>
                <Select value={withdrawForm.payment_method} onValueChange={(v) => setWithdrawForm({ ...withdrawForm, payment_method: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="mobile_money"><span className="flex items-center gap-2"><Phone size={14} /> Mobile Money</span></SelectItem>
                    <SelectItem value="bank_transfer"><span className="flex items-center gap-2"><Building size={14} /> Bank Transfer</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {withdrawForm.payment_method === "mobile_money" ? (
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Phone Number</label>
                  <Input value={withdrawForm.payment_details.phone} onChange={(e) => setWithdrawForm({ ...withdrawForm, payment_details: { ...withdrawForm.payment_details, phone: e.target.value } })} placeholder="+255 xxx xxx xxx" className="bg-zinc-950 border-zinc-800 text-white" required />
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Bank Name</label>
                    <Input value={withdrawForm.payment_details.bank_name} onChange={(e) => setWithdrawForm({ ...withdrawForm, payment_details: { ...withdrawForm.payment_details, bank_name: e.target.value } })} placeholder="e.g., CRDB Bank" className="bg-zinc-950 border-zinc-800 text-white" required />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Account Number</label>
                    <Input value={withdrawForm.payment_details.account_number} onChange={(e) => setWithdrawForm({ ...withdrawForm, payment_details: { ...withdrawForm.payment_details, account_number: e.target.value } })} className="bg-zinc-950 border-zinc-800 text-white" required />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWithdrawModalOpen(false)} className="border-zinc-700">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="submit-withdrawal-btn">Submit Request</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Details Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Update Payment Details</DialogTitle>
            <DialogDescription className="text-zinc-400">Changes require admin approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Payment Method</label>
              <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="mobile_money"><span className="flex items-center gap-2"><Phone size={14} /> Mobile Money</span></SelectItem>
                  <SelectItem value="bank_transfer"><span className="flex items-center gap-2"><Building size={14} /> Bank Transfer</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            {paymentForm.payment_method === "mobile_money" ? (
              <>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Phone Number</label>
                  <Input value={paymentForm.phone} onChange={(e) => setPaymentForm({ ...paymentForm, phone: e.target.value })} placeholder="+255 xxx xxx xxx" className="bg-zinc-950 border-zinc-800 text-white" data-testid="payment-phone-input" />
                </div>
                <Button onClick={handleRequestOtp} className="w-full bg-violet-600 hover:bg-violet-700" data-testid="request-otp-btn">Send OTP to Verify</Button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Bank Name</label>
                  <Input value={paymentForm.bank_name} onChange={(e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value })} placeholder="e.g., CRDB Bank" className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Account Number</label>
                  <Input value={paymentForm.account_number} onChange={(e) => setPaymentForm({ ...paymentForm, account_number: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Account Name</label>
                  <Input value={paymentForm.account_name} onChange={(e) => setPaymentForm({ ...paymentForm, account_name: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
                <Button onClick={handleBankDetailsSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700">Submit for Approval</Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* OTP Modal */}
      <Dialog open={isOtpModalOpen} onOpenChange={setIsOtpModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Verify Phone Number</DialogTitle>
            <DialogDescription className="text-zinc-400">Enter the OTP sent to {otpForm.phone}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input value={otpForm.otp_code} onChange={(e) => setOtpForm({ ...otpForm, otp_code: e.target.value })} placeholder="Enter 6-digit OTP" className="bg-zinc-950 border-zinc-800 text-white text-center text-xl tracking-widest" maxLength={6} data-testid="otp-input" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOtpModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button onClick={handleVerifyOtp} className="bg-emerald-600 hover:bg-emerald-700" data-testid="verify-otp-btn">Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Album Creation Modal */}
      <Dialog open={isAlbumModalOpen} onOpenChange={setIsAlbumModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Create New Album</DialogTitle>
            <DialogDescription className="text-zinc-400">Album will be reviewed by admin before publishing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAlbum}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Album Title *</label>
                <Input value={albumForm.title} onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" required data-testid="album-title-input" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Description</label>
                <Textarea value={albumForm.description} onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" rows={3} />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Category</label>
                <Select value={albumForm.category_id} onValueChange={(v) => setAlbumForm({ ...albumForm, category_id: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {categories.map((cat) => <SelectItem key={cat.category_id} value={cat.category_id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Monetization Type</label>
                <Select value={albumForm.monetization_type} onValueChange={(v) => setAlbumForm({ ...albumForm, monetization_type: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="standard"><span className="flex items-center gap-2"><Gift size={14} /> Standard</span></SelectItem>
                    <SelectItem value="premium"><span className="flex items-center gap-2"><Crown size={14} /> Premium</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Release Date</label>
                <Input type="date" value={albumForm.release_date} onChange={(e) => setAlbumForm({ ...albumForm, release_date: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAlbumModalOpen(false)} className="border-zinc-700">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="submit-album-btn">Submit for Approval</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Song Upload Modal */}
      <Dialog open={isSongModalOpen} onOpenChange={setIsSongModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Song</DialogTitle>
            <DialogDescription className="text-zinc-400">Song will be reviewed by admin before publishing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadSong}>
            <div className="space-y-4 py-4">
              {/* Audio File Upload */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Audio File *</label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    songAudioFile ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-950'
                  }`}
                  onClick={() => document.getElementById('choir-song-audio').click()}
                >
                  {songAudioFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <Music2 size={24} className="text-emerald-400" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">{songAudioFile.name}</p>
                        <p className="text-xs text-zinc-400">{(songAudioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSongAudioFile(null); }}
                        className="ml-2 text-zinc-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto mb-2 text-zinc-500" />
                      <p className="text-sm text-zinc-400">Click to upload audio file</p>
                      <p className="text-xs text-zinc-500 mt-1">MP3, WAV, M4A (Max 50MB)</p>
                    </>
                  )}
                </div>
                <input
                  id="choir-song-audio"
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 50 * 1024 * 1024) {
                        toast.error("File size must be less than 50MB");
                        return;
                      }
                      setSongAudioFile(file);
                      // Auto-fill title from filename if empty
                      if (!songForm.title) {
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                        setSongForm(prev => ({ ...prev, title: nameWithoutExt }));
                      }
                    }
                  }}
                />
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Song Title *</label>
                <Input value={songForm.title} onChange={(e) => setSongForm({ ...songForm, title: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" required data-testid="song-title-input" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Album</label>
                <Select value={songForm.album_id} onValueChange={(v) => setSongForm({ ...songForm, album_id: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white"><SelectValue placeholder="Select album (optional)" /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {myAlbums.map((album) => <SelectItem key={album.album_id} value={album.album_id}>{album.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Duration (e.g., 3:45)</label>
                  <Input value={songForm.duration_formatted} onChange={(e) => setSongForm({ ...songForm, duration_formatted: e.target.value })} placeholder="3:45" className="bg-zinc-950 border-zinc-800 text-white" />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Lyrics</label>
                <Textarea value={songForm.lyrics} onChange={(e) => setSongForm({ ...songForm, lyrics: e.target.value })} className="bg-zinc-950 border-zinc-800 text-white" rows={3} placeholder="Enter song lyrics (optional)..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsSongModalOpen(false); setSongAudioFile(null); }} className="border-zinc-700">Cancel</Button>
              <Button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-700" 
                data-testid="submit-song-btn"
                disabled={uploadingAudio || !songAudioFile}
              >
                {uploadingAudio ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Uploading...
                  </>
                ) : "Submit for Approval"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Album Modal */}
      <Dialog open={isEditAlbumModalOpen} onOpenChange={setIsEditAlbumModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={18} className="text-violet-400" />
              Edit Album
            </DialogTitle>
            <DialogDescription>
              Submit changes for admin approval. Original content remains until approved.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAlbumEdit}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Album Title *</label>
                <Input 
                  value={editAlbumForm.title} 
                  onChange={(e) => setEditAlbumForm({ ...editAlbumForm, title: e.target.value })} 
                  className="bg-zinc-950 border-zinc-800 text-white" 
                  required 
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Description</label>
                <Textarea 
                  value={editAlbumForm.description} 
                  onChange={(e) => setEditAlbumForm({ ...editAlbumForm, description: e.target.value })} 
                  className="bg-zinc-950 border-zinc-800 text-white" 
                  rows={3} 
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Category</label>
                <Select value={editAlbumForm.category_id} onValueChange={(v) => setEditAlbumForm({ ...editAlbumForm, category_id: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {categories.map((cat) => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditAlbumModalOpen(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                Submit Edit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Song Modal */}
      <Dialog open={isEditSongModalOpen} onOpenChange={setIsEditSongModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 size={18} className="text-violet-400" />
              Edit Song
            </DialogTitle>
            <DialogDescription>
              {editingSong?.album_title && `Album: ${editingSong.album_title}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitSongEdit}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Song Title *</label>
                <Input 
                  value={editSongForm.title} 
                  onChange={(e) => setEditSongForm({ ...editSongForm, title: e.target.value })} 
                  className="bg-zinc-950 border-zinc-800 text-white" 
                  required 
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Duration (e.g., 3:45)</label>
                <Input 
                  value={editSongForm.duration_formatted} 
                  onChange={(e) => setEditSongForm({ ...editSongForm, duration_formatted: e.target.value })} 
                  className="bg-zinc-950 border-zinc-800 text-white" 
                  placeholder="3:45"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Lyrics</label>
                <Textarea 
                  value={editSongForm.lyrics} 
                  onChange={(e) => setEditSongForm({ ...editSongForm, lyrics: e.target.value })} 
                  className="bg-zinc-950 border-zinc-800 text-white" 
                  rows={4}
                  placeholder="Enter song lyrics..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditSongModalOpen(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                Submit Edit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
