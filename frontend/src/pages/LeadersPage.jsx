import { useEffect, useState } from "react";
import axios from "axios";
import { UserCheck, Plus, Edit2, Trash2, MoreVertical, CheckCircle, XCircle } from "lucide-react";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LeadersPage() {
  const [leaders, setLeaders] = useState([]);
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    title: "priest",
    church_id: "",
    church_name: "",
    bio: "",
    is_verified: false,
    status: "pending"
  });

  // Fetch leaders and churches
  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadersRes, churchesRes] = await Promise.all([
        axios.get(`${API}/leaders`),
        axios.get(`${API}/churches`)
      ]);
      setLeaders(Array.isArray(leadersRes.data?.leaders) ? leadersRes.data.leaders : []);
      setChurches(Array.isArray(churchesRes.data?.churches) ? churchesRes.data.churches : []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      title: "priest",
      church_id: "",
      church_name: "",
      bio: "",
      is_verified: false,
      status: "pending"
    });
    setEditingLeader(null);
  };

  // Open modal for editing
  const handleEdit = (leader) => {
    setEditingLeader(leader);
    setFormData({
      name: leader.name || "",
      title: leader.title || "priest",
      church_id: leader.church_id || "",
      church_name: leader.church_name || "",
      bio: leader.bio || "",
      is_verified: leader.is_verified || false,
      status: leader.status || "pending"
    });
    setIsModalOpen(true);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      if (editingLeader) {
        await axios.put(`${API}/leaders/${editingLeader.leader_id}`, formData);
        toast.success("Leader updated");
      } else {
        await axios.post(`${API}/leaders`, formData);
        toast.success("Leader created");
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Operation failed");
    }
  };

  // Delete leader
  const handleDelete = async (leaderId) => {
    if (!window.confirm("Delete this leader?")) return;
    try {
      await axios.delete(`${API}/leaders/${leaderId}`);
      toast.success("Leader deleted");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  // Toggle verification
  const handleToggleVerify = async (leader) => {
    try {
      await axios.put(`${API}/leaders/${leader.leader_id}`, {
        is_verified: !leader.is_verified
      });
      toast.success(leader.is_verified ? "Unverified" : "Verified");
      fetchData();
    } catch (err) {
      toast.error("Failed to update");
    }
  };

  // Get title badge style
  const getTitleStyle = (title) => {
    const styles = {
      pastor: "bg-violet-500/20 text-violet-400",
      priest: "bg-blue-500/20 text-blue-400",
      catechist: "bg-amber-500/20 text-amber-400",
      bishop: "bg-emerald-500/20 text-emerald-400"
    };
    return styles[title] || "bg-zinc-500/20 text-zinc-400";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCheck className="text-violet-500" />
            Religious Leaders
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Manage priests, pastors, and catechists</p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-violet-600 hover:bg-violet-700"
          data-testid="add-leader-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Leader
        </Button>
      </div>

      {/* Leaders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {leaders.map((leader) => (
          <Card 
            key={leader.leader_id}
            className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors"
            data-testid={`leader-card-${leader.leader_id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-lg font-bold">
                    {(leader.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{leader.name || "Unknown"}</h3>
                      {leader.is_verified && (
                        <CheckCircle size={14} className="text-blue-400" />
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getTitleStyle(leader.title)}`}>
                      {leader.title || "unknown"}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                    <DropdownMenuItem onClick={() => handleEdit(leader)}>
                      <Edit2 size={14} className="mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleVerify(leader)}>
                      {leader.is_verified ? (
                        <><XCircle size={14} className="mr-2" /> Unverify</>
                      ) : (
                        <><CheckCircle size={14} className="mr-2" /> Verify</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(leader.leader_id)}
                      className="text-red-400"
                    >
                      <Trash2 size={14} className="mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {leader.church_name && (
                <p className="text-sm text-zinc-500 mb-2">{leader.church_name}</p>
              )}

              {leader.bio && (
                <p className="text-sm text-zinc-400 line-clamp-2">{leader.bio}</p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  leader.status === "approved" ? "bg-green-500/20 text-green-400" :
                  leader.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                  "bg-red-500/20 text-red-400"
                }`}>
                  {leader.status || "pending"}
                </span>
                <span className="text-xs text-zinc-500">{leader.followers || 0} followers</span>
              </div>
            </CardContent>
          </Card>
        ))}

        {leaders.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            <UserCheck size={48} className="mx-auto mb-4 opacity-50" />
            <p>No leaders found</p>
            <p className="text-sm">Click Add Leader to create one</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLeader ? "Edit Leader" : "Add New Leader"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Enter name"
                data-testid="leader-name-input"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Title</label>
              <Select
                value={formData.title}
                onValueChange={(val) => setFormData({ ...formData, title: val })}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="priest">Priest</SelectItem>
                  <SelectItem value="pastor">Pastor</SelectItem>
                  <SelectItem value="catechist">Catechist</SelectItem>
                  <SelectItem value="bishop">Bishop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Church/Parish</label>
              <Select
                value={formData.church_id || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setFormData({ ...formData, church_id: "", church_name: "" });
                  } else {
                    const church = churches.find(c => c.church_id === val);
                    setFormData({ 
                      ...formData, 
                      church_id: val, 
                      church_name: church?.name || "" 
                    });
                  }
                }}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Select church" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">No church</SelectItem>
                  {churches.map((church) => (
                    <SelectItem key={church.church_id} value={church.church_id}>
                      {church.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Bio</label>
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="bg-zinc-950 border-zinc-800 resize-none"
                rows={3}
                placeholder="Brief biography..."
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Status</label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                className="border-zinc-700"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-violet-600 hover:bg-violet-700"
                data-testid="save-leader-btn"
              >
                {editingLeader ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
