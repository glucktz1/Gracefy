import { useEffect, useState } from "react";
import axios from "axios";
import { FolderTree, Plus, Edit2, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const CATEGORY_ICONS = ["🎵", "📖", "🎤", "🎧", "⛪", "✝️", "🙏", "📿", "🕊️", "💒"];

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "content",
    icon: "🎵",
    status: "active"
  });

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`, { withCredentials: true });
      setCategories(response.data.categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await axios.put(`${API}/categories/${editingCategory.category_id}`, formData, { withCredentials: true });
        toast.success("Category updated successfully");
      } else {
        await axios.post(`${API}/categories`, formData, { withCredentials: true });
        toast.success("Category created successfully");
      }
      setIsModalOpen(false);
      setEditingCategory(null);
      setFormData({ name: "", description: "", type: "content", icon: "🎵", status: "active" });
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      type: category.type,
      icon: category.icon || "🎵",
      status: category.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await axios.delete(`${API}/categories/${categoryId}`, { withCredentials: true });
      toast.success("Category deleted successfully");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  const getTypeBadge = (type) => {
    const styles = {
      content: "badge-violet",
      music: "badge-success",
      sermon: "badge-warning",
      podcast: "badge-info"
    };
    return <span className={`badge ${styles[type] || "badge-info"}`}>{type}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="categories-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Content Categories</h1>
          <p className="page-subtitle">Manage content categories for songs, sermons, and podcasts</p>
        </div>
        <Button
          onClick={() => {
            setEditingCategory(null);
            setFormData({ name: "", description: "", type: "content", icon: "🎵", status: "active" });
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-category-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Category
        </Button>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <FolderTree className="empty-state-icon" />
          <p className="empty-state-title">No categories yet</p>
          <p className="empty-state-text">Create your first category to organize content</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Card 
              key={category.category_id} 
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300"
              data-testid={`category-card-${category.category_id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center text-2xl">
                      {category.icon || "🎵"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{category.name}</h3>
                      {getTypeBadge(category.type)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="action-btn">
                        <MoreVertical size={18} className="text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => handleEdit(category)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(category.category_id)}
                        className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {category.description && (
                  <p className="text-zinc-500 text-sm line-clamp-2">{category.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className={`badge ${category.status === "active" ? "badge-success" : "badge-error"}`}>
                    {category.status}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {new Date(category.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Christmas Songs"
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="category-name-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this category..."
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={3}
                  data-testid="category-description-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="category-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="content">Content</SelectItem>
                    <SelectItem value="music">Music</SelectItem>
                    <SelectItem value="sermon">Sermon</SelectItem>
                    <SelectItem value="podcast">Podcast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="form-group">
                <label className="form-label">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                        formData.icon === icon 
                          ? "bg-violet-600 ring-2 ring-violet-400" 
                          : "bg-zinc-800 hover:bg-zinc-700"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="category-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-category-btn">
                {editingCategory ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
