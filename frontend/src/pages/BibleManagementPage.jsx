import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Trash2, Edit2, Play, Pause, Download, RefreshCw,
  Volume2, Settings, BarChart3, Clock, TrendingUp, Search, ChevronRight,
  Mic2, BookMarked, Languages, AlertCircle, Check, X
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
  const [snippetForm, setSnippetForm] = useState({
    title: "", description: "", book_name: "", chapter: 1,
    start_verse: 1, end_verse: 1, language: "sw", voice: "nova", speed: 1.0
  });
  const [chapters, setChapters] = useState([]);
  const [creatingSnippet, setCreatingSnippet] = useState(false);
  
  // Audio player
  const [playingSnippet, setPlayingSnippet] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  
  // Bible initialization
  const [initializing, setInitializing] = useState(false);

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

  useEffect(() => {
    fetchData();
    fetchAnalytics();
  }, [fetchData, fetchAnalytics]);

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
        .then(res => setChapters(res.data.chapters || []))
        .catch(() => setChapters([]));
    }
  }, [snippetForm.book_name, snippetForm.language]);

  // Create snippet
  const handleCreateSnippet = async () => {
    if (!snippetForm.title || !snippetForm.book_name) {
      toast.error("Title and book are required");
      return;
    }
    
    setCreatingSnippet(true);
    try {
      await axios.post(`${API}/admin/bible/snippets`, snippetForm, { withCredentials: true });
      toast.success("Bible snippet created with audio!");
      setIsSnippetModalOpen(false);
      resetSnippetForm();
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create snippet");
    } finally {
      setCreatingSnippet(false);
    }
  };

  const resetSnippetForm = () => {
    setSnippetForm({
      title: "", description: "", book_name: "", chapter: 1,
      start_verse: 1, end_verse: 1, language: "sw", voice: "nova", speed: 1.0
    });
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
                      onClick={() => handleToggleSnippet(snippet)}
                    >
                      {snippet.is_active ? <X size={14} /> : <Check size={14} />}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-red-800 text-red-400 hover:bg-red-900/30"
                      onClick={() => handleDeleteSnippet(snippet.snippet_id)}
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
                <CardTitle className="text-lg">TTS Voices</CardTitle>
                <CardDescription>Available AI voices for Bible reading</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {voices.map(voice => (
                    <div key={voice.id} className="p-2 bg-zinc-800/50 rounded-lg text-center">
                      <p className="text-sm font-medium text-white">{voice.name}</p>
                      <p className="text-xs text-zinc-400">{voice.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Snippet Modal */}
      <Dialog open={isSnippetModalOpen} onOpenChange={setIsSnippetModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Bible Snippet</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Select a Bible passage and generate AI audio
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Voice</label>
                <Select 
                  value={snippetForm.voice} 
                  onValueChange={(v) => setSnippetForm({ ...snippetForm, voice: v })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {voices.map(voice => (
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
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-zinc-700" onClick={() => setIsSnippetModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateSnippet} 
              disabled={creatingSnippet || !snippetForm.title || !snippetForm.book_name}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {creatingSnippet ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating Audio...
                </>
              ) : (
                <>
                  <Mic2 size={16} className="mr-2" />
                  Create Snippet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
