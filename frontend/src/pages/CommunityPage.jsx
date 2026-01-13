import { useEffect, useState } from "react";
import axios from "axios";
import { MessageSquare, Check, X, Eye, Flag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CommunityPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`${API}/community/posts`, {
        params: { status: activeTab === "all" ? undefined : activeTab },
        withCredentials: true
      });
      setPosts(response.data.posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPosts();
  }, [activeTab]);

  const handleApprove = async (postId) => {
    try {
      await axios.put(`${API}/community/posts/${postId}`, { status: "approved" }, { withCredentials: true });
      toast.success("Post approved");
      fetchPosts();
    } catch (error) {
      toast.error("Failed to approve post");
    }
  };

  const handleReject = async (postId) => {
    try {
      await axios.put(`${API}/community/posts/${postId}`, { status: "rejected" }, { withCredentials: true });
      toast.success("Post rejected");
      fetchPosts();
    } catch (error) {
      toast.error("Failed to reject post");
    }
  };

  const handleFlag = async (postId) => {
    try {
      await axios.put(`${API}/community/posts/${postId}`, { status: "flagged" }, { withCredentials: true });
      toast.success("Post flagged for review");
      fetchPosts();
    } catch (error) {
      toast.error("Failed to flag post");
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await axios.delete(`${API}/community/posts/${postId}`, { withCredentials: true });
      toast.success("Post deleted");
      fetchPosts();
    } catch (error) {
      toast.error("Failed to delete post");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: "badge-success",
      pending: "badge-warning",
      rejected: "badge-error",
      flagged: "badge-error"
    };
    return <span className={`badge ${styles[status] || "badge-info"}`}>{status}</span>;
  };

  return (
    <div className="page-container animate-fade-in" data-testid="community-page">
      <div className="page-header">
        <h1 className="page-title">Community Moderation</h1>
        <p className="page-subtitle">Review and moderate community posts</p>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {["pending", "approved", "flagged", "rejected", "all"].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <MessageSquare className="empty-state-icon" />
          <p className="empty-state-title">No posts found</p>
          <p className="empty-state-text">
            {activeTab === "pending" ? "No posts pending review" : `No ${activeTab} posts`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card 
              key={post.post_id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all"
              data-testid={`post-card-${post.post_id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* User Avatar */}
                  {post.user_photo ? (
                    <img src={post.user_photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 font-semibold">
                      {post.user_name?.charAt(0) || "U"}
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{post.user_name}</span>
                      {getStatusBadge(post.status)}
                    </div>
                    <p className="text-sm text-zinc-500 mb-2">
                      {new Date(post.created_at).toLocaleString()}
                    </p>
                    <p className="text-zinc-300 whitespace-pre-wrap">{post.content}</p>

                    {/* Media */}
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {post.media_urls.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500">
                      <span>{post.likes || 0} likes</span>
                      <span>{post.comments_count || 0} comments</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {post.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(post.post_id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                          data-testid={`approve-post-${post.post_id}`}
                        >
                          <Check size={16} className="mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(post.post_id)}
                          className="border-red-600 text-red-400 hover:bg-red-600/20"
                          data-testid={`reject-post-${post.post_id}`}
                        >
                          <X size={16} className="mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {post.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFlag(post.post_id)}
                        className="border-amber-600 text-amber-400 hover:bg-amber-600/20"
                      >
                        <Flag size={16} className="mr-1" />
                        Flag
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(post.post_id)}
                      className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    >
                      <Trash2 size={16} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
