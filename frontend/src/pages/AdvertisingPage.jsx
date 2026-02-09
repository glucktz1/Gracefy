import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdvertisingPage() {
  // Settings state
  const [settings, setSettings] = useState({
    enabled: false,
    free_users_only: true,
    ads_interval_songs: 3,
    ads_interval_minutes: 15,
    max_ad_duration_seconds: 60,
    skip_after_seconds: 5,
    show_ad_label: true
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Ads state
  const [ads, setAds] = useState([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create/Edit dialog
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [adForm, setAdForm] = useState({
    title: "",
    description: "",
    advertiser_name: "",
    audio_url: "",
    duration_seconds: 30,
    target_audience: "all",
    click_url: "",
    priority: 1,
    start_date: "",
    end_date: "",
    budget: 0,
    cost_per_impression: 0
  });
  const [submitting, setSubmitting] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [adAnalytics, setAdAnalytics] = useState([]);
  const [platformAnalytics, setPlatformAnalytics] = useState([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30);

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/advertising/settings`, { withCredentials: true });
      setSettings(response.data);
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const formData = new FormData();
      Object.entries(settings).forEach(([key, value]) => {
        formData.append(key, value.toString());
      });
      
      await axios.put(`${API}/advertising/settings`, formData, { withCredentials: true });
      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // Fetch ads
  const fetchAds = async () => {
    setAdsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        status: statusFilter
      });
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await axios.get(`${API}/advertising/ads?${params}`, { withCredentials: true });
      setAds(response.data.ads);
      setTotalPages(response.data.pages);
    } catch (error) {
      console.error("Error fetching ads:", error);
    } finally {
      setAdsLoading(false);
    }
  };

  // Create/Update ad
  const submitAd = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(adForm).forEach(([key, value]) => {
        if (value !== "" && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      if (editingAd) {
        await axios.put(`${API}/advertising/ads/${editingAd.ad_id}`, formData, { withCredentials: true });
        toast.success("Advertisement updated successfully");
      } else {
        await axios.post(`${API}/advertising/ads`, formData, { withCredentials: true });
        toast.success("Advertisement created successfully");
      }
      
      setShowAdDialog(false);
      resetAdForm();
      fetchAds();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save advertisement");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete ad
  const deleteAd = async (adId) => {
    if (!window.confirm("Are you sure you want to delete this advertisement?")) return;
    
    try {
      await axios.delete(`${API}/advertising/ads/${adId}`, { withCredentials: true });
      toast.success("Advertisement deleted");
      fetchAds();
    } catch (error) {
      toast.error("Failed to delete advertisement");
    }
  };

  // Toggle ad status
  const toggleAdStatus = async (adId) => {
    try {
      const response = await axios.post(`${API}/advertising/ads/${adId}/toggle`, {}, { withCredentials: true });
      toast.success(response.data.message);
      fetchAds();
    } catch (error) {
      toast.error("Failed to toggle status");
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const [overviewRes, trendsRes, byAdRes, byPlatformRes] = await Promise.all([
        axios.get(`${API}/advertising/analytics/overview?days=${analyticsPeriod}`, { withCredentials: true }),
        axios.get(`${API}/advertising/analytics/trends?days=${analyticsPeriod}`, { withCredentials: true }),
        axios.get(`${API}/advertising/analytics/by-ad?days=${analyticsPeriod}`, { withCredentials: true }),
        axios.get(`${API}/advertising/analytics/by-platform?days=${analyticsPeriod}`, { withCredentials: true })
      ]);
      
      setAnalytics(overviewRes.data);
      setTrends(trendsRes.data.trends);
      setAdAnalytics(byAdRes.data.ads);
      setPlatformAnalytics(byPlatformRes.data.platforms);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  // Reset form
  const resetAdForm = () => {
    setAdForm({
      title: "",
      description: "",
      advertiser_name: "",
      audio_url: "",
      duration_seconds: 30,
      target_audience: "all",
      click_url: "",
      priority: 1,
      start_date: "",
      end_date: "",
      budget: 0,
      cost_per_impression: 0
    });
    setEditingAd(null);
  };

  // Open edit dialog
  const openEditDialog = (ad) => {
    setEditingAd(ad);
    setAdForm({
      title: ad.title,
      description: ad.description || "",
      advertiser_name: ad.advertiser_name,
      audio_url: ad.audio_url,
      duration_seconds: ad.duration_seconds,
      target_audience: ad.target_audience || "all",
      click_url: ad.click_url || "",
      priority: ad.priority || 1,
      start_date: ad.start_date ? ad.start_date.split("T")[0] : "",
      end_date: ad.end_date ? ad.end_date.split("T")[0] : "",
      budget: ad.budget || 0,
      cost_per_impression: ad.cost_per_impression || 0
    });
    setShowAdDialog(true);
  };

  useEffect(() => {
    fetchSettings();
    fetchAds();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchAds();
  }, [currentPage, statusFilter, searchQuery]);

  useEffect(() => {
    fetchAnalytics();
  }, [analyticsPeriod]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Advertising</h1>
          <p className="text-zinc-400">Manage audio advertisements for free users</p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="bg-zinc-800 border-zinc-700">
          <TabsTrigger value="settings" data-testid="settings-tab">Settings</TabsTrigger>
          <TabsTrigger value="ads" data-testid="ads-tab">Advertisements</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="analytics-tab">Analytics</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-3">
                Global Advertising Settings
                <Badge variant={settings.enabled ? "default" : "secondary"} className={settings.enabled ? "bg-green-600" : ""}>
                  {settings.enabled ? "ENABLED" : "DISABLED"}
                </Badge>
              </CardTitle>
              <CardDescription>Configure how and when ads are shown to users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <>
                  {/* Master Switch */}
                  <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                    <div>
                      <Label className="text-white text-lg">Enable Advertising</Label>
                      <p className="text-zinc-400 text-sm">Turn on/off ads for all users</p>
                    </div>
                    <Switch
                      checked={settings.enabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                      data-testid="enable-ads-switch"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Free Users Only */}
                    <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                      <div>
                        <Label className="text-white">Free Users Only</Label>
                        <p className="text-zinc-400 text-sm">Premium users skip ads</p>
                      </div>
                      <Switch
                        checked={settings.free_users_only}
                        onCheckedChange={(checked) => setSettings({ ...settings, free_users_only: checked })}
                      />
                    </div>

                    {/* Show Ad Label */}
                    <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                      <div>
                        <Label className="text-white">Show Ad Label</Label>
                        <p className="text-zinc-400 text-sm">Display "Advertisement" label</p>
                      </div>
                      <Switch
                        checked={settings.show_ad_label}
                        onCheckedChange={(checked) => setSettings({ ...settings, show_ad_label: checked })}
                      />
                    </div>

                    {/* Songs Interval */}
                    <div className="space-y-2">
                      <Label className="text-white">Play Ad After Every N Songs</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={settings.ads_interval_songs}
                        onChange={(e) => setSettings({ ...settings, ads_interval_songs: parseInt(e.target.value) || 3 })}
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                      <p className="text-zinc-500 text-xs">Ad plays after user listens to this many songs</p>
                    </div>

                    {/* Time Interval */}
                    <div className="space-y-2">
                      <Label className="text-white">Or After N Minutes</Label>
                      <Input
                        type="number"
                        min="5"
                        max="60"
                        value={settings.ads_interval_minutes}
                        onChange={(e) => setSettings({ ...settings, ads_interval_minutes: parseInt(e.target.value) || 15 })}
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                      <p className="text-zinc-500 text-xs">Alternative trigger based on listening time</p>
                    </div>

                    {/* Skip After Seconds */}
                    <div className="space-y-2">
                      <Label className="text-white">Allow Skip After (seconds)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={settings.skip_after_seconds}
                        onChange={(e) => setSettings({ ...settings, skip_after_seconds: parseInt(e.target.value) || 0 })}
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                      <p className="text-zinc-500 text-xs">0 = No skip allowed</p>
                    </div>

                    {/* Max Ad Duration */}
                    <div className="space-y-2">
                      <Label className="text-white">Max Ad Duration (seconds)</Label>
                      <Input
                        type="number"
                        min="15"
                        max="120"
                        value={settings.max_ad_duration_seconds}
                        onChange={(e) => setSettings({ ...settings, max_ad_duration_seconds: parseInt(e.target.value) || 60 })}
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={saveSettings}
                    disabled={savingSettings}
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    data-testid="save-settings-btn"
                  >
                    {savingSettings ? "Saving..." : "Save Settings"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ads Tab */}
        <TabsContent value="ads">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white">Manage Advertisements</CardTitle>
                  <CardDescription>Create and manage audio ads</CardDescription>
                </div>
                <Dialog open={showAdDialog} onOpenChange={setShowAdDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-violet-600 hover:bg-violet-700"
                      onClick={() => { resetAdForm(); setShowAdDialog(true); }}
                      data-testid="create-ad-btn"
                    >
                      + Create Advertisement
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-white">
                        {editingAd ? "Edit Advertisement" : "Create Advertisement"}
                      </DialogTitle>
                      <DialogDescription>
                        Audio advertisements for free tier users
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">Title *</Label>
                          <Input
                            value={adForm.title}
                            onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                            placeholder="Ad title"
                            className="bg-zinc-800 border-zinc-700 text-white"
                            data-testid="ad-title-input"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Advertiser Name *</Label>
                          <Input
                            value={adForm.advertiser_name}
                            onChange={(e) => setAdForm({ ...adForm, advertiser_name: e.target.value })}
                            placeholder="Company name"
                            className="bg-zinc-800 border-zinc-700 text-white"
                            data-testid="ad-advertiser-input"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-white">Description</Label>
                        <Textarea
                          value={adForm.description}
                          onChange={(e) => setAdForm({ ...adForm, description: e.target.value })}
                          placeholder="Brief description of the ad"
                          className="bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white">Audio URL *</Label>
                        <Input
                          value={adForm.audio_url}
                          onChange={(e) => setAdForm({ ...adForm, audio_url: e.target.value })}
                          placeholder="https://cdn.example.com/ad-audio.mp3"
                          className="bg-zinc-800 border-zinc-700 text-white"
                          data-testid="ad-audio-url-input"
                        />
                        <p className="text-zinc-500 text-xs">Direct URL to the audio file (MP3, WAV)</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">Duration (seconds)</Label>
                          <Input
                            type="number"
                            value={adForm.duration_seconds}
                            onChange={(e) => setAdForm({ ...adForm, duration_seconds: parseInt(e.target.value) || 30 })}
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Priority (1-10)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={adForm.priority}
                            onChange={(e) => setAdForm({ ...adForm, priority: parseInt(e.target.value) || 1 })}
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">Target Audience</Label>
                          <Select
                            value={adForm.target_audience}
                            onValueChange={(value) => setAdForm({ ...adForm, target_audience: value })}
                          >
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                              <SelectItem value="all">All Users</SelectItem>
                              <SelectItem value="youth">Youth</SelectItem>
                              <SelectItem value="adults">Adults</SelectItem>
                              <SelectItem value="families">Families</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Click URL (optional)</Label>
                          <Input
                            value={adForm.click_url}
                            onChange={(e) => setAdForm({ ...adForm, click_url: e.target.value })}
                            placeholder="https://advertiser.com"
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">Start Date</Label>
                          <Input
                            type="date"
                            value={adForm.start_date}
                            onChange={(e) => setAdForm({ ...adForm, start_date: e.target.value })}
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">End Date</Label>
                          <Input
                            type="date"
                            value={adForm.end_date}
                            onChange={(e) => setAdForm({ ...adForm, end_date: e.target.value })}
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">Budget (TZS)</Label>
                          <Input
                            type="number"
                            value={adForm.budget}
                            onChange={(e) => setAdForm({ ...adForm, budget: parseFloat(e.target.value) || 0 })}
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Cost Per Impression (TZS)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={adForm.cost_per_impression}
                            onChange={(e) => setAdForm({ ...adForm, cost_per_impression: parseFloat(e.target.value) || 0 })}
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAdDialog(false)}>Cancel</Button>
                      <Button
                        onClick={submitAd}
                        disabled={submitting || !adForm.title || !adForm.advertiser_name || !adForm.audio_url}
                        className="bg-violet-600 hover:bg-violet-700"
                        data-testid="submit-ad-btn"
                      >
                        {submitting ? "Saving..." : (editingAd ? "Update" : "Create")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <Input
                  placeholder="Search ads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs bg-zinc-800 border-zinc-700 text-white"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ads Table */}
              {adsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
              ) : ads.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <p className="text-lg">No advertisements found</p>
                  <p className="text-sm">Create your first ad to start showing ads to free users</p>
                </div>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableHead className="text-zinc-400">Title</TableHead>
                        <TableHead className="text-zinc-400">Advertiser</TableHead>
                        <TableHead className="text-zinc-400">Duration</TableHead>
                        <TableHead className="text-zinc-400">Impressions</TableHead>
                        <TableHead className="text-zinc-400">Completions</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ads.map((ad) => (
                        <TableRow key={ad.ad_id} className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell className="font-medium text-white">{ad.title}</TableCell>
                          <TableCell className="text-zinc-300">{ad.advertiser_name}</TableCell>
                          <TableCell className="text-zinc-300">{ad.duration_seconds}s</TableCell>
                          <TableCell className="text-zinc-300">{ad.total_impressions?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-zinc-300">{ad.total_completions?.toLocaleString() || 0}</TableCell>
                          <TableCell>
                            <Badge variant={ad.is_active ? "default" : "secondary"} className={ad.is_active ? "bg-green-600" : ""}>
                              {ad.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEditDialog(ad)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => toggleAdStatus(ad.ad_id)}>
                                {ad.is_active ? "Pause" : "Activate"}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteAd(ad.ad_id)}>
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-zinc-400 py-2 px-3">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex justify-end">
              <Select value={analyticsPeriod.toString()} onValueChange={(v) => setAnalyticsPeriod(parseInt(v))}>
                <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Overview Cards */}
            {analytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6">
                    <p className="text-zinc-400 text-sm">Total Impressions</p>
                    <p className="text-3xl font-bold text-white">{analytics.total_impressions?.toLocaleString() || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6">
                    <p className="text-zinc-400 text-sm">Completions</p>
                    <p className="text-3xl font-bold text-green-500">{analytics.total_completions?.toLocaleString() || 0}</p>
                    <p className="text-zinc-500 text-xs">{analytics.completion_rate || 0}% rate</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6">
                    <p className="text-zinc-400 text-sm">Clicks</p>
                    <p className="text-3xl font-bold text-blue-500">{analytics.total_clicks?.toLocaleString() || 0}</p>
                    <p className="text-zinc-500 text-xs">{analytics.click_rate || 0}% CTR</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6">
                    <p className="text-zinc-400 text-sm">Est. Revenue</p>
                    <p className="text-3xl font-bold text-amber-500">TZS {analytics.estimated_revenue?.toLocaleString() || 0}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Performance by Ad */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Performance by Advertisement</CardTitle>
              </CardHeader>
              <CardContent>
                {adAnalytics.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">No data available</p>
                ) : (
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800">
                          <TableHead className="text-zinc-400">Ad</TableHead>
                          <TableHead className="text-zinc-400">Advertiser</TableHead>
                          <TableHead className="text-zinc-400">Impressions</TableHead>
                          <TableHead className="text-zinc-400">Completions</TableHead>
                          <TableHead className="text-zinc-400">Completion Rate</TableHead>
                          <TableHead className="text-zinc-400">Clicks</TableHead>
                          <TableHead className="text-zinc-400">CTR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adAnalytics.map((item) => (
                          <TableRow key={item.ad_id} className="border-zinc-800">
                            <TableCell className="font-medium text-white">{item.title}</TableCell>
                            <TableCell className="text-zinc-300">{item.advertiser}</TableCell>
                            <TableCell className="text-zinc-300">{item.impressions?.toLocaleString()}</TableCell>
                            <TableCell className="text-green-500">{item.completions?.toLocaleString()}</TableCell>
                            <TableCell className="text-zinc-300">{item.completion_rate}%</TableCell>
                            <TableCell className="text-blue-500">{item.clicks?.toLocaleString()}</TableCell>
                            <TableCell className="text-zinc-300">{item.click_rate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance by Platform */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Performance by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                {platformAnalytics.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">No data available</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {platformAnalytics.map((platform) => (
                      <Card key={platform.platform} className="bg-zinc-800 border-zinc-700">
                        <CardContent className="p-4">
                          <p className="text-zinc-400 text-sm capitalize">{platform.platform}</p>
                          <p className="text-2xl font-bold text-white">{platform.impressions?.toLocaleString()}</p>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className="text-green-500">{platform.completions} completed</span>
                            <span className="text-blue-500">{platform.clicks} clicks</span>
                          </div>
                          <p className="text-zinc-500 text-xs mt-1">{platform.completion_rate}% completion rate</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
