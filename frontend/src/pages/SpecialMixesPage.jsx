import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Disc, Plus, Edit2, Trash2, Save, Search, Music, Play, Pause,
  ChevronDown, ChevronRight, GripVertical, X, Check, Image, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const MAX_SONGS_PER_MIX = 14;

export default function SpecialMixesPage() {
  const [mixes, setMixes] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]); // Keep original unfiltered
  const [categories, setCategories] = useState([]);
  const [songCategories, setSongCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Create/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMix, setEditingMix] = useState(null);
  const [mixForm, setMixForm] = useState({
    title: "",
    description: "",
    thumbnail: "",
    category_id: "",
    category_name: "",
    monetization_type: "standard",
    is_featured: false,
    songs: []
  });
  
  // Song Selection
  const [expandedAlbum, setExpandedAlbum] = useState(null);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [songSearch, setSongSearch] = useState("");
  const [songCategoryFilter, setSongCategoryFilter] = useState(""); // Filter songs by category

  const fetchData = async () => {
    try {
      const [mixesRes, albumsRes, categoriesRes, songCategoriesRes] = await Promise.all([
        axios.get(`${API}/special-mixes`, { withCredentials: true }),
        axios.get(`${API}/albums/all-songs`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/song-categories`, { withCredentials: true })
      ]);
      setMixes(mixesRes.data.mixes || []);
      setAlbums(albumsRes.data.albums || []);
      setAllAlbums(albumsRes.data.albums || []);
      setCategories(categoriesRes.data.categories || []);
      setSongCategories(songCategoriesRes.data.categories || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch songs filtered by category
  const fetchSongsByCategory = async (categoryId) => {
    if (!categoryId) {
      setAlbums(allAlbums);
      return;
    }
    try {
      const response = await axios.get(`${API}/albums/songs-by-category?song_category_id=${categoryId}`, { withCredentials: true });
      setAlbums(response.data.albums || []);
    } catch (error) {
      console.error("Error fetching filtered songs:", error);
      toast.error("Failed to filter songs");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When category filter changes, fetch filtered songs
  useEffect(() => {
    fetchSongsByCategory(songCategoryFilter);
  }, [songCategoryFilter]);

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await axios.post(`${API}/upload`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" }
      });
      return response.data.url;
    } catch (error) {
      toast.error("Failed to upload thumbnail");
      return null;
    }
  };

  const handleCreateMix = async () => {
    if (!mixForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (selectedSongs.length === 0) {
      toast.error("Select at least one song");
      return;
    }
    if (selectedSongs.length > MAX_SONGS_PER_MIX) {
      toast.error(`Maximum ${MAX_SONGS_PER_MIX} songs allowed per mix`);
      return;
    }

    setIsUploading(true);
    
    try {
      // Upload thumbnail if file selected
      let thumbnailUrl = mixForm.thumbnail;
      if (thumbnailFile) {
        thumbnailUrl = await handleFileUpload(thumbnailFile);
        if (!thumbnailUrl) {
          setIsUploading(false);
          return;
        }
      }

      const payload = {
        ...mixForm,
        thumbnail: thumbnailUrl,
        songs: selectedSongs.map((song, index) => ({
          song_id: song.song_id,
          album_id: song.album_id,
          order: index + 1
        }))
      };

      if (editingMix) {
        await axios.put(`${API}/special-mixes/${editingMix.mix_id}`, payload, { withCredentials: true });
        toast.success("Special mix updated successfully");
      } else {
        await axios.post(`${API}/special-mixes`, payload, { withCredentials: true });
        toast.success("Special mix created successfully");
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save mix");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMix = async (mixId) => {
    if (!window.confirm("Are you sure you want to delete this special mix?")) return;
    
    try {
      await axios.delete(`${API}/special-mixes/${mixId}`, { withCredentials: true });
      toast.success("Special mix deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete mix");
    }
  };

  const openEditModal = (mix) => {
    setEditingMix(mix);
    setMixForm({
      title: mix.title,
      description: mix.description || "",
      thumbnail: mix.thumbnail || "",
      category_id: mix.category_id || "",
      category_name: mix.category_name || "",
      monetization_type: mix.monetization_type || "standard",
      is_featured: mix.is_featured || false,
      songs: mix.songs || []
    });
    setSelectedSongs(mix.songs || []);
    setThumbnailFile(null);
    setSongCategoryFilter("");
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingMix(null);
    setMixForm({
      title: "",
      description: "",
      thumbnail: "",
      category_id: "",
      category_name: "",
      monetization_type: "standard",
      is_featured: false,
      songs: []
    });
    setSelectedSongs([]);
    setSongSearch("");
    setThumbnailFile(null);
    setSongCategoryFilter("");
  };

  const toggleSongSelection = (song, albumInfo) => {
    const isSelected = selectedSongs.some(s => s.song_id === song.song_id);
    if (isSelected) {
      setSelectedSongs(selectedSongs.filter(s => s.song_id !== song.song_id));
    } else {
      // Enforce max songs limit
      if (selectedSongs.length >= MAX_SONGS_PER_MIX) {
        toast.error(`Maximum ${MAX_SONGS_PER_MIX} songs allowed per mix`);
        return;
      }
      setSelectedSongs([...selectedSongs, {
        ...song,
        album_id: albumInfo.album_id,
        album_title: albumInfo.album_title,
        artist_name: albumInfo.artist_name
      }]);
    }
  };

  const removeSong = (songId) => {
    setSelectedSongs(selectedSongs.filter(s => s.song_id !== songId));
  };

  const moveSong = (index, direction) => {
    const newSongs = [...selectedSongs];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSongs.length) return;
    [newSongs[index], newSongs[newIndex]] = [newSongs[newIndex], newSongs[index]];
    setSelectedSongs(newSongs);
  };

  // Filter albums and songs based on search
  const filteredAlbums = albums.filter(album => {
    if (!songSearch) return true;
    const searchLower = songSearch.toLowerCase();
    return album.album_title?.toLowerCase().includes(searchLower) ||
           album.artist_name?.toLowerCase().includes(searchLower) ||
           album.songs?.some(s => s.title?.toLowerCase().includes(searchLower));
  });

  const filteredMixes = mixes.filter(mix =>
    mix.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="special-mixes-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Disc className="text-violet-400" /> Special Mixes
          </h1>
          <p className="text-zinc-400 mt-1">Create custom album mixes from songs across different albums</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
          <Plus size={16} className="mr-2" /> Create Mix
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={16} />
        <Input
          placeholder="Search mixes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-zinc-950 border-zinc-800 text-white"
        />
      </div>

      {/* Mixes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMixes.map((mix) => (
          <Card key={mix.mix_id} className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
            <div className="aspect-video relative bg-zinc-800">
              {mix.thumbnail ? (
                <img src={mix.thumbnail} alt={mix.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc size={48} className="text-zinc-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-lg font-semibold text-white truncate">{mix.title}</h3>
                <p className="text-sm text-zinc-300">{mix.songs_count} songs</p>
              </div>
              {mix.is_featured && (
                <Badge className="absolute top-3 right-3 bg-amber-600">Featured</Badge>
              )}
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className={
                  mix.monetization_type === 'premium' 
                    ? 'bg-violet-600/20 text-violet-400 border-violet-600/30'
                    : 'bg-zinc-700/50 text-zinc-300 border-zinc-600'
                }>
                  {mix.monetization_type}
                </Badge>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock size={12} />
                  {formatDuration(mix.total_duration)}
                </span>
              </div>
              {mix.description && (
                <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{mix.description}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditModal(mix)} className="flex-1 border-zinc-700 text-zinc-300">
                  <Edit2 size={14} className="mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDeleteMix(mix.mix_id)} className="border-red-800 text-red-400 hover:bg-red-900/20">
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredMixes.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            <Disc size={48} className="mx-auto mb-4 opacity-50" />
            <p>No special mixes yet. Create your first mix!</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingMix ? 'Edit Special Mix' : 'Create Special Mix'}
            </DialogTitle>
            <DialogDescription>
              Combine songs from different albums into a unique mix (max {MAX_SONGS_PER_MIX} songs)
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Title *</label>
                <Input
                  value={mixForm.title}
                  onChange={(e) => setMixForm({ ...mixForm, title: e.target.value })}
                  placeholder="e.g., Christmas Favorites Mix"
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Category</label>
                <Select 
                  value={mixForm.category_id} 
                  onValueChange={(value) => {
                    const cat = categories.find(c => c.category_id === value);
                    setMixForm({ ...mixForm, category_id: value, category_name: cat?.name || "" });
                  }}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {categories.map(cat => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Description</label>
              <Input
                value={mixForm.description}
                onChange={(e) => setMixForm({ ...mixForm, description: e.target.value })}
                placeholder="A curated collection of..."
                className="bg-zinc-950 border-zinc-800 text-white"
              />
            </div>

            {/* Thumbnail Upload */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Thumbnail</label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center hover:border-violet-500 transition-colors">
                      {thumbnailFile ? (
                        <div className="flex items-center justify-center gap-2 text-zinc-300">
                          <Image size={20} />
                          <span className="text-sm truncate">{thumbnailFile.name}</span>
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); setThumbnailFile(null); }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : mixForm.thumbnail ? (
                        <div className="flex items-center justify-center gap-2 text-zinc-300">
                          <Check size={16} className="text-green-500" />
                          <span className="text-sm">Thumbnail set</span>
                        </div>
                      ) : (
                        <div className="text-zinc-500">
                          <Image size={24} className="mx-auto mb-1" />
                          <p className="text-xs">Click to upload thumbnail</p>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setThumbnailFile(e.target.files[0]);
                          setMixForm({ ...mixForm, thumbnail: "" }); // Clear URL if uploading file
                        }
                      }}
                    />
                  </label>
                  {(thumbnailFile || mixForm.thumbnail) && (
                    <div className="w-20 h-20 rounded-lg bg-zinc-800 overflow-hidden">
                      <img 
                        src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : mixForm.thumbnail} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Monetization</label>
                  <Select value={mixForm.monetization_type} onValueChange={(value) => setMixForm({ ...mixForm, monetization_type: value })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={mixForm.is_featured}
                    onCheckedChange={(checked) => setMixForm({ ...mixForm, is_featured: checked })}
                    className="data-[state=checked]:bg-amber-600"
                  />
                  <span className="text-sm text-zinc-300">Featured Mix</span>
                </div>
              </div>
            </div>

            {/* Song Selection */}
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <div className="bg-zinc-950 p-3 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">Select Songs</h3>
                  <Badge 
                    variant="outline" 
                    className={selectedSongs.length >= MAX_SONGS_PER_MIX ? "text-red-400 border-red-600" : "text-zinc-400"}
                  >
                    {selectedSongs.length}/{MAX_SONGS_PER_MIX} selected
                  </Badge>
                </div>
                
                {/* Category Filter */}
                <div className="flex gap-2 mb-2">
                  <Select value={songCategoryFilter} onValueChange={setSongCategoryFilter}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white text-sm h-8 w-48">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="">All Songs</SelectItem>
                      {songCategories.map(cat => (
                        <SelectItem key={cat.song_category_id} value={cat.song_category_id}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></span>
                            {cat.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={14} />
                    <Input
                      placeholder="Search albums or songs..."
                      value={songSearch}
                      onChange={(e) => setSongSearch(e.target.value)}
                      className="pl-9 bg-zinc-900 border-zinc-800 text-white text-sm h-8"
                    />
                  </div>
                </div>
                
                {songCategoryFilter && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>Showing songs tagged with:</span>
                    <Badge 
                      className="text-xs"
                      style={{ backgroundColor: songCategories.find(c => c.song_category_id === songCategoryFilter)?.color }}
                    >
                      {songCategories.find(c => c.song_category_id === songCategoryFilter)?.name}
                    </Badge>
                    <button 
                      onClick={() => setSongCategoryFilter("")}
                      className="text-zinc-500 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-0 divide-x divide-zinc-800">
                {/* Available Songs */}
                <div className="max-h-64 overflow-y-auto">
                  {filteredAlbums.length === 0 ? (
                    <div className="p-4 text-center text-zinc-500 text-sm">
                      {songCategoryFilter ? "No songs found with this category" : "No albums found"}
                    </div>
                  ) : (
                  filteredAlbums.map((album) => (
                    <div key={album.album_id} className="border-b border-zinc-800 last:border-0">
                      <button
                        onClick={() => setExpandedAlbum(expandedAlbum === album.album_id ? null : album.album_id)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/50 text-left"
                      >
                        <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {album.album_thumbnail ? (
                            <img src={album.album_thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music size={16} className="text-zinc-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{album.album_title}</p>
                          <p className="text-xs text-zinc-500">{album.songs?.length || 0} songs • {album.artist_name}</p>
                        </div>
                        {expandedAlbum === album.album_id ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
                      </button>
                      
                      {expandedAlbum === album.album_id && (
                        <div className="bg-zinc-950/50 divide-y divide-zinc-800/50">
                          {album.songs?.map((song) => {
                            const isSelected = selectedSongs.some(s => s.song_id === song.song_id);
                            const isDisabled = !isSelected && selectedSongs.length >= MAX_SONGS_PER_MIX;
                            return (
                              <div
                                key={song.song_id}
                                onClick={() => !isDisabled && toggleSongSelection(song, album)}
                                className={`flex items-center gap-3 p-2 pl-6 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-violet-600/10' : 
                                  isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800/30'
                                }`}
                              >
                                <Checkbox checked={isSelected} disabled={isDisabled} className="pointer-events-none" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-zinc-300 truncate">{song.title}</p>
                                  {/* Show song categories if present */}
                                  {song.song_category_names?.length > 0 && (
                                    <div className="flex gap-1 mt-0.5">
                                      {song.song_category_names.slice(0, 2).map((catName, idx) => (
                                        <span key={idx} className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                          {catName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-zinc-500">{song.duration_formatted || formatDuration(song.duration)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                  )}
                </div>
                
                {/* Selected Songs */}
                <div className="max-h-64 overflow-y-auto bg-zinc-950/30">
                  <div className="p-2 bg-zinc-900/50 border-b border-zinc-800 sticky top-0">
                    <p className="text-xs font-medium text-zinc-400 uppercase">Selected Songs (Drag to reorder)</p>
                  </div>
                  {selectedSongs.length === 0 ? (
                    <div className="p-4 text-center text-zinc-500 text-sm">
                      Select songs from albums on the left
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/50">
                      {selectedSongs.map((song, index) => (
                        <div key={song.song_id} className="flex items-center gap-2 p-2 hover:bg-zinc-800/30 group">
                          <span className="w-6 text-center text-xs text-zinc-500">{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{song.title}</p>
                            <p className="text-xs text-zinc-500 truncate">{song.album_title}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveSong(index, 'up')} disabled={index === 0} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30">
                              <ChevronDown size={14} className="rotate-180" />
                            </button>
                            <button onClick={() => moveSong(index, 'down')} disabled={index === selectedSongs.length - 1} className="p-1 text-zinc-400 hover:text-white disabled:opacity-30">
                              <ChevronDown size={14} />
                            </button>
                            <button onClick={() => removeSong(song.song_id)} className="p-1 text-red-400 hover:text-red-300">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t border-zinc-800 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button onClick={handleCreateMix} className="bg-violet-600 hover:bg-violet-700">
              <Save size={16} className="mr-2" /> {editingMix ? 'Update Mix' : 'Create Mix'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
