import { useEffect, useState } from "react";
import axios from "axios";
import { Mic2, Plus, Edit2, Trash2, MoreVertical, Users } from "lucide-react";
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

export default function SingersPage() {
  const [singers, setSingers] = useState([]);
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "solo",
    church_id: "",
    church_name: "",
    bio: "",
    photo: "",
    status: "active"
  });

  const fetchData = async () => {
    try {
      const [singersRes, churchesRes] = await Promise.all([
        axios.get(`${API}/singers`, { withCredentials: true }),
        axios.get(`${API}/churches`, { withCredentials: true })
      ]);
      setSingers(singersRes.data.singers);
      setChurches(churchesRes.data.churches);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load singers");
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
      if (editingSinger) {
        await axios.put(`${API}/singers/${editingSinger.singer_id}`, formData, { withCredentials: true });
        toast.success("Singer updated successfully");
      } else {
        await axios.post(`${API}/singers`, formData, { withCredentials: true });
        toast.success("Singer created successfully");
      }
      setIsModalOpen(false);
      setEditingSinger(null);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "solo",
      church_id: "",
      church_name: "",
      bio: "",
      photo: "",
      status: "active"
    });
  };

  const handleEdit = (singer) => {
    setEditingSinger(singer);
    setFormData({
      name: singer.name,
      type: singer.type,
      church_id: singer.church_id || "",
      church_name: singer.church_name || "",
      bio: singer.bio || "",
      photo: singer.photo || "",
      status: singer.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (singerId) => {
    if (!window.confirm("Are you sure you want to delete this singer/choir?")) return;
    try {
      await axios.delete(`${API}/singers/${singerId}`, { withCredentials: true });
      toast.success("Deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const getTypeBadge = (type) => {
    const styles = {
      solo: "badge-violet",
      choir: "badge-success",
      band: "badge-warning"
    };
    return <span className={`badge ${styles[type] || "badge-info"}`}>{type}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="singers-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Singers & Choirs</h1>
          <p className="page-subtitle">Manage singers, choirs, and bands</p>
        </div>
        <Button
          onClick={() => {
            setEditingSinger(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-singer-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Singer/Choir
        </Button>
      </div>

      {/* Singers Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : singers.length === 0 ? (
        <div className="empty-state">
          <Mic2 className="empty-state-icon" />
          <p className="empty-state-title">No singers or choirs yet</p>
          <p className="empty-state-text">Add your first singer or choir</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {singers.map((singer) => (
            <Card 
              key={singer.singer_id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300"
              data-testid={`singer-card-${singer.singer_id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {singer.photo ? (
                      <img src={singer.photo} alt="" className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
                        {singer.type === "choir" ? (
                          <Users size={24} className="text-white" />
                        ) : (
                          <Mic2 size={24} className="text-white" />
                        )}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white">{singer.name}</h3>
                      {getTypeBadge(singer.type)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="action-btn">
                        <MoreVertical size={18} className="text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => handleEdit(singer)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(singer.singer_id)}
                        className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {singer.church_name && (
                  <p className="text-sm text-zinc-500 mb-2">{singer.church_name}</p>
                )}

                {singer.bio && (
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{singer.bio}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className={`badge ${singer.status === "active" ? "badge-success" : "badge-error"}`}>
                    {singer.status}
                  </span>
                  <span className="text-xs text-zinc-500">{singer.followers || 0} followers</span>
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
            <DialogTitle>{editingSinger ? "Edit Singer/Choir" : "Add Singer/Choir"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="singer-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="solo">Solo Artist</SelectItem>
                      <SelectItem value="choir">Choir</SelectItem>
                      <SelectItem value="band">Band</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Church/Parish</label>
                <Select 
                  value={formData.church_id} 
                  onValueChange={(value) => {
                    const church = churches.find(c => c.church_id === value);
                    setFormData({ 
                      ...formData, 
                      church_id: value,
                      church_name: church?.name || ""
                    });
                  }}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue placeholder="Select a church (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {churches.map(church => (
                      <SelectItem key={church.church_id} value={church.church_id}>{church.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="form-group">
                <label className="form-label">Bio</label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={4}
                  placeholder="Brief description..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Photo URL</label>
                <Input
                  value={formData.photo}
                  onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-singer-btn">
                {editingSinger ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
