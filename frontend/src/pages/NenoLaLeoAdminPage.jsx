import { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  BookOpen, Plus, Edit2, Trash2, Calendar, Clock, Upload,
  Play, Pause, User, CheckCircle, XCircle, Filter, Search, Mic, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BIBLE_BOOKS } from "@/utils/bibleBooks";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const emptyForm = {
  leader_id: "",
  book: "Luka",
  chapter: 1,
  verse_start: 1,
  verse_end: 1,
  word_date: new Date().toISOString().slice(0, 10),
  publish_date: new Date().toISOString().slice(0, 10),
  publish_time: "06:00",
  reading_audio_url: "",
  reflection_audio_url: "",
  notes: "",
};

export default function NenoLaLeoAdminPage() {
  const [nenoList, setNenoList] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState({ reading: false, reflection: false });

  // Recording state
  const [recording, setRecording] = useState({ reading: false, reflection: false });
  const [recordedBlob, setRecordedBlob] = useState({ reading: null, reflection: null });
  const mediaRecRef = useRef({ reading: null, reflection: null });
  const chunksRef = useRef({ reading: [], reflection: [] });

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      const params = filter === "all" ? "" : `?status=${filter}`;
      const [nenoRes, leadersRes] = await Promise.all([
        axios.get(`${API}/neno-la-leo/admin/neno${params}`, { withCredentials: true }),
        axios.get(`${API}/neno-la-leo/admin/leaders`, { withCredentials: true }),
      ]);
      setNenoList(nenoRes.data.neno_list || []);
      setLeaders((leadersRes.data.leaders || []).filter(l => l.name && (l.is_active !== false)));
    } catch (e) {
      console.error(e);
      toast.error("Imeshindwa kupakua data");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, leader_id: leaders[0]?.leader_id || "" });
    setRecordedBlob({ reading: null, reflection: null });
    setIsModalOpen(true);
  };

  const openEdit = (neno) => {
    setEditing(neno);
    setForm({
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
      notes: neno.notes || "",
    });
    setRecordedBlob({ reading: null, reflection: null });
    setIsModalOpen(true);
  };

  const uploadAudio = async (file, audioType) => {
    setUploading(prev => ({ ...prev, [audioType]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("audio_type", audioType);
      const res = await axios.post(`${API}/neno-la-leo/upload-audio`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });
      const url = res.data.audio_url;
      setForm(prev => ({ ...prev, [`${audioType}_audio_url`]: url }));
      toast.success(`Sauti ya ${audioType === "reading" ? "Usomaji" : "Tafakari"} imepakiwa`);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.detail || "Imeshindwa kupakia sauti");
    } finally {
      setUploading(prev => ({ ...prev, [audioType]: false }));
    }
  };

  const handleFileChange = (e, audioType) => {
    const file = e.target.files?.[0];
    if (file) uploadAudio(file, audioType);
  };

  const startRecording = async (audioType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current[audioType] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current[audioType].push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current[audioType], { type: "audio/webm" });
        setRecordedBlob(prev => ({ ...prev, [audioType]: blob }));
        // Auto upload
        const file = new File([blob], `${audioType}_${Date.now()}.webm`, { type: "audio/webm" });
        uploadAudio(file, audioType);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecRef.current[audioType] = rec;
      rec.start();
      setRecording(prev => ({ ...prev, [audioType]: true }));
    } catch (e) {
      console.error(e);
      toast.error("Hairuhusiwi kutumia kipaza sauti");
    }
  };

  const stopRecording = (audioType) => {
    mediaRecRef.current[audioType]?.stop();
    setRecording(prev => ({ ...prev, [audioType]: false }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        chapter: parseInt(form.chapter, 10),
        verse_start: parseInt(form.verse_start, 10),
        verse_end: parseInt(form.verse_end, 10),
      };
      if (editing) {
        await axios.put(`${API}/neno-la-leo/admin/neno/${editing.neno_id}`, payload, { withCredentials: true });
        toast.success("Neno la Leo limesasishwa");
      } else {
        await axios.post(`${API}/neno-la-leo/admin/neno`, payload, { withCredentials: true });
        toast.success("Neno la Leo limeundwa");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Imeshindwa kuhifadhi");
    }
  };

  const deleteNeno = async (neno) => {
    if (!window.confirm(`Una uhakika kufuta Neno la ${neno.verse_reference}?`)) return;
    try {
      await axios.delete(`${API}/neno-la-leo/admin/neno/${neno.neno_id}`, { withCredentials: true });
      toast.success("Limefutwa");
      fetchData();
    } catch (e) {
      toast.error("Imeshindwa kufuta");
    }
  };

  const statusBadge = (neno) => {
    const now = new Date();
    const publish = new Date(neno.publish_datetime);
    if (neno.is_active) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-700"><CheckCircle size={12} className="mr-1" />Hai</Badge>;
    }
    if (publish > now) {
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-700"><Clock size={12} className="mr-1" />Ratibu</Badge>;
    }
    return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-700"><XCircle size={12} className="mr-1" />Imekwisha</Badge>;
  };

  return (
    <div className="page-container animate-fade-in p-4 lg:p-6" data-testid="neno-admin-page">
      <div className="page-header mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="text-violet-400" /> Neno la Leo
            </h1>
            <p className="text-zinc-400 mt-1">Simamia maneno ya kila siku kutoka kwa viongozi wa dini</p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600"
            data-testid="create-neno-btn"
          >
            <Plus size={18} className="mr-2" /> Ongeza Neno
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter size={16} className="text-zinc-400" />
        {[
          { v: "all", l: "Yote" },
          { v: "active", l: "Hai" },
          { v: "scheduled", l: "Ratibu" },
          { v: "inactive", l: "Imekwisha" },
        ].map(s => (
          <Button
            key={s.v}
            size="sm"
            variant={filter === s.v ? "default" : "outline"}
            className={filter === s.v ? "bg-violet-600 hover:bg-violet-700" : "border-zinc-700"}
            onClick={() => setFilter(s.v)}
            data-testid={`filter-${s.v}`}
          >
            {s.l}
          </Button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
      ) : nenoList.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-10 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-zinc-700 mb-3" />
            <p className="text-zinc-400">Hakuna Neno la Leo bado</p>
            <Button onClick={openCreate} className="mt-4 bg-violet-600 hover:bg-violet-700">
              <Plus size={16} className="mr-2" /> Ongeza la Kwanza
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nenoList.map(neno => (
            <Card key={neno.neno_id} className="bg-zinc-900 border-zinc-800 hover:border-violet-700/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-white">{neno.verse_reference}</h3>
                    <p className="text-xs text-zinc-500">{neno.word_day_name} • {neno.word_date}</p>
                  </div>
                  {statusBadge(neno)}
                </div>

                {neno.leader && (
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <User size={14} className="text-zinc-500" />
                    <span className="text-zinc-300">{neno.leader.title} {neno.leader.name}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> Chapisha: {neno.publish_date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {neno.publish_time}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3 text-xs">
                  {neno.reading_audio_url && (
                    <Badge variant="outline" className="border-emerald-700 text-emerald-400">
                      <Play size={10} className="mr-1" />Usomaji
                    </Badge>
                  )}
                  {neno.reflection_audio_url && (
                    <Badge variant="outline" className="border-violet-700 text-violet-400">
                      <Play size={10} className="mr-1" />Tafakari
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className="text-xs text-zinc-500">
                    {neno.stats?.total_plays || 0} kusikilizwa
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(neno)}
                      data-testid={`edit-neno-${neno.neno_id}`}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteNeno(neno)}
                      className="text-red-400 hover:text-red-300"
                      data-testid={`delete-neno-${neno.neno_id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Hariri Neno la Leo" : "Ongeza Neno Jipya"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Mteue kiongozi, andiko, tarehe na pakia sauti za usomaji na tafakari
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitForm} className="space-y-4">
            {/* Leader */}
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Kiongozi *</label>
              <Select value={form.leader_id} onValueChange={(v) => setForm({ ...form, leader_id: v })} required>
                <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="leader-select">
                  <SelectValue placeholder="Chagua kiongozi" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 max-h-72">
                  {leaders.map(l => (
                    <SelectItem key={l.leader_id} value={l.leader_id}>
                      {l.title} {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bible reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Kitabu *</label>
                <Select value={form.book} onValueChange={(v) => setForm({ ...form, book: v })} required>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800" data-testid="book-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 max-h-72">
                    {BIBLE_BOOKS.map(b => (
                      <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Sura *</label>
                <Input
                  type="number" min="1"
                  value={form.chapter}
                  onChange={(e) => setForm({ ...form, chapter: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Mstari kuanzia *</label>
                <Input
                  type="number" min="1"
                  value={form.verse_start}
                  onChange={(e) => setForm({ ...form, verse_start: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Mstari hadi *</label>
                <Input
                  type="number" min="1"
                  value={form.verse_end}
                  onChange={(e) => setForm({ ...form, verse_end: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Tarehe ya Neno *</label>
                <Input
                  type="date"
                  value={form.word_date}
                  onChange={(e) => setForm({ ...form, word_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Chapisha tarehe *</label>
                <Input
                  type="date"
                  value={form.publish_date}
                  onChange={(e) => setForm({ ...form, publish_date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Saa *</label>
                <Input
                  type="time"
                  value={form.publish_time}
                  onChange={(e) => setForm({ ...form, publish_time: e.target.value })}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
            </div>

            {/* Audio uploads/recording */}
            {["reading", "reflection"].map(type => (
              <div key={type} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <label className="text-sm font-medium text-white mb-2 block">
                  Sauti ya {type === "reading" ? "Usomaji wa Andiko" : "Tafakari"}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleFileChange(e, type)}
                    className="hidden"
                    id={`file-${type}`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById(`file-${type}`).click()}
                    disabled={uploading[type] || recording[type]}
                    className="border-zinc-700"
                  >
                    <Upload size={14} className="mr-1" />
                    {uploading[type] ? "Inapakia..." : "Pakia faili"}
                  </Button>
                  {!recording[type] ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => startRecording(type)}
                      disabled={uploading[type]}
                      className="border-rose-700 text-rose-400"
                    >
                      <Mic size={14} className="mr-1" /> Rekodi
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => stopRecording(type)}
                      className="bg-rose-600 hover:bg-rose-700"
                    >
                      <Square size={14} className="mr-1" /> Acha ({type})
                    </Button>
                  )}
                  {form[`${type}_audio_url`] && (
                    <audio src={form[`${type}_audio_url`]} controls className="h-8" />
                  )}
                </div>
              </div>
            ))}

            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Maelezo</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Maelezo zaidi (hiari)"
                className="bg-zinc-950 border-zinc-800"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700">
                Ghairi
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-violet-600 to-violet-700"
                data-testid="save-neno-btn"
              >
                {editing ? "Sasisha" : "Hifadhi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
