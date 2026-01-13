import { useEffect, useState } from "react";
import axios from "axios";
import { Music2, Plus, Edit2, Trash2, MoreVertical, Upload, Play, Disc } from "lucide-react";
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AlbumsPage() {
  const [albums, setAlbums] = useState([]);
  const [categories, setCategories] = useState([]);
  const [singers, setSingers] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumSongs, setAlbumSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  
  const [albumFormData, setAlbumFormData] = useState({
    title: "",
    description: "",
    artist_id: "",
    artist_name: "",
    category_id: "",
    thumbnail: "",
    release_date: "",
    status: "active"
  });

  const [songFormData, setSongFormData] = useState({
    title: "",
    album_id: "",
    duration: "",
    audio_url: "",
    lyrics: "",
    track_number: 1
  });

  const fetchAlbums = async () => {
    try {
      const [albumsRes, categoriesRes, singersRes] = await Promise.all([
        axios.get(`${API}/albums`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/singers`, { withCredentials: true })
      ]);
      setAlbums(albumsRes.data.albums);
      setCategories(categoriesRes.data.categories);
      setSingers(singersRes.data.singers);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load albums");
    } finally {
      setLoading(false);
    }
  };

  const fetchAlbumSongs = async (albumId) => {
    try {
      const response = await axios.get(`${API}/albums/${albumId}`, { withCredentials: true });
      setAlbumSongs(response.data.songs || []);
    } catch (error) {
      console.error("Error fetching songs:", error);
    }
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

  useEffect(() => {
    if (selectedAlbum) {
      fetchAlbumSongs(selectedAlbum.album_id);
    }
  }, [selectedAlbum]);

  const handleThumbnailUpload = async (file) => {
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
    try {
      let thumbnailUrl = albumFormData.thumbnail;
      if (thumbnailFile) {
        thumbnailUrl = await handleThumbnailUpload(thumbnailFile);
        if (!thumbnailUrl) return;
      }

      const data = { ...albumFormData, thumbnail: thumbnailUrl };

      if (editingAlbum) {
        await axios.put(`${API}/albums/${editingAlbum.album_id}`, data, { withCredentials: true });
        toast.success("Album updated successfully");
      } else {
        await axios.post(`${API}/albums`, data, { withCredentials: true });
        toast.success("Album created successfully");
      }
      setIsAlbumModalOpen(false);
      setEditingAlbum(null);
      setThumbnailFile(null);
      setAlbumFormData({ title: "", description: "", artist_id: "", artist_name: "", category_id: "", thumbnail: "", release_date: "", status: "active" });
      fetchAlbums();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleSongSubmit = async (e) => {
    e.preventDefault();
    try {
      let audioUrl = songFormData.audio_url;
      if (audioFile) {
        audioUrl = await handleThumbnailUpload(audioFile);
        if (!audioUrl) return;
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
      setAudioFile(null);
      setSongFormData({ title: "", album_id: "", duration: "", audio_url: "", lyrics: "", track_number: 1 });
      fetchAlbumSongs(selectedAlbum.album_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
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

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="albums-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Albums & Songs</h1>
          <p className="page-subtitle">Manage music albums and their songs</p>
        </div>
        <Button
          onClick={() => {
            setEditingAlbum(null);
            setAlbumFormData({ title: "", description: "", artist_id: "", artist_name: "", category_id: "", thumbnail: "", release_date: "", status: "active" });
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
          <h3 className="text-sm font-medium text-zinc-400 mb-4">Albums ({albums.length})</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : albums.length === 0 ? (
            <div className="empty-state py-8">
              <Disc className="empty-state-icon w-12 h-12" />
              <p className="empty-state-title">No albums yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {albums.map((album) => (
                <Card 
                  key={album.album_id}
                  className={`bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all ${
                    selectedAlbum?.album_id === album.album_id ? "border-violet-500 ring-1 ring-violet-500/50" : ""
                  }`}
                  onClick={() => setSelectedAlbum(album)}
                  data-testid={`album-card-${album.album_id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {album.thumbnail ? (
                        <img src={album.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Music2 size={24} className="text-zinc-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate">{album.title}</h4>
                        <p className="text-sm text-zinc-500 truncate">{album.artist_name || "Unknown Artist"}</p>
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
                              thumbnail: album.thumbnail || "",
                              release_date: album.release_date || "",
                              status: album.status
                            });
                            setIsAlbumModalOpen(true);
                          }} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                            <Edit2 size={14} className="mr-2" />
                            Edit
                          </DropdownMenuItem>
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  {selectedAlbum.thumbnail ? (
                    <img src={selectedAlbum.thumbnail} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <Music2 size={32} className="text-zinc-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedAlbum.title}</h3>
                    <p className="text-zinc-500">{selectedAlbum.artist_name || "Unknown Artist"}</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setEditingSong(null);
                    setSongFormData({ title: "", album_id: selectedAlbum.album_id, duration: "", audio_url: "", lyrics: "", track_number: albumSongs.length + 1 });
                    setIsSongModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 rounded-full"
                  data-testid="add-song-btn"
                >
                  <Plus size={18} className="mr-2" />
                  Add Song
                </Button>
              </div>

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
                        <div key={song.song_id} className="flex items-center gap-4 p-4 hover:bg-zinc-800/30 transition-colors" data-testid={`song-row-${song.song_id}`}>
                          <span className="text-zinc-500 text-sm w-6 text-center">{song.track_number || index + 1}</span>
                          <button className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-400 transition-colors">
                            <Play size={14} className="text-white ml-0.5" fill="white" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{song.title}</p>
                            <p className="text-sm text-zinc-500">{formatDuration(song.duration)}</p>
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
                                  audio_url: song.audio_url || "",
                                  lyrics: song.lyrics || "",
                                  track_number: song.track_number || 1
                                });
                                setIsSongModalOpen(true);
                              }} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                                <Edit2 size={14} className="mr-2" />
                                Edit
                              </DropdownMenuItem>
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
                <p className="text-zinc-500">Select an album to view songs</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Album Modal */}
      <Dialog open={isAlbumModalOpen} onOpenChange={setIsAlbumModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAlbum ? "Edit Album" : "Create Album"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAlbumSubmit}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="form-group">
                <label className="form-label">Album Title</label>
                <Input
                  value={albumFormData.title}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="album-title-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Thumbnail</label>
                <div className="flex items-center gap-3">
                  {(albumFormData.thumbnail || thumbnailFile) && (
                    <img 
                      src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : albumFormData.thumbnail} 
                      alt="" 
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  )}
                  <label className="flex-1">
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:border-zinc-600 transition-colors">
                      <Upload size={20} className="mx-auto text-zinc-500 mb-2" />
                      <p className="text-sm text-zinc-500">Click to upload thumbnail</p>
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
              <div className="form-group">
                <label className="form-label">Artist/Choir</label>
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
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select artist" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {singers.map(singer => (
                      <SelectItem key={singer.singer_id} value={singer.singer_id}>{singer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <Select value={albumFormData.category_id} onValueChange={(value) => setAlbumFormData({ ...albumFormData, category_id: value })}>
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
              <div className="form-group">
                <label className="form-label">Release Date</label>
                <Input
                  type="date"
                  value={albumFormData.release_date}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, release_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <Textarea
                  value={albumFormData.description}
                  onChange={(e) => setAlbumFormData({ ...albumFormData, description: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAlbumModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-album-btn">
                {editingAlbum ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Song Modal */}
      <Dialog open={isSongModalOpen} onOpenChange={setIsSongModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingSong ? "Edit Song" : "Add Song"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSongSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Song Title</label>
                <Input
                  value={songFormData.title}
                  onChange={(e) => setSongFormData({ ...songFormData, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="song-title-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Audio File</label>
                <label className="block">
                  <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:border-zinc-600 transition-colors">
                    <Upload size={20} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-sm text-zinc-500">
                      {audioFile ? audioFile.name : "Click to upload audio file"}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => setAudioFile(e.target.files[0])}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Duration (seconds)</label>
                  <Input
                    type="number"
                    value={songFormData.duration}
                    onChange={(e) => setSongFormData({ ...songFormData, duration: e.target.value })}
                    placeholder="e.g., 240"
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
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-song-btn">
                {editingSong ? "Update" : "Add Song"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
