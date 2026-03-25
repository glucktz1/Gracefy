import { useEffect, useState } from "react";
import axios from "axios";
import { Radio, Plus, Edit2, Trash2, MoreVertical, Users, Calendar, Clock } from "lucide-react";
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export default function AudioRoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    host_id: "",
    host_name: "",
    scheduled_date: "",
    scheduled_time: "",
    status: "scheduled"
  });

  const fetchData = async () => {
    try {
      const [roomsRes, leadersRes] = await Promise.all([
        axios.get(`${API}/audiorooms`, { withCredentials: true }),
        axios.get(`${API}/leaders`, { withCredentials: true })
      ]);
      setRooms(roomsRes.data.rooms);
      setLeaders(leadersRes.data.leaders);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load audio rooms");
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
      if (editingRoom) {
        await axios.put(`${API}/audiorooms/${editingRoom.room_id}`, formData, { withCredentials: true });
        toast.success("Audio room updated successfully");
      } else {
        await axios.post(`${API}/audiorooms`, formData, { withCredentials: true });
        toast.success("Audio room created successfully");
      }
      setIsModalOpen(false);
      setEditingRoom(null);
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
      host_id: "",
      host_name: "",
      scheduled_date: "",
      scheduled_time: "",
      status: "scheduled"
    });
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      title: room.title,
      description: room.description || "",
      host_id: room.host_id || "",
      host_name: room.host_name || "",
      scheduled_date: room.scheduled_date || "",
      scheduled_time: room.scheduled_time || "",
      status: room.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm("Are you sure you want to delete this audio room?")) return;
    try {
      await axios.delete(`${API}/audiorooms/${roomId}`, { withCredentials: true });
      toast.success("Audio room deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete audio room");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      scheduled: "badge-warning",
      live: "badge-success",
      ended: "badge-info"
    };
    const labels = {
      scheduled: "Upcoming",
      live: "🔴 LIVE",
      ended: "Ended"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{labels[status] || status}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="audiorooms-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Audio Rooms</h1>
          <p className="page-subtitle">Manage community audio discussions (like Clubhouse/Twitter Spaces)</p>
        </div>
        <Button
          onClick={() => {
            setEditingRoom(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-room-btn"
        >
          <Plus size={18} className="mr-2" />
          Create Audio Room
        </Button>
      </div>

      {/* Audio Rooms Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="empty-state">
          <Radio className="empty-state-icon" />
          <p className="empty-state-title">No audio rooms yet</p>
          <p className="empty-state-text">Create your first audio room for community discussions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <Card 
              key={room.room_id}
              className={`bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300 ${
                room.status === "live" ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : ""
              }`}
              data-testid={`room-card-${room.room_id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      room.status === "live" ? "bg-emerald-600/20" : "bg-violet-600/20"
                    }`}>
                      <Radio size={24} className={room.status === "live" ? "text-emerald-400" : "text-violet-400"} />
                    </div>
                    {getStatusBadge(room.status)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="action-btn">
                        <MoreVertical size={18} className="text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => handleEdit(room)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(room.room_id)}
                        className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-semibold text-white text-lg mb-2">{room.title}</h3>
                
                {room.description && (
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{room.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  {room.host_name && (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                      <Users size={14} />
                      <span>Host: {room.host_name}</span>
                    </div>
                  )}
                  {room.scheduled_date && (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                      <Calendar size={14} />
                      <span>{room.scheduled_date}</span>
                    </div>
                  )}
                  {room.scheduled_time && (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                      <Clock size={14} />
                      <span>{room.scheduled_time}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Users size={14} />
                    <span className="text-sm">{room.participants_count || 0} participants</span>
                  </div>
                  {room.status === "live" && (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-full text-xs">
                      Join Now
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Edit Audio Room" : "Create Audio Room"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Room Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="e.g., Weekly Bible Discussion"
                  required
                  data-testid="room-title-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={3}
                  placeholder="What will be discussed..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Host</label>
                <Select 
                  value={formData.host_id} 
                  onValueChange={(value) => {
                    const leader = leaders.find(l => l.leader_id === value);
                    setFormData({ 
                      ...formData, 
                      host_id: value,
                      host_name: leader?.name || ""
                    });
                  }}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select host" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {leaders.map(leader => (
                      <SelectItem key={leader.leader_id} value={leader.leader_id}>{leader.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <Input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <Input
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-room-btn">
                {editingRoom ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
