import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Users, Music2, Church, Heart, UserCheck, CheckCircle,
  TrendingUp, DollarSign, Play, MapPin, Calendar, Smartphone, Globe,
  Headphones, Activity, Clock, Download, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [streamingStats, setStreamingStats] = useState(null);
  const [downloadStats, setDownloadStats] = useState(null);
  const [liveListeners, setLiveListeners] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // ============ TIERED FETCH FOR FAST DASHBOARD PAINT ============
        // Critical (blocks UI): overview + trends — the tiles + main charts.
        // Non-critical (background): demographics, realtime, downloads,
        // live-listeners — enrich the UI shortly after first paint.
        const [analyticsRes, trendsRes] = await Promise.all([
          axios.get(`${API}/analytics/overview`, { withCredentials: true }),
          axios.get(`${API}/analytics/trends`, { withCredentials: true }),
        ]);
        setAnalytics(analyticsRes.data);
        setTrends(trendsRes.data);
        // Unblock the UI as soon as the two critical payloads land.
        setLoading(false);

        // Now enrich in the background — no spinner, no blocking.
        Promise.all([
          axios.get(`${API}/analytics/user-demographics`, { withCredentials: true }).catch(() => ({ data: null })),
          axios.get(`${API}/analytics/realtime`, { withCredentials: true }).catch(() => ({ data: null })),
          axios.get(`${API}/analytics/download-stats`, { withCredentials: true }).catch(() => ({ data: null })),
          axios.get(`${API}/analytics/live-listeners`, { withCredentials: true }).catch(() => ({ data: null })),
        ]).then(([demographicsRes, streamingRes, downloadRes, liveRes]) => {
          if (demographicsRes.data) setDemographics(demographicsRes.data);
          if (streamingRes.data) setStreamingStats(streamingRes.data);
          if (downloadRes.data) setDownloadStats(downloadRes.data);
          if (liveRes.data) setLiveListeners(liveRes.data);
        }).catch(() => {});
      } catch (error) {
        console.error("Error fetching analytics:", error);
        setLoading(false);
      }
    };
    fetchData();
    
    // Refresh streaming stats and live listeners every 15 seconds
    const interval = setInterval(async () => {
      try {
        const [res, liveRes] = await Promise.all([
          axios.get(`${API}/analytics/realtime`, { withCredentials: true }),
          axios.get(`${API}/analytics/live-listeners`, { withCredentials: true })
        ]);
        setStreamingStats(res.data);
        setLiveListeners(liveRes.data);
      } catch (e) {}
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899'];
  const DEVICE_COLORS = { 'ANDROID': '#3ddc84', 'IOS': '#000', 'WEB': '#3b82f6', 'Unknown': '#6b7280' };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const stats = [
    { 
      label: "Total Users", 
      value: analytics?.total_users || 0, 
      icon: Users, 
      color: "bg-violet-600/20 text-violet-400",
      subValue: `${analytics?.total_customers || 0} customers`
    },
    { 
      label: "Total Songs", 
      value: analytics?.total_songs || 0, 
      icon: Music2, 
      color: "bg-emerald-600/20 text-emerald-400",
      subValue: `${analytics?.total_albums || 0} albums`
    },
    { 
      label: "Churches", 
      value: analytics?.total_churches || 0, 
      icon: Church, 
      color: "bg-amber-600/20 text-amber-400",
      subValue: `${analytics?.total_leaders || 0} leaders`
    },
    { 
      label: "Total Raised", 
      value: `$${(analytics?.total_raised || 0).toLocaleString()}`, 
      icon: Heart, 
      color: "bg-pink-600/20 text-pink-400",
      subValue: `${analytics?.total_donations || 0} campaigns`
    },
  ];

  const secondaryStats = [
    { label: "Customers", value: analytics?.total_customers || 0, icon: Users },
    { label: "System Users", value: analytics?.total_system_users || 0, icon: UserCheck },
    { label: "Religious Leaders", value: analytics?.total_leaders || 0, icon: UserCheck },
    { label: "Pending Approvals", value: analytics?.pending_approvals || 0, icon: CheckCircle },
  ];

  return (
    <div className="page-container animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back! Here's what's happening with your platform.</p>
      </div>

      {/* Live Streaming Banner */}
      {(streamingStats || liveListeners) && (
        <div className="bg-gradient-to-r from-emerald-900/30 via-zinc-900 to-violet-900/30 rounded-xl p-4 mb-6 border border-zinc-800">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-medium">Live</span>
                </div>
                <div className="text-zinc-300" data-testid="live-listeners-stat">
                  <span className="font-semibold text-white">{liveListeners?.total_active_listeners || streamingStats?.active_streams || 0}</span> live listeners
                </div>
                <div className="text-zinc-500">•</div>
                {/* Guests = anonymous active streams (not logged in). */}
                <div className="text-zinc-300" data-testid="active-guests-stat">
                  <span className="font-semibold text-amber-300">{streamingStats?.active_visitors || 0}</span> guests
                </div>
                <div className="text-zinc-500">•</div>
                <div className="text-zinc-300" data-testid="today-customers-stat">
                  <span className="font-semibold text-white">{streamingStats?.new_users_today || 0}</span> today&apos;s customers
                </div>
                <div className="text-zinc-500">•</div>
                <div className="text-zinc-300" data-testid="active-devices-stat">
                  <span className="font-semibold text-white">{liveListeners?.unique_devices || streamingStats?.unique_devices || 0}</span> devices
                </div>
                <div className="text-zinc-500">•</div>
                <div className="text-zinc-300" data-testid="plays-today-stat">
                  <span className="font-semibold text-white">{streamingStats?.plays_today || 0}</span> plays today
                  {streamingStats?.anonymous_plays_today > 0 && (
                    <span className="text-amber-300 ml-1" data-testid="guest-plays-today-stat">
                      ({streamingStats.anonymous_plays_today} guest)
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Device brand breakdown - quick glance of who's listening on what */}
            {streamingStats?.device_brands?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-700/50 flex items-center gap-2 flex-wrap" data-testid="device-brands-row">
                <span className="text-xs text-zinc-400">Devices:</span>
                {streamingStats.device_brands.slice(0, 6).map((d) => (
                  <span key={d.brand} className="text-xs bg-zinc-800/60 px-2 py-0.5 rounded-full">
                    <span className="text-white">{d.brand}</span>
                    <span className="text-emerald-400 ml-1">{d.count}</span>
                  </span>
                ))}
              </div>
            )}
            {/* Currently Playing */}
            {liveListeners?.top_playing_now?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-700/50">
                <div className="text-xs text-zinc-400 mb-2">Now Playing:</div>
                <div className="flex flex-wrap gap-2">
                  {liveListeners.top_playing_now.slice(0, 3).map((item, i) => (
                    <div key={i} className="bg-zinc-800/50 px-3 py-1 rounded-full text-xs">
                      <span className="text-white">{item.title}</span>
                      <span className="text-zinc-500 mx-1">•</span>
                      <span className="text-emerald-400">{item.listeners} listening</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Stats Banner */}
      {downloadStats && (
        <div className="bg-gradient-to-r from-blue-900/30 via-zinc-900 to-indigo-900/30 rounded-xl p-4 mb-6 border border-zinc-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-400" />
                <span className="text-blue-400 font-medium">Downloads</span>
              </div>
              <div className="text-zinc-300">
                <span className="font-semibold text-white">{downloadStats.total_downloads || 0}</span> total
              </div>
              <div className="text-zinc-500">•</div>
              <div className="text-zinc-300">
                <span className="font-semibold text-white">{downloadStats.downloads_today || 0}</span> today
              </div>
              <div className="text-zinc-500">•</div>
              <div className="text-zinc-300">
                <span className="font-semibold text-white">{downloadStats.downloads_this_week || 0}</span> this week
              </div>
              <div className="text-zinc-500">•</div>
              <div className="text-zinc-300">
                <span className="font-semibold text-white">{downloadStats.unique_downloaders || 0}</span> users
              </div>
            </div>
          </div>
          {/* Top Downloaded Songs */}
          {downloadStats?.top_downloaded_songs?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-700/50">
              <div className="text-xs text-zinc-400 mb-2">Most Downloaded:</div>
              <div className="flex flex-wrap gap-2">
                {downloadStats.top_downloaded_songs.slice(0, 5).map((song, i) => (
                  <div key={i} className="bg-zinc-800/50 px-3 py-1 rounded-full text-xs">
                    <span className="text-white">{song.title}</span>
                    <span className="text-zinc-500 mx-1">•</span>
                    <span className="text-blue-400">{song.downloads} downloads</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary Stats */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className={`stat-icon ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
              </div>
              <div className="mt-4">
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
                {stat.subValue && <p className="text-xs text-zinc-500 mt-1">{stat.subValue}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {secondaryStats.map((stat, index) => (
          <div key={index} className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-zinc-500 mb-1">
              <stat.icon size={14} />
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="text-xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* User Growth Chart - Now shows Total vs Active */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-violet-400" />
              Customer Growth
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Total customers vs active users over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trends?.user_growth || []}>
                <defs>
                  <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="activeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181b', 
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff'
                  }} 
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  name="Total Users"
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  fill="url(#userGradient)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="active" 
                  name="Active Users"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#activeGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donations Chart */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-400" />
              Donations Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trends?.donations_trend || []}>
                <defs>
                  <linearGradient id="donationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181b', 
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value) => [`$${value}`, 'Amount']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#donationGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Content Performance */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <Play size={18} className="text-amber-400" />
              Content Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trends?.content_performance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="category" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181b', 
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff'
                  }} 
                />
                <Bar dataKey="plays" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <Music2 size={18} className="text-pink-400" />
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={trends?.content_performance || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="plays"
                  nameKey="category"
                  paddingAngle={2}
                >
                  {(trends?.content_performance || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181b', 
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fff'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {(trends?.content_performance || []).map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-zinc-400">{item.category}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Demographics Section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users size={20} className="text-violet-400" />
          User Demographics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Device Type */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <Smartphone size={16} className="text-blue-400" />
                Device Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={demographics?.device?.data || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={3}
                  >
                    {(demographics?.device?.data || []).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={DEVICE_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {(demographics?.device?.data || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: DEVICE_COLORS[item.name] || COLORS[index] }}
                    />
                    <span className="text-xs text-zinc-400">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Gender Distribution */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <Users size={16} className="text-pink-400" />
                Gender
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={demographics?.gender?.data || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={3}
                  >
                    {(demographics?.gender?.data || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#ec4899', '#8b5cf6', '#6b7280'][index]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {(demographics?.gender?.data || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: ['#3b82f6', '#ec4899', '#8b5cf6', '#6b7280'][index] }}
                    />
                    <span className="text-xs text-zinc-400">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Age Distribution */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <Calendar size={16} className="text-amber-400" />
                Age Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={demographics?.age?.data || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#71717a" fontSize={10} />
                  <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={10} width={40} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      color: '#fff'
                    }} 
                  />
                  <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Location Distribution */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <MapPin size={16} className="text-emerald-400" />
                Top Locations
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                {demographics?.location?.total_locations || 0} countries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {(demographics?.location?.data || []).slice(0, 8).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs text-zinc-500">{index + 1}.</span>
                      <span className="text-sm text-zinc-300">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ 
                            width: `${Math.min(100, (item.value / (demographics?.total_users || 1)) * 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right">{item.value}</span>
                    </div>
                  </div>
                ))}
                {(!demographics?.location?.data || demographics.location.data.length === 0) && (
                  <div className="text-center text-zinc-500 text-sm py-4">
                    No location data yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
