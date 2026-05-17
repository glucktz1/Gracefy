import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Smartphone, AlertTriangle, CheckCircle, Clock, Users, 
  Activity, Bug, Settings, RefreshCw, Download, Trash2,
  Search, Filter, ChevronDown, BarChart3, Shield, Monitor,
  AlertCircle, XCircle, Info, Globe, Cpu, HardDrive
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const AppControlPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [crashReports, setCrashReports] = useState([]);
  const [errorReports, setErrorReports] = useState([]);
  const [errorStats, setErrorStats] = useState({ by_platform: {}, by_severity: {} });
  const [deviceDistribution, setDeviceDistribution] = useState(null);
  const [guestLimits, setGuestLimits] = useState({
    max_plays: 3,
    max_skips: 3,
    max_listen_minutes: 10,
    prompt_attempts_before_lock: 3
  });
  const [appSettings, setAppSettings] = useState({
    maintenance_mode: false,
    force_update_version: '',
    min_app_version: '1.0.0',
    feature_flags: {},
    playstore_url: '',
    appstore_url: '',
    app_download_message: ''
  });
  const [monetization, setMonetization] = useState({
    soft_skip_limit: 5,
    hard_skip_limit: 8,
    preview_duration_seconds: 30,
    prompt_message_sw: 'Maudhui haya ni bure lakini teknolojia hii ina gharama. Changia kidogo kuwezesha iwafikie watu wengi zaidi.',
    prompt_message_en: 'This content is free but the technology has costs. Contribute a little to help reach more people.',
  });
  
  // Filters
  const [errorPlatformFilter, setErrorPlatformFilter] = useState('all');
  const [errorSeverityFilter, setErrorSeverityFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, crashRes, settingsRes, errorRes, deviceRes] = await Promise.all([
        axios.get(`${API}/admin/app-stats`, { withCredentials: true }).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/crash-reports`, { withCredentials: true }).catch(() => ({ data: { reports: [] } })),
        axios.get(`${API}/admin/app-settings`, { withCredentials: true }).catch(() => ({ data: {} })),
        axios.get(`${API}/admin/error-reports`, { withCredentials: true }).catch(() => ({ data: { reports: [], stats: {} } })),
        axios.get(`${API}/analytics/device-distribution`, { withCredentials: true }).catch(() => ({ data: null })),
      ]);
      
      setStats(statsRes.data);
      setCrashReports(crashRes.data?.reports || []);
      setErrorReports(errorRes.data?.reports || []);
      setErrorStats(errorRes.data?.stats || { by_platform: {}, by_severity: {} });
      setDeviceDistribution(deviceRes.data);
      
      if (settingsRes.data?.guest_limits) {
        setGuestLimits(settingsRes.data.guest_limits);
      }
      if (settingsRes.data?.app_settings) {
        setAppSettings(settingsRes.data.app_settings);
      }
      if (settingsRes.data?.monetization) {
        setMonetization(prev => ({ ...prev, ...settingsRes.data.monetization }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveGuestLimits = async () => {
    try {
      await axios.post(`${API}/admin/app-settings/guest-limits`, guestLimits, { withCredentials: true });
      toast.success('Guest limits saved successfully');
    } catch (error) {
      toast.error('Failed to save guest limits');
    }
  };

  const saveAppSettings = async () => {
    try {
      await axios.post(`${API}/admin/app-settings`, appSettings, { withCredentials: true });
      toast.success('App settings saved successfully');
    } catch (error) {
      toast.error('Failed to save app settings');
    }
  };
  
  const saveMonetization = async () => {
    try {
      await axios.post(`${API}/admin/app-settings/monetization`, monetization, { withCredentials: true });
      toast.success('Monetization settings saved');
    } catch (error) {
      toast.error('Failed to save monetization settings');
    }
  };

  const deleteCrashReport = async (reportId) => {
    try {
      await axios.delete(`${API}/admin/crash-reports/${reportId}`, { withCredentials: true });
      setCrashReports(prev => prev.filter(r => r.report_id !== reportId));
      toast.success('Report deleted');
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const resolveErrorReport = async (errorId) => {
    try {
      await axios.put(`${API}/admin/error-reports/${errorId}/resolve`, {}, { withCredentials: true });
      setErrorReports(prev => prev.map(r => 
        r.error_id === errorId ? { ...r, resolved: true } : r
      ));
      toast.success('Error marked as resolved');
    } catch (error) {
      toast.error('Failed to resolve error');
    }
  };

  const deleteErrorReport = async (errorId) => {
    try {
      await axios.delete(`${API}/admin/error-reports/${errorId}`, { withCredentials: true });
      setErrorReports(prev => prev.filter(r => r.error_id !== errorId));
      toast.success('Error report deleted');
    } catch (error) {
      toast.error('Failed to delete error report');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('sw-TZ');
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'critical': return 'bg-red-600';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (severity) => {
    switch(severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'info': return <Info className="h-4 w-4" />;
      default: return <Bug className="h-4 w-4" />;
    }
  };

  const filteredErrors = errorReports.filter(err => {
    if (errorPlatformFilter !== 'all' && err.platform !== errorPlatformFilter) return false;
    if (errorSeverityFilter !== 'all' && err.severity !== errorSeverityFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6" data-testid="app-health-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6 text-blue-500" />
            App Health Monitoring
          </h1>
          <p className="text-slate-500">Monitor app performance, errors, and device distribution</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Users</p>
                <p className="text-2xl font-bold">{stats.total_users || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Active Today</p>
                <p className="text-2xl font-bold">{stats.active_today || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Guest Users</p>
                <p className="text-2xl font-bold">{stats.guest_users || 0}</p>
              </div>
              <Shield className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Crash Reports</p>
                <p className="text-2xl font-bold">{crashReports.length || 0}</p>
              </div>
              <Bug className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Error Reports</p>
                <p className="text-2xl font-bold">{errorReports.length || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="errors">Error Reports</TabsTrigger>
          <TabsTrigger value="crashes">Crash Reports</TabsTrigger>
          <TabsTrigger value="devices">Device Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Error Distribution by Platform */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Errors by Platform
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(errorStats.by_platform || {}).map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{platform}</Badge>
                      </div>
                      <span className="text-lg font-semibold">{count}</span>
                    </div>
                  ))}
                  {Object.keys(errorStats.by_platform || {}).length === 0 && (
                    <p className="text-slate-500 text-center py-4">No error data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Error Distribution by Severity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Errors by Severity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(errorStats.by_severity || {}).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(severity)}>{severity}</Badge>
                      </div>
                      <span className="text-lg font-semibold">{count}</span>
                    </div>
                  ))}
                  {Object.keys(errorStats.by_severity || {}).length === 0 && (
                    <p className="text-slate-500 text-center py-4">No error data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Device Distribution Summary */}
            {deviceDistribution && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    Platform Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-500/10 rounded-lg">
                      <p className="text-3xl font-bold text-green-500">{deviceDistribution.platform_distribution?.android || 0}</p>
                      <p className="text-sm text-slate-400">Android</p>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                      <p className="text-3xl font-bold text-blue-500">{deviceDistribution.platform_distribution?.ios || 0}</p>
                      <p className="text-sm text-slate-400">iOS</p>
                    </div>
                    <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                      <p className="text-3xl font-bold text-purple-500">{deviceDistribution.platform_distribution?.web || 0}</p>
                      <p className="text-sm text-slate-400">Web</p>
                    </div>
                    <div className="text-center p-4 bg-gray-500/10 rounded-lg">
                      <p className="text-3xl font-bold text-gray-500">{deviceDistribution.platform_distribution?.unknown || 0}</p>
                      <p className="text-sm text-slate-400">Unknown</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Error Reports Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Error Reports
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={errorPlatformFilter} onValueChange={setErrorPlatformFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="android">Android</SelectItem>
                      <SelectItem value="ios">iOS</SelectItem>
                      <SelectItem value="web">Web</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={errorSeverityFilter} onValueChange={setErrorSeverityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CardDescription>Automatic error reports captured from user devices</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredErrors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No error reports found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredErrors.map((error) => (
                    <div key={error.error_id} className={`border rounded-lg p-4 ${error.resolved ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getSeverityColor(error.severity)}>
                              {getSeverityIcon(error.severity)}
                              <span className="ml-1">{error.severity}</span>
                            </Badge>
                            <Badge variant="outline" className="capitalize">{error.platform}</Badge>
                            {error.resolved && <Badge className="bg-green-600">Resolved</Badge>}
                          </div>
                          <h4 className="font-semibold text-white">{error.error_type}</h4>
                          <p className="text-sm text-slate-400 mt-1">{error.message}</p>
                          
                          {/* Device Info */}
                          <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {error.device_manufacturer && (
                                <span><strong>Device:</strong> {error.device_manufacturer} {error.device_model}</span>
                              )}
                              {error.os_version && (
                                <span><strong>OS:</strong> {error.os_version}</span>
                              )}
                              {error.app_version && (
                                <span><strong>App:</strong> v{error.app_version}</span>
                              )}
                              {error.screen && (
                                <span><strong>Screen:</strong> {error.screen}</span>
                              )}
                            </div>
                          </div>
                          
                          {error.stack_trace && (
                            <details className="mt-2">
                              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">View Stack Trace</summary>
                              <pre className="mt-2 text-xs bg-slate-900 p-2 rounded overflow-auto max-h-32">{error.stack_trace}</pre>
                            </details>
                          )}
                          
                          <p className="text-xs text-slate-500 mt-2">
                            {formatDate(error.created_at)}
                            {error.user_email && <span className="ml-2">• User: {error.user_email}</span>}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {!error.resolved && (
                            <Button size="sm" variant="outline" onClick={() => resolveErrorReport(error.error_id)}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" onClick={() => deleteErrorReport(error.error_id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crash Reports Tab */}
        <TabsContent value="crashes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Crash Reports
              </CardTitle>
              <CardDescription>App crashes reported from mobile devices</CardDescription>
            </CardHeader>
            <CardContent>
              {crashReports.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No crash reports - App is running smoothly!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {crashReports.map((report) => (
                    <div key={report.report_id} className="border border-slate-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={report.severity === 'critical' ? 'bg-red-600' : 'bg-orange-500'}>
                              {report.severity || 'error'}
                            </Badge>
                            {report.screen && <Badge variant="outline">{report.screen}</Badge>}
                          </div>
                          <h4 className="font-semibold text-white">{report.error_type}</h4>
                          <p className="text-sm text-slate-400 mt-1">{report.message}</p>
                          
                          {report.device_info && (
                            <div className="mt-3 p-2 bg-slate-800/50 rounded text-xs">
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {report.device_info.manufacturer && (
                                  <span><strong>Device:</strong> {report.device_info.manufacturer} {report.device_info.model}</span>
                                )}
                                {report.device_info.osVersion && (
                                  <span><strong>OS:</strong> {report.device_info.osVersion}</span>
                                )}
                                {report.app_version && (
                                  <span><strong>App:</strong> v{report.app_version}</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {report.stack_trace && (
                            <details className="mt-2">
                              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">View Stack Trace</summary>
                              <pre className="mt-2 text-xs bg-slate-900 p-2 rounded overflow-auto max-h-32">{report.stack_trace}</pre>
                            </details>
                          )}
                          
                          <p className="text-xs text-slate-500 mt-2">{formatDate(report.created_at)}</p>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => deleteCrashReport(report.report_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Device Analytics Tab */}
        <TabsContent value="devices" className="space-y-4">
          {deviceDistribution ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Platform Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Platform Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(deviceDistribution.platform_distribution || {}).map(([platform, count]) => (
                      <div key={platform} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            platform === 'android' ? 'bg-green-500' :
                            platform === 'ios' ? 'bg-blue-500' :
                            platform === 'web' ? 'bg-purple-500' : 'bg-gray-500'
                          }`} />
                          <span className="capitalize">{platform}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{count}</span>
                          <span className="text-xs text-slate-500">
                            ({((count / deviceDistribution.total_users) * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Manufacturer Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Device Manufacturers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {Object.entries(deviceDistribution.manufacturer_distribution || {}).map(([manufacturer, count]) => (
                      <div key={manufacturer} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
                        <span className="text-sm">{manufacturer}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Device Models */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    Top Device Models
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {Object.entries(deviceDistribution.top_device_models || {}).map(([model, count]) => (
                      <div key={model} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
                        <span className="text-sm">{model}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Location Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Location Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {Object.entries(deviceDistribution.location_distribution || {}).map(([location, count]) => (
                      <div key={location} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0">
                        <span className="text-sm">{location}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <HardDrive className="h-12 w-12 mx-auto mb-4 text-slate-500" />
                <p className="text-slate-500">Loading device analytics...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Guest User Limits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Guest User Limits
                </CardTitle>
                <CardDescription>Configure limitations for non-registered users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Max Plays Before Prompt</label>
                  <Input
                    type="number"
                    value={guestLimits.max_plays}
                    onChange={(e) => setGuestLimits(prev => ({ ...prev, max_plays: parseInt(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Max Skips</label>
                  <Input
                    type="number"
                    value={guestLimits.max_skips}
                    onChange={(e) => setGuestLimits(prev => ({ ...prev, max_skips: parseInt(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Max Listen Minutes</label>
                  <Input
                    type="number"
                    value={guestLimits.max_listen_minutes}
                    onChange={(e) => setGuestLimits(prev => ({ ...prev, max_listen_minutes: parseInt(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Prompt Attempts Before Lock</label>
                  <Input
                    type="number"
                    value={guestLimits.prompt_attempts_before_lock}
                    onChange={(e) => setGuestLimits(prev => ({ ...prev, prompt_attempts_before_lock: parseInt(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <Button onClick={saveGuestLimits} className="w-full">
                  Save Guest Limits
                </Button>
              </CardContent>
            </Card>

            {/* Monetization Settings */}
            <Card data-testid="admin-monetization-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Monetization (Spotify-style)
                </CardTitle>
                <CardDescription>Skip thresholds and contribution prompt for unpaid logged-in users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400">Soft Skip Limit (first prompt)</label>
                  <Input
                    type="number"
                    data-testid="soft-skip-limit-input"
                    value={monetization.soft_skip_limit}
                    onChange={(e) => setMonetization(prev => ({ ...prev, soft_skip_limit: parseInt(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Hard Skip Limit (preview mode starts)</label>
                  <Input
                    type="number"
                    data-testid="hard-skip-limit-input"
                    value={monetization.hard_skip_limit}
                    onChange={(e) => setMonetization(prev => ({ ...prev, hard_skip_limit: parseInt(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Preview Duration (seconds)</label>
                  <Input
                    type="number"
                    data-testid="preview-duration-input"
                    value={monetization.preview_duration_seconds}
                    onChange={(e) => setMonetization(prev => ({ ...prev, preview_duration_seconds: parseInt(e.target.value) || 0 }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Prompt Message (Swahili)</label>
                  <textarea
                    data-testid="prompt-message-sw"
                    value={monetization.prompt_message_sw}
                    onChange={(e) => setMonetization(prev => ({ ...prev, prompt_message_sw: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Prompt Message (English)</label>
                  <textarea
                    data-testid="prompt-message-en"
                    value={monetization.prompt_message_en}
                    onChange={(e) => setMonetization(prev => ({ ...prev, prompt_message_en: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
                  />
                </div>
                <Button onClick={saveMonetization} className="w-full" data-testid="save-monetization-btn">
                  Save Monetization Settings
                </Button>
              </CardContent>
            </Card>

            {/* App Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  App Settings
                </CardTitle>
                <CardDescription>Global app configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Maintenance Mode</p>
                    <p className="text-xs text-slate-500">Disable app access temporarily</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={appSettings.maintenance_mode}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, maintenance_mode: e.target.checked }))}
                    className="w-5 h-5"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Minimum App Version</label>
                  <Input
                    value={appSettings.min_app_version}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, min_app_version: e.target.value }))}
                    placeholder="1.0.0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Force Update Version (optional)</label>
                  <Input
                    value={appSettings.force_update_version}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, force_update_version: e.target.value }))}
                    placeholder="Leave empty to disable"
                    className="mt-1"
                  />
                </div>
                
                {/* Store Links */}
                <div className="pt-4 border-t border-slate-700">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Download size={16} /> App Store Links
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-slate-400">Google Play Store URL</label>
                      <Input
                        value={appSettings.playstore_url}
                        onChange={(e) => setAppSettings(prev => ({ ...prev, playstore_url: e.target.value }))}
                        placeholder="https://play.google.com/store/apps/details?id=..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Apple App Store URL</label>
                      <Input
                        value={appSettings.appstore_url}
                        onChange={(e) => setAppSettings(prev => ({ ...prev, appstore_url: e.target.value }))}
                        placeholder="https://apps.apple.com/app/..."
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">App Download Message (shown to web users)</label>
                      <Input
                        value={appSettings.app_download_message}
                        onChange={(e) => setAppSettings(prev => ({ ...prev, app_download_message: e.target.value }))}
                        placeholder="Download our app for a better experience!"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
                
                <Button onClick={saveAppSettings} className="w-full">
                  Save App Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AppControlPage;
