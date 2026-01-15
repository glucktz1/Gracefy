import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Church, LogOut, Bell, Plus, Calendar, MapPin, Clock, 
  Users, Edit2, Trash2, Phone, Mail, Globe, User, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ANNOUNCEMENT_TYPES = [
  { value: "general", label: "General", color: "bg-zinc-600" },
  { value: "offering", label: "Offering", color: "bg-amber-600" },
  { value: "baptism", label: "Baptism", color: "bg-blue-600" },
  { value: "adoration", label: "Adoration", color: "bg-violet-600" },
  { value: "wedding", label: "Wedding", color: "bg-pink-600" },
  { value: "funeral", label: "Funeral", color: "bg-zinc-700" },
  { value: "meeting", label: "Meeting", color: "bg-emerald-600" },
  { value: "event", label: "Event", color: "bg-orange-600" },
  { value: "other", label: "Other", color: "bg-slate-600" },
];

export default function ChurchLeaderDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("announcements");

  // Modal states
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);

  // Form states
  const [announcementForm, setAnnouncementForm] = useState({
    date: new Date().toISOString().split('T')[0],
    title: "",
    announcement_type: "general",
    description: "",
    time: "",
    location: "",
    contact_person: "",
    contact_phone: "",
    is_recurring: false
  });

  const sessionToken = localStorage.getItem("church_leader_session");
  const churchId = localStorage.getItem("church_id");

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      
      const [profileRes, announcementsRes] = await Promise.all([
        axios.get(`${API}/church-leader/me`, { headers, withCredentials: true }),
        axios.get(`${API}/church-leader/my-announcements`, { headers, withCredentials: true })
      ]);
      
      setProfile(profileRes.data);
      setAnnouncements(announcementsRes.data.announcements || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error("Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionToken || !churchId) {
      navigate("/church/login", { replace: true });
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, churchId, navigate]);

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/church-leader/logout`, {}, {
        headers: { Authorization: `Bearer ${sessionToken}` },
        withCredentials: true
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("church_leader_session");
    localStorage.removeItem("church_id");
    localStorage.removeItem("church_name");
    localStorage.removeItem("church_leader_name");
    navigate("/church/login", { replace: true });
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      
      if (editingAnnouncement) {
        await axios.put(
          `${API}/churches/${churchId}/announcements/${editingAnnouncement.announcement_id}`,
          announcementForm,
          { headers, withCredentials: true }
        );
        toast.success("Announcement updated");
      } else {
        await axios.post(
          `${API}/church-leader/announcements`,
          announcementForm,
          { headers, withCredentials: true }
        );
        toast.success("Announcement created");
      }
      
      setIsAnnouncementModalOpen(false);
      setEditingAnnouncement(null);
      resetAnnouncementForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save announcement");
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    
    try {
      const headers = { Authorization: `Bearer ${sessionToken}` };
      await axios.delete(
        `${API}/churches/${churchId}/announcements/${announcementId}`,
        { headers, withCredentials: true }
      );
      toast.success("Announcement deleted");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete announcement");
    }
  };

  const openEditAnnouncement = (announcement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      date: announcement.date || "",
      title: announcement.title || "",
      announcement_type: announcement.announcement_type || "general",
      description: announcement.description || "",
      time: announcement.time || "",
      location: announcement.location || "",
      contact_person: announcement.contact_person || "",
      contact_phone: announcement.contact_phone || "",
      is_recurring: announcement.is_recurring || false
    });
    setIsAnnouncementModalOpen(true);
  };

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      date: new Date().toISOString().split('T')[0],
      title: "",
      announcement_type: "general",
      description: "",
      time: "",
      location: "",
      contact_person: "",
      contact_phone: "",
      is_recurring: false
    });
  };

  const getTypeBadge = (type) => {
    const typeConfig = ANNOUNCEMENT_TYPES.find(t => t.value === type) || ANNOUNCEMENT_TYPES[0];
    return <Badge className={`${typeConfig.color}/20 text-white border-none`}>{typeConfig.label}</Badge>;
  };

  // Group announcements by week
  const groupedAnnouncements = announcements.reduce((acc, ann) => {
    const date = new Date(ann.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().split('T')[0];
    
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(ann);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const church = profile?.church || {};

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center overflow-hidden">
              {church.thumbnail ? (
                <img src={church.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <Church size={24} className="text-violet-400" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{profile?.church_name}</h1>
              <p className="text-xs text-zinc-500">{profile?.name} • {profile?.email}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white" data-testid="church-leader-logout-btn">
            <LogOut size={16} className="mr-2" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Church Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                  <Bell size={20} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{announcements.length}</p>
                  <p className="text-xs text-zinc-500">Announcements</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                  <Users size={20} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{church.followers_count || 0}</p>
                  <p className="text-xs text-zinc-500">Followers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                  <Calendar size={20} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{church.prayer_schedule?.length || 0}</p>
                  <p className="text-xs text-zinc-500">Mass Times</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <MapPin size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white truncate">{church.location || "Not set"}</p>
                  <p className="text-xs text-zinc-500">Location</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="announcements" className="data-[state=active]:bg-violet-600" data-testid="tab-announcements">
              <Bell size={14} className="mr-2" /> Announcements
            </TabsTrigger>
            <TabsTrigger value="church-info" className="data-[state=active]:bg-violet-600" data-testid="tab-church-info">
              <Church size={14} className="mr-2" /> Church Info
            </TabsTrigger>
          </TabsList>

          {/* Announcements Tab */}
          <TabsContent value="announcements" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Weekly Announcements</h2>
              <Button 
                onClick={() => { resetAnnouncementForm(); setEditingAnnouncement(null); setIsAnnouncementModalOpen(true); }} 
                className="bg-violet-600 hover:bg-violet-700"
                data-testid="create-announcement-btn"
              >
                <Plus size={16} className="mr-2" /> New Announcement
              </Button>
            </div>

            {announcements.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedAnnouncements).sort((a, b) => new Date(b[0]) - new Date(a[0])).map(([weekStart, weekAnnouncements]) => (
                  <div key={weekStart}>
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">
                      Week of {new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <div className="space-y-3">
                      {weekAnnouncements.map((ann) => (
                        <Card key={ann.announcement_id} className="bg-zinc-900/50 border-zinc-800">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {getTypeBadge(ann.announcement_type)}
                                  <span className="text-xs text-zinc-500">
                                    {new Date(ann.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    {ann.time && ` at ${ann.time}`}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-white mb-1">{ann.title}</h4>
                                {ann.description && (
                                  <p className="text-sm text-zinc-400 mb-2">{ann.description}</p>
                                )}
                                {ann.location && (
                                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                                    <MapPin size={12} /> {ann.location}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditAnnouncement(ann)}
                                  className="text-zinc-400 hover:text-white"
                                >
                                  <Edit2 size={14} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteAnnouncement(ann.announcement_id)}
                                  className="text-zinc-400 hover:text-red-400"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-8 text-center">
                  <Bell size={48} className="mx-auto text-zinc-700 mb-4" />
                  <p className="text-zinc-500">No announcements yet</p>
                  <Button 
                    onClick={() => setIsAnnouncementModalOpen(true)} 
                    className="mt-4 bg-violet-600 hover:bg-violet-700"
                  >
                    Create Your First Announcement
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Church Info Tab */}
          <TabsContent value="church-info" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Church Details */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Church size={18} className="text-violet-400" /> Church Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {church.cover_image && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-zinc-800">
                      <img src={church.cover_image} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Name</p>
                    <p className="text-white font-medium">{church.name}</p>
                  </div>
                  {church.denomination && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Denomination</p>
                      <p className="text-white">{church.denomination}</p>
                    </div>
                  )}
                  {church.bio && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">About</p>
                      <p className="text-zinc-300 text-sm">{church.bio}</p>
                    </div>
                  )}
                  <div className="pt-4 border-t border-zinc-800 space-y-2">
                    {church.phone && (
                      <p className="text-sm text-zinc-400 flex items-center gap-2">
                        <Phone size={14} /> {church.phone}
                      </p>
                    )}
                    {church.email && (
                      <p className="text-sm text-zinc-400 flex items-center gap-2">
                        <Mail size={14} /> {church.email}
                      </p>
                    )}
                    {church.website && (
                      <a href={church.website} target="_blank" rel="noopener noreferrer" className="text-sm text-violet-400 flex items-center gap-2 hover:text-violet-300">
                        <Globe size={14} /> {church.website}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Prayer Schedule */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Calendar size={18} className="text-amber-400" /> Mass Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {church.prayer_schedule?.length > 0 ? (
                    <div className="space-y-3">
                      {church.prayer_schedule.map((schedule, idx) => (
                        <div key={idx} className="p-3 bg-zinc-800/50 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{schedule.day}</p>
                            <p className="text-sm text-zinc-400">{schedule.service_type}</p>
                            {schedule.description && (
                              <p className="text-xs text-zinc-500">{schedule.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-emerald-400">
                            <Clock size={14} />
                            <span className="font-mono">{schedule.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-center py-4">No schedule set</p>
                  )}
                </CardContent>
              </Card>

              {/* Leader Info */}
              {church.leader_name && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <User size={18} className="text-emerald-400" /> Parish Leader
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                        {church.leader_photo ? (
                          <img src={church.leader_photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={24} className="text-zinc-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{church.leader_name}</p>
                        <p className="text-sm text-zinc-400">{church.leader_title || "Parish Priest"}</p>
                        {church.leader_phone && (
                          <p className="text-xs text-zinc-500 mt-1">{church.leader_phone}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Location */}
              {church.location && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <MapPin size={18} className="text-blue-400" /> Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-white">{church.location}</p>
                    {church.address && <p className="text-sm text-zinc-400">{church.address}</p>}
                    {church.city && <p className="text-sm text-zinc-500">{church.city}, {church.country}</p>}
                    {church.google_maps_url && (
                      <a 
                        href={church.google_maps_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mt-2"
                      >
                        View on Google Maps <ChevronRight size={14} />
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Announcement Modal */}
      <Dialog open={isAnnouncementModalOpen} onOpenChange={setIsAnnouncementModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Announcements auto-archive after 2 weeks
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAnnouncement}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Date *</label>
                  <Input
                    type="date"
                    value={announcementForm.date}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, date: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Type</label>
                  <Select 
                    value={announcementForm.announcement_type} 
                    onValueChange={(v) => setAnnouncementForm({ ...announcementForm, announcement_type: v })}
                  >
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {ANNOUNCEMENT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Title *</label>
                <Input
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="Announcement title"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Description</label>
                <Textarea
                  value={announcementForm.description}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, description: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  rows={3}
                  placeholder="Add details..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Time</label>
                  <Input
                    value={announcementForm.time}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, time: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="e.g., 10:00 AM"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Location</label>
                  <Input
                    value={announcementForm.location}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, location: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="e.g., Main Church"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Contact Person</label>
                  <Input
                    value={announcementForm.contact_person}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, contact_person: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="Name"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Contact Phone</label>
                  <Input
                    value={announcementForm.contact_phone}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, contact_phone: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="+255..."
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAnnouncementModalOpen(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="submit-announcement-btn">
                {editingAnnouncement ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
