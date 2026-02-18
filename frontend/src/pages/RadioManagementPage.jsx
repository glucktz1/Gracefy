import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  Radio, Search, Plus, Edit2, Trash2, Power, Play, Pause,
  Globe, Music2, BarChart3, Clock, TrendingUp, ChevronUp, ChevronDown,
  ExternalLink, RefreshCw, Upload, Image as ImageIcon, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COUNTRIES = [
  { code: "TZ", name: "Tanzania" },
  { code: "KE", name: "Kenya" },
  { code: "UG", name: "Uganda" },
  { code: "RW", name: "Rwanda" },
  { code: "OTHER", name: "Other" }
];

const LANGUAGES = ["Swahili", "English", "French", "Other"];

export default function RadioManagementPage() {
  const [stations, setStations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("stations");
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  
  // Form state
  const [stationForm, setStationForm] = useState({
    name: "",
    country: "Tanzania",
    country_code: "TZ",
    language: "Swahili",
    tags: ["christian"],
    url_resolved: "",
    favicon: "",
    is_featured: false,
    order: 99
  });
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Preview state
  const [previewStation, setPreviewStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState(null);
  
  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchStations();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef) {
        audioRef.pause();
      }
    };
  }, [audioRef]);

  const fetchStations = async () => {
    try {
      const response = await axios.get(`${API}/admin/radio/stations`, { withCredentials: true });
      setStations(response.data.stations || []);
    } catch (error) {
      console.error("Error fetching stations:", error);
      toast.error("Failed to fetch radio stations");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API}/admin/radio/analytics`, { withCredentials: true });
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const handleToggleStation = async (station) => {
    try {
      await axios.post(`${API}/admin/radio/stations/${station.station_id}/toggle`, {}, { withCredentials: true });
      toast.success(`Station ${station.is_enabled ? 'disabled' : 'enabled'} successfully`);
      fetchStations();
    } catch (error) {
      toast.error("Failed to toggle station");
    }
  };

  // Handle thumbnail image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size should be less than 2MB");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/content/upload-thumbnail`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });

      if (response.data?.url) {
        setStationForm(prev => ({ ...prev, favicon: response.data.url }));
        setImagePreview(response.data.url);
        toast.success("Image uploaded successfully");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const clearImage = () => {
    setStationForm(prev => ({ ...prev, favicon: "" }));
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddStation = async () => {
    if (!stationForm.name || !stationForm.url_resolved) {
      toast.error("Name and Stream URL are required");
      return;
    }
    
    try {
      await axios.post(`${API}/admin/radio/stations`, stationForm, { withCredentials: true });
      toast.success("Station added successfully");
      setIsAddModalOpen(false);
      resetForm();
      fetchStations();
    } catch (error) {
      toast.error("Failed to add station");
    }
  };

  const handleEditStation = async () => {
    if (!stationForm.name || !stationForm.url_resolved) {
      toast.error("Name and Stream URL are required");
      return;
    }
    
    try {
      await axios.put(`${API}/admin/radio/stations/${selectedStation.station_id}`, stationForm, { withCredentials: true });
      toast.success("Station updated successfully");
      setIsEditModalOpen(false);
      resetForm();
      fetchStations();
    } catch (error) {
      toast.error("Failed to update station");
    }
  };

  const handleDeleteStation = async () => {
    try {
      await axios.delete(`${API}/admin/radio/stations/${selectedStation.station_id}`, { withCredentials: true });
      toast.success("Station deleted successfully");
      setIsDeleteModalOpen(false);
      setSelectedStation(null);
      fetchStations();
    } catch (error) {
      toast.error("Failed to delete station");
    }
  };

  const handleSearchRadioBrowser = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await axios.get(`${API}/admin/radio/search`, {
        params: { query: searchQuery, limit: 20 },
        withCredentials: true
      });
      setSearchResults(response.data.results || []);
    } catch (error) {
      toast.error("Failed to search Radio Browser");
    } finally {
      setSearching(false);
    }
  };

  const handleImportStation = (result) => {
    setStationForm({
      name: result.name,
      country: result.country || "Tanzania",
      country_code: result.country_code || "TZ",
      language: result.language || "Swahili",
      tags: result.tags || ["christian"],
      url_resolved: result.url_resolved,
      favicon: result.favicon || "",
      is_featured: false,
      order: 99
    });
    setIsSearchModalOpen(false);
    setIsAddModalOpen(true);
  };

  const handleMoveStation = async (station, direction) => {
    const currentIndex = stations.findIndex(s => s.station_id === station.station_id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= stations.length) return;
    
    const reorderedStations = [...stations];
    [reorderedStations[currentIndex], reorderedStations[newIndex]] = [reorderedStations[newIndex], reorderedStations[currentIndex]];
    
    const stationOrders = reorderedStations.map((s, i) => ({
      station_id: s.station_id,
      order: i + 1
    }));
    
    try {
      await axios.post(`${API}/admin/radio/reorder`, { stations: stationOrders }, { withCredentials: true });
      fetchStations();
    } catch (error) {
      toast.error("Failed to reorder stations");
    }
  };

  const openEditModal = (station) => {
    setSelectedStation(station);
    setStationForm({
      name: station.name,
      country: station.country,
      country_code: station.country_code,
      language: station.language,
      tags: station.tags || ["christian"],
      url_resolved: station.url_resolved,
      favicon: station.favicon || "",
      is_featured: station.is_featured || false,
      order: station.order || 99
    });
    setImagePreview(station.favicon || "");
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setStationForm({
      name: "",
      country: "Tanzania",
      country_code: "TZ",
      language: "Swahili",
      tags: ["christian"],
      url_resolved: "",
      favicon: "",
      is_featured: false,
      order: 99
    });
    setSelectedStation(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const togglePreview = (station) => {
    if (previewStation?.station_id === station.station_id && isPlaying) {
      audioRef?.pause();
      setIsPlaying(false);
      setPreviewStation(null);
    } else {
      if (audioRef) {
        audioRef.pause();
      }
      const audio = new Audio(station.url_resolved);
      audio.play().catch(() => toast.error("Failed to play stream"));
      setAudioRef(audio);
      setPreviewStation(station);
      setIsPlaying(true);
    }
  };

  const filteredStations = stations.filter(station =>
    station.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    station.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading radio stations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Radio className="w-7 h-7 text-violet-500" />
              Radio Management
            </h1>
            <p className="text-slate-400 mt-1">Manage live Christian radio stations</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsSearchModalOpen(true)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              data-testid="search-radio-browser-btn"
            >
              <Globe className="w-4 h-4 mr-2" />
              Search Radio Browser
            </Button>
            <Button 
              onClick={() => { resetForm(); setIsAddModalOpen(true); }}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="add-station-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Station
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/20 rounded-lg">
                    <Radio className="w-5 h-5 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Total Stations</p>
                    <p className="text-2xl font-bold text-white">{stations.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Play className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Total Plays</p>
                    <p className="text-2xl font-bold text-white">{analytics.total_plays?.toLocaleString() || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Listen Hours</p>
                    <p className="text-2xl font-bold text-white">{analytics.total_listen_hours?.toFixed(1) || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Last 24h Sessions</p>
                    <p className="text-2xl font-bold text-white">{analytics.sessions_last_24h || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="stations" className="data-[state=active]:bg-violet-600">
              <Radio className="w-4 h-4 mr-2" />
              Stations
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-violet-600">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Stations Tab */}
          <TabsContent value="stations" className="mt-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle className="text-white">Radio Stations</CardTitle>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search stations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-slate-800 border-slate-700 text-white"
                      data-testid="search-stations-input"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredStations.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No radio stations found</p>
                      <Button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="mt-4 bg-violet-600 hover:bg-violet-700"
                      >
                        Add First Station
                      </Button>
                    </div>
                  ) : (
                    filteredStations.map((station, index) => (
                      <div 
                        key={station.station_id}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                          station.is_enabled 
                            ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' 
                            : 'bg-slate-900/50 border-slate-800 opacity-60'
                        }`}
                        data-testid={`station-row-${station.station_id}`}
                      >
                        {/* Station Logo */}
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {station.favicon ? (
                            <img 
                              src={station.favicon} 
                              alt={station.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <Radio className="w-6 h-6 text-white" />
                          )}
                        </div>
                        
                        {/* Station Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white truncate">{station.name}</h3>
                            {station.is_featured && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Featured</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {station.country}
                            </span>
                            <span>{station.language}</span>
                            <span className="flex items-center gap-1">
                              <Play className="w-3 h-3" />
                              {station.play_count || 0} plays
                            </span>
                          </div>
                        </div>
                        
                        {/* Preview Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePreview(station)}
                          className={`text-slate-400 hover:text-white ${
                            previewStation?.station_id === station.station_id && isPlaying 
                              ? 'text-green-400 hover:text-green-300' 
                              : ''
                          }`}
                          data-testid={`preview-station-${station.station_id}`}
                        >
                          {previewStation?.station_id === station.station_id && isPlaying ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                        </Button>
                        
                        {/* Reorder Buttons */}
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveStation(station, 'up')}
                            disabled={index === 0}
                            className="h-6 w-6 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMoveStation(station, 'down')}
                            disabled={index === filteredStations.length - 1}
                            className="h-6 w-6 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={station.is_enabled}
                            onCheckedChange={() => handleToggleStation(station)}
                            data-testid={`toggle-station-${station.station_id}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(station)}
                            className="text-slate-400 hover:text-white"
                            data-testid={`edit-station-${station.station_id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSelectedStation(station); setIsDeleteModalOpen(true); }}
                            className="text-slate-400 hover:text-red-400"
                            data-testid={`delete-station-${station.station_id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-500" />
                  Station Performance
                </CardTitle>
                <CardDescription className="text-slate-400">
                  View listening statistics for each station
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.stations?.map((station, index) => (
                    <div 
                      key={station.station_id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{station.name}</h4>
                        <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
                          <div 
                            className="bg-violet-500 h-2 rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(100, (station.play_count / (analytics.total_plays || 1)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">{station.play_count?.toLocaleString() || 0}</p>
                        <p className="text-xs text-slate-400">plays</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">{(station.total_listen_minutes || 0).toFixed(0)}</p>
                        <p className="text-xs text-slate-400">minutes</p>
                      </div>
                      <Badge className={station.is_enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                        {station.is_enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  ))}
                  {(!analytics?.stations || analytics.stations.length === 0) && (
                    <div className="text-center py-12 text-slate-400">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No analytics data available yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add/Edit Station Modal */}
        <Dialog open={isAddModalOpen || isEditModalOpen} onOpenChange={(open) => {
          if (!open) {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
            resetForm();
          }
        }}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>{isEditModalOpen ? 'Edit Station' : 'Add New Station'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Station Name *</Label>
                <Input
                  value={stationForm.name}
                  onChange={(e) => setStationForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Radio Wapo"
                  className="bg-slate-800 border-slate-700"
                  data-testid="station-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Stream URL *</Label>
                <Input
                  value={stationForm.url_resolved}
                  onChange={(e) => setStationForm(prev => ({ ...prev, url_resolved: e.target.value }))}
                  placeholder="https://stream.example.com/radio"
                  className="bg-slate-800 border-slate-700"
                  data-testid="station-url-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select 
                    value={stationForm.country_code}
                    onValueChange={(value) => {
                      const country = COUNTRIES.find(c => c.code === value);
                      setStationForm(prev => ({ 
                        ...prev, 
                        country_code: value,
                        country: country?.name || value
                      }));
                    }}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {COUNTRIES.map(country => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select 
                    value={stationForm.language}
                    onValueChange={(value) => setStationForm(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Logo URL (optional)</Label>
                <Input
                  value={stationForm.favicon}
                  onChange={(e) => setStationForm(prev => ({ ...prev, favicon: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={stationForm.is_featured}
                    onCheckedChange={(checked) => setStationForm(prev => ({ ...prev, is_featured: checked }))}
                    data-testid="station-featured-switch"
                  />
                  <Label>Featured Station</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={isEditModalOpen ? handleEditStation : handleAddStation}
                className="bg-violet-600 hover:bg-violet-700"
                data-testid="save-station-btn"
              >
                {isEditModalOpen ? 'Update' : 'Add'} Station
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search Radio Browser Modal */}
        <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-violet-500" />
                Search Radio Browser
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Christian radio stations..."
                  className="bg-slate-800 border-slate-700"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchRadioBrowser()}
                  data-testid="radio-browser-search-input"
                />
                <Button 
                  onClick={handleSearchRadioBrowser}
                  className="bg-violet-600 hover:bg-violet-700"
                  disabled={searching}
                >
                  {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {searchResults.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Search for Christian radio stations from around the world</p>
                  </div>
                ) : (
                  searchResults.map((result, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:bg-slate-800 cursor-pointer"
                      onClick={() => handleImportStation(result)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center overflow-hidden">
                        {result.favicon ? (
                          <img 
                            src={result.favicon} 
                            alt={result.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <Radio className="w-5 h-5 text-violet-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{result.name}</h4>
                        <p className="text-sm text-slate-400">
                          {result.country} • {result.language}
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-400">
                        <p>{result.click_count?.toLocaleString() || 0} clicks</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-red-400">Delete Station</DialogTitle>
            </DialogHeader>
            <p className="text-slate-300">
              Are you sure you want to delete <strong>{selectedStation?.name}</strong>? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteModalOpen(false)}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteStation}
                className="bg-red-600 hover:bg-red-700"
                data-testid="confirm-delete-station-btn"
              >
                Delete Station
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
