import { useEffect, useState } from "react";
import axios from "axios";
import { CheckCircle, Church, UserCheck, MessageSquare, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState({ churches: [], leaders: [], posts: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchApprovals = async () => {
    try {
      const response = await axios.get(`${API}/approvals`, { withCredentials: true });
      setApprovals(response.data);
    } catch (error) {
      console.error("Error fetching approvals:", error);
      toast.error("Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleApprove = async (type, id) => {
    try {
      await axios.post(`${API}/approvals/approve`, { type, id }, { withCredentials: true });
      toast.success("Approved successfully");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (type, id) => {
    try {
      await axios.post(`${API}/approvals/reject`, { type, id }, { withCredentials: true });
      toast.success("Rejected");
      fetchApprovals();
    } catch (error) {
      toast.error("Failed to reject");
    }
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" data-testid="approvals-page">
      <div className="page-header">
        <h1 className="page-title">Pending Approvals</h1>
        <p className="page-subtitle">
          {approvals.total} items waiting for review
        </p>
      </div>

      {approvals.total === 0 ? (
        <div className="empty-state">
          <CheckCircle className="empty-state-icon text-emerald-500" />
          <p className="empty-state-title">All caught up!</p>
          <p className="empty-state-text">No pending approvals at the moment</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Churches */}
          {approvals.churches.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Church size={20} className="text-amber-400" />
                  Churches ({approvals.churches.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvals.churches.map((church) => (
                    <div 
                      key={church.church_id}
                      className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg"
                      data-testid={`approval-church-${church.church_id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-amber-600/20 flex items-center justify-center">
                          <Church size={24} className="text-amber-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{church.name}</h4>
                          <p className="text-sm text-zinc-500">{church.location}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove("church", church.church_id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check size={16} className="mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject("church", church.church_id)}
                          className="border-red-600 text-red-400 hover:bg-red-600/20"
                        >
                          <X size={16} className="mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Religious Leaders */}
          {approvals.leaders.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <UserCheck size={20} className="text-violet-400" />
                  Religious Leaders ({approvals.leaders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvals.leaders.map((leader) => (
                    <div 
                      key={leader.leader_id}
                      className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg"
                      data-testid={`approval-leader-${leader.leader_id}`}
                    >
                      <div className="flex items-center gap-3">
                        {leader.photo ? (
                          <img src={leader.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-semibold">
                            {leader.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-white">{leader.name}</h4>
                          <p className="text-sm text-zinc-500">{leader.title} • {leader.church_name || "No church"}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove("leader", leader.leader_id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check size={16} className="mr-1" />
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject("leader", leader.leader_id)}
                          className="border-red-600 text-red-400 hover:bg-red-600/20"
                        >
                          <X size={16} className="mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Community Posts */}
          {approvals.posts.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare size={20} className="text-emerald-400" />
                  Community Posts ({approvals.posts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvals.posts.map((post) => (
                    <div 
                      key={post.post_id}
                      className="flex items-start justify-between p-4 bg-zinc-800/50 rounded-lg"
                      data-testid={`approval-post-${post.post_id}`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        {post.user_photo ? (
                          <img src={post.user_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-semibold">
                            {post.user_name?.charAt(0) || "U"}
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-semibold text-white">{post.user_name}</h4>
                          <p className="text-sm text-zinc-400 line-clamp-2 mt-1">{post.content}</p>
                          <p className="text-xs text-zinc-600 mt-2">
                            {new Date(post.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleApprove("post", post.post_id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Check size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject("post", post.post_id)}
                          className="border-red-600 text-red-400 hover:bg-red-600/20"
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
