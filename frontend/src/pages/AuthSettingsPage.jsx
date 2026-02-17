import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Shield, Mail, Phone, Chrome, User, Lock, Save, RefreshCw,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle, Settings
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function AuthSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    email_password_enabled: true,
    google_enabled: true,
    phone_enabled: false,
    guest_access_enabled: true,
    registration_enabled: true,
    require_email_verification: false,
    require_phone_verification: false,
    max_login_attempts: 5,
    lockout_duration_minutes: 15,
    password_min_length: 6
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/auth-settings`, { withCredentials: true });
      setSettings(response.data);
    } catch (error) {
      console.error("Error fetching auth settings:", error);
      toast.error("Failed to load authentication settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await axios.put(`${API}/admin/auth-settings`, settings, { withCredentials: true });
      if (response.data.success) {
        toast.success("Authentication settings saved successfully");
        setSettings(response.data.settings);
      }
    } catch (error) {
      console.error("Error saving auth settings:", error);
      toast.error("Failed to save authentication settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateNumericSetting = (key, value) => {
    const num = parseInt(value) || 0;
    setSettings(prev => ({ ...prev, [key]: num }));
  };

  // Toggle Switch Component
  const ToggleSwitch = ({ enabled, onToggle, label, description, icon: Icon, color = "violet" }) => (
    <div className="flex items-start justify-between p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 hover:border-zinc-600 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${enabled ? `bg-${color}-500/20` : 'bg-zinc-700/50'}`}>
          <Icon size={20} className={enabled ? `text-${color}-400` : 'text-zinc-500'} />
        </div>
        <div>
          <h3 className="font-medium text-white">{label}</h3>
          <p className="text-sm text-zinc-400 mt-0.5">{description}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`p-1 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}
      >
        {enabled ? (
          <ToggleRight size={28} className="text-white" />
        ) : (
          <ToggleLeft size={28} className="text-zinc-400" />
        )}
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6" data-testid="auth-settings-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-500/20 rounded-xl">
            <Shield size={28} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Authentication Settings</h1>
            <p className="text-zinc-400">Configure login and registration methods</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          data-testid="save-auth-settings-btn"
        >
          {saving ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          Save Changes
        </button>
      </div>

      {/* Login Methods Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Lock size={20} className="text-violet-400" />
          Login Methods
        </h2>
        <div className="space-y-3">
          <ToggleSwitch
            enabled={settings.email_password_enabled}
            onToggle={() => toggleSetting('email_password_enabled')}
            label="Email & Password"
            description="Allow users to login with their email address and password"
            icon={Mail}
            color="blue"
          />
          
          <ToggleSwitch
            enabled={settings.google_enabled}
            onToggle={() => toggleSetting('google_enabled')}
            label="Google Sign-In"
            description="Allow users to login with their Google account"
            icon={Chrome}
            color="red"
          />
          
          <ToggleSwitch
            enabled={settings.phone_enabled}
            onToggle={() => toggleSetting('phone_enabled')}
            label="Phone Number"
            description="Allow users to login with their phone number (requires SMS setup)"
            icon={Phone}
            color="green"
          />
          
          <ToggleSwitch
            enabled={settings.guest_access_enabled}
            onToggle={() => toggleSetting('guest_access_enabled')}
            label="Guest Access"
            description="Allow users to browse content without logging in (limited features)"
            icon={User}
            color="amber"
          />
        </div>
      </div>

      {/* Registration Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings size={20} className="text-violet-400" />
          Registration Settings
        </h2>
        <div className="space-y-3">
          <ToggleSwitch
            enabled={settings.registration_enabled}
            onToggle={() => toggleSetting('registration_enabled')}
            label="New Registrations"
            description="Allow new users to create accounts"
            icon={CheckCircle}
            color="emerald"
          />
          
          <ToggleSwitch
            enabled={settings.require_email_verification}
            onToggle={() => toggleSetting('require_email_verification')}
            label="Require Email Verification"
            description="Users must verify their email before accessing the app"
            icon={Mail}
            color="cyan"
          />
          
          <ToggleSwitch
            enabled={settings.require_phone_verification}
            onToggle={() => toggleSetting('require_phone_verification')}
            label="Require Phone Verification"
            description="Users must verify their phone number via SMS"
            icon={Phone}
            color="teal"
          />
        </div>
      </div>

      {/* Security Settings Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-violet-400" />
          Security Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Minimum Password Length
            </label>
            <input
              type="number"
              min="4"
              max="20"
              value={settings.password_min_length}
              onChange={(e) => updateNumericSetting('password_min_length', e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-500 mt-1">Characters required</p>
          </div>
          
          <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Max Login Attempts
            </label>
            <input
              type="number"
              min="3"
              max="10"
              value={settings.max_login_attempts}
              onChange={(e) => updateNumericSetting('max_login_attempts', e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-500 mt-1">Before lockout</p>
          </div>
          
          <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Lockout Duration
            </label>
            <input
              type="number"
              min="5"
              max="60"
              value={settings.lockout_duration_minutes}
              onChange={(e) => updateNumericSetting('lockout_duration_minutes', e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-500 mt-1">Minutes</p>
          </div>
        </div>
      </div>

      {/* Status Preview */}
      <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Active Login Methods Preview</h3>
        <div className="flex flex-wrap gap-2">
          {settings.email_password_enabled && (
            <span className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm flex items-center gap-1.5">
              <Mail size={14} /> Email/Password
            </span>
          )}
          {settings.google_enabled && (
            <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full text-sm flex items-center gap-1.5">
              <Chrome size={14} /> Google
            </span>
          )}
          {settings.phone_enabled && (
            <span className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-1.5">
              <Phone size={14} /> Phone
            </span>
          )}
          {settings.guest_access_enabled && (
            <span className="px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-sm flex items-center gap-1.5">
              <User size={14} /> Guest
            </span>
          )}
          {!settings.email_password_enabled && !settings.google_enabled && !settings.phone_enabled && (
            <span className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-full text-sm flex items-center gap-1.5">
              <AlertCircle size={14} /> No login methods enabled!
            </span>
          )}
        </div>
      </div>

      {/* Warning if all disabled */}
      {!settings.email_password_enabled && !settings.google_enabled && !settings.phone_enabled && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h4 className="font-medium text-red-400">Warning: No Login Methods Enabled</h4>
            <p className="text-sm text-zinc-400 mt-1">
              Users won't be able to login to the app. Please enable at least one login method.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
