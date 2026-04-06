import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Edit2, Trash2, Play, Pause, 
  Calendar, Clock, Users, Eye, Upload, Mic,
  CheckCircle, XCircle, RefreshCw, Search, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Bible books in Swahili
const BIBLE_BOOKS = [
  // Old Testament
  "Mwanzo", "Kutoka", "Mambo ya Walawi", "Hesabu", "Kumbukumbu la Torati",
  "Yoshua", "Waamuzi", "Ruthu", "1 Samweli", "2 Samweli",
  "1 Wafalme", "2 Wafalme", "1 Mambo ya Nyakati", "2 Mambo ya Nyakati",
  "Ezra", "Nehemia", "Esta", "Ayubu", "Zaburi", "Mithali",
  "Mhubiri", "Wimbo Ulio Bora", "Isaya", "Yeremia", "Maombolezo",
  "Ezekieli", "Danieli", "Hosea", "Yoeli", "Amosi", "Obadia",
  "Yona", "Mika", "Nahumu", "Habakuki", "Sefania", "Hagai",
  "Zekaria", "Malaki",
  // New Testament
  "Mathayo", "Marko", "Luka", "Yohana", "Matendo ya Mitume",
  "Warumi", "1 Wakorintho", "2 Wakorintho", "Wagalatia", "Waefeso",
  "Wafilipi", "Wakolosai", "1 Wathesalonike", "2 Wathesalonike",
  "1 Timotheo", "2 Timotheo", "Tito", "Filemoni", "Waebrania",
  "Yakobo", "1 Petro", "2 Petro", "1 Yohana", "2 Yohana", "3 Yohana",
  "Yuda", "Ufunuo"
];

export default function NenoLaLeoPage() {
  const [activeTab, setActiveTab] = useState("content");
  const [nenoList, setNenoList] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [pendingLeaders, setPendingLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLeaderModalOpen, setIsLeaderModalOpen] = useState(false);
  const [editingNeno, setEditingNeno] = useState(null);
  const [editingLeader, setEditingLeader] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState(null); // 'reading' or 'reflection'
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  // Form states
  const [nenoForm, setNenoForm] = useState({
    leader_id: "",
    book: "",
    chapter: 1,
    verse_start: 1,
    verse_end: 1,
    word_date: new Date().toISOString().split("T")[0],
    publish_date: new Date().toISOString().split("T")[0],
    publish_time: "06:00",
    publish_now: false, // New: Publish immediately option
    reading_audio_url: "",
    reflection_audio_url: "",
    notes: ""
  });
  
  const [leaderForm, setLeaderForm] = useState({
    name: "",
    title: "",
    customTitle: "", // For custom title input
    email: "",
    phone: "",
    bio: "",
    photo_url: "",
    church_or_organization: ""
  });
  
  // Leader title options (without Sheikh, with option for custom)
  const leaderTitles = ["Fr.", "Pastor", "Rev.", "Bishop", "Dr.", "Mwl.", "Padri", "Askofu", "Kardinali"];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [nenoRes, leadersRes, pendingRes] = await Promise.all([
        axios.get(`${API}/neno-la-leo/admin/neno`, { withCredentials: true }),
        axios.get(`${API}/neno-la-leo/admin/leaders`, { withCredentials: true }),
        axios.get(`${API}/neno-la-leo/admin/pending-leaders`, { withCredentials: true })
      ]);
      setNenoList(nenoRes.data.neno_list || []);
      setLeaders(leadersRes.data.leaders || []);
      setPendingLeaders(pendingRes.data.leaders || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Create/Update Neno la Leo
  const handleSubmitNeno = async (e) => {
    e.preventDefault();
    try {
      // If publish_now is true, set publish_date and time to now
      const submitData = { ...nenoForm };
      if (submitData.publish_now) {
        const now = new Date();
        submitData.publish_date = now.toISOString().split("T")[0];
        submitData.publish_time = now.toTimeString().slice(0, 5);
      }
      delete submitData.publish_now; // Don't send this to backend
      
      if (editingNeno) {
        await axios.put(`${API}/neno-la-leo/admin/neno/${editingNeno.neno_id}`, submitData);
        toast.success("Neno la Leo updated successfully");
      } else {
        await axios.post(`${API}/neno-la-leo/admin/neno`, submitData);
        toast.success(submitData.publish_now !== false ? "Neno la Leo created and published!" : "Neno la Leo created successfully");
      }
      setIsCreateModalOpen(false);
      resetNenoForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save");
    }
  };

  // Create/Update Leader
  const handleSubmitLeader = async (e) => {
    e.preventDefault();
    try {
      // Handle custom title
      const submitData = { ...leaderForm };
      if (submitData.title === "custom") {
        submitData.title = submitData.customTitle;
      }
      delete submitData.customTitle;
      
      if (editingLeader) {
        await axios.put(`${API}/neno-la-leo/admin/leaders/${editingLeader.leader_id}`, submitData);
        toast.success("Leader updated successfully");
      } else {
        const response = await axios.post(`${API}/neno-la-leo/admin/leaders`, submitData);
        toast.success(`Leader created! Temporary password: ${response.data.temporary_password}`);
      }
      setIsLeaderModalOpen(false);
      resetLeaderForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save leader");
    }
  };

  // Delete Neno
  const handleDeleteNeno = async (nenoId) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      await axios.delete(`${API}/neno-la-leo/admin/neno/${nenoId}`, { withCredentials: true });
      toast.success("Deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  // Approve/Reject Leader
  const handleApproveLeader = async (leaderId) => {
    try {
      await axios.post(`${API}/neno-la-leo/admin/leaders/${leaderId}/approve`, {}, { withCredentials: true });
      toast.success("Leader approved");
      fetchData();
    } catch (error) {
      toast.error("Failed to approve");
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
        setAudioBlob(audioBlob);
        
        // Upload audio
        const formData = new FormData();
        formData.append('file', audioBlob, `${type}_${Date.now()}.webm`);
        formData.append('audio_type', type);
        
        try {
          const response = await axios.post(`${API}/neno-la-leo/upload-audio`, formData, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          if (type === 'reading') {
            setNenoForm(prev => ({ ...prev, reading_audio_url: response.data.audio_url }));
          } else {
            setNenoForm(prev => ({ ...prev, reflection_audio_url: response.data.audio_url }));
          }
          toast.success("Audio uploaded successfully");
        } catch (error) {
          toast.error("Failed to upload audio");
        }
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingType(type);
    } catch (error) {
      toast.error("Failed to access microphone");
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
      toast.info("Uploading audio...");
      const response = await axios.post(`${API}/neno-la-leo/upload-audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (type === 'reading') {
        setNenoForm(prev => ({ ...prev, reading_audio_url: response.data.audio_url }));
      } else {
        setNenoForm(prev => ({ ...prev, reflection_audio_url: response.data.audio_url }));
      }
      toast.success("Audio uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.detail || "Failed to upload audio");
    }
    // Reset file input
    e.target.value = '';
  };

  const resetNenoForm = () => {
    setNenoForm({
      leader_id: "",
      book: "",
      chapter: 1,
      verse_start: 1,
      verse_end: 1,
      word_date: new Date().toISOString().split("T")[0],
      publish_date: new Date().toISOString().split("T")[0],
      publish_time: "06:00",
      publish_now: false,
      reading_audio_url: "",
      reflection_audio_url: "",
      notes: ""
    });
    setEditingNeno(null);
  };

  const resetLeaderForm = () => {
    setLeaderForm({
      name: "",
      title: "",
      customTitle: "",
      email: "",
      phone: "",
      bio: "",
      photo_url: "",
      church_or_organization: ""
    });
    setEditingLeader(null);
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
      publish_now: false,
      reading_audio_url: neno.reading_audio_url || "",
      reflection_audio_url: neno.reflection_audio_url || "",
      notes: neno.notes || ""
    });
    setIsCreateModalOpen(true);
  };

  const openEditLeader = (leader) => {
    setEditingLeader(leader);
    const isCustomTitle = !leaderTitles.includes(leader.title);
    setLeaderForm({
      name: leader.name,
      title: isCustomTitle ? "custom" : leader.title,
      customTitle: isCustomTitle ? leader.title : "",
      email: leader.email,
      phone: leader.phone || "",
      bio: leader.bio || "",
      photo_url: leader.photo_url || "",
      church_or_organization: leader.church_or_organization || ""
    });
    setIsLeaderModalOpen(true);
  };

  // Toggle publish/unpublish
  const handleTogglePublish = async (nenoId, isCurrentlyActive) => {
    try {
      if (isCurrentlyActive) {
        await axios.post(`${API}/neno-la-leo/admin/neno/${nenoId}/unpublish`);
        toast.success("Content unpublished");
      } else {
        await axios.post(`${API}/neno-la-leo/admin/neno/${nenoId}/publish`);
        toast.success("Content published!");
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update status");
    }
  };

  // Filter neno list
  const filteredNeno = nenoList.filter(neno => {
    if (filter === "active" && !neno.is_active) return false;
    if (filter === "scheduled" && neno.is_active) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        neno.verse_reference?.toLowerCase().includes(search) ||
        neno.leader?.name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Neno la Leo</h1>
          <p className="text-zinc-400">Manage daily word content for users</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { resetNenoForm(); setIsCreateModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
            <Plus size={18} className="mr-2" /> New Entry
          </Button>
          <Button onClick={() => { resetLeaderForm(); setIsLeaderModalOpen(true); }} variant="outline">
            <Users size={18} className="mr-2" /> Add Leader
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Total Entries</p>
                <p className="text-2xl font-bold">{nenoList.length}</p>
              </div>
              <BookOpen className="w-10 h-10 text-violet-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Active</p>
                <p className="text-2xl font-bold">{nenoList.filter(n => n.is_active).length}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Leaders</p>
                <p className="text-2xl font-bold">{leaders.length}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Pending Approval</p>
                <p className="text-2xl font-bold">{pendingLeaders.length}</p>
              </div>
              <Clock className="w-10 h-10 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-800 border-zinc-700">
          <TabsTrigger value="content" className="data-[state=active]:bg-violet-600">
            <BookOpen size={16} className="mr-2" /> Content
          </TabsTrigger>
          <TabsTrigger value="leaders" className="data-[state=active]:bg-violet-600">
            <Users size={16} className="mr-2" /> Leaders
          </TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-violet-600">
            <Clock size={16} className="mr-2" /> Pending ({pendingLeaders.length})
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by verse or leader..."
                className="pl-10 bg-zinc-900 border-zinc-800"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px] bg-zinc-900 border-zinc-800">
                <Filter size={16} className="mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Entries</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
          </div>

          {/* Content Table */}
          <Card className="bg-zinc-900 border-zinc-800">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                  <TableHead>Verse Reference</TableHead>
                  <TableHead>Leader</TableHead>
                  <TableHead>Word Date</TableHead>
                  <TableHead>Publish Time</TableHead>
                  <TableHead>Audio</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNeno.map((neno) => (
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
                        <span>{neno.leader?.title} {neno.leader?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{neno.word_date}</TableCell>
                    <TableCell>{neno.publish_date} {neno.publish_time}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {neno.reading_audio_url && (
                          <Badge variant="outline" className="text-xs">Reading</Badge>
                        )}
                        {neno.reflection_audio_url && (
                          <Badge variant="outline" className="text-xs">Reflection</Badge>
                        )}
                        {!neno.reading_audio_url && !neno.reflection_audio_url && (
                          <span className="text-zinc-500">No audio</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {neno.is_active ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-400">Scheduled</Badge>
                      )}
                    </TableCell>
                    <TableCell>{neno.stats?.total_plays || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Publish/Unpublish toggle */}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className={neno.is_active ? "text-amber-400 hover:text-amber-300" : "text-emerald-400 hover:text-emerald-300"}
                          onClick={() => handleTogglePublish(neno.neno_id, neno.is_active)}
                          title={neno.is_active ? "Unpublish" : "Publish Now"}
                        >
                          {neno.is_active ? <Clock size={14} /> : <CheckCircle size={14} />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditNeno(neno)}>
                          <Edit2 size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => handleDeleteNeno(neno.neno_id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredNeno.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-400">
                      No entries found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Leaders Tab */}
        <TabsContent value="leaders" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaders.map((leader) => (
              <Card key={leader.leader_id} className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0">
                      {leader.photo_url ? (
                        <img src={leader.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <Users size={24} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{leader.title} {leader.name}</h3>
                      <p className="text-sm text-zinc-400 truncate">{leader.church_or_organization || "No organization"}</p>
                      <p className="text-sm text-zinc-500 truncate">{leader.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={leader.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                          {leader.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-zinc-500">{leader.stats?.total_neno || 0} entries</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openEditLeader(leader)}>
                      <Edit2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {leaders.length === 0 && (
              <div className="col-span-full text-center py-12 text-zinc-400">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No leaders registered yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Pending Leaders Tab */}
        <TabsContent value="pending" className="space-y-4">
          {pendingLeaders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingLeaders.map((leader) => (
                <Card key={leader.leader_id} className="bg-zinc-900 border-zinc-800 border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{leader.title} {leader.name}</h3>
                        <p className="text-sm text-zinc-400">{leader.church_or_organization}</p>
                        <p className="text-sm text-zinc-500">{leader.email}</p>
                        {leader.bio && <p className="text-sm text-zinc-400 mt-2 line-clamp-2">{leader.bio}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveLeader(leader.leader_id)}>
                          <CheckCircle size={14} className="mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No pending approvals</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Neno Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNeno ? "Edit" : "Create"} Neno la Leo</DialogTitle>
            <DialogDescription>Add a new daily word entry for users</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitNeno} className="space-y-4">
            {/* Leader Selection */}
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Religious Leader *</label>
              <Select value={nenoForm.leader_id} onValueChange={(v) => setNenoForm({ ...nenoForm, leader_id: v })}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                  {leaders.map((leader) => (
                    <SelectItem key={leader.leader_id} value={leader.leader_id}>
                      {leader.title} {leader.name} - {leader.church_or_organization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bible Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Book *</label>
                <Select value={nenoForm.book} onValueChange={(v) => setNenoForm({ ...nenoForm, book: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue placeholder="Select book" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 max-h-60">
                    {BIBLE_BOOKS.map((book) => (
                      <SelectItem key={book} value={book}>{book}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Chapter *</label>
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
                <label className="text-sm text-zinc-400 mb-1 block">Verse Start *</label>
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
                <label className="text-sm text-zinc-400 mb-1 block">Verse End *</label>
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
                <label className="text-sm text-zinc-400 mb-1 block">Word Date *</label>
                <Input
                  type="date"
                  value={nenoForm.word_date}
                  onChange={(e) => setNenoForm({ ...nenoForm, word_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Publish Date *</label>
                <Input
                  type="date"
                  value={nenoForm.publish_date}
                  onChange={(e) => setNenoForm({ ...nenoForm, publish_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                  disabled={nenoForm.publish_now}
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Publish Time *</label>
                <Input
                  type="time"
                  value={nenoForm.publish_time}
                  onChange={(e) => setNenoForm({ ...nenoForm, publish_time: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                  disabled={nenoForm.publish_now}
                />
              </div>
            </div>

            {/* Publish Now Option */}
            <div className="flex items-center gap-3 p-3 bg-emerald-950/30 border border-emerald-800/30 rounded-lg">
              <input
                type="checkbox"
                id="publish_now"
                checked={nenoForm.publish_now}
                onChange={(e) => setNenoForm({ ...nenoForm, publish_now: e.target.checked })}
                className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="publish_now" className="text-sm cursor-pointer">
                <span className="font-medium text-emerald-400">Chapisha Sasa (Publish Now)</span>
                <span className="text-zinc-400 ml-2">- Make available to users immediately</span>
              </label>
            </div>

            {/* Audio Section */}
            <div className="space-y-4 p-4 bg-zinc-950 rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <Mic size={16} /> Audio Content
              </h4>
              
              {/* Reading Audio */}
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Reading Audio</label>
                <div className="flex gap-2">
                  <Input
                    value={nenoForm.reading_audio_url}
                    onChange={(e) => setNenoForm({ ...nenoForm, reading_audio_url: e.target.value })}
                    placeholder="Audio URL or record/upload"
                    className="bg-zinc-900 border-zinc-800 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => isRecording && recordingType === 'reading' ? stopRecording() : startRecording('reading')}
                    className={isRecording && recordingType === 'reading' ? 'bg-red-600 text-white' : ''}
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
                <label className="text-sm text-zinc-400 mb-2 block">Reflection Audio</label>
                <div className="flex gap-2">
                  <Input
                    value={nenoForm.reflection_audio_url}
                    onChange={(e) => setNenoForm({ ...nenoForm, reflection_audio_url: e.target.value })}
                    placeholder="Audio URL or record/upload"
                    className="bg-zinc-900 border-zinc-800 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon"
                    onClick={() => isRecording && recordingType === 'reflection' ? stopRecording() : startRecording('reflection')}
                    className={isRecording && recordingType === 'reflection' ? 'bg-red-600 text-white' : ''}
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
              <label className="text-sm text-zinc-400 mb-1 block">Notes (Optional)</label>
              <Textarea
                value={nenoForm.notes}
                onChange={(e) => setNenoForm({ ...nenoForm, notes: e.target.value })}
                placeholder="Additional notes or context..."
                className="bg-zinc-950 border-zinc-800"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                {editingNeno ? "Update" : "Create"} Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Leader Modal */}
      <Dialog open={isLeaderModalOpen} onOpenChange={setIsLeaderModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLeader ? "Edit" : "Add"} Religious Leader</DialogTitle>
            <DialogDescription>Add a new leader who can create Neno la Leo content</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitLeader} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className={leaderForm.title === "custom" ? "" : "col-span-1"}>
                <label className="text-sm text-zinc-400 mb-1 block">Title *</label>
                <Select value={leaderForm.title} onValueChange={(v) => setLeaderForm({ ...leaderForm, title: v, customTitle: v === "custom" ? leaderForm.customTitle : "" })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue placeholder="Select title" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {leaderTitles.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                    <SelectItem value="custom">+ Custom Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {leaderForm.title === "custom" && (
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Custom Title *</label>
                  <Input
                    value={leaderForm.customTitle}
                    onChange={(e) => setLeaderForm({ ...leaderForm, customTitle: e.target.value })}
                    placeholder="e.g., Deacon"
                    className="bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
              )}
              <div className={leaderForm.title === "custom" ? "" : "col-span-2"}>
                <label className="text-sm text-zinc-400 mb-1 block">Full Name *</label>
                <Input
                  value={leaderForm.name}
                  onChange={(e) => setLeaderForm({ ...leaderForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Email *</label>
              <Input
                type="email"
                value={leaderForm.email}
                onChange={(e) => setLeaderForm({ ...leaderForm, email: e.target.value })}
                placeholder="leader@church.org"
                className="bg-zinc-950 border-zinc-800"
                required
                disabled={!!editingLeader}
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Phone</label>
              <Input
                value={leaderForm.phone}
                onChange={(e) => setLeaderForm({ ...leaderForm, phone: e.target.value })}
                placeholder="+255 xxx xxx xxx"
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Church/Organization</label>
              <Input
                value={leaderForm.church_or_organization}
                onChange={(e) => setLeaderForm({ ...leaderForm, church_or_organization: e.target.value })}
                placeholder="St. Mary's Cathedral"
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Photo URL</label>
              <Input
                value={leaderForm.photo_url}
                onChange={(e) => setLeaderForm({ ...leaderForm, photo_url: e.target.value })}
                placeholder="https://..."
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Bio</label>
              <Textarea
                value={leaderForm.bio}
                onChange={(e) => setLeaderForm({ ...leaderForm, bio: e.target.value })}
                placeholder="Short biography..."
                className="bg-zinc-950 border-zinc-800"
                rows={2}
              />
            </div>

            {!editingLeader && (
              <p className="text-sm text-amber-400 bg-amber-500/10 p-3 rounded-lg">
                A temporary password will be generated. Share it with the leader so they can login to the portal.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLeaderModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                {editingLeader ? "Update" : "Create"} Leader
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
