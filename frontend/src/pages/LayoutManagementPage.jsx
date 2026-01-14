import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Layout, Plus, Trash2, Edit2, Eye, EyeOff, GripVertical, 
  Smartphone, Monitor, ChevronUp, ChevronDown, Save, RefreshCw,
  Image, Link, Calendar, Crown, Gift, Music2, Grid, Star, Megaphone,
  X, Check, ExternalLink, Play
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
  { value: "seasonal", label: "Seasonal Section", icon: Calendar },
  { value: "trending", label: "Trending/Popular", icon: Crown },
  { value: "cta", label: "Call-to-Action", icon: Megaphone },
  { value: "custom", label: "Custom Section", icon: Layout },
];

const CONTENT_TYPES = [
  { value: "categories", label: "Categories" },
  { value: "albums", label: "Albums" },
  { value: "songs", label: "Songs" },
  { value: "playlists", label: "Playlists" },
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
const getIconComponent = (iconName) => {
  const icons = {
    crown: Crown, gift: Gift, music: Music2, star: Star
  };
  return icons[iconName] || Crown;
};

// Burner preview component - moved outside main component to avoid re-creation on each render
const BurnerPreview = ({ burner, small = false }) => {
  const IconComp = getIconComponent(burner.icon);
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

export default function LayoutManagementPage() {
  const [sections, setSections] = useState([]);
  const [burners, setBurners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [albums, setAlbums] = useState([]);
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
      const [sectionsRes, burnersRes, categoriesRes, albumsRes] = await Promise.all([
        axios.get(`${API}/layout/sections`, { withCredentials: true }),
        axios.get(`${API}/layout/burners`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/albums`, { withCredentials: true })
      ]);
      setSections(sectionsRes.data.sections || []);
      setBurners(burnersRes.data.burners || []);
      setCategories(categoriesRes.data.categories || []);
      setAlbums(albumsRes.data.albums || []);
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
      toast.success(isActive ? "Section deactivated" : "Section activated");
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
          <TabsTrigger value="burners" className="data-[state=active]:bg-violet-600">
            <Megaphone size={14} className="mr-2" /> Burners ({burners.length})
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
                className={`bg-zinc-900/50 border-zinc-800 ${!section.is_active ? 'opacity-50' : ''}`}
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
                    <div className="w-12 h-12 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                      {SECTION_TYPES.find(t => t.value === section.section_type)?.icon ? 
                        (() => { const Icon = SECTION_TYPES.find(t => t.value === section.section_type)?.icon; return <Icon size={24} className="text-violet-400" />; })()
                        : <Layout size={24} className="text-violet-400" />
                      }
                    </div>

                    {/* Section info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-white">{section.display_name}</h4>
                        {getPlatformBadge(section.platforms)}
                        <Badge className="bg-zinc-700 text-zinc-300">{section.section_type}</Badge>
                        {!section.is_active && <Badge className="bg-red-500/20 text-red-400">Inactive</Badge>}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleSection(section.section_id, section.is_active)}
                        className={section.is_active ? "text-emerald-400" : "text-zinc-500"}
                      >
                        {section.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </Button>
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
            <DialogDescription className="text-zinc-400">Select categories or albums to display in this section</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="categories" className="py-4">
            <TabsList className="bg-zinc-800">
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="albums">Albums</TabsTrigger>
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
