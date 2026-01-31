import { useEffect, useState, Component } from "react";
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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Error Boundary to catch render errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("LeadersPage Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-red-500 text-lg mb-2">Something went wrong</h2>
          <p className="text-zinc-400 text-sm mb-4">{String(this.state.error?.message || 'Unknown error')}</p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

function LeadersPageContent() {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingLeader) {
        await axios.put(`${API}/leaders/${editingLeader.leader_id}`, formData, { withCredentials: true });
        toast.success("Leader updated successfully");
      } else {
        await axios.post(`${API}/leaders`, formData, { withCredentials: true });
        toast.success("Leader created successfully");
      }
      setIsModalOpen(false);
      setEditingLeader(null);
      resetForm();
      fetchData();
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      let errorMessage = "Operation failed";
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMessage = errorDetail.map(e => String(e.msg || e.message || 'Error')).join(', ');
      } else if (errorDetail?.msg) {
        errorMessage = String(errorDetail.msg);
      }
      toast.error(errorMessage);
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
  };

  const handleEdit = (leader) => {
    setEditingLeader(leader);
    setFormData({
      name: String(leader.name || ''),
      title: String(leader.title || 'priest'),
      church_id: String(leader.church_id || ''),
      church_name: String(leader.church_name || ''),
      bio: String(leader.bio || ''),
      photo: String(leader.photo || ''),
      is_verified: Boolean(leader.is_verified),
      status: String(leader.status || 'pending')
    });
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
    const safeTitle = String(title || 'unknown');
    const styles = {
      pastor: "badge-violet",
      priest: "badge-info",
      catechist: "badge-warning",
      bishop: "badge-success"
    };
    return <span className={`badge ${styles[safeTitle] || "badge-info"}`}>{safeTitle}</span>;
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
            const leaderName = String(leader.name || 'Unknown');
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
                      <img src={getImageUrl(leader.photo)} alt="" className="w-14 h-14 rounded-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xl font-bold">
                        {leaderName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{leaderName}</h3>
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
                  <p className="text-sm text-zinc-500 mb-2">{String(leader.church_name)}</p>
                )}

                {leader.bio && (
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{String(leader.bio)}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                  <span className={`badge ${leader.status === "approved" ? "badge-success" : leader.status === "pending" ? "badge-warning" : "badge-error"}`}>
                    {String(leader.status || 'pending')}
                  </span>
                  <span className="text-xs text-zinc-500">{leader.followers || 0} followers</span>
                </div>
              </CardContent>
            </Card>
          );
          })}
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
                  value={formData.church_id || "none"} 
                  onValueChange={(value) => {
                    if (value === "none") {
                      setFormData({ ...formData, church_id: "", church_name: "" });
                      return;
                    }
                    const church = churches.find(c => c && c.church_id === value);
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
                    <SelectItem value="none">No church</SelectItem>
                    {Array.isArray(churches) && churches.map(church => {
                      // Skip invalid church objects
                      if (!church || typeof church !== 'object' || !church.church_id) {
                        return null;
                      }
                      return (
                        <SelectItem key={church.church_id} value={String(church.church_id)}>
                          {String(church.name || 'Unnamed Church')}
                        </SelectItem>
                      );
                    })}
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
                <label className="form-label">Photo URL</label>
                <Input
                  value={formData.photo}
                  onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="https://example.com/photo.jpg"
                />
                {formData.photo && (
                  <div className="mt-2 w-16 h-16 rounded-lg bg-zinc-800 overflow-hidden">
                    <img 
                      src={getImageUrl(formData.photo)} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-leader-btn">
                {editingLeader ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrap with ErrorBoundary for better error handling
export default function LeadersPageWrapper() {
  return (
    <ErrorBoundary>
      <LeadersPageContent />
    </ErrorBoundary>
  );
}
