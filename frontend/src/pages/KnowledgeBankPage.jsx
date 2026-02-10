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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  BookOpen, 
  Plus, 
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Tag,
  FileText,
  Brain
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { value: "general", label: "General / Ujumla" },
  { value: "subscription", label: "Subscription / Usajili" },
  { value: "payment", label: "Payment / Malipo" },
  { value: "music", label: "Music / Muziki" },
  { value: "bible", label: "Bible / Biblia" },
  { value: "downloads", label: "Downloads / Upakuaji" },
  { value: "account", label: "Account / Akaunti" },
  { value: "technical", label: "Technical / Kiufundi" },
  { value: "faq", label: "FAQ / Maswali" },
];

export default function KnowledgeBankPage() {
  // State
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0 });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "general",
    keywords: "",
    is_active: true
  });

  // Fetch entries
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "15"
      });
      
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      
      const response = await axios.get(`${API}/chat/admin/knowledge-bank?${params}`);
      if (response.data.success) {
        setEntries(response.data.entries);
        setTotalPages(response.data.total_pages);
        setStats({
          total: response.data.total,
          active: response.data.entries.filter(e => e.is_active).length
        });
      }
    } catch (error) {
      console.error("Failed to fetch knowledge bank:", error);
      toast.error("Failed to load knowledge bank");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [currentPage, categoryFilter]);

  // Open dialog for new entry
  const openNewDialog = () => {
    setEditingEntry(null);
    setForm({
      title: "",
      content: "",
      category: "general",
      keywords: "",
      is_active: true
    });
    setShowDialog(true);
  };

  // Open dialog for editing
  const openEditDialog = (entry) => {
    setEditingEntry(entry);
    setForm({
      title: entry.title,
      content: entry.content,
      category: entry.category,
      keywords: entry.keywords?.join(", ") || "",
      is_active: entry.is_active
    });
    setShowDialog(true);
  };

  // Save entry
  const saveEntry = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        keywords: form.keywords.split(",").map(k => k.trim().toLowerCase()).filter(k => k),
        is_active: form.is_active
      };
      
      if (editingEntry) {
        await axios.put(`${API}/chat/admin/knowledge-bank/${editingEntry.id}`, data);
        toast.success("Entry updated");
      } else {
        await axios.post(`${API}/chat/admin/knowledge-bank`, data);
        toast.success("Entry created");
      }
      
      setShowDialog(false);
      fetchEntries();
    } catch (error) {
      toast.error("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  // Delete entry
  const deleteEntry = async (id) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    
    try {
      await axios.delete(`${API}/chat/admin/knowledge-bank/${id}`);
      toast.success("Entry deleted");
      fetchEntries();
    } catch (error) {
      toast.error("Failed to delete entry");
    }
  };

  // Get category label
  const getCategoryLabel = (value) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="space-y-6" data-testid="knowledge-bank-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-400" />
            Knowledge Bank
          </h1>
          <p className="text-gray-400 text-sm">Manage AI support knowledge base for automated responses</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchEntries}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button 
            onClick={openNewDialog}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
            data-testid="add-entry-btn"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <BookOpen className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Entries</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <FileText className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.active}</div>
                <div className="text-xs text-gray-400">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800 md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Brain className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">AI-Powered Support</div>
                <div className="text-xs text-gray-400">Entries are used to provide context-aware AI responses</div>
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
                  placeholder="Search entries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                  data-testid="search-input"
                />
                <Button variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="w-[180px]">
              <Label className="text-gray-400 text-xs mb-1">Category</Label>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="bg-gray-800 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries List */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <BookOpen className="h-12 w-12 mb-4 opacity-50" />
              <p>No knowledge entries found</p>
              <Button 
                onClick={openNewDialog}
                className="mt-4 gap-2"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Add First Entry
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {entries.map((entry) => (
                <div 
                  key={entry.id}
                  className="p-4 hover:bg-gray-800/50 transition-colors"
                  data-testid={`entry-${entry.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-medium">{entry.title}</h3>
                        <Badge className={`${entry.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'} text-xs`}>
                          {entry.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge className="bg-purple-500/20 text-purple-400 text-xs">
                          {getCategoryLabel(entry.category)}
                        </Badge>
                      </div>
                      <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                        {entry.content}
                      </p>
                      {entry.keywords?.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Tag className="h-3 w-3 text-gray-500" />
                          {entry.keywords.slice(0, 5).map((kw, idx) => (
                            <span key={idx} className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                              {kw}
                            </span>
                          ))}
                          {entry.keywords.length > 5 && (
                            <span className="text-xs text-gray-500">+{entry.keywords.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(entry)}
                        data-testid={`edit-btn-${entry.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEntry(entry.id)}
                        className="text-red-400 hover:text-red-300"
                        data-testid={`delete-btn-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
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

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-400" />
              {editingEntry ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry ? "Update this knowledge entry" : "Create a new entry for AI support context"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-400">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., How to download songs"
                className="bg-gray-800 border-gray-700 mt-1"
                data-testid="entry-title-input"
              />
            </div>

            <div>
              <Label className="text-gray-400">Content *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Detailed information that will help AI respond to user questions..."
                className="bg-gray-800 border-gray-700 mt-1 min-h-[150px]"
                data-testid="entry-content-input"
              />
              <p className="text-xs text-gray-500 mt-1">
                This content will be used by AI to provide context-aware responses
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Category</Label>
                <Select 
                  value={form.category} 
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-6">
                <Label className="text-gray-400">Active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400">Keywords (comma separated)</Label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="download, offline, music, pakua"
                className="bg-gray-800 border-gray-700 mt-1"
                data-testid="entry-keywords-input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Keywords help match this entry to user questions
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={saveEntry} 
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="save-entry-btn"
            >
              {saving ? "Saving..." : editingEntry ? "Update Entry" : "Create Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
