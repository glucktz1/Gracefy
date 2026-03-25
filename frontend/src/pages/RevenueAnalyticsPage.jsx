import { useEffect, useState } from "react";
import axios from "axios";
import { 
  TrendingUp, DollarSign, Clock, Users, Music2, Settings,
  Crown, Gift, BarChart3, PieChart, Save
} from "lucide-react";
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
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell
} from "recharts";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function RevenueAnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [choirRevenues, setChoirRevenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    premium_rate_per_hour: 10,
    standard_rate_per_hour: 5,
    platform_share_percentage: 30,
    minimum_withdrawal: 10000
  });

  const fetchData = async () => {
    try {
      const [overviewRes, dailyRes, choirsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/revenue/admin/overview`, { withCredentials: true }),
        axios.get(`${API}/revenue/admin/daily?days=30`, { withCredentials: true }),
        axios.get(`${API}/revenue/admin/choirs`, { withCredentials: true }),
        axios.get(`${API}/revenue/settings`, { withCredentials: true })
      ]);
      setOverview(overviewRes.data);
      setDailyData(dailyRes.data.daily_data || []);
      setChoirRevenues(choirsRes.data.choirs || []);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error("Error fetching revenue data:", error);
      toast.error("Failed to load revenue analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async () => {
    try {
      await axios.post(`${API}/revenue/settings`, {
        ...settings,
        effective_from: new Date().toISOString().split('T')[0]
      }, { withCredentials: true });
      toast.success("Revenue settings updated");
      setIsSettingsOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to update settings");
    }
  };

  const generateDemoData = async () => {
    try {
      setLoading(true);
      await axios.post(`${API}/demo/generate-listening-data`, {}, { withCredentials: true });
      toast.success("Demo listening data generated!");
      fetchData();
    } catch (error) {
      toast.error("Failed to generate demo data");
      setLoading(false);
    }
  };

  const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const summary = overview?.summary || {};
  const rates = overview?.rates || {};
  const topChoirs = overview?.top_choirs || [];
  const topAlbums = overview?.top_albums || [];

  return (
    <div className="page-container animate-fade-in" data-testid="revenue-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Revenue & Performance Analytics</h1>
          <p className="page-subtitle">Platform-wide revenue metrics and choir performance</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={generateDemoData}
            variant="outline"
            className="border-zinc-700 text-zinc-300"
          >
            <BarChart3 size={18} className="mr-2" />
            Generate Demo Data
          </Button>
          <Button
            onClick={() => setIsSettingsOpen(true)}
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="revenue-settings-btn"
          >
            <Settings size={18} className="mr-2" />
            Rate Settings
          </Button>
        </div>
      </div>

      {/* Current Rates Display */}
      <div className="bg-gradient-to-r from-violet-900/30 to-zinc-900 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-amber-400" />
            <span className="text-zinc-400">Premium Rate:</span>
            <span className="text-white font-semibold">TZS {rates.premium_rate || 0}/hour</span>
          </div>
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-violet-400" />
            <span className="text-zinc-400">Standard Rate:</span>
            <span className="text-white font-semibold">TZS {rates.standard_rate || 0}/hour</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-400" />
            <span className="text-zinc-400">Platform Share:</span>
            <span className="text-white font-semibold">{rates.platform_share || 0}%</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <Clock size={20} className="text-violet-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-3">{summary.total_listening_hours || 0}</p>
            <p className="text-sm text-zinc-500">Total Listening Hours</p>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-amber-400">Premium: {summary.premium_hours || 0}h</span>
              <span className="text-zinc-500">Standard: {summary.standard_hours || 0}h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                <DollarSign size={20} className="text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-3">TZS {(summary.gross_revenue || 0).toLocaleString()}</p>
            <p className="text-sm text-zinc-500">Gross Revenue</p>
            <p className="text-xs text-zinc-600 mt-2">{summary.total_sessions || 0} listening sessions</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-amber-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-3">TZS {(summary.platform_earnings || 0).toLocaleString()}</p>
            <p className="text-sm text-zinc-500">Platform Earnings</p>
            <p className="text-xs text-emerald-400 mt-2">
              Avg: TZS {summary.avg_earning_per_hour || 0}/hour
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center">
                <Users size={20} className="text-pink-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-3">TZS {(summary.choir_payouts || 0).toLocaleString()}</p>
            <p className="text-sm text-zinc-500">Choir Payouts</p>
            <p className="text-xs text-zinc-600 mt-2">
              Avg: TZS {summary.avg_earning_per_day || 0}/day
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Daily Revenue Chart */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <BarChart3 size={18} className="text-violet-400" />
              Daily Revenue (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={[...dailyData].reverse()}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="#71717a" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => [`TZS ${value}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-zinc-500">
                No data available. Generate demo data to see analytics.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Listening Hours Breakdown */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <PieChart size={18} className="text-emerald-400" />
              Content Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.total_listening_hours > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPie>
                    <Pie
                      data={[
                        { name: 'Premium', value: summary.premium_hours || 0, color: '#f59e0b' },
                        { name: 'Standard', value: summary.standard_hours || 0, color: '#8b5cf6' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#8b5cf6" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                      formatter={(value) => [`${value.toFixed(2)} hours`, '']}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-zinc-400">Premium ({((summary.premium_hours / summary.total_listening_hours) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-violet-500" />
                    <span className="text-sm text-zinc-400">Standard ({((summary.standard_hours / summary.total_listening_hours) * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-zinc-500">
                No listening data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Choirs */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <Users size={18} className="text-pink-400" />
              Top Performing Choirs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topChoirs.length > 0 ? (
              <div className="space-y-3">
                {topChoirs.map((choir, index) => (
                  <div key={choir.choir_id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-500 text-black' :
                      index === 1 ? 'bg-zinc-400 text-black' :
                      index === 2 ? 'bg-amber-700 text-white' :
                      'bg-zinc-700 text-white'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-white">{choir.name}</p>
                      <p className="text-xs text-zinc-500">{choir.total_hours} hours • {choir.total_plays} plays</p>
                    </div>
                    <span className="text-emerald-400 font-semibold">TZS {choir.revenue?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-8">No choir data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Albums */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <Music2 size={18} className="text-violet-400" />
              Top Performing Albums
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAlbums.length > 0 ? (
              <div className="space-y-3">
                {topAlbums.map((album, index) => (
                  <div key={album.album_id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-500 text-black' :
                      index === 1 ? 'bg-zinc-400 text-black' :
                      index === 2 ? 'bg-amber-700 text-white' :
                      'bg-zinc-700 text-white'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-white">{album.title}</p>
                      <p className="text-xs text-zinc-500">{album.artist} • {album.total_hours} hours</p>
                    </div>
                    <span className="text-zinc-400">{album.total_plays} plays</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-8">No album data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Choirs Revenue Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base font-semibold">All Choirs Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {choirRevenues.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Choir/Artist</th>
                    <th>Type</th>
                    <th>Premium Hours</th>
                    <th>Standard Hours</th>
                    <th>Total Plays</th>
                    <th>Gross Revenue</th>
                    <th>Platform Share</th>
                    <th>Net Revenue</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {choirRevenues.map((choir) => (
                    <tr key={choir.choir_id}>
                      <td className="font-medium">{choir.name}</td>
                      <td><span className="badge badge-info">{choir.type}</span></td>
                      <td className="text-amber-400">{choir.premium_hours}</td>
                      <td className="text-violet-400">{choir.standard_hours}</td>
                      <td>{choir.total_plays}</td>
                      <td>TZS {choir.gross_revenue?.toLocaleString()}</td>
                      <td className="text-zinc-500">TZS {choir.platform_share?.toLocaleString()}</td>
                      <td className="text-emerald-400 font-semibold">TZS {choir.net_revenue?.toLocaleString()}</td>
                      <td>TZS {choir.current_balance?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-zinc-500 text-center py-8">No choir revenue data available</p>
          )}
        </CardContent>
      </Card>

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Revenue Rate Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <Crown size={16} className="text-amber-400" />
                Premium Rate (TZS per hour)
              </label>
              <Input
                type="number"
                value={settings.premium_rate_per_hour}
                onChange={(e) => setSettings({ ...settings, premium_rate_per_hour: parseFloat(e.target.value) || 0 })}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">Applied to new releases and premium content</p>
            </div>
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <Gift size={16} className="text-violet-400" />
                Standard Rate (TZS per hour)
              </label>
              <Input
                type="number"
                value={settings.standard_rate_per_hour}
                onChange={(e) => setSettings({ ...settings, standard_rate_per_hour: parseFloat(e.target.value) || 0 })}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">Applied to standard and older content</p>
            </div>
            <div className="form-group">
              <label className="form-label flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-400" />
                Platform Share (%)
              </label>
              <Input
                type="number"
                value={settings.platform_share_percentage}
                onChange={(e) => setSettings({ ...settings, platform_share_percentage: parseFloat(e.target.value) || 0 })}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">Platform takes {settings.platform_share_percentage}%, choir receives {100 - settings.platform_share_percentage}%</p>
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Withdrawal (TZS)</label>
              <Input
                type="number"
                value={settings.minimum_withdrawal}
                onChange={(e) => setSettings({ ...settings, minimum_withdrawal: parseFloat(e.target.value) || 0 })}
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)} className="border-zinc-700">
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} className="bg-violet-600 hover:bg-violet-700">
              <Save size={16} className="mr-2" />
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
