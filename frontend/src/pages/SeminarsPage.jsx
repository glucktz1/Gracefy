import { useEffect, useState } from "react";
import axios from "axios";
import { Video, Plus, Edit2, Trash2, MoreVertical, Calendar, Clock, Users, DollarSign, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

export default function SeminarsPage() {
  const [seminars, setSeminars] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeminar, setEditingSeminar] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    topic: "",
    organizer_id: "",
    organizer_name: "",
    date: "",
    time: "",
    duration: 60,
    meeting_link: "",
    is_recurring: false,
    recurrence_pattern: "",
    recurrence_days: [],
    is_paid: false,
    price: 0,
    max_participants: null,
    status: "scheduled"
  });

  const fetchData = async () => {
    try {
      const [seminarsRes, leadersRes] = await Promise.all([
        axios.get(`${API}/seminars`, { withCredentials: true }),
        axios.get(`${API}/leaders`, { withCredentials: true })
      ]);
      setSeminars(seminarsRes.data.seminars);
      setLeaders(leadersRes.data.leaders);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load seminars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        duration: parseInt(formData.duration) || 60,
        price: parseFloat(formData.price) || 0,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null
      };

      if (editingSeminar) {
        await axios.put(`${API}/seminars/${editingSeminar.seminar_id}`, data, { withCredentials: true });
        toast.success("Seminar updated successfully");
      } else {
        await axios.post(`${API}/seminars`, data, { withCredentials: true });
        toast.success("Seminar created successfully");
      }
      setIsModalOpen(false);
      setEditingSeminar(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      topic: "",
      organizer_id: "",
      organizer_name: "",
      date: "",
      time: "",
      duration: 60,
      meeting_link: "",
      is_recurring: false,
      recurrence_pattern: "",
      recurrence_days: [],
      is_paid: false,
      price: 0,
      max_participants: null,
      status: "scheduled"
    });
  };

  const handleEdit = (seminar) => {
    setEditingSeminar(seminar);
    setFormData({
      title: seminar.title,
      description: seminar.description || "",
      topic: seminar.topic,
      organizer_id: seminar.organizer_id || "",
      organizer_name: seminar.organizer_name || "",
      date: seminar.date,
      time: seminar.time,
      duration: seminar.duration || 60,
      meeting_link: seminar.meeting_link || "",
      is_recurring: seminar.is_recurring,
      recurrence_pattern: seminar.recurrence_pattern || "",
      recurrence_days: seminar.recurrence_days || [],
      is_paid: seminar.is_paid,
      price: seminar.price || 0,
      max_participants: seminar.max_participants || null,
      status: seminar.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (seminarId) => {
    if (!window.confirm("Are you sure you want to delete this seminar?")) return;
    try {
      await axios.delete(`${API}/seminars/${seminarId}`, { withCredentials: true });
      toast.success("Seminar deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete seminar");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      scheduled: "badge-info",
      ongoing: "badge-success",
      completed: "badge-violet",
      cancelled: "badge-error"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="seminars-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Live Seminars</h1>
          <p className="page-subtitle">Manage online religious classes and seminars</p>
        </div>
        <Button
          onClick={() => {
            setEditingSeminar(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-seminar-btn"
        >
          <Plus size={18} className="mr-2" />
          Create Seminar
        </Button>
      </div>

      {/* Seminars Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : seminars.length === 0 ? (
        <div className="empty-state">
          <Video className="empty-state-icon" />
          <p className="empty-state-title">No seminars yet</p>
          <p className="empty-state-text">Create your first live seminar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seminars.map((seminar) => (
            <Card 
              key={seminar.seminar_id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300"
              data-testid={`seminar-card-${seminar.seminar_id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(seminar.status)}
                      {seminar.is_paid && (
                        <span className="badge badge-warning flex items-center gap-1">
                          <DollarSign size={10} />
                          ${seminar.price}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white text-lg">{seminar.title}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="action-btn">
                        <MoreVertical size={18} className="text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => handleEdit(seminar)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {seminar.meeting_link && (
                        <DropdownMenuItem 
                          onClick={() => window.open(seminar.meeting_link, '_blank')}
                          className="text-zinc-300 focus:text-white focus:bg-zinc-800"
                        >
                          <ExternalLink size={14} className="mr-2" />
                          Open Meeting
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={() => handleDelete(seminar.seminar_id)}
                        className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="text-sm text-violet-400 mb-2">{seminar.topic}</p>
                
                {seminar.description && (
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{seminar.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-zinc-500 text-sm">
                    <Calendar size={14} />
                    <span>{seminar.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 text-sm">
                    <Clock size={14} />
                    <span>{seminar.time} ({seminar.duration} min)</span>
                  </div>
                  {seminar.organizer_name && (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                      <Users size={14} />
                      <span>{seminar.organizer_name}</span>
                    </div>
                  )}
                </div>

                {seminar.is_recurring && (
                  <div className="text-xs text-amber-400 mb-3">
                    🔄 Recurring: {seminar.recurrence_pattern}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className="text-sm text-zinc-400">
                    {seminar.registered_count || 0} registered
                  </span>
                  {seminar.max_participants && (
                    <span className="text-xs text-zinc-500">
                      / {seminar.max_participants} max
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeminar ? "Edit Seminar" : "Create Seminar"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="e.g., Marriage Preparation Class"
                  required
                  data-testid="seminar-title-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Topic</label>
                <Input
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="e.g., Christian Family Values"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={3}
                  placeholder="What will participants learn..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <Input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Participants</label>
                  <Input
                    type="number"
                    value={formData.max_participants || ""}
                    onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Organizer</label>
                <Select 
                  value={formData.organizer_id} 
                  onValueChange={(value) => {
                    const leader = leaders.find(l => l.leader_id === value);
                    setFormData({ 
                      ...formData, 
                      organizer_id: value,
                      organizer_name: leader?.name || ""
                    });
                  }}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select organizer" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {leaders.map(leader => (
                      <SelectItem key={leader.leader_id} value={leader.leader_id}>{leader.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="form-group">
                <label className="form-label">Google Meet Link</label>
                <Input
                  value={formData.meeting_link}
                  onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="https://meet.google.com/..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg">
                <div>
                  <p className="text-white font-medium">Recurring Event</p>
                  <p className="text-sm text-zinc-500">Repeat this seminar on a schedule</p>
                </div>
                <Switch
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                />
              </div>

              {formData.is_recurring && (
                <div className="form-group">
                  <label className="form-label">Recurrence Pattern</label>
                  <Select value={formData.recurrence_pattern} onValueChange={(value) => setFormData({ ...formData, recurrence_pattern: value })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue placeholder="Select pattern" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg">
                <div>
                  <p className="text-white font-medium">Paid Event</p>
                  <p className="text-sm text-zinc-500">Charge participants for this seminar</p>
                </div>
                <Switch
                  checked={formData.is_paid}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_paid: checked })}
                />
              </div>

              {formData.is_paid && (
                <div className="form-group">
                  <label className="form-label">Price ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Status</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-seminar-btn">
                {editingSeminar ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
