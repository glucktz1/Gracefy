import { useEffect, useState } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Search, Edit2, Trash2, Eye, MoreVertical, Upload,
  Play, Clock, Users, ChevronRight, ChevronDown, Mic2, FileAudio,
  Layers, ListOrdered, Music2, Image, DollarSign, Tag, Check, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CONTENT_TYPES = [
  { value: "teaching", label: "Teaching", icon: BookOpen },
  { value: "sermon", label: "Sermon", icon: Mic2 },
  { value: "prayer", label: "Prayer", icon: BookOpen },
  { value: "reflection", label: "Reflection", icon: BookOpen },
  { value: "devotion", label: "Devotion", icon: BookOpen },
  { value: "study", label: "Bible Study", icon: BookOpen },
  { value: "course", label: "Course", icon: Layers }
];

export default function ContentManagementPage() {
  const [containers, setContainers] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Modal states
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [containerDetail, setContainerDetail] = useState(null);
  
  // Form states
  const [containerForm, setContainerForm] = useState({
    title: "", description: "", content_type: "teaching",
    leader_id: "", category_id: "", monetization_type: "standard",
    thumbnail_url: "", tags: "", is_featured: false
  });
  
  const [seriesForm, setSeriesForm] = useState({
    title: "", description: "", thumbnail_url: ""
  });
  
  const [episodeForm, setEpisodeForm] = useState({
    title: "", description: "", audio_url: "", duration_seconds: 0, thumbnail_url: ""
  });
  
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filterType, filterStatus]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("content_type", filterType);
      if (filterStatus !== "all") params.append("status", filterStatus);
      
      const [containersRes, leadersRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/content-containers?${params}`, { withCredentials: true }),
        axios.get(`${API}/leaders`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true })
      ]);
      
      setContainers(containersRes.data.containers || []);
      setLeaders(leadersRes.data.leaders || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  const fetchContainerDetail = async (containerId) => {
    try {
      const res = await axios.get(`${API}/content-containers/${containerId}`, { withCredentials: true });
      setContainerDetail(res.data);
      setIsDetailViewOpen(true);
    } catch (error) {
      toast.error("Failed to load content details");
    }
  };

  const handleFileUpload = async (file, type = "image") => {
    if (!file) return null;
    
    const maxSize = type === "audio" ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Max ${type === "audio" ? "50MB" : "5MB"}`);
      return null;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true
      });
      toast.success("File uploaded!");
      return res.data.url;
    } catch (error) {
      toast.error("Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCreateContainer = async () => {
    if (!containerForm.title) {
      toast.error("Title is required");
      return;
    }
    
    try {
      const data = {
        ...containerForm,
        tags: containerForm.tags ? containerForm.tags.split(",").map(t => t.trim()) : []
      };
      
      if (selectedContainer) {
        await axios.put(`${API}/content-containers/${selectedContainer.container_id}`, data, { withCredentials: true });
        toast.success("Content updated!");
      } else {
        await axios.post(`${API}/content-containers`, data, { withCredentials: true });
        toast.success("Content created!");
      }
      
      setIsContainerModalOpen(false);
      resetContainerForm();
      fetchData();
    } catch (error) {
      toast.error("Failed to save content");
    }
  };

  const handleCreateSeries = async () => {
    if (!seriesForm.title || !selectedContainer) {
      toast.error("Title is required");
      return;
    }
    
    try {
      const data = {
        ...seriesForm,
        container_id: selectedContainer.container_id
      };
      
      if (selectedSeries) {
        await axios.put(`${API}/content-series/${selectedSeries.series_id}`, data, { withCredentials: true });
        toast.success("Series updated!");
      } else {
        await axios.post(`${API}/content-series`, data, { withCredentials: true });
        toast.success("Series created!");
      }
      
      setIsSeriesModalOpen(false);
      resetSeriesForm();
      fetchContainerDetail(selectedContainer.container_id);
    } catch (error) {
      toast.error("Failed to save series");
    }
  };

  const handleCreateEpisode = async () => {
    if (!episodeForm.title || !selectedSeries) {
      toast.error("Title is required");
      return;
    }
    
    try {
      const data = {
        ...episodeForm,
        series_id: selectedSeries.series_id,
        container_id: selectedContainer.container_id
      };
      
      await axios.post(`${API}/content-episodes`, data, { withCredentials: true });
      toast.success("Episode created!");
      
      setIsEpisodeModalOpen(false);
      resetEpisodeForm();
      fetchContainerDetail(selectedContainer.container_id);
    } catch (error) {
      toast.error("Failed to create episode");
    }
  };

  const handleDeleteContainer = async (containerId) => {
    if (!window.confirm("Delete this content and all series/episodes?")) return;
    try {
      await axios.delete(`${API}/content-containers/${containerId}`, { withCredentials: true });
      toast.success("Content deleted!");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleDeleteSeries = async (seriesId) => {
    if (!window.confirm("Delete this series and all episodes?")) return;
    try {
      await axios.delete(`${API}/content-series/${seriesId}`, { withCredentials: true });
      toast.success("Series deleted!");
      fetchContainerDetail(selectedContainer.container_id);
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleDeleteEpisode = async (episodeId) => {
    if (!window.confirm("Delete this episode?")) return;
    try {
      await axios.delete(`${API}/content-episodes/${episodeId}`, { withCredentials: true });
      toast.success("Episode deleted!");
      fetchContainerDetail(selectedContainer.container_id);
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const openEditContainer = (container) => {
    setSelectedContainer(container);
    setContainerForm({
      title: container.title || "",
      description: container.description || "",
      content_type: container.content_type || "teaching",
      leader_id: container.leader_id || "",
      category_id: container.category_id || "",
      monetization_type: container.monetization_type || "standard",
      thumbnail_url: container.thumbnail_url || "",
      tags: (container.tags || []).join(", "),
      is_featured: container.is_featured || false
    });
    setIsContainerModalOpen(true);
  };

  const openAddSeries = (container) => {
    setSelectedContainer(container);
    resetSeriesForm();
    setIsSeriesModalOpen(true);
  };

  const openAddEpisode = (series) => {
    setSelectedSeries(series);
    resetEpisodeForm();
    setIsEpisodeModalOpen(true);
  };

  const resetContainerForm = () => {
    setSelectedContainer(null);
    setContainerForm({
      title: "", description: "", content_type: "teaching",
      leader_id: "", category_id: "", monetization_type: "standard",
      thumbnail_url: "", tags: "", is_featured: false
    });
  };

  const resetSeriesForm = () => {
    setSelectedSeries(null);
    setSeriesForm({ title: "", description: "", thumbnail_url: "" });
  };

  const resetEpisodeForm = () => {
    setEpisodeForm({ title: "", description: "", audio_url: "", duration_seconds: 0, thumbnail_url: "" });
  };

  const filteredContainers = containers.filter(c =>
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.leader_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BookOpen className="text-violet-500" size={28} />
            Leader Content
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Manage teachings, sermons, prayers, and more</p>
        </div>
        <Button onClick={() => { resetContainerForm(); setIsContainerModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus size={18} className="mr-2" /> Add Content
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Layers size={20} className="text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{containers.length}</p>
                <p className="text-xs text-zinc-400">Total Content</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ListOrdered size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{containers.reduce((a, c) => a + (c.total_series || 0), 0)}</p>
                <p className="text-xs text-zinc-400">Total Series</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <FileAudio size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{containers.reduce((a, c) => a + (c.total_episodes || 0), 0)}</p>
                <p className="text-xs text-zinc-400">Total Episodes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Clock size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{formatDuration(containers.reduce((a, c) => a + (c.total_duration_minutes || 0), 0))}</p>
                <p className="text-xs text-zinc-400">Total Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content..."
            className="pl-10 bg-zinc-900 border-zinc-700"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700">
            <SelectValue placeholder="Content Type" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Types</SelectItem>
            {CONTENT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 bg-zinc-900 border-zinc-700">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content List */}
      <div className="grid gap-4">
        {filteredContainers.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p>No content found</p>
            <Button onClick={() => { resetContainerForm(); setIsContainerModalOpen(true); }} variant="link" className="text-violet-400 mt-2">
              Create your first content
            </Button>
          </div>
        ) : (
          filteredContainers.map((container) => (
            <Card key={container.container_id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-24 h-24 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                    {container.thumbnail_url ? (
                      <img src={container.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={32} className="text-zinc-600" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-white text-lg">{container.title}</h3>
                        <p className="text-sm text-zinc-400">{container.leader_name || "No leader assigned"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-zinc-700">
                          {CONTENT_TYPES.find(t => t.value === container.content_type)?.label || container.content_type}
                        </Badge>
                        <Badge className={container.monetization_type === "premium" ? "bg-amber-500/20 text-amber-400" : container.monetization_type === "free" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}>
                          {container.monetization_type}
                        </Badge>
                        {container.is_featured && <Badge className="bg-violet-500/20 text-violet-400">Featured</Badge>}
                      </div>
                    </div>
                    
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-1">{container.description || "No description"}</p>
                    
                    <div className="flex items-center gap-6 mt-3 text-sm text-zinc-400">
                      <span className="flex items-center gap-1"><ListOrdered size={14} /> {container.total_series || 0} series</span>
                      <span className="flex items-center gap-1"><FileAudio size={14} /> {container.total_episodes || 0} episodes</span>
                      <span className="flex items-center gap-1"><Clock size={14} /> {formatDuration(container.total_duration_minutes || 0)}</span>
                      <span className="flex items-center gap-1"><Play size={14} /> {(container.play_count || 0).toLocaleString()} plays</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="border-zinc-700" onClick={() => fetchContainerDetail(container.container_id)}>
                      <Eye size={14} className="mr-1" /> View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><MoreVertical size={16} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                        <DropdownMenuItem onClick={() => openEditContainer(container)} className="text-zinc-300">
                          <Edit2 size={14} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedContainer(container); openAddSeries(container); }} className="text-emerald-400">
                          <Plus size={14} className="mr-2" /> Add Series
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteContainer(container.container_id)} className="text-red-400">
                          <Trash2 size={14} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Container Modal */}
      <Dialog open={isContainerModalOpen} onOpenChange={setIsContainerModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContainer ? "Edit Content" : "Add New Content"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Create a content container for teachings, sermons, or other leader content
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm text-zinc-400 mb-1.5 block">Title *</label>
                <Input
                  value={containerForm.title}
                  onChange={(e) => setContainerForm({ ...containerForm, title: e.target.value })}
                  placeholder="e.g., Parenting in Faith"
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Content Type *</label>
                <Select value={containerForm.content_type} onValueChange={(v) => setContainerForm({ ...containerForm, content_type: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {CONTENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Leader/Provider</label>
                <Select value={containerForm.leader_id} onValueChange={(v) => setContainerForm({ ...containerForm, leader_id: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Select leader" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="">No leader</SelectItem>
                    {leaders.map(l => (
                      <SelectItem key={l.leader_id} value={l.leader_id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Category</label>
                <Select value={containerForm.category_id} onValueChange={(v) => setContainerForm({ ...containerForm, category_id: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="">No category</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.category_id} value={c.category_id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Monetization</label>
                <Select value={containerForm.monetization_type} onValueChange={(v) => setContainerForm({ ...containerForm, monetization_type: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="col-span-2">
                <label className="text-sm text-zinc-400 mb-1.5 block">Description</label>
                <Textarea
                  value={containerForm.description}
                  onChange={(e) => setContainerForm({ ...containerForm, description: e.target.value })}
                  placeholder="Describe this content..."
                  className="bg-zinc-950 border-zinc-700 min-h-[80px]"
                />
              </div>
              
              <div className="col-span-2">
                <label className="text-sm text-zinc-400 mb-1.5 block">Thumbnail</label>
                <div className="flex gap-3">
                  <Input
                    value={containerForm.thumbnail_url}
                    onChange={(e) => setContainerForm({ ...containerForm, thumbnail_url: e.target.value })}
                    placeholder="Image URL"
                    className="bg-zinc-950 border-zinc-700 flex-1"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const url = await handleFileUpload(e.target.files?.[0], "image");
                        if (url) setContainerForm({ ...containerForm, thumbnail_url: url });
                      }}
                    />
                    <Button type="button" variant="outline" className="border-zinc-700" disabled={uploading}>
                      <Upload size={14} className="mr-1" /> {uploading ? "..." : "Upload"}
                    </Button>
                  </label>
                </div>
              </div>
              
              <div className="col-span-2">
                <label className="text-sm text-zinc-400 mb-1.5 block">Tags (comma separated)</label>
                <Input
                  value={containerForm.tags}
                  onChange={(e) => setContainerForm({ ...containerForm, tags: e.target.value })}
                  placeholder="e.g., family, faith, parenting"
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
              
              <div className="col-span-2 flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm">Featured Content</span>
                <Switch
                  checked={containerForm.is_featured}
                  onCheckedChange={(checked) => setContainerForm({ ...containerForm, is_featured: checked })}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContainerModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button onClick={handleCreateContainer} className="bg-emerald-600 hover:bg-emerald-700">
              {selectedContainer ? "Update" : "Create"} Content
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Series Modal */}
      <Dialog open={isSeriesModalOpen} onOpenChange={setIsSeriesModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Series/Lesson</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new series to "{selectedContainer?.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Title *</label>
              <Input
                value={seriesForm.title}
                onChange={(e) => setSeriesForm({ ...seriesForm, title: e.target.value })}
                placeholder="e.g., Lesson 1: Introduction"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Description</label>
              <Textarea
                value={seriesForm.description}
                onChange={(e) => setSeriesForm({ ...seriesForm, description: e.target.value })}
                placeholder="Describe this series..."
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSeriesModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button onClick={handleCreateSeries} className="bg-emerald-600 hover:bg-emerald-700">Create Series</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Episode Modal */}
      <Dialog open={isEpisodeModalOpen} onOpenChange={setIsEpisodeModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Episode/Topic</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new episode to "{selectedSeries?.title}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Title *</label>
              <Input
                value={episodeForm.title}
                onChange={(e) => setEpisodeForm({ ...episodeForm, title: e.target.value })}
                placeholder="e.g., Topic 1: Understanding Your Child"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Description</label>
              <Textarea
                value={episodeForm.description}
                onChange={(e) => setEpisodeForm({ ...episodeForm, description: e.target.value })}
                placeholder="Describe this episode..."
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Audio File</label>
              <div className="flex gap-3">
                <Input
                  value={episodeForm.audio_url}
                  onChange={(e) => setEpisodeForm({ ...episodeForm, audio_url: e.target.value })}
                  placeholder="Audio URL"
                  className="bg-zinc-950 border-zinc-700 flex-1"
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (e) => {
                      const url = await handleFileUpload(e.target.files?.[0], "audio");
                      if (url) setEpisodeForm({ ...episodeForm, audio_url: url });
                    }}
                  />
                  <Button type="button" variant="outline" className="border-zinc-700" disabled={uploading}>
                    <Upload size={14} className="mr-1" /> {uploading ? "..." : "Upload"}
                  </Button>
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Duration (seconds)</label>
              <Input
                type="number"
                value={episodeForm.duration_seconds}
                onChange={(e) => setEpisodeForm({ ...episodeForm, duration_seconds: parseInt(e.target.value) || 0 })}
                placeholder="e.g., 1800 for 30 minutes"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEpisodeModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button onClick={handleCreateEpisode} className="bg-emerald-600 hover:bg-emerald-700">Create Episode</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal */}
      <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {containerDetail?.container?.thumbnail_url && (
                <img src={containerDetail.container.thumbnail_url} alt="" className="w-12 h-12 rounded object-cover" />
              )}
              {containerDetail?.container?.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Container Info */}
            <div className="flex gap-4 text-sm text-zinc-400">
              <span>{containerDetail?.container?.total_series || 0} series</span>
              <span>{containerDetail?.container?.total_episodes || 0} episodes</span>
              <span>{formatDuration(containerDetail?.container?.total_duration_minutes || 0)}</span>
            </div>
            
            {/* Add Series Button */}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setSelectedContainer(containerDetail?.container); setIsSeriesModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus size={14} className="mr-1" /> Add Series
              </Button>
            </div>
            
            {/* Series List */}
            <div className="space-y-4">
              {containerDetail?.series?.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <ListOrdered size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No series added yet</p>
                </div>
              ) : (
                containerDetail?.series?.map((series, sIdx) => (
                  <Card key={series.series_id} className="bg-zinc-800/50 border-zinc-700">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center text-xs text-violet-400">{sIdx + 1}</span>
                          {series.title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedContainer(containerDetail?.container); setSelectedSeries(series); setIsEpisodeModalOpen(true); }}>
                            <Plus size={14} className="mr-1" /> Episode
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDeleteSeries(series.series_id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500">{series.total_episodes || 0} episodes • {formatDuration(series.total_duration_minutes || 0)}</p>
                    </CardHeader>
                    <CardContent>
                      {series.episodes?.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-2">No episodes yet</p>
                      ) : (
                        <div className="space-y-2">
                          {series.episodes?.map((ep, eIdx) => (
                            <div key={ep.episode_id} className="flex items-center justify-between p-2 bg-zinc-900/50 rounded">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500 w-4">{eIdx + 1}</span>
                                <div>
                                  <p className="text-sm text-white">{ep.title}</p>
                                  <p className="text-xs text-zinc-500">{Math.floor(ep.duration_seconds / 60)} min</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {ep.audio_url && <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">Audio</Badge>}
                                <Button size="sm" variant="ghost" className="text-red-400 h-7 w-7 p-0" onClick={() => handleDeleteEpisode(ep.episode_id)}>
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
