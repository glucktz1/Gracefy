import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Settings, DollarSign, Clock, Users, CreditCard, Bell, Shield,
  Save, RefreshCw, AlertTriangle, CheckCircle, Plus, Trash2, Edit2,
  Percent, Calendar, Globe, FileText, TrendingDown, Pause, Play
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
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MonetizationSettingsPage() {
  const [settings, setSettings] = useState(null);
  const [plans, setPlans] = useState([]);
  const [rateHistory, setRateHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: "", display_name: "", price: "", duration_days: "", features: "", is_active: true
  });

  const fetchData = async () => {
    try {
      const [settingsRes, plansRes, historyRes] = await Promise.all([
        axios.get(`${API}/monetization/settings`, { withCredentials: true }),
        axios.get(`${API}/monetization/plans`, { withCredentials: true }),
        axios.get(`${API}/monetization/rate-history`, { withCredentials: true })
      ]);
      setSettings(settingsRes.data);
      setPlans(plansRes.data.plans || []);
      setRateHistory(historyRes.data.history || []);
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

  const handleToggle = (key) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
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
        await axios.put(`${API}/monetization/plans/${editingPlan.plan_id}`, planData, { withCredentials: true });
        toast.success("Plan updated");
      } else {
        await axios.post(`${API}/monetization/plans`, planData, { withCredentials: true });
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
      await axios.delete(`${API}/monetization/plans/${planId}`, { withCredentials: true });
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
          <p className="page-subtitle">Configure platform revenue, subscriptions, payouts, and more</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="border-zinc-700 text-zinc-300">
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-settings-btn">
            <Save size={16} className="mr-2" /> {saving ? "Saving..." : "Save All Changes"}
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
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-violet-600">Subscriptions</TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-violet-600">Content Rates</TabsTrigger>
          <TabsTrigger value="payouts" className="data-[state=active]:bg-violet-600">Payouts</TabsTrigger>
          <TabsTrigger value="tax" className="data-[state=active]:bg-violet-600">Tax & Compliance</TabsTrigger>
          <TabsTrigger value="safety" className="data-[state=active]:bg-violet-600">Safety</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
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
                  <Switch checked={settings?.apply_fee_to_subscriptions} onCheckedChange={() => handleToggle("apply_fee_to_subscriptions")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Apply to Donations</span>
                  <Switch checked={settings?.apply_fee_to_donations} onCheckedChange={() => handleToggle("apply_fee_to_donations")} />
                </div>
              </CardContent>
            </Card>

            {/* Tips & Donations */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <DollarSign size={18} className="text-pink-400" /> Tips & Donations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Enable Tips</span>
                  <Switch checked={settings?.tips_enabled} onCheckedChange={() => handleToggle("tips_enabled")} />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Platform Fee on Tips (%)</label>
                  <Input
                    type="number"
                    value={settings?.platform_fee_on_tips_percentage || 10}
                    onChange={(e) => handleChange("platform_fee_on_tips_percentage", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Suggested Tip Amounts (TZS)</label>
                  <Input
                    value={settings?.suggested_tip_amounts?.join(", ") || "500, 1000, 2000, 5000"}
                    onChange={(e) => handleChange("suggested_tip_amounts", e.target.value.split(",").map(v => parseFloat(v.trim())))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="500, 1000, 2000, 5000"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Currency & Rounding */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Globe size={18} className="text-violet-400" /> Currency & Rounding
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Base Currency</label>
                  <Select value={settings?.base_currency || "TZS"} onValueChange={(v) => handleChange("base_currency", v)}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="TZS">TZS (Tanzanian Shilling)</SelectItem>
                      <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
                      <SelectItem value="UGX">UGX (Ugandan Shilling)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Rounding Precision</label>
                  <Select value={settings?.rounding_precision?.toString() || "0"} onValueChange={(v) => handleChange("rounding_precision", parseInt(v))}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="0">Whole numbers</SelectItem>
                      <SelectItem value="1">1 decimal place</SelectItem>
                      <SelectItem value="2">2 decimal places</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Analytics */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <FileText size={18} className="text-amber-400" /> Analytics & Reporting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Revenue Aggregation</label>
                  <Select value={settings?.revenue_aggregation_interval || "daily"} onValueChange={(v) => handleChange("revenue_aggregation_interval", v)}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Data Retention (days)</label>
                  <Input
                    type="number"
                    value={settings?.data_retention_days || 365}
                    onChange={(e) => handleChange("data_retention_days", parseInt(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subscription Settings */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Users size={18} className="text-emerald-400" /> Subscription Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Enable Subscriptions</span>
                  <Switch checked={settings?.subscription_enabled} onCheckedChange={() => handleToggle("subscription_enabled")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Free Trial</span>
                  <Switch checked={settings?.free_trial_enabled} onCheckedChange={() => handleToggle("free_trial_enabled")} />
                </div>
                {settings?.free_trial_enabled && (
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Free Trial Days</label>
                    <Input
                      type="number"
                      value={settings?.free_trial_days || 7}
                      onChange={(e) => handleChange("free_trial_days", parseInt(e.target.value))}
                      className="bg-zinc-950 border-zinc-800 text-white"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Auto-Renew</span>
                  <Switch checked={settings?.auto_renew_enabled} onCheckedChange={() => handleToggle("auto_renew_enabled")} />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Grace Period (days)</label>
                  <Input
                    type="number"
                    value={settings?.grace_period_days || 3}
                    onChange={(e) => handleChange("grace_period_days", parseInt(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Album Monetization */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <DollarSign size={18} className="text-violet-400" /> Album Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Subscription-Only Albums</span>
                  <Switch checked={settings?.subscription_only_albums_enabled} onCheckedChange={() => handleToggle("subscription_only_albums_enabled")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Free/Promotional Albums</span>
                  <Switch checked={settings?.free_promotional_albums_enabled} onCheckedChange={() => handleToggle("free_promotional_albums_enabled")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Geo-Restricted Monetization</span>
                  <Switch checked={settings?.geo_restricted_monetization} onCheckedChange={() => handleToggle("geo_restricted_monetization")} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Plans */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-base">Subscription Plans</CardTitle>
              <Button onClick={() => { setEditingPlan(null); setPlanForm({ name: "", display_name: "", price: "", duration_days: "", features: "", is_active: true }); setIsPlanModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-plan-btn">
                <Plus size={16} className="mr-2" /> Add Plan
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => (
                  <div key={plan.plan_id} className={`p-4 rounded-lg border ${plan.is_active ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-900/50 border-zinc-800 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-white">{plan.display_name}</h4>
                      {plan.is_active ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>
                      ) : (
                        <Badge className="bg-zinc-500/20 text-zinc-400">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">TZS {plan.price?.toLocaleString()}</p>
                    <p className="text-xs text-zinc-500 mb-3">{plan.duration_days} days</p>
                    <ul className="text-xs text-zinc-400 space-y-1 mb-4">
                      {plan.features?.slice(0, 3).map((f, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <CheckCircle size={10} className="text-emerald-400" /> {f}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)} className="flex-1 border-zinc-700 text-zinc-300">
                        <Edit2 size={12} className="mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeletePlan(plan.plan_id)} className="border-red-600 text-red-400">
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Rates Tab */}
        <TabsContent value="content" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Content Revenue Rates */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-400" /> Content Revenue Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Premium Rate (TZS/hour)</label>
                  <Input
                    type="number"
                    value={settings?.premium_rate_per_hour || 10}
                    onChange={(e) => handleChange("premium_rate_per_hour", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    data-testid="premium-rate-input"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Standard Rate (TZS/hour)</label>
                  <Input
                    type="number"
                    value={settings?.standard_rate_per_hour || 5}
                    onChange={(e) => handleChange("standard_rate_per_hour", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    data-testid="standard-rate-input"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Rate Effective Date</label>
                  <Input
                    type="date"
                    value={settings?.rate_effective_date || ""}
                    onChange={(e) => handleChange("rate_effective_date", e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Premium Content Rules */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Clock size={18} className="text-amber-400" /> Premium Content Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Premium Duration (days)</label>
                  <Input
                    type="number"
                    value={settings?.premium_duration_days || 90}
                    onChange={(e) => handleChange("premium_duration_days", parseInt(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Auto-Downgrade to Standard</span>
                  <Switch checked={settings?.auto_downgrade_to_standard} onCheckedChange={() => handleToggle("auto_downgrade_to_standard")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Premium Approval Required</span>
                  <Switch checked={settings?.premium_approval_required} onCheckedChange={() => handleToggle("premium_approval_required")} />
                </div>
              </CardContent>
            </Card>

            {/* Listening Time Rules */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Clock size={18} className="text-violet-400" /> Listening Time Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Min Qualifying Play Time (seconds)</label>
                  <Input
                    type="number"
                    value={settings?.min_qualifying_play_seconds || 45}
                    onChange={(e) => handleChange("min_qualifying_play_seconds", parseInt(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    data-testid="min-play-seconds-input"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Streams shorter than this don&apos;t count for revenue</p>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Max Payable Hours/User/Hour</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings?.max_payable_hours_per_user_per_hour || 1}
                    onChange={(e) => handleChange("max_payable_hours_per_user_per_hour", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Max Payable Hours/User/Day</label>
                  <Input
                    type="number"
                    value={settings?.max_payable_hours_per_user_per_day || 24}
                    onChange={(e) => handleChange("max_payable_hours_per_user_per_day", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Ignore Muted/Background Playback</span>
                  <Switch checked={settings?.ignore_muted_playback} onCheckedChange={() => handleToggle("ignore_muted_playback")} />
                </div>
              </CardContent>
            </Card>

            {/* Rate Change History */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Rate Change History</CardTitle>
              </CardHeader>
              <CardContent>
                {rateHistory.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {rateHistory.map((change) => (
                      <div key={change.change_id} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded text-sm">
                        <div>
                          <span className="text-zinc-400">{change.change_type.replace("_", " ")}</span>
                          <span className="text-white ml-2">{change.old_value} → {change.new_value}</span>
                        </div>
                        <span className="text-zinc-500 text-xs">{change.effective_date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-center py-4">No rate changes recorded</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payouts Tab */}
        <TabsContent value="payouts" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payout Settings */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <CreditCard size={18} className="text-emerald-400" /> Payout Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Minimum Payout (TZS)</label>
                  <Input
                    type="number"
                    value={settings?.minimum_payout_threshold || 10000}
                    onChange={(e) => handleChange("minimum_payout_threshold", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    data-testid="min-payout-input"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Payout Frequency</label>
                  <Select value={settings?.payout_frequency || "monthly"} onValueChange={(v) => handleChange("payout_frequency", v)}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Payout Cut-off Day</label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={settings?.payout_cutoff_day || 25}
                    onChange={(e) => handleChange("payout_cutoff_day", parseInt(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Payout Fee Handling</label>
                  <Select value={settings?.payout_fee_handling || "platform_pays"} onValueChange={(v) => handleChange("payout_fee_handling", v)}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="platform_pays">Platform Pays</SelectItem>
                      <SelectItem value="choir_pays">Choir Pays</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Payout Methods */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <CreditCard size={18} className="text-violet-400" /> Payout Methods
                </CardTitle>
                <CardDescription className="text-zinc-500">Enable/disable payment methods for choir payouts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-bold text-xs">M</div>
                    <div>
                      <p className="text-white font-medium">Mobile Money</p>
                      <p className="text-xs text-zinc-500">M-Pesa, Airtel, Tigo</p>
                    </div>
                  </div>
                  <Switch checked={settings?.payout_mobile_money_enabled} onCheckedChange={() => handleToggle("payout_mobile_money_enabled")} />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-violet-600/20 flex items-center justify-center text-violet-400 font-bold text-xs">B</div>
                    <div>
                      <p className="text-white font-medium">Bank Transfer</p>
                      <p className="text-xs text-zinc-500">Direct bank deposits</p>
                    </div>
                  </div>
                  <Switch checked={settings?.payout_bank_transfer_enabled} onCheckedChange={() => handleToggle("payout_bank_transfer_enabled")} />
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-xs">P</div>
                    <div>
                      <p className="text-white font-medium">PayPal</p>
                      <p className="text-xs text-zinc-500">International payments</p>
                    </div>
                  </div>
                  <Switch checked={settings?.payout_paypal_enabled} onCheckedChange={() => handleToggle("payout_paypal_enabled")} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tax & Compliance Tab */}
        <TabsContent value="tax" className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <FileText size={18} className="text-amber-400" /> Tax & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">VAT / Digital Tax (%)</label>
                  <Input
                    type="number"
                    value={settings?.vat_percentage || 18}
                    onChange={(e) => handleChange("vat_percentage", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Withholding Tax (%)</label>
                  <Input
                    type="number"
                    value={settings?.withholding_tax_percentage || 5}
                    onChange={(e) => handleChange("withholding_tax_percentage", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="flex items-center justify-between pt-6">
                  <span className="text-sm text-zinc-400">Tax Invoice Generation</span>
                  <Switch checked={settings?.tax_invoice_generation_enabled} onCheckedChange={() => handleToggle("tax_invoice_generation_enabled")} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Safety Tab */}
        <TabsContent value="safety" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Alerts */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Bell size={18} className="text-amber-400" /> Alerts & Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Revenue Drop Alert Threshold (%)</label>
                  <Input
                    type="number"
                    value={settings?.revenue_drop_alert_threshold || 20}
                    onChange={(e) => handleChange("revenue_drop_alert_threshold", parseFloat(e.target.value))}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Unusual Listening Spike Alert</span>
                  <Switch checked={settings?.unusual_spike_alert_enabled} onCheckedChange={() => handleToggle("unusual_spike_alert_enabled")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Failed Payout Alert</span>
                  <Switch checked={settings?.failed_payout_alert_enabled} onCheckedChange={() => handleToggle("failed_payout_alert_enabled")} />
                </div>
              </CardContent>
            </Card>

            {/* Emergency Controls */}
            <Card className="bg-zinc-900/50 border-zinc-800 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Shield size={18} className="text-red-400" /> Emergency Controls
                </CardTitle>
                <CardDescription className="text-zinc-500">Use with caution - affects all transactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Pause All Payouts</p>
                    <p className="text-xs text-zinc-500">Stop all choir withdrawals</p>
                  </div>
                  {settings?.all_payouts_paused ? (
                    <Button size="sm" onClick={handleResumePayouts} className="bg-emerald-600 hover:bg-emerald-700">
                      <Play size={14} className="mr-1" /> Resume
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handlePausePayouts} variant="outline" className="border-red-600 text-red-400 hover:bg-red-600/20">
                      <Pause size={14} className="mr-1" /> Pause
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Freeze All Choir Monetization</span>
                  <Switch checked={settings?.choir_monetization_frozen} onCheckedChange={() => handleToggle("choir_monetization_frozen")} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Emergency Rate Rollback</span>
                  <Switch checked={settings?.emergency_rate_rollback_enabled} onCheckedChange={() => handleToggle("emergency_rate_rollback_enabled")} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Plan Modal */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Add Subscription Plan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePlan}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Plan Name (ID)</label>
                  <Input
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="e.g., monthly"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Display Name</label>
                  <Input
                    value={planForm.display_name}
                    onChange={(e) => setPlanForm({ ...planForm, display_name: e.target.value })}
                    placeholder="e.g., Monthly Premium"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Price (TZS)</label>
                  <Input
                    type="number"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Duration (days)</label>
                  <Input
                    type="number"
                    value={planForm.duration_days}
                    onChange={(e) => setPlanForm({ ...planForm, duration_days: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Features (comma-separated)</label>
                <Input
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                  placeholder="Unlimited streaming, Ad-free, Offline downloads"
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={planForm.is_active} onCheckedChange={(v) => setPlanForm({ ...planForm, is_active: v })} />
                <span className="text-sm text-zinc-400">Active</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPlanModalOpen(false)} className="border-zinc-700">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                {editingPlan ? "Update" : "Create"} Plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
