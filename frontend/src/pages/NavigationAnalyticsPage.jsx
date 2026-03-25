import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Activity, TrendingUp, Users, Clock, MousePointer, ArrowRight,
  Smartphone, Monitor, Globe, RefreshCw, Calendar, ChevronRight,
  Home, ShoppingCart, LogIn, Search as SearchIcon, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const API = (process.env.REACT_APP_BACKEND_URL || '') + "/api";

// Page icons mapping
const PAGE_ICONS = {
  Home: Home,
  Checkout: ShoppingCart,
  Login: LogIn,
  Search: SearchIcon,
  Profile: Users,
  Album: BarChart3,
  Library: Activity,
  Bible: Globe,
  Subscription: TrendingUp,
};

// Colors for charts
const CHART_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16"
];

export default function NavigationAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedDays, setSelectedDays] = useState("7");
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageDetail, setPageDetail] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPlatform) params.append("platform", selectedPlatform);
      params.append("days", selectedDays);

      const response = await axios.get(`${API}/admin/analytics/navigation?${params}`, { withCredentials: true });
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform, selectedDays]);

  const fetchPageDetail = async (pageName) => {
    try {
      const response = await axios.get(`${API}/admin/analytics/page-detail/${encodeURIComponent(pageName)}?days=${selectedDays}`, { withCredentials: true });
      setPageDetail(response.data);
      setSelectedPage(pageName);
    } catch (error) {
      console.error("Error fetching page detail:", error);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getPageIcon = (pageName) => {
    const Icon = PAGE_ICONS[pageName] || Activity;
    return <Icon size={16} />;
  };

  const maxViews = analytics?.top_pages?.[0]?.views || 1;

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <RefreshCw className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="navigation-analytics-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-violet-400" /> Navigation Analytics
          </h1>
          <p className="text-zinc-400 mt-1">Track how users navigate through your app and website</p>
        </div>
        <div className="flex gap-3 items-center">
          <Select value={selectedDays} onValueChange={setSelectedDays}>
            <SelectTrigger className="w-32 bg-zinc-900 border-zinc-800 text-white">
              <Calendar size={14} className="mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedPlatform || "all"} onValueChange={(v) => setSelectedPlatform(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-white">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800">
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="android">Android</SelectItem>
              <SelectItem value="ios">iOS</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={fetchAnalytics} 
            variant="outline" 
            className="border-zinc-700 text-zinc-300"
            disabled={loading}
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> 
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <MousePointer size={14} /> Page Views
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(analytics?.summary?.total_page_views)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Users size={14} /> Sessions
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(analytics?.summary?.total_sessions)}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Activity size={14} /> Pages/Session
            </div>
            <p className="text-2xl font-bold text-white">{analytics?.summary?.avg_pages_per_session || 0}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <TrendingUp size={14} /> Bounce Rate
            </div>
            <p className="text-2xl font-bold text-amber-400">{analytics?.summary?.bounce_rate || 0}%</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <ShoppingCart size={14} /> Checkout Rate
            </div>
            <p className="text-2xl font-bold text-blue-400">{analytics?.summary?.checkout_rate || 0}%</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <TrendingUp size={14} /> Conversion
            </div>
            <p className="text-2xl font-bold text-emerald-400">{analytics?.summary?.conversion_rate || 0}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Pages */}
        <Card className="bg-zinc-900/50 border-zinc-800 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart3 size={18} className="text-violet-400" /> Top Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics?.top_pages?.slice(0, 10).map((page, idx) => (
                <div 
                  key={page.page} 
                  className="group cursor-pointer hover:bg-zinc-800/50 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => fetchPageDetail(page.page)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                        {idx + 1}
                      </span>
                      <span className="text-white font-medium flex items-center gap-2">
                        {getPageIcon(page.page)}
                        {page.page}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-zinc-400">{formatNumber(page.views)} views</span>
                      <span className="text-zinc-500">{page.unique_visitors} visitors</span>
                      <span className="text-zinc-500">{formatDuration(page.avg_time_on_page)}</span>
                      <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                  </div>
                  <Progress 
                    value={(page.views / maxViews) * 100} 
                    className="h-1.5 bg-zinc-800"
                  />
                </div>
              ))}
              
              {(!analytics?.top_pages || analytics.top_pages.length === 0) && (
                <div className="text-center py-8 text-zinc-500">
                  <Activity size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No page view data yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Globe size={18} className="text-blue-400" /> Platforms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics?.platforms?.map((p, idx) => {
                const total = analytics.platforms.reduce((sum, x) => sum + x.views, 0);
                const percent = total > 0 ? Math.round((p.views / total) * 100) : 0;
                const Icon = p.platform === "web" ? Monitor : Smartphone;
                
                return (
                  <div key={p.platform} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-300 flex items-center gap-2">
                        <Icon size={16} className="text-zinc-500" />
                        {p.platform?.charAt(0).toUpperCase() + p.platform?.slice(1)}
                      </span>
                      <span className="text-white font-medium">{percent}%</span>
                    </div>
                    <Progress 
                      value={percent} 
                      className="h-2 bg-zinc-800"
                      style={{ '--progress-color': CHART_COLORS[idx] }}
                    />
                    <p className="text-xs text-zinc-500">{formatNumber(p.views)} views</p>
                  </div>
                );
              })}
              
              {(!analytics?.platforms || analytics.platforms.length === 0) && (
                <div className="text-center py-8 text-zinc-500">
                  <Globe size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No platform data</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entry Pages (Landing Pages) */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <LogIn size={18} className="text-emerald-400" /> Entry Pages (Landing)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics?.entry_pages?.map((page, idx) => (
                <div key={page.page} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-300 flex items-center gap-2">
                    {getPageIcon(page.page)}
                    {page.page}
                  </span>
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                    {formatNumber(page.count)} sessions
                  </Badge>
                </div>
              ))}
              {(!analytics?.entry_pages || analytics.entry_pages.length === 0) && (
                <p className="text-zinc-500 text-center py-4">No entry page data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Exit Pages */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Activity size={18} className="text-red-400" /> Exit Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics?.exit_pages?.map((page, idx) => (
                <div key={page.page} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className="text-zinc-300 flex items-center gap-2">
                    {getPageIcon(page.page)}
                    {page.page || "Unknown"}
                  </span>
                  <Badge variant="outline" className="text-red-400 border-red-500/30">
                    {formatNumber(page.count)} exits
                  </Badge>
                </div>
              ))}
              {(!analytics?.exit_pages || analytics.exit_pages.length === 0) && (
                <p className="text-zinc-500 text-center py-4">No exit page data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Common User Flows */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <ArrowRight size={18} className="text-amber-400" /> Common User Journeys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics?.common_flows?.map((flow, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  {flow.flow.split(" → ").map((page, pageIdx, arr) => (
                    <span key={pageIdx} className="flex items-center gap-1">
                      <Badge 
                        variant="outline" 
                        className="text-zinc-300 border-zinc-600"
                        style={{ borderColor: CHART_COLORS[pageIdx % CHART_COLORS.length] }}
                      >
                        {page}
                      </Badge>
                      {pageIdx < arr.length - 1 && (
                        <ArrowRight size={14} className="text-zinc-600" />
                      )}
                    </span>
                  ))}
                </div>
                <span className="text-zinc-400 text-sm whitespace-nowrap ml-4">
                  {formatNumber(flow.count)} users
                </span>
              </div>
            ))}
            {(!analytics?.common_flows || analytics.common_flows.length === 0) && (
              <div className="text-center py-8 text-zinc-500">
                <ArrowRight size={32} className="mx-auto mb-2 opacity-50" />
                <p>No user flow data yet. Start tracking to see patterns.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <TrendingUp size={18} className="text-violet-400" /> Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-center gap-8 py-6">
            {/* Home/All Sessions */}
            <div className="text-center">
              <div 
                className="w-32 bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-lg mx-auto flex items-end justify-center"
                style={{ height: "160px" }}
              >
                <span className="text-white font-bold text-lg pb-4">
                  {formatNumber(analytics?.summary?.total_sessions)}
                </span>
              </div>
              <p className="text-zinc-400 mt-2 text-sm">All Sessions</p>
              <p className="text-zinc-500 text-xs">100%</p>
            </div>
            
            {/* Checkout */}
            <div className="text-center">
              <div 
                className="w-32 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg mx-auto flex items-end justify-center"
                style={{ 
                  height: `${Math.max(40, 160 * (analytics?.summary?.checkout_rate || 0) / 100)}px` 
                }}
              >
                <span className="text-white font-bold text-lg pb-4">
                  {formatNumber(analytics?.funnel?.reached_checkout)}
                </span>
              </div>
              <p className="text-zinc-400 mt-2 text-sm">Reached Checkout</p>
              <p className="text-zinc-500 text-xs">{analytics?.summary?.checkout_rate || 0}%</p>
            </div>
            
            {/* Purchase */}
            <div className="text-center">
              <div 
                className="w-32 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg mx-auto flex items-end justify-center"
                style={{ 
                  height: `${Math.max(40, 160 * (analytics?.summary?.conversion_rate || 0) / 100)}px` 
                }}
              >
                <span className="text-white font-bold text-lg pb-4">
                  {formatNumber(analytics?.funnel?.completed_purchase)}
                </span>
              </div>
              <p className="text-zinc-400 mt-2 text-sm">Completed Purchase</p>
              <p className="text-zinc-500 text-xs">{analytics?.summary?.conversion_rate || 0}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Page Detail Modal/Sidebar */}
      {selectedPage && pageDetail && (
        <div className="fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-zinc-800 shadow-xl z-50 overflow-y-auto">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {getPageIcon(selectedPage)}
              {selectedPage}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPage(null)}>
              ✕
            </Button>
          </div>
          
          <div className="p-4 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-400 text-xs">Views</p>
                <p className="text-xl font-bold text-white">{formatNumber(pageDetail.total_views)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-400 text-xs">Visitors</p>
                <p className="text-xl font-bold text-white">{formatNumber(pageDetail.unique_visitors)}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 col-span-2">
                <p className="text-zinc-400 text-xs">Avg. Time on Page</p>
                <p className="text-xl font-bold text-white">{formatDuration(pageDetail.avg_time_on_page)}</p>
              </div>
            </div>
            
            {/* Where users came from */}
            <div>
              <h4 className="text-sm font-medium text-zinc-400 mb-2">Traffic Sources</h4>
              <div className="space-y-2">
                {pageDetail.referrers?.slice(0, 5).map((ref, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{ref.page}</span>
                    <span className="text-zinc-500">{ref.count}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Where users went next */}
            <div>
              <h4 className="text-sm font-medium text-zinc-400 mb-2">Next Pages</h4>
              <div className="space-y-2">
                {pageDetail.next_pages?.slice(0, 5).map((next, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300 flex items-center gap-1">
                      <ArrowRight size={12} className="text-zinc-600" />
                      {next.page}
                    </span>
                    <span className="text-zinc-500">{next.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
