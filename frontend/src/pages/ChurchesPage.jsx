import { useEffect, useState } from "react";
import axios from "axios";
import { 
  Church, Plus, Edit2, Trash2, MoreVertical, MapPin, Clock, Bell, 
  User, Phone, Mail, Globe, Image, Check, X, Calendar, Users,
  ExternalLink, ChevronDown, ChevronRight, Upload, Key
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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

const DENOMINATIONS = [
  { value: "roman_catholic", label: "Roman Catholic" },
  { value: "lutheran", label: "Lutheran" },
  { value: "anglican", label: "Anglican" },
  { value: "pentecostal", label: "Pentecostal" },
  { value: "adventist", label: "Seventh-day Adventist" },
  { value: "baptist", label: "Baptist" },
  { value: "methodist", label: "Methodist" },
  { value: "orthodox", label: "Orthodox" },
  { value: "other", label: "Other" },
];

const ANNOUNCEMENT_TYPES = [
  { value: "general", label: "General" },
  { value: "offering", label: "Offering" },
  { value: "baptism", label: "Baptism" },
  { value: "adoration", label: "Adoration" },
  { value: "wedding", label: "Wedding" },
  { value: "funeral", label: "Funeral" },
  { value: "meeting", label: "Meeting" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ChurchesPage() {
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [editingChurch, setEditingChurch] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedChurch, setExpandedChurch] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    denomination: "",
    location: "",
    address: "",
    city: "",
    country: "",
    direction: "",
    latitude: "",
    longitude: "",
    google_maps_url: "",
    bio: "",
    leader_name: "",
    leader_title: "Parish Priest",
    leader_phone: "",
    leader_email: "",
    leader_photo: "",
    thumbnail: "",
    cover_image: "",
    phone: "",
    email: "",
    website: "",
    prayer_schedule: [],
    status: "pending"
  });

  const [newSchedule, setNewSchedule] = useState({ 
    day: "", 
    time: "", 
    service_type: "", 
    description: "" 
  });

  const [announcementForm, setAnnouncementForm] = useState({
    date: new Date().toISOString().split('T')[0],
    title: "",
    content: "",
    image_url: "",
    announcement_type: "general",
    category: "general",
    description: "",
    time: "",
    location: "",
    contact_person: "",
    contact_phone: "",
    expires_at: ""
  });
  const [uploadingAnnouncementImage, setUploadingAnnouncementImage] = useState(false);

  // Image upload states
  const [uploadingImage, setUploadingImage] = useState({ thumbnail: false, cover: false, leader: false });
  const [imagePreview, setImagePreview] = useState({ thumbnail: "", cover_image: "", leader_photo: "" });

  // Church leader account modal
  const [isLeaderAccountModalOpen, setIsLeaderAccountModalOpen] = useState(false);
  const [leaderAccountForm, setLeaderAccountForm] = useState({
    church_id: "",
    church_name: "",
    name: "",
    email: "",
    password: "",
    phone: ""
  });

  // Handle image upload
  const handleImageUpload = async (file, type) => {
    if (!file) return;
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setUploadingImage(prev => ({ ...prev, [type]: true }));
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        
        // Upload to server
        const response = await axios.post(`${API}/upload`, {
          file: base64,
          filename: `church_${type}_${Date.now()}.${file.name.split('.').pop()}`,
          content_type: file.type
        });
        
        const imageUrl = response.data.url;
        
        // Update form data based on type
        const fieldMap = { thumbnail: "thumbnail", cover: "cover_image", leader: "leader_photo" };
        setFormData(prev => ({ ...prev, [fieldMap[type]]: imageUrl }));
        setImagePreview(prev => ({ ...prev, [fieldMap[type]]: imageUrl }));
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} image uploaded`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(prev => ({ ...prev, [type]: false }));
    }
  };

  // Create church leader account
  const handleCreateLeaderAccount = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/church-leader/create`, leaderAccountForm);
      toast.success("Church leader account created successfully");
      setIsLeaderAccountModalOpen(false);
      setLeaderAccountForm({ church_id: "", church_name: "", name: "", email: "", password: "", phone: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create account");
    }
  };

  // Open leader account modal for a church
  const openLeaderAccountModal = (church) => {
    setLeaderAccountForm({
      church_id: church.church_id,
      church_name: church.name,
      name: church.leader_name || "",
      email: church.leader_email || "",
      password: "",
      phone: church.leader_phone || ""
    });
    setIsLeaderAccountModalOpen(true);
  };

  const fetchChurches = async () => {
    try {
      const response = await axios.get(`${API}/churches`, { withCredentials: true });
      setChurches(response.data.churches || []);
    } catch (error) {
      console.error("Error fetching churches:", error);
      toast.error("Failed to load churches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChurches();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };
      
      if (editingChurch) {
        await axios.put(`${API}/churches/${editingChurch.church_id}`, payload, { withCredentials: true });
        toast.success("Church updated successfully");
      } else {
        await axios.post(`${API}/churches`, payload, { withCredentials: true });
        toast.success("Church created - pending admin approval");
      }
      setIsModalOpen(false);
      setEditingChurch(null);
      resetForm();
      fetchChurches();
    } catch (error) {
      console.error("Error saving church:", error);
      toast.error(error.response?.data?.detail || "Failed to save church");
    }
  };

  const handleApprove = async (churchId) => {
    try {
      await axios.post(`${API}/churches/${churchId}/approve`, { approved_by: "admin" }, { withCredentials: true });
      toast.success("Church approved");
      fetchChurches();
    } catch (error) {
      toast.error("Failed to approve church");
    }
  };

  const handleReject = async (churchId) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    
    try {
      await axios.post(`${API}/churches/${churchId}/reject`, { 
        rejected_by: "admin",
        admin_notes: reason 
      }, { withCredentials: true });
      toast.success("Church rejected");
      fetchChurches();
    } catch (error) {
      toast.error("Failed to reject church");
    }
  };

  const handleDelete = async (churchId) => {
    if (!window.confirm("Are you sure you want to delete this church?")) return;
    
    try {
      await axios.delete(`${API}/churches/${churchId}`, { withCredentials: true });
      toast.success("Church deleted");
      fetchChurches();
    } catch (error) {
      toast.error("Failed to delete church");
    }
  };

  const openEditModal = (church) => {
    setEditingChurch(church);
    setFormData({
      name: church.name || "",
      denomination: church.denomination || "",
      location: church.location || "",
      address: church.address || "",
      city: church.city || "",
      country: church.country || "",
      direction: church.direction || "",
      latitude: church.latitude || "",
      longitude: church.longitude || "",
      google_maps_url: church.google_maps_url || "",
      bio: church.bio || "",
      leader_name: church.leader_name || "",
      leader_title: church.leader_title || "Parish Priest",
      leader_phone: church.leader_phone || "",
      leader_email: church.leader_email || "",
      leader_photo: church.leader_photo || "",
      thumbnail: church.thumbnail || "",
      cover_image: church.cover_image || "",
      phone: church.phone || "",
      email: church.email || "",
      website: church.website || "",
      prayer_schedule: church.prayer_schedule || [],
      status: church.status || "pending"
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "", denomination: "", location: "", address: "", city: "", country: "",
      direction: "", latitude: "", longitude: "", google_maps_url: "", bio: "",
      leader_name: "", leader_title: "Parish Priest", leader_phone: "", leader_email: "",
      leader_photo: "", thumbnail: "", cover_image: "", phone: "", email: "", website: "",
      prayer_schedule: [], status: "pending"
    });
    setNewSchedule({ day: "", time: "", service_type: "", description: "" });
  };

  const addSchedule = () => {
    if (newSchedule.day && newSchedule.time && newSchedule.service_type) {
      setFormData({
        ...formData,
        prayer_schedule: [...formData.prayer_schedule, { ...newSchedule }]
      });
      setNewSchedule({ day: "", time: "", service_type: "", description: "" });
    }
  };

  const removeSchedule = (index) => {
    setFormData({
      ...formData,
      prayer_schedule: formData.prayer_schedule.filter((_, i) => i !== index)
    });
  };

  const openAnnouncementModal = (church) => {
    setSelectedChurch(church);
    setAnnouncementForm({
      date: new Date().toISOString().split('T')[0],
      title: "",
      announcement_type: "general",
      description: "",
      time: "",
      location: "",
      contact_person: "",
      contact_phone: ""
    });
    setIsAnnouncementModalOpen(true);
  };

  const handleCreateAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.date) {
      toast.error("Title and date are required");
      return;
    }
    
    try {
      await axios.post(
        `${API}/churches/${selectedChurch.church_id}/announcements`,
        announcementForm,
        { withCredentials: true }
      );
      toast.success("Announcement created");
      setIsAnnouncementModalOpen(false);
    } catch (error) {
      toast.error("Failed to create announcement");
    }
  };

  const filteredChurches = churches.filter(church => {
    if (activeTab === "all") return true;
    return church.status === activeTab;
  });

  const getStatusBadge = (status) => {
    const styles = {
      approved: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
      pending: "bg-amber-600/20 text-amber-400 border-amber-600/30",
      rejected: "bg-red-600/20 text-red-400 border-red-600/30",
    };
    return <Badge className={`${styles[status] || styles.pending} border`}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="churches-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Church className="text-violet-400" /> Churches Management
          </h1>
          <p className="text-zinc-400 mt-1">Manage churches, prayer schedules, and announcements</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingChurch(null); setIsModalOpen(true); }} className="bg-violet-600 hover:bg-violet-700">
          <Plus size={16} className="mr-2" /> Add Church
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="all">All ({churches.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({churches.filter(c => c.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({churches.filter(c => c.status === "approved").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({churches.filter(c => c.status === "rejected").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Churches List */}
      <div className="grid gap-4">
        {filteredChurches.map((church) => (
          <Card key={church.church_id} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Thumbnail with Priest Photo Overlay */}
                <div className="relative w-20 h-20 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {church.thumbnail ? (
                    <img src={church.thumbnail} alt={church.name} className="w-full h-full object-cover" />
                  ) : (
                    <Church size={32} className="text-zinc-600" />
                  )}
                  {/* Priest/Leader small circle photo at bottom-right */}
                  {church.leader_name && (
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-950 border-2 border-zinc-800 overflow-hidden flex items-center justify-center" title={`${church.leader_title || 'Leader'}: ${church.leader_name}`}>
                      {church.leader_photo ? (
                        <img src={church.leader_photo} alt={church.leader_name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={14} className="text-zinc-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white truncate">{church.name}</h3>
                    {getStatusBadge(church.status)}
                  </div>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                    {church.denomination && (
                      <span>{DENOMINATIONS.find(d => d.value === church.denomination)?.label || church.denomination}</span>
                    )}
                    {church.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {church.location}
                      </span>
                    )}
                    {church.leader_name && (
                      <span className="flex items-center gap-1">
                        <User size={12} /> {church.leader_title || "Leader"}: {church.leader_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {church.followers_count || 0} followers
                    </span>
                  </div>

                  {/* Prayer Schedule Preview */}
                  {church.prayer_schedule?.length > 0 && (
                    <div className="mt-2">
                      <button 
                        onClick={() => setExpandedChurch(expandedChurch === church.church_id ? null : church.church_id)}
                        className="text-xs text-violet-400 flex items-center gap-1 hover:text-violet-300"
                      >
                        {expandedChurch === church.church_id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {church.prayer_schedule.length} prayer schedule(s)
                      </button>
                      {expandedChurch === church.church_id && (
                        <div className="mt-2 bg-zinc-950 rounded-lg p-3 space-y-2">
                          {church.prayer_schedule.map((schedule, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <span className="text-zinc-300 font-medium w-24">{schedule.day}</span>
                              <span className="text-zinc-400">{schedule.time}</span>
                              <span className="text-violet-400">{schedule.service_type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {church.status === "pending" && (
                    <>
                      <Button size="sm" onClick={() => handleApprove(church.church_id)} className="bg-emerald-600 hover:bg-emerald-700">
                        <Check size={14} className="mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(church.church_id)} className="border-red-800 text-red-400">
                        <X size={14} className="mr-1" /> Reject
                      </Button>
                    </>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => openEditModal(church)} className="text-zinc-300">
                        <Edit2 size={14} className="mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openAnnouncementModal(church)} className="text-zinc-300">
                        <Bell size={14} className="mr-2" /> Add Announcement
                      </DropdownMenuItem>
                      {church.status === "approved" && (
                        <DropdownMenuItem onClick={() => openLeaderAccountModal(church)} className="text-violet-400">
                          <Key size={14} className="mr-2" /> Create Leader Account
                        </DropdownMenuItem>
                      )}
                      {church.google_maps_url && (
                        <DropdownMenuItem onClick={() => window.open(church.google_maps_url, '_blank')} className="text-zinc-300">
                          <ExternalLink size={14} className="mr-2" /> View on Map
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-zinc-800" />
                      <DropdownMenuItem onClick={() => handleDelete(church.church_id)} className="text-red-400">
                        <Trash2 size={14} className="mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredChurches.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            <Church size={48} className="mx-auto mb-4 opacity-50" />
            <p>No churches found</p>
          </div>
        )}
      </div>

      {/* Create/Edit Church Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingChurch ? "Edit Church" : "Add New Church"}
            </DialogTitle>
            <DialogDescription>
              Fill in the church details below. Churches require admin approval before appearing on the app.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Church Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Denomination</label>
                  <Select value={formData.denomination} onValueChange={(v) => setFormData({ ...formData, denomination: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue placeholder="Select denomination" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {DENOMINATIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Bio / Description</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  rows={3}
                />
              </div>
            </div>

            {/* Leader Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Church Leader / Parish Priest</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Title</label>
                  <Select value={formData.leader_title} onValueChange={(v) => setFormData({ ...formData, leader_title: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="Parish Priest">Parish Priest</SelectItem>
                      <SelectItem value="Pastor">Pastor</SelectItem>
                      <SelectItem value="Reverend">Reverend</SelectItem>
                      <SelectItem value="Father">Father</SelectItem>
                      <SelectItem value="Bishop">Bishop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Name</label>
                  <Input
                    value={formData.leader_name}
                    onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Phone</label>
                  <Input
                    value={formData.leader_phone}
                    onChange={(e) => setFormData({ ...formData, leader_phone: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Email</label>
                  <Input
                    value={formData.leader_email}
                    onChange={(e) => setFormData({ ...formData, leader_email: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    type="email"
                  />
                </div>
              </div>
            </div>

            {/* Location Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Location</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Location / Area *</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Full Address</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">City</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Country</label>
                  <Input
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm text-zinc-400 mb-1 block">Google Maps URL</label>
                  <Input
                    value={formData.google_maps_url}
                    onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Images (Upload)</h3>
              <div className="grid grid-cols-3 gap-4">
                {/* Thumbnail Upload */}
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Church Thumbnail</label>
                  <div className="relative">
                    <div 
                      className={`w-full h-24 rounded-lg border-2 border-dashed ${formData.thumbnail ? 'border-violet-500' : 'border-zinc-700'} bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer hover:border-violet-400 transition-colors`}
                      onClick={() => document.getElementById('thumbnail-upload').click()}
                    >
                      {uploadingImage.thumbnail ? (
                        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                      ) : formData.thumbnail ? (
                        <img src={formData.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Upload size={20} className="mx-auto text-zinc-500 mb-1" />
                          <span className="text-xs text-zinc-500">Click to upload</span>
                        </div>
                      )}
                    </div>
                    <input
                      id="thumbnail-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files[0], 'thumbnail')}
                    />
                    {formData.thumbnail && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, thumbnail: "" })}
                        className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cover Image Upload */}
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Cover Image</label>
                  <div className="relative">
                    <div 
                      className={`w-full h-24 rounded-lg border-2 border-dashed ${formData.cover_image ? 'border-violet-500' : 'border-zinc-700'} bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer hover:border-violet-400 transition-colors`}
                      onClick={() => document.getElementById('cover-upload').click()}
                    >
                      {uploadingImage.cover ? (
                        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                      ) : formData.cover_image ? (
                        <img src={formData.cover_image} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Upload size={20} className="mx-auto text-zinc-500 mb-1" />
                          <span className="text-xs text-zinc-500">Click to upload</span>
                        </div>
                      )}
                    </div>
                    <input
                      id="cover-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files[0], 'cover')}
                    />
                    {formData.cover_image && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, cover_image: "" })}
                        className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Leader Photo Upload */}
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Leader Photo</label>
                  <div className="relative">
                    <div 
                      className={`w-full h-24 rounded-lg border-2 border-dashed ${formData.leader_photo ? 'border-violet-500' : 'border-zinc-700'} bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer hover:border-violet-400 transition-colors`}
                      onClick={() => document.getElementById('leader-upload').click()}
                    >
                      {uploadingImage.leader ? (
                        <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
                      ) : formData.leader_photo ? (
                        <img src={formData.leader_photo} alt="Leader" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <User size={20} className="mx-auto text-zinc-500 mb-1" />
                          <span className="text-xs text-zinc-500">Leader photo</span>
                        </div>
                      )}
                    </div>
                    <input
                      id="leader-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files[0], 'leader')}
                    />
                    {formData.leader_photo && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, leader_photo: "" })}
                        className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 hover:bg-red-700"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Prayer Schedule */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Prayer Schedule</h3>
              <div className="grid grid-cols-5 gap-2">
                <Select value={newSchedule.day} onValueChange={(v) => setNewSchedule({ ...newSchedule, day: v })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white text-sm">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {DAYS_OF_WEEK.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={newSchedule.time}
                  onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                  placeholder="Time (e.g., 07:00)"
                  className="bg-zinc-950 border-zinc-800 text-white text-sm"
                />
                <Input
                  value={newSchedule.service_type}
                  onChange={(e) => setNewSchedule({ ...newSchedule, service_type: e.target.value })}
                  placeholder="Service Type"
                  className="bg-zinc-950 border-zinc-800 text-white text-sm"
                />
                <Input
                  value={newSchedule.description}
                  onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                  placeholder="Description"
                  className="bg-zinc-950 border-zinc-800 text-white text-sm"
                />
                <Button type="button" onClick={addSchedule} size="sm" className="bg-violet-600">
                  <Plus size={14} />
                </Button>
              </div>
              {formData.prayer_schedule.length > 0 && (
                <div className="space-y-2 bg-zinc-950 rounded-lg p-3">
                  {formData.prayer_schedule.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{s.day} at {s.time} - {s.service_type}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeSchedule(idx)} className="text-red-400 h-6 w-6 p-0">
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-violet-400 uppercase tracking-wide">Contact Information</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Phone</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Email</label>
                  <Input
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    type="email"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Website</label>
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                {editingChurch ? "Update Church" : "Create Church"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Announcement Modal */}
      <Dialog open={isAnnouncementModalOpen} onOpenChange={setIsAnnouncementModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Add Announcement</DialogTitle>
            <DialogDescription>
              Create an announcement for {selectedChurch?.name}. It will auto-archive after 2 weeks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Date *</label>
                <Input
                  type="date"
                  value={announcementForm.date}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, date: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Type</label>
                <Select value={announcementForm.announcement_type} onValueChange={(v) => setAnnouncementForm({ ...announcementForm, announcement_type: v })}>
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
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Description</label>
              <Textarea
                value={announcementForm.description}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, description: e.target.value })}
                className="bg-zinc-950 border-zinc-800 text-white"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Time (optional)</label>
                <Input
                  value={announcementForm.time}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, time: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="e.g., 10:00 AM"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Location (optional)</label>
                <Input
                  value={announcementForm.location}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, location: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAnnouncementModalOpen(false)} className="border-zinc-700 text-zinc-300">
              Cancel
            </Button>
            <Button onClick={handleCreateAnnouncement} className="bg-violet-600 hover:bg-violet-700">
              Create Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Church Leader Account Modal */}
      <Dialog open={isLeaderAccountModalOpen} onOpenChange={setIsLeaderAccountModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Key size={18} className="text-violet-400" />
              Create Church Leader Account
            </DialogTitle>
            <DialogDescription>
              Create a login account for the leader of {leaderAccountForm.church_name}. They can then manage announcements from their dashboard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLeaderAccount}>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Leader Name *</label>
                <Input
                  value={leaderAccountForm.name}
                  onChange={(e) => setLeaderAccountForm({ ...leaderAccountForm, name: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="Fr. John Doe"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Email *</label>
                <Input
                  type="email"
                  value={leaderAccountForm.email}
                  onChange={(e) => setLeaderAccountForm({ ...leaderAccountForm, email: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="leader@email.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Phone</label>
                <Input
                  value={leaderAccountForm.phone}
                  onChange={(e) => setLeaderAccountForm({ ...leaderAccountForm, phone: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="+255..."
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-1 block">Password *</label>
                <Input
                  type="password"
                  value={leaderAccountForm.password}
                  onChange={(e) => setLeaderAccountForm({ ...leaderAccountForm, password: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="Create a password"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLeaderAccountModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
