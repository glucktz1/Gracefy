import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Settings, DollarSign, Clock, Users, CreditCard, Bell, Shield,
  Save, RefreshCw, AlertTriangle, CheckCircle, Plus, Trash2, Edit2,
  Percent, Calendar, Globe, FileText, TrendingDown, Pause, Play,
  Music, Lock, Unlock, Volume2, Download, ListMusic, Shuffle, SkipForward,
  Headphones, Wifi, WifiOff, Package, TrendingUp, AlertCircle, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Default feature controls
const DEFAULT_FEATURE_CONTROLS = {
  free: {
    play_songs: "preview",
    preview_duration_seconds: 30,
    album_playback: "shuffle_only",
    song_selection: false,
    skips_per_hour: 6,
    shuffle_control: false,
    show_ads: true,
    premium_content_access: false,
    downloads_allowed: false,
    create_playlists: false,
    add_to_favorites: true,
    audio_quality: "standard",
    background_play: "limited",
    offline_mode: false,
  },
  premium: {
    play_songs: "full",
    preview_duration_seconds: 0,
    album_playback: "all",
    song_selection: true,
    skips_per_hour: -1,
    shuffle_control: true,
    show_ads: false,
    premium_content_access: true,
    downloads_allowed: true,
    create_playlists: true,
    add_to_favorites: true,
    audio_quality: "high",
    background_play: "full",
    offline_mode: true,
  }
};

// Feature configuration
const FEATURE_CONFIG = [
  { key: "play_songs", label: "Play Songs", icon: Music, type: "select", options: ["preview", "limited", "full"], freeDefault: "preview", paidDefault: "full" },
  { key: "preview_duration_seconds", label: "Preview Duration (sec)", icon: Clock, type: "number", freeDefault: 30, paidDefault: 0 },
  { key: "album_playback", label: "Album Playback", icon: ListMusic, type: "select", options: ["shuffle_only", "sequential", "all"], freeDefault: "shuffle_only", paidDefault: "all" },
  { key: "song_selection", label: "Choose Specific Song", icon: Music, type: "boolean", freeDefault: false, paidDefault: true },
  { key: "skips_per_hour", label: "Skips Per Hour (-1 = unlimited)", icon: SkipForward, type: "number", freeDefault: 6, paidDefault: -1 },
  { key: "shuffle_control", label: "Shuffle Control", icon: Shuffle, type: "boolean", freeDefault: false, paidDefault: true },
  { key: "show_ads", label: "Show Ads", icon: Bell, type: "boolean", freeDefault: true, paidDefault: false },
  { key: "premium_content_access", label: "Premium Content Access", icon: Lock, type: "boolean", freeDefault: false, paidDefault: true },
  { key: "downloads_allowed", label: "Downloads Allowed", icon: Download, type: "boolean", freeDefault: false, paidDefault: true },
  { key: "create_playlists", label: "Create Playlists", icon: ListMusic, type: "boolean", freeDefault: false, paidDefault: true },
  { key: "add_to_favorites", label: "Like/Save Songs", icon: CheckCircle, type: "boolean", freeDefault: true, paidDefault: true },
  { key: "audio_quality", label: "Audio Quality", icon: Volume2, type: "select", options: ["standard", "high", "lossless"], freeDefault: "standard", paidDefault: "high" },
  { key: "background_play", label: "Background Play", icon: Headphones, type: "select", options: ["disabled", "limited", "full"], freeDefault: "limited", paidDefault: "full" },
  { key: "offline_mode", label: "Offline Mode", icon: WifiOff, type: "boolean", freeDefault: false, paidDefault: true },
];

export default function MonetizationSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [plans, setPlans] = useState([]);
  const [rateHistory, setRateHistory] = useState([]);
  const [featureControls, setFeatureControls] = useState(DEFAULT_FEATURE_CONTROLS);
  const [trialSettings, setTrialSettings] = useState({ free_trial_enabled: true, free_trial_days: 7 });
  const [trialStats, setTrialStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [savingTrial, setSavingTrial] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: "", display_name: "", price: "", duration_days: "", features: "", is_active: true
  });
  
  // Revenue/Monetization settings state
  const [revenueSettings, setRevenueSettings] = useState({
    monetization_mode: "time_based",
    pay_per_content_enabled: false,
    premium_rate_per_hour: 10,
    standard_rate_per_hour: 5,
    choir_share_percentage: 70,
    platform_share_percentage: 30,
    bundle_platform_fee_percentage: 20,
    minimum_withdrawal: 10000,
    currency: "TZS"
  });
  const [savingRevenue, setSavingRevenue] = useState(false);

  const fetchData = async () => {
    try {
      const [settingsRes, plansRes, historyRes, featuresRes, trialRes, trialStatsRes, revenueRes] = await Promise.all([
        axios.get(`${API}/monetization/settings`, { withCredentials: true }),
        axios.get(`${API}/subscription-plans?active_only=false&admin=true`, { withCredentials: true }),
        axios.get(`${API}/monetization/rate-history`, { withCredentials: true }),
        axios.get(`${API}/monetization/feature-controls`, { withCredentials: true }),
        axios.get(`${API}/monetization/trial-settings`, { withCredentials: true }),
        axios.get(`${API}/monetization/trial-stats`, { withCredentials: true }),
        axios.get(`${API}/revenue/settings`, { withCredentials: true }).catch(() => ({ data: {} }))
      ]);
      setSettings(settingsRes.data);
      setPlans(plansRes.data.plans || []);
      setRateHistory(historyRes.data.history || []);
      setFeatureControls(featuresRes.data.controls || DEFAULT_FEATURE_CONTROLS);
      setTrialSettings(trialRes.data);
      setTrialStats(trialStatsRes.data);
      
      // Set revenue settings with defaults
      if (revenueRes.data) {
        setRevenueSettings(prev => ({
          ...prev,
          monetization_mode: revenueRes.data.monetization_mode || "time_based",
          pay_per_content_enabled: revenueRes.data.pay_per_content_enabled || false,
          premium_rate_per_hour: revenueRes.data.premium_rate_per_hour || 10,
          standard_rate_per_hour: revenueRes.data.standard_rate_per_hour || 5,
          choir_share_percentage: revenueRes.data.choir_share_percentage || 70,
          platform_share_percentage: revenueRes.data.platform_share_percentage || 30,
          bundle_platform_fee_percentage: revenueRes.data.bundle_platform_fee_percentage || 20,
          minimum_withdrawal: revenueRes.data.minimum_withdrawal || 10000,
          currency: revenueRes.data.currency || "TZS"
        }));
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveTrialSettings = async () => {
    setSavingTrial(true);
    try {
      await axios.put(`${API}/monetization/trial-settings`, trialSettings, { withCredentials: true });
      toast.success("Trial settings saved successfully");
    } catch (error) {
      toast.error("Failed to save trial settings");
    } finally {
      setSavingTrial(false);
    }
  };

  const handleSaveRevenueSettings = async () => {
    setSavingRevenue(true);
    try {
      await axios.post(`${API}/revenue/settings`, revenueSettings, { withCredentials: true });
      toast.success("Revenue settings saved successfully");
      fetchData();
    } catch (error) {
      console.error("Error saving revenue settings:", error);
      toast.error("Failed to save revenue settings");
    } finally {
      setSavingRevenue(false);
    }
  };

  const handleMonetizationModeChange = (mode) => {
    setRevenueSettings(prev => ({
      ...prev,
      monetization_mode: mode
    }));
  };

  const handleRevenueChange = (key, value) => {
    setRevenueSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/monetization/settings`, settings, { withCredentials: true });
      toast.success("Settings saved successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFeatureControls = async () => {
    setSavingFeatures(true);
    try {
      await axios.put(`${API}/monetization/feature-controls`, { controls: featureControls }, { withCredentials: true });
      toast.success("Feature controls saved successfully");
    } catch (error) {
      toast.error("Failed to save feature controls");
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleToggle = (key) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleFeatureChange = (tier, key, value) => {
    setFeatureControls(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [key]: value
      }
    }));
  };

  const handlePausePayouts = async () => {
    try {
      await axios.post(`${API}/monetization/pause-all-payouts`, { reason: "Admin action" }, { withCredentials: true });
      toast.success("All payouts paused");
      fetchData();
    } catch (error) {
      toast.error("Failed to pause payouts");
    }
  };

  const handleResumePayouts = async () => {
    try {
      await axios.post(`${API}/monetization/resume-payouts`, {}, { withCredentials: true });
      toast.success("Payouts resumed");
      fetchData();
    } catch (error) {
      toast.error("Failed to resume payouts");
    }
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      const planData = {
        ...planForm,
        price: parseFloat(planForm.price),
        duration_days: parseInt(planForm.duration_days),
        features: planForm.features.split(",").map(f => f.trim()).filter(f => f)
      };
      
      if (editingPlan) {
        await axios.put(`${API}/subscription-plans/${editingPlan.plan_id}`, planData, { withCredentials: true });
        toast.success("Plan updated");
      } else {
        await axios.post(`${API}/subscription-plans`, planData, { withCredentials: true });
        toast.success("Plan created");
      }
      
      setIsPlanModalOpen(false);
      setEditingPlan(null);
      setPlanForm({ name: "", display_name: "", price: "", duration_days: "", features: "", is_active: true });
      fetchData();
    } catch (error) {
      toast.error("Failed to save plan");
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to delete this plan?")) return;
    try {
      await axios.delete(`${API}/subscription-plans/${planId}`, { withCredentials: true });
      toast.success("Plan deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete plan");
    }
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      display_name: plan.display_name,
      price: plan.price.toString(),
      duration_days: plan.duration_days.toString(),
      features: plan.features?.join(", ") || "",
      is_active: plan.is_active
    });
    setIsPlanModalOpen(true);
  };

  const resetFeaturesToDefaults = () => {
    setFeatureControls(DEFAULT_FEATURE_CONTROLS);
    toast.info("Reset to defaults - click Save to apply");
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" data-testid="monetization-settings-page">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings className="text-violet-400" /> Monetization Settings
          </h1>
          <p className="page-subtitle">Configure platform revenue, subscriptions, feature controls, and more</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="border-zinc-700 text-zinc-300">
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-settings-btn">
            <Save size={16} className="mr-2" /> {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Emergency Controls */}
      {settings?.all_payouts_paused && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" />
            <div>
              <p className="text-red-400 font-medium">All Payouts Are Paused</p>
              <p className="text-sm text-zinc-500">{settings.payouts_paused_reason || "No reason provided"}</p>
            </div>
          </div>
          <Button onClick={handleResumePayouts} className="bg-emerald-600 hover:bg-emerald-700">
            <Play size={16} className="mr-2" /> Resume Payouts
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto p-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-violet-600">General</TabsTrigger>
          <TabsTrigger value="trial" className="data-[state=active]:bg-violet-600">Free Trial</TabsTrigger>
          <TabsTrigger value="features" className="data-[state=active]:bg-violet-600">Feature Controls</TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-violet-600">Subscriptions</TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-violet-600">Content Rates</TabsTrigger>
          <TabsTrigger value="payouts" className="data-[state=active]:bg-violet-600">Payouts</TabsTrigger>
          <TabsTrigger value="safety" className="data-[state=active]:bg-violet-600">Safety</TabsTrigger>
        </TabsList>

        {/* Free Trial Tab */}
        <TabsContent value="trial" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Free Trial Settings</h2>
              <p className="text-sm text-zinc-400">Configure free trial period for new users</p>
            </div>
            <Button onClick={handleSaveTrialSettings} disabled={savingTrial} className="bg-emerald-600 hover:bg-emerald-700">
              <Save size={16} className="mr-2" /> {savingTrial ? "Saving..." : "Save Trial Settings"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trial Configuration */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Clock size={18} className="text-emerald-400" /> Trial Configuration
                </CardTitle>
                <CardDescription>Set up the free trial period for new users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-white font-medium">Enable Free Trial</span>
                    <p className="text-xs text-zinc-500">New users get premium features for free</p>
                  </div>
                  <Switch
                    checked={trialSettings.free_trial_enabled}
                    onCheckedChange={(checked) => setTrialSettings(prev => ({ ...prev, free_trial_enabled: checked }))}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Trial Duration (days)</label>
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    value={trialSettings.free_trial_days}
                    onChange={(e) => setTrialSettings(prev => ({ ...prev, free_trial_days: parseInt(e.target.value) || 7 }))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    disabled={!trialSettings.free_trial_enabled}
                  />
                  <p className="text-xs text-zinc-500 mt-1">Users get {trialSettings.free_trial_days} days of premium access</p>
                </div>
              </CardContent>
            </Card>

            {/* Trial Stats */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <TrendingDown size={18} className="text-blue-400" /> Trial Statistics
                </CardTitle>
                <CardDescription>Overview of trial usage and conversions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-950 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{trialStats?.active_trials || 0}</div>
                    <div className="text-xs text-zinc-500">Active Trials</div>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-amber-400">{trialStats?.expired_trials || 0}</div>
                    <div className="text-xs text-zinc-500">Expired Trials</div>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-violet-400">{trialStats?.converted_trials || 0}</div>
                    <div className="text-xs text-zinc-500">Converted to Paid</div>
                  </div>
                  <div className="bg-zinc-950 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{trialStats?.conversion_rate || 0}%</div>
                    <div className="text-xs text-zinc-500">Conversion Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trial Features Info */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Unlock size={18} className="text-violet-400" /> What Trial Users Get
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Unlimited skips</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Full song playback</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Offline downloads</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Create playlists</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>No ads</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>High quality audio</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Choose any song</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Background play</span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-4">
                Trial users get full premium access. After the trial expires, they revert to free tier unless they subscribe.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Controls Tab - NEW */}
        <TabsContent value="features" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Free vs Premium Feature Controls</h2>
              <p className="text-sm text-zinc-400">Configure what features are available for free and paid users</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetFeaturesToDefaults} className="border-zinc-700 text-zinc-300">
                Reset to Defaults
              </Button>
              <Button onClick={handleSaveFeatureControls} disabled={savingFeatures} className="bg-emerald-600 hover:bg-emerald-700">
                <Save size={16} className="mr-2" /> {savingFeatures ? "Saving..." : "Save Feature Controls"}
              </Button>
            </div>
          </div>

          {/* Feature Comparison Table */}
          <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="text-white text-base">Feature Comparison</CardTitle>
              <CardDescription>Configure restrictions for each subscription tier</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left p-4 text-zinc-400 font-medium">Feature</th>
                      <th className="text-center p-4 text-zinc-400 font-medium min-w-[200px]">
                        <div className="flex items-center justify-center gap-2">
                          <Lock size={16} className="text-zinc-500" />
                          Free Users
                        </div>
                      </th>
                      <th className="text-center p-4 text-zinc-400 font-medium min-w-[200px]">
                        <div className="flex items-center justify-center gap-2">
                          <Unlock size={16} className="text-emerald-400" />
                          Premium Users
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_CONFIG.map((feature) => {
                      const Icon = feature.icon;
                      return (
                        <tr key={feature.key} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Icon size={18} className="text-violet-400" />
                              <span className="text-white font-medium">{feature.label}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center">
                              {feature.type === "boolean" ? (
                                <Switch
                                  checked={featureControls.free?.[feature.key] ?? feature.freeDefault}
                                  onCheckedChange={(checked) => handleFeatureChange("free", feature.key, checked)}
                                  className="data-[state=checked]:bg-emerald-600"
                                />
                              ) : feature.type === "select" ? (
                                <Select
                                  value={featureControls.free?.[feature.key] ?? feature.freeDefault}
                                  onValueChange={(value) => handleFeatureChange("free", feature.key, value)}
                                >
                                  <SelectTrigger className="w-[140px] bg-zinc-950 border-zinc-700 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-900 border-zinc-700">
                                    {feature.options.map(opt => (
                                      <SelectItem key={opt} value={opt} className="text-white hover:bg-zinc-800">
                                        {opt.replace(/_/g, " ")}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type="number"
                                  value={featureControls.free?.[feature.key] ?? feature.freeDefault}
                                  onChange={(e) => handleFeatureChange("free", feature.key, parseInt(e.target.value))}
                                  className="w-[100px] bg-zinc-950 border-zinc-700 text-white text-center"
                                />
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center">
                              {feature.type === "boolean" ? (
                                <Switch
                                  checked={featureControls.premium?.[feature.key] ?? feature.paidDefault}
                                  onCheckedChange={(checked) => handleFeatureChange("premium", feature.key, checked)}
                                  className="data-[state=checked]:bg-emerald-600"
                                />
                              ) : feature.type === "select" ? (
                                <Select
                                  value={featureControls.premium?.[feature.key] ?? feature.paidDefault}
                                  onValueChange={(value) => handleFeatureChange("premium", feature.key, value)}
                                >
                                  <SelectTrigger className="w-[140px] bg-zinc-950 border-zinc-700 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-900 border-zinc-700">
                                    {feature.options.map(opt => (
                                      <SelectItem key={opt} value={opt} className="text-white hover:bg-zinc-800">
                                        {opt.replace(/_/g, " ")}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  type="number"
                                  value={featureControls.premium?.[feature.key] ?? feature.paidDefault}
                                  onChange={(e) => handleFeatureChange("premium", feature.key, parseInt(e.target.value))}
                                  className="w-[100px] bg-zinc-950 border-zinc-700 text-white text-center"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Feature Explanation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Lock size={16} className="text-zinc-500" /> Free Tier Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Song Playback:</span>
                  <Badge variant="outline" className="border-zinc-700">{featureControls.free?.play_songs || "preview"}</Badge>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Skips/Hour:</span>
                  <Badge variant="outline" className="border-zinc-700">{featureControls.free?.skips_per_hour ?? 6}</Badge>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Ads:</span>
                  <Badge variant="outline" className="border-amber-600 text-amber-400">{featureControls.free?.show_ads ? "Yes" : "No"}</Badge>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Downloads:</span>
                  <Badge variant="outline" className="border-red-600 text-red-400">{featureControls.free?.downloads_allowed ? "Yes" : "No"}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Unlock size={16} className="text-emerald-400" /> Premium Tier Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Song Playback:</span>
                  <Badge variant="outline" className="border-emerald-600 text-emerald-400">{featureControls.premium?.play_songs || "full"}</Badge>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Skips/Hour:</span>
                  <Badge variant="outline" className="border-emerald-600 text-emerald-400">{featureControls.premium?.skips_per_hour === -1 ? "Unlimited" : featureControls.premium?.skips_per_hour}</Badge>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Ads:</span>
                  <Badge variant="outline" className="border-emerald-600 text-emerald-400">{featureControls.premium?.show_ads ? "Yes" : "No"}</Badge>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Downloads:</span>
                  <Badge variant="outline" className="border-emerald-600 text-emerald-400">{featureControls.premium?.downloads_allowed ? "Yes" : "No"}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          {/* Monetization Options Section */}
          <Card className="bg-gradient-to-br from-violet-900/30 to-zinc-900/50 border-violet-800/50">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <TrendingUp size={20} className="text-violet-400" /> Choir Revenue Model
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Choose how choirs earn revenue from their content. Options 1 & 2 are mutually exclusive.
                  </CardDescription>
                </div>
                <Button 
                  onClick={handleSaveRevenueSettings} 
                  disabled={savingRevenue} 
                  className="bg-violet-600 hover:bg-violet-700"
                  data-testid="save-revenue-settings-btn"
                >
                  <Save size={16} className="mr-2" /> {savingRevenue ? "Saving..." : "Save Revenue Settings"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Option 1 & 2 Toggle - Mutually Exclusive */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  <span className="text-sm text-amber-400">Select ONE revenue calculation method below</span>
                </div>
                
                {/* Option 1: Time-Based Earning */}
                <div 
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    revenueSettings.monetization_mode === "time_based" 
                      ? "border-emerald-500 bg-emerald-500/10" 
                      : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                  }`}
                  onClick={() => handleMonetizationModeChange("time_based")}
                  data-testid="option-time-based"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${revenueSettings.monetization_mode === "time_based" ? "bg-emerald-500/20" : "bg-zinc-700"}`}>
                        <Clock size={24} className={revenueSettings.monetization_mode === "time_based" ? "text-emerald-400" : "text-zinc-400"} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">Option 1: Time-Based Earning</h3>
                          {revenueSettings.monetization_mode === "time_based" && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 mt-1">
                          <code className="bg-zinc-800 px-2 py-0.5 rounded text-emerald-400">choir_earning = listening_hours × rate_per_hour</code>
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">
                          Example: 12 hours × TZS 10 = TZS 120 choir revenue. Revenue calculated per play.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={revenueSettings.monetization_mode === "time_based"}
                      onCheckedChange={() => handleMonetizationModeChange("time_based")}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                  
                  {/* Time-Based Settings */}
                  {revenueSettings.monetization_mode === "time_based" && (
                    <div className="mt-4 pt-4 border-t border-zinc-700 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Premium Rate (per hour)</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={revenueSettings.premium_rate_per_hour}
                            onChange={(e) => handleRevenueChange("premium_rate_per_hour", parseFloat(e.target.value))}
                            className="bg-zinc-950 border-zinc-700 text-white"
                            data-testid="premium-rate-input"
                          />
                          <span className="text-zinc-500 text-sm">{revenueSettings.currency}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Standard Rate (per hour)</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={revenueSettings.standard_rate_per_hour}
                            onChange={(e) => handleRevenueChange("standard_rate_per_hour", parseFloat(e.target.value))}
                            className="bg-zinc-950 border-zinc-700 text-white"
                            data-testid="standard-rate-input"
                          />
                          <span className="text-zinc-500 text-sm">{revenueSettings.currency}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 2: Percentage-Based Earning */}
                <div 
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    revenueSettings.monetization_mode === "percentage_based" 
                      ? "border-blue-500 bg-blue-500/10" 
                      : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                  }`}
                  onClick={() => handleMonetizationModeChange("percentage_based")}
                  data-testid="option-percentage-based"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${revenueSettings.monetization_mode === "percentage_based" ? "bg-blue-500/20" : "bg-zinc-700"}`}>
                        <Percent size={24} className={revenueSettings.monetization_mode === "percentage_based" ? "text-blue-400" : "text-zinc-400"} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">Option 2: Percentage-Based Earning</h3>
                          {revenueSettings.monetization_mode === "percentage_based" && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Active</Badge>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 mt-1">
                          <code className="bg-zinc-800 px-2 py-0.5 rounded text-blue-400">(choir_mins / total_mins) × choir_share% × revenue</code>
                        </p>
                        <p className="text-xs text-zinc-500 mt-2">
                          Revenue distributed periodically based on listening proportion. Calculate via admin action.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={revenueSettings.monetization_mode === "percentage_based"}
                      onCheckedChange={() => handleMonetizationModeChange("percentage_based")}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                  
                  {/* Percentage-Based Settings */}
                  {revenueSettings.monetization_mode === "percentage_based" && (
                    <div className="mt-4 pt-4 border-t border-zinc-700 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Choir Share (%)</label>
                        <Input
                          type="number"
                          value={revenueSettings.choir_share_percentage}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleRevenueChange("choir_share_percentage", val);
                            handleRevenueChange("platform_share_percentage", 100 - val);
                          }}
                          className="bg-zinc-950 border-zinc-700 text-white"
                          data-testid="choir-share-input"
                          min={0}
                          max={100}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-zinc-400 mb-1 block">Platform Share (%)</label>
                        <Input
                          type="number"
                          value={revenueSettings.platform_share_percentage}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            handleRevenueChange("platform_share_percentage", val);
                            handleRevenueChange("choir_share_percentage", 100 - val);
                          }}
                          className="bg-zinc-950 border-zinc-700 text-white"
                          data-testid="platform-share-input"
                          min={0}
                          max={100}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-zinc-700 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Info size={16} className="text-zinc-500" />
                  <span className="text-sm text-zinc-400">Option 3 can be enabled alongside either Option 1 or 2</span>
                </div>
              </div>

              {/* Option 3: Pay-Per-Content Bundle */}
              <div 
                className={`p-4 rounded-lg border-2 transition-all ${
                  revenueSettings.pay_per_content_enabled 
                    ? "border-amber-500 bg-amber-500/10" 
                    : "border-zinc-700 bg-zinc-800/50"
                }`}
                data-testid="option-pay-per-content"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${revenueSettings.pay_per_content_enabled ? "bg-amber-500/20" : "bg-zinc-700"}`}>
                      <Package size={24} className={revenueSettings.pay_per_content_enabled ? "text-amber-400" : "text-zinc-400"} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">Option 3: Pay-Per-Content Bundle</h3>
                        {revenueSettings.pay_per_content_enabled && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Enabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        Create content bundles (albums/collections) that users pay for access
                      </p>
                      <p className="text-xs text-zinc-500 mt-2">
                        Like pay-per-view. Revenue goes directly to content owner minus platform fee. Manage bundles in Content Bundles section.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={revenueSettings.pay_per_content_enabled}
                    onCheckedChange={(checked) => handleRevenueChange("pay_per_content_enabled", checked)}
                    className="data-[state=checked]:bg-amber-600"
                    data-testid="pay-per-content-toggle"
                  />
                </div>
                
                {/* Bundle Settings */}
                {revenueSettings.pay_per_content_enabled && (
                  <div className="mt-4 pt-4 border-t border-zinc-700">
                    <div className="max-w-xs">
                      <label className="text-sm text-zinc-400 mb-1 block">Platform Fee for Bundles (%)</label>
                      <Input
                        type="number"
                        value={revenueSettings.bundle_platform_fee_percentage}
                        onChange={(e) => handleRevenueChange("bundle_platform_fee_percentage", parseFloat(e.target.value))}
                        className="bg-zinc-950 border-zinc-700 text-white"
                        data-testid="bundle-fee-input"
                        min={0}
                        max={100}
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Content owner receives {100 - (revenueSettings.bundle_platform_fee_percentage || 20)}% of bundle price
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Alert */}
              <Alert className="bg-zinc-800/50 border-zinc-700">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-white">Current Configuration</AlertTitle>
                <AlertDescription className="text-zinc-400">
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Revenue Model: <span className="text-white font-medium">
                      {revenueSettings.monetization_mode === "time_based" ? "Time-Based Earning" : "Percentage-Based Earning"}
                    </span></li>
                    {revenueSettings.monetization_mode === "time_based" ? (
                      <li>• Rates: Premium {revenueSettings.premium_rate_per_hour} {revenueSettings.currency}/hr, Standard {revenueSettings.standard_rate_per_hour} {revenueSettings.currency}/hr</li>
                    ) : (
                      <li>• Split: {revenueSettings.choir_share_percentage}% Choir / {revenueSettings.platform_share_percentage}% Platform</li>
                    )}
                    <li>• Pay-Per-Content: <span className={revenueSettings.pay_per_content_enabled ? "text-emerald-400" : "text-zinc-500"}>
                      {revenueSettings.pay_per_content_enabled ? `Enabled (${revenueSettings.bundle_platform_fee_percentage}% platform fee)` : "Disabled"}
                    </span></li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Platform Revenue */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Percent size={18} className="text-emerald-400" /> Platform Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Platform Fee (%)</label>
                  <Input
                    type="number"
                    value={settings?.platform_fee_percentage || 30}
                    onChange={(e) => handleChange("platform_fee_percentage", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    data-testid="platform-fee-input"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Effective Date</label>
                  <Input
                    type="date"
                    value={settings?.platform_fee_effective_date || ""}
                    onChange={(e) => handleChange("platform_fee_effective_date", e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Apply to Subscriptions</span>
                  <Switch
                    checked={settings?.apply_fee_to_subscriptions || false}
                    onCheckedChange={() => handleToggle("apply_fee_to_subscriptions")}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Currency Settings */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Globe size={18} className="text-blue-400" /> Currency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Primary Currency</label>
                  <Select
                    value={settings?.primary_currency || "TZS"}
                    onValueChange={(value) => handleChange("primary_currency", value)}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="TZS" className="text-white">TZS - Tanzanian Shilling</SelectItem>
                      <SelectItem value="USD" className="text-white">USD - US Dollar</SelectItem>
                      <SelectItem value="KES" className="text-white">KES - Kenyan Shilling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Multi-Currency Support</span>
                  <Switch
                    checked={settings?.multi_currency_enabled || false}
                    onCheckedChange={() => handleToggle("multi_currency_enabled")}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Subscription Plans</h2>
            <Button onClick={() => { setEditingPlan(null); setPlanForm({ name: "", display_name: "", price: "", duration_days: "", features: "", is_active: true }); setIsPlanModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
              <Plus size={16} className="mr-2" /> Add Plan
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => (
              <Card key={plan.plan_id} className={`bg-zinc-900/50 border-zinc-800 ${!plan.is_active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-white text-base">{plan.display_name}</CardTitle>
                      <Badge variant="outline" className={plan.is_active ? "border-emerald-600 text-emerald-400" : "border-zinc-600 text-zinc-400"}>
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditPlan(plan)}>
                        <Edit2 size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePlan(plan.plan_id)} className="text-red-400">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white mb-2">
                    {settings?.primary_currency || "TZS"} {plan.price?.toLocaleString()}
                    <span className="text-sm font-normal text-zinc-400">/{plan.duration_days} days</span>
                  </div>
                  <div className="space-y-1">
                    {plan.features?.slice(0, 4).map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-zinc-400">
                        <CheckCircle size={14} className="text-emerald-400" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Content Rates Tab */}
        <TabsContent value="content" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Music size={18} className="text-violet-400" /> Streaming Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Rate per 1000 streams ({settings?.primary_currency || "TZS"})</label>
                  <Input
                    type="number"
                    value={settings?.rate_per_1000_streams || 500}
                    onChange={(e) => handleChange("rate_per_1000_streams", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Min stream duration (seconds)</label>
                  <Input
                    type="number"
                    value={settings?.min_stream_duration || 45}
                    onChange={(e) => handleChange("min_stream_duration", parseInt(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Download size={18} className="text-blue-400" /> Download Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Rate per download ({settings?.primary_currency || "TZS"})</label>
                  <Input
                    type="number"
                    value={settings?.rate_per_download || 100}
                    onChange={(e) => handleChange("rate_per_download", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Downloads Enabled</span>
                  <Switch
                    checked={settings?.downloads_enabled ?? true}
                    onCheckedChange={() => handleToggle("downloads_enabled")}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-400" /> Payout Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Minimum Payout ({settings?.primary_currency || "TZS"})</label>
                  <Input
                    type="number"
                    value={settings?.min_payout_amount || 50000}
                    onChange={(e) => handleChange("min_payout_amount", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Payout Schedule</label>
                  <Select
                    value={settings?.payout_schedule || "monthly"}
                    onValueChange={(value) => handleChange("payout_schedule", value)}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="weekly" className="text-white">Weekly</SelectItem>
                      <SelectItem value="biweekly" className="text-white">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Auto Payouts</span>
                  <Switch
                    checked={settings?.auto_payouts ?? true}
                    onCheckedChange={() => handleToggle("auto_payouts")}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Shield size={18} className="text-amber-400" /> Emergency Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-400">Use these controls in case of emergency to halt all payouts.</p>
                {settings?.all_payouts_paused ? (
                  <Button onClick={handleResumePayouts} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Play size={16} className="mr-2" /> Resume All Payouts
                  </Button>
                ) : (
                  <Button onClick={handlePausePayouts} variant="destructive" className="w-full">
                    <Pause size={16} className="mr-2" /> Pause All Payouts
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Safety Tab */}
        <TabsContent value="safety" className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Shield size={18} className="text-amber-400" /> Fraud Prevention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">Fraud Detection</span>
                  <p className="text-xs text-zinc-500">Automatically flag suspicious activity</p>
                </div>
                <Switch
                  checked={settings?.fraud_detection_enabled ?? true}
                  onCheckedChange={() => handleToggle("fraud_detection_enabled")}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">Auto-freeze Suspicious Accounts</span>
                  <p className="text-xs text-zinc-500">Temporarily freeze accounts with anomalies</p>
                </div>
                <Switch
                  checked={settings?.auto_freeze_suspicious ?? false}
                  onCheckedChange={() => handleToggle("auto_freeze_suspicious")}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Max Daily Streams per User</label>
                <Input
                  type="number"
                  value={settings?.max_daily_streams_per_user || 1000}
                  onChange={(e) => handleChange("max_daily_streams_per_user", parseInt(e.target.value))}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Modal */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Plan Name (internal)</label>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="premium_monthly"
                required
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Display Name</label>
              <Input
                value={planForm.display_name}
                onChange={(e) => setPlanForm({ ...planForm, display_name: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Premium Monthly"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Price</label>
                <Input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Duration (days)</label>
                <Input
                  type="number"
                  value={planForm.duration_days}
                  onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Features (comma-separated)</label>
              <Input
                value={planForm.features}
                onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Ad-free, Unlimited skips, High quality"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Active</span>
              <Switch
                checked={planForm.is_active}
                onCheckedChange={(checked) => setPlanForm({ ...planForm, is_active: checked })}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPlanModalOpen(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                {editingPlan ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
