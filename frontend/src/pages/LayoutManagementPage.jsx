import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Layout, Plus, Trash2, Edit2, Eye, EyeOff, GripVertical, 
  Smartphone, Monitor, ChevronUp, ChevronDown, Save, RefreshCw,
  Image, Link, Calendar, Crown, Gift, Music2, Grid, Star, Megaphone,
  X, Check, ExternalLink, Play, Users, Church, Disc, BookOpen, AlertCircle
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
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SECTION_TYPES = [
  { value: "hero", label: "Hero Section", icon: Image },
  { value: "quick_access", label: "Quick Access Grid", icon: Grid },
  { value: "featured_albums", label: "Featured Albums", icon: Star },
  { value: "leader_content", label: "Leader Content", icon: BookOpen },
  { value: "choirs", label: "Choirs & Artists", icon: Users },
  { value: "churches", label: "Churches", icon: Church },
  { value: "special_mixes", label: "Special Mixes", icon: Disc },
  { value: "seasonal", label: "Seasonal Section", icon: Calendar },
  { value: "trending", label: "Trending/Popular", icon: Crown },
  { value: "cta", label: "Call-to-Action", icon: Megaphone },
  { value: "sermons", label: "Mahubiri na Tafakari (Sermons)", icon: BookOpen },
  { value: "teachings", label: "Mafundisho na Katekesi (Teachings)", icon: BookOpen },
  { value: "custom", label: "Custom Section", icon: Layout },
];

const CONTENT_TYPES = [
  { value: "categories", label: "Categories" },
  { value: "albums", label: "Albums" },
  { value: "songs", label: "Songs" },
  { value: "playlists", label: "Playlists" },
  { value: "choirs", label: "Choirs / Artists" },
  { value: "churches", label: "Churches" },
  { value: "special_mixes", label: "Special Mixes" },
  { value: "leader_content", label: "Leader Content (Teachings, Sermons)" },
];

const ICONS = [
  "crown", "gift", "music", "heart", "star", "zap", "trophy", "diamond", "ticket", "headphones"
];

const LINK_TYPES = [
  { value: "page", label: "App Page" },
  { value: "album", label: "Album" },
  { value: "category", label: "Category" },
  { value: "playlist", label: "Playlist" },
  { value: "payment", label: "Payment/Subscription" },
  { value: "external", label: "External URL" },
];

// Helper function to get icon component
const ICON_MAP = {
  crown: Crown, gift: Gift, music: Music2, star: Star
};

// Burner preview component - moved outside main component to avoid re-creation on each render
const BurnerPreview = ({ burner, small = false }) => {
  const IconComp = ICON_MAP[burner.icon] || Crown;
  return (
    <div 
      className={`rounded-2xl p-${small ? '4' : '6'} relative overflow-hidden`}
      style={{ 
        background: burner.background_type === "gradient" ? burner.background_gradient : burner.background_color,
        backgroundImage: burner.background_image ? `url(${burner.background_image})` : undefined,
        backgroundSize: 'cover'
      }}
    >
      <div className="relative z-10">
        <div 
          className={`w-${small ? '10' : '12'} h-${small ? '10' : '12'} rounded-full flex items-center justify-center mb-3`}
          style={{ backgroundColor: `${burner.icon_color}20` }}
        >
          <IconComp size={small ? 20 : 24} style={{ color: burner.icon_color }} />
        </div>
        <h3 
          className={`font-bold ${small ? 'text-lg' : 'text-xl'} mb-1`}
          style={{ color: burner.text_color }}
        >
          {burner.headline || "Headline"}
        </h3>
        {burner.subtitle && (
          <p className={`${small ? 'text-xs' : 'text-sm'} opacity-80 mb-4`} style={{ color: burner.text_color }}>
            {burner.subtitle}
          </p>
        )}
        <button
          className={`${small ? 'px-4 py-1.5 text-sm' : 'px-6 py-2'} rounded-full font-medium`}
          style={{ backgroundColor: burner.button_color, color: burner.button_text_color }}
        >
          {burner.cta_text || "Button"}
        </button>
      </div>
    </div>
  );
};

// Hero Banners Tab Component
const HeroBannersTab = ({ albums }) => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    link_type: 'album',
    link_id: '',
    external_url: '',
    is_active: true,
    order: 0
  });

  const fetchBanners = async () => {
    try {
      const res = await axios.get(`${API}/layout/hero-banners`, { withCredentials: true });
      setBanners(res.data.banners || []);
    } catch (e) {
      toast.error("Failed to load banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      setForm(prev => ({ ...prev, image_url: res.data.url }));
      toast.success("Image uploaded!");
    } catch (e) {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title) {
      toast.error("Title is required");
      return;
    }
    try {
      if (editingBanner) {
        await axios.put(`${API}/layout/hero-banner/${editingBanner.banner_id}`, form, { withCredentials: true });
        toast.success("Banner updated");
      } else {
        await axios.post(`${API}/layout/hero-banner`, form, { withCredentials: true });
        toast.success("Banner created");
      }
      setIsModalOpen(false);
      setEditingBanner(null);
      resetForm();
      fetchBanners();
    } catch (e) {
      toast.error("Failed to save banner");
    }
  };

  const handleDelete = async (bannerId) => {
    if (!window.confirm("Delete this banner?")) return;
    try {
      await axios.delete(`${API}/layout/hero-banner/${bannerId}`, { withCredentials: true });
      toast.success("Banner deleted");
      fetchBanners();
    } catch (e) {
      toast.error("Failed to delete");
    }
  };

  const handleToggle = async (banner) => {
    try {
      await axios.put(`${API}/layout/hero-banner/${banner.banner_id}`, 
        { is_active: !banner.is_active }, 
        { withCredentials: true }
      );
      toast.success(banner.is_active ? "Banner deactivated" : "Banner activated");
      fetchBanners();
    } catch (e) {
      toast.error("Failed to toggle");
    }
  };

  const openEdit = (banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      link_type: banner.link_type || 'album',
      link_id: banner.link_id || '',
      external_url: banner.external_url || '',
      is_active: banner.is_active ?? true,
      order: banner.order || 0
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setForm({
      title: '',
      subtitle: '',
      image_url: '',
      link_type: 'album',
      link_id: '',
      external_url: '',
      is_active: true,
      order: 0
    });
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Hero Banners</h3>
          <p className="text-zinc-400 text-sm">Upload banner images and link them to albums or songs</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingBanner(null); setIsModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus size={16} className="mr-2" /> Add Banner
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {banners.map((banner) => (
          <Card key={banner.banner_id} className={`bg-zinc-900 border-zinc-800 overflow-hidden ${!banner.is_active && 'opacity-60'}`}>
            <div className="relative h-40">
              {banner.image_url ? (
                <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-900 to-emerald-900 flex items-center justify-center">
                  <Image size={40} className="text-white/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h4 className="font-semibold text-white truncate">{banner.title || 'Untitled'}</h4>
                {banner.subtitle && <p className="text-xs text-zinc-300 truncate">{banner.subtitle}</p>}
              </div>
              {!banner.is_active && (
                <Badge className="absolute top-2 right-2 bg-zinc-800">Inactive</Badge>
              )}
            </div>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Links to: {banner.link_type || 'None'}</span>
                <span>Order: {banner.order}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 border-zinc-700" onClick={() => openEdit(banner)}>
                  <Edit2 size={14} className="mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => handleToggle(banner)}>
                  {banner.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
                <Button size="sm" variant="outline" className="border-red-800 text-red-400 hover:bg-red-900/30" onClick={() => handleDelete(banner.banner_id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {banners.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            <Image size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hero banners created yet</p>
            <p className="text-sm">Add banners to display on the app home screen</p>
          </div>
        )}
      </div>

      {/* Banner Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "Edit Banner" : "Add New Banner"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Upload a banner image and link it to content
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Banner Image</label>
              <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="Banner" className="w-full h-32 object-cover rounded" />
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="absolute top-2 right-2" 
                      onClick={() => setForm(prev => ({ ...prev, image_url: '' }))}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block py-4">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
                        <span className="text-sm text-zinc-400">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <Image size={32} className="mx-auto mb-2 text-zinc-500" />
                        <span className="text-sm text-zinc-400">Click to upload image</span>
                        <span className="text-xs text-zinc-500 block mt-1">Max 5MB, JPG/PNG</span>
                      </>
                    )}
                  </label>
                )}
              </div>
              <Input 
                value={form.image_url} 
                onChange={(e) => setForm(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="Or paste image URL"
                className="mt-2 bg-zinc-950 border-zinc-700"
              />
            </div>

            {/* Title & Subtitle */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Title *</label>
                <Input 
                  value={form.title} 
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Banner title"
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Subtitle</label>
                <Input 
                  value={form.subtitle} 
                  onChange={(e) => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Optional subtitle"
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
            </div>

            {/* Link Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Link Type</label>
                <Select value={form.link_type} onValueChange={(v) => setForm(prev => ({ ...prev, link_type: v }))}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="album">Album</SelectItem>
                    <SelectItem value="song">Song</SelectItem>
                    <SelectItem value="external">External URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Order</label>
                <Input 
                  type="number" 
                  value={form.order} 
                  onChange={(e) => setForm(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
            </div>

            {/* Link Target */}
            {form.link_type === 'album' && (
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Select Album</label>
                <Select value={form.link_id} onValueChange={(v) => setForm(prev => ({ ...prev, link_id: v }))}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Choose an album" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                    {albums.map(album => (
                      <SelectItem key={album.album_id} value={album.album_id}>
                        {album.title} - {album.artist_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.link_type === 'external' && (
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">External URL</label>
                <Input 
                  value={form.external_url} 
                  onChange={(e) => setForm(prev => ({ ...prev, external_url: e.target.value }))}
                  placeholder="https://..."
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
            )}

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
              <span className="text-sm">Active</span>
              <Switch 
                checked={form.is_active} 
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              {editingBanner ? "Update" : "Create"} Banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Hero Configuration Component - Choose between Static Banners or Dynamic Content
const HeroConfigTab = ({ albums }) => {
  const [config, setConfig] = useState({
    hero_type: 'static_banner',
    content_ids: [],
    auto_rotate: true,
    rotation_interval: 5000,
    show_navigation: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAlbums, setSelectedAlbums] = useState([]);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API}/layout/hero-config`, { withCredentials: true });
      if (res.data) {
        setConfig(res.data);
        // Set selected albums based on content_ids
        if (res.data.content_ids?.length > 0) {
          const selected = albums.filter(a => res.data.content_ids.includes(a.album_id));
          setSelectedAlbums(selected);
        }
      }
    } catch (e) {
      console.log("Using default hero config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [albums]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveConfig = {
        ...config,
        content_ids: selectedAlbums.map(a => a.album_id)
      };
      await axios.post(`${API}/layout/hero-config`, saveConfig, { withCredentials: true });
      toast.success("Hero configuration saved! Changes will reflect on user side.");
    } catch (e) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const toggleAlbumSelection = (album) => {
    setSelectedAlbums(prev => {
      const isSelected = prev.some(a => a.album_id === album.album_id);
      if (isSelected) {
        return prev.filter(a => a.album_id !== album.album_id);
      } else {
        return [...prev, album];
      }
    });
  };

  const moveAlbum = (index, direction) => {
    const newSelected = [...selectedAlbums];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSelected.length) return;
    [newSelected[index], newSelected[newIndex]] = [newSelected[newIndex], newSelected[index]];
    setSelectedAlbums(newSelected);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Type Selection */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Image size={20} className="text-violet-400" />
            Hero Section Type
          </CardTitle>
          <CardDescription>Choose what content appears in the hero section at the top of the app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Static Banners Option */}
            <div 
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                config.hero_type === 'static_banner' 
                  ? 'border-violet-500 bg-violet-500/10' 
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
              onClick={() => setConfig(prev => ({ ...prev, hero_type: 'static_banner' }))}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  config.hero_type === 'static_banner' ? 'bg-violet-500' : 'bg-zinc-800'
                }`}>
                  <Image size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Static Banners</h4>
                  <p className="text-xs text-zinc-400">Custom promotional banners</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">
                Use the Hero Banners tab to create and manage custom promotional banners with custom images, titles, and links.
              </p>
              {config.hero_type === 'static_banner' && (
                <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
                  <Check size={16} /> Currently Active
                </div>
              )}
            </div>

            {/* Dynamic Content Option */}
            <div 
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                config.hero_type === 'dynamic_content' 
                  ? 'border-violet-500 bg-violet-500/10' 
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
              onClick={() => setConfig(prev => ({ ...prev, hero_type: 'dynamic_content' }))}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  config.hero_type === 'dynamic_content' ? 'bg-violet-500' : 'bg-zinc-800'
                }`}>
                  <Music2 size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Dynamic Content</h4>
                  <p className="text-xs text-zinc-400">Feature albums automatically</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400">
                Select specific albums to feature in the hero section. Their artwork, titles, and details will be displayed dynamically.
              </p>
              {config.hero_type === 'dynamic_content' && (
                <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm">
                  <Check size={16} /> Currently Active
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Content Selection */}
      {config.hero_type === 'dynamic_content' && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star size={20} className="text-amber-400" />
              Select Featured Albums for Hero Carousel
            </CardTitle>
            <CardDescription>
              Choose at least 5 albums to display in the hero carousel. These will rotate automatically on the home screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selection Status */}
            <div className={`p-3 rounded-lg ${selectedAlbums.length >= 5 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
              <div className="flex items-center gap-2">
                {selectedAlbums.length >= 5 ? (
                  <Check size={18} className="text-emerald-400" />
                ) : (
                  <AlertCircle size={18} className="text-amber-400" />
                )}
                <span className={`text-sm font-medium ${selectedAlbums.length >= 5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedAlbums.length} / 5+ albums selected
                </span>
              </div>
              {selectedAlbums.length < 5 && (
                <p className="text-xs text-amber-400/80 mt-1">Select at least 5 albums for a better carousel experience</p>
              )}
            </div>

            {/* Selected Albums */}
            {selectedAlbums.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm text-zinc-400 font-medium flex items-center justify-between">
                  <span>Selected Albums (use arrows to reorder)</span>
                  <span className="text-xs text-zinc-500">{selectedAlbums.length} selected</span>
                </label>
                <div className="space-y-2 p-3 bg-zinc-800/50 rounded-lg max-h-[300px] overflow-y-auto">
                  {selectedAlbums.map((album, index) => (
                    <div 
                      key={album.album_id}
                      className="flex items-center gap-3 p-2 bg-zinc-900 rounded-lg hover:bg-zinc-800/80 transition-colors"
                    >
                      <div className="flex flex-col">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => moveAlbum(index, 'up')}
                          className="h-5 w-5 p-0"
                        >
                          <ChevronUp size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={index === selectedAlbums.length - 1}
                          onClick={() => moveAlbum(index, 'down')}
                          className="h-5 w-5 p-0"
                        >
                          <ChevronDown size={12} />
                        </Button>
                      </div>
                      <span className="w-6 h-6 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="w-12 h-12 bg-zinc-700 rounded-lg overflow-hidden flex-shrink-0">
                        {album.thumbnail ? (
                          <img src={album.thumbnail?.startsWith('data:') ? album.thumbnail : `${BACKEND_URL}${album.thumbnail_url || `/api/thumbnails/${album.album_id}`}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music2 size={16} className="text-zinc-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{album.title}</p>
                        <p className="text-xs text-zinc-400 truncate">{album.artist_name}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleAlbumSelection(album)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available Albums */}
            <div>
              <label className="text-sm text-zinc-400 font-medium block mb-2">
                Available Albums ({albums.filter(a => !selectedAlbums.some(s => s.album_id === a.album_id)).length})
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto p-2">
                {albums.filter(a => !selectedAlbums.some(s => s.album_id === a.album_id)).map(album => (
                  <div
                    key={album.album_id}
                    className="p-2 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-700/50 transition-colors"
                    onClick={() => toggleAlbumSelection(album)}
                  >
                    <div className="w-full aspect-square bg-zinc-700 rounded-lg mb-2 overflow-hidden">
                      {album.thumbnail ? (
                        <img 
                          src={album.thumbnail?.startsWith('data:') ? album.thumbnail : `${BACKEND_URL}${album.thumbnail_url || `/api/thumbnails/${album.album_id}`}`} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music2 size={24} className="text-zinc-500" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-medium text-white truncate">{album.title}</p>
                    <p className="text-xs text-zinc-400 truncate">{album.artist_name}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display Settings */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Display Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
            <div>
              <span className="text-sm font-medium">Auto-rotate</span>
              <p className="text-xs text-zinc-400">Automatically cycle through hero items</p>
            </div>
            <Switch 
              checked={config.auto_rotate} 
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, auto_rotate: checked }))}
            />
          </div>
          
          {config.auto_rotate && (
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Rotation Interval (seconds)</label>
              <Select 
                value={String(config.rotation_interval)} 
                onValueChange={(v) => setConfig(prev => ({ ...prev, rotation_interval: parseInt(v) }))}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-700 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="3000">3 seconds</SelectItem>
                  <SelectItem value="5000">5 seconds</SelectItem>
                  <SelectItem value="7000">7 seconds</SelectItem>
                  <SelectItem value="10000">10 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
            <div>
              <span className="text-sm font-medium">Show Navigation Dots</span>
              <p className="text-xs text-zinc-400">Display navigation indicators</p>
            </div>
            <Switch 
              checked={config.show_navigation} 
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, show_navigation: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" />
              Save Hero Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default function LayoutManagementPage() {
  const [sections, setSections] = useState([]);
  const [burners, setBurners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [churches, setChurches] = useState([]);
  const [choirs, setChoirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sections");
  const [previewPlatform, setPreviewPlatform] = useState("app");
  const [hasChanges, setHasChanges] = useState(false);

  // Modal states
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isBurnerModalOpen, setIsBurnerModalOpen] = useState(false);
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editingBurner, setEditingBurner] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);

  // Form states
  const [sectionForm, setSectionForm] = useState({
    name: "", display_name: "", section_type: "custom", description: "",
    platforms: ["app", "web"], content_type: "", content_count: 10,
    background_color: "", background_gradient: "", link_type: "", link_target: ""
  });

  const [burnerForm, setBurnerForm] = useState({
    name: "", icon: "crown", icon_color: "#fbbf24", headline: "", subtitle: "",
    cta_text: "", cta_link: "", cta_link_type: "page",
    background_type: "gradient", background_color: "#1e1b4b",
    background_gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
    background_image: "", text_color: "#ffffff", button_color: "#ffffff",
    button_text_color: "#000000", platforms: ["app", "web"]
  });

  const fetchData = useCallback(async () => {
    try {
      const [sectionsRes, burnersRes, categoriesRes, albumsRes, churchesRes, choirsRes] = await Promise.all([
        axios.get(`${API}/layout/sections`, { withCredentials: true }),
        axios.get(`${API}/layout/burners`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/albums`, { withCredentials: true }),
        axios.get(`${API}/churches`, { withCredentials: true }).catch(() => ({ data: { churches: [] } })),
        axios.get(`${API}/admin/choirs`, { withCredentials: true }).catch(() => ({ data: { choirs: [] } }))
      ]);
      setSections(sectionsRes.data.sections || []);
      setBurners(burnersRes.data.burners || []);
      setCategories(categoriesRes.data.categories || []);
      setAlbums(albumsRes.data.albums || []);
      setChurches(churchesRes.data.churches || []);
      setChoirs(choirsRes.data.choirs || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load layout data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Section handlers
  const handleSaveSection = async (e) => {
    e.preventDefault();
    try {
      if (editingSection) {
        await axios.put(`${API}/layout/sections/${editingSection.section_id}`, sectionForm, { withCredentials: true });
        toast.success("Section updated");
      } else {
        await axios.post(`${API}/layout/sections`, sectionForm, { withCredentials: true });
        toast.success("Section created");
      }
      setIsSectionModalOpen(false);
      setEditingSection(null);
      resetSectionForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save section");
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm("Are you sure you want to delete this section?")) return;
    try {
      await axios.delete(`${API}/layout/sections/${sectionId}`, { withCredentials: true });
      toast.success("Section deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete section");
    }
  };

  const handleToggleSection = async (sectionId, isActive) => {
    try {
      await axios.put(`${API}/layout/sections/${sectionId}/toggle`, { is_active: !isActive }, { withCredentials: true });
      toast.success(isActive ? "Section deactivated - changes applied!" : "Section activated - now visible to users!");
      fetchData();
    } catch (error) {
      toast.error("Failed to toggle section");
    }
  };

  const handleMoveSection = async (sectionId, direction) => {
    const currentIndex = sections.findIndex(s => s.section_id === sectionId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    
    const newSections = [...sections];
    [newSections[currentIndex], newSections[newIndex]] = [newSections[newIndex], newSections[currentIndex]];
    
    setSections(newSections);
    setHasChanges(true);
  };

  const handleSaveOrder = async () => {
    try {
      const sectionOrder = sections.map(s => s.section_id);
      await axios.post(`${API}/layout/sections/reorder`, { section_order: sectionOrder }, { withCredentials: true });
      toast.success("Section order saved");
      setHasChanges(false);
    } catch (error) {
      toast.error("Failed to save order");
    }
  };

  const openEditSection = (section) => {
    setEditingSection(section);
    setSectionForm({
      name: section.name || "",
      display_name: section.display_name || "",
      section_type: section.section_type || "custom",
      description: section.description || "",
      platforms: section.platforms || ["app", "web"],
      content_type: section.content_type || "",
      content_count: section.content_count || 10,
      background_color: section.background_color || "",
      background_gradient: section.background_gradient || "",
      link_type: section.link_type || "",
      link_target: section.link_target || ""
    });
    setIsSectionModalOpen(true);
  };

  const resetSectionForm = () => {
    setSectionForm({
      name: "", display_name: "", section_type: "custom", description: "",
      platforms: ["app", "web"], content_type: "", content_count: 10,
      background_color: "", background_gradient: "", link_type: "", link_target: ""
    });
  };

  // Burner handlers
  const handleSaveBurner = async (e) => {
    e.preventDefault();
    try {
      if (editingBurner) {
        await axios.put(`${API}/layout/burners/${editingBurner.burner_id}`, burnerForm, { withCredentials: true });
        toast.success("Burner updated");
      } else {
        await axios.post(`${API}/layout/burners`, burnerForm, { withCredentials: true });
        toast.success("Burner created");
      }
      setIsBurnerModalOpen(false);
      setEditingBurner(null);
      resetBurnerForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save burner");
    }
  };

  const handleDeleteBurner = async (burnerId) => {
    if (!window.confirm("Are you sure you want to delete this burner?")) return;
    try {
      await axios.delete(`${API}/layout/burners/${burnerId}`, { withCredentials: true });
      toast.success("Burner deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete burner");
    }
  };

  const handleToggleBurner = async (burnerId, isActive) => {
    try {
      await axios.put(`${API}/layout/burners/${burnerId}/toggle`, { is_active: !isActive }, { withCredentials: true });
      toast.success(isActive ? "Burner deactivated" : "Burner activated");
      fetchData();
    } catch (error) {
      toast.error("Failed to toggle burner");
    }
  };

  const openEditBurner = (burner) => {
    setEditingBurner(burner);
    setBurnerForm({
      name: burner.name || "",
      icon: burner.icon || "crown",
      icon_color: burner.icon_color || "#fbbf24",
      headline: burner.headline || "",
      subtitle: burner.subtitle || "",
      cta_text: burner.cta_text || "",
      cta_link: burner.cta_link || "",
      cta_link_type: burner.cta_link_type || "page",
      background_type: burner.background_type || "gradient",
      background_color: burner.background_color || "#1e1b4b",
      background_gradient: burner.background_gradient || "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      background_image: burner.background_image || "",
      text_color: burner.text_color || "#ffffff",
      button_color: burner.button_color || "#ffffff",
      button_text_color: burner.button_text_color || "#000000",
      platforms: burner.platforms || ["app", "web"]
    });
    setIsBurnerModalOpen(true);
  };

  const resetBurnerForm = () => {
    setBurnerForm({
      name: "", icon: "crown", icon_color: "#fbbf24", headline: "", subtitle: "",
      cta_text: "", cta_link: "", cta_link_type: "page",
      background_type: "gradient", background_color: "#1e1b4b",
      background_gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      background_image: "", text_color: "#ffffff", button_color: "#ffffff",
      button_text_color: "#000000", platforms: ["app", "web"]
    });
  };

  // Content assignment
  const handleAssignContent = async (contentType, contentIds) => {
    if (!selectedSection) return;
    try {
      await axios.post(`${API}/layout/sections/${selectedSection.section_id}/assign-content`, {
        content_type: contentType,
        content_ids: contentIds
      }, { withCredentials: true });
      toast.success("Content assigned");
      setIsContentModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to assign content");
    }
  };

  const openContentAssignment = (section) => {
    setSelectedSection(section);
    setIsContentModalOpen(true);
  };

  // Platform badge
  const getPlatformBadge = (platforms) => {
    if (platforms?.includes("app") && platforms?.includes("web")) {
      return <Badge className="bg-violet-500/20 text-violet-400">Both</Badge>;
    }
    if (platforms?.includes("app")) {
      return <Badge className="bg-emerald-500/20 text-emerald-400">App</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-400">Web</Badge>;
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  const filteredSections = sections.filter(s => 
    previewPlatform === "all" || s.platforms?.includes(previewPlatform)
  );

  return (
    <div className="page-container animate-fade-in" data-testid="layout-management-page">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Layout className="text-violet-400" /> Layout Management
          </h1>
          <p className="page-subtitle">Control the layout of your app and web platform</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Button
              variant={previewPlatform === "app" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewPlatform("app")}
              className={previewPlatform === "app" ? "bg-emerald-600" : "border-zinc-700 text-zinc-400"}
            >
              <Smartphone size={14} className="mr-1" /> App
            </Button>
            <Button
              variant={previewPlatform === "web" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewPlatform("web")}
              className={previewPlatform === "web" ? "bg-blue-600" : "border-zinc-700 text-zinc-400"}
            >
              <Monitor size={14} className="mr-1" /> Web
            </Button>
          </div>
          <Button variant="outline" onClick={fetchData} className="border-zinc-700 text-zinc-300">
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
          {hasChanges && (
            <Button onClick={handleSaveOrder} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-order-btn">
              <Save size={16} className="mr-2" /> Save Order
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="sections" className="data-[state=active]:bg-violet-600">
            <Layout size={14} className="mr-2" /> Sections ({sections.length})
          </TabsTrigger>
          <TabsTrigger value="hero-config" className="data-[state=active]:bg-violet-600">
            <Star size={14} className="mr-2" /> Hero Config
          </TabsTrigger>
          <TabsTrigger value="burners" className="data-[state=active]:bg-violet-600">
            <Megaphone size={14} className="mr-2" /> Burners ({burners.length})
          </TabsTrigger>
          <TabsTrigger value="banners" className="data-[state=active]:bg-violet-600">
            <Image size={14} className="mr-2" /> Hero Banners
          </TabsTrigger>
          <TabsTrigger value="preview" className="data-[state=active]:bg-violet-600">
            <Eye size={14} className="mr-2" /> Preview
          </TabsTrigger>
        </TabsList>

        {/* Sections Tab */}
        <TabsContent value="sections" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-zinc-400 text-sm">Drag sections up/down to reorder. Changes are applied to user view after saving.</p>
            <Button onClick={() => { resetSectionForm(); setEditingSection(null); setIsSectionModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-section-btn">
              <Plus size={16} className="mr-2" /> Add Section
            </Button>
          </div>

          <div className="space-y-3">
            {filteredSections.map((section, index) => (
              <Card 
                key={section.section_id} 
                className={`border transition-all ${
                  section.is_active 
                    ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700' 
                    : 'bg-zinc-950/50 border-zinc-800/50 opacity-60 hover:opacity-80'
                }`}
                data-testid={`section-card-${section.section_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Drag handle and order controls */}
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => handleMoveSection(section.section_id, "up")}
                        className="h-6 w-6 p-0 text-zinc-500 hover:text-white"
                      >
                        <ChevronUp size={14} />
                      </Button>
                      <GripVertical size={16} className="text-zinc-600 mx-auto" />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={index === filteredSections.length - 1}
                        onClick={() => handleMoveSection(section.section_id, "down")}
                        className="h-6 w-6 p-0 text-zinc-500 hover:text-white"
                      >
                        <ChevronDown size={14} />
                      </Button>
                    </div>

                    {/* Section icon */}
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      section.is_active ? 'bg-violet-600/20' : 'bg-zinc-800/50'
                    }`}>
                      {SECTION_TYPES.find(t => t.value === section.section_type)?.icon ? 
                        (() => { const Icon = SECTION_TYPES.find(t => t.value === section.section_type)?.icon; return <Icon size={24} className={section.is_active ? "text-violet-400" : "text-zinc-600"} />; })()
                        : <Layout size={24} className={section.is_active ? "text-violet-400" : "text-zinc-600"} />
                      }
                    </div>

                    {/* Section info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-semibold ${section.is_active ? 'text-white' : 'text-zinc-500'}`}>{section.display_name}</h4>
                        {getPlatformBadge(section.platforms)}
                        <Badge className="bg-zinc-700 text-zinc-300">{section.section_type}</Badge>
                        {!section.is_active && <Badge className="bg-red-500/20 text-red-400">Hidden</Badge>}
                        {section.is_active && <Badge className="bg-emerald-500/20 text-emerald-400">Live</Badge>}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">{section.description || "No description"}</p>
                      {section.content_type && (
                        <p className="text-xs text-zinc-600 mt-1">
                          Content: {section.content_type} ({section.content_ids?.length || 0} items)
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openContentAssignment(section)}
                        className="border-zinc-700 text-zinc-300"
                      >
                        <Link size={14} className="mr-1" /> Content
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditSection(section)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Edit2 size={14} />
                      </Button>
                      {/* Toggle Active/Inactive with Switch */}
                      <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-800/50">
                        <Switch
                          checked={section.is_active}
                          onCheckedChange={() => handleToggleSection(section.section_id, section.is_active)}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                        <span className={`text-xs ${section.is_active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {section.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSection(section.section_id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredSections.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                <Layout size={48} className="mx-auto mb-4 opacity-50" />
                <p>No sections found for {previewPlatform}</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Burners Tab */}
        <TabsContent value="burners" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-zinc-400 text-sm">Create promotional banners and call-to-action cards</p>
            <Button onClick={() => { resetBurnerForm(); setEditingBurner(null); setIsBurnerModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-burner-btn">
              <Plus size={16} className="mr-2" /> Add Burner
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {burners.map((burner) => (
              <Card 
                key={burner.burner_id} 
                className={`bg-zinc-900/50 border-zinc-800 ${!burner.is_active ? 'opacity-50' : ''}`}
                data-testid={`burner-card-${burner.burner_id}`}
              >
                <CardContent className="p-4">
                  {/* Burner Preview */}
                  <BurnerPreview burner={burner} small />
                  
                  {/* Info & Actions */}
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{burner.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getPlatformBadge(burner.platforms)}
                        {!burner.is_active && <Badge className="bg-red-500/20 text-red-400">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {burner.clicks_count || 0} clicks • {burner.impressions_count || 0} views
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditBurner(burner)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleBurner(burner.burner_id, burner.is_active)}
                        className={burner.is_active ? "text-emerald-400" : "text-zinc-500"}
                      >
                        {burner.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteBurner(burner.burner_id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {burners.length === 0 && (
              <div className="col-span-full text-center py-12 text-zinc-500">
                <Megaphone size={48} className="mx-auto mb-4 opacity-50" />
                <p>No burners created yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-lg font-semibold text-white">
              {previewPlatform === "app" ? "📱 App Preview" : "🖥️ Web Preview"}
            </h3>
            <p className="text-zinc-500 text-sm">This is how your layout will appear to users</p>
          </div>

          <div className={`mx-auto ${previewPlatform === "app" ? "max-w-sm" : "max-w-4xl"} bg-zinc-950 rounded-2xl p-4 border border-zinc-800`}>
            {/* Preview sections in order */}
            {filteredSections.filter(s => s.is_active).map((section) => (
              <div key={section.section_id} className="mb-6">
                {section.section_type === "hero" && (
                  <div 
                    className="rounded-xl p-6 min-h-[200px] flex flex-col justify-end"
                    style={{ 
                      background: section.background_gradient || section.background_color || 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                      backgroundImage: section.background_image ? `url(${section.background_image})` : undefined
                    }}
                  >
                    <h2 className="text-2xl font-bold text-white mb-2">{section.display_name}</h2>
                    <p className="text-zinc-300 text-sm">{section.description}</p>
                  </div>
                )}

                {section.section_type === "quick_access" && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">{section.display_name}</h3>
                    <div className={`grid ${previewPlatform === "app" ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
                      {(section.content_items || categories.slice(0, section.content_count || 6)).slice(0, 6).map((cat, i) => (
                        <div key={cat?.category_id || i} className="bg-zinc-800/50 rounded-lg p-4 text-center">
                          <Music2 size={24} className="mx-auto mb-2 text-violet-400" />
                          <p className="text-sm text-white truncate">{cat?.name || `Category ${i+1}`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(section.section_type === "featured_albums" || section.section_type === "trending") && (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">{section.display_name}</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {(section.content_items || albums.slice(0, section.content_count || 5)).slice(0, 5).map((album, i) => (
                        <div key={album?.album_id || i} className="flex-shrink-0 w-32">
                          <div className="w-32 h-32 rounded-lg bg-zinc-800 mb-2 flex items-center justify-center">
                            {album?.thumbnail ? (
                              <img src={album.thumbnail} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Music2 size={32} className="text-zinc-600" />
                            )}
                          </div>
                          <p className="text-sm text-white truncate">{album?.title || `Album ${i+1}`}</p>
                          <p className="text-xs text-zinc-500 truncate">{album?.artist_name || "Artist"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section.section_type === "seasonal" && (
                  <div className="bg-gradient-to-r from-red-900/30 to-green-900/30 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">🎄 {section.display_name}</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="flex-shrink-0 w-28">
                          <div className="w-28 h-28 rounded-lg bg-zinc-800/50 mb-2 flex items-center justify-center">
                            <Music2 size={28} className="text-zinc-600" />
                          </div>
                          <p className="text-xs text-white truncate">Song {i}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section.section_type === "cta" && (
                  <div className="bg-gradient-to-r from-violet-900/50 to-purple-900/50 rounded-xl p-6 text-center">
                    <h3 className="text-xl font-bold text-white mb-2">{section.display_name}</h3>
                    <p className="text-zinc-300 mb-4">{section.description}</p>
                    <button className="px-6 py-2 bg-white text-black rounded-full font-medium">
                      Learn More
                    </button>
                  </div>
                )}

                {section.section_type === "custom" && (
                  <div className="bg-zinc-800/30 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-white mb-2">{section.display_name}</h3>
                    <p className="text-zinc-400 text-sm">{section.description || "Custom section content"}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Preview burners */}
            {burners.filter(b => b.is_active && b.platforms?.includes(previewPlatform)).slice(0, 2).map((burner) => (
              <div key={burner.burner_id} className="mb-4">
                <BurnerPreview burner={burner} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Hero Config Tab */}
        <TabsContent value="hero-config" className="space-y-4">
          <HeroConfigTab albums={albums} />
        </TabsContent>

        {/* Hero Banners Tab */}
        <TabsContent value="banners" className="space-y-4">
          <HeroBannersTab albums={albums} />
        </TabsContent>
      </Tabs>

      {/* Section Modal */}
      <Dialog open={isSectionModalOpen} onOpenChange={setIsSectionModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSection ? "Edit Section" : "Add New Section"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSection}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Internal Name *</label>
                  <Input
                    value={sectionForm.name}
                    onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                    placeholder="e.g., christmas_songs"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Display Name *</label>
                  <Input
                    value={sectionForm.display_name}
                    onChange={(e) => setSectionForm({ ...sectionForm, display_name: e.target.value })}
                    placeholder="e.g., Christmas Songs"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Section Type</label>
                  <Select value={sectionForm.section_type} onValueChange={(v) => setSectionForm({ ...sectionForm, section_type: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {SECTION_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Content Type</label>
                  <Select value={sectionForm.content_type} onValueChange={(v) => setSectionForm({ ...sectionForm, content_type: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {CONTENT_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Description</label>
                <Textarea
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  rows={2}
                />
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <label className="text-sm text-zinc-400 mb-2 block">Platform Targeting</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sectionForm.platforms.includes("app")}
                      onChange={(e) => {
                        const platforms = e.target.checked 
                          ? [...sectionForm.platforms, "app"]
                          : sectionForm.platforms.filter(p => p !== "app");
                        setSectionForm({ ...sectionForm, platforms });
                      }}
                      className="rounded border-zinc-700"
                    />
                    <Smartphone size={16} className="text-emerald-400" />
                    <span className="text-zinc-300">App</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sectionForm.platforms.includes("web")}
                      onChange={(e) => {
                        const platforms = e.target.checked 
                          ? [...sectionForm.platforms, "web"]
                          : sectionForm.platforms.filter(p => p !== "web");
                        setSectionForm({ ...sectionForm, platforms });
                      }}
                      className="rounded border-zinc-700"
                    />
                    <Monitor size={16} className="text-blue-400" />
                    <span className="text-zinc-300">Web</span>
                  </label>
                </div>
              </div>

              {sectionForm.section_type === "hero" && (
                <div className="border-t border-zinc-800 pt-4">
                  <label className="text-sm text-zinc-400 mb-2 block">Hero Background</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Background Color</label>
                      <Input
                        type="color"
                        value={sectionForm.background_color || "#1e1b4b"}
                        onChange={(e) => setSectionForm({ ...sectionForm, background_color: e.target.value })}
                        className="h-10 p-1 bg-zinc-950 border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Or Gradient</label>
                      <Input
                        value={sectionForm.background_gradient}
                        onChange={(e) => setSectionForm({ ...sectionForm, background_gradient: e.target.value })}
                        placeholder="linear-gradient(...)"
                        className="bg-zinc-950 border-zinc-800 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-zinc-800 pt-4">
                <label className="text-sm text-zinc-400 mb-2 block">Link Section To</label>
                <div className="grid grid-cols-2 gap-4">
                  <Select value={sectionForm.link_type} onValueChange={(v) => setSectionForm({ ...sectionForm, link_type: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue placeholder="Link type" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {LINK_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={sectionForm.link_target}
                    onChange={(e) => setSectionForm({ ...sectionForm, link_target: e.target.value })}
                    placeholder="Album ID or URL"
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSectionModalOpen(false)} className="border-zinc-700">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-section-btn">
                {editingSection ? "Update" : "Create"} Section
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Burner Modal */}
      <Dialog open={isBurnerModalOpen} onOpenChange={setIsBurnerModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBurner ? "Edit Burner" : "Create Burner"}</DialogTitle>
            <DialogDescription className="text-zinc-400">Design a promotional banner or call-to-action</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveBurner}>
            <div className="grid grid-cols-2 gap-6 py-4">
              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Internal Name *</label>
                  <Input
                    value={burnerForm.name}
                    onChange={(e) => setBurnerForm({ ...burnerForm, name: e.target.value })}
                    placeholder="e.g., premium_promo"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Icon</label>
                    <Select value={burnerForm.icon} onValueChange={(v) => setBurnerForm({ ...burnerForm, icon: v })}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {ICONS.map(icon => (
                          <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Icon Color</label>
                    <Input
                      type="color"
                      value={burnerForm.icon_color}
                      onChange={(e) => setBurnerForm({ ...burnerForm, icon_color: e.target.value })}
                      className="h-10 p-1 bg-zinc-950 border-zinc-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Headline *</label>
                  <Input
                    value={burnerForm.headline}
                    onChange={(e) => setBurnerForm({ ...burnerForm, headline: e.target.value })}
                    placeholder="Upgrade to Premium"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Subtitle</label>
                  <Textarea
                    value={burnerForm.subtitle}
                    onChange={(e) => setBurnerForm({ ...burnerForm, subtitle: e.target.value })}
                    placeholder="Enjoy ad-free music with offline listening"
                    className="bg-zinc-950 border-zinc-800 text-white"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Button Text *</label>
                    <Input
                      value={burnerForm.cta_text}
                      onChange={(e) => setBurnerForm({ ...burnerForm, cta_text: e.target.value })}
                      placeholder="Get Premium"
                      className="bg-zinc-950 border-zinc-800 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Link Type</label>
                    <Select value={burnerForm.cta_link_type} onValueChange={(v) => setBurnerForm({ ...burnerForm, cta_link_type: v })}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {LINK_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Link Target</label>
                  <Input
                    value={burnerForm.cta_link}
                    onChange={(e) => setBurnerForm({ ...burnerForm, cta_link: e.target.value })}
                    placeholder="/subscription or album ID or URL"
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>

                <div className="border-t border-zinc-800 pt-4">
                  <label className="text-sm text-zinc-400 mb-2 block">Styling</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Background Color</label>
                      <Input
                        type="color"
                        value={burnerForm.background_color}
                        onChange={(e) => setBurnerForm({ ...burnerForm, background_color: e.target.value })}
                        className="h-8 p-1 bg-zinc-950 border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Button Color</label>
                      <Input
                        type="color"
                        value={burnerForm.button_color}
                        onChange={(e) => setBurnerForm({ ...burnerForm, button_color: e.target.value })}
                        className="h-8 p-1 bg-zinc-950 border-zinc-800"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Platform Targeting</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={burnerForm.platforms.includes("app")}
                        onChange={(e) => {
                          const platforms = e.target.checked 
                            ? [...burnerForm.platforms, "app"]
                            : burnerForm.platforms.filter(p => p !== "app");
                          setBurnerForm({ ...burnerForm, platforms });
                        }}
                        className="rounded border-zinc-700"
                      />
                      <Smartphone size={16} className="text-emerald-400" />
                      <span className="text-zinc-300">App</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={burnerForm.platforms.includes("web")}
                        onChange={(e) => {
                          const platforms = e.target.checked 
                            ? [...burnerForm.platforms, "web"]
                            : burnerForm.platforms.filter(p => p !== "web");
                          setBurnerForm({ ...burnerForm, platforms });
                        }}
                        className="rounded border-zinc-700"
                      />
                      <Monitor size={16} className="text-blue-400" />
                      <span className="text-zinc-300">Web</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Live Preview</label>
                <BurnerPreview burner={burnerForm} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBurnerModalOpen(false)} className="border-zinc-700">Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-burner-btn">
                {editingBurner ? "Update" : "Create"} Burner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Content Assignment Modal */}
      <Dialog open={isContentModalOpen} onOpenChange={setIsContentModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Content to {selectedSection?.display_name}</DialogTitle>
            <DialogDescription className="text-zinc-400">Select content to display in this section</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="categories" className="py-4">
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="albums">Albums</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
            </TabsList>
            <TabsContent value="categories" className="space-y-2 mt-4 max-h-80 overflow-y-auto">
              {categories.map((cat) => (
                <label key={cat.category_id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    defaultChecked={selectedSection?.content_ids?.includes(cat.category_id)}
                    className="rounded border-zinc-700"
                    data-id={cat.category_id}
                    data-type="categories"
                  />
                  <Music2 size={20} className="text-violet-400" />
                  <span className="text-white">{cat.name}</span>
                </label>
              ))}
            </TabsContent>
            <TabsContent value="albums" className="space-y-2 mt-4 max-h-80 overflow-y-auto">
              {albums.map((album) => (
                <label key={album.album_id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    defaultChecked={selectedSection?.content_ids?.includes(album.album_id)}
                    className="rounded border-zinc-700"
                    data-id={album.album_id}
                    data-type="albums"
                  />
                  {album.thumbnail ? (
                    <img src={album.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-violet-600/20 flex items-center justify-center">
                      <Music2 size={16} className="text-violet-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-white">{album.title}</p>
                    <p className="text-xs text-zinc-500">{album.artist_name}</p>
                  </div>
                </label>
              ))}
            </TabsContent>
            <TabsContent value="other" className="space-y-4 mt-4 max-h-80 overflow-y-auto">
              {/* Churches Section */}
              <div>
                <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                  <Church size={16} /> Churches ({churches.length})
                </h4>
                <div className="space-y-2">
                  {churches.length > 0 ? churches.map((church) => (
                    <label key={church.church_id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        defaultChecked={selectedSection?.content_ids?.includes(church.church_id)}
                        className="rounded border-zinc-700"
                        data-id={church.church_id}
                        data-type="churches"
                      />
                      <div className="w-10 h-10 rounded bg-emerald-600/20 flex items-center justify-center">
                        <Church size={16} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white">{church.name}</p>
                        <p className="text-xs text-zinc-500">{church.location}</p>
                      </div>
                    </label>
                  )) : (
                    <p className="text-zinc-500 text-sm p-3">No churches available</p>
                  )}
                </div>
              </div>
              
              {/* Choirs/Artists Section */}
              <div>
                <h4 className="text-sm font-medium text-violet-400 mb-2 flex items-center gap-2">
                  <Users size={16} /> Choirs / Artists ({choirs.length})
                </h4>
                <div className="space-y-2">
                  {choirs.length > 0 ? choirs.map((choir) => (
                    <label key={choir.choir_id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg cursor-pointer hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        defaultChecked={selectedSection?.content_ids?.includes(choir.choir_id)}
                        className="rounded border-zinc-700"
                        data-id={choir.choir_id}
                        data-type="choirs"
                      />
                      {choir.profile_image ? (
                        <img src={choir.profile_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center">
                          <Users size={16} className="text-violet-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-white">{choir.name}</p>
                        <p className="text-xs text-zinc-500">{choir.church_affiliation || choir.location || 'Artist'}</p>
                      </div>
                    </label>
                  )) : (
                    <p className="text-zinc-500 text-sm p-3">No choirs/artists available</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsContentModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button
              onClick={() => {
                const checkboxes = document.querySelectorAll('[data-id]:checked');
                const contentIds = Array.from(checkboxes).map(cb => cb.dataset.id);
                const contentType = checkboxes[0]?.dataset.type || "categories";
                handleAssignContent(contentType, contentIds);
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
