import { useState, useEffect } from "react";
import axios from "axios";
import {
  Settings, Globe, CreditCard, Palette, PlayCircle, Bell, Shield, Wifi,
  BarChart3, Share2, FileText, Upload, Save, Plus, Trash2, X, Check,
  MapPin, Lock, Unlock, Eye, EyeOff, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// All available countries for geo-locking
const ALL_COUNTRIES = [
  { code: "TZ", name: "Tanzania" },
  { code: "KE", name: "Kenya" },
  { code: "UG", name: "Uganda" },
  { code: "RW", name: "Rwanda" },
  { code: "BI", name: "Burundi" },
  { code: "CD", name: "DR Congo" },
  { code: "ZM", name: "Zambia" },
  { code: "MW", name: "Malawi" },
  { code: "MZ", name: "Mozambique" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "ET", name: "Ethiopia" },
  { code: "SS", name: "South Sudan" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "KR", name: "South Korea" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
];

const CURRENCIES = [
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
];

const LANGUAGES = [
  { code: "sw", name: "Kiswahili" },
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
];

const SIDEBAR_ITEMS = [
  { id: "branding", label: "Branding", icon: Palette },
  { id: "language", label: "Language & Currency", icon: Globe },
  { id: "geolocking", label: "Geo-Locking", icon: MapPin },
  { id: "payments", label: "Payment Gateways", icon: CreditCard },
  { id: "themes", label: "Themes & Appearance", icon: Palette },
  { id: "content", label: "Content Settings", icon: PlayCircle },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "streaming", label: "Streaming", icon: Wifi },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "social", label: "Social Media", icon: Share2 },
  { id: "legal", label: "Legal & Compliance", icon: FileText },
];

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState("branding");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    // Branding
    appName: "Gracefy",
    tagline: "Christian Music Streaming",
    logoLight: "",
    logoDark: "",
    favicon: "",
    primaryColor: "#3498DB",
    secondaryColor: "#1A295E",
    
    // Language & Currency
    defaultLanguage: "sw",
    supportedLanguages: ["sw", "en"],
    defaultCurrency: "TZS",
    supportedCurrencies: ["TZS", "KES", "USD"],
    
    // Geo-locking
    geoLockingEnabled: false,
    geoLockMode: "whitelist", // whitelist or blacklist
    allowedCountries: ["TZ", "KE", "UG"],
    blockedCountries: [],
    geoLockMessage: "This service is not available in your region.",
    bypassGeoLockForPremium: false,
    
    // Payment Gateways
    stripeEnabled: false,
    stripePublicKey: "",
    stripeSecretKey: "",
    mpesaEnabled: true,
    mpesaConsumerKey: "",
    mpesaConsumerSecret: "",
    paypalEnabled: false,
    paypalClientId: "",
    paypalSecret: "",
    
    // Content Settings
    maxFreeStreamsPerDay: 5,
    maxFreeSongsPerDay: 10,
    freeUserSkipLimit: 6,
    previewDuration: 30,
    enableExplicitContent: false,
    requireAgeVerification: false,
    
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    newReleaseAlerts: true,
    promotionalEmails: false,
    
    // Security
    requireEmailVerification: true,
    twoFactorEnabled: false,
    maxLoginAttempts: 5,
    sessionTimeout: 30, // days
    passwordMinLength: 8,
    
    // Streaming
    defaultQuality: "high",
    allowOfflineDownload: true,
    maxOfflineSongs: 100,
    streamingBitrate: 320,
    
    // Analytics
    googleAnalyticsId: "",
    facebookPixelId: "",
    enableUserTracking: true,
    
    // Social Media
    facebookUrl: "",
    twitterUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
    tiktokUrl: "",
    
    // Legal
    termsOfServiceUrl: "",
    privacyPolicyUrl: "",
    copyrightNotice: "© 2026 Gracefy. All rights reserved.",
    dmcaContact: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/system-settings`);
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.log("Using default settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/admin/system-settings`, settings);
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleCountry = (code, list) => {
    const currentList = settings[list];
    if (currentList.includes(code)) {
      updateSetting(list, currentList.filter(c => c !== code));
    } else {
      updateSetting(list, [...currentList, code]);
    }
  };

  const renderBranding = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-400" />
            App Branding
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">App Name</label>
              <Input
                value={settings.appName}
                onChange={(e) => updateSetting("appName", e.target.value)}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Tagline</label>
              <Input
                value={settings.tagline}
                onChange={(e) => updateSetting("tagline", e.target.value)}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Logo (Light Mode)</label>
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer">
                <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <span className="text-slate-500 text-sm">Upload logo</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Logo (Dark Mode)</label>
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer">
                <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <span className="text-slate-500 text-sm">Upload logo</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Favicon</label>
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer">
                <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <span className="text-slate-500 text-sm">Upload favicon</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Primary Color</label>
              <div className="flex gap-2">
                <div 
                  className="w-12 h-10 rounded border border-slate-600"
                  style={{ backgroundColor: settings.primaryColor }}
                />
                <Input
                  value={settings.primaryColor}
                  onChange={(e) => updateSetting("primaryColor", e.target.value)}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Secondary Color</label>
              <div className="flex gap-2">
                <div 
                  className="w-12 h-10 rounded border border-slate-600"
                  style={{ backgroundColor: settings.secondaryColor }}
                />
                <Input
                  value={settings.secondaryColor}
                  onChange={(e) => updateSetting("secondaryColor", e.target.value)}
                  className="bg-slate-800 border-slate-600"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLanguageCurrency = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Language Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Default Language</label>
              <Select 
                value={settings.defaultLanguage} 
                onValueChange={(v) => updateSetting("defaultLanguage", v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Supported Languages</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(lang => (
                  <Badge
                    key={lang.code}
                    variant={settings.supportedLanguages.includes(lang.code) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const current = settings.supportedLanguages;
                      if (current.includes(lang.code)) {
                        updateSetting("supportedLanguages", current.filter(l => l !== lang.code));
                      } else {
                        updateSetting("supportedLanguages", [...current, lang.code]);
                      }
                    }}
                  >
                    {lang.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Translation Management Card */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" />
            Translation Management
          </CardTitle>
          <CardDescription>
            Download, edit and upload translations for all supported languages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Download Section */}
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Download Translation Template</h4>
            <p className="text-xs text-slate-400 mb-3">
              Download an Excel file containing all translatable text. Edit the translations and upload it back.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-violet-500 text-violet-400 hover:bg-violet-500/10"
                onClick={async () => {
                  try {
                    const response = await axios.get(`${API}/admin/translations/download`, {
                      responseType: 'blob',
                      withCredentials: true
                    });
                    
                    // Create blob URL and trigger download
                    const blob = new Blob([response.data], { 
                      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                    });
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', 'gracefy_translations.xlsx');
                    document.body.appendChild(link);
                    link.click();
                    
                    // Cleanup
                    setTimeout(() => {
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    }, 100);
                    
                    toast.success("Translation file downloaded!");
                  } catch (e) {
                    console.error("Download error:", e);
                    toast.error(e.response?.data?.detail || "Failed to download translations");
                  }
                }}
              >
                <Upload className="w-4 h-4 mr-2 rotate-180" />
                Download Excel Template
              </Button>
              
              {/* Direct download link as fallback */}
              <a
                href={`${API}/admin/translations/download`}
                download="gracefy_translations.xlsx"
                className="inline-flex items-center px-4 py-2 rounded-md border border-zinc-600 text-zinc-400 hover:bg-zinc-700 text-sm"
              >
                Direct Link
              </a>
            </div>
          </div>

          {/* Upload Section */}
          <div className="bg-slate-800/50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Upload Translated File</h4>
            <p className="text-xs text-slate-400 mb-3">
              Upload the edited Excel file to update translations. Changes will reflect immediately on user apps.
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="file"
                id="translation-upload"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  // Show uploading state
                  const uploadBtn = document.getElementById('upload-btn');
                  const uploadStatus = document.getElementById('upload-status');
                  if (uploadBtn) uploadBtn.disabled = true;
                  if (uploadStatus) {
                    uploadStatus.textContent = 'Uploading...';
                    uploadStatus.className = 'text-sm text-yellow-400 mt-2';
                  }
                  
                  const formData = new FormData();
                  formData.append('file', file);
                  
                  try {
                    const response = await axios.post(`${API}/admin/translations/upload`, formData, {
                      withCredentials: true,
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    
                    // Show success
                    const langCount = response.data.languages_updated?.length || 0;
                    const keyCount = response.data.total_keys || 0;
                    toast.success(`✓ Translations uploaded successfully!`);
                    
                    if (uploadStatus) {
                      uploadStatus.innerHTML = `<span class="text-emerald-400">✓ Success!</span> Updated ${langCount} language(s) with ${keyCount} translation keys.`;
                      uploadStatus.className = 'text-sm mt-2';
                    }
                    
                    e.target.value = '';
                  } catch (err) {
                    console.error("Upload error:", err);
                    const errorMsg = err.response?.data?.detail || "Failed to upload translations";
                    toast.error(errorMsg);
                    
                    if (uploadStatus) {
                      uploadStatus.innerHTML = `<span class="text-red-400">✗ Error:</span> ${errorMsg}`;
                      uploadStatus.className = 'text-sm mt-2';
                    }
                    
                    e.target.value = '';
                  } finally {
                    if (uploadBtn) uploadBtn.disabled = false;
                  }
                }}
              />
              <div className="flex items-center gap-3">
                <Button
                  id="upload-btn"
                  variant="outline"
                  className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => document.getElementById('translation-upload')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Translated Excel
                </Button>
                <span className="text-xs text-slate-500">(.xlsx or .xls files)</span>
              </div>
              <div id="upload-status" className="text-sm text-slate-400 mt-1"></div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2">How to Translate:</h4>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Download the Excel template above</li>
              <li>Open it in Excel or Google Sheets</li>
              <li>Edit the translations in the &quot;swahili&quot; column (or add new language columns)</li>
              <li>Keep the &quot;key&quot; column unchanged</li>
              <li>Save and upload the file</li>
              <li>Translations will automatically update on user apps</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            Currency Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Default Currency</label>
              <Select 
                value={settings.defaultCurrency} 
                onValueChange={(v) => updateSetting("defaultCurrency", v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(curr => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.name} ({curr.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Supported Currencies</label>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map(curr => (
                  <Badge
                    key={curr.code}
                    variant={settings.supportedCurrencies.includes(curr.code) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const current = settings.supportedCurrencies;
                      if (current.includes(curr.code)) {
                        updateSetting("supportedCurrencies", current.filter(c => c !== curr.code));
                      } else {
                        updateSetting("supportedCurrencies", [...current, curr.code]);
                      }
                    }}
                  >
                    {curr.symbol} {curr.code}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderGeoLocking = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-400" />
            Geo-Locking Configuration
          </CardTitle>
          <CardDescription>
            Automatically detect user IP and restrict access based on geographic location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div>
              <h4 className="font-medium">Enable Geo-Locking</h4>
              <p className="text-sm text-slate-400">Restrict app access based on user location</p>
            </div>
            <Switch
              checked={settings.geoLockingEnabled}
              onCheckedChange={(v) => updateSetting("geoLockingEnabled", v)}
            />
          </div>

          {settings.geoLockingEnabled && (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Lock Mode</label>
                  <Select 
                    value={settings.geoLockMode} 
                    onValueChange={(v) => updateSetting("geoLockMode", v)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whitelist">
                        <div className="flex items-center gap-2">
                          <Unlock className="w-4 h-4 text-green-400" />
                          Whitelist (Allow only selected countries)
                        </div>
                      </SelectItem>
                      <SelectItem value="blacklist">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-red-400" />
                          Blacklist (Block selected countries)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-slate-400 mb-2 block">Bypass for Premium Users</label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings.bypassGeoLockForPremium}
                        onCheckedChange={(v) => updateSetting("bypassGeoLockForPremium", v)}
                      />
                      <span className="text-sm text-slate-400">
                        Premium users can access from anywhere
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">
                  Geo-Lock Message (shown to blocked users)
                </label>
                <Textarea
                  value={settings.geoLockMessage}
                  onChange={(e) => updateSetting("geoLockMessage", e.target.value)}
                  className="bg-slate-800 border-slate-600"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-3 block flex items-center gap-2">
                  {settings.geoLockMode === "whitelist" ? (
                    <>
                      <Unlock className="w-4 h-4 text-green-400" />
                      Allowed Countries (users from these countries can access)
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-red-400" />
                      Blocked Countries (users from these countries are blocked)
                    </>
                  )}
                </label>
                <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto p-4 bg-slate-800 rounded-lg">
                  {ALL_COUNTRIES.map(country => {
                    const list = settings.geoLockMode === "whitelist" ? "allowedCountries" : "blockedCountries";
                    const isSelected = settings[list].includes(country.code);
                    return (
                      <div
                        key={country.code}
                        onClick={() => toggleCountry(country.code, list)}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${
                          isSelected 
                            ? settings.geoLockMode === "whitelist"
                              ? "bg-green-500/20 border border-green-500/50"
                              : "bg-red-500/20 border border-red-500/50"
                            : "bg-slate-700 hover:bg-slate-600"
                        }`}
                      >
                        <span className="text-lg">{getCountryFlag(country.code)}</span>
                        <span className="text-sm">{country.name}</span>
                        {isSelected && (
                          <Check className={`w-4 h-4 ml-auto ${
                            settings.geoLockMode === "whitelist" ? "text-green-400" : "text-red-400"
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const list = settings.geoLockMode === "whitelist" ? "allowedCountries" : "blockedCountries";
                      updateSetting(list, ALL_COUNTRIES.map(c => c.code));
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const list = settings.geoLockMode === "whitelist" ? "allowedCountries" : "blockedCountries";
                      updateSetting(list, []);
                    }}
                  >
                    Clear All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const list = settings.geoLockMode === "whitelist" ? "allowedCountries" : "blockedCountries";
                      // East Africa preset
                      updateSetting(list, ["TZ", "KE", "UG", "RW", "BI", "SS"]);
                    }}
                  >
                    East Africa Only
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-400">Important Note</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Geo-locking uses IP-based detection which can be bypassed using VPNs. 
                      For stronger restrictions, consider implementing additional verification methods.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-400" />
            Payment Gateways
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* M-Pesa */}
          <div className="p-4 bg-slate-800 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">M</div>
                <div>
                  <h4 className="font-medium">M-Pesa</h4>
                  <p className="text-sm text-slate-400">Mobile money payments</p>
                </div>
              </div>
              <Switch
                checked={settings.mpesaEnabled}
                onCheckedChange={(v) => updateSetting("mpesaEnabled", v)}
              />
            </div>
            {settings.mpesaEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                <Input
                  placeholder="Consumer Key"
                  value={settings.mpesaConsumerKey}
                  onChange={(e) => updateSetting("mpesaConsumerKey", e.target.value)}
                  className="bg-slate-900 border-slate-600"
                />
                <Input
                  type="password"
                  placeholder="Consumer Secret"
                  value={settings.mpesaConsumerSecret}
                  onChange={(e) => updateSetting("mpesaConsumerSecret", e.target.value)}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
            )}
          </div>

          {/* Stripe */}
          <div className="p-4 bg-slate-800 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">S</div>
                <div>
                  <h4 className="font-medium">Stripe</h4>
                  <p className="text-sm text-slate-400">Card & international payments</p>
                </div>
              </div>
              <Switch
                checked={settings.stripeEnabled}
                onCheckedChange={(v) => updateSetting("stripeEnabled", v)}
              />
            </div>
            {settings.stripeEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                <Input
                  placeholder="Publishable Key"
                  value={settings.stripePublicKey}
                  onChange={(e) => updateSetting("stripePublicKey", e.target.value)}
                  className="bg-slate-900 border-slate-600"
                />
                <Input
                  type="password"
                  placeholder="Secret Key"
                  value={settings.stripeSecretKey}
                  onChange={(e) => updateSetting("stripeSecretKey", e.target.value)}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
            )}
          </div>

          {/* PayPal */}
          <div className="p-4 bg-slate-800 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
                <div>
                  <h4 className="font-medium">PayPal</h4>
                  <p className="text-sm text-slate-400">PayPal & card payments</p>
                </div>
              </div>
              <Switch
                checked={settings.paypalEnabled}
                onCheckedChange={(v) => updateSetting("paypalEnabled", v)}
              />
            </div>
            {settings.paypalEnabled && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                <Input
                  placeholder="Client ID"
                  value={settings.paypalClientId}
                  onChange={(e) => updateSetting("paypalClientId", e.target.value)}
                  className="bg-slate-900 border-slate-600"
                />
                <Input
                  type="password"
                  placeholder="Secret"
                  value={settings.paypalSecret}
                  onChange={(e) => updateSetting("paypalSecret", e.target.value)}
                  className="bg-slate-900 border-slate-600"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContentSettings = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-blue-400" />
            Content & Streaming Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Free User - Max Streams/Day</label>
              <Input
                type="number"
                value={settings.maxFreeStreamsPerDay}
                onChange={(e) => updateSetting("maxFreeStreamsPerDay", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Free User - Max Songs/Day</label>
              <Input
                type="number"
                value={settings.maxFreeSongsPerDay}
                onChange={(e) => updateSetting("maxFreeSongsPerDay", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Free User - Skip Limit/Hour</label>
              <Input
                type="number"
                value={settings.freeUserSkipLimit}
                onChange={(e) => updateSetting("freeUserSkipLimit", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Preview Duration (seconds)</label>
              <Input
                type="number"
                value={settings.previewDuration}
                onChange={(e) => updateSetting("previewDuration", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Enable Explicit Content</h4>
                <p className="text-sm text-slate-400">Allow songs marked as explicit</p>
              </div>
              <Switch
                checked={settings.enableExplicitContent}
                onCheckedChange={(v) => updateSetting("enableExplicitContent", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Age Verification Required</h4>
                <p className="text-sm text-slate-400">Require age verification for mature content</p>
              </div>
              <Switch
                checked={settings.requireAgeVerification}
                onCheckedChange={(v) => updateSetting("requireAgeVerification", v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div>
                <h4 className="font-medium">Require Email Verification</h4>
                <p className="text-sm text-slate-400">Users must verify email before accessing</p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(v) => updateSetting("requireEmailVerification", v)}
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div>
                <h4 className="font-medium">Two-Factor Authentication</h4>
                <p className="text-sm text-slate-400">Enable 2FA for user accounts</p>
              </div>
              <Switch
                checked={settings.twoFactorEnabled}
                onCheckedChange={(v) => updateSetting("twoFactorEnabled", v)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Max Login Attempts</label>
              <Input
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) => updateSetting("maxLoginAttempts", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Session Timeout (days)</label>
              <Input
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => updateSetting("sessionTimeout", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Minimum Password Length</label>
              <Input
                type="number"
                value={settings.passwordMinLength}
                onChange={(e) => updateSetting("passwordMinLength", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStreaming = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-cyan-400" />
            Streaming Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Default Quality</label>
              <Select 
                value={settings.defaultQuality} 
                onValueChange={(v) => updateSetting("defaultQuality", v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (96 kbps)</SelectItem>
                  <SelectItem value="medium">Medium (160 kbps)</SelectItem>
                  <SelectItem value="high">High (320 kbps)</SelectItem>
                  <SelectItem value="lossless">Lossless (FLAC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Streaming Bitrate (kbps)</label>
              <Input
                type="number"
                value={settings.streamingBitrate}
                onChange={(e) => updateSetting("streamingBitrate", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Max Offline Songs (Premium)</label>
              <Input
                type="number"
                value={settings.maxOfflineSongs}
                onChange={(e) => updateSetting("maxOfflineSongs", parseInt(e.target.value))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div>
              <h4 className="font-medium">Allow Offline Downloads</h4>
              <p className="text-sm text-slate-400">Premium users can download for offline playback</p>
            </div>
            <Switch
              checked={settings.allowOfflineDownload}
              onCheckedChange={(v) => updateSetting("allowOfflineDownload", v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-400" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "emailNotifications", label: "Email Notifications", desc: "Send notifications via email" },
            { key: "pushNotifications", label: "Push Notifications", desc: "Mobile push notifications" },
            { key: "smsNotifications", label: "SMS Notifications", desc: "Text message notifications" },
            { key: "newReleaseAlerts", label: "New Release Alerts", desc: "Notify users about new music" },
            { key: "promotionalEmails", label: "Promotional Emails", desc: "Marketing and promotional content" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
              <div>
                <h4 className="font-medium">{item.label}</h4>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(v) => updateSetting(item.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            Analytics & Tracking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Google Analytics ID</label>
              <Input
                placeholder="G-XXXXXXXXXX"
                value={settings.googleAnalyticsId}
                onChange={(e) => updateSetting("googleAnalyticsId", e.target.value)}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Facebook Pixel ID</label>
              <Input
                placeholder="Enter Pixel ID"
                value={settings.facebookPixelId}
                onChange={(e) => updateSetting("facebookPixelId", e.target.value)}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div>
              <h4 className="font-medium">Enable User Tracking</h4>
              <p className="text-sm text-slate-400">Track user behavior and analytics</p>
            </div>
            <Switch
              checked={settings.enableUserTracking}
              onCheckedChange={(v) => updateSetting("enableUserTracking", v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSocialMedia = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-pink-400" />
            Social Media Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/..." },
            { key: "twitterUrl", label: "Twitter/X", placeholder: "https://twitter.com/..." },
            { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/..." },
            { key: "youtubeUrl", label: "YouTube", placeholder: "https://youtube.com/..." },
            { key: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/..." },
          ].map(item => (
            <div key={item.key}>
              <label className="text-sm text-slate-400 mb-2 block">{item.label}</label>
              <Input
                placeholder={item.placeholder}
                value={settings[item.key]}
                onChange={(e) => updateSetting(item.key, e.target.value)}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const renderLegal = () => (
    <div className="space-y-6">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Legal & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Terms of Service URL</label>
            <Input
              placeholder="https://yoursite.com/terms"
              value={settings.termsOfServiceUrl}
              onChange={(e) => updateSetting("termsOfServiceUrl", e.target.value)}
              className="bg-slate-800 border-slate-600"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Privacy Policy URL</label>
            <Input
              placeholder="https://yoursite.com/privacy"
              value={settings.privacyPolicyUrl}
              onChange={(e) => updateSetting("privacyPolicyUrl", e.target.value)}
              className="bg-slate-800 border-slate-600"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Copyright Notice</label>
            <Input
              value={settings.copyrightNotice}
              onChange={(e) => updateSetting("copyrightNotice", e.target.value)}
              className="bg-slate-800 border-slate-600"
            />
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-2 block">DMCA Contact Email</label>
            <Input
              placeholder="dmca@yoursite.com"
              value={settings.dmcaContact}
              onChange={(e) => updateSetting("dmcaContact", e.target.value)}
              className="bg-slate-800 border-slate-600"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "branding": return renderBranding();
      case "language": return renderLanguageCurrency();
      case "geolocking": return renderGeoLocking();
      case "payments": return renderPayments();
      case "themes": return renderBranding(); // Reuse branding for now
      case "content": return renderContentSettings();
      case "notifications": return renderNotifications();
      case "security": return renderSecurity();
      case "streaming": return renderStreaming();
      case "analytics": return renderAnalytics();
      case "social": return renderSocialMedia();
      case "legal": return renderLegal();
      default: return renderBranding();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Settings className="w-7 h-7 text-slate-400" />
            System Settings
          </h1>
          <p className="text-slate-400 mt-1">Configure app settings, themes, payments, and more</p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="bg-red-600 hover:bg-red-700">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 space-y-1">
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                activeTab === item.id
                  ? "bg-red-600/20 text-red-400 border border-red-600/30"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// Helper function to get country flag emoji
function getCountryFlag(countryCode) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
