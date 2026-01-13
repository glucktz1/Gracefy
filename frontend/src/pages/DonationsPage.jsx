import { useEffect, useState } from "react";
import axios from "axios";
import { Heart, Plus, Edit2, Trash2, MoreVertical, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

export default function DonationsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    goal_amount: "",
    raised_amount: 0,
    thumbnail: "",
    end_date: "",
    status: "active"
  });

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get(`${API}/donations`, { withCredentials: true });
      setCampaigns(response.data.campaigns);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Failed to load donation campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        goal_amount: parseFloat(formData.goal_amount) || 0,
        raised_amount: parseFloat(formData.raised_amount) || 0
      };

      if (editingCampaign) {
        await axios.put(`${API}/donations/${editingCampaign.campaign_id}`, data, { withCredentials: true });
        toast.success("Campaign updated successfully");
      } else {
        await axios.post(`${API}/donations`, data, { withCredentials: true });
        toast.success("Campaign created successfully");
      }
      setIsModalOpen(false);
      setEditingCampaign(null);
      resetForm();
      fetchCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      goal_amount: "",
      raised_amount: 0,
      thumbnail: "",
      end_date: "",
      status: "active"
    });
  };

  const handleEdit = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      title: campaign.title,
      description: campaign.description,
      goal_amount: campaign.goal_amount?.toString() || "",
      raised_amount: campaign.raised_amount || 0,
      thumbnail: campaign.thumbnail || "",
      end_date: campaign.end_date || "",
      status: campaign.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (campaignId) => {
    if (!window.confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await axios.delete(`${API}/donations/${campaignId}`, { withCredentials: true });
      toast.success("Campaign deleted successfully");
      fetchCampaigns();
    } catch (error) {
      toast.error("Failed to delete campaign");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "badge-success",
      completed: "badge-violet",
      paused: "badge-warning"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  const getProgress = (raised, goal) => {
    if (!goal) return 0;
    return Math.min((raised / goal) * 100, 100);
  };

  return (
    <div className="page-container animate-fade-in" data-testid="donations-page">
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Donation Campaigns</h1>
          <p className="page-subtitle">Manage fundraising campaigns for the community</p>
        </div>
        <Button
          onClick={() => {
            setEditingCampaign(null);
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-violet-600 hover:bg-violet-700 rounded-full"
          data-testid="add-campaign-btn"
        >
          <Plus size={18} className="mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-state">
          <Heart className="empty-state-icon" />
          <p className="empty-state-title">No campaigns yet</p>
          <p className="empty-state-text">Create your first donation campaign</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Card 
              key={campaign.campaign_id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300 overflow-hidden"
              data-testid={`campaign-card-${campaign.campaign_id}`}
            >
              <div className="h-40 bg-gradient-to-br from-pink-900/30 to-zinc-900 relative">
                {campaign.thumbnail ? (
                  <img src={campaign.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Heart size={48} className="text-pink-500/30" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  {getStatusBadge(campaign.status)}
                </div>
              </div>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white text-lg line-clamp-1">{campaign.title}</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="action-btn">
                        <MoreVertical size={18} className="text-zinc-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                      <DropdownMenuItem onClick={() => handleEdit(campaign)} className="text-zinc-300 focus:text-white focus:bg-zinc-800">
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(campaign.campaign_id)}
                        className="text-red-400 focus:text-red-300 focus:bg-zinc-800"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="text-sm text-zinc-400 line-clamp-2 mb-4">{campaign.description}</p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-emerald-400 font-semibold">
                      ${(campaign.raised_amount || 0).toLocaleString()}
                    </span>
                    <span className="text-zinc-500">
                      of ${(campaign.goal_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={getProgress(campaign.raised_amount, campaign.goal_amount)} 
                    className="h-2 bg-zinc-800"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {getProgress(campaign.raised_amount, campaign.goal_amount).toFixed(0)}% funded
                  </p>
                </div>

                {/* Recent Donations */}
                {campaign.recent_donations && campaign.recent_donations.length > 0 && (
                  <div className="pt-3 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-2">Recent contributions:</p>
                    <div className="space-y-1">
                      {campaign.recent_donations.slice(0, 3).map((donation, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Anonymous</span>
                          <span className="text-emerald-400">${donation.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {campaign.end_date && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <p className="text-xs text-zinc-500">
                      Ends: {new Date(campaign.end_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="form-group">
                <label className="form-label">Campaign Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="e.g., Church Building Fund"
                  required
                  data-testid="campaign-title-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white resize-none"
                  rows={4}
                  placeholder="Describe the purpose of this campaign..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Goal Amount ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.goal_amount}
                    onChange={(e) => setFormData({ ...formData, goal_amount: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="10000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Raised Amount ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.raised_amount}
                    onChange={(e) => setFormData({ ...formData, raised_amount: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Thumbnail URL</label>
                <Input
                  value={formData.thumbnail}
                  onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-violet-600 hover:bg-violet-700" data-testid="save-campaign-btn">
                {editingCampaign ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
