import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { 
  Globe, MapPin, Plus, Edit2, Trash2, MoreVertical, Check, X, 
  BarChart3, Users, Music2, AlertTriangle, RefreshCw, Search,
  TrendingUp, Target, Loader2, ChevronDown, CheckSquare, Square,
  Flag, Settings, PieChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Common country display names
const COUNTRY_NAMES = {
  "TZ": "Tanzania", "KE": "Kenya", "UG": "Uganda", "RW": "Rwanda",
  "NG": "Nigeria", "GH": "Ghana", "ZA": "South Africa", "ET": "Ethiopia",
  "US": "United States", "GB": "United Kingdom", "CA": "Canada",
  "AU": "Australia", "IN": "India", "DE": "Germany", "FR": "France",
  "GLOBAL": "Global (All Countries)"
};

export default function GeoContentPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [countries, setCountries] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [contentGaps, setContentGaps] = useState(null);
  const [fallbackUsage, setFallbackUsage] = useState(null);
  const [usersByCountry, setUsersByCountry] = useState([]);
  const [playsByCountry, setPlaysByCountry] = useState([]);
  
  // Selection state
  const [selectedAlbums, setSelectedAlbums] = useState([]);
  const [selectedCountries, setSelectedCountries] = useState([]);
  
  // Modal states
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  
  // Search/filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, countriesRes, albumsRes] = await Promise.all([
        axios.get(`${API}/geo/analytics/overview`),
        axios.get(`${API}/geo/countries`),
        axios.get(`${API}/albums?limit=200`)
      ]);
      
      setOverview(overviewRes.data);
      setCountries(countriesRes.data.countries || []);
      setAlbums(albumsRes.data.albums || []);
      
      // Load additional analytics data
      const [gapsRes, fallbackRes, usersRes, playsRes] = await Promise.all([
        axios.get(`${API}/geo/analytics/content-gaps`),
        axios.get(`${API}/geo/analytics/fallback-usage`),
        axios.get(`${API}/geo/analytics/users-by-country`),
        axios.get(`${API}/geo/analytics/plays-by-country`)
      ]);
      
      setContentGaps(gapsRes.data);
      setFallbackUsage(fallbackRes.data);
      setUsersByCountry(usersRes.data.data || []);
      setPlaysByCountry(playsRes.data.data || []);
      
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load geo-content data");
    } finally {
      setLoading(false);
    }
  };

  const loadAlbumCountries = async (albumId) => {
    try {
      const res = await axios.get(`${API}/geo/content-countries/${albumId}`);
      return res.data;
    } catch (error) {
      console.error("Error loading album countries:", error);
      return { country_codes: [], is_default_fallback: false };
    }
  };

  const handleSetCountries = async (albumId, countryCodes, isDefault = false) => {
    try {
      // Set country tags
      await axios.post(`${API}/admin/geo/set-content-countries`, {
        content_id: albumId,
        country_codes: countryCodes
      });
      
      // Set default flag if needed
      await axios.post(`${API}/admin/geo/toggle-default-content`, {
        content_id: albumId,
        is_default: isDefault,
        content_type: "album"
      });
      
      toast.success("Country settings updated");
      setIsCountryModalOpen(false);
      setEditingAlbum(null);
      loadData();
    } catch (error) {
      console.error("Error setting countries:", error);
      toast.error("Failed to update country settings");
    }
  };

  const handleBulkUpdate = async (operation) => {
    if (selectedAlbums.length === 0) {
      toast.error("Select at least one album");
      return;
    }
    if (selectedCountries.length === 0 && operation !== "clear") {
      toast.error("Select at least one country");
      return;
    }
    
    try {
      await axios.post(`${API}/admin/geo/bulk-update-countries`, {
        content_ids: selectedAlbums,
        country_codes: operation === "clear" ? [] : selectedCountries,
        operation: operation === "clear" ? "replace" : operation
      });
      
      toast.success(`Bulk ${operation} completed for ${selectedAlbums.length} albums`);
      setIsBulkModalOpen(false);
      setSelectedAlbums([]);
      setSelectedCountries([]);
      loadData();
    } catch (error) {
      console.error("Error in bulk update:", error);
      toast.error("Bulk update failed");
    }
  };

  const handleToggleDefault = async (albumId, currentDefault) => {
    try {
      await axios.post(`${API}/admin/geo/toggle-default-content`, {
        content_id: albumId,
        is_default: !currentDefault,
        content_type: "album"
      });
      toast.success(`Album ${!currentDefault ? "marked as" : "removed from"} default fallback`);
      loadData();
    } catch (error) {
      toast.error("Failed to toggle default status");
    }
  };

  const openEditCountries = async (album) => {
    const countryData = await loadAlbumCountries(album.album_id);
    setEditingAlbum({
      ...album,
      country_codes: countryData.country_codes,
      is_default_fallback: countryData.is_default_fallback
    });
    setSelectedCountries(countryData.country_codes);
    setIsCountryModalOpen(true);
  };

  const filteredAlbums = albums.filter(album => {
    const matchesSearch = !searchQuery || 
      album.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.artist_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const toggleAlbumSelection = (albumId) => {
    setSelectedAlbums(prev => 
      prev.includes(albumId) 
        ? prev.filter(id => id !== albumId)
        : [...prev, albumId]
    );
  };

  const toggleCountrySelection = (code) => {
    setSelectedCountries(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-7 h-7 text-violet-500" />
            Geo-Filtered Content
          </h1>
          <p className="text-zinc-400 mt-1">Manage country-based content delivery</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadData}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button 
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-violet-600 hover:bg-violet-700 gap-2"
          >
            <Settings className="w-4 h-4" />
            Bulk Update
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-800/50">
          <TabsTrigger value="overview" className="gap-2">
            <PieChart className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-2">
            <Music2 className="w-4 h-4" />
            Content Tagging
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="gaps" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Content Gaps
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Tagged Content</p>
                    <p className="text-2xl font-bold">{overview?.tagged_content_count || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Flag className="w-6 h-6 text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Countries with Content</p>
                    <p className="text-2xl font-bold">{overview?.countries_with_content || 0}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Default Fallback</p>
                    <p className="text-2xl font-bold">
                      {(overview?.default_albums_count || 0) + (overview?.default_songs_count || 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Target className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Fallback Rate (30d)</p>
                    <p className="text-2xl font-bold">{overview?.fallback_rate || 0}%</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-rose-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Countries with Content */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg">Active Countries</CardTitle>
              <CardDescription>Countries with tagged content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {overview?.country_list?.map(code => (
                  <Badge key={code} variant="secondary" className="bg-violet-500/20 text-violet-300">
                    {COUNTRY_NAMES[code] || code}
                  </Badge>
                ))}
                {(!overview?.country_list || overview.country_list.length === 0) && (
                  <p className="text-zinc-500">No countries have content yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Countries by Users */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Users by Country
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {usersByCountry.slice(0, 8).map((item, idx) => (
                    <div key={item.country_code} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 w-6">{idx + 1}.</span>
                        <span className="font-medium">{COUNTRY_NAMES[item.country_code] || item.country_code}</span>
                      </div>
                      <span className="text-zinc-400">{item.user_count} users</span>
                    </div>
                  ))}
                  {usersByCountry.length === 0 && (
                    <p className="text-zinc-500">No user data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-400" />
                  Plays by Country (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {playsByCountry.slice(0, 8).map((item, idx) => (
                    <div key={item.country_code} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 w-6">{idx + 1}.</span>
                        <span className="font-medium">{COUNTRY_NAMES[item.country_code] || item.country_code}</span>
                      </div>
                      <span className="text-zinc-400">{item.play_count?.toLocaleString()} plays</span>
                    </div>
                  ))}
                  {playsByCountry.length === 0 && (
                    <p className="text-zinc-500">No play data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Tagging Tab */}
        <TabsContent value="content" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search albums..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-800/50 border-zinc-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">{selectedAlbums.length} selected</span>
              {selectedAlbums.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAlbums([])}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Albums Grid */}
          <div className="space-y-2">
            {filteredAlbums.map(album => (
              <div 
                key={album.album_id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  selectedAlbums.includes(album.album_id)
                    ? 'bg-violet-500/10 border-violet-500/30'
                    : 'bg-zinc-800/30 border-zinc-700/50 hover:bg-zinc-800/50'
                }`}
              >
                <Checkbox
                  checked={selectedAlbums.includes(album.album_id)}
                  onCheckedChange={() => toggleAlbumSelection(album.album_id)}
                />
                
                <div className="w-12 h-12 rounded bg-zinc-700 overflow-hidden flex-shrink-0">
                  {album.thumbnail ? (
                    <img 
                      src={album.thumbnail.startsWith('http') ? album.thumbnail : `${BACKEND_URL}${album.thumbnail}`} 
                      alt={album.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-6 h-6 text-zinc-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{album.title}</h3>
                  <p className="text-sm text-zinc-400 truncate">{album.artist_name}</p>
                </div>

                <div className="flex items-center gap-2">
                  {album.is_geo_default && (
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-300">
                      Default
                    </Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditCountries(album)}
                  className="gap-2"
                >
                  <Globe className="w-4 h-4" />
                  Countries
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                    <DropdownMenuItem onClick={() => openEditCountries(album)}>
                      <Globe className="w-4 h-4 mr-2" />
                      Edit Countries
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggleDefault(album.album_id, album.is_geo_default)}>
                      <Target className="w-4 h-4 mr-2" />
                      {album.is_geo_default ? "Remove from Default" : "Mark as Default"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fallback Usage */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Fallback Usage by Country</CardTitle>
                <CardDescription>Countries relying on default content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fallbackUsage?.data?.slice(0, 10).map((item, idx) => (
                    <div key={item.country_code} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 w-6">{idx + 1}.</span>
                        <span className="font-medium">{COUNTRY_NAMES[item.country_code] || item.country_code}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-rose-400">{item.fallback_count} times</span>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      </div>
                    </div>
                  ))}
                  {(!fallbackUsage?.data || fallbackUsage.data.length === 0) && (
                    <p className="text-zinc-500">No fallback usage data</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Feed Requests */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg">Feed Requests (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Total Requests</span>
                    <span className="text-xl font-bold">{overview?.feed_requests_30d?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Fallback Used</span>
                    <span className="text-xl font-bold text-amber-400">{overview?.fallback_usage_30d?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Fallback Rate</span>
                    <span className="text-xl font-bold">{overview?.fallback_rate || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Content Availability Gaps
              </CardTitle>
              <CardDescription>
                Countries with users but no tagged content
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contentGaps?.gaps?.length > 0 ? (
                <div className="space-y-3">
                  {contentGaps.gaps.map((gap, idx) => (
                    <div 
                      key={gap.country_code}
                      className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 w-6">{idx + 1}.</span>
                        <div>
                          <span className="font-medium">{COUNTRY_NAMES[gap.country_code] || gap.country_code}</span>
                          <span className="text-zinc-400 ml-2">({gap.country_code})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-amber-400 font-bold">{gap.user_count}</span>
                          <span className="text-zinc-400 ml-1">users</span>
                        </div>
                        <Badge variant="destructive" className="bg-rose-500/20 text-rose-300">
                          No Content
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Check className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
                  <p className="text-zinc-400">All countries with users have content!</p>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-zinc-700 flex justify-between text-sm text-zinc-400">
                <span>Countries with Users: {contentGaps?.countries_with_users || 0}</span>
                <span>Countries with Content: {contentGaps?.countries_with_content || 0}</span>
                <span>Gap Countries: {contentGaps?.total_gap_countries || 0}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Country Edit Modal */}
      <Dialog open={isCountryModalOpen} onOpenChange={setIsCountryModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-violet-400" />
              Edit Country Tags
            </DialogTitle>
            <DialogDescription>
              {editingAlbum?.title} - {editingAlbum?.artist_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Default Fallback Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div>
                <p className="font-medium">Default Fallback</p>
                <p className="text-sm text-zinc-400">Show this content when no country-specific content exists</p>
              </div>
              <Checkbox
                checked={editingAlbum?.is_default_fallback || false}
                onCheckedChange={(checked) => setEditingAlbum(prev => ({
                  ...prev,
                  is_default_fallback: checked
                }))}
              />
            </div>

            {/* Country Selection */}
            <div>
              <p className="text-sm font-medium mb-3">Select Countries</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 bg-zinc-800/50 rounded-lg">
                {countries.map(country => (
                  <div
                    key={country.code}
                    onClick={() => toggleCountrySelection(country.code)}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      selectedCountries.includes(country.code)
                        ? 'bg-violet-500/20 border border-violet-500/30'
                        : 'hover:bg-zinc-700/50'
                    }`}
                  >
                    {selectedCountries.includes(country.code) ? (
                      <CheckSquare className="w-4 h-4 text-violet-400" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-500" />
                    )}
                    <span className="text-sm truncate">{country.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-sm text-zinc-400">
              Selected: {selectedCountries.length} countries
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCountryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSetCountries(
                editingAlbum?.album_id,
                selectedCountries,
                editingAlbum?.is_default_fallback
              )}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Modal */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-violet-400" />
              Bulk Country Update
            </DialogTitle>
            <DialogDescription>
              Update country tags for {selectedAlbums.length} selected albums
            </DialogDescription>
          </DialogHeader>

          {selectedAlbums.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-3" />
              <p className="text-zinc-400">Select albums from the Content Tagging tab first</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Country Selection */}
              <div>
                <p className="text-sm font-medium mb-3">Select Countries to Apply</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-zinc-800/50 rounded-lg">
                  {countries.slice(0, 30).map(country => (
                    <div
                      key={country.code}
                      onClick={() => toggleCountrySelection(country.code)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedCountries.includes(country.code)
                          ? 'bg-violet-500/20 border border-violet-500/30'
                          : 'hover:bg-zinc-700/50'
                      }`}
                    >
                      {selectedCountries.includes(country.code) ? (
                        <CheckSquare className="w-4 h-4 text-violet-400" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-500" />
                      )}
                      <span className="text-sm truncate">{country.name}</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-zinc-400 mt-2">
                  Selected: {selectedCountries.length} countries
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleBulkUpdate("clear")}
              disabled={selectedAlbums.length === 0}
            >
              Clear All Countries
            </Button>
            <Button
              variant="outline"
              onClick={() => handleBulkUpdate("add")}
              disabled={selectedAlbums.length === 0 || selectedCountries.length === 0}
            >
              Add Countries
            </Button>
            <Button
              onClick={() => handleBulkUpdate("replace")}
              disabled={selectedAlbums.length === 0 || selectedCountries.length === 0}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Replace Countries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
