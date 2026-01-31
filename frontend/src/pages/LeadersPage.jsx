import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { UserCheck, Plus, Edit2, Trash2, MoreVertical, CheckCircle, XCircle, Upload, X } from "lucide-react";
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

// Helper to build image URL
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (url.startsWith("data:")) return url;
  if (url.startsWith("/api/files/") && !url.endsWith("/stream")) {
    return `${BACKEND_URL}${url}/stream`;
  }
  if (url.startsWith("/")) return `${BACKEND_URL}${url}`;
  return url;
};

export default function LeadersPage() {
  const [leaders, setLeaders] = useState([]);
  const [churches, setChurches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState(null);
  
  // Form state
  const [name, setName] = useState("");
  const [title, setTitle] = useState("priest");
  const [churchId, setChurchId] = useState("");
  const [churchName, setChurchName] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("pending");
  const [photoUrl, setPhotoUrl] = useState("");
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadersRes, churchesRes] = await Promise.all([
        axios.get(`${API}/leaders`),
        axios.get(`${API}/churches`)
      ]);
      const leadersData = leadersRes.data?.leaders;
      const churchesData = churchesRes.data?.churches;
      setLeaders(Array.isArray(leadersData) ? leadersData : []);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
    } catch (err) {
      console.error("Fetch error:", err);
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
    setName("");
    setTitle("priest");
    setChurchId("");
    setChurchName("");
    setBio("");
    setStatus("pending");
    setPhotoUrl("");
    setSelectedFile(null);
    setPreviewUrl("");
    setEditingLeader(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear selected file
  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload file
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axios.post(`${API}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return res.data.url;
  };

  // Open edit modal
  const handleEdit = (leader) => {
    setEditingLeader(leader);
    setName(leader.name || "");
    setTitle(leader.title || "priest");
    setChurchId(leader.church_id || "");
    setChurchName(leader.church_name || "");
    setBio(leader.bio || "");
    setStatus(leader.status || "pending");
    setPhotoUrl(leader.photo || "");
    setSelectedFile(null);
    setPreviewUrl("");
    setIsModalOpen(true);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl;
      
      // Upload file if selected
      if (selectedFile) {
        try {
          finalPhotoUrl = await uploadFile(selectedFile);
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          toast.error("Failed to upload photo");
          setSaving(false);
          return;
        }
      }

      const payload = {
        name: name.trim(),
        title,
        church_id: churchId,
        church_name: churchName,
        bio: bio.trim(),
        status,
        photo: finalPhotoUrl
      };

      if (editingLeader) {
        await axios.put(`${API}/leaders/${editingLeader.leader_id}`, payload);
        toast.success("Leader updated");
      } else {
        await axios.post(`${API}/leaders`, payload);
        toast.success("Leader created");
      }
      
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Submit error:", err);
      const msg = err.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Operation failed");
    } finally {
      setSaving(false);
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

  // Get badge style
  const getTitleStyle = (t) => {
    const styles = {
      pastor: "bg-violet-500/20 text-violet-400",
      priest: "bg-blue-500/20 text-blue-400",
      catechist: "bg-amber-500/20 text-amber-400",
      bishop: "bg-emerald-500/20 text-emerald-400"
    };
    return styles[t] || "bg-zinc-500/20 text-zinc-400";
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
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {leader.photo ? (
                    <img 
                      src={getImageUrl(leader.photo)} 
                      alt="" 
                      className="w-12 h-12 rounded-full object-cover bg-zinc-800"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-lg font-bold">
                      {(leader.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{leader.name || "Unknown"}</h3>
                      {leader.is_verified && <CheckCircle size={14} className="text-blue-400" />}
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
                    <DropdownMenuItem onClick={() => handleDelete(leader.leader_id)} className="text-red-400">
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
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsModalOpen(open); }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLeader ? "Edit Leader" : "Add New Leader"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo Upload */}
            <div>
              <label className="text-sm text-zinc-400 block mb-2">Photo</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {(previewUrl || photoUrl) ? (
                    <div className="relative">
                      <img 
                        src={previewUrl || getImageUrl(photoUrl)} 
                        alt="Preview" 
                        className="w-20 h-20 rounded-lg object-cover bg-zinc-800"
                      />
                      <button
                        type="button"
                        onClick={() => { clearFile(); setPhotoUrl(""); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center cursor-pointer hover:border-violet-500 transition-colors"
                    >
                      <Upload size={20} className="text-zinc-500" />
                      <span className="text-xs text-zinc-500 mt-1">Upload</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="text-xs text-zinc-500">
                  <p>Click to upload photo</p>
                  <p>JPG, PNG up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                placeholder="Enter name"
              />
            </div>

            {/* Title */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Title</label>
              <Select value={title} onValueChange={setTitle}>
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

            {/* Church */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Church/Parish</label>
              <Select
                value={churchId || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setChurchId("");
                    setChurchName("");
                  } else {
                    const church = churches.find(c => c.church_id === val);
                    setChurchId(val);
                    setChurchName(church?.name || "");
                  }
                }}
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Select church" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">No church</SelectItem>
                  {Array.isArray(churches) && churches.map((church) => {
                    if (!church || !church.church_id) return null;
                    return (
                      <SelectItem key={church.church_id} value={church.church_id}>
                        {String(church.name || 'Unknown')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Bio */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Bio</label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="bg-zinc-950 border-zinc-800 resize-none"
                rows={3}
                placeholder="Brief biography..."
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Status</label>
              <Select value={status} onValueChange={setStatus}>
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
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-violet-600 hover:bg-violet-700"
                disabled={saving}
              >
                {saving ? "Saving..." : editingLeader ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
