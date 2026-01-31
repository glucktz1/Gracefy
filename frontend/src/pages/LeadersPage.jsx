import { useEffect, useState } from "react";
import axios from "axios";
import { UserCheck, Plus, Edit2, Trash2, MoreVertical, CheckCircle, XCircle, Image, X, Upload } from "lucide-react";
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

// Helper function to get proper image URL
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  if (imageUrl.startsWith('data:')) return imageUrl;
  if (imageUrl.startsWith('/api/files/') && !imageUrl.endsWith('/stream')) {
    return `${BACKEND_URL}${imageUrl}/stream`;
  }
  if (imageUrl.startsWith('/')) return `${BACKEND_URL}${imageUrl}`;
  return imageUrl;
};

export default function LeadersPage() {
  const [leaders, setLeaders] = useState([]);
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    title: "priest",
    church_id: "",
    church_name: "",
    bio: "",
    photo: "",
    is_verified: false,
    status: "pending"
  });

  const fetchData = async () => {
    try {
      const [leadersRes, churchesRes] = await Promise.all([
        axios.get(`${API}/leaders`, { withCredentials: true }),
        axios.get(`${API}/churches`, { withCredentials: true })
      ]);
      // Ensure we always set arrays, never error objects
      const leadersData = leadersRes.data?.leaders;
      const churchesData = churchesRes.data?.churches;
      setLeaders(Array.isArray(leadersData) ? leadersData : []);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load leaders");
      setLeaders([]);
      setChurches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await axios.post(`${API}/upload`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" }
      });
      return response.data.url;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload photo");
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    
    try {
      // Upload photo if file selected
      let photoUrl = formData.photo;
      if (photoFile) {
        photoUrl = await handleFileUpload(photoFile);
        if (!photoUrl) {
          setIsUploading(false);
          return;
        }
      }
      
      const payload = { ...formData, photo: photoUrl };

      if (editingLeader) {
        await axios.put(`${API}/leaders/${editingLeader.leader_id}`, payload, { withCredentials: true });
        toast.success("Leader updated successfully");
      } else {
        await axios.post(`${API}/leaders`, payload, { withCredentials: true });
        toast.success("Leader created successfully");
      }
      setIsModalOpen(false);
      setEditingLeader(null);
      resetForm();
      fetchData();
    } catch (error) {
      // Handle FastAPI validation errors which come as array of {type, loc, msg, input, url}
      const errorDetail = error.response?.data?.detail;
      let errorMessage = "Operation failed";
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMessage = errorDetail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
      } else if (errorDetail?.msg) {
        errorMessage = errorDetail.msg;
      }
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      title: "priest",
      church_id: "",
      church_name: "",
      bio: "",
      photo: "",
      is_verified: false,
      status: "pending"
    });
    setPhotoFile(null);
  };

  const handleEdit = (leader) => {
    setEditingLeader(leader);
    setFormData({
      name: leader.name,
      title: leader.title,
      church_id: leader.church_id || "",
      church_name: leader.church_name || "",
      bio: leader.bio || "",
      photo: leader.photo || "",
      is_verified: leader.is_verified,
      status: leader.status
    });
    setPhotoFile(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (leaderId) => {
    if (!window.confirm("Are you sure you want to delete this leader?")) return;
    try {
      await axios.delete(`${API}/leaders/${leaderId}`, { withCredentials: true });
      toast.success("Leader deleted successfully");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete leader");
    }
  };

  const handleVerify = async (leaderId, verified) => {
    try {
      await axios.put(`${API}/leaders/${leaderId}`, { 
        is_verified: verified,
        status: verified ? "approved" : "pending"
      }, { withCredentials: true });
      toast.success(verified ? "Leader verified" : "Verification removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to update verification status");
    }
  };

  const getTitleBadge = (title) => {
    const styles = {
      pastor: "badge-violet",
      priest: "badge-info",
      catechist: "badge-warning",
      bishop: "badge-success"
    };
    return <span className={`badge ${styles[title] || "badge-info"}`}>{title}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="leaders-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Religious Leaders</h1>
          <p className="page-subtitle">Manage pastors, priests, catechists, and bishops</p>
        </div>
        <Button
          onClick={() => {
            setEditingLeader(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-leader-btn"
        >
          <Plus size={18} className="mr-2" />
          Add Leader
        </Button>
      </div>

      {/* Leaders Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : leaders.length === 0 ? (
        <div className="empty-state">
          <UserCheck className="empty-state-icon" />
          <p className="empty-state-title">No religious leaders yet</p>
          <p className="empty-state-text">Add your first leader</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {leaders.map((leader) => {
            // Safety check - ensure leader is an object with expected properties
            if (!leader || typeof leader !== 'object' || !leader.leader_id) {
              console.error('Invalid leader object:', leader);
              return null;
            }
            return (
            <Card 
              key={leader.leader_id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300"
              data-testid={`leader-card-${leader.leader_id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {leader.photo ? (
                      <img src={getImageUrl(leader.photo)} alt="" className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xl font-bold">
                        {leader.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{leader.name}</h3>
                        {leader.is_verified && (
                          <CheckCircle size={16} className="text-emerald-400" />
                        )}
                      </div>
                      {getTitleBadge(leader.title)}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="action-btn">
                        <MoreVertical size={18} className="text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => handleEdit(leader)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleVerify(leader.leader_id, !leader.is_verified)}
                        className="text-zinc-300 focus:text-white focus:bg-zinc-800"
                      >
                        {leader.is_verified ? (
                          <>
                            <XCircle size={14} className="mr-2" />
                            Remove Verification
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} className="mr-2" />
                            Verify Leader
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(leader.leader_id)}
                        className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {leader.church_name && (
                  <p className="text-sm text-zinc-500 mb-2">{leader.church_name}</p>
                )}

                {leader.bio && (
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{leader.bio}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className={`badge ${leader.status === "approved" ? "badge-success" : leader.status === "pending" ? "badge-warning" : "badge-error"}`}>
                    {leader.status}
                  </span>
                  <span className="text-xs text-zinc-500">{leader.followers || 0} followers</span>
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
            <DialogTitle>{editingLeader ? "Edit Leader" : "Add New Leader"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  required
                  data-testid="leader-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <Select value={formData.title} onValueChange={(value) => setFormData({ ...formData, title: value })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="pastor">Pastor</SelectItem>
                      <SelectItem value="priest">Priest</SelectItem>
                      <SelectItem value="catechist">Catechist</SelectItem>
                      <SelectItem value="bishop">Bishop</SelectItem>
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
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
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
                    <SelectValue placeholder="Select a church" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    <SelectItem value="">No church</SelectItem>
                    {churches && churches.map(church => (
                      <SelectItem key={church.church_id} value={church.church_id || ''}>
                        {church.name || 'Unnamed Church'}
                      </SelectItem>
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
                  placeholder="Brief biography..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Photo</label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center hover:border-violet-500 transition-colors">
                      {photoFile ? (
                        <div className="flex items-center justify-center gap-2 text-zinc-300">
                          <Image size={20} />
                          <span className="text-sm truncate">{photoFile.name}</span>
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPhotoFile(null); }}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : formData.photo ? (
                        <div className="flex items-center justify-center gap-2 text-zinc-300">
                          <CheckCircle size={16} className="text-green-500" />
                          <span className="text-sm">Photo set</span>
                        </div>
                      ) : (
                        <div className="text-zinc-500">
                          <Upload size={24} className="mx-auto mb-1" />
                          <p className="text-xs">Click to upload photo</p>
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setPhotoFile(e.target.files[0]);
                          setFormData({ ...formData, photo: "" }); // Clear URL if uploading file
                        }
                      }}
                    />
                  </label>
                  {(photoFile || formData.photo) && (
                    <div className="w-20 h-20 rounded-lg bg-zinc-800 overflow-hidden">
                      <img 
                        src={photoFile ? URL.createObjectURL(photoFile) : getImageUrl(formData.photo)} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={isUploading} data-testid="save-leader-btn">
                {isUploading ? "Saving..." : editingLeader ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
