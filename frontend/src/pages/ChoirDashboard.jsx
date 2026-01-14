import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  TrendingUp, DollarSign, Clock, Music2, LogOut, Wallet,
  Crown, Gift, CreditCard, Phone, Building, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from "recharts";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ChoirDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    payment_method: "mobile_money",
    payment_details: {
      phone: "",
      bank_name: "",
      account_number: ""
    }
  });

  const choirId = localStorage.getItem("choir_id");
  const sessionToken = localStorage.getItem("choir_session");

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      
      const [profileRes, revenueRes, withdrawalsRes] = await Promise.all([
        axios.get(`${API}/choir/me`, { headers, withCredentials: true }),
        axios.get(`${API}/choir/revenue/${choirId}`, { headers, withCredentials: true }),
        axios.get(`${API}/withdrawal/my-requests`, { headers, withCredentials: true })
      ]);
      
      setProfile(profileRes.data);
      setRevenue(revenueRes.data);
      setWithdrawals(withdrawalsRes.data.requests || []);
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

  useEffect(() => {
    if (!sessionToken || !choirId) {
      navigate("/choir/login", { replace: true });
      return;
    }
    fetchData();
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
          : { 
              bank_name: withdrawForm.payment_details.bank_name,
              account_number: withdrawForm.payment_details.account_number
            }
      }, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        withCredentials: true
      });

      toast.success("Withdrawal request submitted");
      setIsWithdrawModalOpen(false);
      setWithdrawForm({
        amount: "",
        payment_method: "mobile_money",
        payment_details: { phone: "", bank_name: "", account_number: "" }
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to submit request");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: "badge-warning",
      approved: "badge-info",
      completed: "badge-success",
      rejected: "badge-error"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const summary = revenue?.summary || {};
  const rates = revenue?.rates || {};
  const albums = revenue?.albums || [];
  const monthly = revenue?.monthly || [];

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
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-zinc-700 text-zinc-400 hover:text-white"
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <div className="bg-gradient-to-r from-emerald-900/40 to-violet-900/40 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-zinc-400 text-sm mb-1">Available Balance</p>
              <p className="text-4xl font-bold text-white">
                TZS {(profile?.current_balance || 0).toLocaleString()}
              </p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-zinc-400">Total Earned: <span className="text-emerald-400">TZS {(profile?.total_earned || 0).toLocaleString()}</span></span>
                <span className="text-zinc-400">Withdrawn: <span className="text-zinc-300">TZS {(profile?.total_withdrawn || 0).toLocaleString()}</span></span>
              </div>
            </div>
            <Button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-8"
              disabled={!profile?.current_balance || profile.current_balance < (rates.minimum_withdrawal || 10000)}
              data-testid="request-withdrawal-btn"
            >
              <Wallet size={18} className="mr-2" />
              Request Withdrawal
            </Button>
          </div>
        </div>

        {/* Current Rates */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-zinc-400 mb-3">Current Revenue Rates</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-amber-400" />
              <span className="text-white">Premium: TZS {rates.premium_rate || 0}/hour</span>
            </div>
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-violet-400" />
              <span className="text-white">Standard: TZS {rates.standard_rate || 0}/hour</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <span className="text-white">Your Share: {100 - (rates.platform_share || 30)}%</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center mb-3">
                <Clock size={20} className="text-violet-400" />
              </div>
              <p className="text-2xl font-bold text-white">{summary.total_hours || 0}</p>
              <p className="text-sm text-zinc-500">Total Listening Hours</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center mb-3">
                <Crown size={20} className="text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white">{summary.premium_hours || 0}</p>
              <p className="text-sm text-zinc-500">Premium Hours</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center mb-3">
                <TrendingUp size={20} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white">TZS {(summary.gross_revenue || 0).toLocaleString()}</p>
              <p className="text-sm text-zinc-500">Gross Revenue</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center mb-3">
                <Music2 size={20} className="text-pink-400" />
              </div>
              <p className="text-2xl font-bold text-white">{summary.total_plays || 0}</p>
              <p className="text-sm text-zinc-500">Total Plays</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Revenue */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base font-semibold">Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={[...monthly].reverse()}>
                    <defs>
                      <linearGradient id="choirRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [`TZS ${value}`, 'Net Revenue']}
                    />
                    <Area type="monotone" dataKey="net_revenue" stroke="#10b981" strokeWidth={2} fill="url(#choirRevenueGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-zinc-500">
                  No monthly data yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Withdrawal History */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base font-semibold flex items-center justify-between">
                Recent Withdrawals
              </CardTitle>
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
                <div className="h-[200px] flex items-center justify-center text-zinc-500">
                  No withdrawal history
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Album Performance */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold">Album Performance</CardTitle>
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
                          <div className="flex items-center gap-2">
                            {album.monetization_type === "premium" ? (
                              <span className="text-xs text-amber-400 flex items-center gap-1">
                                <Crown size={10} /> Premium
                              </span>
                            ) : (
                              <span className="text-xs text-violet-400 flex items-center gap-1">
                                <Gift size={10} /> Standard
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-semibold">TZS {album.revenue?.toLocaleString()}</p>
                        <p className="text-xs text-zinc-500">{album.revenue_percentage}% of total</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-zinc-400 mb-1">
                        <span>{album.total_hours} hours listened</span>
                        <span>{album.total_plays} plays</span>
                      </div>
                      <Progress value={album.revenue_percentage} className="h-1.5 bg-zinc-700" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500">
                No album performance data available yet
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Withdrawal Modal */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWithdrawRequest}>
            <div className="space-y-4 py-4">
              <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
                <p className="text-sm text-zinc-400">Available Balance</p>
                <p className="text-2xl font-bold text-emerald-400">TZS {(profile?.current_balance || 0).toLocaleString()}</p>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (TZS)</label>
                <Input
                  type="number"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  placeholder="Enter amount"
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  min={rates.minimum_withdrawal || 10000}
                  max={profile?.current_balance || 0}
                />
                <p className="text-xs text-zinc-500 mt-1">Minimum: TZS {(rates.minimum_withdrawal || 10000).toLocaleString()}</p>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <Select value={withdrawForm.payment_method} onValueChange={(value) => setWithdrawForm({ ...withdrawForm, payment_method: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="mobile_money">
                      <span className="flex items-center gap-2">
                        <Phone size={14} /> Mobile Money (M-Pesa)
                      </span>
                    </SelectItem>
                    <SelectItem value="bank_transfer">
                      <span className="flex items-center gap-2">
                        <Building size={14} /> Bank Transfer
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {withdrawForm.payment_method === "mobile_money" ? (
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <Input
                    value={withdrawForm.payment_details.phone}
                    onChange={(e) => setWithdrawForm({ 
                      ...withdrawForm, 
                      payment_details: { ...withdrawForm.payment_details, phone: e.target.value }
                    })}
                    placeholder="+255 xxx xxx xxx"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <Input
                      value={withdrawForm.payment_details.bank_name}
                      onChange={(e) => setWithdrawForm({ 
                        ...withdrawForm, 
                        payment_details: { ...withdrawForm.payment_details, bank_name: e.target.value }
                      })}
                      placeholder="e.g., CRDB Bank"
                      className="bg-zinc-950 border-zinc-800 text-white"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Number</label>
                    <Input
                      value={withdrawForm.payment_details.account_number}
                      onChange={(e) => setWithdrawForm({ 
                        ...withdrawForm, 
                        payment_details: { ...withdrawForm.payment_details, account_number: e.target.value }
                      })}
                      placeholder="Your account number"
                      className="bg-zinc-950 border-zinc-800 text-white"
                      required
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWithdrawModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                <CreditCard size={16} className="mr-2" />
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
