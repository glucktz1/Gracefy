import { useEffect, useState } from "react";
import axios from "axios";
import { Church, Plus, Edit2, Trash2, MoreVertical, MapPin, Clock, Bell } from "lucide-react";
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

export default function ChurchesPage() {
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChurch, setEditingChurch] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    direction: "",
    bio: "",
    priest_name: "",
    priest_photo: "",
    prayer_schedule: [],
    announcements: [],
    thumbnail: "",
    status: "pending"
  });
  const [newSchedule, setNewSchedule] = useState({ day: "", time: "", service: "" });
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", date: "", content: "" });

  const fetchChurches = async () => {
    try {
      const response = await axios.get(`${API}/churches`, { withCredentials: true });
      setChurches(response.data.churches);
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
      if (editingChurch) {
        await axios.put(`${API}/churches/${editingChurch.church_id}`, formData, { withCredentials: true });
        toast.success("Church updated successfully");
      } else {
        await axios.post(`${API}/churches`, formData, { withCredentials: true });
        toast.success("Church created successfully");
      }
      setIsModalOpen(false);
      setEditingChurch(null);
      resetForm();
      fetchChurches();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      direction: "",
      bio: "",
      priest_name: "",
      priest_photo: "",
      prayer_schedule: [],
      announcements: [],
      thumbnail: "",
      status: "pending"
    });
  };

  const handleEdit = (church) => {
    setEditingChurch(church);
    setFormData({
      name: church.name,
      location: church.location,
      direction: church.direction || "",
      bio: church.bio || "",
      priest_name: church.priest_name || "",
      priest_photo: church.priest_photo || "",
      prayer_schedule: church.prayer_schedule || [],
      announcements: church.announcements || [],
      thumbnail: church.thumbnail || "",
      status: church.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (churchId) => {
    if (!window.confirm("Are you sure you want to delete this church?")) return;
    try {
      await axios.delete(`${API}/churches/${churchId}`, { withCredentials: true });
      toast.success("Church deleted successfully");
      fetchChurches();
    } catch (error) {
      toast.error("Failed to delete church");
    }
  };

  const addSchedule = () => {
    if (newSchedule.day && newSchedule.time && newSchedule.service) {
      setFormData({
        ...formData,
        prayer_schedule: [...formData.prayer_schedule, { ...newSchedule }]
      });
      setNewSchedule({ day: "", time: "", service: "" });
    }
  };

  const removeSchedule = (index) => {
    setFormData({
      ...formData,
      prayer_schedule: formData.prayer_schedule.filter((_, i) => i !== index)
    });
  };

  const addAnnouncement = () => {
    if (newAnnouncement.title && newAnnouncement.date) {
      setFormData({
        ...formData,
        announcements: [...formData.announcements, { ...newAnnouncement }]
      });
      setNewAnnouncement({ title: "", date: "", content: "" });
    }
  };

  const removeAnnouncement = (index) => {
    setFormData({
      ...formData,
      announcements: formData.announcements.filter((_, i) => i !== index)
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: "badge-success",
      pending: "badge-warning",
      rejected: "badge-error",
      suspended: "badge-error"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="churches-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Churches</h1>
          <p className="page-subtitle">Manage churches and parishes</p>
        </div>
        <Button
          onClick={() => {
            setEditingChurch(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-church-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Church
        </Button>
      </div>

      {/* Churches Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : churches.length === 0 ? (
        <div className="empty-state">
          <Church className="empty-state-icon" />
          <p className="empty-state-title">No churches yet</p>
          <p className="empty-state-text">Add your first church</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {churches.map((church) => (
            <Card 
              key={church.church_id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300 overflow-hidden"
              data-testid={`church-card-${church.church_id}`}
            >
              <div className="h-32 bg-gradient-to-br from-violet-900/30 to-zinc-900 relative">
                {church.thumbnail && (
                  <img src={church.thumbnail} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute top-3 right-3">
                  {getStatusBadge(church.status)}
                </div>
              </div>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{church.name}</h3>
                    <div className="flex items-center gap-1 text-zinc-500 text-sm mt-1">
                      <MapPin size={14} />
                      <span>{church.location}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="action-btn">
                        <MoreVertical size={18} className="text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => handleEdit(church)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(church.church_id)}
                        className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {church.priest_name && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 text-sm font-medium">
                      {church.priest_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm text-white">{church.priest_name}</p>
                      <p className="text-xs text-zinc-500">Parish Priest</p>
                    </div>
                  </div>
                )}

                {church.prayer_schedule && church.prayer_schedule.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-1 text-zinc-400 text-xs mb-2">
                      <Clock size={12} />
                      <span>Prayer Schedule</span>
                    </div>
                    <div className="space-y-1">
                      {church.prayer_schedule.slice(0, 2).map((schedule, i) => (
                        <p key={i} className="text-xs text-zinc-500">
                          {schedule.day} - {schedule.time}: {schedule.service}
                        </p>
                      ))}
                      {church.prayer_schedule.length > 2 && (
                        <p className="text-xs text-violet-400">+{church.prayer_schedule.length - 2} more</p>
                      )}
                    </div>
                  </div>
                )}

                {church.announcements && church.announcements.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-1 text-amber-400 text-xs">
                      <Bell size={12} />
                      <span>{church.announcements.length} announcement(s)</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingChurch ? "Edit Church" : "Add New Church"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Church Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                    data-testid="church-name-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Direction/Address</label>
                <Textarea
                  value={formData.direction}
                  onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={2}
                  placeholder="How to get there..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Church Bio</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={3}
                  placeholder="Brief history and information about the church..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Parish Priest Name</label>
                  <Input
                    value={formData.priest_name}
                    onChange={(e) => setFormData({ ...formData, priest_name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Prayer Schedule */}
              <div className="form-group">
                <label className="form-label">Prayer Schedule</label>
                <div className="space-y-2">
                  {formData.prayer_schedule.map((schedule, index) => (
                    <div key={index} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-2">
                      <span className="flex-1 text-sm">{schedule.day} - {schedule.time}: {schedule.service}</span>
                      <button type="button" onClick={() => removeSchedule(index)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-4 gap-2">
                    <Input
                      value={newSchedule.day}
                      onChange={(e) => setNewSchedule({ ...newSchedule, day: e.target.value })}
                      placeholder="Day"
                      className="bg-zinc-950 border-zinc-800 text-white text-sm"
                    />
                    <Input
                      value={newSchedule.time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                      placeholder="Time"
                      className="bg-zinc-950 border-zinc-800 text-white text-sm"
                    />
                    <Input
                      value={newSchedule.service}
                      onChange={(e) => setNewSchedule({ ...newSchedule, service: e.target.value })}
                      placeholder="Service"
                      className="bg-zinc-950 border-zinc-800 text-white text-sm"
                    />
                    <Button type="button" onClick={addSchedule} variant="outline" className="border-zinc-700">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Announcements */}
              <div className="form-group">
                <label className="form-label">Announcements</label>
                <div className="space-y-2">
                  {formData.announcements.map((ann, index) => (
                    <div key={index} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-2">
                      <span className="flex-1 text-sm">{ann.date}: {ann.title}</span>
                      <button type="button" onClick={() => removeAnnouncement(index)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="grid grid-cols-4 gap-2">
                    <Input
                      type="date"
                      value={newAnnouncement.date}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, date: e.target.value })}
                      className="bg-zinc-950 border-zinc-800 text-white text-sm"
                    />
                    <Input
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      placeholder="Title"
                      className="bg-zinc-950 border-zinc-800 text-white text-sm col-span-2"
                    />
                    <Button type="button" onClick={addAnnouncement} variant="outline" className="border-zinc-700">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-church-btn">
                {editingChurch ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
