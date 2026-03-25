import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { FileText, Shield, Mail, Save, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const PAGE_CONFIG = {
  terms_of_service: {
    icon: FileText,
    label: "Terms of Service",
    labelSw: "Masharti ya Huduma",
    color: "text-blue-500"
  },
  privacy_policy: {
    icon: Shield,
    label: "Privacy Policy", 
    labelSw: "Sera ya Faragha",
    color: "text-green-500"
  },
  contact: {
    icon: Mail,
    label: "Contact Us",
    labelSw: "Wasiliana Nasi",
    color: "text-amber-500"
  }
};

export default function LegalCompliancePage() {
  const [pages, setPages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("terms_of_service");
  const [previewLang, setPreviewLang] = useState("en");

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/admin/legal`);
      const pagesObj = {};
      (res.data.pages || []).forEach(page => {
        pagesObj[page.page_id] = page;
      });
      setPages(pagesObj);
    } catch (error) {
      console.error("Failed to fetch legal pages:", error);
      toast.error("Failed to load legal pages");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (pageId) => {
    try {
      setSaving(true);
      const page = pages[pageId];
      
      await axios.put(`${API}/admin/legal/${pageId}`, {
        title: page.title,
        title_sw: page.title_sw,
        content: page.content,
        content_sw: page.content_sw
      });
      
      toast.success(`${PAGE_CONFIG[pageId].label} saved successfully`);
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (pageId) => {
    if (!window.confirm("Reset to default content? This will overwrite your changes.")) return;
    
    try {
      const res = await axios.post(`${API}/admin/legal/${pageId}/reset`);
      setPages(prev => ({
        ...prev,
        [pageId]: res.data.page
      }));
      toast.success("Reset to default content");
    } catch (error) {
      toast.error("Failed to reset");
    }
  };

  const updatePage = (pageId, field, value) => {
    setPages(prev => ({
      ...prev,
      [pageId]: {
        ...prev[pageId],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderPageEditor = (pageId) => {
    const page = pages[pageId] || {};
    const config = PAGE_CONFIG[pageId];
    const Icon = config.icon;

    return (
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`w-6 h-6 ${config.color}`} />
            <div>
              <h3 className="text-lg font-semibold text-white">{config.label}</h3>
              <p className="text-sm text-zinc-400">{config.labelSw}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleReset(pageId)}
              className="border-zinc-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset to Default
            </Button>
            <Button 
              onClick={() => handleSave(pageId)}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Language tabs for editing */}
        <Tabs defaultValue="en" className="w-full">
          <TabsList className="bg-zinc-800">
            <TabsTrigger value="en">English</TabsTrigger>
            <TabsTrigger value="sw">Swahili (Kiswahili)</TabsTrigger>
          </TabsList>

          <TabsContent value="en" className="space-y-4 mt-4">
            <div>
              <Label className="text-zinc-300">Title (English)</Label>
              <Input
                value={page.title || ""}
                onChange={(e) => updatePage(pageId, "title", e.target.value)}
                className="bg-zinc-800 border-zinc-700 mt-1"
                placeholder="Page title in English"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Content (English) - Supports Markdown</Label>
              <textarea
                value={page.content || ""}
                onChange={(e) => updatePage(pageId, "content", e.target.value)}
                className="w-full h-96 bg-zinc-800 border border-zinc-700 rounded-lg p-4 mt-1 text-white font-mono text-sm resize-y"
                placeholder="Enter content in Markdown format..."
              />
            </div>
          </TabsContent>

          <TabsContent value="sw" className="space-y-4 mt-4">
            <div>
              <Label className="text-zinc-300">Title (Swahili)</Label>
              <Input
                value={page.title_sw || ""}
                onChange={(e) => updatePage(pageId, "title_sw", e.target.value)}
                className="bg-zinc-800 border-zinc-700 mt-1"
                placeholder="Kichwa cha ukurasa kwa Kiswahili"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Content (Swahili) - Supports Markdown</Label>
              <textarea
                value={page.content_sw || ""}
                onChange={(e) => updatePage(pageId, "content_sw", e.target.value)}
                className="w-full h-96 bg-zinc-800 border border-zinc-700 rounded-lg p-4 mt-1 text-white font-mono text-sm resize-y"
                placeholder="Ingiza maudhui kwa muundo wa Markdown..."
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview section */}
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </CardTitle>
              <select
                value={previewLang}
                onChange={(e) => setPreviewLang(e.target.value)}
                className="bg-zinc-700 border-zinc-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="en">English</option>
                <option value="sw">Swahili</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-zinc-900 rounded-lg p-4 max-h-64 overflow-y-auto prose prose-invert prose-sm">
              <h2 className="text-white">
                {previewLang === "sw" ? page.title_sw : page.title}
              </h2>
              <div className="whitespace-pre-wrap text-zinc-300 text-sm">
                {(previewLang === "sw" ? page.content_sw : page.content)?.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mt-4">{line.slice(2)}</h1>;
                  if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold text-white mt-3">{line.slice(3)}</h2>;
                  if (line.startsWith('### ')) return <h3 key={i} className="text-base font-medium text-white mt-2">{line.slice(4)}</h3>;
                  if (line.startsWith('- ')) return <li key={i} className="ml-4">{line.slice(2)}</li>;
                  if (line.startsWith('**') && line.endsWith('**')) return <strong key={i}>{line.slice(2, -2)}</strong>;
                  return <p key={i} className="my-1">{line}</p>;
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Legal & Compliance</h1>
        <p className="text-zinc-400">
          Manage Terms of Service, Privacy Policy, and Contact information displayed to users
        </p>
      </div>

      {/* Page selector tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-800 mb-6">
          {Object.entries(PAGE_CONFIG).map(([id, config]) => {
            const Icon = config.icon;
            return (
              <TabsTrigger key={id} value={id} className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${config.color}`} />
                {config.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.keys(PAGE_CONFIG).map(pageId => (
          <TabsContent key={pageId} value={pageId}>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-6">
                {renderPageEditor(pageId)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Info about where these appear */}
      <Card className="mt-6 bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-4">
          <h4 className="font-medium text-white mb-2">Where these pages appear:</h4>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• <strong>Mobile App:</strong> Settings → "Masharti ya Huduma" and "Sera ya Faragha"</li>
            <li>• <strong>Web App:</strong> Footer links for Terms, Privacy, and Contact</li>
            <li>• <strong>Both platforms:</strong> Content is shown in user's selected language</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
