import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Music2, Plus, Edit2, Trash2, MoreVertical, Upload, Play, Disc, 
  Check, X, ToggleLeft, ToggleRight, CheckSquare, Square, FileAudio,
  DollarSign, Crown, Gift, Calendar, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuSeparator,
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to get proper image/thumbnail URL - handles CDN URLs, local files
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  if (imageUrl.startsWith('data:')) return imageUrl;
  // Handle /api/files/{file_id} format - add /stream suffix for proper streaming
  if (imageUrl.startsWith('/api/files/') && !imageUrl.endsWith('/stream')) {
    return `${BACKEND_URL}${imageUrl}/stream`;
  }
  if (imageUrl.startsWith('/')) return `${BACKEND_URL}${imageUrl}`;
  return imageUrl;
};

export default function AlbumsPage() {
  const [albums, setAlbums] = useState([]);
  const [categories, setCategories] = useState([]);
  const [singers, setSingers] = useState([]);
  const [songCategories, setSongCategories] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumSongs, setAlbumSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [isBulkSongModalOpen, setIsBulkSongModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState([]);
  const [selectedSongIds, setSelectedSongIds] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const [albumFormData, setAlbumFormData] = useState({
    title: "",
    description: "",
    artist_id: "",
    artist_name: "",
    category_id: "",
    category_name: "",
    thumbnail: "",
    release_date: "",
    monetization_type: "free",
    status: "active"
  });

  const [songFormData, setSongFormData] = useState({
    title: "",
    album_id: "",
    duration: "",
    duration_formatted: "",
    audio_url: "",
    lyrics: "",
    track_number: 1,
    status: "active",
    song_categories: [],
    song_category_names: []
  });

  const [bulkSongs, setBulkSongs] = useState([]);

  const fetchAlbums = useCallback(async () => {
    try {
      const [albumsRes, categoriesRes, singersRes, songCategoriesRes] = await Promise.all([
        axios.get(`${API}/albums?include_inactive=true&limit=500`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/singers`, { withCredentials: true }),
        axios.get(`${API}/song-categories`, { withCredentials: true })
      ]);
      setAlbums(albumsRes.data.albums);
      setCategories(categoriesRes.data.categories);
      setSingers(singersRes.data.singers);
      setSongCategories(songCategoriesRes.data.categories || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load albums");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlbumSongs = useCallback(async (albumId) => {
    try {
      // Use admin endpoint to get all songs including inactive
      const response = await axios.get(`${API}/admin/albums/${albumId}`, { withCredentials: true });
      setAlbumSongs(response.data.songs || []);
    } catch (error) {
      console.error("Error fetching songs:", error);
      // Fallback to regular endpoint
      try {
        const response = await axios.get(`${API}/albums/${albumId}`, { withCredentials: true });
        setAlbumSongs(response.data.songs || []);
      } catch (err) {
        console.error("Fallback also failed:", err);
      }
    }
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  useEffect(() => {
    if (selectedAlbum) {
      fetchAlbumSongs(selectedAlbum.album_id);
      setSelectedSongIds([]);
    }
  }, [selectedAlbum, fetchAlbumSongs]);

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
      toast.error("Failed to upload file");
      return null;
    }
  };

  const handleAlbumSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let thumbnailUrl = albumFormData.thumbnail;
      if (thumbnailFile) {
        thumbnailUrl = await handleFileUpload(thumbnailFile);
        if (!thumbnailUrl) {
          setIsUploading(false);
          return;
        }
      }

      const data = { ...albumFormData, thumbnail: thumbnailUrl };

      if (editingAlbum) {
        await axios.put(`${API}/albums/${editingAlbum.album_id}`, data, { withCredentials: true });
        toast.success("Album updated successfully");
        // Update selected album if it's the one being edited
        if (selectedAlbum?.album_id === editingAlbum.album_id) {
          setSelectedAlbum({ ...selectedAlbum, ...data });
        }
      } else {
        const response = await axios.post(`${API}/albums`, data, { withCredentials: true });
        toast.success("Album created successfully");
        // Auto-select the new album
        const newAlbum = { ...data, album_id: response.data.album_id };
        setSelectedAlbum(newAlbum);
      }
      setIsAlbumModalOpen(false);
      setEditingAlbum(null);
      setThumbnailFile(null);
      resetAlbumForm();
      fetchAlbums();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    } finally {
      setIsUploading(false);
    }
  };

  const resetAlbumForm = () => {
    setAlbumFormData({
      title: "",
      description: "",
      artist_id: "",
      artist_name: "",
      category_id: "",
      category_name: "",
      thumbnail: "",
      release_date: "",
      monetization_type: "free",
      status: "active"
    });
  };

  const handleSongSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let audioUrl = songFormData.audio_url;
      if (audioFiles.length > 0) {
        audioUrl = await handleFileUpload(audioFiles[0]);
        if (!audioUrl) {
          setIsUploading(false);
          return;
        }
      }

      const data = { 
        ...songFormData, 
        audio_url: audioUrl,
        album_id: selectedAlbum.album_id,
        duration: parseInt(songFormData.duration) || 0,
        track_number: parseInt(songFormData.track_number) || 1
      };

      if (editingSong) {
        await axios.put(`${API}/songs/${editingSong.song_id}`, data, { withCredentials: true });
        toast.success("Song updated successfully");
      } else {
        await axios.post(`${API}/songs`, data, { withCredentials: true });
        toast.success("Song added successfully");
      }
      setIsSongModalOpen(false);
      setEditingSong(null);
      setAudioFiles([]);
      resetSongForm();
      fetchAlbumSongs(selectedAlbum.album_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    } finally {
      setIsUploading(false);
    }
  };

  const resetSongForm = () => {
    setSongFormData({
      title: "",
      album_id: "",
      duration: "",
      duration_formatted: "",
      audio_url: "",
      lyrics: "",
      track_number: albumSongs.length + 1,
      status: "active",
      song_categories: [],
      song_category_names: []
    });
  };

  const handleBulkSongUpload = async (e) => {
    e.preventDefault();
    if (bulkSongs.length === 0) {
      toast.error("Please add at least one song");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const totalSongs = bulkSongs.length;
      const createdSongs = [];

      for (let i = 0; i < bulkSongs.length; i++) {
        const song = bulkSongs[i];
        let audioUrl = "";
        
        if (song.file) {
          audioUrl = await handleFileUpload(song.file);
        }

        const songData = {
          title: song.title,
          album_id: selectedAlbum.album_id,
          duration: parseInt(song.duration) || 0,
          duration_formatted: song.duration_formatted || "",
          audio_url: audioUrl,
          track_number: i + 1 + albumSongs.length,
          status: "active"
        };

        await axios.post(`${API}/songs`, songData, { withCredentials: true });
        createdSongs.push(songData);
        setUploadProgress(Math.round(((i + 1) / totalSongs) * 100));
      }

      toast.success(`${createdSongs.length} songs uploaded successfully`);
      setIsBulkSongModalOpen(false);
      setBulkSongs([]);
      fetchAlbumSongs(selectedAlbum.album_id);
    } catch (error) {
      toast.error("Failed to upload some songs");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (!window.confirm("Delete this album and all its songs?")) return;
    try {
      await axios.delete(`${API}/albums/${albumId}`, { withCredentials: true });
      toast.success("Album deleted");
      if (selectedAlbum?.album_id === albumId) {
        setSelectedAlbum(null);
        setAlbumSongs([]);
      }
      fetchAlbums();
    } catch (error) {
      toast.error("Failed to delete album");
    }
  };

  const handleDeleteSong = async (songId) => {
    if (!window.confirm("Delete this song?")) return;
    try {
      await axios.delete(`${API}/songs/${songId}`, { withCredentials: true });
      toast.success("Song deleted");
      fetchAlbumSongs(selectedAlbum.album_id);
    } catch (error) {
      toast.error("Failed to delete song");
    }
  };

  // Bulk operations for albums
  const handleBulkAlbumStatus = async (status) => {
    if (selectedAlbumIds.length === 0) {
      toast.error("Select at least one album");
      return;
    }
    try {
      await axios.post(`${API}/albums/bulk-status`, {
        album_ids: selectedAlbumIds,
        status
      }, { withCredentials: true });
      toast.success(`${selectedAlbumIds.length} albums ${status === "active" ? "activated" : "deactivated"}`);
      setSelectedAlbumIds([]);
      fetchAlbums();
    } catch (error) {
      toast.error("Failed to update albums");
    }
  };

  const handleBulkAlbumDelete = async () => {
    if (selectedAlbumIds.length === 0) {
      toast.error("Select at least one album");
      return;
    }
    if (!window.confirm(`Delete ${selectedAlbumIds.length} albums and all their songs?`)) return;
    try {
      await axios.post(`${API}/albums/bulk-delete`, {
        album_ids: selectedAlbumIds
      }, { withCredentials: true });
      toast.success(`${selectedAlbumIds.length} albums deleted`);
      setSelectedAlbumIds([]);
      if (selectedAlbumIds.includes(selectedAlbum?.album_id)) {
        setSelectedAlbum(null);
        setAlbumSongs([]);
      }
      fetchAlbums();
    } catch (error) {
      toast.error("Failed to delete albums");
    }
  };

  // Bulk operations for songs
  const handleBulkSongStatus = async (status) => {
    if (selectedSongIds.length === 0) {
      toast.error("Select at least one song");
      return;
    }
    try {
      await axios.post(`${API}/songs/bulk-status`, {
        song_ids: selectedSongIds,
        status
      }, { withCredentials: true });
      toast.success(`${selectedSongIds.length} songs ${status === "active" ? "activated" : "deactivated"}`);
      setSelectedSongIds([]);
      fetchAlbumSongs(selectedAlbum.album_id);
    } catch (error) {
      toast.error("Failed to update songs");
    }
  };

  const handleBulkSongDelete = async () => {
    if (selectedSongIds.length === 0) {
      toast.error("Select at least one song");
      return;
    }
    if (!window.confirm(`Delete ${selectedSongIds.length} songs?`)) return;
    try {
      await axios.post(`${API}/songs/bulk-delete`, {
        song_ids: selectedSongIds
      }, { withCredentials: true });
      toast.success(`${selectedSongIds.length} songs deleted`);
      setSelectedSongIds([]);
      fetchAlbumSongs(selectedAlbum.album_id);
    } catch (error) {
      toast.error("Failed to delete songs");
    }
  };

  const toggleAlbumSelection = (albumId) => {
    setSelectedAlbumIds(prev => 
      prev.includes(albumId) 
        ? prev.filter(id => id !== albumId)
        : [...prev, albumId]
    );
  };

  const toggleSongSelection = (songId) => {
    setSelectedSongIds(prev => 
      prev.includes(songId) 
        ? prev.filter(id => id !== songId)
        : [...prev, songId]
    );
  };

  const selectAllAlbums = () => {
    if (selectedAlbumIds.length === albums.length) {
      setSelectedAlbumIds([]);
    } else {
      setSelectedAlbumIds(albums.map(a => a.album_id));
    }
  };

  const selectAllSongs = () => {
    if (selectedSongIds.length === albumSongs.length) {
      setSelectedSongIds([]);
    } else {
      setSelectedSongIds(albumSongs.map(s => s.song_id));
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseDuration = (formatted) => {
    if (!formatted) return 0;
    const parts = formatted.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return parseInt(formatted) || 0;
  };

  const getMonetizationIcon = (type) => {
    switch(type) {
      case 'premium': return <Crown size={14} className="text-amber-400" />;
      case 'standard': return <DollarSign size={14} className="text-emerald-400" />;
      default: return <Gift size={14} className="text-violet-400" />;
    }
  };

  const getMonetizationBadge = (type) => {
    const styles = {
      premium: "bg-amber-500/20 text-amber-400",
      standard: "bg-emerald-500/20 text-emerald-400",
      free: "bg-violet-500/20 text-violet-400"
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[type] || styles.free}`}>
        {getMonetizationIcon(type)}
        {type}
      </span>
    );
  };

  const addBulkSongEntry = () => {
    setBulkSongs([...bulkSongs, { title: "", duration: "", duration_formatted: "", file: null }]);
  };

  const updateBulkSong = (index, field, value) => {
    const updated = [...bulkSongs];
    updated[index][field] = value;
    if (field === "duration_formatted") {
      updated[index].duration = parseDuration(value);
    }
    setBulkSongs(updated);
  };

  const removeBulkSong = (index) => {
    setBulkSongs(bulkSongs.filter((_, i) => i !== index));
  };

  const handleBulkFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newSongs = files.map((file, index) => ({
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      duration: "",
      duration_formatted: "",
      file: file
    }));
    setBulkSongs([...bulkSongs, ...newSongs]);
  };

  return (
    <div className="page-container animate-fade-in" data-testid="albums-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Albums & Songs</h1>
          <p className="page-subtitle">Create albums, upload songs, and manage your music library</p>
        </div>
        <Button
          onClick={() => {
            setEditingAlbum(null);
            resetAlbumForm();
            setThumbnailFile(null);
            setIsAlbumModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-album-btn"
        >
          <Plus size={18} className="mr-2" />
          Create Album
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Albums List */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-zinc-400">Albums ({albums.length})</h3>
            {albums.length > 0 && (
              <button 
                onClick={selectAllAlbums}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                {selectedAlbumIds.length === albums.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          {/* Bulk Actions for Albums */}
          {selectedAlbumIds.length > 0 && (
            <div className="mb-4 p-3 bg-violet-600/10 border border-violet-500/30 rounded-lg animate-fade-in">
              <p className="text-sm text-violet-300 mb-2">{selectedAlbumIds.length} album(s) selected</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleBulkAlbumStatus("active")} className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                  <ToggleRight size={14} className="mr-1" /> Activate
                </Button>
                <Button size="sm" onClick={() => handleBulkAlbumStatus("inactive")} variant="outline" className="border-zinc-600 text-xs">
                  <ToggleLeft size={14} className="mr-1" /> Deactivate
                </Button>
                <Button size="sm" onClick={handleBulkAlbumDelete} variant="outline" className="border-red-600 text-red-400 text-xs">
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : albums.length === 0 ? (
            <div className="empty-state py-8">
              <Disc className="empty-state-icon w-12 h-12" />
              <p className="empty-state-title">No albums yet</p>
              <p className="empty-state-text">Create your first album</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
              {albums.map((album) => (
                <Card 
                  key={album.album_id}
                  className={`bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all ${
                    selectedAlbum?.album_id === album.album_id ? "border-violet-500 ring-1 ring-violet-500/50" : ""
                  } ${album.status === "inactive" ? "opacity-60" : ""}`}
                  data-testid={`album-card-${album.album_id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Selection checkbox */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleAlbumSelection(album.album_id); }}
                        className="mt-1"
                      >
                        <Checkbox 
                          checked={selectedAlbumIds.includes(album.album_id)}
                          className="border-zinc-600 data-[state=checked]:bg-violet-600"
                        />
                      </div>
                      
                      <div className="flex-1 flex items-start gap-3" onClick={() => setSelectedAlbum(album)}>
                        {album.thumbnail ? (
                          <img src={getImageUrl(album.thumbnail)} alt="" className="w-14 h-14 rounded-lg object-cover" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center">
                            <Music2 size={24} className="text-zinc-600" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white truncate">{album.title}</h4>
                            {album.status === "inactive" && (
                              <span className="text-xs text-zinc-500">(Inactive)</span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500 truncate">{album.artist_name || "Unknown Artist"}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getMonetizationBadge(album.monetization_type || "free")}
                          </div>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="action-btn">
                            <MoreVertical size={16} className="text-zinc-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setEditingAlbum(album);
                            setAlbumFormData({
                              title: album.title,
                              description: album.description || "",
                              artist_id: album.artist_id || "",
                              artist_name: album.artist_name || "",
                              category_id: album.category_id || "",
                              category_name: album.category_name || "",
                              thumbnail: album.thumbnail || "",
                              release_date: album.release_date || "",
                              monetization_type: album.monetization_type || "free",
                              status: album.status || "active"
                            });
                            setIsAlbumModalOpen(true);
                          }} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                            <Edit2 size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newStatus = album.status === "active" ? "inactive" : "active";
                              await axios.put(`${API}/albums/${album.album_id}`, { status: newStatus }, { withCredentials: true });
                              toast.success(`Album ${newStatus === "active" ? "activated" : "deactivated"}`);
                              fetchAlbums();
                            }}
                            className="text-zinc-300 focus:text-white focus:bg-zinc-800"
                          >
                            {album.status === "active" ? (
                              <><ToggleLeft size={14} className="mr-2" /> Deactivate</>
                            ) : (
                              <><ToggleRight size={14} className="mr-2" /> Activate</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-zinc-800" />
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleDeleteAlbum(album.album_id); }}
                            className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                          >
                            <Trash2 size={14} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Songs List */}
        <div className="lg:col-span-2">
          {selectedAlbum ? (
            <>
              {/* Album Header */}
              <div className="bg-gradient-to-r from-violet-900/30 to-zinc-900 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-6">
                  {selectedAlbum.thumbnail ? (
                    <img src={selectedAlbum.thumbnail} alt="" className="w-32 h-32 rounded-xl object-cover shadow-xl" />
                  ) : (
                    <div className="w-32 h-32 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Music2 size={48} className="text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getMonetizationBadge(selectedAlbum.monetization_type || "free")}
                      <span className={`badge ${selectedAlbum.status === "active" ? "badge-success" : "badge-error"}`}>
                        {selectedAlbum.status}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">{selectedAlbum.title}</h2>
                    <p className="text-zinc-400">{selectedAlbum.artist_name || "Unknown Artist"}</p>
                    {selectedAlbum.category_name && (
                      <p className="text-sm text-zinc-500 mt-1">Category: {selectedAlbum.category_name}</p>
                    )}
                    {selectedAlbum.release_date && (
                      <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1">
                        <Calendar size={12} /> Released: {selectedAlbum.release_date}
                      </p>
                    )}
                    <p className="text-sm text-zinc-500 mt-2">{albumSongs.length} songs</p>
                  </div>
                </div>
              </div>

              {/* Songs Actions */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-zinc-400">Songs</h3>
                  {albumSongs.length > 0 && (
                    <button 
                      onClick={selectAllSongs}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      {selectedSongIds.length === albumSongs.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setEditingSong(null);
                      resetSongForm();
                      setAudioFiles([]);
                      setIsSongModalOpen(true);
                    }}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 rounded-full"
                    data-testid="add-song-btn"
                  >
                    <Plus size={16} className="mr-1" />
                    Add Song
                  </Button>
                  <Button
                    onClick={() => {
                      setBulkSongs([]);
                      setIsBulkSongModalOpen(true);
                    }}
                    size="sm"
                    variant="outline"
                    className="border-violet-600 text-violet-400 hover:bg-violet-600/20 rounded-full"
                    data-testid="bulk-upload-btn"
                  >
                    <Upload size={16} className="mr-1" />
                    Bulk Upload
                  </Button>
                </div>
              </div>

              {/* Bulk Actions for Songs */}
              {selectedSongIds.length > 0 && (
                <div className="mb-4 p-3 bg-emerald-600/10 border border-emerald-500/30 rounded-lg animate-fade-in">
                  <p className="text-sm text-emerald-300 mb-2">{selectedSongIds.length} song(s) selected</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleBulkSongStatus("active")} className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                      <ToggleRight size={14} className="mr-1" /> Activate
                    </Button>
                    <Button size="sm" onClick={() => handleBulkSongStatus("inactive")} variant="outline" className="border-zinc-600 text-xs">
                      <ToggleLeft size={14} className="mr-1" /> Deactivate
                    </Button>
                    <Button size="sm" onClick={handleBulkSongDelete} variant="outline" className="border-red-600 text-red-400 text-xs">
                      <Trash2 size={14} className="mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              )}

              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-0">
                  {albumSongs.length === 0 ? (
                    <div className="empty-state py-12">
                      <Music2 className="empty-state-icon w-12 h-12" />
                      <p className="empty-state-title">No songs yet</p>
                      <p className="empty-state-text">Add songs to this album</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/50">
                      {albumSongs.map((song, index) => (
                        <div 
                          key={song.song_id} 
                          className={`flex items-center gap-4 p-4 hover:bg-zinc-800/30 transition-colors ${
                            song.status === "inactive" ? "opacity-60" : ""
                          }`} 
                          data-testid={`song-row-${song.song_id}`}
                        >
                          {/* Selection checkbox */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                              checked={selectedSongIds.includes(song.song_id)}
                              onCheckedChange={() => toggleSongSelection(song.song_id)}
                              className="border-zinc-600 data-[state=checked]:bg-emerald-600"
                            />
                          </div>
                          
                          <span className="text-zinc-500 text-sm w-6 text-center">{song.track_number || index + 1}</span>
                          <button className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-400 transition-colors">
                            <Play size={14} className="text-white ml-0.5" fill="white" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-white truncate">{song.title}</p>
                              {song.status === "inactive" && (
                                <span className="text-xs text-zinc-500">(Inactive)</span>
                              )}
                            </div>
                            <p className="text-sm text-zinc-500 flex items-center gap-1">
                              <Clock size={12} />
                              {song.duration_formatted || formatDuration(song.duration)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-500 text-sm">
                            <span>{song.plays || 0} plays</span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="action-btn">
                                <MoreVertical size={16} className="text-zinc-400" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                              <DropdownMenuItem onClick={() => {
                                setEditingSong(song);
                                setSongFormData({
                                  title: song.title,
                                  album_id: song.album_id,
                                  duration: song.duration?.toString() || "",
                                  duration_formatted: song.duration_formatted || formatDuration(song.duration),
                                  audio_url: song.audio_url || "",
                                  lyrics: song.lyrics || "",
                                  track_number: song.track_number || index + 1,
                                  status: song.status || "active",
                                  song_categories: song.song_categories || [],
                                  song_category_names: song.song_category_names || []
                                });
                                setIsSongModalOpen(true);
                              }} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                                <Edit2 size={14} className="mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={async () => {
                                  const newStatus = song.status === "active" ? "inactive" : "active";
                                  await axios.put(`${API}/songs/${song.song_id}`, { status: newStatus }, { withCredentials: true });
                                  toast.success(`Song ${newStatus === "active" ? "activated" : "deactivated"}`);
                                  fetchAlbumSongs(selectedAlbum.album_id);
                                }}
                                className="text-zinc-300 focus:text-white focus:bg-zinc-800"
                              >
                                {song.status === "active" ? (
                                  <><ToggleLeft size={14} className="mr-2" /> Deactivate</>
                                ) : (
                                  <><ToggleRight size={14} className="mr-2" /> Activate</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-zinc-800" />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteSong(song.song_id)}
                                className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                              >
                                <Trash2 size={14} className="mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 bg-zinc-900/30 border border-zinc-800/50 rounded-xl">
              <div className="text-center">
                <Disc size={48} className="text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500">Select an album to view and manage songs</p>
                <p className="text-zinc-600 text-sm mt-1">Or create a new album to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Album Modal */}
      <Dialog open={isAlbumModalOpen} onOpenChange={setIsAlbumModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{editingAlbum ? "Edit Album" : "Create New Album"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAlbumSubmit}>
            <div className="space-y-4 py-4">
              {/* Album Name */}
              <div className="form-group">
                <label className="form-label">Album Name *</label>
                <Input
                  value={albumFormData.title}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, title: e.target.value })}
                  placeholder="Enter album name"
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="album-title-input"
                />
              </div>

              {/* Category */}
              <div className="form-group">
                <label className="form-label">Category *</label>
                <Select 
                  value={albumFormData.category_id} 
                  onValueChange={(value) => {
                    const cat = categories.find(c => c.category_id === value);
                    setAlbumFormData({ 
                      ...albumFormData, 
                      category_id: value,
                      category_name: cat?.name || ""
                    });
                  }}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="album-category-select">
                    <SelectValue placeholder="Select category (Christmas, Lent, etc.)" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {categories.map(cat => (
                      <SelectItem key={cat.category_id} value={cat.category_id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thumbnail Upload */}
              <div className="form-group">
                <label className="form-label">Album Thumbnail *</label>
                <div className="flex items-center gap-4">
                  {(albumFormData.thumbnail || thumbnailFile) && (
                    <img 
                      src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : albumFormData.thumbnail} 
                      alt="" 
                      className="w-24 h-24 rounded-xl object-cover border border-zinc-700"
                    />
                  )}
                  <label className="flex-1">
                    <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center cursor-pointer hover:border-violet-500 transition-colors">
                      <Upload size={24} className="mx-auto text-zinc-500 mb-2" />
                      <p className="text-sm text-zinc-400">Click to upload thumbnail</p>
                      <p className="text-xs text-zinc-600 mt-1">PNG, JPG up to 5MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setThumbnailFile(e.target.files[0])}
                    />
                  </label>
                </div>
              </div>

              {/* Release Date */}
              <div className="form-group">
                <label className="form-label">Release Date</label>
                <Input
                  type="date"
                  value={albumFormData.release_date}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, release_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>

              {/* Monetization Type */}
              <div className="form-group">
                <label className="form-label">Monetization Type *</label>
                <Select value={albumFormData.monetization_type} onValueChange={(value) => setAlbumFormData({ ...albumFormData, monetization_type: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="album-monetization-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="free">
                      <span className="flex items-center gap-2">
                        <Gift size={14} className="text-violet-400" /> Free - Available to all users
                      </span>
                    </SelectItem>
                    <SelectItem value="standard">
                      <span className="flex items-center gap-2">
                        <DollarSign size={14} className="text-emerald-400" /> Standard - Basic subscription
                      </span>
                    </SelectItem>
                    <SelectItem value="premium">
                      <span className="flex items-center gap-2">
                        <Crown size={14} className="text-amber-400" /> Premium - Premium subscription only
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Choir/Artist */}
              <div className="form-group">
                <label className="form-label">Choir / Artist *</label>
                <Select 
                  value={albumFormData.artist_id} 
                  onValueChange={(value) => {
                    const singer = singers.find(s => s.singer_id === value);
                    setAlbumFormData({ 
                      ...albumFormData, 
                      artist_id: value,
                      artist_name: singer?.name || ""
                    });
                  }}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white" data-testid="album-artist-select">
                    <SelectValue placeholder="Select choir or artist" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {singers.map(singer => (
                      <SelectItem key={singer.singer_id} value={singer.singer_id}>
                        {singer.name} ({singer.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Status</label>
                <Select value={albumFormData.status} onValueChange={(value) => setAlbumFormData({ ...albumFormData, status: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="active">Active - Visible to users</SelectItem>
                    <SelectItem value="inactive">Inactive - Hidden from users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <Textarea
                  value={albumFormData.description}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, description: e.target.value })}
                  placeholder="Brief description of the album..."
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAlbumModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={isUploading} data-testid="save-album-btn">
                {isUploading ? "Saving..." : editingAlbum ? "Update Album" : "Create Album"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Single Song Modal */}
      <Dialog open={isSongModalOpen} onOpenChange={setIsSongModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingSong ? "Edit Song" : "Add Song"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSongSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Song Title *</label>
                <Input
                  value={songFormData.title}
                  onChange={(e) => setSongFormData({ ...songFormData, title: e.target.value })}
                  placeholder="Enter song name"
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="song-title-input"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Audio File</label>
                <label className="block">
                  <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 transition-colors">
                    <FileAudio size={24} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-sm text-zinc-400">
                      {audioFiles.length > 0 ? audioFiles[0].name : "Click to upload audio file"}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">MP3, WAV, M4A</p>
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => setAudioFiles(Array.from(e.target.files))}
                  />
                </label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <Input
                    value={songFormData.duration_formatted}
                    onChange={(e) => {
                      const formatted = e.target.value;
                      setSongFormData({ 
                        ...songFormData, 
                        duration_formatted: formatted,
                        duration: parseDuration(formatted)
                      });
                    }}
                    placeholder="e.g., 3:45"
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Track Number</label>
                  <Input
                    type="number"
                    value={songFormData.track_number}
                    onChange={(e) => setSongFormData({ ...songFormData, track_number: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <Select value={songFormData.status} onValueChange={(value) => setSongFormData({ ...songFormData, status: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Song Categories Selection */}
              <div className="form-group">
                <label className="form-label">Song Categories</label>
                <p className="text-xs text-zinc-500 mb-2">Select categories this song belongs to (e.g., Christmas, Easter)</p>
                <div className="flex flex-wrap gap-2 p-3 bg-zinc-950 border border-zinc-800 rounded-lg max-h-32 overflow-y-auto">
                  {songCategories.length === 0 ? (
                    <p className="text-xs text-zinc-500">No song categories available. Add categories in Song Categories page.</p>
                  ) : (
                    songCategories.map((cat) => {
                      const isSelected = (songFormData.song_categories || []).includes(cat.song_category_id);
                      return (
                        <button
                          key={cat.song_category_id}
                          type="button"
                          onClick={() => {
                            const currentIds = songFormData.song_categories || [];
                            const currentNames = songFormData.song_category_names || [];
                            if (isSelected) {
                              setSongFormData({
                                ...songFormData,
                                song_categories: currentIds.filter(id => id !== cat.song_category_id),
                                song_category_names: currentNames.filter(n => n !== cat.name)
                              });
                            } else {
                              setSongFormData({
                                ...songFormData,
                                song_categories: [...currentIds, cat.song_category_id],
                                song_category_names: [...currentNames, cat.name]
                              });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                            isSelected 
                              ? 'text-white' 
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                          style={isSelected ? { backgroundColor: cat.color } : {}}
                        >
                          {isSelected && <Check size={12} />}
                          {cat.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Lyrics (optional)</label>
                <Textarea
                  value={songFormData.lyrics}
                  onChange={(e) => setSongFormData({ ...songFormData, lyrics: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={4}
                  placeholder="Enter song lyrics..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSongModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isUploading} data-testid="save-song-btn">
                {isUploading ? "Saving..." : editingSong ? "Update Song" : "Add Song"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Song Upload Modal */}
      <Dialog open={isBulkSongModalOpen} onOpenChange={setIsBulkSongModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Songs</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkSongUpload}>
            <div className="space-y-4 py-4">
              {/* File selector */}
              <div className="form-group">
                <label className="form-label">Select Multiple Audio Files</label>
                <label className="block">
                  <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-violet-500 transition-colors">
                    <Upload size={32} className="mx-auto text-zinc-500 mb-3" />
                    <p className="text-sm text-zinc-400">Click to select audio files</p>
                    <p className="text-xs text-zinc-600 mt-1">MP3, WAV, M4A - You can select multiple files</p>
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    multiple
                    className="hidden"
                    onChange={handleBulkFileSelect}
                  />
                </label>
              </div>

              {/* Song list */}
              {bulkSongs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-400">{bulkSongs.length} song(s) to upload</p>
                    <Button type="button" size="sm" variant="outline" onClick={addBulkSongEntry} className="border-zinc-700 text-xs">
                      <Plus size={14} className="mr-1" /> Add Manually
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    {bulkSongs.map((song, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <span className="text-zinc-500 text-sm w-6">{index + 1}</span>
                        <Input
                          value={song.title}
                          onChange={(e) => updateBulkSong(index, "title", e.target.value)}
                          placeholder="Song title"
                          className="flex-1 bg-zinc-950 border-zinc-700 text-white text-sm h-9"
                        />
                        <Input
                          value={song.duration_formatted}
                          onChange={(e) => updateBulkSong(index, "duration_formatted", e.target.value)}
                          placeholder="3:45"
                          className="w-20 bg-zinc-950 border-zinc-700 text-white text-sm h-9"
                        />
                        {song.file && (
                          <span className="text-xs text-emerald-400 truncate max-w-[100px]" title={song.file.name}>
                            ✓ {song.file.name}
                          </span>
                        )}
                        <button 
                          type="button"
                          onClick={() => removeBulkSong(index)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              {isUploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-zinc-400">Uploading...</span>
                    <span className="text-violet-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-2">
                    <div 
                      className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBulkSongModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-violet-600 hover:bg-violet-700" 
                disabled={isUploading || bulkSongs.length === 0}
                data-testid="bulk-upload-submit"
              >
                {isUploading ? `Uploading ${uploadProgress}%...` : `Upload ${bulkSongs.length} Songs`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
