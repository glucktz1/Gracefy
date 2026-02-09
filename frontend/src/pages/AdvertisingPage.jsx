import { useState, useEffect, useRef } from "react";
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
import { Megaphone, Send, Mail, MessageSquare, Bell, Users, Upload, Play, Pause, Trash2, Edit, Eye } from "lucide-react";

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

  // Create/Edit ad dialog
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
  const [audioFile, setAudioFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const audioInputRef = useRef(null);

  // Campaigns state
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignTypeFilter, setCampaignTypeFilter] = useState("all");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState("all");
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignTotalPages, setCampaignTotalPages] = useState(1);

  // Create/Edit campaign dialog
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    type: "push",
    message_title: "",
    message_body: "",
    target_filter_type: "all",
    target_filter_content_ids: "",
    scheduled_at: ""
  });
  const [targetPreviewCount, setTargetPreviewCount] = useState(null);
  const [submittingCampaign, setSubmittingCampaign] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState(null);
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
      
      // Add audio file if selected
      if (audioFile) {
        formData.append("audio_file", audioFile);
      }
      
      if (editingAd) {
        await axios.put(`${API}/advertising/ads/${editingAd.ad_id}`, formData, { 
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success("Advertisement updated successfully");
      } else {
        await axios.post(`${API}/advertising/ads`, formData, { 
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
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

  // Fetch campaigns
  const fetchCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const params = new URLSearchParams({
        page: campaignPage,
        limit: 10
      });
      if (campaignSearch) params.append("search", campaignSearch);
      if (campaignTypeFilter !== "all") params.append("type", campaignTypeFilter);
      if (campaignStatusFilter !== "all") params.append("status", campaignStatusFilter);
      
      const response = await axios.get(`${API}/advertising/campaigns?${params}`, { withCredentials: true });
      setCampaigns(response.data.campaigns);
      setCampaignTotalPages(response.data.pages);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setCampaignsLoading(false);
    }
  };

  // Preview target count
  const previewTargetCount = async () => {
    try {
      const params = new URLSearchParams({
        target_filter_type: campaignForm.target_filter_type,
        campaign_type: campaignForm.type
      });
      
      const response = await axios.get(`${API}/advertising/campaigns/preview-count?${params}`, { withCredentials: true });
      setTargetPreviewCount(response.data.target_count);
    } catch (error) {
      console.error("Error previewing count:", error);
    }
  };

  // Create/Update campaign
  const submitCampaign = async () => {
    setSubmittingCampaign(true);
    try {
      const formData = new FormData();
      Object.entries(campaignForm).forEach(([key, value]) => {
        if (value !== "" && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      if (editingCampaign) {
        await axios.put(`${API}/advertising/campaigns/${editingCampaign.campaign_id}`, formData, { withCredentials: true });
        toast.success("Campaign updated successfully");
      } else {
        const response = await axios.post(`${API}/advertising/campaigns`, formData, { withCredentials: true });
        toast.success(`Campaign created! Target: ${response.data.target_count} users`);
      }
      
      setShowCampaignDialog(false);
      resetCampaignForm();
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save campaign");
    } finally {
      setSubmittingCampaign(false);
    }
  };

  // Send campaign
  const sendCampaign = async (campaignId) => {
    if (!window.confirm("Send this campaign now? This action cannot be undone.")) return;
    
    try {
      const response = await axios.post(`${API}/advertising/campaigns/${campaignId}/send`, {}, { withCredentials: true });
      toast.success(response.data.message);
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send campaign");
    }
  };

  // Cancel campaign
  const cancelCampaign = async (campaignId) => {
    if (!window.confirm("Cancel this campaign?")) return;
    
    try {
      await axios.post(`${API}/advertising/campaigns/${campaignId}/cancel`, {}, { withCredentials: true });
      toast.success("Campaign cancelled");
      fetchCampaigns();
    } catch (error) {
      toast.error("Failed to cancel campaign");
    }
  };

  // Delete campaign
  const deleteCampaign = async (campaignId) => {
    if (!window.confirm("Delete this campaign?")) return;
    
    try {
      await axios.delete(`${API}/advertising/campaigns/${campaignId}`, { withCredentials: true });
      toast.success("Campaign deleted");
      fetchCampaigns();
    } catch (error) {
      toast.error("Failed to delete campaign");
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const [overviewRes, byAdRes, byPlatformRes] = await Promise.all([
        axios.get(`${API}/advertising/analytics/overview?days=${analyticsPeriod}`, { withCredentials: true }),
        axios.get(`${API}/advertising/analytics/by-ad?days=${analyticsPeriod}`, { withCredentials: true }),
        axios.get(`${API}/advertising/analytics/by-platform?days=${analyticsPeriod}`, { withCredentials: true })
      ]);
      
      setAnalytics(overviewRes.data);
      setAdAnalytics(byAdRes.data.ads);
      setPlatformAnalytics(byPlatformRes.data.platforms);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  // Reset forms
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
    setAudioFile(null);
    setEditingAd(null);
  };

  const resetCampaignForm = () => {
    setCampaignForm({
      name: "",
      description: "",
      type: "push",
      message_title: "",
      message_body: "",
      target_filter_type: "all",
      target_filter_content_ids: "",
      scheduled_at: ""
    });
    setTargetPreviewCount(null);
    setEditingCampaign(null);
  };

  // Open edit dialogs
  const openEditAdDialog = (ad) => {
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

  const openEditCampaignDialog = (campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      description: campaign.description || "",
      type: campaign.type,
      message_title: campaign.message_title || "",
      message_body: campaign.message_body,
      target_filter_type: campaign.target_filter?.type || "all",
      target_filter_content_ids: campaign.target_filter?.content_ids?.join(",") || "",
      scheduled_at: campaign.scheduled_at ? campaign.scheduled_at.split("T")[0] + "T" + campaign.scheduled_at.split("T")[1]?.slice(0,5) : ""
    });
    setShowCampaignDialog(true);
  };

  useEffect(() => {
    fetchSettings();
    fetchAds();
    fetchCampaigns();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchAds();
  }, [currentPage, statusFilter, searchQuery]);

  useEffect(() => {
    fetchCampaigns();
  }, [campaignPage, campaignTypeFilter, campaignStatusFilter, campaignSearch]);

  useEffect(() => {
    fetchAnalytics();
  }, [analyticsPeriod]);

  useEffect(() => {
    if (campaignForm.target_filter_type && campaignForm.type) {
      previewTargetCount();
    }
  }, [campaignForm.target_filter_type, campaignForm.type]);

  const getCampaignTypeIcon = (type) => {
    switch(type) {
      case "push": return <Bell className="w-4 h-4" />;
      case "sms": return <MessageSquare className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      default: return <Send className="w-4 h-4" />;
    }
  };

  const getCampaignStatusColor = (status) => {
    switch(status) {
      case "sent": return "bg-green-600";
      case "scheduled": return "bg-blue-600";
      case "cancelled": return "bg-red-600";
      default: return "bg-zinc-600";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-violet-500" />
            Advertising & Campaigns
          </h1>
          <p className="text-zinc-400">Manage audio ads and marketing campaigns</p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="bg-zinc-800 border-zinc-700">
          <TabsTrigger value="settings" data-testid="settings-tab">Settings</TabsTrigger>
          <TabsTrigger value="ads" data-testid="ads-tab">Advertisements</TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="campaigns-tab">Campaigns</TabsTrigger>
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
                    </div>

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
                    </div>

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
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Advertiser Name *</Label>
                          <Input
                            value={adForm.advertiser_name}
                            onChange={(e) => setAdForm({ ...adForm, advertiser_name: e.target.value })}
                            placeholder="Company name"
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-white">Description</Label>
                        <Textarea
                          value={adForm.description}
                          onChange={(e) => setAdForm({ ...adForm, description: e.target.value })}
                          placeholder="Brief description"
                          className="bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>

                      {/* Audio Upload Section */}
                      <div className="space-y-2">
                        <Label className="text-white">Audio *</Label>
                        <div className="flex gap-2">
                          <Input
                            value={adForm.audio_url}
                            onChange={(e) => setAdForm({ ...adForm, audio_url: e.target.value })}
                            placeholder="Audio URL (or upload file)"
                            className="bg-zinc-800 border-zinc-700 text-white flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => audioInputRef.current?.click()}
                            className="shrink-0"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </Button>
                          <input
                            ref={audioInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setAudioFile(file);
                                setAdForm({ ...adForm, audio_url: "" });
                              }
                            }}
                          />
                        </div>
                        {audioFile && (
                          <p className="text-sm text-green-500">Selected: {audioFile.name}</p>
                        )}
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
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAdDialog(false)}>Cancel</Button>
                      <Button
                        onClick={submitAd}
                        disabled={submitting || !adForm.title || !adForm.advertiser_name || (!adForm.audio_url && !audioFile)}
                        className="bg-violet-600 hover:bg-violet-700"
                      >
                        {submitting ? "Saving..." : (editingAd ? "Update" : "Create")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
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

              {adsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
              ) : ads.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
                          <TableCell>
                            <Badge variant={ad.is_active ? "default" : "secondary"} className={ad.is_active ? "bg-green-600" : ""}>
                              {ad.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEditAdDialog(ad)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => toggleAdStatus(ad.ad_id)}>
                                {ad.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteAd(ad.ad_id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white">Marketing Campaigns</CardTitle>
                  <CardDescription>Create push notifications, SMS, and email campaigns</CardDescription>
                </div>
                <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-violet-600 hover:bg-violet-700"
                      onClick={() => { resetCampaignForm(); setShowCampaignDialog(true); }}
                    >
                      + Create Campaign
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-white">
                        {editingCampaign ? "Edit Campaign" : "Create Campaign"}
                      </DialogTitle>
                      <DialogDescription>
                        Send targeted messages to your users
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-white">Campaign Name *</Label>
                          <Input
                            value={campaignForm.name}
                            onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                            placeholder="e.g., New Album Launch"
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Campaign Type *</Label>
                          <Select 
                            value={campaignForm.type} 
                            onValueChange={(v) => setCampaignForm({ ...campaignForm, type: v })}
                            disabled={editingCampaign}
                          >
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                              <SelectItem value="push">
                                <div className="flex items-center gap-2">
                                  <Bell className="w-4 h-4" /> Push Notification
                                </div>
                              </SelectItem>
                              <SelectItem value="sms">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4" /> SMS
                                </div>
                              </SelectItem>
                              <SelectItem value="email">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4" /> Email
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white">Description</Label>
                        <Textarea
                          value={campaignForm.description}
                          onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                          placeholder="Internal notes about this campaign"
                          className="bg-zinc-800 border-zinc-700 text-white"
                        />
                      </div>

                      {campaignForm.type !== "sms" && (
                        <div className="space-y-2">
                          <Label className="text-white">Message Title</Label>
                          <Input
                            value={campaignForm.message_title}
                            onChange={(e) => setCampaignForm({ ...campaignForm, message_title: e.target.value })}
                            placeholder="Notification/Email subject"
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-white">Message Body *</Label>
                        <Textarea
                          value={campaignForm.message_body}
                          onChange={(e) => setCampaignForm({ ...campaignForm, message_body: e.target.value })}
                          placeholder="Your message content..."
                          className="bg-zinc-800 border-zinc-700 text-white min-h-[100px]"
                        />
                      </div>

                      <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-violet-500" />
                          <Label className="text-white text-lg">Target Audience</Label>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-white">User Filter</Label>
                          <Select 
                            value={campaignForm.target_filter_type} 
                            onValueChange={(v) => setCampaignForm({ ...campaignForm, target_filter_type: v })}
                          >
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-800 border-zinc-700">
                              <SelectItem value="all">All Users</SelectItem>
                              <SelectItem value="active">Active Users (last 7 days)</SelectItem>
                              <SelectItem value="inactive">Inactive Users (30+ days)</SelectItem>
                              <SelectItem value="recent">Recently Joined (last 7 days)</SelectItem>
                              <SelectItem value="premium">Premium Users</SelectItem>
                              <SelectItem value="free">Free Users</SelectItem>
                              <SelectItem value="listened_content">Listened to Specific Content</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {campaignForm.target_filter_type === "listened_content" && (
                          <div className="space-y-2">
                            <Label className="text-white">Content IDs (comma-separated)</Label>
                            <Input
                              value={campaignForm.target_filter_content_ids}
                              onChange={(e) => setCampaignForm({ ...campaignForm, target_filter_content_ids: e.target.value })}
                              placeholder="song_id_1, album_id_2, ..."
                              className="bg-zinc-800 border-zinc-700 text-white"
                            />
                          </div>
                        )}

                        {targetPreviewCount !== null && (
                          <div className="flex items-center gap-2 text-green-500">
                            <Users className="w-4 h-4" />
                            <span>Target audience: <strong>{targetPreviewCount.toLocaleString()}</strong> users</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-white">Schedule (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={campaignForm.scheduled_at}
                          onChange={(e) => setCampaignForm({ ...campaignForm, scheduled_at: e.target.value })}
                          className="bg-zinc-800 border-zinc-700 text-white"
                        />
                        <p className="text-zinc-500 text-xs">Leave empty to save as draft</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>Cancel</Button>
                      <Button
                        onClick={submitCampaign}
                        disabled={submittingCampaign || !campaignForm.name || !campaignForm.message_body}
                        className="bg-violet-600 hover:bg-violet-700"
                      >
                        {submittingCampaign ? "Saving..." : (editingCampaign ? "Update" : "Create")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-6">
                <Input
                  placeholder="Search campaigns..."
                  value={campaignSearch}
                  onChange={(e) => setCampaignSearch(e.target.value)}
                  className="max-w-xs bg-zinc-800 border-zinc-700 text-white"
                />
                <Select value={campaignTypeFilter} onValueChange={setCampaignTypeFilter}>
                  <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={campaignStatusFilter} onValueChange={setCampaignStatusFilter}>
                  <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {campaignsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No campaigns found</p>
                  <p className="text-sm">Create your first marketing campaign</p>
                </div>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableHead className="text-zinc-400">Campaign</TableHead>
                        <TableHead className="text-zinc-400">Type</TableHead>
                        <TableHead className="text-zinc-400">Target</TableHead>
                        <TableHead className="text-zinc-400">Sent</TableHead>
                        <TableHead className="text-zinc-400">Status</TableHead>
                        <TableHead className="text-zinc-400">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.campaign_id} className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">{campaign.name}</p>
                              <p className="text-xs text-zinc-500 truncate max-w-xs">{campaign.message_body?.slice(0, 50)}...</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-zinc-300">
                              {getCampaignTypeIcon(campaign.type)}
                              <span className="capitalize">{campaign.type}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-300">{campaign.target_count?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-zinc-300">{campaign.sent_count?.toLocaleString() || 0}</TableCell>
                          <TableCell>
                            <Badge className={getCampaignStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {campaign.status === "draft" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openEditCampaignDialog(campaign)}>
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => sendCampaign(campaign.campaign_id)}>
                                    <Send className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {campaign.status === "scheduled" && (
                                <Button size="sm" variant="outline" onClick={() => cancelCampaign(campaign.campaign_id)}>
                                  Cancel
                                </Button>
                              )}
                              <Button size="sm" variant="destructive" onClick={() => deleteCampaign(campaign.campaign_id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <div className="space-y-6">
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
                    <p className="text-zinc-400 text-sm">Campaigns Sent</p>
                    <p className="text-3xl font-bold text-blue-500">{analytics.sent_campaigns?.toLocaleString() || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6">
                    <p className="text-zinc-400 text-sm">Active Ads</p>
                    <p className="text-3xl font-bold text-amber-500">{analytics.active_ads?.toLocaleString() || 0}</p>
                  </CardContent>
                </Card>
              </div>
            )}

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
                          <TableHead className="text-zinc-400">Impressions</TableHead>
                          <TableHead className="text-zinc-400">Completions</TableHead>
                          <TableHead className="text-zinc-400">Rate</TableHead>
                          <TableHead className="text-zinc-400">Clicks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adAnalytics.map((item) => (
                          <TableRow key={item.ad_id} className="border-zinc-800">
                            <TableCell className="font-medium text-white">{item.title}</TableCell>
                            <TableCell className="text-zinc-300">{item.impressions?.toLocaleString()}</TableCell>
                            <TableCell className="text-green-500">{item.completions?.toLocaleString()}</TableCell>
                            <TableCell className="text-zinc-300">{item.completion_rate}%</TableCell>
                            <TableCell className="text-blue-500">{item.clicks?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

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
