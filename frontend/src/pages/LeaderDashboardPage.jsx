import { useEffect, useState } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Edit2, Eye, BarChart3, DollarSign, 
  LogOut, Home, Settings, Menu, X, Clock, CheckCircle,
  XCircle, Upload, CreditCard, TrendingUp, Users, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth helper
const getAuthHeaders = () => {
  const token = localStorage.getItem("leader_token");
  return { Authorization: `Bearer ${token}` };
};

export default function LeaderDashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [leader, setLeader] = useState(null);
  const [account, setAccount] = useState(null);
  const [teachings, setTeachings] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTeachingModalOpen, setIsTeachingModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [teachingForm, setTeachingForm] = useState({
    title: "",
    title_sw: "",
    description: "",
    description_sw: "",
    thumbnail: "",
    category_id: "",
    category_name: "",
    monetization_type: "free"
  });

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem("leader_token");
    if (!token) {
      window.location.href = "/leader/login";
      return;
    }
    fetchProfile();
  }, []);

  // Fetch profile
  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/leader/me`, { headers: getAuthHeaders() });
      setLeader(response.data.leader);
      setAccount(response.data.account);
      fetchData();
    } catch (error) {
      console.error("Auth error:", error);
      localStorage.removeItem("leader_token");
      window.location.href = "/leader/login";
    }
  };

  // Fetch all data
  const fetchData = async () => {
    try {
      const [teachingsRes, analyticsRes, revenueRes] = await Promise.all([
        axios.get(`${API}/leader/teachings`, { headers: getAuthHeaders() }),
        axios.get(`${API}/leader/analytics?period=30d`, { headers: getAuthHeaders() }),
        axios.get(`${API}/leader/revenue`, { headers: getAuthHeaders() })
      ]);
      setTeachings(teachingsRes.data.teachings || []);
      setAnalytics(analyticsRes.data);
      setRevenue(revenueRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Submit new teaching
  const handleSubmitTeaching = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/leader/teachings`, teachingForm, { headers: getAuthHeaders() });
      toast.success("Mafundisho yamewasilishwa kwa uhakiki");
      setIsTeachingModalOpen(false);
      setTeachingForm({
        title: "", title_sw: "", description: "", description_sw: "",
        thumbnail: "", category_id: "", category_name: "", monetization_type: "free"
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Imeshindwa kuwasilisha");
    }
  };

  // Request withdrawal
  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingiza kiasi sahihi");
      return;
    }
    try {
      await axios.post(`${API}/leader/withdraw`, { amount }, { headers: getAuthHeaders() });
      toast.success("Ombi la uondoaji limewasilishwa");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Imeshindwa");
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/leader/logout`, {}, { headers: getAuthHeaders() });
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("leader_token");
    localStorage.removeItem("leader_account");
    localStorage.removeItem("leader_info");
    window.location.href = "/leader/login";
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "published":
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle size={12} className="mr-1" /> Imechapishwa</Badge>;
      case "pending_approval":
        return <Badge className="bg-amber-500/20 text-amber-400"><Clock size={12} className="mr-1" /> Inasubiri Uhakiki</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400"><XCircle size={12} className="mr-1" /> Imekataliwa</Badge>;
      default:
        return <Badge className="bg-zinc-500/20 text-zinc-400">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">Gracefy</h1>
                <p className="text-xs text-zinc-500">Leaders Portal</p>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden">
                {leader?.profile_image ? (
                  <img src={leader.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Users size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{leader?.title} {leader?.name}</p>
                <p className="text-xs text-zinc-500 truncate">{leader?.parish_name}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {[
              { id: "dashboard", icon: Home, label: "Dashibodi" },
              { id: "teachings", icon: BookOpen, label: "Mafundisho" },
              { id: "analytics", icon: BarChart3, label: "Takwimu" },
              { id: "revenue", icon: DollarSign, label: "Mapato" },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={20} />
              Ondoka
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-zinc-800"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-4">
              <Button onClick={() => setIsTeachingModalOpen(true)} className="bg-violet-600 hover:bg-violet-700">
                <Plus size={18} className="mr-2" /> Ongeza Mafundisho
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-6">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Karibu, {leader?.title} {leader?.name}</h2>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Mafundisho</p>
                        <p className="text-2xl font-bold">{analytics?.total_teachings || 0}</p>
                      </div>
                      <BookOpen className="w-10 h-10 text-violet-500/50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Wasikilizaji</p>
                        <p className="text-2xl font-bold">{analytics?.unique_listeners || 0}</p>
                      </div>
                      <Users className="w-10 h-10 text-blue-500/50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Kusikilizwa</p>
                        <p className="text-2xl font-bold">{analytics?.total_plays || 0}</p>
                      </div>
                      <Play className="w-10 h-10 text-emerald-500/50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Salio</p>
                        <p className="text-2xl font-bold">TZS {(revenue?.current_balance || 0).toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-10 h-10 text-amber-500/50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Teachings */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen size={20} /> Mafundisho ya Hivi Karibuni
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teachings.length > 0 ? (
                    <div className="space-y-3">
                      {teachings.slice(0, 5).map(teaching => (
                        <div key={teaching.teaching_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-zinc-700 overflow-hidden">
                              {teaching.thumbnail ? (
                                <img src={teaching.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookOpen className="w-6 h-6 text-zinc-500" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{teaching.title}</p>
                              <p className="text-sm text-zinc-400">{teaching.listen_count || 0} wasikilizaji</p>
                            </div>
                          </div>
                          {getStatusBadge(teaching.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-zinc-400 py-8">Hakuna mafundisho bado</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Teachings Tab */}
          {activeTab === "teachings" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Mafundisho Yangu</h2>
                <Button onClick={() => setIsTeachingModalOpen(true)} className="bg-violet-600 hover:bg-violet-700">
                  <Plus size={18} className="mr-2" /> Ongeza Mafundisho
                </Button>
              </div>

              <div className="space-y-4">
                {teachings.map(teaching => (
                  <Card key={teaching.teaching_id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-24 h-24 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                          {teaching.thumbnail ? (
                            <img src={teaching.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-10 h-10 text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg">{teaching.title}</h3>
                              {teaching.title_sw && <p className="text-sm text-zinc-400">{teaching.title_sw}</p>}
                            </div>
                            {getStatusBadge(teaching.status)}
                          </div>
                          <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{teaching.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500">
                            <span className="flex items-center gap-1"><Play size={14} /> {teaching.listen_count || 0}</span>
                            <span className="flex items-center gap-1"><Eye size={14} /> {teaching.view_count || 0}</span>
                            <span>{new Date(teaching.created_at).toLocaleDateString()}</span>
                          </div>
                          {teaching.status === "rejected" && teaching.rejection_reason && (
                            <p className="mt-2 text-sm text-red-400 bg-red-500/10 p-2 rounded">
                              Sababu: {teaching.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {teachings.length === 0 && (
                  <div className="text-center py-12 text-zinc-400">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Hakuna mafundisho bado</p>
                    <Button onClick={() => setIsTeachingModalOpen(true)} className="mt-4 bg-violet-600 hover:bg-violet-700">
                      <Plus size={18} className="mr-2" /> Ongeza Kwanza
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Takwimu</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                    <p className="text-3xl font-bold">{analytics?.total_plays || 0}</p>
                    <p className="text-zinc-400">Jumla Kusikilizwa</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <Users className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                    <p className="text-3xl font-bold">{analytics?.unique_listeners || 0}</p>
                    <p className="text-zinc-400">Wasikilizaji Tofauti</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-violet-500" />
                    <p className="text-3xl font-bold">{analytics?.total_duration_minutes || 0}</p>
                    <p className="text-zinc-400">Dakika za Kusikiliza</p>
                  </CardContent>
                </Card>
              </div>

              {/* Teaching Breakdown */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle>Mchanganuo wa Mafundisho</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.teaching_breakdown?.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <span className="font-medium">{item.title}</span>
                        <div className="flex items-center gap-4 text-sm text-zinc-400">
                          <span>{item.plays} plays</span>
                          <span>{item.duration_minutes} min</span>
                        </div>
                      </div>
                    ))}
                    {(!analytics?.teaching_breakdown || analytics.teaching_breakdown.length === 0) && (
                      <p className="text-center text-zinc-400 py-4">Hakuna data bado</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === "revenue" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Mapato</h2>
                {(revenue?.current_balance || 0) > 0 && (
                  <Button onClick={() => setIsWithdrawModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                    <CreditCard size={18} className="mr-2" /> Omba Uondoaji
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-emerald-900/50 to-emerald-950 border-emerald-800">
                  <CardContent className="p-6 text-center">
                    <p className="text-zinc-400 mb-2">Salio la Sasa</p>
                    <p className="text-4xl font-bold text-emerald-400">TZS {(revenue?.current_balance || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <p className="text-zinc-400 mb-2">Jumla Uliyopata</p>
                    <p className="text-3xl font-bold">TZS {(revenue?.total_earned || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <p className="text-zinc-400 mb-2">Jumla Umeondoa</p>
                    <p className="text-3xl font-bold">TZS {(revenue?.total_withdrawn || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle>Maelezo ya Malipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p><span className="text-zinc-400">Njia:</span> {revenue?.payment_method === 'mobile_money' ? 'Mobile Money' : revenue?.payment_method === 'bank' ? 'Benki' : 'Haijawekwa'}</p>
                    {revenue?.payment_details?.phone_number && (
                      <p><span className="text-zinc-400">Nambari:</span> {revenue?.payment_details?.phone_number}</p>
                    )}
                    {revenue?.payment_details?.account_number && (
                      <p><span className="text-zinc-400">Akaunti:</span> {revenue?.payment_details?.account_number}</p>
                    )}
                    <p><span className="text-zinc-400">Asilimia:</span> {revenue?.revenue_share_percentage || 60}%</p>
                  </div>
                </CardContent>
              </Card>

              {/* Withdrawal History */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle>Historia ya Uondoaji</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenue?.withdrawals?.length > 0 ? (
                    <div className="space-y-3">
                      {revenue.withdrawals.map((w, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                          <div>
                            <p className="font-medium">TZS {w.amount?.toLocaleString()}</p>
                            <p className="text-sm text-zinc-400">{new Date(w.requested_at).toLocaleDateString()}</p>
                          </div>
                          <Badge className={
                            w.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                            w.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-red-500/20 text-red-400'
                          }>
                            {w.status === 'completed' ? 'Imekamilika' : w.status === 'pending' ? 'Inasubiri' : 'Imekataliwa'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-zinc-400 py-4">Hakuna historia ya uondoaji</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Submit Teaching Modal */}
      <Dialog open={isTeachingModalOpen} onOpenChange={setIsTeachingModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle>Wasilisha Mafundisho Mapya</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTeaching} className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Kichwa (Kiswahili)</label>
              <Input
                value={teachingForm.title}
                onChange={(e) => setTeachingForm({ ...teachingForm, title: e.target.value })}
                placeholder="Mfano: Safari ya Imani"
                className="bg-zinc-950 border-zinc-800"
                required
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Maelezo</label>
              <Textarea
                value={teachingForm.description}
                onChange={(e) => setTeachingForm({ ...teachingForm, description: e.target.value })}
                placeholder="Eleza mafundisho haya..."
                className="bg-zinc-950 border-zinc-800"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Picha ya Jalada (URL)</label>
              <Input
                value={teachingForm.thumbnail}
                onChange={(e) => setTeachingForm({ ...teachingForm, thumbnail: e.target.value })}
                placeholder="https://..."
                className="bg-zinc-950 border-zinc-800"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Aina ya Malipo</label>
              <Select value={teachingForm.monetization_type} onValueChange={(v) => setTeachingForm({ ...teachingForm, monetization_type: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="free">Bila Malipo (Bure)</SelectItem>
                  <SelectItem value="premium">Premium (Kwa Malipo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg">
              Mafundisho yatahakikiwa na msimamizi kabla ya kuchapishwa.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTeachingModalOpen(false)}>
                Ghairi
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                Wasilisha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Omba Uondoaji</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <p className="text-zinc-400">Salio lako: <span className="font-bold text-emerald-400">TZS {(revenue?.current_balance || 0).toLocaleString()}</span></p>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Kiasi (TZS)</label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Ingiza kiasi"
                className="bg-zinc-950 border-zinc-800"
                max={revenue?.current_balance || 0}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>
                Ghairi
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Omba
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
