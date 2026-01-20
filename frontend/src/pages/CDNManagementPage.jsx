import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Cloud, HardDrive, Upload, Trash2, RefreshCw, Download, 
  FolderOpen, Music, Image, File, CheckCircle, AlertCircle,
  Play, ArrowRight, Loader2, Database, Globe, Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CDNManagementPage() {
  const [cdnStatus, setCdnStatus] = useState(null);
  const [cdnStats, setCdnStats] = useState(null);
  const [cdnFiles, setCdnFiles] = useState({ audio: [], images: [], thumbnails: [] });
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeFolder, setActiveFolder] = useState("audio");

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/cdn/status`, { withCredentials: true }),
        axios.get(`${API}/admin/cdn/stats`, { withCredentials: true }).catch(() => ({ data: null }))
      ]);
      
      setCdnStatus(statusRes.data);
      setCdnStats(statsRes.data);
      
      // Fetch migration status
      const migrationRes = await axios.get(`${API}/admin/cdn/migration-status`, { withCredentials: true }).catch(() => ({ data: null }));
      setMigrationStatus(migrationRes.data);
      
    } catch (error) {
      console.error("Error fetching CDN data:", error);
      toast.error("Failed to load CDN data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFiles = async (folder) => {
    try {
      const res = await axios.get(`${API}/admin/cdn/files?folder=${folder}&limit=100`, { withCredentials: true });
      setCdnFiles(prev => ({ ...prev, [folder]: res.data.files || [] }));
    } catch (error) {
      console.error(`Error fetching ${folder} files:`, error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "files" && cdnStatus?.enabled) {
      fetchFiles(activeFolder);
    }
  }, [activeTab, activeFolder, cdnStatus?.enabled]);

  const handleStartMigration = async () => {
    if (!window.confirm("This will migrate all MongoDB-stored files to Bunny CDN. Continue?")) return;
    
    setMigrating(true);
    try {
      const res = await axios.post(`${API}/admin/cdn/migrate`, {}, { withCredentials: true });
      toast.success(res.data.message);
      // Poll for migration status
      pollMigrationStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start migration");
      setMigrating(false);
    }
  };

  const pollMigrationStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/admin/cdn/migration-status`, { withCredentials: true });
        setMigrationStatus(res.data);
        
        if (res.data?.status === "completed" || res.data?.status === "failed" || !res.data?.status) {
          clearInterval(interval);
          setMigrating(false);
          fetchData();
        }
      } catch (error) {
        clearInterval(interval);
        setMigrating(false);
      }
    }, 2000);
  };

  const handleDeleteFile = async (folder, filename) => {
    if (!window.confirm(`Delete ${filename} from CDN?`)) return;
    
    try {
      await axios.delete(`${API}/admin/cdn/files/${folder}/${filename}`, { withCredentials: true });
      toast.success("File deleted");
      fetchFiles(folder);
      fetchData();
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" data-testid="cdn-management-page">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Cloud className="text-orange-400" /> CDN Management
          </h1>
          <p className="page-subtitle">Manage Bunny CDN storage and file delivery</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} className="border-zinc-700 text-zinc-300">
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* CDN Status Banner */}
      <Card className={`mb-6 ${cdnStatus?.enabled ? 'bg-emerald-900/20 border-emerald-700' : 'bg-red-900/20 border-red-700'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {cdnStatus?.enabled ? (
                <CheckCircle className="text-emerald-400" size={24} />
              ) : (
                <AlertCircle className="text-red-400" size={24} />
              )}
              <div>
                <h3 className="font-semibold text-white">
                  {cdnStatus?.enabled ? 'CDN Active' : 'CDN Not Configured'}
                </h3>
                <p className="text-sm text-zinc-400">
                  {cdnStatus?.enabled 
                    ? `Connected to ${cdnStatus?.storage_zone} (${cdnStatus?.storage_region.toUpperCase()})`
                    : 'Add BUNNY_API_KEY to enable CDN'}
                </p>
              </div>
            </div>
            {cdnStatus?.enabled && (
              <Badge className="bg-emerald-500/20 text-emerald-400">
                <Globe size={12} className="mr-1" /> {cdnStatus?.cdn_url}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-orange-600">
            <Server size={14} className="mr-2" /> Overview
          </TabsTrigger>
          <TabsTrigger value="files" className="data-[state=active]:bg-orange-600" disabled={!cdnStatus?.enabled}>
            <FolderOpen size={14} className="mr-2" /> Files
          </TabsTrigger>
          <TabsTrigger value="migration" className="data-[state=active]:bg-orange-600">
            <ArrowRight size={14} className="mr-2" /> Migration
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-blue-500/20">
                    <HardDrive className="text-blue-400" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {cdnStats?.total_size_mb?.toFixed(2) || 0} MB
                    </p>
                    <p className="text-sm text-zinc-500">Total Storage</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-violet-500/20">
                    <Music className="text-violet-400" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {cdnStats?.folders?.audio?.count || 0}
                    </p>
                    <p className="text-sm text-zinc-500">Audio Files</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/20">
                    <Image className="text-emerald-400" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {(cdnStats?.folders?.images?.count || 0) + (cdnStats?.folders?.thumbnails?.count || 0)}
                    </p>
                    <p className="text-sm text-zinc-500">Images</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-amber-500/20">
                    <Database className="text-amber-400" size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {cdnStats?.database_stats?.mongodb_files || 0}
                    </p>
                    <p className="text-sm text-zinc-500">MongoDB Files</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Storage Breakdown */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <FolderOpen size={18} /> Storage Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {['audio', 'images', 'thumbnails'].map(folder => (
                <div key={folder} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400 capitalize flex items-center gap-2">
                      {folder === 'audio' ? <Music size={14} /> : <Image size={14} />}
                      {folder}
                    </span>
                    <span className="text-white">
                      {cdnStats?.folders?.[folder]?.count || 0} files • {cdnStats?.folders?.[folder]?.size_mb?.toFixed(2) || 0} MB
                    </span>
                  </div>
                  <Progress 
                    value={cdnStats?.total_size_mb > 0 
                      ? ((cdnStats?.folders?.[folder]?.size_mb || 0) / cdnStats?.total_size_mb) * 100 
                      : 0
                    } 
                    className="h-2"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* CDN Configuration */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Server size={18} /> CDN Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">Storage Zone</p>
                  <p className="text-white font-mono">{cdnStatus?.storage_zone || 'Not set'}</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-500 mb-1">Region</p>
                  <p className="text-white font-mono">{cdnStatus?.storage_region?.toUpperCase() || 'Not set'}</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-lg col-span-2">
                  <p className="text-xs text-zinc-500 mb-1">CDN URL</p>
                  <p className="text-orange-400 font-mono text-sm truncate">{cdnStatus?.cdn_url || 'Not set'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-6">
          <div className="flex gap-2 mb-4">
            {['audio', 'images', 'thumbnails'].map(folder => (
              <Button
                key={folder}
                variant={activeFolder === folder ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFolder(folder)}
                className={activeFolder === folder ? "bg-orange-600" : "border-zinc-700"}
              >
                {folder === 'audio' ? <Music size={14} className="mr-1" /> : <Image size={14} className="mr-1" />}
                {folder.charAt(0).toUpperCase() + folder.slice(1)}
              </Button>
            ))}
          </div>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              {cdnFiles[activeFolder]?.length > 0 ? (
                <div className="space-y-2">
                  {cdnFiles[activeFolder].map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                      <div className="flex items-center gap-3">
                        {activeFolder === 'audio' ? (
                          <Music size={18} className="text-violet-400" />
                        ) : (
                          <Image size={18} className="text-emerald-400" />
                        )}
                        <div>
                          <p className="text-white text-sm font-medium">{file.ObjectName}</p>
                          <p className="text-xs text-zinc-500">
                            {formatBytes(file.Length)} • {new Date(file.LastChanged).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={file.cdn_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-orange-400 hover:text-orange-300 text-xs"
                        >
                          Open CDN URL
                        </a>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteFile(activeFolder, file.ObjectName)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No files in {activeFolder} folder</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Migration Tab */}
        <TabsContent value="migration" className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowRight size={18} /> Migrate MongoDB Files to CDN
              </CardTitle>
              <CardDescription>
                Move existing files stored in MongoDB to Bunny CDN for better performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Migration Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-amber-400">
                    {cdnStats?.database_stats?.mongodb_files || 0}
                  </p>
                  <p className="text-sm text-zinc-500">Files in MongoDB</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-emerald-400">
                    {cdnStats?.database_stats?.cdn_files || 0}
                  </p>
                  <p className="text-sm text-zinc-500">Files in CDN</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                  <p className="text-3xl font-bold text-violet-400">
                    {cdnStats?.database_stats?.total_tracked || 0}
                  </p>
                  <p className="text-sm text-zinc-500">Total Tracked</p>
                </div>
              </div>

              {/* Migration Status */}
              {migrationStatus?.status === "running" && (
                <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="animate-spin text-blue-400" />
                    <span className="text-blue-400 font-medium">Migration in progress...</span>
                  </div>
                  <Progress value={migrationStatus?.progress || 0} className="h-2 mb-2" />
                  <p className="text-sm text-zinc-400">
                    {migrationStatus?.migrated || 0} / {migrationStatus?.total || 0} files migrated
                  </p>
                </div>
              )}

              {migrationStatus?.status === "completed" && (
                <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="text-emerald-400" />
                    <div>
                      <p className="text-emerald-400 font-medium">Migration Completed</p>
                      <p className="text-sm text-zinc-400">
                        {migrationStatus?.migrated || 0} files migrated successfully
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Migration Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleStartMigration}
                  disabled={!cdnStatus?.enabled || migrating || (cdnStats?.database_stats?.mongodb_files || 0) === 0}
                  className="bg-orange-600 hover:bg-orange-700"
                  size="lg"
                >
                  {migrating ? (
                    <>
                      <Loader2 size={18} className="mr-2 animate-spin" /> Migrating...
                    </>
                  ) : (
                    <>
                      <Upload size={18} className="mr-2" /> Start Migration
                    </>
                  )}
                </Button>
              </div>

              {(cdnStats?.database_stats?.mongodb_files || 0) === 0 && (
                <p className="text-center text-zinc-500 text-sm">
                  No files to migrate. All files are already on CDN or no files exist.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
