import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Users, Music2, Church, Heart, UserCheck, CheckCircle,
  TrendingUp, DollarSign, Play, MapPin, Calendar, Smartphone, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsRes, trendsRes, demographicsRes] = await Promise.all([
          axios.get(`${API}/analytics/overview`, { withCredentials: true }),
          axios.get(`${API}/analytics/trends`, { withCredentials: true }),
          axios.get(`${API}/analytics/user-demographics`, { withCredentials: true })
        ]);
        setAnalytics(analyticsRes.data);
        setTrends(trendsRes.data);
        setDemographics(demographicsRes.data);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
      trend: "+12%"
    },
    { 
      label: "Total Songs", 
      value: analytics?.total_songs || 0, 
      icon: Music2, 
      color: "bg-emerald-600/20 text-emerald-400",
      trend: "+8%"
    },
    { 
      label: "Churches", 
      value: analytics?.total_churches || 0, 
      icon: Church, 
      color: "bg-amber-600/20 text-amber-400",
      trend: "+5%"
    },
    { 
      label: "Total Raised", 
      value: `$${(analytics?.total_raised || 0).toLocaleString()}`, 
      icon: Heart, 
      color: "bg-pink-600/20 text-pink-400",
      trend: "+24%"
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

      {/* Primary Stats */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <Card key={index} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className={`stat-icon ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
                <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                  <TrendingUp size={12} />
                  {stat.trend}
                </span>
              </div>
              <div className="mt-4">
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
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
        {/* User Growth Chart */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-violet-400" />
              User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trends?.user_growth || []}>
                <defs>
                  <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
                <Area 
                  type="monotone" 
                  dataKey="users" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  fill="url(#userGradient)" 
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
    </div>
  );
}
