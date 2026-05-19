import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  ArrowLeft, Music2, DollarSign, Clock, Users, Play, Edit2, 
  CheckCircle, XCircle, Phone, Mail, Church, Crown, Gift,
  TrendingUp, PlayCircle, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer
} from "recharts";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DENOMINATIONS = [
  { value: "roman_catholic", label: "Roman Catholic" },
  { value: "lutheran", label: "Lutheran" },
  { value: "anglican", label: "Anglican" },
  { value: "pentecostal", label: "Pentecostal" },
  { value: "evangelical", label: "Evangelical" },
  { value: "adventist", label: "Seventh-day Adventist" },
  { value: "baptist", label: "Baptist" },
  { value: "methodist", label: "Methodist" },
  { value: "orthodox", label: "Orthodox" },
  { value: "other", label: "Other" }
];

export default function ChoirDetailsPage() {
  const { choirId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [playingSong, setPlayingSong] = useState(null);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API}/admin/choirs/${choirId}`, { withCredentials: true });
      setData(response.data);
      setEditForm({
        name: response.data.choir?.name || "",
        denomination: response.data.choir?.denomination || "",
        treasurer_name: response.data.choir?.treasurer_name || "",
        treasurer_phone: response.data.choir?.treasurer_phone || "",
        chairman_name: response.data.choir?.chairman_name || "",
        chairman_phone: response.data.choir?.chairman_phone || "",
        parish_priest_name: response.data.choir?.parish_priest_name || "",
        parish_priest_phone: response.data.choir?.parish_priest_phone || "",
        bio: response.data.choir?.bio || ""
      });
    } catch (error) {
      console.error("Error fetching choir:", error);
      toast.error("Failed to load choir details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choirId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/admin/choirs/${choirId}`, editForm, { withCredentials: true });
      toast.success("Choir updated successfully");
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to update choir");
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await axios.put(`${API}/admin/choirs/${choirId}`, { status }, { withCredentials: true });
      toast.success(`Choir ${status}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleAlbumStatusChange = async (albumId, status) => {
    try {
      await axios.put(`${API}/admin/albums/${albumId}`, { status }, { withCredentials: true });
      toast.success(`Album ${status}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update album");
    }
  };

  const handleSongStatusChange = async (songId, status) => {
    try {
      await axios.put(`${API}/admin/songs/${songId}`, { status }, { withCredentials: true });
      toast.success(`Song ${status}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update song");
    }
  };

  const handleApproveAlbum = async (albumId) => {
    try {
      await axios.post(`${API}/admin/albums/${albumId}/approve`, {}, { withCredentials: true });
      toast.success("Album and all songs approved");
      fetchData();
    } catch (error) {
      toast.error("Failed to approve album");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: "bg-emerald-500/20 text-emerald-400",
      inactive: "bg-zinc-500/20 text-zinc-400",
      suspended: "bg-red-500/20 text-red-400",
      pending: "bg-amber-500/20 text-amber-400",
      approved: "bg-emerald-500/20 text-emerald-400",
      rejected: "bg-red-500/20 text-red-400",
      completed: "bg-emerald-500/20 text-emerald-400"
    };
    return <Badge className={styles[status] || styles.pending}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center min-h-[60vh]">
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container">
        <p className="text-zinc-500">Choir not found</p>
      </div>
    );
  }

  const { choir, account, albums, withdrawals } = data;
  // analytics holds the canonical summary + top_songs + albums (with plays) + monthly trend
  const analytics = data.analytics || {};
  const revenue = analytics.summary || data.revenue || {};
  const monthly = analytics.monthly || data.monthly || [];
  const topSongs = analytics.top_songs || [];
  const topAlbums = analytics.albums || [];
  const billingEnabled = analytics.billing_enabled ?? revenue.billing_enabled ?? false;

  return (
    <div className="page-container animate-fade-in" data-testid="choir-details-page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/admin/choirs")} className="text-zinc-400 hover:text-white">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{choir?.name}</h1>
            {getStatusBadge(choir?.status)}
            {choir?.approval_status === "pending" && getStatusBadge("pending")}
          </div>
          <p className="text-zinc-500 text-sm">
            {DENOMINATIONS.find(d => d.value === choir?.denomination)?.label || choir?.denomination}
            {choir?.church_name && ` • ${choir.church_name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)} className="border-zinc-700 text-zinc-300">
            <Edit2 size={16} className="mr-2" /> Edit
          </Button>
          {choir?.status === "active" ? (
            <Button variant="outline" onClick={() => handleStatusChange("suspended")} className="border-amber-600 text-amber-400">
              <XCircle size={16} className="mr-2" /> Suspend
            </Button>
          ) : (
            <Button onClick={() => handleStatusChange("active")} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle size={16} className="mr-2" /> Activate
            </Button>
          )}
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="bg-gradient-to-r from-violet-900/40 to-emerald-900/40 rounded-2xl p-6 mb-6">
        {!billingEnabled && (
          <div className="mb-4 flex items-center gap-2 text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-sm" data-testid="billing-off-banner">
            <span className="font-semibold">Billing OFF</span>
            <span className="opacity-75">— plays are counted but no revenue is calculated.</span>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-zinc-400 text-xs">Net Revenue</p>
            <p className="text-2xl font-bold text-white" data-testid="net-revenue">
              {billingEnabled ? `TZS ${(revenue?.net_revenue || 0).toLocaleString()}` : <span className="text-zinc-500">—</span>}
            </p>
          </div>
          <div>
            <p className="text-zinc-400 text-xs">Total Plays</p>
            <p className="text-2xl font-bold text-white" data-testid="total-plays">{revenue?.total_plays || 0}</p>
          </div>
          <div>
            <p className="text-zinc-400 text-xs">Minutes Streamed</p>
            <p className="text-2xl font-bold text-white">{(revenue?.total_minutes_streamed || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-zinc-400 text-xs">Current Balance</p>
            <p className="text-2xl font-bold text-emerald-400">
              {billingEnabled ? `TZS ${(revenue?.current_balance || 0).toLocaleString()}` : <span className="text-zinc-500">—</span>}
            </p>
          </div>
          <div>
            <p className="text-zinc-400 text-xs">Total Withdrawn</p>
            <p className="text-2xl font-bold text-white">
              {billingEnabled ? `TZS ${(revenue?.total_withdrawn || 0).toLocaleString()}` : <span className="text-zinc-500">—</span>}
            </p>
          </div>
        </div>
        {monthly && monthly.length > 0 && (
          <div className="mt-4 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <Area type="monotone" dataKey="plays" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
                <XAxis dataKey="month" stroke="#52525b" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                  formatter={(v) => [`${v} plays`, "Plays"]}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top performing songs */}
      {topSongs.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              Best Performing Songs
            </h3>
            <span className="text-xs text-zinc-500">{topSongs.length} tracked</span>
          </div>
          <div className="space-y-2" data-testid="top-songs-list">
            {topSongs.slice(0, 10).map((song, i) => (
              <div key={song.song_id} className="flex items-center gap-4 p-2 hover:bg-zinc-800/40 rounded-lg">
                <span className="text-zinc-500 font-bold w-6">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{song.title || "Untitled"}</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Play size={12} className="text-violet-400" />
                  <span className="text-white font-semibold">{song.plays}</span>
                </div>
                <span className="text-xs text-emerald-400 font-mono w-20 text-right">
                  TZS {(song.revenue || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600">Overview</TabsTrigger>
          <TabsTrigger value="albums" className="data-[state=active]:bg-violet-600">Albums ({albums?.length || 0})</TabsTrigger>
          <TabsTrigger value="withdrawals" className="data-[state=active]:bg-violet-600">Withdrawals</TabsTrigger>
          <TabsTrigger value="contacts" className="data-[state=active]:bg-violet-600">Contacts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Monthly Revenue Chart */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" /> Monthly Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthly && monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={[...monthly].reverse()}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="_id" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" name="Hours" />
                    <Area type="monotone" dataKey="plays" stroke="#8b5cf6" strokeWidth={2} fill="none" name="Plays" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-zinc-500">No data yet</div>
              )}
            </CardContent>
          </Card>

          {/* Top Albums */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Top Performing Albums</CardTitle>
            </CardHeader>
            <CardContent>
              {albums && albums.length > 0 ? (
                <div className="space-y-3">
                  {albums.slice(0, 5).map((album, idx) => (
                    <div key={album.album_id} className="flex items-center gap-4 p-3 bg-zinc-800/30 rounded-lg">
                      <span className="text-zinc-500 font-bold w-6">{idx + 1}</span>
                      {album.thumbnail ? (
                        <img src={album.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-violet-600/20 flex items-center justify-center">
                          <Music2 size={20} className="text-violet-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">{album.title}</h4>
                        <div className="flex gap-3 text-xs text-zinc-500">
                          <span>{album.songs?.length || 0} songs</span>
                          <span>{album.total_plays || 0} plays</span>
                          <span>{(album.total_hours || 0).toFixed(1)}h</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-400 font-semibold">TZS {(album.revenue || 0).toLocaleString()}</p>
                        <span className={`text-xs ${album.monetization_type === "premium" ? "text-amber-400" : "text-violet-400"}`}>
                          {album.monetization_type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">No albums yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Albums Tab */}
        <TabsContent value="albums" className="space-y-4">
          {albums && albums.length > 0 ? (
            albums.map((album) => (
              <Card key={album.album_id} className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {album.thumbnail ? (
                      <img src={album.thumbnail} alt="" className="w-20 h-20 rounded-lg object-cover" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-violet-600/20 flex items-center justify-center">
                        <Music2 size={32} className="text-violet-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{album.title}</h3>
                        {getStatusBadge(album.status)}
                        <span className={`text-xs flex items-center gap-1 ${album.monetization_type === "premium" ? "text-amber-400" : "text-violet-400"}`}>
                          {album.monetization_type === "premium" ? <Crown size={12} /> : <Gift size={12} />}
                          {album.monetization_type}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-zinc-500 mb-3">
                        <span>{album.songs?.length || 0} songs</span>
                        <span>{album.total_plays || 0} plays</span>
                        <span>{(album.total_hours || 0).toFixed(1)}h streamed</span>
                        <span className="text-emerald-400">TZS {(album.revenue || 0).toLocaleString()}</span>
                      </div>
                      
                      {/* Songs List */}
                      <div className="space-y-2">
                        {album.songs?.map((song, idx) => (
                          <div key={song.song_id} className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded text-sm">
                            <span className="text-zinc-500 w-6">{idx + 1}</span>
                            <button 
                              onClick={() => setPlayingSong(playingSong === song.song_id ? null : song.song_id)}
                              className="text-zinc-400 hover:text-white"
                            >
                              {playingSong === song.song_id ? <XCircle size={16} /> : <Play size={16} />}
                            </button>
                            <span className="flex-1 text-white truncate">{song.title}</span>
                            <span className="text-zinc-500">{song.duration_formatted || "--:--"}</span>
                            <span className="text-zinc-500">{song.total_plays || 0} plays</span>
                            {getStatusBadge(song.status)}
                            {song.status === "active" ? (
                              <Button size="sm" variant="ghost" onClick={() => handleSongStatusChange(song.song_id, "inactive")} className="text-amber-400 h-6 px-2">
                                Disable
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => handleSongStatusChange(song.song_id, "active")} className="text-emerald-400 h-6 px-2">
                                Enable
                              </Button>
                            )}
                            
                            {/* Audio Preview */}
                            {playingSong === song.song_id && song.audio_url && (
                              <audio controls autoPlay className="h-8 w-48">
                                <source src={song.audio_url} type="audio/mpeg" />
                              </audio>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {album.status !== "active" && (
                        <Button size="sm" onClick={() => handleApproveAlbum(album.album_id)} className="bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle size={14} className="mr-1" /> Approve All
                        </Button>
                      )}
                      {album.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => handleAlbumStatusChange(album.album_id, "inactive")} className="border-amber-600 text-amber-400">
                          Disable
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleAlbumStatusChange(album.album_id, "active")} className="border-emerald-600 text-emerald-400">
                          Enable
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <Music2 size={48} className="mx-auto mb-4 opacity-50" />
              <p>No albums yet</p>
            </div>
          )}
        </TabsContent>

        {/* Withdrawals Tab */}
        <TabsContent value="withdrawals">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Withdrawal History</CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawals && withdrawals.length > 0 ? (
                <div className="space-y-3">
                  {withdrawals.map((wd) => (
                    <div key={wd.request_id} className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg">
                      <div>
                        <p className="text-white font-medium">TZS {wd.amount?.toLocaleString()}</p>
                        <p className="text-xs text-zinc-500">
                          {wd.payment_method} • {new Date(wd.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(wd.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">No withdrawal history</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Treasurer */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-400" /> Treasurer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {choir?.treasurer_name ? (
                  <div className="space-y-2">
                    <p className="text-white font-medium">{choir.treasurer_name}</p>
                    {choir.treasurer_phone && (
                      <p className="text-sm text-zinc-400 flex items-center gap-2">
                        <Phone size={14} /> {choir.treasurer_phone}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-zinc-500">Not set</p>
                )}
              </CardContent>
            </Card>

            {/* Chairman */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Users size={16} className="text-violet-400" /> Chairman
                </CardTitle>
              </CardHeader>
              <CardContent>
                {choir?.chairman_name ? (
                  <div className="space-y-2">
                    <p className="text-white font-medium">{choir.chairman_name}</p>
                    {choir.chairman_phone && (
                      <p className="text-sm text-zinc-400 flex items-center gap-2">
                        <Phone size={14} /> {choir.chairman_phone}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-zinc-500">Not set</p>
                )}
              </CardContent>
            </Card>

            {/* Parish Priest */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Church size={16} className="text-amber-400" /> Parish Priest
                </CardTitle>
              </CardHeader>
              <CardContent>
                {choir?.parish_priest_name ? (
                  <div className="space-y-2">
                    <p className="text-white font-medium">{choir.parish_priest_name}</p>
                    {choir.parish_priest_phone && (
                      <p className="text-sm text-zinc-400 flex items-center gap-2">
                        <Phone size={14} /> {choir.parish_priest_phone}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-zinc-500">Not set</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Account Info */}
          {account && (
            <Card className="bg-zinc-900/50 border-zinc-800 mt-4">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Mail size={16} className="text-pink-400" /> Account Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">Email</p>
                    <p className="text-white">{account.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Account Status</p>
                    {getStatusBadge(account.status)}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Payment Method</p>
                    <p className="text-white">{account.payment_method || "Not set"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Payment Status</p>
                    {getStatusBadge(account.payment_details_status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Choir</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Choir Name</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-zinc-400 mb-1 block">Denomination</label>
                  <Select value={editForm.denomination} onValueChange={(v) => setEditForm({ ...editForm, denomination: v })}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      {DENOMINATIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Treasurer</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Name"
                    value={editForm.treasurer_name}
                    onChange={(e) => setEditForm({ ...editForm, treasurer_name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                  <Input
                    placeholder="Phone"
                    value={editForm.treasurer_phone}
                    onChange={(e) => setEditForm({ ...editForm, treasurer_phone: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Chairman</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Name"
                    value={editForm.chairman_name}
                    onChange={(e) => setEditForm({ ...editForm, chairman_name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                  <Input
                    placeholder="Phone"
                    value={editForm.chairman_phone}
                    onChange={(e) => setEditForm({ ...editForm, chairman_phone: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">Parish Priest</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Name"
                    value={editForm.parish_priest_name}
                    onChange={(e) => setEditForm({ ...editForm, parish_priest_name: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                  <Input
                    placeholder="Phone"
                    value={editForm.parish_priest_phone}
                    onChange={(e) => setEditForm({ ...editForm, parish_priest_phone: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <label className="text-sm text-zinc-400 mb-1 block">Bio</label>
                <Textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
