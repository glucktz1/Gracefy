import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { MapPin, Users, Globe, TrendingUp, BarChart3, RefreshCw, Filter, Clock, Zap } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

const COUNTRIES = [
  { value: 'Tanzania', label: 'Tanzania' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Uganda', label: 'Uganda' },
  { value: 'Rwanda', label: 'Rwanda' },
  { value: 'Burundi', label: 'Burundi' },
  { value: 'DRC', label: 'DRC' }
];

const PERIODS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' }
];

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

export default function LocationAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState('Tanzania');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [countriesChart, setCountriesChart] = useState(null);
  const [citiesChart, setCitiesChart] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshIntervalRef = useRef(null);

  const fetchOverview = useCallback(async (forceRefresh = false) => {
    try {
      const res = await axios.get(`${API}/analytics/location/overview`, {
        params: { refresh: forceRefresh }
      });
      setOverview(res.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching overview:', error);
    }
  }, []);

  const fetchCountriesChart = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/analytics/location/countries-chart`, {
        params: { period: selectedPeriod, limit: 10 }
      });
      setCountriesChart(res.data);
    } catch (error) {
      console.error('Error fetching countries chart:', error);
    }
  }, [selectedPeriod]);

  const fetchCitiesChart = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/analytics/location/cities-chart/${selectedCountry}`, {
        params: { period: selectedPeriod, limit: 15 }
      });
      setCitiesChart(res.data);
    } catch (error) {
      console.error('Error fetching cities chart:', error);
    }
  }, [selectedCountry, selectedPeriod]);

  const fetchGrowthData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/analytics/location/growth/${selectedCountry}`, {
        params: { period: selectedPeriod }
      });
      setGrowthData(res.data);
    } catch (error) {
      console.error('Error fetching growth data:', error);
    }
  }, [selectedCountry, selectedPeriod]);

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    await Promise.all([
      fetchOverview(forceRefresh),
      fetchCountriesChart(),
      fetchCitiesChart(),
      fetchGrowthData()
    ]);
    setLoading(false);
  }, [fetchOverview, fetchCountriesChart, fetchCitiesChart, fetchGrowthData]);

  // Initial fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchOverview(true);
        fetchCountriesChart();
        fetchCitiesChart();
      }, AUTO_REFRESH_INTERVAL);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, fetchOverview, fetchCountriesChart, fetchCitiesChart]);

  useEffect(() => {
    fetchCountriesChart();
  }, [selectedPeriod]);

  useEffect(() => {
    fetchCitiesChart();
    fetchGrowthData();
  }, [selectedCountry, selectedPeriod]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-zinc-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-purple-500" />
            Location Analytics
          </h1>
          <p className="text-zinc-400 mt-1">User distribution by country and city</p>
          {lastUpdated && (
            <p className="text-zinc-500 text-xs mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${autoRefresh ? 'text-green-500' : 'text-zinc-500'}`} />
            <span className="text-zinc-400 text-sm">Auto-refresh</span>
            <Switch 
              checked={autoRefresh} 
              onCheckedChange={setAutoRefresh}
              className="data-[state=checked]:bg-green-500"
            />
          </div>
          <Button onClick={() => fetchAllData(true)} variant="outline" className="border-zinc-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{overview?.total_users?.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-500/20 rounded-lg">
                <MapPin className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">With Location</p>
                <p className="text-2xl font-bold text-white">{overview?.users_with_location?.toLocaleString() || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Coverage</p>
                <p className="text-2xl font-bold text-white">{overview?.location_coverage || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-lg">
                <Globe className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Countries</p>
                <p className="text-2xl font-bold text-white">{overview?.countries?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <span className="text-zinc-400 text-sm">Filters:</span>
            </div>
            <div className="flex gap-4">
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {PERIODS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Countries Bar Chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-purple-500" />
            Users by Country
          </CardTitle>
          <CardDescription>Distribution of users across countries</CardDescription>
        </CardHeader>
        <CardContent>
          {countriesChart?.chart_data?.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={countriesChart.chart_data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis type="category" dataKey="country" stroke="#9ca3af" width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="total_users" name="Total Users" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="new_users" name="New Users" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-zinc-500">
              No location data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cities Bar Chart for Selected Country */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-500" />
            Users in {selectedCountry} by City/Region
          </CardTitle>
          <CardDescription>
            {citiesChart?.totals?.total_users?.toLocaleString() || 0} total users in {selectedCountry}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {citiesChart?.chart_data?.length > 0 ? (
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={citiesChart.chart_data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" />
                <YAxis type="category" dataKey="city" stroke="#9ca3af" width={120} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="total_users" name="Total Users" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="new_users" name="New Users" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="active_users" name="Active Users" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[500px] flex items-center justify-center text-zinc-500">
              No city data available for {selectedCountry}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Growth Trend Chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            User Growth in {selectedCountry}
          </CardTitle>
          <CardDescription>Daily new users and cumulative growth</CardDescription>
        </CardHeader>
        <CardContent>
          {growthData?.daily_growth?.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={growthData.daily_growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  content={<CustomTooltip />}
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="cumulative_users" 
                  name="Cumulative Users" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="new_users" 
                  name="New Users" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-zinc-500">
              No growth data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Country Distribution Pie Chart */}
      {overview?.countries?.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Country Distribution</CardTitle>
            <CardDescription>Percentage of users by country</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={overview.countries.slice(0, 8)}
                    dataKey="users"
                    nameKey="country"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ country, percent }) => `${country} ${(percent * 100).toFixed(0)}%`}
                  >
                    {overview.countries.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="space-y-2">
                <h4 className="text-white font-medium mb-4">Top Countries</h4>
                {overview.countries.slice(0, 8).map((c, idx) => (
                  <div key={c.country} className="flex items-center justify-between p-2 bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-white">{c.country}</span>
                    </div>
                    <span className="text-zinc-400">{c.users.toLocaleString()} users</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
