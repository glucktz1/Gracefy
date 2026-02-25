import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Image, Upload, RefreshCw, Save, Palette, Type, ExternalLink, Check, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BrandingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState(null);
  const [formData, setFormData] = useState({
    app_name: '',
    tagline: '',
    logo_url: '',
    logo_with_text_url: '',
    favicon_url: '',
    primary_color: '#8b5cf6',
    secondary_color: '#06b6d4'
  });

  const fetchBranding = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/branding`);
      setBranding(res.data);
      setFormData({
        app_name: res.data.app_name || 'Gracefy',
        tagline: res.data.tagline || 'Christian Music Streaming',
        logo_url: res.data.logo_url || '/gracefy-icon.png',
        logo_with_text_url: res.data.logo_with_text_url || '/gracefy-logo-dark.png',
        favicon_url: res.data.favicon_url || '/favicon.ico',
        primary_color: res.data.primary_color || '#8b5cf6',
        secondary_color: res.data.secondary_color || '#06b6d4'
      });
    } catch (error) {
      console.error('Error fetching branding:', error);
      toast.error('Failed to load branding settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/admin/branding`, formData);
      toast.success('Branding settings saved successfully');
      fetchBranding();
    } catch (error) {
      console.error('Error saving branding:', error);
      toast.error('Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file, logoType) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API}/admin/branding/upload-logo?logo_type=${logoType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success(`${logoType === 'icon' ? 'Logo' : logoType === 'full' ? 'Full Logo' : 'Favicon'} uploaded successfully`);
      fetchBranding();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Failed to upload image');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset branding to defaults?')) return;
    
    try {
      setSaving(true);
      await axios.post(`${API}/admin/branding/reset`);
      toast.success('Branding reset to defaults');
      fetchBranding();
    } catch (error) {
      console.error('Error resetting:', error);
      toast.error('Failed to reset branding');
    } finally {
      setSaving(false);
    }
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
            <Palette className="w-6 h-6 text-purple-500" />
            Branding Settings
          </h1>
          <p className="text-zinc-400 mt-1">Customize your app's logo and brand identity</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleReset} variant="outline" className="border-zinc-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logo Settings */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Image className="w-5 h-5 text-purple-500" />
              Logo (Icon Only)
            </CardTitle>
            <CardDescription>
              Used in sidebar, login pages, and mobile app. Recommended: Square PNG with transparent background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                {formData.logo_url ? (
                  <img 
                    src={formData.logo_url.startsWith('http') ? formData.logo_url : `${process.env.REACT_APP_BACKEND_URL}${formData.logo_url}`} 
                    alt="Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <Image className="w-8 h-8 text-zinc-600" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-zinc-300">Logo URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="/gracefy-icon.png or https://..."
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], 'icon')}
                    />
                    <Button type="button" variant="outline" className="border-zinc-700" asChild>
                      <span><Upload className="w-4 h-4" /></span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Full Logo with Text */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Type className="w-5 h-5 text-cyan-500" />
              Full Logo (With Text)
            </CardTitle>
            <CardDescription>
              Used where text display is not available. Optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-32 h-24 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                {formData.logo_with_text_url ? (
                  <img 
                    src={formData.logo_with_text_url.startsWith('http') ? formData.logo_with_text_url : `${process.env.REACT_APP_BACKEND_URL}${formData.logo_with_text_url}`} 
                    alt="Full Logo" 
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <Type className="w-8 h-8 text-zinc-600" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-zinc-300">Full Logo URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.logo_with_text_url}
                    onChange={(e) => setFormData({ ...formData, logo_with_text_url: e.target.value })}
                    placeholder="/gracefy-logo-dark.png or https://..."
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], 'full')}
                    />
                    <Button type="button" variant="outline" className="border-zinc-700" asChild>
                      <span><Upload className="w-4 h-4" /></span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Favicon */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-emerald-500" />
              Favicon
            </CardTitle>
            <CardDescription>
              Browser tab icon. Recommended: 32x32 or 64x64 PNG/ICO with transparent background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-zinc-800 rounded-lg flex items-center justify-center overflow-hidden">
                {formData.favicon_url ? (
                  <img 
                    src={formData.favicon_url.startsWith('http') ? formData.favicon_url : `${process.env.REACT_APP_BACKEND_URL}${formData.favicon_url}`} 
                    alt="Favicon" 
                    className="w-8 h-8 object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <ExternalLink className="w-6 h-6 text-zinc-600" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Label className="text-zinc-300">Favicon URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.favicon_url}
                    onChange={(e) => setFormData({ ...formData, favicon_url: e.target.value })}
                    placeholder="/favicon.ico or https://..."
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,.ico"
                      className="hidden"
                      onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], 'favicon')}
                    />
                    <Button type="button" variant="outline" className="border-zinc-700" asChild>
                      <span><Upload className="w-4 h-4" /></span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Name & Tagline */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">App Identity</CardTitle>
            <CardDescription>App name and tagline displayed across the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-zinc-300">App Name</Label>
              <Input
                value={formData.app_name}
                onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                placeholder="Gracefy"
                className="bg-zinc-800 border-zinc-700 mt-1"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Tagline</Label>
              <Input
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="Christian Music Streaming"
                className="bg-zinc-800 border-zinc-700 mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-amber-500" />
              Brand Colors
            </CardTitle>
            <CardDescription>Primary and secondary colors used throughout the app</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-zinc-300">Primary Color</Label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-zinc-700"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    placeholder="#8b5cf6"
                    className="bg-zinc-800 border-zinc-700 flex-1"
                  />
                  <div 
                    className="w-24 h-12 rounded-lg" 
                    style={{ backgroundColor: formData.primary_color }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Secondary Color</Label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-zinc-700"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    placeholder="#06b6d4"
                    className="bg-zinc-800 border-zinc-700 flex-1"
                  />
                  <div 
                    className="w-24 h-12 rounded-lg" 
                    style={{ backgroundColor: formData.secondary_color }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Preview</CardTitle>
          <CardDescription>How your branding will appear across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sidebar Preview */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs mb-3">Sidebar</p>
              <div className="flex items-center gap-3">
                <img 
                  src={formData.logo_url.startsWith('http') ? formData.logo_url : `${process.env.REACT_APP_BACKEND_URL}${formData.logo_url}`} 
                  alt="Logo" 
                  className="w-10 h-10 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div>
                  <p className="text-white font-bold">{formData.app_name}</p>
                  <p className="text-zinc-500 text-xs">Admin Dashboard</p>
                </div>
              </div>
            </div>
            
            {/* Login Preview */}
            <div className="bg-zinc-800 rounded-lg p-4 text-center">
              <p className="text-zinc-500 text-xs mb-3">Login Page</p>
              <img 
                src={formData.logo_url.startsWith('http') ? formData.logo_url : `${process.env.REACT_APP_BACKEND_URL}${formData.logo_url}`} 
                alt="Logo" 
                className="w-16 h-16 object-contain mx-auto mb-2"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <p className="text-white font-bold">{formData.app_name}</p>
              <p className="text-zinc-500 text-xs">{formData.tagline}</p>
            </div>
            
            {/* Browser Tab Preview */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-zinc-500 text-xs mb-3">Browser Tab</p>
              <div className="bg-zinc-700 rounded-t-lg p-2 flex items-center gap-2">
                <img 
                  src={formData.favicon_url.startsWith('http') ? formData.favicon_url : `${process.env.REACT_APP_BACKEND_URL}${formData.favicon_url}`} 
                  alt="Favicon" 
                  className="w-4 h-4 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span className="text-white text-sm truncate">{formData.app_name}</span>
                <X className="w-3 h-3 text-zinc-500 ml-auto" />
              </div>
              <div className="bg-zinc-600 h-16 rounded-b-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
