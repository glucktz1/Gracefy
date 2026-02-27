import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { 
  BookOpen, Plus, Edit2, Trash2, Play, Pause, Upload, ChevronDown, ChevronRight,
  FileAudio, Folder, Clock, Eye, Music, Check, X, MoreVertical, Calendar, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper to get proper URL
const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/api/files/") && !url.endsWith("/stream")) {
    return `${BACKEND_URL}${url}/stream`;
  }
  if (url.startsWith("/")) return `${BACKEND_URL}${url}`;
  return url;
};

export default function TeachingsPage() {
  const [teachings, setTeachings] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [songCategories, setSongCategories] = useState([]); // Unified content categories
  const [monetizationTypes, setMonetizationTypes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Teaching modal
  const [isTeachingModalOpen, setIsTeachingModalOpen] = useState(false);
  const [editingTeaching, setEditingTeaching] = useState(null);
  const [savingTeaching, setSavingTeaching] = useState(false);
  
  // Common countries for quick selection
  const COMMON_COUNTRIES = [
    { code: "GLOBAL", name: "Global (All Countries)", name_sw: "Ulimwengu Mzima" },
    { code: "TZ", name: "Tanzania", name_sw: "Tanzania" },
    { code: "KE", name: "Kenya", name_sw: "Kenya" },
    { code: "UG", name: "Uganda", name_sw: "Uganda" },
    { code: "RW", name: "Rwanda", name_sw: "Rwanda" },
    { code: "BI", name: "Burundi", name_sw: "Burundi" },
    { code: "CD", name: "DR Congo", name_sw: "DRC" },
    { code: "ZM", name: "Zambia", name_sw: "Zambia" },
    { code: "MW", name: "Malawi", name_sw: "Malawi" },
    { code: "ZA", name: "South Africa", name_sw: "Afrika Kusini" },
    { code: "US", name: "United States", name_sw: "Marekani" },
    { code: "GB", name: "United Kingdom", name_sw: "Uingereza" },
  ];
  
  // Teaching form
  const [teachingForm, setTeachingForm] = useState({
    title: "",
    title_sw: "",
    description: "",
    description_sw: "",
    thumbnail: "",
    leader_id: "",
    leader_name: "",
    category_id: "",
    category_name: "",
    song_category_id: "", // Link to unified content category system
    monetization_type: "free",
    release_date: "",
    status: "draft",
    country_codes: ["GLOBAL"]
  });
  
  // Topic modal
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [selectedTeaching, setSelectedTeaching] = useState(null);
  const [editingTopic, setEditingTopic] = useState(null);
  const [topicForm, setTopicForm] = useState({ title: "", title_sw: "", description: "" });
  
  // Lesson modal
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonForm, setLessonForm] = useState({ title: "", title_sw: "", description: "" });
  
  // File upload
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const thumbnailInputRef = useRef(null);
  
  // Audio upload for lesson
  const [audioFile, setAudioFile] = useState(null);
  const audioInputRef = useRef(null);
  
  // Audio player
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  
  // Expanded teachings (to show topics)
  const [expandedTeachings, setExpandedTeachings] = useState({});

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teachingsRes, leadersRes, catsRes, monTypesRes, statsRes, songCatsRes] = await Promise.all([
        axios.get(`${API}/teachings`),
        axios.get(`${API}/admin/leaders`),  // Use admin endpoint to get all leaders
        axios.get(`${API}/teachings/categories`),
        axios.get(`${API}/teachings/monetization-types`),
        axios.get(`${API}/teachings/stats`),
        axios.get(`${API}/song-categories/all`)
      ]);
      setTeachings(teachingsRes.data.teachings || []);
      setLeaders(leadersRes.data.leaders || []);
      setCategories(catsRes.data.categories || []);
      setMonetizationTypes(monTypesRes.data.types || []);
      setStats(statsRes.data || {});
      setSongCategories(songCatsRes.data.categories || songCatsRes.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch teaching with topics
  const fetchTeachingDetails = async (teachingId) => {
    try {
      const res = await axios.get(`${API}/teachings/${teachingId}`);
      return res.data;
    } catch (err) {
      toast.error("Failed to load teaching details");
      return null;
    }
  };

  // Toggle teaching expansion
  const toggleTeachingExpand = async (teaching) => {
    const teachingId = teaching.teaching_id;
    if (expandedTeachings[teachingId]) {
      setExpandedTeachings(prev => ({ ...prev, [teachingId]: null }));
    } else {
      const details = await fetchTeachingDetails(teachingId);
      if (details) {
        setExpandedTeachings(prev => ({ ...prev, [teachingId]: details }));
      }
    }
  };

  // Reset teaching form
  const resetTeachingForm = () => {
    setTeachingForm({
      title: "", title_sw: "", description: "", description_sw: "",
      thumbnail: "", leader_id: "", leader_name: "",
      category_id: "", category_name: "", song_category_id: "", monetization_type: "free",
      release_date: "", status: "draft", country_codes: ["GLOBAL"]
    });
    setThumbnailFile(null);
    setThumbnailPreview("");
    setEditingTeaching(null);
  };

  // Handle thumbnail selection
  const handleThumbnailSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setThumbnailPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Upload file
  const uploadFile = async (file, type = "image") => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axios.post(`${API}/upload`, formData);
    return res.data.url;
  };

  // Save teaching
  const handleSaveTeaching = async () => {
    if (!teachingForm.title) {
      toast.error("Title is required");
      return;
    }

    setSavingTeaching(true);
    try {
      let thumbnailUrl = teachingForm.thumbnail;
      if (thumbnailFile) {
        thumbnailUrl = await uploadFile(thumbnailFile);
      }

      const payload = { ...teachingForm, thumbnail: thumbnailUrl };

      if (editingTeaching) {
        await axios.put(`${API}/teachings/${editingTeaching.teaching_id}`, payload);
        toast.success("Teaching updated");
      } else {
        await axios.post(`${API}/teachings`, payload);
        toast.success("Teaching created");
      }

      setIsTeachingModalOpen(false);
      resetTeachingForm();
      fetchData();
    } catch (err) {
      toast.error("Failed to save teaching");
    } finally {
      setSavingTeaching(false);
    }
  };

  // Edit teaching
  const handleEditTeaching = (teaching) => {
    setEditingTeaching(teaching);
    setTeachingForm({
      title: teaching.title || "",
      title_sw: teaching.title_sw || "",
      description: teaching.description || "",
      description_sw: teaching.description_sw || "",
      thumbnail: teaching.thumbnail || "",
      leader_id: teaching.leader_id || "",
      leader_name: teaching.leader_name || "",
      category_id: teaching.category_id || "",
      category_name: teaching.category_name || "",
      song_category_id: teaching.song_category_id || "",
      monetization_type: teaching.monetization_type || "free",
      release_date: teaching.release_date || "",
      status: teaching.status || "draft",
      country_codes: teaching.country_codes || ["GLOBAL"]
    });
    setThumbnailPreview(teaching.thumbnail ? getMediaUrl(teaching.thumbnail) : "");
    setIsTeachingModalOpen(true);
  };

  // Delete teaching
  const handleDeleteTeaching = async (teachingId) => {
    if (!window.confirm("Delete this teaching and all its content?")) return;
    try {
      await axios.delete(`${API}/teachings/${teachingId}`);
      toast.success("Teaching deleted");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  // ============== TOPICS ==============
  
  const handleAddTopic = (teaching) => {
    setSelectedTeaching(teaching);
    setEditingTopic(null);
    setTopicForm({ title: "", title_sw: "", description: "" });
    setIsTopicModalOpen(true);
  };

  const handleEditTopic = (teaching, topic) => {
    setSelectedTeaching(teaching);
    setEditingTopic(topic);
    setTopicForm({
      title: topic.title || "",
      title_sw: topic.title_sw || "",
      description: topic.description || ""
    });
    setIsTopicModalOpen(true);
  };

  const handleSaveTopic = async () => {
    if (!topicForm.title && !topicForm.title_sw) {
      toast.error("Title is required");
      return;
    }

    try {
      if (editingTopic) {
        await axios.put(
          `${API}/teachings/${selectedTeaching.teaching_id}/topics/${editingTopic.topic_id}`,
          topicForm
        );
        toast.success("Topic updated");
      } else {
        await axios.post(
          `${API}/teachings/${selectedTeaching.teaching_id}/topics`,
          topicForm
        );
        toast.success("Topic created");
      }

      setIsTopicModalOpen(false);
      // Refresh expanded teaching
      const details = await fetchTeachingDetails(selectedTeaching.teaching_id);
      if (details) {
        setExpandedTeachings(prev => ({ ...prev, [selectedTeaching.teaching_id]: details }));
      }
      fetchData();
    } catch (err) {
      toast.error("Failed to save topic");
    }
  };

  const handleDeleteTopic = async (teaching, topic) => {
    if (!window.confirm("Delete this topic and all its lessons?")) return;
    try {
      await axios.delete(`${API}/teachings/${teaching.teaching_id}/topics/${topic.topic_id}`);
      toast.success("Topic deleted");
      const details = await fetchTeachingDetails(teaching.teaching_id);
      if (details) {
        setExpandedTeachings(prev => ({ ...prev, [teaching.teaching_id]: details }));
      }
      fetchData();
    } catch (err) {
      toast.error("Failed to delete topic");
    }
  };

  // ============== LESSONS ==============

  const handleAddLesson = (teaching, topic) => {
    setSelectedTeaching(teaching);
    setSelectedTopic(topic);
    setEditingLesson(null);
    setLessonForm({ title: "", title_sw: "", description: "" });
    setAudioFile(null);
    setIsLessonModalOpen(true);
  };

  const handleEditLesson = (teaching, topic, lesson) => {
    setSelectedTeaching(teaching);
    setSelectedTopic(topic);
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title || "",
      title_sw: lesson.title_sw || "",
      description: lesson.description || ""
    });
    setAudioFile(null);
    setIsLessonModalOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!lessonForm.title && !lessonForm.title_sw) {
      toast.error("Title is required");
      return;
    }

    setUploadingFile(true);
    setUploadProgress(0);
    try {
      let audioUrl = editingLesson?.audio_url || "";
      let audioFileId = editingLesson?.audio_file_id || "";

      // Upload audio if selected
      if (audioFile) {
        const formData = new FormData();
        formData.append("file", audioFile);
        formData.append("teaching_id", selectedTeaching.teaching_id);
        formData.append("topic_id", selectedTopic.topic_id);
        if (editingLesson) formData.append("lesson_id", editingLesson.lesson_id);
        
        // Calculate timeout based on file size (1 min per 10MB, min 2 min, max 30 min)
        const fileSizeMB = audioFile.size / (1024 * 1024);
        const timeoutMs = Math.max(120000, Math.min(1800000, fileSizeMB * 6000 + 60000));
        
        const uploadRes = await axios.post(`${API}/teachings/upload-audio`, formData, {
          timeout: timeoutMs,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        });
        audioUrl = uploadRes.data.url;
        audioFileId = uploadRes.data.file_id;
      }

      const payload = {
        ...lessonForm,
        audio_url: audioUrl,
        audio_file_id: audioFileId
      };

      if (editingLesson) {
        await axios.put(
          `${API}/teachings/${selectedTeaching.teaching_id}/topics/${selectedTopic.topic_id}/lessons/${editingLesson.lesson_id}`,
          payload
        );
        toast.success("Lesson updated");
      } else {
        await axios.post(
          `${API}/teachings/${selectedTeaching.teaching_id}/topics/${selectedTopic.topic_id}/lessons`,
          payload
        );
        toast.success("Lesson created");
      }

      setIsLessonModalOpen(false);
      // Refresh
      const details = await fetchTeachingDetails(selectedTeaching.teaching_id);
      if (details) {
        setExpandedTeachings(prev => ({ ...prev, [selectedTeaching.teaching_id]: details }));
      }
    } catch (err) {
      toast.error("Failed to save lesson");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteLesson = async (teaching, topic, lesson) => {
    if (!window.confirm("Delete this lesson?")) return;
    try {
      await axios.delete(
        `${API}/teachings/${teaching.teaching_id}/topics/${topic.topic_id}/lessons/${lesson.lesson_id}`
      );
      toast.success("Lesson deleted");
      const details = await fetchTeachingDetails(teaching.teaching_id);
      if (details) {
        setExpandedTeachings(prev => ({ ...prev, [teaching.teaching_id]: details }));
      }
    } catch (err) {
      toast.error("Failed to delete lesson");
    }
  };

  // ============== AUDIO PLAYER ==============

  const handlePlayAudio = (url, id) => {
    if (audioElement) {
      audioElement.pause();
    }

    if (playingAudio === id) {
      setPlayingAudio(null);
      setAudioElement(null);
      return;
    }

    const audio = new Audio(getMediaUrl(url));
    audio.onended = () => {
      setPlayingAudio(null);
      setAudioElement(null);
    };
    audio.play();
    setAudioElement(audio);
    setPlayingAudio(id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-amber-500" />
            Mafundisho na Tafakari
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Teachings and Reflections</p>
        </div>
        <Button
          onClick={() => { resetTeachingForm(); setIsTeachingModalOpen(true); }}
          className="bg-amber-600 hover:bg-amber-700"
        >
          <Plus size={18} className="mr-2" />
          Ongeza Mafundisho
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <BookOpen size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_teachings || 0}</p>
                <p className="text-xs text-zinc-500">Mafundisho</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Folder size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_topics || 0}</p>
                <p className="text-xs text-zinc-500">Mada</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <FileAudio size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.total_lessons || 0}</p>
                <p className="text-xs text-zinc-500">Sehemu</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Check size={20} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.published || 0}</p>
                <p className="text-xs text-zinc-500">Imechapishwa</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teachings List */}
      <div className="space-y-4">
        {teachings.map((teaching) => {
          const expanded = expandedTeachings[teaching.teaching_id];
          const isExpanded = !!expanded;

          return (
            <Card key={teaching.teaching_id} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-0">
                {/* Teaching Header */}
                <div className="p-4 flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                    {teaching.thumbnail ? (
                      <img src={getMediaUrl(teaching.thumbnail)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={24} className="text-zinc-600" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white truncate">{teaching.title || teaching.title_sw}</h3>
                      <Badge variant={teaching.status === "published" ? "default" : "secondary"} className="text-xs">
                        {teaching.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-400 line-clamp-1">{teaching.description || teaching.description_sw}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                      {teaching.leader_name && <span>{teaching.leader_name}</span>}
                      {teaching.category_name && <span>{teaching.category_name}</span>}
                      <span>{teaching.topic_count || 0} mada</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleTeachingExpand(teaching)}
                      className="text-zinc-400"
                    >
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><MoreVertical size={16} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                        <DropdownMenuItem onClick={() => handleEditTeaching(teaching)}>
                          <Edit2 size={14} className="mr-2" /> Hariri
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddTopic(teaching)}>
                          <Plus size={14} className="mr-2" /> Ongeza Mada
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteTeaching(teaching.teaching_id)} className="text-red-400">
                          <Trash2 size={14} className="mr-2" /> Futa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Topics & Lessons (Expanded) */}
                {isExpanded && expanded.topics && (
                  <div className="border-t border-zinc-800 p-4 bg-zinc-950/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-zinc-300">Mada ({expanded.topics.length})</h4>
                      <Button size="sm" variant="outline" onClick={() => handleAddTopic(teaching)} className="h-7 text-xs">
                        <Plus size={12} className="mr-1" /> Ongeza Mada
                      </Button>
                    </div>

                    {expanded.topics.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-4">Hakuna mada bado</p>
                    ) : (
                      <Accordion type="multiple" className="space-y-2">
                        {expanded.topics.map((topic) => (
                          <AccordionItem key={topic.topic_id} value={topic.topic_id} className="border border-zinc-800 rounded-lg overflow-hidden">
                            <AccordionTrigger className="px-4 py-3 hover:bg-zinc-800/50 [&[data-state=open]]:bg-zinc-800/50">
                              <div className="flex items-center gap-3 text-left">
                                <Folder size={16} className="text-blue-400" />
                                <div>
                                  <p className="font-medium text-white">{topic.title_sw || topic.title}</p>
                                  <p className="text-xs text-zinc-500">{topic.lessons?.length || 0} sehemu</p>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-zinc-500">Sehemu/Lessons</span>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="ghost" onClick={() => handleEditTopic(teaching, topic)} className="h-6 text-xs">
                                    <Edit2 size={10} className="mr-1" /> Hariri
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleAddLesson(teaching, topic)} className="h-6 text-xs">
                                    <Plus size={10} className="mr-1" /> Ongeza Sehemu
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteTopic(teaching, topic)} className="h-6 text-xs text-red-400">
                                    <Trash2 size={10} />
                                  </Button>
                                </div>
                              </div>

                              {(!topic.lessons || topic.lessons.length === 0) ? (
                                <p className="text-xs text-zinc-600 text-center py-2">Hakuna sehemu</p>
                              ) : (
                                <div className="space-y-2">
                                  {topic.lessons.map((lesson) => (
                                    <div key={lesson.lesson_id} className="flex items-center gap-3 p-2 bg-zinc-800/30 rounded-lg">
                                      <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
                                        {lesson.order}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">{lesson.title_sw || lesson.title}</p>
                                        {lesson.duration_formatted && (
                                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                                            <Clock size={10} /> {lesson.duration_formatted}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {lesson.audio_url && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handlePlayAudio(lesson.audio_url, lesson.lesson_id)}
                                            className={`h-7 w-7 p-0 ${playingAudio === lesson.lesson_id ? 'text-amber-500' : ''}`}
                                          >
                                            {playingAudio === lesson.lesson_id ? <Pause size={14} /> : <Play size={14} />}
                                          </Button>
                                        )}
                                        <Button size="sm" variant="ghost" onClick={() => handleEditLesson(teaching, topic, lesson)} className="h-7 w-7 p-0">
                                          <Edit2 size={12} />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDeleteLesson(teaching, topic, lesson)} className="h-7 w-7 p-0 text-red-400">
                                          <Trash2 size={12} />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {teachings.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p>Hakuna mafundisho bado</p>
          </div>
        )}
      </div>

      {/* Teaching Modal */}
      <Dialog open={isTeachingModalOpen} onOpenChange={(open) => { if (!open) resetTeachingForm(); setIsTeachingModalOpen(open); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTeaching ? "Hariri Mafundisho" : "Ongeza Mafundisho Mapya"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Create a new teaching series with topics and lessons
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Thumbnail */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">Picha ya Jalada</label>
              <div className="flex items-center gap-4">
                <div 
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="w-24 h-24 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center cursor-pointer hover:border-amber-500 overflow-hidden"
                >
                  {thumbnailPreview ? (
                    <img src={thumbnailPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload size={24} className="text-zinc-500" />
                  )}
                </div>
                <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={handleThumbnailSelect} className="hidden" />
                <div className="text-xs text-zinc-500">
                  <p>Click to upload thumbnail</p>
                  <p>JPG, PNG up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Kichwa (SW) *</label>
                <Input
                  value={teachingForm.title_sw}
                  onChange={(e) => setTeachingForm({ ...teachingForm, title_sw: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  placeholder="Mafundisho ya..."
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Title (EN)</label>
                <Input
                  value={teachingForm.title}
                  onChange={(e) => setTeachingForm({ ...teachingForm, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  placeholder="Teaching about..."
                />
              </div>
            </div>

            {/* Leader */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Kiongozi/Mwalimu</label>
              <Select
                value={teachingForm.leader_id || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setTeachingForm({ ...teachingForm, leader_id: "", leader_name: "" });
                  } else {
                    const leader = leaders.find(l => l.leader_id === val);
                    setTeachingForm({ ...teachingForm, leader_id: val, leader_name: leader?.name || "" });
                  }
                }}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Chagua kiongozi" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">Hakuna</SelectItem>
                  {leaders.map((leader) => (
                    <SelectItem key={leader.leader_id} value={leader.leader_id}>{leader.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Aina/Category</label>
              <Select
                value={teachingForm.category_id || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setTeachingForm({ ...teachingForm, category_id: "", category_name: "" });
                  } else {
                    const cat = categories.find(c => c.id === val);
                    setTeachingForm({ ...teachingForm, category_id: val, category_name: cat?.name || "" });
                  }
                }}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Chagua aina" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">Hakuna</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content Category (for layout section linking) */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Content Category (for home page display)</label>
              <Select
                value={teachingForm.song_category_id || "none"}
                onValueChange={(val) => {
                  setTeachingForm({ ...teachingForm, song_category_id: val === "none" ? "" : val });
                }}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Select content category" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">None</SelectItem>
                  {songCategories.map((cat) => (
                    <SelectItem key={cat.song_category_id} value={cat.song_category_id}>
                      {cat.name} {cat.name_sw && cat.name_sw !== cat.name ? `(${cat.name_sw})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500 mt-1">
                Linking to a content category will make this teaching appear in layout sections mapped to that category
              </p>
            </div>

            {/* Monetization & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Aina ya Malipo</label>
                <Select
                  value={teachingForm.monetization_type}
                  onValueChange={(val) => setTeachingForm({ ...teachingForm, monetization_type: val })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {monetizationTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Hali</label>
                <Select
                  value={teachingForm.status}
                  onValueChange={(val) => setTeachingForm({ ...teachingForm, status: val })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="draft">Rasimu</SelectItem>
                    <SelectItem value="published">Imechapishwa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Release Date */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Tarehe ya Kutolewa</label>
              <Input
                type="date"
                value={teachingForm.release_date}
                onChange={(e) => setTeachingForm({ ...teachingForm, release_date: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            {/* Country/Geo Targeting */}
            <div>
              <label className="text-sm text-zinc-400 mb-1 block flex items-center gap-2">
                <Globe size={14} className="text-blue-400" />
                Nchi Zinazoweza Kufikia (Geo Content)
              </label>
              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                <div className="grid grid-cols-2 gap-1">
                  {COMMON_COUNTRIES.map(country => (
                    <label key={country.code} className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-800 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={teachingForm.country_codes?.includes(country.code)}
                        onChange={(e) => {
                          const codes = teachingForm.country_codes || [];
                          if (e.target.checked) {
                            if (country.code === "GLOBAL") {
                              setTeachingForm({ ...teachingForm, country_codes: ["GLOBAL"] });
                            } else {
                              const filtered = codes.filter(c => c !== "GLOBAL");
                              setTeachingForm({ ...teachingForm, country_codes: [...filtered, country.code] });
                            }
                          } else {
                            setTeachingForm({ ...teachingForm, country_codes: codes.filter(c => c !== country.code) });
                          }
                        }}
                        className="rounded border-zinc-700 bg-zinc-900 text-violet-500"
                      />
                      <span>{country.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              {teachingForm.country_codes?.includes("GLOBAL") && (
                <p className="text-xs text-emerald-400 mt-1">Mafundisho yatapatikana ulimwenguni kote</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Maelezo</label>
              <Textarea
                value={teachingForm.description_sw || teachingForm.description}
                onChange={(e) => setTeachingForm({ ...teachingForm, description_sw: e.target.value, description: e.target.value })}
                className="bg-zinc-950 border-zinc-800 resize-none"
                rows={3}
                placeholder="Maelezo mafupi..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTeachingModalOpen(false)} className="border-zinc-700">
              Ghairi
            </Button>
            <Button onClick={handleSaveTeaching} disabled={savingTeaching} className="bg-amber-600 hover:bg-amber-700">
              {savingTeaching ? "Inahifadhi..." : editingTeaching ? "Hifadhi" : "Unda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic Modal */}
      <Dialog open={isTopicModalOpen} onOpenChange={setIsTopicModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Hariri Mada" : "Ongeza Mada Mpya"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Jina la Mada (SW) *</label>
              <Input
                value={topicForm.title_sw}
                onChange={(e) => setTopicForm({ ...topicForm, title_sw: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Mada ya 1..."
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Topic Title (EN)</label>
              <Input
                value={topicForm.title}
                onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Topic 1..."
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Maelezo</label>
              <Textarea
                value={topicForm.description}
                onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                className="bg-zinc-950 border-zinc-800 resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTopicModalOpen(false)} className="border-zinc-700">Ghairi</Button>
            <Button onClick={handleSaveTopic} className="bg-blue-600 hover:bg-blue-700">
              {editingTopic ? "Hifadhi" : "Unda Mada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Modal */}
      <Dialog open={isLessonModalOpen} onOpenChange={setIsLessonModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Hariri Sehemu" : "Ongeza Sehemu Mpya"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Jina (SW) *</label>
              <Input
                value={lessonForm.title_sw}
                onChange={(e) => setLessonForm({ ...lessonForm, title_sw: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Sehemu ya 1..."
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Title (EN)</label>
              <Input
                value={lessonForm.title}
                onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Lesson 1..."
              />
            </div>

            {/* Audio Upload */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">Sauti/Audio</label>
              {editingLesson?.audio_url && !audioFile && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-zinc-800/50 rounded">
                  <FileAudio size={16} className="text-green-400" />
                  <span className="text-sm text-zinc-300">Audio imepakiwa</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePlayAudio(editingLesson.audio_url, 'preview')}
                    className="h-6 w-6 p-0 ml-auto"
                  >
                    {playingAudio === 'preview' ? <Pause size={12} /> : <Play size={12} />}
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => audioInputRef.current?.click()}
                  className="border-zinc-700"
                >
                  <Upload size={14} className="mr-2" />
                  {audioFile ? audioFile.name : "Chagua Faili"}
                </Button>
                {audioFile && (
                  <Button variant="ghost" size="sm" onClick={() => setAudioFile(null)} className="text-red-400">
                    <X size={14} />
                  </Button>
                )}
              </div>
              <input ref={audioInputRef} type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0])} className="hidden" />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Maelezo</label>
              <Textarea
                value={lessonForm.description}
                onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                className="bg-zinc-950 border-zinc-800 resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {uploadingFile && uploadProgress > 0 && (
              <div className="w-full sm:w-48 mr-auto">
                <div className="text-xs text-zinc-400 mb-1">Inapakia: {uploadProgress}%</div>
                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            <Button variant="outline" onClick={() => setIsLessonModalOpen(false)} className="border-zinc-700">Ghairi</Button>
            <Button onClick={handleSaveLesson} disabled={uploadingFile} className="bg-green-600 hover:bg-green-700">
              {uploadingFile ? `Inapakia ${uploadProgress}%...` : editingLesson ? "Hifadhi" : "Unda Sehemu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
