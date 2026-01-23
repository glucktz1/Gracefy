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

export default function EnhancedAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [bibleAnalytics, setBibleAnalytics] = useState(null);
  const [navigationAnalytics, setNavigationAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");
  const [activeSection, setActiveSection] = useState("overview"); // overview or navigation

  const fetchAnalytics = useCallback(async () => {
    try {
      const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      const [analyticsRes, realtimeRes, bibleRes, navRes] = await Promise.all([
        axios.get(`${API}/analytics/enhanced?period=${period}`, { withCredentials: true }),
        axios.get(`${API}/analytics/realtime`, { withCredentials: true }),
        axios.get(`${API}/admin/bible/analytics?days=30`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/analytics/navigation?days=${periodDays}`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      setAnalytics(analyticsRes.data);
      setRealtime(realtimeRes.data);
      setBibleAnalytics(bibleRes.data);
      setNavigationAnalytics(navRes.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period]);

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
          <TabsTrigger value="revenue" className="data-[state=active]:bg-violet-600">Revenue</TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-violet-600">Content</TabsTrigger>
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
    </div>
  );
}
