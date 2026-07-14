import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  TrendingUp, DollarSign, Clock, Users, Music2, Play, Download,
  BarChart3, PieChart, Activity, Headphones, Disc, Mic2, RefreshCw,
  ArrowUp, ArrowDown, Minus, BookOpen, MousePointerClick, Globe, 
  Smartphone, Monitor, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend
} from "recharts";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

const StatCard = ({ icon: Icon, iconColor, label, value, subValue, trend, trendValue }) => (
  <Card className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-900/70 transition-colors">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg bg-${iconColor}-600/20 flex items-center justify-center`}>
          <Icon size={20} className={`text-${iconColor}-400`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500'
          }`}>
            {trend === 'up' ? <ArrowUp size={12} /> : trend === 'down' ? <ArrowDown size={12} /> : <Minus size={12} />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white mt-3">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
      {subValue && <p className="text-xs text-zinc-600 mt-1">{subValue}</p>}
    </CardContent>
  </Card>
);

// ==================== Data Usage Section ====================
// Powered by /api/analytics/data-usage. Shows:
//   1. Stat cards: total GB, stream GB, download GB, total listening minutes
//   2. Stacked bar chart: per-day stream MB + download MB (stacked = total GB)
//   3. Single bar chart: per-day listening minutes
//
// Assumptions are surfaced in a footnote so admins know how GB is derived.
const DataUsageSection = ({ dataUsage, period }) => {
  if (!dataUsage) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-500">Loading data-usage analytics...</p>
        </CardContent>
      </Card>
    );
  }

  const { summary = {}, daily = [], assumptions = {} } = dataUsage;
  const periodLabel = period === '7d' ? 'last 7 days' : period === '30d' ? 'last 30 days' : period === '90d' ? 'last 90 days' : 'last 12 months';

  // Pretty-format tick labels (MM-DD) for dense charts
  const fmtDate = (v) => (v && v.length >= 10) ? v.slice(5) : v;
  const fmtMB = (v) => `${(v ?? 0).toFixed(1)} MB`;
  const fmtMin = (v) => `${Math.round(v ?? 0)} min`;

  // Format GB summary
  const totalGB = summary.total_gb ?? 0;
  const streamGB = summary.stream_gb ?? 0;
  const downloadGB = summary.download_gb ?? 0;
  const listenMinutes = summary.total_listening_minutes ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          iconColor="cyan"
          label="Total Data Used"
          value={`${totalGB.toFixed(2)} GB`}
          subValue={`${periodLabel}`}
        />
        <StatCard
          icon={Play}
          iconColor="violet"
          label="Streaming Data"
          value={`${streamGB.toFixed(2)} GB`}
          subValue={`${(summary.total_streams || 0).toLocaleString()} streams`}
        />
        <StatCard
          icon={Download}
          iconColor="emerald"
          label="Downloads Data"
          value={`${downloadGB.toFixed(2)} GB`}
          subValue={`${(summary.total_downloads || 0).toLocaleString()} downloads`}
        />
        <StatCard
          icon={Clock}
          iconColor="amber"
          label="Listening Minutes"
          value={listenMinutes.toLocaleString()}
          subValue={`${(summary.unique_listeners || 0).toLocaleString()} unique listeners`}
        />
      </div>

      {/* Stacked bar: per-day data used (streams + downloads) */}
      <Card className="bg-zinc-900/50 border-zinc-800" data-testid="data-usage-chart-card">
        <CardHeader>
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <BarChart3 size={18} className="text-cyan-400" />
            Data Used per Day — Streams + Downloads
          </CardTitle>
          <p className="text-xs text-zinc-500 mt-1">
            Each bar = total MB egress that day. Inner blocks show streaming (cyan) vs downloads (violet).
          </p>
        </CardHeader>
        <CardContent>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={daily} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickFormatter={fmtDate} interval="preserveStartEnd" />
                <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v) => `${v} MB`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, color: '#fff' }}
                  formatter={(value, name) => [fmtMB(value), name]}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend wrapperStyle={{ paddingTop: 8, fontSize: 12 }} />
                <Bar dataKey="stream_mb" name="Streams" stackId="data" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                <Bar dataKey="download_mb" name="Downloads" stackId="data" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[320px] flex items-center justify-center text-zinc-500" data-testid="data-usage-chart-empty">
              No data-usage events recorded yet for this period.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single bar: per-day listening minutes */}
      <Card className="bg-zinc-900/50 border-zinc-800" data-testid="listening-minutes-chart-card">
        <CardHeader>
          <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
            <Clock size={18} className="text-amber-400" />
            Listening Minutes per Day
          </CardTitle>
          <p className="text-xs text-zinc-500 mt-1">
            Sum of all session durations (from listening_sessions).
          </p>
        </CardHeader>
        <CardContent>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={daily} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickFormatter={fmtDate} interval="preserveStartEnd" />
                <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v) => `${v}m`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, color: '#fff' }}
                  formatter={(value) => [fmtMin(value), 'Listening']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Bar dataKey="listening_minutes" name="Minutes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-zinc-500">
              No listening data recorded yet for this period.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assumptions footnote */}
      <Card className="bg-zinc-900/30 border-zinc-800/60">
        <CardContent className="py-3">
          <p className="text-[11px] text-zinc-500 leading-relaxed" data-testid="data-usage-assumptions">
            <span className="text-zinc-400 font-medium">How we compute data used:</span>{' '}
            streaming at <strong className="text-zinc-300">{assumptions.stream_kbps ?? 160} kbps</strong>{' '}
            and downloads at <strong className="text-zinc-300">{assumptions.download_kbps ?? 320} kbps</strong>.{' '}
            MB = (kbps × seconds) ÷ 8 ÷ 1024. Downloads use the song&apos;s stored duration; when missing we fall back to{' '}
            <strong className="text-zinc-300">{assumptions.avg_song_seconds_fallback ?? 240}s</strong> per song.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};


// ============================================================================
// UserAnalyticsSection — daily trend of new registrations + unique visitors
// with a configurable date filter (preset OR single day OR range). Powers the
// "Users" tab on the Analytics page.
// ============================================================================
const UserAnalyticsSection = () => {
  const [period, setPeriod] = useState('30d'); // '7d'|'30d'|'90d'|'365d'|'day'|'range'
  const [singleDate, setSingleDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period === 'day' && singleDate) {
        params.set('date', singleDate);
      } else if (period === 'range' && (dateFrom || dateTo)) {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      } else if (['7d', '30d', '90d', '365d'].includes(period)) {
        params.set('period', period);
      } else {
        params.set('period', '30d');
      }
      const res = await axios.get(`${API}/analytics/user-trends?${params.toString()}`, {
        withCredentials: true,
      });
      setData(res.data);
    } catch (e) {
      console.error('[UserAnalytics] fetch error', e);
      setData({ series: [], total_users: 0, total_visitors: 0 });
    } finally {
      setLoading(false);
    }
  }, [period, singleDate, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const series = data?.series || [];
  const totalUsers = data?.total_users || 0;
  const totalVisitors = data?.total_visitors || 0;

  const chipBase = 'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors';
  const chipActive = 'bg-violet-600 border-violet-500 text-white';
  const chipIdle = 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700';

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {['7d', '30d', '90d', '365d'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`${chipBase} ${period === p ? chipActive : chipIdle}`}
            data-testid={`user-trends-period-${p}`}
          >
            {p === '365d' ? '1y' : p}
          </button>
        ))}
        <button
          onClick={() => setPeriod('day')}
          className={`${chipBase} ${period === 'day' ? chipActive : chipIdle}`}
          data-testid="user-trends-period-day"
        >
          Single Day
        </button>
        <button
          onClick={() => setPeriod('range')}
          className={`${chipBase} ${period === 'range' ? chipActive : chipIdle}`}
          data-testid="user-trends-period-range"
        >
          Custom Range
        </button>

        {period === 'day' && (
          <input
            type="date"
            value={singleDate}
            onChange={(e) => setSingleDate(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
            data-testid="user-trends-single-date"
          />
        )}
        {period === 'range' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
              data-testid="user-trends-date-from"
            />
            <span className="text-zinc-500 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
              data-testid="user-trends-date-to"
            />
          </div>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">New Users</p>
          <p className="text-2xl font-bold text-white mt-1" data-testid="user-trends-total-users">{totalUsers.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Unique Visitors</p>
          <p className="text-2xl font-bold text-white mt-1" data-testid="user-trends-total-visitors">{totalVisitors.toLocaleString()}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
        <p className="text-white text-sm font-semibold mb-2">Users & Visitors Trend</p>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">Loading…</div>
        ) : series.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">No data in this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="date" stroke="#71717a" fontSize={10} interval="preserveStartEnd" />
              <YAxis stroke="#71717a" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46' }} labelStyle={{ color: '#a1a1aa' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="users" name="New Users" stroke="#8b5cf6" strokeWidth={2} fill="url(#usersGradient)" />
              <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#3b82f6" strokeWidth={2} fill="url(#visitorsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};




export default function EnhancedAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [bibleAnalytics, setBibleAnalytics] = useState(null);
  const [navigationAnalytics, setNavigationAnalytics] = useState(null);
  const [replayStats, setReplayStats] = useState(null);
  const [deviceDistribution, setDeviceDistribution] = useState(null);
  const [dataUsage, setDataUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [replayPeriod, setReplayPeriod] = useState("day");
  const [activeSection, setActiveSection] = useState("overview"); // overview or navigation

  const fetchAnalytics = useCallback(async () => {
    try {
      const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      // Each request is independently catch-wrapped so a single endpoint
      // failure (e.g. validation error on `days=365`) cannot break the whole
      // dashboard. The period toggles must always work.
      const [analyticsRes, realtimeRes, bibleRes, navRes, deviceRes, dataUsageRes] = await Promise.all([
        axios.get(`${API}/analytics/enhanced?period=${period}`, { withCredentials: true }).catch((e) => { console.warn('enhanced failed', e?.response?.status); return { data: null }; }),
        axios.get(`${API}/analytics/realtime`, { withCredentials: true }).catch((e) => { console.warn('realtime failed', e?.response?.status); return { data: null }; }),
        axios.get(`${API}/admin/bible/analytics?days=${Math.min(periodDays, 365)}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/analytics/navigation?days=${periodDays}`, { withCredentials: true }).catch((e) => { console.warn('navigation failed', e?.response?.status); return { data: null }; }),
        axios.get(`${API}/analytics/device-distribution`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/analytics/data-usage?days=${periodDays}`, { withCredentials: true }).catch(() => ({ data: null })),
      ]);
      setAnalytics(analyticsRes.data);
      setRealtime(realtimeRes.data);
      setBibleAnalytics(bibleRes.data);
      setNavigationAnalytics(navRes.data);
      setDeviceDistribution(deviceRes.data);
      setDataUsage(dataUsageRes.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchReplayStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/analytics/replay-stats?period=${replayPeriod}`, { withCredentials: true });
      setReplayStats(res.data);
    } catch (error) {
      console.error("Error fetching replay stats:", error);
    }
  }, [replayPeriod]);

  useEffect(() => {
    fetchAnalytics();
    // Refresh realtime data every 30 seconds
    const interval = setInterval(() => {
      axios.get(`${API}/analytics/realtime`, { withCredentials: true })
        .then(res => setRealtime(res.data))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  useEffect(() => {
    fetchReplayStats();
  }, [fetchReplayStats]);

  const generateDemoData = async () => {
    try {
      setLoading(true);
      await axios.post(`${API}/demo/generate-listening-data`, {}, { withCredentials: true });
      toast.success("Demo data generated!");
      fetchAnalytics();
    } catch (error) {
      toast.error("Failed to generate demo data");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const overview = analytics?.overview || {};
  const platformStats = analytics?.platform_stats || {};
  const revenueBreakdown = analytics?.revenue_breakdown || {};
  const dailyTrend = analytics?.daily_trend || [];
  const topSongs = analytics?.top_songs || [];
  const topChoirs = analytics?.top_choirs || [];
  const categories = analytics?.categories || [];

  return (
    <div className="page-container animate-fade-in" data-testid="enhanced-analytics-page">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Activity className="text-violet-400" /> Analytics Dashboard
          </h1>
          <p className="page-subtitle">Comprehensive platform performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Section Toggle - Overview vs User Navigation */}
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => setActiveSection("overview")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                activeSection === "overview" ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart3 size={14} /> Overview
            </button>
            <button
              onClick={() => setActiveSection("navigation")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                activeSection === "navigation" ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <MousePointerClick size={14} /> User Navigation
            </button>
          </div>
          {/* Period Selector */}
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            {['7d', '30d', '90d', '1y'].map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setLoading(true); }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === p ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
          <Button onClick={generateDemoData} variant="outline" className="border-zinc-700 text-zinc-300">
            <BarChart3 size={16} className="mr-2" /> Generate Data
          </Button>
          <Button onClick={fetchAnalytics} variant="outline" className="border-zinc-700">
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* Real-time Banner */}
      {realtime && (
        <div className="bg-gradient-to-r from-emerald-900/30 via-zinc-900 to-violet-900/30 rounded-xl p-4 mb-6 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 font-medium">Live</span>
              </div>
              <div className="text-zinc-300">
                <span className="font-semibold text-white">{realtime.active_streams}</span> active streams
              </div>
              <div className="text-zinc-500">•</div>
              <div className="text-zinc-300">
                <span className="font-semibold text-white">{realtime.active_listeners}</span> listeners now
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Navigation Section */}
      {activeSection === "navigation" ? (
        <UserNavigationSection data={navigationAnalytics} period={period} />
      ) : (
        <>
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <StatCard 
          icon={Play} 
          iconColor="violet"
          label="Total Streams" 
          value={overview.total_streams?.toLocaleString() || 0}
          subValue={`${overview.revenue_streams?.toLocaleString() || 0} revenue-eligible`}
        />
        <StatCard 
          icon={Users} 
          iconColor="blue"
          label="Unique Listeners" 
          value={overview.unique_listeners?.toLocaleString() || 0}
        />
        <StatCard 
          icon={Clock} 
          iconColor="emerald"
          label="Total Hours" 
          value={overview.total_listening_hours?.toLocaleString() || 0}
          subValue={`${overview.avg_session_duration || 0} min avg session`}
        />
        <StatCard 
          icon={DollarSign} 
          iconColor="amber"
          label="Gross Revenue" 
          value={`TZS ${(overview.gross_revenue || 0).toLocaleString()}`}
        />
        <StatCard 
          icon={TrendingUp} 
          iconColor="pink"
          label="Platform Revenue" 
          value={`TZS ${(overview.platform_revenue || 0).toLocaleString()}`}
        />
        <StatCard 
          icon={Headphones} 
          iconColor="cyan"
          label="Songs Played" 
          value={overview.unique_songs_played?.toLocaleString() || 0}
        />
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Disc size={24} className="text-violet-400" />
            <div>
              <p className="text-xl font-bold text-white">{platformStats.total_albums || 0}</p>
              <p className="text-xs text-zinc-500">Albums</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Music2 size={24} className="text-emerald-400" />
            <div>
              <p className="text-xl font-bold text-white">{platformStats.total_songs || 0}</p>
              <p className="text-xs text-zinc-500">Songs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Mic2 size={24} className="text-pink-400" />
            <div>
              <p className="text-xl font-bold text-white">{platformStats.total_choirs || 0}</p>
              <p className="text-xs text-zinc-500">Choirs/Artists</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Users size={24} className="text-blue-400" />
            <div>
              <p className="text-xl font-bold text-white">{platformStats.total_users || 0}</p>
              <p className="text-xs text-zinc-500">Users</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600">Overview</TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-violet-600" data-testid="analytics-tab-users">
            <Activity size={14} className="mr-1" /> Users
          </TabsTrigger>
          <TabsTrigger value="revenue" className="data-[state=active]:bg-violet-600">Revenue</TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-violet-600">Content</TabsTrigger>
          <TabsTrigger value="replays" className="data-[state=active]:bg-orange-600">
            <RefreshCw size={14} className="mr-1" /> Replays
          </TabsTrigger>
          <TabsTrigger value="devices" className="data-[state=active]:bg-blue-600">
            <Smartphone size={14} className="mr-1" /> Devices
          </TabsTrigger>
          <TabsTrigger value="data-usage" className="data-[state=active]:bg-cyan-600" data-testid="analytics-tab-data-usage">
            <Activity size={14} className="mr-1" /> Data Usage
          </TabsTrigger>
          <TabsTrigger value="bible" className="data-[state=active]:bg-amber-600">
            <BookOpen size={14} className="mr-1" /> Bible
          </TabsTrigger>
          <TabsTrigger value="choirs" className="data-[state=active]:bg-violet-600">Choirs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Daily Trend Chart */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                <BarChart3 size={18} className="text-violet-400" />
                Daily Performance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="streamsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickFormatter={(v) => v?.slice(5) || ''} />
                    <YAxis yAxisId="left" stroke="#71717a" fontSize={10} />
                    <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                    />
                    <Area yAxisId="left" type="monotone" dataKey="streams" name="Streams" stroke="#8b5cf6" strokeWidth={2} fill="url(#streamsGradient)" />
                    <Area yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (TZS)" stroke="#10b981" strokeWidth={2} fill="url(#revenueGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[320px] flex items-center justify-center text-zinc-500">
                  No trend data available. Generate demo data to see analytics.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                  <PieChart size={18} className="text-emerald-400" />
                  Category Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categories.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <RechartsPie>
                      <Pie
                        data={categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="streams"
                        nameKey="name"
                        paddingAngle={2}
                      >
                        {categories.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                      />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-zinc-500">
                    No category data
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue Breakdown */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base font-semibold">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-800/30">
                    <div className="flex justify-between items-center">
                      <span className="text-amber-400">Premium Content</span>
                      <span className="text-white font-semibold">TZS {(revenueBreakdown.premium_revenue || 0).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{revenueBreakdown.premium_hours || 0} hours</p>
                  </div>
                  <div className="p-4 bg-violet-900/20 rounded-lg border border-violet-800/30">
                    <div className="flex justify-between items-center">
                      <span className="text-violet-400">Standard Content</span>
                      <span className="text-white font-semibold">TZS {(revenueBreakdown.standard_revenue || 0).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{revenueBreakdown.standard_hours || 0} hours</p>
                  </div>
                  <div className="p-4 bg-emerald-900/20 rounded-lg border border-emerald-800/30">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400">Choir Payouts</span>
                      <span className="text-white font-semibold">TZS {(overview.choir_payouts || 0).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{100 - (analytics?.rates?.platform_share || 30)}% of gross</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab — trend of new registrations + unique visitors */}
        <TabsContent value="users" className="space-y-6" data-testid="analytics-tab-content-users">
          <UserAnalyticsSection />
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800 col-span-2">
              <CardHeader>
                <CardTitle className="text-white text-base">Revenue Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickFormatter={(v) => v?.slice(5) || ''} />
                      <YAxis stroke="#71717a" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                        formatter={(value) => [`TZS ${value}`, 'Revenue']}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-zinc-500">No data</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Rate Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500">Premium Rate</p>
                  <p className="text-lg font-semibold text-amber-400">TZS {analytics?.rates?.premium_rate || 0}/hour</p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500">Standard Rate</p>
                  <p className="text-lg font-semibold text-violet-400">TZS {analytics?.rates?.standard_rate || 0}/hour</p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500">Platform Share</p>
                  <p className="text-lg font-semibold text-emerald-400">{analytics?.rates?.platform_share || 0}%</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          {/* Album Performance */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Disc size={18} className="text-emerald-400" />
                Album Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.albums?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left text-xs text-zinc-500 pb-3 font-medium">#</th>
                        <th className="text-left text-xs text-zinc-500 pb-3 font-medium">Album</th>
                        <th className="text-left text-xs text-zinc-500 pb-3 font-medium">Artist</th>
                        <th className="text-right text-xs text-zinc-500 pb-3 font-medium">Plays</th>
                        <th className="text-right text-xs text-zinc-500 pb-3 font-medium">Minutes Streamed</th>
                        <th className="text-right text-xs text-zinc-500 pb-3 font-medium">Hours</th>
                        <th className="text-right text-xs text-zinc-500 pb-3 font-medium">Avg/Play</th>
                        <th className="text-right text-xs text-zinc-500 pb-3 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.albums.map((album, index) => (
                        <tr key={album.album_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="py-3 pr-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-amber-500 text-black' :
                              index === 1 ? 'bg-zinc-400 text-black' :
                              index === 2 ? 'bg-amber-700 text-white' :
                              'bg-zinc-700 text-white'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3">
                            <p className="font-medium text-white text-sm">{album.title}</p>
                            <Badge variant="outline" className="text-[10px] mt-1 border-zinc-700">
                              {album.monetization_type || 'standard'}
                            </Badge>
                          </td>
                          <td className="py-3 text-sm text-zinc-400">{album.artist_name || 'Unknown'}</td>
                          <td className="py-3 text-right font-semibold text-violet-400">{album.total_plays?.toLocaleString()}</td>
                          <td className="py-3 text-right">
                            <span className="font-bold text-emerald-400 text-lg">{album.minutes_streamed?.toLocaleString()}</span>
                            <span className="text-zinc-500 text-xs ml-1">min</span>
                          </td>
                          <td className="py-3 text-right text-zinc-400 text-sm">{album.total_hours}h</td>
                          <td className="py-3 text-right text-zinc-500 text-sm">{album.avg_minutes_per_play} min</td>
                          <td className="py-3 text-right font-semibold text-amber-400">TZS {album.revenue?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">No album performance data available</p>
              )}
            </CardContent>
          </Card>

          {/* Top Songs */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Music2 size={18} className="text-violet-400" />
                Top Performing Songs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topSongs.length > 0 ? (
                <div className="space-y-3">
                  {topSongs.map((song, index) => (
                    <div key={song.song_id} className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-amber-500 text-black' :
                        index === 1 ? 'bg-zinc-400 text-black' :
                        index === 2 ? 'bg-amber-700 text-white' :
                        'bg-zinc-700 text-white'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-white">{song.title}</p>
                        <p className="text-xs text-zinc-500">{song.artist} • {song.album}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-violet-400">{song.plays?.toLocaleString()} plays</p>
                        <p className="text-xs text-zinc-500">{song.hours} hours</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">No song data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replays Analytics Tab */}
        <TabsContent value="replays" className="space-y-6">
          {/* Period Selector */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <RefreshCw className="text-orange-400" size={20} />
              Replay Analytics
            </h3>
            <div className="flex gap-2">
              {['day', 'week', 'month'].map(p => (
                <Button
                  key={p}
                  variant={replayPeriod === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReplayPeriod(p)}
                  className={replayPeriod === p ? 'bg-orange-600' : ''}
                >
                  {p === 'day' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                </Button>
              ))}
            </div>
          </div>

          {/* Replay Summary Cards */}
          {replayStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                icon={Users}
                iconColor="orange"
                label="Users Who Replayed"
                value={replayStats.summary?.users_who_replayed || 0}
                subValue="Same song, same day"
              />
              <StatCard
                icon={Clock}
                iconColor="blue"
                label="Total Replay Minutes"
                value={`${replayStats.summary?.total_replay_minutes?.toLocaleString() || 0} min`}
                subValue="Accumulated replay time"
              />
              <StatCard
                icon={Music2}
                iconColor="purple"
                label="Replay Sessions"
                value={replayStats.summary?.total_replay_sessions || 0}
                subValue="Total replay instances"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users Who Replayed */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                  <Users size={18} className="text-orange-400" />
                  Users Who Replayed Same Song
                </CardTitle>
              </CardHeader>
              <CardContent>
                {replayStats?.user_replays?.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-auto">
                    {replayStats.user_replays.slice(0, 20).map((replay, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <div className="w-10 h-10 bg-orange-600/20 rounded-full flex items-center justify-center text-orange-400 font-bold">
                          {replay.replay_count}x
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{replay.song_title}</p>
                          <p className="text-xs text-zinc-500">{replay.user_name || replay.user_email || 'Anonymous'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-orange-400">{replay.total_minutes} min</p>
                          <p className="text-xs text-zinc-500">{replay.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-8">No replay data for this period</p>
                )}
              </CardContent>
            </Card>

            {/* Top Replayed Songs */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                  <Music2 size={18} className="text-purple-400" />
                  Most Replayed Songs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {replayStats?.top_replayed_songs?.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-auto">
                    {replayStats.top_replayed_songs.map((song, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <div className="w-8 h-8 bg-purple-600/20 rounded flex items-center justify-center text-purple-400 font-bold text-sm">
                          #{idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{song.song_title}</p>
                          <p className="text-xs text-zinc-500">{song.artist_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-purple-400">{song.total_plays} plays</p>
                          <p className="text-xs text-zinc-500">{song.unique_users} users • {song.replay_ratio}x avg</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-8">No replay data for this period</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Device Analytics Tab */}
        <TabsContent value="devices" className="space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Smartphone className="text-blue-400" size={20} />
            Device & Platform Distribution
          </h3>

          {deviceDistribution ? (
            <>
              {/* Platform Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  icon={Smartphone}
                  iconColor="green"
                  label="Android Users"
                  value={deviceDistribution.platform_distribution?.android || 0}
                  subValue={`${((deviceDistribution.platform_distribution?.android || 0) / (deviceDistribution.total_users || 1) * 100).toFixed(1)}%`}
                />
                <StatCard
                  icon={Smartphone}
                  iconColor="blue"
                  label="iOS Users"
                  value={deviceDistribution.platform_distribution?.ios || 0}
                  subValue={`${((deviceDistribution.platform_distribution?.ios || 0) / (deviceDistribution.total_users || 1) * 100).toFixed(1)}%`}
                />
                <StatCard
                  icon={Monitor}
                  iconColor="purple"
                  label="Web Users"
                  value={deviceDistribution.platform_distribution?.web || 0}
                  subValue={`${((deviceDistribution.platform_distribution?.web || 0) / (deviceDistribution.total_users || 1) * 100).toFixed(1)}%`}
                />
                <StatCard
                  icon={Users}
                  iconColor="gray"
                  label="Unknown Platform"
                  value={deviceDistribution.platform_distribution?.unknown || 0}
                  subValue="Needs device tracking"
                />
              </div>

              {/* Platform Pie Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <PieChart size={18} className="text-blue-400" />
                      Platform Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPie>
                        <Pie
                          data={Object.entries(deviceDistribution.platform_distribution || {}).map(([name, value]) => ({
                            name: name.charAt(0).toUpperCase() + name.slice(1),
                            value
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(deviceDistribution.platform_distribution || {}).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Manufacturer Distribution */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <Smartphone size={18} className="text-green-400" />
                      Device Manufacturers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {Object.entries(deviceDistribution.manufacturer_distribution || {}).map(([manufacturer, count], idx) => (
                        <div key={manufacturer} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                              {idx + 1}
                            </div>
                            <span className="text-white">{manufacturer}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{count}</Badge>
                            <span className="text-xs text-zinc-500">
                              {((count / deviceDistribution.total_users) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Device Models and Location */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Device Models */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <Smartphone size={18} className="text-orange-400" />
                      Top Device Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {Object.entries(deviceDistribution.top_device_models || {}).map(([model, count], idx) => (
                        <div key={model} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                          <span className="text-sm text-white truncate flex-1">{model}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Location Distribution */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
                      <Globe size={18} className="text-cyan-400" />
                      Location Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {Object.entries(deviceDistribution.location_distribution || {}).map(([location, count]) => (
                        <div key={location} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                          <span className="text-sm text-white">{location}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="py-12 text-center">
                <Smartphone className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
                <p className="text-zinc-500">Loading device analytics...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Data Usage Tab */}
        <TabsContent value="data-usage" className="space-y-6" data-testid="analytics-tab-content-data-usage">
          <DataUsageSection dataUsage={dataUsage} period={period} />
        </TabsContent>

        {/* Bible Analytics Tab */}
        <TabsContent value="bible" className="space-y-6">
          {/* Bible Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              icon={BookOpen}
              iconColor="amber"
              label="Total Bible Listens"
              value={bibleAnalytics?.total_listens?.toLocaleString() || 0}
              subValue="Last 30 days"
            />
            <StatCard
              icon={Mic2}
              iconColor="violet"
              label="Audio Snippets"
              value={bibleAnalytics?.top_snippets?.length || 0}
              subValue="Pre-generated passages"
            />
            <StatCard
              icon={BarChart3}
              iconColor="emerald"
              label="Most Popular Book"
              value={bibleAnalytics?.popular_books?.[0]?.book || "N/A"}
              subValue={`${bibleAnalytics?.popular_books?.[0]?.count || 0} listens`}
            />
            <StatCard
              icon={Clock}
              iconColor="blue"
              label="Peak Listening Time"
              value={(() => {
                const times = bibleAnalytics?.listening_times || [];
                const peak = times.reduce((max, t) => t.count > (max?.count || 0) ? t : max, null);
                const labels = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" };
                return labels[peak?.time] || "N/A";
              })()}
              subValue="When users listen most"
            />
          </div>

          {/* Bible Popular Books */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp size={18} className="text-amber-400" />
                  Most Read Bible Books
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bibleAnalytics?.popular_books?.length > 0 ? (
                  <div className="space-y-3">
                    {bibleAnalytics.popular_books.slice(0, 5).map((book, idx) => (
                      <div key={book.book} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-white">{book.book}</span>
                        </div>
                        <Badge className="bg-zinc-800">{book.count} listens</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-8">No Bible listening data yet</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock size={18} className="text-blue-400" />
                  Listening Times Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bibleAnalytics?.listening_times?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPie>
                      <Pie
                        data={bibleAnalytics.listening_times.map(t => ({
                          name: { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" }[t.time] || t.time,
                          value: t.count
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {bibleAnalytics.listening_times.map((_, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </RechartsPie>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-zinc-500 text-center py-8">No listening time data yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Snippets */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic2 size={18} className="text-violet-400" />
                Top Bible Snippets by Plays
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bibleAnalytics?.top_snippets?.length > 0 ? (
                <div className="space-y-3">
                  {bibleAnalytics.top_snippets.map((snippet, idx) => (
                    <div key={snippet.snippet_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-white">{snippet.title}</p>
                          <p className="text-xs text-amber-400">{snippet.reference}</p>
                        </div>
                      </div>
                      <Badge className="bg-violet-500/20 text-violet-400">{snippet.play_count} plays</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">No snippet plays yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Choirs Tab */}
        <TabsContent value="choirs" className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Mic2 size={18} className="text-pink-400" />
                Top Performing Choirs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topChoirs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Choir/Artist</th>
                        <th>Streams</th>
                        <th>Hours</th>
                        <th>Unique Listeners</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topChoirs.map((choir, index) => (
                        <tr key={choir.choir_id}>
                          <td>
                            <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-amber-500 text-black' :
                              index === 1 ? 'bg-zinc-400 text-black' :
                              index === 2 ? 'bg-amber-700 text-white' :
                              'bg-zinc-700 text-white'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="font-medium">{choir.name}</td>
                          <td>{choir.streams?.toLocaleString()}</td>
                          <td>{choir.hours}</td>
                          <td>{choir.unique_listeners}</td>
                          <td className="text-emerald-400 font-semibold">TZS {choir.revenue?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">No choir performance data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}

// User Navigation Analytics Section Component
const UserNavigationSection = ({ data, period }) => {
  const navData = data || {};
  const topPages = navData.top_pages || [];
  const entryPages = navData.entry_pages || [];
  const platforms = navData.platforms || [];
  const dailyTrend = navData.daily_trend || [];
  const flows = navData.flows || [];
  const summary = navData.summary || {};

  // Page name formatting helper
  const formatPageName = (path) => {
    if (!path) return 'Unknown';
    const pageNames = {
      '/': 'Landing Page',
      '/app': 'Web App Home',
      '/login': 'Login Page',
      '/checkout': 'Payment/Checkout',
      '/payment': 'Payment Page',
      '/subscription': 'Subscription Page',
      '/library': 'Library',
      '/search': 'Search',
      '/album': 'Album View',
      '/playlist': 'Playlist View',
      '/artist': 'Artist Page',
      '/choir': 'Choir Page',
      '/bible': 'Bible Section',
      '/settings': 'Settings',
      '/profile': 'User Profile',
      '/downloads': 'Downloads',
      '/favorites': 'Favorites/Liked',
      '/church': 'Church Page',
      '/seminars': 'Seminars',
      '/donations': 'Donations',
    };
    // Check exact match first
    if (pageNames[path]) return pageNames[path];
    // Check partial matches
    for (const [key, name] of Object.entries(pageNames)) {
      if (path.includes(key) && key !== '/') return name;
    }
    // Fallback: format the path
    return path.replace(/^\//, '').replace(/-/g, ' ').replace(/\//g, ' > ') || 'Home';
  };

  const getPlatformIcon = (platform) => {
    if (!platform) return <Globe size={16} />;
    const p = platform.toLowerCase();
    if (p.includes('android') || p.includes('mobile') || p.includes('ios')) return <Smartphone size={16} />;
    return <Monitor size={16} />;
  };

  return (
    <div className="space-y-6">
      {/* Navigation Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={MousePointerClick}
          iconColor="emerald"
          label="Total Page Views"
          value={summary.total_page_views?.toLocaleString() || 0}
          subValue={`Last ${period === '7d' ? '7 days' : period === '30d' ? '30 days' : period === '90d' ? '90 days' : 'year'}`}
        />
        <StatCard
          icon={Users}
          iconColor="blue"
          label="Unique Visitors"
          value={summary.unique_visitors?.toLocaleString() || 0}
        />
        <StatCard
          icon={Clock}
          iconColor="violet"
          label="Avg. Time on Page"
          value={`${Math.round(summary.avg_time_on_page || 0)}s`}
          subValue="Average per page view"
        />
        <StatCard
          icon={ArrowRight}
          iconColor="pink"
          label="User Sessions"
          value={summary.total_sessions?.toLocaleString() || topPages.reduce((sum, p) => sum + (p.views || 0), 0).toLocaleString()}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <MousePointerClick size={18} className="text-emerald-400" />
              Most Visited Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPages.length > 0 ? (
              <div className="space-y-3">
                {topPages.slice(0, 10).map((page, index) => (
                  <div key={page.page || index} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-emerald-500 text-black' :
                      index === 1 ? 'bg-emerald-400 text-black' :
                      index === 2 ? 'bg-emerald-600 text-white' :
                      'bg-zinc-700 text-white'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{formatPageName(page.page)}</p>
                      <p className="text-xs text-zinc-500 truncate">{page.page}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-400">{page.views?.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">views</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-zinc-500">
                <MousePointerClick size={48} className="mb-4 opacity-30" />
                <p>No page view data available</p>
                <p className="text-xs mt-1">Data will appear as users navigate the app</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entry Points */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <ArrowRight size={18} className="text-violet-400" />
              Entry Points (First Page Visited)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entryPages.length > 0 ? (
              <div className="space-y-3">
                {entryPages.slice(0, 8).map((page, index) => (
                  <div key={page.page || index} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-white">{formatPageName(page.page)}</span>
                    </div>
                    <Badge className="bg-violet-500/20 text-violet-400">{page.count?.toLocaleString()} sessions</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-zinc-500">
                No entry point data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Distribution & Daily Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform Distribution */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Globe size={18} className="text-blue-400" />
              Platform Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platforms.length > 0 ? (
              <div className="space-y-4">
                {platforms.map((platform, index) => {
                  const total = platforms.reduce((sum, p) => sum + (p.count || 0), 0);
                  const percentage = total > 0 ? ((platform.count / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={platform.platform || index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(platform.platform)}
                          <span className="text-white text-sm">{platform.platform || 'Unknown'}</span>
                        </div>
                        <span className="text-zinc-400 text-sm">{percentage}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500">{platform.count?.toLocaleString()} views</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-zinc-500">
                No platform data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Views Trend */}
        <Card className="bg-zinc-900/50 border-zinc-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <BarChart3 size={18} className="text-amber-400" />
              Daily Page Views Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickFormatter={(v) => v?.slice(5) || ''} />
                  <YAxis stroke="#71717a" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="views" name="Page Views" stroke="#10b981" strokeWidth={2} fill="url(#viewsGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-zinc-500">
                No daily trend data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Flows */}
      {flows.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <ArrowRight size={18} className="text-pink-400" />
              Common User Journeys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {flows.slice(0, 5).map((flow, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg overflow-x-auto">
                  <span className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    {flow.pages?.map((page, pageIndex) => (
                      <div key={pageIndex} className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-zinc-700 rounded text-xs text-white whitespace-nowrap">
                          {formatPageName(page)}
                        </span>
                        {pageIndex < flow.pages.length - 1 && (
                          <ArrowRight size={14} className="text-zinc-500 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                  <Badge className="bg-zinc-700 text-zinc-300 flex-shrink-0">{flow.count} users</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
