import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Edit2, Eye, BarChart3, 
  LogOut, Home, Menu, X, Clock, CheckCircle,
  Upload, TrendingUp, Users, Play, Mic, Pause,
  Calendar, Settings, BookMarked
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BrandLogo } from "@/context/BrandingContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Bible books in Swahili
const BIBLE_BOOKS = [
  "Mwanzo", "Kutoka", "Mambo ya Walawi", "Hesabu", "Kumbukumbu la Torati",
  "Yoshua", "Waamuzi", "Ruthu", "1 Samweli", "2 Samweli",
  "1 Wafalme", "2 Wafalme", "1 Mambo ya Nyakati", "2 Mambo ya Nyakati",
  "Ezra", "Nehemia", "Esta", "Ayubu", "Zaburi", "Mithali",
  "Mhubiri", "Wimbo Ulio Bora", "Isaya", "Yeremia", "Maombolezo",
  "Ezekieli", "Danieli", "Hosea", "Yoeli", "Amosi", "Obadia",
  "Yona", "Mika", "Nahumu", "Habakuki", "Sefania", "Hagai",
  "Zekaria", "Malaki",
  "Mathayo", "Marko", "Luka", "Yohana", "Matendo ya Mitume",
  "Warumi", "1 Wakorintho", "2 Wakorintho", "Wagalatia", "Waefeso",
  "Wafilipi", "Wakolosai", "1 Wathesalonike", "2 Wathesalonike",
  "1 Timotheo", "2 Timotheo", "Tito", "Filemoni", "Waebrania",
  "Yakobo", "1 Petro", "2 Petro", "1 Yohana", "2 Yohana", "3 Yohana",
  "Yuda", "Ufunuo"
];

// Auth helper
const getAuthHeaders = () => {
  const token = localStorage.getItem("neno_leader_token");
  return { Authorization: `Bearer ${token}` };
};

export default function LeaderDashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [leader, setLeader] = useState(null);
  const [nenoList, setNenoList] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNenoModalOpen, setIsNenoModalOpen] = useState(false);
  const [editingNeno, setEditingNeno] = useState(null);
  
  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [nenoForm, setNenoForm] = useState({
    leader_id: "",
    book: "",
    chapter: 1,
    verse_start: 1,
    verse_end: 1,
    word_date: new Date().toISOString().split("T")[0],
    publish_date: new Date().toISOString().split("T")[0],
    publish_time: "06:00",
    reading_audio_url: "",
    reflection_audio_url: "",
    notes: ""
  });

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem("neno_leader_token");
    if (!token) {
      window.location.href = "/leader/login";
      return;
    }
    fetchProfile();
  }, []);

  // Fetch profile
  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/neno-la-leo/leader/me`, { headers: getAuthHeaders() });
      setLeader(response.data);
      setNenoForm(prev => ({ ...prev, leader_id: response.data.leader_id }));
      fetchData();
    } catch (error) {
      console.error("Auth error:", error);
      localStorage.removeItem("neno_leader_token");
      localStorage.removeItem("neno_leader_info");
      window.location.href = "/leader/login";
    }
  };

  // Fetch all data
  const fetchData = async () => {
    try {
      const [nenoRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/neno-la-leo/leader/my-neno`, { headers: getAuthHeaders() }),
        axios.get(`${API}/neno-la-leo/leader/analytics`, { headers: getAuthHeaders() })
      ]);
      setNenoList(nenoRes.data.neno_list || []);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Submit new/edit neno
  const handleSubmitNeno = async (e) => {
    e.preventDefault();
    try {
      if (editingNeno) {
        await axios.put(`${API}/neno-la-leo/leader/neno/${editingNeno.neno_id}`, nenoForm, { headers: getAuthHeaders() });
        toast.success("Neno la Leo limesasishwa!");
      } else {
        await axios.post(`${API}/neno-la-leo/leader/neno`, nenoForm, { headers: getAuthHeaders() });
        toast.success("Neno la Leo limeongezwa!");
      }
      setIsNenoModalOpen(false);
      resetNenoForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Imeshindwa kuhifadhi");
    }
  };

  // Audio Recording
  const startRecording = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Upload audio
        const formData = new FormData();
        formData.append('file', audioBlob, `${type}_${Date.now()}.webm`);
        formData.append('audio_type', type);
        
        try {
          const response = await axios.post(`${API}/neno-la-leo/upload-audio`, formData, {
            headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
          });
          
          if (type === 'reading') {
            setNenoForm(prev => ({ ...prev, reading_audio_url: response.data.audio_url }));
          } else {
            setNenoForm(prev => ({ ...prev, reflection_audio_url: response.data.audio_url }));
          }
          toast.success("Sauti imepakiwa!");
        } catch (error) {
          toast.error("Imeshindwa kupakia sauti");
        }
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingType(type);
    } catch (error) {
      toast.error("Imeshindwa kupata kipaza sauti");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingType(null);
    }
  };

  // File upload handler
  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('audio_type', type);
    
    try {
      const response = await axios.post(`${API}/neno-la-leo/upload-audio`, formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      
      if (type === 'reading') {
        setNenoForm(prev => ({ ...prev, reading_audio_url: response.data.audio_url }));
      } else {
        setNenoForm(prev => ({ ...prev, reflection_audio_url: response.data.audio_url }));
      }
      toast.success("Sauti imepakiwa!");
    } catch (error) {
      toast.error("Imeshindwa kupakia sauti");
    }
  };

  const resetNenoForm = () => {
    setNenoForm({
      leader_id: leader?.leader_id || "",
      book: "",
      chapter: 1,
      verse_start: 1,
      verse_end: 1,
      word_date: new Date().toISOString().split("T")[0],
      publish_date: new Date().toISOString().split("T")[0],
      publish_time: "06:00",
      reading_audio_url: "",
      reflection_audio_url: "",
      notes: ""
    });
    setEditingNeno(null);
  };

  const openEditNeno = (neno) => {
    setEditingNeno(neno);
    setNenoForm({
      leader_id: neno.leader_id,
      book: neno.book,
      chapter: neno.chapter,
      verse_start: neno.verse_start,
      verse_end: neno.verse_end,
      word_date: neno.word_date,
      publish_date: neno.publish_date,
      publish_time: neno.publish_time,
      reading_audio_url: neno.reading_audio_url || "",
      reflection_audio_url: neno.reflection_audio_url || "",
      notes: neno.notes || ""
    });
    setIsNenoModalOpen(true);
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("neno_leader_token");
    localStorage.removeItem("neno_leader_info");
    window.location.href = "/leader/login";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <BrandLogo type="icon" className="w-10 h-10 object-contain" alt="Logo" />
              <div>
                <h1 className="font-bold text-white">Gracefy</h1>
                <p className="text-xs text-zinc-500">Neno la Leo Portal</p>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden">
                {leader?.photo_url ? (
                  <img src={leader.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Users size={20} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{leader?.title} {leader?.name}</p>
                <p className="text-xs text-zinc-500 truncate">{leader?.church_or_organization}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {[
              { id: "dashboard", icon: Home, label: "Dashibodi" },
              { id: "neno", icon: BookMarked, label: "Neno la Leo" },
              { id: "analytics", icon: BarChart3, label: "Takwimu" },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id 
                    ? 'bg-violet-600 text-white' 
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={20} />
              Ondoka
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-zinc-800 text-white"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-4">
              <Button onClick={() => { resetNenoForm(); setIsNenoModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
                <Plus size={18} className="mr-2" /> Ongeza Neno
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-6">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Karibu, {leader?.title} {leader?.name}</h2>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Neno Zangu</p>
                        <p className="text-2xl font-bold text-white">{analytics?.total_neno || 0}</p>
                      </div>
                      <BookMarked className="w-10 h-10 text-violet-500/50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Zinazotumika</p>
                        <p className="text-2xl font-bold text-white">{analytics?.active_neno || 0}</p>
                      </div>
                      <CheckCircle className="w-10 h-10 text-emerald-500/50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Kusoma</p>
                        <p className="text-2xl font-bold text-white">{analytics?.total_reading_plays || 0}</p>
                      </div>
                      <BookOpen className="w-10 h-10 text-blue-500/50" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-zinc-400 text-sm">Tafakari</p>
                        <p className="text-2xl font-bold text-white">{analytics?.total_reflection_plays || 0}</p>
                      </div>
                      <Play className="w-10 h-10 text-amber-500/50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Neno */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <BookMarked size={20} /> Neno la Leo za Hivi Karibuni
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {nenoList.length > 0 ? (
                    <div className="space-y-3">
                      {nenoList.slice(0, 5).map(neno => (
                        <div key={neno.neno_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-violet-600/20 flex items-center justify-center">
                              <BookOpen className="w-6 h-6 text-violet-400" />
                            </div>
                            <div>
                              <p className="font-medium text-white">{neno.verse_reference}</p>
                              <p className="text-sm text-zinc-400">{neno.word_day_name} - {neno.word_date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-500">{neno.stats?.total_plays || 0} plays</span>
                            {neno.is_active ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-400">Scheduled</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-zinc-400 py-8">
                      <BookMarked className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Hakuna Neno la Leo bado</p>
                      <Button onClick={() => { resetNenoForm(); setIsNenoModalOpen(true); }} className="mt-4 bg-violet-600 hover:bg-violet-700">
                        <Plus size={18} className="mr-2" /> Ongeza Kwanza
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Neno la Leo Tab */}
          {activeTab === "neno" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Neno la Leo Zangu</h2>
                <Button onClick={() => { resetNenoForm(); setIsNenoModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
                  <Plus size={18} className="mr-2" /> Ongeza Neno
                </Button>
              </div>

              <div className="space-y-4">
                {nenoList.map(neno => (
                  <Card key={neno.neno_id} className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-violet-600/30 to-violet-900/30 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-10 h-10 text-violet-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg text-white">{neno.verse_reference}</h3>
                              <p className="text-sm text-zinc-400">{neno.word_day_name} - {neno.word_date}</p>
                            </div>
                            {neno.is_active ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400">
                                <CheckCircle size={12} className="mr-1" /> Active
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-400">
                                <Clock size={12} className="mr-1" /> Scheduled
                              </Badge>
                            )}
                          </div>
                          
                          {neno.notes && (
                            <p className="text-sm text-zinc-400 mt-2">{neno.notes}</p>
                          )}
                          
                          <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Play size={14} /> {neno.stats?.total_plays || 0} plays
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={14} /> Publish: {neno.publish_date} {neno.publish_time}
                            </span>
                          </div>

                          {/* Audio indicators */}
                          <div className="flex gap-2 mt-3">
                            {neno.reading_audio_url && (
                              <Badge variant="outline" className="text-xs text-zinc-400">
                                <BookOpen size={10} className="mr-1" /> Kusoma
                              </Badge>
                            )}
                            {neno.reflection_audio_url && (
                              <Badge variant="outline" className="text-xs text-zinc-400">
                                <Mic size={10} className="mr-1" /> Tafakari
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => openEditNeno(neno)} className="text-zinc-400 hover:text-white">
                          <Edit2 size={16} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {nenoList.length === 0 && (
                  <div className="text-center py-12 text-zinc-400">
                    <BookMarked className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Hakuna Neno la Leo bado</p>
                    <Button onClick={() => { resetNenoForm(); setIsNenoModalOpen(true); }} className="mt-4 bg-violet-600 hover:bg-violet-700">
                      <Plus size={18} className="mr-2" /> Ongeza Kwanza
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Takwimu</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                    <p className="text-3xl font-bold text-white">{analytics?.total_plays || 0}</p>
                    <p className="text-zinc-400">Jumla Kusikilizwa</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                    <p className="text-3xl font-bold text-white">{analytics?.total_reading_plays || 0}</p>
                    <p className="text-zinc-400">Kusoma kwa Sauti</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardContent className="p-6 text-center">
                    <Mic className="w-12 h-12 mx-auto mb-3 text-violet-500" />
                    <p className="text-3xl font-bold text-white">{analytics?.total_reflection_plays || 0}</p>
                    <p className="text-zinc-400">Tafakari</p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Neno */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white">Neno Zinazopendwa Zaidi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.top_neno?.map((neno, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-bold">
                            {i + 1}
                          </div>
                          <span className="font-medium text-white">{neno.verse_reference}</span>
                        </div>
                        <span className="text-zinc-400">{neno.stats?.total_plays || 0} plays</span>
                      </div>
                    ))}
                    {(!analytics?.top_neno || analytics.top_neno.length === 0) && (
                      <p className="text-center text-zinc-400 py-4">Hakuna data bado</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Neno Modal */}
      <Dialog open={isNenoModalOpen} onOpenChange={setIsNenoModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editingNeno ? "Hariri" : "Ongeza"} Neno la Leo</DialogTitle>
            <DialogDescription>Andaa ujumbe wa kila siku kwa watumiaji</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitNeno} className="space-y-4">
            {/* Bible Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Kitabu *</label>
                <Select value={nenoForm.book} onValueChange={(v) => setNenoForm({ ...nenoForm, book: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue placeholder="Chagua kitabu" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                    {BIBLE_BOOKS.map((book) => (
                      <SelectItem key={book} value={book}>{book}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Sura *</label>
                <Input
                  type="number"
                  min={1}
                  value={nenoForm.chapter}
                  onChange={(e) => setNenoForm({ ...nenoForm, chapter: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Mstari wa Kuanzia *</label>
                <Input
                  type="number"
                  min={1}
                  value={nenoForm.verse_start}
                  onChange={(e) => setNenoForm({ ...nenoForm, verse_start: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Mstari wa Mwisho *</label>
                <Input
                  type="number"
                  min={1}
                  value={nenoForm.verse_end}
                  onChange={(e) => setNenoForm({ ...nenoForm, verse_end: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Tarehe ya Neno *</label>
                <Input
                  type="date"
                  value={nenoForm.word_date}
                  onChange={(e) => setNenoForm({ ...nenoForm, word_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Tarehe ya Kuchapisha *</label>
                <Input
                  type="date"
                  value={nenoForm.publish_date}
                  onChange={(e) => setNenoForm({ ...nenoForm, publish_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Saa ya Kuchapisha *</label>
                <Input
                  type="time"
                  value={nenoForm.publish_time}
                  onChange={(e) => setNenoForm({ ...nenoForm, publish_time: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>

            {/* Audio Section */}
            <div className="space-y-4 p-4 bg-zinc-950 rounded-lg">
              <h4 className="font-medium flex items-center gap-2 text-white">
                <Mic size={16} /> Sauti
              </h4>
              
              {/* Reading Audio */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Kusoma kwa Sauti</label>
                <div className="flex gap-2">
                  <Input
                    value={nenoForm.reading_audio_url}
                    onChange={(e) => setNenoForm({ ...nenoForm, reading_audio_url: e.target.value })}
                    placeholder="URL ya sauti au rekodi/pakia"
                    className="bg-zinc-900 border-zinc-800 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => isRecording && recordingType === 'reading' ? stopRecording() : startRecording('reading')}
                    className={isRecording && recordingType === 'reading' ? 'bg-red-600 text-white border-red-600' : ''}
                  >
                    {isRecording && recordingType === 'reading' ? <Pause size={16} /> : <Mic size={16} />}
                  </Button>
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" size="icon" asChild>
                      <span><Upload size={16} /></span>
                    </Button>
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'reading')} />
                  </label>
                </div>
                {nenoForm.reading_audio_url && (
                  <audio src={nenoForm.reading_audio_url} controls className="w-full mt-2 h-8" />
                )}
              </div>

              {/* Reflection Audio */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Tafakari</label>
                <div className="flex gap-2">
                  <Input
                    value={nenoForm.reflection_audio_url}
                    onChange={(e) => setNenoForm({ ...nenoForm, reflection_audio_url: e.target.value })}
                    placeholder="URL ya sauti au rekodi/pakia"
                    className="bg-zinc-900 border-zinc-800 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => isRecording && recordingType === 'reflection' ? stopRecording() : startRecording('reflection')}
                    className={isRecording && recordingType === 'reflection' ? 'bg-red-600 text-white border-red-600' : ''}
                  >
                    {isRecording && recordingType === 'reflection' ? <Pause size={16} /> : <Mic size={16} />}
                  </Button>
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" size="icon" asChild>
                      <span><Upload size={16} /></span>
                    </Button>
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'reflection')} />
                  </label>
                </div>
                {nenoForm.reflection_audio_url && (
                  <audio src={nenoForm.reflection_audio_url} controls className="w-full mt-2 h-8" />
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Maelezo (Hiari)</label>
              <Textarea
                value={nenoForm.notes}
                onChange={(e) => setNenoForm({ ...nenoForm, notes: e.target.value })}
                placeholder="Maelezo ya ziada..."
                className="bg-zinc-950 border-zinc-800"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNenoModalOpen(false)}>Ghairi</Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                {editingNeno ? "Sasisha" : "Ongeza"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
