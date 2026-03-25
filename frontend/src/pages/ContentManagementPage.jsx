import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Search, Edit2, Trash2, Eye, MoreVertical, Upload,
  Play, Pause, Clock, Users, ChevronRight, ChevronDown, Mic2, FileAudio,
  Layers, ListOrdered, Music2, Image, DollarSign, Tag, Check, X,
  Calendar, Filter, RefreshCw, BookMarked, Headphones, ToggleLeft, ToggleRight
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
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
    title: "", description: "", audio_url: "", duration_seconds: 0
  });
  
  const [uploading, setUploading] = useState(false);
  
  // File input refs
  const containerThumbnailRef = useRef(null);
  const seriesThumbnailRef = useRef(null);
  const episodeAudioRef = useRef(null);

  // Neno la Leo State
  const [activeTab, setActiveTab] = useState("teachings");
  const [nenoList, setNenoList] = useState([]);
  const [nenoLeaders, setNenoLeaders] = useState([]);
  const [nenoLoading, setNenoLoading] = useState(false);
  const [nenoFilter, setNenoFilter] = useState({ leader: "all", date: "", status: "all" });
  const [nenoSearch, setNenoSearch] = useState("");
  const [playingNenoId, setPlayingNenoId] = useState(null);
  const [playingAudioType, setPlayingAudioType] = useState(null);
  const nenoAudioRef = useRef(null);
  const [isNenoEditModalOpen, setIsNenoEditModalOpen] = useState(false);
  const [editingNeno, setEditingNeno] = useState(null);

  useEffect(() => {
    fetchData();
  }, [filterType, filterStatus]);

  useEffect(() => {
    if (activeTab === "neno") {
      fetchNenoData();
    }
  }, [activeTab]);

  const fetchNenoData = async () => {
    setNenoLoading(true);
    try {
      const [nenoRes, leadersRes] = await Promise.all([
        axios.get(`${API}/neno-la-leo/admin/neno`, { withCredentials: true }),
        axios.get(`${API}/neno-la-leo/admin/leaders`, { withCredentials: true })
      ]);
      setNenoList(nenoRes.data.neno_list || []);
      setNenoLeaders(leadersRes.data.leaders || []);
    } catch (error) {
      console.error("Error fetching Neno la Leo:", error);
      toast.error("Failed to load Neno la Leo content");
    } finally {
      setNenoLoading(false);
    }
  };

  const handleNenoToggleActive = async (neno) => {
    try {
      await axios.put(`${API}/neno-la-leo/admin/neno/${neno.neno_id}`, {
        ...neno,
        is_active: !neno.is_active
      }, { withCredentials: true });
      toast.success(neno.is_active ? "Neno deactivated" : "Neno activated");
      fetchNenoData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleNenoDelete = async (nenoId) => {
    if (!window.confirm("Are you sure you want to delete this Neno la Leo entry?")) return;
    try {
      await axios.delete(`${API}/neno-la-leo/admin/neno/${nenoId}`, { withCredentials: true });
      toast.success("Neno la Leo deleted");
      fetchNenoData();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const handleNenoPlay = (neno, audioType) => {
    const audioUrl = audioType === 'reading' ? neno.reading_audio_url : neno.reflection_audio_url;
    if (!audioUrl) return;

    // If same audio playing, stop
    if (playingNenoId === neno.neno_id && playingAudioType === audioType) {
      if (nenoAudioRef.current) {
        nenoAudioRef.current.pause();
        nenoAudioRef.current = null;
      }
      setPlayingNenoId(null);
      setPlayingAudioType(null);
      return;
    }

    // Stop any currently playing
    if (nenoAudioRef.current) {
      nenoAudioRef.current.pause();
    }

    // Play new
    const audio = new Audio(audioUrl);
    audio.play();
    nenoAudioRef.current = audio;
    setPlayingNenoId(neno.neno_id);
    setPlayingAudioType(audioType);

    audio.onended = () => {
      setPlayingNenoId(null);
      setPlayingAudioType(null);
    };
  };

  const openNenoEditModal = (neno) => {
    setEditingNeno(neno);
    setIsNenoEditModalOpen(true);
  };

  const handleNenoUpdate = async () => {
    if (!editingNeno) return;
    try {
      await axios.put(`${API}/neno-la-leo/admin/neno/${editingNeno.neno_id}`, editingNeno, { withCredentials: true });
      toast.success("Neno la Leo updated");
      setIsNenoEditModalOpen(false);
      setEditingNeno(null);
      fetchNenoData();
    } catch (error) {
      toast.error("Failed to update");
    }
  };

  // Filter Neno list
  const filteredNenoList = nenoList.filter(neno => {
    if (nenoFilter.leader !== "all" && neno.leader_id !== nenoFilter.leader) return false;
    if (nenoFilter.status === "active" && !neno.is_active) return false;
    if (nenoFilter.status === "inactive" && neno.is_active) return false;
    if (nenoFilter.date && neno.word_date !== nenoFilter.date) return false;
    if (nenoSearch) {
      const search = nenoSearch.toLowerCase();
      return (
        neno.verse_reference?.toLowerCase().includes(search) ||
        neno.leader?.name?.toLowerCase().includes(search) ||
        neno.book?.toLowerCase().includes(search)
      );
    }
    return true;
  });

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

  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (file, type = "image") => {
    if (!file) return null;
    
    const maxSize = type === "audio" ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Max ${type === "audio" ? "100MB" : "5MB"}`);
      return null;
    }
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Use dedicated content upload endpoints for Supabase storage
      const endpoint = type === "audio" 
        ? `${API}/content/upload-audio` 
        : `${API}/content/upload-thumbnail`;
      
      const res = await axios.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });
      
      toast.success(`${type === "audio" ? "Audio" : "Image"} uploaded successfully!`);
      return res.data.url;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Upload failed");
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
        // container_id is automatically derived from series on backend
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
    setEpisodeForm({ title: "", description: "", audio_url: "", duration_seconds: 0 });
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
    <div className="space-y-6 p-6" data-testid="content-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BookOpen className="text-violet-500" size={28} />
            Content Management
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Manage all leader content including teachings and Neno la Leo</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-800/50 border border-zinc-700 p-1 w-fit">
          <TabsTrigger value="teachings" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white px-6">
            <BookOpen size={16} className="mr-2" /> Mafundisho
          </TabsTrigger>
          <TabsTrigger value="neno" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-6">
            <BookMarked size={16} className="mr-2" /> Neno la Leo
          </TabsTrigger>
        </TabsList>

        {/* Mafundisho (Teachings) Tab */}
        <TabsContent value="teachings" className="mt-6 space-y-6">
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

          {/* Filters & Add Button */}
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-4 items-center flex-1">
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
            <Button onClick={() => { resetContainerForm(); setIsContainerModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus size={18} className="mr-2" /> Add Content
            </Button>
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
        </TabsContent>

        {/* Neno la Leo Tab */}
        <TabsContent value="neno" className="mt-6 space-y-6">
          {/* Neno Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <BookMarked size={20} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{nenoList.length}</p>
                    <p className="text-xs text-zinc-400">Total Entries</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Check size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{nenoList.filter(n => n.is_active).length}</p>
                    <p className="text-xs text-zinc-400">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Calendar size={20} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{nenoList.filter(n => !n.is_active).length}</p>
                    <p className="text-xs text-zinc-400">Scheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <Users size={20} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{nenoLeaders.length}</p>
                    <p className="text-xs text-zinc-400">Leaders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Neno Filters */}
          <div className="flex gap-4 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <Input
                value={nenoSearch}
                onChange={(e) => setNenoSearch(e.target.value)}
                placeholder="Search by verse or leader..."
                className="pl-10 bg-zinc-900 border-zinc-700"
              />
            </div>
            <Select value={nenoFilter.leader} onValueChange={(v) => setNenoFilter({...nenoFilter, leader: v})}>
              <SelectTrigger className="w-48 bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="All Leaders" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Leaders</SelectItem>
                {nenoLeaders.map(l => (
                  <SelectItem key={l.leader_id} value={l.leader_id}>{l.title} {l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={nenoFilter.status} onValueChange={(v) => setNenoFilter({...nenoFilter, status: v})}>
              <SelectTrigger className="w-36 bg-zinc-900 border-zinc-700">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Scheduled</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={nenoFilter.date}
              onChange={(e) => setNenoFilter({...nenoFilter, date: e.target.value})}
              className="w-40 bg-zinc-900 border-zinc-700"
              placeholder="Filter by date"
            />
            <Button variant="outline" className="border-zinc-700" onClick={fetchNenoData}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
          </div>

          {/* Neno Table */}
          {nenoLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableHead>Verse Reference</TableHead>
                    <TableHead>Leader</TableHead>
                    <TableHead>Word Date</TableHead>
                    <TableHead>Audio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plays</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNenoList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-zinc-400">
                        <BookMarked size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No Neno la Leo entries found</p>
                        <p className="text-sm mt-1">Go to <a href="/admin/neno-la-leo" className="text-emerald-400 hover:underline">Neno la Leo page</a> to add new entries</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNenoList.map((neno) => (
                      <TableRow key={neno.neno_id} className="border-zinc-800 hover:bg-zinc-800/50">
                        <TableCell className="font-medium">{neno.verse_reference}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {neno.leader?.photo_url ? (
                              <img src={neno.leader.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                                <Users size={14} />
                              </div>
                            )}
                            <span className="text-sm">{neno.leader?.title} {neno.leader?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{neno.word_date}</p>
                            <p className="text-xs text-zinc-500">{neno.word_day_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {neno.reading_audio_url && (
                              <Button
                                size="sm"
                                variant={playingNenoId === neno.neno_id && playingAudioType === 'reading' ? "default" : "outline"}
                                className={`h-7 px-2 ${playingNenoId === neno.neno_id && playingAudioType === 'reading' ? 'bg-emerald-600' : 'border-zinc-700'}`}
                                onClick={() => handleNenoPlay(neno, 'reading')}
                              >
                                {playingNenoId === neno.neno_id && playingAudioType === 'reading' ? <Pause size={12} /> : <Play size={12} />}
                                <span className="ml-1 text-xs">Read</span>
                              </Button>
                            )}
                            {neno.reflection_audio_url && (
                              <Button
                                size="sm"
                                variant={playingNenoId === neno.neno_id && playingAudioType === 'reflection' ? "default" : "outline"}
                                className={`h-7 px-2 ${playingNenoId === neno.neno_id && playingAudioType === 'reflection' ? 'bg-violet-600' : 'border-zinc-700'}`}
                                onClick={() => handleNenoPlay(neno, 'reflection')}
                              >
                                {playingNenoId === neno.neno_id && playingAudioType === 'reflection' ? <Pause size={12} /> : <Play size={12} />}
                                <span className="ml-1 text-xs">Reflect</span>
                              </Button>
                            )}
                            {!neno.reading_audio_url && !neno.reflection_audio_url && (
                              <span className="text-xs text-zinc-500">No audio</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={neno.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}>
                            {neno.is_active ? "Active" : "Scheduled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{neno.stats?.total_plays || 0}</p>
                            <p className="text-xs text-zinc-500">R: {neno.stats?.reading_plays || 0} / T: {neno.stats?.reflection_plays || 0}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleNenoToggleActive(neno)}
                              title={neno.is_active ? "Deactivate" : "Activate"}
                            >
                              {neno.is_active ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} className="text-zinc-400" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => openNenoEditModal(neno)}
                            >
                              <Edit2 size={14} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                              onClick={() => handleNenoDelete(neno.neno_id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
                    <SelectItem value="none">No leader</SelectItem>
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
                    <SelectItem value="none">No category</SelectItem>
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
                    placeholder="Image URL or upload"
                    className="bg-zinc-950 border-zinc-700 flex-1"
                  />
                  <input
                    ref={containerThumbnailRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const url = await handleFileUpload(e.target.files?.[0], "image");
                      if (url) setContainerForm({ ...containerForm, thumbnail_url: url });
                      e.target.value = ''; // Reset input for re-upload
                    }}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="border-zinc-700" 
                    disabled={uploading}
                    onClick={() => containerThumbnailRef.current?.click()}
                  >
                    <Upload size={14} className="mr-1" /> 
                    {uploading && uploadProgress > 0 ? `${uploadProgress}%` : "Upload"}
                  </Button>
                </div>
                {containerForm.thumbnail_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={containerForm.thumbnail_url} alt="Preview" className="w-16 h-16 rounded object-cover" />
                    <span className="text-xs text-zinc-500">Thumbnail preview</span>
                  </div>
                )}
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

      {/* Series Modal - Thumbnail per Series */}
      <Dialog open={isSeriesModalOpen} onOpenChange={setIsSeriesModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Series (Main Topic)</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new series to &quot;{selectedContainer?.title}&quot;. 
              <span className="text-amber-400 block mt-1">
                ⚠️ Upload ONE thumbnail here - it will apply to ALL episodes in this series
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Series Title (Main Topic) *</label>
              <Input
                value={seriesForm.title}
                onChange={(e) => setSeriesForm({ ...seriesForm, title: e.target.value })}
                placeholder="e.g., Parenting in Modern Days"
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
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block flex items-center gap-2">
                <Image size={16} className="text-emerald-400" />
                Series Thumbnail *
                <span className="text-xs text-amber-400">(Applies to all episodes)</span>
              </label>
              <div className="flex gap-3">
                <Input
                  value={seriesForm.thumbnail_url}
                  onChange={(e) => setSeriesForm({ ...seriesForm, thumbnail_url: e.target.value })}
                  placeholder="Thumbnail URL or upload"
                  className="bg-zinc-950 border-zinc-700 flex-1"
                />
                <input
                  ref={seriesThumbnailRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const url = await handleFileUpload(e.target.files?.[0], "image");
                    if (url) setSeriesForm({ ...seriesForm, thumbnail_url: url });
                    e.target.value = ''; // Reset input for re-upload
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="border-emerald-500/50 text-emerald-400" 
                  disabled={uploading}
                  onClick={() => seriesThumbnailRef.current?.click()}
                >
                  <Image size={14} className="mr-1" /> 
                  {uploading && uploadProgress > 0 ? `${uploadProgress}%` : "Upload"}
                </Button>
              </div>
              {seriesForm.thumbnail_url && (
                <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg">
                  <img src={seriesForm.thumbnail_url} alt="Preview" className="w-24 h-24 rounded object-cover mx-auto" />
                  <p className="text-xs text-zinc-400 text-center mt-2">This thumbnail will appear on all episodes</p>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSeriesModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button onClick={handleCreateSeries} className="bg-emerald-600 hover:bg-emerald-700" disabled={!seriesForm.title || !seriesForm.thumbnail_url}>
              Create Series
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Episode Modal - No individual thumbnail, uses series thumbnail */}
      <Dialog open={isEpisodeModalOpen} onOpenChange={setIsEpisodeModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Episode (Subtopic)</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Add a new episode to &quot;{selectedSeries?.title}&quot;
              <span className="text-emerald-400 block mt-1">
                ✓ Uses series thumbnail automatically
              </span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Episode Title (Subtopic) *</label>
              <Input
                value={episodeForm.title}
                onChange={(e) => setEpisodeForm({ ...episodeForm, title: e.target.value })}
                placeholder="e.g., Understanding Your Child's Behavior"
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
            
            {/* Audio Upload - Primary Action */}
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block flex items-center gap-2">
                <FileAudio size={16} className="text-emerald-400" />
                Audio File *
              </label>
              <div className="flex gap-3">
                <Input
                  value={episodeForm.audio_url}
                  onChange={(e) => setEpisodeForm({ ...episodeForm, audio_url: e.target.value })}
                  placeholder="Audio URL or upload file"
                  className="bg-zinc-950 border-zinc-700 flex-1"
                />
                <input
                  ref={episodeAudioRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = await handleFileUpload(file, "audio");
                      if (url) {
                        // Try to get duration from the audio file
                        const audio = new Audio();
                        audio.src = URL.createObjectURL(file);
                        audio.onloadedmetadata = () => {
                          setEpisodeForm(prev => ({ 
                            ...prev, 
                            audio_url: url,
                            duration_seconds: Math.round(audio.duration) || 0
                          }));
                        };
                        audio.onerror = () => {
                          setEpisodeForm(prev => ({ ...prev, audio_url: url }));
                        };
                      }
                    }
                    e.target.value = ''; // Reset input for re-upload
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="border-emerald-500/50 text-emerald-400" 
                  disabled={uploading}
                  onClick={() => episodeAudioRef.current?.click()}
                >
                  <FileAudio size={14} className="mr-1" /> 
                  {uploading && uploadProgress > 0 ? `${uploadProgress}%` : "Upload Audio"}
                </Button>
              </div>
              {uploading && uploadProgress > 0 && (
                <div className="mt-2">
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Uploading... {uploadProgress}%</p>
                </div>
              )}
              {episodeForm.audio_url && !uploading && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-zinc-800/50 rounded">
                  <FileAudio size={16} className="text-emerald-400" />
                  <span className="text-sm text-zinc-300">Audio file ready</span>
                  <Check size={14} className="text-emerald-400 ml-auto" />
                </div>
              )}
            </div>
            
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Duration (seconds)</label>
              <Input
                type="number"
                value={episodeForm.duration_seconds}
                onChange={(e) => setEpisodeForm({ ...episodeForm, duration_seconds: parseInt(e.target.value) || 0 })}
                placeholder="Auto-detected or enter manually"
                className="bg-zinc-950 border-zinc-700"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {episodeForm.duration_seconds > 0 
                  ? `Duration: ${Math.floor(episodeForm.duration_seconds / 60)}m ${episodeForm.duration_seconds % 60}s`
                  : "Will be auto-detected from uploaded audio"}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEpisodeModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button 
              onClick={handleCreateEpisode} 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!episodeForm.title || !episodeForm.audio_url || uploading}
            >
              Create Episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal - Shows Series with their Episodes */}
      <Dialog open={isDetailViewOpen} onOpenChange={setIsDetailViewOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {containerDetail?.container?.thumbnail_url && (
                <img src={containerDetail.container.thumbnail_url} alt="" className="w-12 h-12 rounded object-cover" />
              )}
              <div>
                <span className="block">{containerDetail?.container?.title}</span>
                {containerDetail?.container?.leader_name && (
                  <span className="text-sm font-normal text-zinc-400">
                    by {containerDetail.container.leader_name}
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Container Info */}
            <div className="flex gap-4 text-sm text-zinc-400 p-3 bg-zinc-800/30 rounded-lg">
              <span className="flex items-center gap-1"><ListOrdered size={14} /> {containerDetail?.series?.length || 0} series</span>
              <span className="flex items-center gap-1"><FileAudio size={14} /> {containerDetail?.total_episodes || 0} episodes</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {formatDuration(containerDetail?.container?.total_duration_minutes || 0)}</span>
            </div>
            
            {/* Add Series Button */}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => { setSelectedContainer(containerDetail?.container); setIsSeriesModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus size={14} className="mr-1" /> Add Series (Main Topic)
              </Button>
            </div>
            
            {/* Series List - Beautiful Cards */}
            <div className="space-y-4">
              {containerDetail?.series?.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <ListOrdered size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No series added yet</p>
                  <p className="text-xs mt-1">Add a series (main topic) with a thumbnail first</p>
                </div>
              ) : (
                containerDetail?.series?.map((series, sIdx) => (
                  <Card key={series.series_id} className="bg-zinc-800/50 border-zinc-700 overflow-hidden">
                    {/* Series Header with Thumbnail */}
                    <div className="flex gap-4 p-4 border-b border-zinc-700/50">
                      {/* Series Thumbnail */}
                      <div className="w-20 h-20 rounded-lg bg-zinc-900 overflow-hidden flex-shrink-0">
                        {series.thumbnail_url ? (
                          <img src={series.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen size={24} className="text-zinc-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-white flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-violet-500/20 flex items-center justify-center text-xs text-violet-400">{sIdx + 1}</span>
                              {series.title}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">{series.description || "No description"}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedContainer(containerDetail?.container); setSelectedSeries(series); setIsEpisodeModalOpen(true); }} className="text-emerald-400">
                              <Plus size={14} className="mr-1" /> Episode
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400" onClick={() => handleDeleteSeries(series.series_id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">
                          {series.episodes?.length || 0} episodes • {formatDuration(series.total_duration_minutes || 0)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Episodes List */}
                    <CardContent className="p-0">
                      {series.episodes?.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-4 px-4">No episodes yet - add episodes (subtopics) to this series</p>
                      ) : (
                        <div className="divide-y divide-zinc-700/30">
                          {series.episodes?.map((ep, eIdx) => (
                            <div key={ep.episode_id} className="flex items-center justify-between p-3 hover:bg-zinc-700/20 transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500 w-6 text-center">{eIdx + 1}</span>
                                <div>
                                  <p className="text-sm text-white">{ep.title}</p>
                                  <p className="text-xs text-zinc-500">
                                    {ep.duration_seconds > 0 ? `${Math.floor(ep.duration_seconds / 60)}m ${ep.duration_seconds % 60}s` : 'Duration pending'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {ep.audio_url ? (
                                  <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-400">
                                    <FileAudio size={10} className="mr-1" /> Audio
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">No Audio</Badge>
                                )}
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

      {/* Neno la Leo Edit Modal */}
      <Dialog open={isNenoEditModalOpen} onOpenChange={setIsNenoEditModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Neno la Leo</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update the entry for {editingNeno?.verse_reference}
            </DialogDescription>
          </DialogHeader>
          
          {editingNeno && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-sm text-zinc-400">Verse Reference</p>
                <p className="font-medium">{editingNeno.verse_reference}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1.5 block">Word Date</label>
                  <Input
                    type="date"
                    value={editingNeno.word_date || ''}
                    onChange={(e) => setEditingNeno({...editingNeno, word_date: e.target.value})}
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1.5 block">Publish Date</label>
                  <Input
                    type="date"
                    value={editingNeno.publish_date || ''}
                    onChange={(e) => setEditingNeno({...editingNeno, publish_date: e.target.value})}
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Publish Time</label>
                <Input
                  type="time"
                  value={editingNeno.publish_time || ''}
                  onChange={(e) => setEditingNeno({...editingNeno, publish_time: e.target.value})}
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Reading Audio URL</label>
                <Input
                  value={editingNeno.reading_audio_url || ''}
                  onChange={(e) => setEditingNeno({...editingNeno, reading_audio_url: e.target.value})}
                  placeholder="Audio URL"
                  className="bg-zinc-950 border-zinc-700"
                />
                {editingNeno.reading_audio_url && (
                  <audio src={editingNeno.reading_audio_url} controls className="w-full mt-2 h-8" />
                )}
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-1.5 block">Reflection Audio URL</label>
                <Input
                  value={editingNeno.reflection_audio_url || ''}
                  onChange={(e) => setEditingNeno({...editingNeno, reflection_audio_url: e.target.value})}
                  placeholder="Audio URL"
                  className="bg-zinc-950 border-zinc-700"
                />
                {editingNeno.reflection_audio_url && (
                  <audio src={editingNeno.reflection_audio_url} controls className="w-full mt-2 h-8" />
                )}
              </div>
              
              <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                <span className="text-sm">Active Status</span>
                <Switch
                  checked={editingNeno.is_active || false}
                  onCheckedChange={(checked) => setEditingNeno({...editingNeno, is_active: checked})}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNenoEditModalOpen(false)} className="border-zinc-700">Cancel</Button>
            <Button onClick={handleNenoUpdate} className="bg-emerald-600 hover:bg-emerald-700">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
