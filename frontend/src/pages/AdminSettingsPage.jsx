import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Settings, Smartphone, CreditCard, Key, Shield, Save, RefreshCw,
  CheckCircle, XCircle, Users, Crown, Mail, Phone, Globe, AlertTriangle,
  Lock, Eye, EyeOff, Database, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEFAULT_SETTINGS = {
  billing_enabled: true,
  free_user_daily_song_limit: 10,
  free_user_max_devices: 1,
  premium_user_max_devices: 3,
  login_methods: {
    email_password: true,
    phone_otp: true,
    google: true
  },
  play_count_replay_limit: 2,
  min_play_duration_seconds: 30
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("billing");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/admin/settings`, { withCredentials: true });
      setSettings({ ...DEFAULT_SETTINGS, ...res.data });
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/settings`, settings, { withCredentials: true });
      toast.success("Settings saved successfully");
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateLoginMethod = (method, enabled) => {
    setSettings(prev => ({
      ...prev,
      login_methods: { ...prev.login_methods, [method]: enabled }
    }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-settings-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="text-violet-500" size={28} />
            App Settings
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Manage billing, device limits, and login methods</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchSettings}
            className="border-zinc-700 hover:bg-zinc-800"
          >
            <RefreshCw size={18} className="mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="save-settings-btn"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500" />
          <span className="text-amber-400 text-sm">You have unsaved changes</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-800/50 p-1">
          <TabsTrigger value="billing" className="data-[state=active]:bg-violet-600">
            <CreditCard size={16} className="mr-2" />
            Billing & Plans
          </TabsTrigger>
          <TabsTrigger value="devices" className="data-[state=active]:bg-violet-600">
            <Smartphone size={16} className="mr-2" />
            Device Limits
          </TabsTrigger>
          <TabsTrigger value="login" className="data-[state=active]:bg-violet-600">
            <Key size={16} className="mr-2" />
            Login Methods
          </TabsTrigger>
          <TabsTrigger value="playback" className="data-[state=active]:bg-violet-600">
            <Shield size={16} className="mr-2" />
            Playback Rules
          </TabsTrigger>
        </TabsList>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6 mt-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <CreditCard className="text-emerald-500" size={22} />
                Billing Status
              </CardTitle>
              <CardDescription>Enable or disable billing for the entire platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${settings.billing_enabled ? 'bg-emerald-500/20' : 'bg-zinc-700'}`}>
                    {settings.billing_enabled ? (
                      <CheckCircle size={24} className="text-emerald-500" />
                    ) : (
                      <XCircle size={24} className="text-zinc-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">Billing Enabled</p>
                    <p className="text-sm text-zinc-400">
                      {settings.billing_enabled 
                        ? "Users can purchase subscriptions and premium content" 
                        : "All premium features are FREE for all users"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.billing_enabled}
                  onCheckedChange={(checked) => updateSetting("billing_enabled", checked)}
                  data-testid="billing-toggle"
                />
              </div>

              {!settings.billing_enabled && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-400">Premium for All Mode</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        With billing disabled, all users get premium features for free. This includes:
                      </p>
                      <ul className="text-sm text-zinc-400 mt-2 space-y-1 list-disc list-inside">
                        <li>Unlimited song access</li>
                        <li>Unlimited downloads</li>
                        <li>No ads</li>
                        <li>Background playback</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Device Limits Tab */}
        <TabsContent value="devices" className="space-y-6 mt-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Smartphone className="text-blue-500" size={22} />
                Device Limits
              </CardTitle>
              <CardDescription>Control how many devices can be logged in simultaneously</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Free Users */}
              <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-zinc-400" />
                  <div>
                    <p className="font-semibold">Free Users</p>
                    <p className="text-sm text-zinc-400">Maximum devices for free tier users</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.free_user_max_devices}
                    onChange={(e) => updateSetting("free_user_max_devices", parseInt(e.target.value) || 1)}
                    className="w-24 bg-zinc-900 border-zinc-700"
                    data-testid="free-device-limit"
                  />
                  <span className="text-zinc-400 text-sm">device(s)</span>
                </div>
              </div>

              {/* Premium Users */}
              <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
                <div className="flex items-center gap-3">
                  <Crown size={20} className="text-amber-500" />
                  <div>
                    <p className="font-semibold">Premium Users</p>
                    <p className="text-sm text-zinc-400">Maximum devices for premium subscribers</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.premium_user_max_devices}
                    onChange={(e) => updateSetting("premium_user_max_devices", parseInt(e.target.value) || 3)}
                    className="w-24 bg-zinc-900 border-zinc-700"
                    data-testid="premium-device-limit"
                  />
                  <span className="text-zinc-400 text-sm">device(s)</span>
                </div>
              </div>

              {/* Daily Song Limit for Free Users */}
              <Separator className="bg-zinc-800" />
              
              <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-zinc-400" />
                  <div>
                    <p className="font-semibold">Daily Song Limit (Free Users)</p>
                    <p className="text-sm text-zinc-400">Maximum songs free users can play per day</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.free_user_daily_song_limit}
                    onChange={(e) => updateSetting("free_user_daily_song_limit", parseInt(e.target.value) || 10)}
                    className="w-24 bg-zinc-900 border-zinc-700"
                    data-testid="daily-song-limit"
                  />
                  <span className="text-zinc-400 text-sm">songs/day</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login Methods Tab */}
        <TabsContent value="login" className="space-y-6 mt-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Key className="text-violet-500" size={22} />
                Login Methods
              </CardTitle>
              <CardDescription>Enable or disable authentication methods for the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email/Password */}
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Mail size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="font-semibold">Email & Password</p>
                    <p className="text-sm text-zinc-400">Traditional email and password login</p>
                  </div>
                </div>
                <Switch
                  checked={settings.login_methods?.email_password ?? true}
                  onCheckedChange={(checked) => updateLoginMethod("email_password", checked)}
                  data-testid="email-login-toggle"
                />
              </div>

              {/* Phone OTP */}
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Phone size={20} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-semibold">Phone OTP</p>
                    <p className="text-sm text-zinc-400">SMS one-time password authentication</p>
                  </div>
                  <Badge variant="outline" className="border-amber-500/50 text-amber-500 text-xs">
                    MOCKED
                  </Badge>
                </div>
                <Switch
                  checked={settings.login_methods?.phone_otp ?? true}
                  onCheckedChange={(checked) => updateLoginMethod("phone_otp", checked)}
                  data-testid="phone-otp-toggle"
                />
              </div>

              {/* Google OAuth */}
              <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Globe size={20} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-semibold">Google Sign-In</p>
                    <p className="text-sm text-zinc-400">OAuth2 authentication with Google</p>
                  </div>
                </div>
                <Switch
                  checked={settings.login_methods?.google ?? true}
                  onCheckedChange={(checked) => updateLoginMethod("google", checked)}
                  data-testid="google-login-toggle"
                />
              </div>

              {/* Warning if all methods disabled */}
              {!settings.login_methods?.email_password && 
               !settings.login_methods?.phone_otp && 
               !settings.login_methods?.google && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={20} className="text-red-500" />
                    <p className="text-red-400 text-sm">
                      Warning: All login methods are disabled. Users will not be able to sign in!
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Playback Rules Tab */}
        <TabsContent value="playback" className="space-y-6 mt-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Shield className="text-amber-500" size={22} />
                Play Count Rules
              </CardTitle>
              <CardDescription>Configure rules for tracking plays and preventing abuse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Replay Limit */}
              <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
                <div>
                  <p className="font-semibold">Replay Limit Per Song</p>
                  <p className="text-sm text-zinc-400">Maximum times a song counts for revenue when replayed by same user (per day)</p>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.play_count_replay_limit}
                    onChange={(e) => updateSetting("play_count_replay_limit", parseInt(e.target.value) || 2)}
                    className="w-24 bg-zinc-900 border-zinc-700"
                    data-testid="replay-limit"
                  />
                  <span className="text-zinc-400 text-sm">times/day</span>
                </div>
                <p className="text-xs text-zinc-500">
                  After {settings.play_count_replay_limit} plays, additional replays of the same song will not count towards artist revenue
                </p>
              </div>

              {/* Minimum Play Duration */}
              <div className="p-4 bg-zinc-800/50 rounded-lg space-y-4">
                <div>
                  <p className="font-semibold">Minimum Play Duration</p>
                  <p className="text-sm text-zinc-400">Minimum seconds a song must play to count as a stream</p>
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="10"
                    max="120"
                    value={settings.min_play_duration_seconds}
                    onChange={(e) => updateSetting("min_play_duration_seconds", parseInt(e.target.value) || 30)}
                    className="w-24 bg-zinc-900 border-zinc-700"
                    data-testid="min-duration"
                  />
                  <span className="text-zinc-400 text-sm">seconds</span>
                </div>
                <p className="text-xs text-zinc-500">
                  Songs skipped before {settings.min_play_duration_seconds} seconds will not count as streams
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
