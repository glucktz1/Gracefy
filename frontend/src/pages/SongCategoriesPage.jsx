import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Tags, Plus, Edit2, Trash2, Save, Search, RefreshCw, Palette, 
  Gift, Sun, Cross, Heart, Flower, Music, Disc, X, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Icon mapping for categories
const CATEGORY_ICONS = {
  gift: Gift,
  sun: Sun,
  cross: Cross,
  heart: Heart,
  flower: Flower,
  music: Music,
  disc: Disc,
  tags: Tags,
};

// Color presets
const COLOR_PRESETS = [
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#2563eb" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
];

export default function SongCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    name_sw: "",
    description: "",
    color: "#6366f1",
    icon: "music",
    sort_order: 0,
  });

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/song-categories/all`, { withCredentials: true });
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load song categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSyncDefaults = async () => {
    setSyncing(true);
    try {
      const response = await axios.post(`${API}/song-categories/sync-defaults`, {}, { withCredentials: true });
      toast.success(response.data.message);
      if (response.data.added?.length > 0) {
        toast.info(`Added: ${response.data.added.join(", ")}`);
      }
      fetchCategories();
    } catch (error) {
      toast.error("Failed to sync default categories");
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      if (editingCategory) {
        await axios.put(`${API}/song-categories/${editingCategory.song_category_id}`, formData, { withCredentials: true });
        toast.success("Category updated successfully");
      } else {
        await axios.post(`${API}/song-categories`, formData, { withCredentials: true });
        toast.success("Category created successfully");
      }
      setIsModalOpen(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save category");
    }
  };

  const handleDelete = async (categoryId, isSystem) => {
    if (isSystem) {
      toast.error("Cannot delete system category");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    
    try {
      await axios.delete(`${API}/song-categories/${categoryId}`, { withCredentials: true });
      toast.success("Category deleted");
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete category");
    }
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || "",
      name_sw: category.name_sw || "",
      description: category.description || "",
      color: category.color || "#6366f1",
      icon: category.icon || "music",
      sort_order: category.sort_order || 0,
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      name_sw: "",
      description: "",
      color: "#6366f1",
      icon: "music",
      sort_order: 0,
    });
  };

  const filteredCategories = categories.filter(cat =>
    cat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.name_sw?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  // Helper function to render icons
  const renderIcon = (iconName, className, style) => {
    const Icon = CATEGORY_ICONS[iconName] || Tags;
    return <Icon className={className} style={style} />;
  };

  return (
    <div className="p-6 space-y-6" data-testid="song-categories-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tags className="text-violet-400" /> Song Categories
          </h1>
          <p className="text-zinc-400 mt-1">Manage song categories like Christmas, Easter, Lent, etc.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleSyncDefaults} 
            variant="outline" 
            className="border-zinc-700 text-zinc-300"
            disabled={syncing}
          >
            <RefreshCw size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} /> 
            Sync Defaults
          </Button>
          <Button 
            onClick={() => { resetForm(); setIsModalOpen(true); }} 
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Plus size={16} className="mr-2" /> Add Category
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={16} />
        <Input
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-zinc-950 border-zinc-800 text-white"
        />
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCategories.map((category) => (
          <Card 
            key={category.song_category_id} 
            className="bg-zinc-900/50 border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: category.color + '20' }}
                >
                  {renderIcon(category.icon, "w-6 h-6", { color: category.color })}
                </div>
                <div className="flex gap-1">
                  {category.is_system && (
                    <Badge variant="outline" className="text-xs bg-zinc-800 text-zinc-400 border-zinc-700">
                      System
                    </Badge>
                  )}
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-1">{category.name}</h3>
              {category.name_sw && (
                <p className="text-sm text-zinc-400 mb-2">{category.name_sw}</p>
              )}
              {category.description && (
                <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{category.description}</p>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full border border-zinc-600"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-xs text-zinc-500">Order: {category.sort_order}</span>
                </div>
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => openEditModal(category)} 
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleDelete(category.song_category_id, category.is_system)} 
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400"
                    disabled={category.is_system}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredCategories.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            <Tags size={48} className="mx-auto mb-4 opacity-50" />
            <p>No categories found. Click &quot;Sync Defaults&quot; to add default categories.</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory?.is_system ? 'You can edit name and description of system categories' : 'Add a new song category'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Name (English) *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Christmas"
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Name (Swahili)</label>
              <Input
                value={formData.name_sw}
                onChange={(e) => setFormData({ ...formData, name_sw: e.target.value })}
                placeholder="e.g., Krismasi"
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Icon</label>
                <Select value={formData.icon} onValueChange={(v) => setFormData({ ...formData, icon: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {Object.keys(CATEGORY_ICONS).map(icon => (
                      <SelectItem key={icon} value={icon} className="text-white">
                        <span className="flex items-center gap-2">
                          {renderIcon(icon, "w-4 h-4")}
                          {icon}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Sort Order</label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color.value 
                        ? 'border-white scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            
            {/* Preview */}
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950">
              <p className="text-xs text-zinc-500 mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: formData.color + '20' }}
                >
                  {renderIcon(formData.icon, "w-5 h-5", { color: formData.color })}
                </div>
                <div>
                  <p className="text-white font-medium">{formData.name || 'Category Name'}</p>
                  {formData.name_sw && <p className="text-sm text-zinc-400">{formData.name_sw}</p>}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-violet-600 hover:bg-violet-700">
              <Save size={16} className="mr-2" /> {editingCategory ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
