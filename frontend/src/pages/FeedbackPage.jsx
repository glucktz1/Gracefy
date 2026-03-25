import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  ThumbsUp, 
  AlertCircle,
  Search,
  Eye,
  Trash2,
  Send,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Mail
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export default function FeedbackPage() {
  // State
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Detail dialog
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responding, setResponding] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Fetch feedback list
  const fetchFeedback = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "15"
      });
      
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await axios.get(`${API}/feedback/admin/list?${params}`);
      if (response.data.success) {
        setFeedback(response.data.feedback);
        setTotalPages(response.data.total_pages);
      }
    } catch (error) {
      console.error("Failed to fetch feedback:", error);
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await axios.get(`${API}/feedback/admin/stats/overview`);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [currentPage, statusFilter, typeFilter, priorityFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchFeedback();
  };

  // View feedback detail
  const viewFeedback = async (id) => {
    try {
      const response = await axios.get(`${API}/feedback/admin/${id}`);
      if (response.data.success) {
        setSelectedFeedback(response.data.feedback);
        setShowDetailDialog(true);
      }
    } catch (error) {
      toast.error("Failed to load feedback details");
    }
  };

  // Update feedback
  const updateFeedback = async (id, updates) => {
    setUpdating(true);
    try {
      await axios.put(`${API}/feedback/admin/${id}`, updates);
      toast.success("Feedback updated");
      fetchFeedback();
      fetchStats();
      if (selectedFeedback && selectedFeedback.id === id) {
        setSelectedFeedback({ ...selectedFeedback, ...updates });
      }
    } catch (error) {
      toast.error("Failed to update feedback");
    } finally {
      setUpdating(false);
    }
  };

  // Respond to feedback
  const respondToFeedback = async () => {
    if (!responseText.trim() || !selectedFeedback) return;
    
    setResponding(true);
    try {
      await axios.post(`${API}/feedback/admin/${selectedFeedback.id}/respond`, {
        response_message: responseText
      });
      toast.success("Response sent");
      setResponseText("");
      // Refresh the detail
      viewFeedback(selectedFeedback.id);
    } catch (error) {
      toast.error("Failed to send response");
    } finally {
      setResponding(false);
    }
  };

  // Delete feedback
  const deleteFeedback = async (id) => {
    if (!confirm("Are you sure you want to delete this feedback?")) return;
    
    try {
      await axios.delete(`${API}/feedback/admin/${id}`);
      toast.success("Feedback deleted");
      fetchFeedback();
      fetchStats();
      setShowDetailDialog(false);
    } catch (error) {
      toast.error("Failed to delete feedback");
    }
  };

  // Get type icon
  const getTypeIcon = (type) => {
    switch (type) {
      case "bug_report": return <Bug className="h-4 w-4 text-red-400" />;
      case "feature_request": return <Lightbulb className="h-4 w-4 text-yellow-400" />;
      case "praise": return <ThumbsUp className="h-4 w-4 text-green-400" />;
      case "complaint": return <AlertCircle className="h-4 w-4 text-orange-400" />;
      default: return <MessageSquare className="h-4 w-4 text-blue-400" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const variants = {
      new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      in_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      resolved: "bg-green-500/20 text-green-400 border-green-500/30",
      closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      wont_fix: "bg-red-500/20 text-red-400 border-red-500/30"
    };
    return (
      <Badge className={`${variants[status] || variants.new} border`}>
        {status?.replace("_", " ") || "new"}
      </Badge>
    );
  };

  // Get priority badge
  const getPriorityBadge = (priority) => {
    const variants = {
      critical: "bg-red-600/20 text-red-400 border-red-600/30",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      low: "bg-gray-500/20 text-gray-400 border-gray-500/30"
    };
    return (
      <Badge className={`${variants[priority] || variants.medium} border`}>
        {priority || "medium"}
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6" data-testid="feedback-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Feedback Manager</h1>
          <p className="text-gray-400 text-sm">Manage user feedback, bug reports, and feature requests</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => { fetchFeedback(); fetchStats(); }}
          className="gap-2"
          data-testid="refresh-btn"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-white">{stats?.total || 0}</div>
            <div className="text-xs text-gray-400">Total Feedback</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">{stats?.by_status?.new || 0}</div>
            <div className="text-xs text-gray-400">New</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats?.by_status?.in_review || 0}</div>
            <div className="text-xs text-gray-400">In Review</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{stats?.by_status?.resolved || 0}</div>
            <div className="text-xs text-gray-400">Resolved</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stats?.by_type?.bug_report || 0}</div>
            <div className="text-xs text-gray-400">Bug Reports</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-400">{stats?.new_this_week || 0}</div>
            <div className="text-xs text-gray-400">This Week</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-gray-400 text-xs mb-1">Search</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="bg-gray-800 border-gray-700"
                  data-testid="search-input"
                />
                <Button onClick={handleSearch} variant="secondary" data-testid="search-btn">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="w-[150px]">
              <Label className="text-gray-400 text-xs mb-1">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="bg-gray-800 border-gray-700" data-testid="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[150px]">
              <Label className="text-gray-400 text-xs mb-1">Type</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="bg-gray-800 border-gray-700" data-testid="type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bug_report">Bug Report</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="praise">Praise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-[150px]">
              <Label className="text-gray-400 text-xs mb-1">Priority</Label>
              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="bg-gray-800 border-gray-700" data-testid="priority-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Table */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : feedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>No feedback found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Subject</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Priority</TableHead>
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedback.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className="border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => viewFeedback(item.id)}
                    data-testid={`feedback-row-${item.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(item.type)}
                        <span className="text-gray-300 text-sm capitalize">
                          {item.type?.replace("_", " ") || "General"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className="text-white truncate">{item.subject}</p>
                        {item.contact_email && (
                          <p className="text-gray-500 text-xs truncate">{item.contact_email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {formatDate(item.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => viewFeedback(item.id)}
                          data-testid={`view-btn-${item.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteFeedback(item.id)}
                          className="text-red-400 hover:text-red-300"
                          data-testid={`delete-btn-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <p className="text-gray-400 text-sm">Page {currentPage} of {totalPages}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="prev-page-btn"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="next-page-btn"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-800 max-h-[90vh] overflow-y-auto">
          {selectedFeedback && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {getTypeIcon(selectedFeedback.type)}
                  <DialogTitle className="text-white">{selectedFeedback.subject}</DialogTitle>
                </div>
                <DialogDescription className="flex items-center gap-4 pt-2">
                  {getStatusBadge(selectedFeedback.status)}
                  {getPriorityBadge(selectedFeedback.priority)}
                  <span className="text-gray-500 text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(selectedFeedback.created_at)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Contact Info */}
                {selectedFeedback.contact_email && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Mail className="h-4 w-4" />
                    <span>{selectedFeedback.contact_email}</span>
                  </div>
                )}

                {/* Message */}
                <div>
                  <Label className="text-gray-400 text-xs">Message</Label>
                  <div className="mt-1 p-3 bg-gray-800 rounded-lg text-gray-200 whitespace-pre-wrap">
                    {selectedFeedback.message}
                  </div>
                </div>

                {/* Device Info */}
                {(selectedFeedback.device_info || selectedFeedback.app_version) && (
                  <div className="flex gap-4 text-sm">
                    {selectedFeedback.device_info && (
                      <div>
                        <Label className="text-gray-400 text-xs">Device</Label>
                        <p className="text-gray-300">{selectedFeedback.device_info}</p>
                      </div>
                    )}
                    {selectedFeedback.app_version && (
                      <div>
                        <Label className="text-gray-400 text-xs">App Version</Label>
                        <p className="text-gray-300">{selectedFeedback.app_version}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Update Status/Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400 text-xs">Update Status</Label>
                    <Select 
                      value={selectedFeedback.status || "new"} 
                      onValueChange={(v) => updateFeedback(selectedFeedback.id, { status: v })}
                      disabled={updating}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_review">In Review</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="wont_fix">Won't Fix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs">Update Priority</Label>
                    <Select 
                      value={selectedFeedback.priority || "medium"} 
                      onValueChange={(v) => updateFeedback(selectedFeedback.id, { priority: v })}
                      disabled={updating}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <Label className="text-gray-400 text-xs">Admin Notes</Label>
                  <Textarea
                    value={selectedFeedback.admin_notes || ""}
                    onChange={(e) => setSelectedFeedback({ ...selectedFeedback, admin_notes: e.target.value })}
                    onBlur={() => updateFeedback(selectedFeedback.id, { admin_notes: selectedFeedback.admin_notes })}
                    placeholder="Add internal notes..."
                    className="bg-gray-800 border-gray-700 mt-1"
                    rows={2}
                  />
                </div>

                {/* Previous Responses */}
                {selectedFeedback.responses && selectedFeedback.responses.length > 0 && (
                  <div>
                    <Label className="text-gray-400 text-xs">Responses ({selectedFeedback.responses.length})</Label>
                    <div className="mt-1 space-y-2">
                      {selectedFeedback.responses.map((resp, idx) => (
                        <div key={idx} className="p-3 bg-purple-900/20 border border-purple-800/30 rounded-lg">
                          <p className="text-gray-200 text-sm">{resp.message}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {formatDate(resp.responded_at)} by {resp.responded_by}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Response */}
                <div>
                  <Label className="text-gray-400 text-xs">Send Response</Label>
                  <div className="flex gap-2 mt-1">
                    <Textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Type your response to the user..."
                      className="bg-gray-800 border-gray-700 flex-1"
                      rows={2}
                    />
                  </div>
                  <Button
                    onClick={respondToFeedback}
                    disabled={!responseText.trim() || responding}
                    className="mt-2 gap-2 bg-purple-600 hover:bg-purple-700"
                    data-testid="send-response-btn"
                  >
                    <Send className="h-4 w-4" />
                    {responding ? "Sending..." : "Send Response"}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => deleteFeedback(selectedFeedback.id)}
                  className="gap-2"
                  data-testid="delete-feedback-btn"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Feedback
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
