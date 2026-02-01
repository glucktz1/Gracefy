import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Trash2, Edit2, Play, Pause, Download, RefreshCw,
  Volume2, Settings, BarChart3, Clock, TrendingUp, Search, ChevronRight,
  Mic2, BookMarked, Languages, AlertCircle, Check, X, Database
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
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;


export default function BibleManagementPage() {
  const [activeTab, setActiveTab] = useState("snippets");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ book_count: 0, verse_count: 0, has_data: false });
  const [snippets, setSnippets] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [books, setBooks] = useState([]);
  const [voices, setVoices] = useState([]);
  
  // Snippet form
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [snippetForm, setSnippetForm] = useState({
    title: "", description: "", book_name: "", chapter: 1,
    start_verse: 1, end_verse: 1, language: "sw", voice: "", speed: 1.0,
    gender: "female",  // male or female
    // New devotional card fields
    heading: "", subtitle: "", card_type: "snippet", thumbnail_url: "", is_featured: false, display_order: 0
  });
  const [chapters, setChapters] = useState([]);
  const [creatingSnippet, setCreatingSnippet] = useState(false);
  const [maleVoices, setMaleVoices] = useState([]);
  const [femaleVoices, setFemaleVoices] = useState([]);
  
  // Audio player
  const [playingSnippet, setPlayingSnippet] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  
  // Bible initialization
  const [initializing, setInitializing] = useState(false);

  // TTS Cache state
  const [ttsCache, setTtsCache] = useState([]);
  const [loadingCache, setLoadingCache] = useState(false);
  const [cacheStats, setCacheStats] = useState({ total: 0, size_mb: 0 });

  // Listening limit settings
  const [listeningSettings, setListeningSettings] = useState({
    free_user_minutes_before_prompt: 5,
    free_user_additional_minutes: 2,
    paid_user_limit_type: "daily",
    paid_user_daily_minutes: 60,
    paid_user_monthly_minutes: 1800,
    donation_prompt_message_sw: "",
    donation_prompt_message_en: "",
    is_active: true
  });
  const [listeningStats, setListeningStats] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Voice preview state
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [previewAudio, setPreviewAudio] = useState(null);
  const [defaultVoiceMale, setDefaultVoiceMale] = useState("");
  const [defaultVoiceFemale, setDefaultVoiceFemale] = useState("");
  const [defaultSpeed, setDefaultSpeed] = useState(1.0);
  const [savingVoiceSettings, setSavingVoiceSettings] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, snippetsRes, voicesRes] = await Promise.all([
        axios.get(`${API}/bible/stats?language=sw`),
        axios.get(`${API}/admin/bible/snippets`),
        axios.get(`${API}/bible/tts/voices`)
      ]);
      setStats(statsRes.data);
      setSnippets(snippetsRes.data.snippets || []);
      setVoices(voicesRes.data.voices || []);
      setMaleVoices(voicesRes.data.male_voices || []);
      setFemaleVoices(voicesRes.data.female_voices || []);
      
      if (statsRes.data.has_data) {
        const booksRes = await axios.get(`${API}/bible/books?language=sw`);
        setBooks(booksRes.data.books || []);
      }
    } catch (e) {
      console.error("Error fetching data:", e);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/bible/analytics?days=30`);
      setAnalytics(res.data);
    } catch (e) {
      console.error("Error fetching analytics:", e);
    }
  }, []);

  const fetchListeningSettings = useCallback(async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/bible/settings`),
        axios.get(`${API}/admin/bible/listening-stats`)
      ]);
      setListeningSettings(settingsRes.data);
      setListeningStats(statsRes.data);
      // Set default voices from settings
      setDefaultVoiceMale(settingsRes.data.default_voice_male || "");
      setDefaultVoiceFemale(settingsRes.data.default_voice_female || "");
    } catch (e) {
      console.error("Error fetching listening settings:", e);
    }
  }, []);

  // Fetch TTS cache
  const fetchTtsCache = useCallback(async () => {
    setLoadingCache(true);
    try {
      const res = await axios.get(`${API}/admin/bible/tts-cache`);
      setTtsCache(res.data.cache || []);
      setCacheStats(res.data.stats || { total: 0, size_mb: 0 });
    } catch (e) {
      console.error("Error fetching TTS cache:", e);
    } finally {
      setLoadingCache(false);
    }
  }, []);

  const saveListeningSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API}/admin/bible/settings`, listeningSettings);
      toast.success("Settings saved successfully");
    } catch (e) {
      console.error("Error saving settings:", e);
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete TTS cache entry
  const handleDeleteCacheEntry = async (cacheKey) => {
    try {
      await axios.delete(`${API}/admin/bible/tts-cache/${encodeURIComponent(cacheKey)}`);
      toast.success("Cache entry deleted");
      fetchTtsCache();
    } catch (e) {
      toast.error("Failed to delete cache entry");
    }
  };

  // Clear all TTS cache
  const handleClearAllCache = async () => {
    if (!window.confirm("Clear ALL cached TTS audio? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/admin/bible/tts-cache`);
      toast.success("All TTS cache cleared");
      fetchTtsCache();
    } catch (e) {
      toast.error("Failed to clear cache");
    }
  };

  // Play cached audio
  const handlePlayCacheEntry = (entry) => {
    if (audioElement) audioElement.pause();
    if (entry.audio_base64) {
      const audio = new Audio(`data:audio/mp3;base64,${entry.audio_base64}`);
      audio.play();
      setAudioElement(audio);
    }
  };

  // Preview a TTS voice
  const handlePreviewVoice = async (voice) => {
    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    
    if (previewingVoice === voice.id) {
      setPreviewingVoice(null);
      setPreviewAudio(null);
      return;
    }
    
    setPreviewingVoice(voice.id);
    
    try {
      const res = await axios.post(`${API}/bible/tts/preview`, {
        voice_id: voice.id,
        text: voice.sample_text
      });
      
      if (res.data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
        audio.onended = () => {
          setPreviewingVoice(null);
          setPreviewAudio(null);
        };
        audio.onerror = () => {
          toast.error("Failed to play audio preview");
          setPreviewingVoice(null);
        };
        await audio.play();
        setPreviewAudio(audio);
      } else {
        toast.info(res.data.message || "TTS preview not available");
        setPreviewingVoice(null);
      }
    } catch (e) {
      console.error("Error previewing voice:", e);
      toast.error("Failed to preview voice");
      setPreviewingVoice(null);
    }
  };

  // Save default voice settings
  const saveVoiceSettings = async () => {
    setSavingVoiceSettings(true);
    try {
      await axios.put(`${API}/admin/bible/settings`, {
        ...listeningSettings,
        default_voice_male: defaultVoiceMale,
        default_voice_female: defaultVoiceFemale,
        default_voice: defaultVoiceFemale || defaultVoiceMale // Primary default
      });
      toast.success("Voice settings saved successfully");
    } catch (e) {
      console.error("Error saving voice settings:", e);
      toast.error("Failed to save voice settings");
    } finally {
      setSavingVoiceSettings(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAnalytics();
    fetchListeningSettings();
  }, [fetchData, fetchAnalytics, fetchListeningSettings]);

  // Fetch TTS cache when switching to cache tab
  useEffect(() => {
    if (activeTab === "cache") {
      fetchTtsCache();
    }
  }, [activeTab, fetchTtsCache]);

  // Initialize Bible data
  const handleInitializeBible = async (language = "sw") => {
    setInitializing(true);
    try {
      const res = await axios.post(`${API}/admin/bible/initialize?language=${language}`);
      toast.success(`Bible data initialized: ${res.data.books_stored} books, ${res.data.verses_stored} verses`);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to initialize Bible data");
    } finally {
      setInitializing(false);
    }
  };

  // Load chapters when book changes
  useEffect(() => {
    if (snippetForm.book_name) {
      axios.get(`${API}/bible/books/${snippetForm.book_name}/chapters?language=${snippetForm.language}`)
        .then(res => {
          // API returns chapter count as number, convert to array [1, 2, 3, ...]
          const chaptersData = res.data.chapters;
          if (typeof chaptersData === 'number') {
            setChapters(Array.from({ length: chaptersData }, (_, i) => i + 1));
          } else if (Array.isArray(chaptersData)) {
            setChapters(chaptersData);
          } else {
            setChapters([]);
          }
        })
        .catch(() => setChapters([]));
    }
  }, [snippetForm.book_name, snippetForm.language]);

  // Create or update snippet
  const handleSaveSnippet = async () => {
    if (!snippetForm.title || !snippetForm.book_name) {
      toast.error("Title and book are required");
      return;
    }
    
    setCreatingSnippet(true);
    try {
      if (editingSnippet) {
        // Update existing snippet
        await axios.put(`${API}/admin/bible/snippets/${editingSnippet.snippet_id}`, snippetForm, { withCredentials: true });
        toast.success("Snippet updated successfully!");
      } else {
        // Create new snippet
        await axios.post(`${API}/admin/bible/snippets`, snippetForm, { withCredentials: true });
        toast.success("Bible snippet created with audio!");
      }
      setIsSnippetModalOpen(false);
      setEditingSnippet(null);
      resetSnippetForm();
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save snippet");
    } finally {
      setCreatingSnippet(false);
    }
  };

  // Open edit modal
  const handleEditSnippet = (snippet) => {
    setEditingSnippet(snippet);
    setSnippetForm({
      title: snippet.title || "",
      description: snippet.description || "",
      book_name: snippet.book_name || "",
      chapter: snippet.chapter || 1,
      start_verse: snippet.start_verse || 1,
      end_verse: snippet.end_verse || 1,
      language: snippet.language || "sw",
      voice: snippet.voice || "",
      speed: snippet.speed || 1.0,
      gender: snippet.voice_gender || "female",
      heading: snippet.heading || "",
      subtitle: snippet.subtitle || "",
      card_type: snippet.card_type || "snippet",
      thumbnail_url: snippet.thumbnail_url || "",
      is_featured: snippet.is_featured || false,
      display_order: snippet.display_order || 0
    });
    setIsSnippetModalOpen(true);
  };

  const resetSnippetForm = () => {
    setSnippetForm({
      title: "", description: "", book_name: "", chapter: 1,
      start_verse: 1, end_verse: 1, language: "sw", voice: "", speed: 1.0,
      gender: "female",
      heading: "", subtitle: "", card_type: "snippet", thumbnail_url: "", is_featured: false, display_order: 0
    });
    setEditingSnippet(null);
  };

  // Toggle snippet active status
  const handleToggleSnippet = async (snippet) => {
    try {
      await axios.put(`${API}/admin/bible/snippets/${snippet.snippet_id}`, 
        { is_active: !snippet.is_active }, 
        { withCredentials: true }
      );
      toast.success(snippet.is_active ? "Snippet deactivated" : "Snippet activated");
      fetchData();
    } catch (e) {
      toast.error("Failed to update snippet");
    }
  };

  // Delete snippet
  const handleDeleteSnippet = async (snippetId) => {
    if (!window.confirm("Delete this snippet?")) return;
    try {
      await axios.delete(`${API}/admin/bible/snippets/${snippetId}`, { withCredentials: true });
      toast.success("Snippet deleted");
      fetchData();
    } catch (e) {
      toast.error("Failed to delete snippet");
    }
  };

  // Play snippet audio
  const handlePlaySnippet = async (snippet) => {
    if (playingSnippet === snippet.snippet_id) {
      // Stop playing
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      setPlayingSnippet(null);
      return;
    }
    
    try {
      const res = await axios.get(`${API}/bible/snippets/${snippet.snippet_id}`);
      const audioData = res.data.audio_base64;
      
      if (audioElement) {
        audioElement.pause();
      }
      
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      audio.onended = () => setPlayingSnippet(null);
      audio.play();
      setAudioElement(audio);
      setPlayingSnippet(snippet.snippet_id);
    } catch (e) {
      toast.error("Failed to play audio");
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" data-testid="bible-management-page">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen className="text-amber-400" /> Biblia na Vitabu vya Dini
          </h1>
          <p className="page-subtitle">Manage Bible content and audio snippets for users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="border-zinc-700 text-zinc-300">
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
          <Button onClick={() => { resetSnippetForm(); setIsSnippetModalOpen(true); }} className="bg-amber-600 hover:bg-amber-700" data-testid="add-snippet-btn">
            <Plus size={16} className="mr-2" /> Create Snippet
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <BookMarked size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.book_count}</p>
                <p className="text-xs text-zinc-400">Bible Books</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <BookOpen size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.verse_count.toLocaleString()}</p>
                <p className="text-xs text-zinc-400">Total Verses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Mic2 size={20} className="text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{snippets.length}</p>
                <p className="text-xs text-zinc-400">Audio Snippets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <TrendingUp size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analytics?.total_listens || 0}</p>
                <p className="text-xs text-zinc-400">Total Listens (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Initialize Bible Data if not present */}
      {!stats.has_data && (
        <Card className="bg-amber-900/20 border-amber-500/30 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <AlertCircle size={40} className="text-amber-400" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Bible Data Not Initialized</h3>
                <p className="text-zinc-400 text-sm">Download and store the Swahili Bible to enable all features.</p>
              </div>
              <Button 
                onClick={() => handleInitializeBible("sw")} 
                disabled={initializing}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {initializing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    Initialize Swahili Bible
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="snippets" className="data-[state=active]:bg-amber-600">
            <Mic2 size={14} className="mr-2" /> Audio Snippets ({snippets.length})
          </TabsTrigger>
          <TabsTrigger value="cache" className="data-[state=active]:bg-cyan-600">
            <Database size={14} className="mr-2" /> TTS Cache
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-amber-600">
            <BarChart3 size={14} className="mr-2" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-amber-600">
            <Settings size={14} className="mr-2" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Snippets Tab */}
        <TabsContent value="snippets" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-zinc-400 text-sm">Pre-generated Bible passages with AI audio for users to listen</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {snippets.map((snippet) => (
              <Card 
                key={snippet.snippet_id} 
                className={`bg-zinc-900/50 border-zinc-800 ${!snippet.is_active && 'opacity-60'}`}
                data-testid={`snippet-card-${snippet.snippet_id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-white">{snippet.title}</h4>
                      <p className="text-xs text-amber-400">{snippet.reference}</p>
                    </div>
                    <Badge className={snippet.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                      {snippet.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  {snippet.description && (
                    <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{snippet.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
                    <Volume2 size={12} />
                    <span>{snippet.voice}</span>
                    <span>•</span>
                    <Play size={12} />
                    <span>{snippet.play_count} plays</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={`flex-1 border-zinc-700 ${playingSnippet === snippet.snippet_id ? 'bg-amber-600 text-white' : ''}`}
                      onClick={() => handlePlaySnippet(snippet)}
                    >
                      {playingSnippet === snippet.snippet_id ? (
                        <><Pause size={14} className="mr-1" /> Stop</>
                      ) : (
                        <><Play size={14} className="mr-1" /> Play</>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-zinc-700"
                      onClick={() => handleEditSnippet(snippet)}
                      title="Edit snippet"
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={snippet.is_active ? "border-amber-700 text-amber-400" : "border-green-700 text-green-400"}
                      onClick={() => handleToggleSnippet(snippet)}
                      title={snippet.is_active ? "Disable" : "Enable"}
                    >
                      {snippet.is_active ? <X size={14} /> : <Check size={14} />}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-800 text-red-400 hover:bg-red-900/30"
                      onClick={() => handleDeleteSnippet(snippet.snippet_id)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {snippets.length === 0 && (
              <div className="col-span-full text-center py-12 text-zinc-500">
                <Mic2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>No audio snippets created yet</p>
                <p className="text-sm">Create snippets for users to listen to Bible passages</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TTS Cache Tab */}
        <TabsContent value="cache" className="space-y-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database size={18} className="text-cyan-400" />
                    Cached TTS Audio
                  </CardTitle>
                  <CardDescription>
                    {cacheStats.total} cached recordings • {cacheStats.size_mb?.toFixed(2) || 0} MB total
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  className="border-red-700 text-red-400 hover:bg-red-900/30"
                  onClick={handleClearAllCache}
                  disabled={ttsCache.length === 0}
                >
                  <Trash2 size={14} className="mr-2" />
                  Clear All Cache
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCache ? (
                <div className="text-center py-8 text-zinc-500">
                  <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
                  <p>Loading cache...</p>
                </div>
              ) : ttsCache.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Database size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No cached audio yet</p>
                  <p className="text-sm">Audio will be cached when users listen to Bible verses</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {ttsCache.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{entry.text?.substring(0, 60)}...</p>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Volume2 size={12} />
                            {entry.voice || "default"}
                          </span>
                          <span>{((entry.size_bytes || 0) / 1024).toFixed(1)} KB</span>
                          <span>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : "N/A"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-zinc-700"
                          onClick={() => handlePlayCacheEntry(entry)}
                          disabled={!entry.audio_base64}
                        >
                          <Play size={12} />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-red-700 text-red-400"
                          onClick={() => handleDeleteCacheEntry(entry.cache_key)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Popular Books */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp size={18} className="text-emerald-400" />
                    Most Popular Books
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.popular_books?.slice(0, 5).map((item, idx) => (
                      <div key={item.book} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-white">{item.book}</span>
                        </div>
                        <Badge className="bg-zinc-800">{item.count} listens</Badge>
                      </div>
                    ))}
                    {(!analytics.popular_books || analytics.popular_books.length === 0) && (
                      <p className="text-zinc-500 text-center py-4">No data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Listening Times */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock size={18} className="text-blue-400" />
                    Listening Times
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.listening_times?.map((item) => {
                      const labels = {
                        morning: "🌅 Morning (5am-12pm)",
                        afternoon: "☀️ Afternoon (12pm-5pm)",
                        evening: "🌆 Evening (5pm-9pm)",
                        night: "🌙 Night (9pm-5am)"
                      };
                      return (
                        <div key={item.time} className="flex items-center justify-between">
                          <span className="text-white">{labels[item.time] || item.time}</span>
                          <Badge className="bg-zinc-800">{item.count} listens</Badge>
                        </div>
                      );
                    })}
                    {(!analytics.listening_times || analytics.listening_times.length === 0) && (
                      <p className="text-zinc-500 text-center py-4">No data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Snippets */}
              <Card className="bg-zinc-900/50 border-zinc-800 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mic2 size={18} className="text-violet-400" />
                    Top Snippets by Plays
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.top_snippets?.map((snippet, idx) => (
                      <div key={snippet.snippet_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-medium text-white">{snippet.title}</p>
                            <p className="text-xs text-zinc-400">{snippet.reference}</p>
                          </div>
                        </div>
                        <Badge className="bg-violet-500/20 text-violet-400">{snippet.play_count} plays</Badge>
                      </div>
                    ))}
                    {(!analytics.top_snippets || analytics.top_snippets.length === 0) && (
                      <p className="text-zinc-500 text-center py-4">No snippets played yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
              <p>Loading analytics...</p>
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          {/* Listening Limits Section */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock size={20} className="text-amber-500" />
                    Listening Limits & Donation Prompt
                  </CardTitle>
                  <CardDescription>Configure free/paid user listening limits and donation messages</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Enable Limits</span>
                  <Switch
                    checked={listeningSettings.is_active}
                    onCheckedChange={(v) => setListeningSettings({...listeningSettings, is_active: v})}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Listening Stats */}
              {listeningStats && (
                <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-800/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{listeningStats.total_listeners}</p>
                    <p className="text-xs text-zinc-400">Total Listeners</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-500">{listeningStats.today_listeners}</p>
                    <p className="text-xs text-zinc-400">Today&apos;s Listeners</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">{listeningStats.total_listening_hours}h</p>
                    <p className="text-xs text-zinc-400">Total Hours</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-500">{listeningStats.prompts_shown_today}</p>
                    <p className="text-xs text-zinc-400">Prompts Today</p>
                  </div>
                </div>
              )}

              {/* Free User Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-amber-500">Free Users</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400">Minutes Before Prompt</label>
                    <Input
                      type="number"
                      value={listeningSettings.free_user_minutes_before_prompt}
                      onChange={(e) => setListeningSettings({
                        ...listeningSettings, 
                        free_user_minutes_before_prompt: parseInt(e.target.value) || 0
                      })}
                      className="bg-zinc-800 border-zinc-700 mt-1"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Initial free minutes before donation prompt</p>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Additional Minutes After Dismiss</label>
                    <Input
                      type="number"
                      value={listeningSettings.free_user_additional_minutes}
                      onChange={(e) => setListeningSettings({
                        ...listeningSettings, 
                        free_user_additional_minutes: parseInt(e.target.value) || 0
                      })}
                      className="bg-zinc-800 border-zinc-700 mt-1"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Extra minutes when user clicks &quot;Later&quot;</p>
                  </div>
                </div>
              </div>


              {/* Paid User Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-green-500">Paid/Subscribed Users</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400">Limit Type</label>
                    <Select
                      value={listeningSettings.paid_user_limit_type}
                      onValueChange={(v) => setListeningSettings({...listeningSettings, paid_user_limit_type: v})}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily Limit</SelectItem>
                        <SelectItem value="monthly">Monthly Limit</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Daily Minutes</label>
                    <Input
                      type="number"
                      value={listeningSettings.paid_user_daily_minutes}
                      onChange={(e) => setListeningSettings({
                        ...listeningSettings, 
                        paid_user_daily_minutes: parseInt(e.target.value) || 0
                      })}
                      className="bg-zinc-800 border-zinc-700 mt-1"
                      disabled={listeningSettings.paid_user_limit_type === "unlimited"}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Monthly Minutes</label>
                    <Input
                      type="number"
                      value={listeningSettings.paid_user_monthly_minutes}
                      onChange={(e) => setListeningSettings({
                        ...listeningSettings, 
                        paid_user_monthly_minutes: parseInt(e.target.value) || 0
                      })}
                      className="bg-zinc-800 border-zinc-700 mt-1"
                      disabled={listeningSettings.paid_user_limit_type !== "monthly"}
                    />
                  </div>
                </div>
              </div>

              {/* Donation Messages */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-purple-500">Donation Prompt Messages</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-400">Swahili Message</label>
                    <Textarea
                      value={listeningSettings.donation_prompt_message_sw}
                      onChange={(e) => setListeningSettings({
                        ...listeningSettings, 
                        donation_prompt_message_sw: e.target.value
                      })}
                      placeholder="Kusikiliza biblia ni bure lakini teknolojia hii ina gharama..."
                      className="bg-zinc-800 border-zinc-700 mt-1 h-20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">English Message</label>
                    <Textarea
                      value={listeningSettings.donation_prompt_message_en}
                      onChange={(e) => setListeningSettings({
                        ...listeningSettings, 
                        donation_prompt_message_en: e.target.value
                      })}
                      placeholder="Listening to the Bible is free but this technology has costs..."
                      className="bg-zinc-800 border-zinc-700 mt-1 h-20"
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={saveListeningSettings}
                disabled={savingSettings}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {savingSettings ? "Saving..." : "Save Listening Settings"}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Bible Data Management</CardTitle>
                <CardDescription>Initialize or refresh Bible data from source</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">Swahili Bible</p>
                    <p className="text-xs text-zinc-400">{stats.has_data ? `${stats.verse_count} verses loaded` : "Not initialized"}</p>
                  </div>
                  <Button 
                    onClick={() => handleInitializeBible("sw")}
                    disabled={initializing}
                    variant="outline"
                    className="border-zinc-700"
                  >
                    {initializing ? "Loading..." : stats.has_data ? "Refresh" : "Initialize"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Volume2 size={20} className="text-violet-500" />
                  TTS Voices
                </CardTitle>
                <CardDescription>Select and preview AI voices for Bible reading</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Female Voices Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-pink-400">♀ Kike (Female Voices)</h4>
                    <Select value={defaultVoiceFemale} onValueChange={setDefaultVoiceFemale}>
                      <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-sm h-8">
                        <SelectValue placeholder="Select default" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {femaleVoices.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {femaleVoices.map(voice => (
                      <div 
                        key={voice.id} 
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          defaultVoiceFemale === voice.id 
                            ? 'bg-pink-500/20 border-pink-500/50' 
                            : 'bg-zinc-800/50 border-zinc-700 hover:border-pink-500/30'
                        }`}
                        onClick={() => setDefaultVoiceFemale(voice.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              defaultVoiceFemale === voice.id ? 'bg-pink-500' : 'bg-zinc-700'
                            }`}>
                              <Volume2 size={14} className="text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{voice.name}</p>
                              <p className="text-xs text-zinc-500">{voice.language}</p>
                            </div>
                          </div>
                          {defaultVoiceFemale === voice.id && (
                            <Check size={16} className="text-pink-400" />
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mb-2">{voice.description}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`w-full h-7 text-xs ${
                            previewingVoice === voice.id 
                              ? 'bg-pink-600 border-pink-600 text-white' 
                              : 'border-zinc-700'
                          }`}
                          onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice); }}
                          disabled={previewingVoice && previewingVoice !== voice.id}
                        >
                          {previewingVoice === voice.id ? (
                            <><Pause size={12} className="mr-1" /> Stop</>
                          ) : (
                            <><Play size={12} className="mr-1" /> Preview</>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Male Voices Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-blue-400">♂ Kiume (Male Voices)</h4>
                    <Select value={defaultVoiceMale} onValueChange={setDefaultVoiceMale}>
                      <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-sm h-8">
                        <SelectValue placeholder="Select default" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        {maleVoices.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {maleVoices.map(voice => (
                      <div 
                        key={voice.id} 
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          defaultVoiceMale === voice.id 
                            ? 'bg-blue-500/20 border-blue-500/50' 
                            : 'bg-zinc-800/50 border-zinc-700 hover:border-blue-500/30'
                        }`}
                        onClick={() => setDefaultVoiceMale(voice.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              defaultVoiceMale === voice.id ? 'bg-blue-500' : 'bg-zinc-700'
                            }`}>
                              <Volume2 size={14} className="text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{voice.name}</p>
                              <p className="text-xs text-zinc-500">{voice.language}</p>
                            </div>
                          </div>
                          {defaultVoiceMale === voice.id && (
                            <Check size={16} className="text-blue-400" />
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mb-2">{voice.description}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`w-full h-7 text-xs ${
                            previewingVoice === voice.id 
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'border-zinc-700'
                          }`}
                          onClick={(e) => { e.stopPropagation(); handlePreviewVoice(voice); }}
                          disabled={previewingVoice && previewingVoice !== voice.id}
                        >
                          {previewingVoice === voice.id ? (
                            <><Pause size={12} className="mr-1" /> Stop</>
                          ) : (
                            <><Play size={12} className="mr-1" /> Preview</>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <Button 
                  onClick={saveVoiceSettings}
                  disabled={savingVoiceSettings}
                  className="w-full bg-violet-600 hover:bg-violet-700"
                >
                  {savingVoiceSettings ? "Saving..." : "Save Voice Settings"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Snippet Modal */}
      <Dialog open={isSnippetModalOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingSnippet(null);
          resetSnippetForm();
        }
        setIsSnippetModalOpen(open);
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSnippet ? "Edit Bible Snippet" : "Create Bible Devotional Card"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editingSnippet ? "Update this Bible snippet" : "Select a Bible passage and create a beautiful card for the home page"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Title *</label>
              <Input
                value={snippetForm.title}
                onChange={(e) => setSnippetForm({ ...snippetForm, title: e.target.value })}
                placeholder="e.g., Beatitudes - Matthew 5:3-12"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Description</label>
              <Textarea
                value={snippetForm.description}
                onChange={(e) => setSnippetForm({ ...snippetForm, description: e.target.value })}
                placeholder="Brief description of this passage..."
                className="bg-zinc-950 border-zinc-700"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Book *</label>
                <Select 
                  value={snippetForm.book_name} 
                  onValueChange={(v) => setSnippetForm({ ...snippetForm, book_name: v, chapter: 1 })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Select book" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                    {books.map(book => (
                      <SelectItem key={book.book_id} value={book.name}>
                        {book.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Chapter</label>
                <Select 
                  value={String(snippetForm.chapter)} 
                  onValueChange={(v) => setSnippetForm({ ...snippetForm, chapter: parseInt(v) })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                    {chapters.map(ch => (
                      <SelectItem key={ch} value={String(ch)}>{ch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Start Verse</label>
                <Input
                  type="number"
                  min={1}
                  value={snippetForm.start_verse}
                  onChange={(e) => setSnippetForm({ ...snippetForm, start_verse: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">End Verse</label>
                <Input
                  type="number"
                  min={snippetForm.start_verse}
                  value={snippetForm.end_verse}
                  onChange={(e) => setSnippetForm({ ...snippetForm, end_verse: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Gender</label>
                <Select 
                  value={snippetForm.gender} 
                  onValueChange={(v) => setSnippetForm({ ...snippetForm, gender: v, voice: "" })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="female">♀ Kike (Female)</SelectItem>
                    <SelectItem value="male">♂ Kiume (Male)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Voice</label>
                <Select 
                  value={snippetForm.voice} 
                  onValueChange={(v) => setSnippetForm({ ...snippetForm, voice: v })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue placeholder="Auto (based on gender)" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="auto">Auto (based on gender)</SelectItem>
                    {(snippetForm.gender === "male" ? maleVoices : femaleVoices).map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} - {voice.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Speed: {snippetForm.speed.toFixed(1)}x</label>
                <Slider
                  value={[snippetForm.speed]}
                  onValueChange={([v]) => setSnippetForm({ ...snippetForm, speed: v })}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="mt-3"
                />
              </div>
            </div>

            {/* Devotional Card Fields */}
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-sm font-medium text-amber-400 mb-3">Home Page Card Settings</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Card Heading</label>
                  <Input
                    value={snippetForm.heading}
                    onChange={(e) => setSnippetForm({ ...snippetForm, heading: e.target.value })}
                    placeholder="e.g., Somo la Leo"
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Card Type</label>
                  <Select 
                    value={snippetForm.card_type} 
                    onValueChange={(v) => setSnippetForm({ ...snippetForm, card_type: v })}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="snippet">Regular Snippet</SelectItem>
                      <SelectItem value="daily_devotion">Daily Devotion</SelectItem>
                      <SelectItem value="featured">Featured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-sm text-zinc-400 mb-1 block">Subtitle (shows in italic)</label>
                <Input
                  value={snippetForm.subtitle}
                  onChange={(e) => setSnippetForm({ ...snippetForm, subtitle: e.target.value })}
                  placeholder="e.g., Yesu anawatokea wanafunzi wake"
                  className="bg-zinc-950 border-zinc-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Display Order</label>
                  <Input
                    type="number"
                    min={0}
                    value={snippetForm.display_order}
                    onChange={(e) => setSnippetForm({ ...snippetForm, display_order: parseInt(e.target.value) || 0 })}
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={snippetForm.is_featured}
                    onCheckedChange={(v) => setSnippetForm({ ...snippetForm, is_featured: v })}
                  />
                  <label className="text-sm text-zinc-300">Featured on Home</label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setIsSnippetModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSnippet} 
              disabled={creatingSnippet || !snippetForm.title || !snippetForm.book_name}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {creatingSnippet ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {editingSnippet ? "Saving..." : "Generating Audio..."}
                </>
              ) : (
                <>
                  <Mic2 size={16} className="mr-2" />
                  {editingSnippet ? "Save Changes" : "Create Snippet"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
