import { useState, useEffect, useRef } from "react";
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
  MessageCircle, 
  Send, 
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Headphones,
  Bot,
  UserCheck
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ChatManagementPage() {
  // State
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, open: 0, closed: 0, pending: 0 });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Chat dialog
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch conversations
  const fetchConversations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20"
      });
      
      if (statusFilter !== "all") params.append("status", statusFilter);
      
      const response = await axios.get(`${API}/chat/admin/conversations?${params}`);
      if (response.data.success) {
        setConversations(response.data.conversations);
        setTotalPages(response.data.total_pages);
        
        // Calculate stats
        const all = response.data.conversations;
        setStats({
          total: response.data.total,
          open: all.filter(c => c.status === "open").length,
          closed: all.filter(c => c.status === "closed").length,
          pending: all.filter(c => c.status === "pending").length
        });
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [currentPage, statusFilter]);

  // Open conversation
  const openConversation = (conv) => {
    setSelectedConversation(conv);
    setShowChatDialog(true);
    setReplyText("");
  };

  // Send reply
  const sendReply = async () => {
    if (!replyText.trim() || !selectedConversation) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/chat/admin/conversations/${selectedConversation.id}/reply`, {
        message: replyText
      });
      
      toast.success("Reply sent");
      setReplyText("");
      
      // Refresh conversation
      const response = await axios.get(`${API}/chat/conversations/${selectedConversation.id}/messages`);
      if (response.data.success) {
        setSelectedConversation({
          ...selectedConversation,
          messages: response.data.messages
        });
      }
      
      fetchConversations();
    } catch (error) {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  // Update status
  const updateStatus = async (convId, newStatus) => {
    try {
      await axios.put(`${API}/chat/admin/conversations/${convId}/status?status=${newStatus}`);
      toast.success(`Status updated to ${newStatus}`);
      fetchConversations();
      
      if (selectedConversation && selectedConversation.id === convId) {
        setSelectedConversation({ ...selectedConversation, status: newStatus });
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const variants = {
      open: "bg-green-500/20 text-green-400 border-green-500/30",
      closed: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    };
    const icons = {
      open: <CheckCircle className="h-3 w-3" />,
      closed: <XCircle className="h-3 w-3" />,
      pending: <AlertCircle className="h-3 w-3" />
    };
    return (
      <Badge className={`${variants[status] || variants.open} border flex items-center gap-1`}>
        {icons[status]}
        {status || "open"}
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  return (
    <div className="space-y-6" data-testid="chat-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chat & Support</h1>
          <p className="text-gray-400 text-sm">Manage user support conversations and handover to agents</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchConversations}
          className="gap-2"
          data-testid="refresh-btn"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <MessageCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Chats</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.open}</div>
                <div className="text-xs text-gray-400">Open</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                <div className="text-xs text-gray-400">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <XCircle className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-400">{stats.closed}</div>
                <div className="text-xs text-gray-400">Closed</div>
              </div>
            </div>
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
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                  data-testid="search-input"
                />
                <Button variant="secondary" data-testid="search-btn">
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
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No conversations found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {conversations.map((conv) => (
                <div 
                  key={conv.id}
                  className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => openConversation(conv)}
                  data-testid={`conversation-${conv.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {conv.user_name || `User ${conv.user_id?.slice(-6) || 'Anonymous'}`}
                          </span>
                          {getStatusBadge(conv.status)}
                        </div>
                        <p className="text-gray-400 text-sm mt-1 line-clamp-1">
                          {conv.messages?.[conv.messages.length - 1]?.message || "No messages"}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(conv.updated_at || conv.created_at)}
                          </span>
                          <span>{conv.messages?.length || 0} messages</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); updateStatus(conv.id, "pending"); }}
                        className="text-yellow-400 hover:text-yellow-300"
                        title="Mark as Pending"
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); updateStatus(conv.id, "closed"); }}
                        className="text-gray-400 hover:text-gray-300"
                        title="Close"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat Dialog */}
      <Dialog open={showChatDialog} onOpenChange={setShowChatDialog}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-800 max-h-[90vh] flex flex-col">
          {selectedConversation && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <DialogTitle className="text-white">
                        {selectedConversation.user_name || `User ${selectedConversation.user_id?.slice(-6) || 'Anonymous'}`}
                      </DialogTitle>
                      <DialogDescription className="flex items-center gap-2">
                        {getStatusBadge(selectedConversation.status)}
                        <span className="text-gray-500 text-xs">
                          Started {formatDate(selectedConversation.created_at)}
                        </span>
                      </DialogDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(selectedConversation.id, "open")}
                      className={selectedConversation.status === "open" ? "bg-green-500/20" : ""}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(selectedConversation.id, "closed")}
                      className={selectedConversation.status === "closed" ? "bg-gray-500/20" : ""}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[300px] max-h-[400px]">
                {selectedConversation.messages?.map((msg, idx) => (
                  <div 
                    key={msg.id || idx}
                    className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender === 'user' ? '' : 'flex-row-reverse'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        msg.sender === 'user' ? 'bg-purple-500/20' : 'bg-green-500/20'
                      }`}>
                        {msg.sender === 'user' ? (
                          <User className="h-4 w-4 text-purple-400" />
                        ) : (
                          <Headphones className="h-4 w-4 text-green-400" />
                        )}
                      </div>
                      <div className={`rounded-lg p-3 ${
                        msg.sender === 'user' 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-purple-600 text-white'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-60 mt-1">
                          {formatDate(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div className="border-t border-gray-800 pt-4">
                <div className="flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="bg-gray-800 border-gray-700 flex-1 resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <Button
                    onClick={sendReply}
                    disabled={!replyText.trim() || sending}
                    className="bg-purple-600 hover:bg-purple-700 self-end"
                    data-testid="send-reply-btn"
                  >
                    {sending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Press Enter to send, Shift+Enter for new line</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
