import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import { 
  Sparkles, Settings, Tag, RefreshCw, Trash2, Plus,
  Music, TrendingUp, Clock, Users, Shuffle, Star,
  Zap, Target, BarChart3, Check
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

const RecommendationEnginePage = () => {
  const [activeTab, setActiveTab] = useState('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    enabled: true,
    primary_criteria: 'similar_genre',
    secondary_criteria: 'popularity',
    tertiary_criteria: 'recent',
    weights: {
      genre_match: 40,
      artist_match: 20,
      popularity: 25,
      recency: 15
    },
    include_from_same_album: true,
    include_from_same_artist: true,
    include_trending: true,
    exclude_recently_played: true,
    recently_played_hours: 2,
    recommendation_pool_size: 50,
    shuffle_recommendations: false,
    prefer_premium_content: false,
    boost_new_releases_days: 14,
    min_plays_for_trending: 10
  });
  
  const [tags, setTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6B7280');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, tagsRes] = await Promise.all([
        axios.get(`${API}/admin/recommendation-settings`, { withCredentials: true }),
        axios.get(`${API}/admin/tags`, { withCredentials: true })
      ]);
      
      if (settingsRes.data) {
        setSettings(prev => ({ ...prev, ...settingsRes.data }));
      }
      setTags(tagsRes.data?.tags || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/admin/recommendation-settings`, settings, { withCredentials: true });
      toast.success('Recommendation settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Please enter a tag name');
      return;
    }
    
    try {
      const response = await axios.post(`${API}/admin/tags`, {
        name: newTagName,
        color: newTagColor
      }, { withCredentials: true });
      
      setTags(prev => [...prev, response.data]);
      setNewTagName('');
      setNewTagColor('#6B7280');
      toast.success('Tag created successfully');
    } catch (error) {
      toast.error('Failed to create tag');
    }
  };

  const deleteTag = async (tagId) => {
    if (!window.confirm('Are you sure you want to delete this tag?')) return;
    
    try {
      await axios.delete(`${API}/admin/tags/${tagId}`, { withCredentials: true });
      setTags(prev => prev.filter(t => t.tag_id !== tagId));
      toast.success('Tag deleted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete tag');
    }
  };

  const criteriaOptions = [
    { value: 'similar_genre', label: 'Similar Genre/Category', icon: Tag },
    { value: 'same_artist', label: 'Same Artist/Choir', icon: Users },
    { value: 'popularity', label: 'Popularity (Most Played)', icon: TrendingUp },
    { value: 'recent', label: 'Recently Added', icon: Clock },
    { value: 'random', label: 'Random', icon: Shuffle },
  ];

  const colorOptions = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', 
    '#6366F1', '#8B5CF6', '#EC4899', '#6B7280', '#1F2937'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-violet-500" />
            Recommendation Engine
          </h1>
          <p className="text-zinc-400 mt-1">Configure how songs are recommended to users</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={saveSettings} className="bg-violet-600 hover:bg-violet-700 gap-2" disabled={saving}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Main Status Card */}
      <Card className="bg-gradient-to-r from-violet-900/50 to-indigo-900/50 border-violet-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${settings.enabled ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <Zap className={`w-6 h-6 ${settings.enabled ? 'text-green-400' : 'text-red-400'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Recommendation Engine Status</h3>
                <p className="text-zinc-400">
                  {settings.enabled 
                    ? 'Engine is active and recommending content based on your criteria'
                    : 'Engine is disabled - users will see random content'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">Disabled</span>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
              />
              <span className="text-zinc-400 text-sm">Enabled</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="settings">Recommendation Criteria</TabsTrigger>
          <TabsTrigger value="weights">Score Weights</TabsTrigger>
          <TabsTrigger value="tags">Content Tags</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Criteria */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-500" />
                  Primary Criteria
                </CardTitle>
                <CardDescription>Main factor for recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {criteriaOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSettings(prev => ({ ...prev, primary_criteria: option.value }))}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      settings.primary_criteria === option.value 
                        ? 'bg-violet-600 text-white' 
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Secondary Criteria */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Secondary Criteria
                </CardTitle>
                <CardDescription>Fallback when primary doesn't match</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {criteriaOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSettings(prev => ({ ...prev, secondary_criteria: option.value }))}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      settings.secondary_criteria === option.value 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Tertiary Criteria */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Tertiary Criteria
                </CardTitle>
                <CardDescription>Third level of matching</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {criteriaOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSettings(prev => ({ ...prev, tertiary_criteria: option.value }))}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      settings.tertiary_criteria === option.value 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <option.icon className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Options */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">Content Sources</CardTitle>
              <CardDescription>Enable or disable recommendation sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Same Album</p>
                    <p className="text-zinc-400 text-sm">Include songs from current album</p>
                  </div>
                  <Switch
                    checked={settings.include_from_same_album}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, include_from_same_album: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Same Artist</p>
                    <p className="text-zinc-400 text-sm">Include songs from same artist</p>
                  </div>
                  <Switch
                    checked={settings.include_from_same_artist}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, include_from_same_artist: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Trending</p>
                    <p className="text-zinc-400 text-sm">Include trending songs</p>
                  </div>
                  <Switch
                    checked={settings.include_trending}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, include_trending: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Shuffle Results</p>
                    <p className="text-zinc-400 text-sm">Randomize recommendation order</p>
                  </div>
                  <Switch
                    checked={settings.shuffle_recommendations}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, shuffle_recommendations: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weights Tab */}
        <TabsContent value="weights" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">Score Weights</CardTitle>
              <CardDescription>Adjust how much each factor contributes to the recommendation score (total should be 100)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-zinc-300 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-violet-500" />
                      Genre/Category Match
                    </label>
                    <span className="text-violet-400 font-semibold">{settings.weights.genre_match}%</span>
                  </div>
                  <Slider
                    value={[settings.weights.genre_match]}
                    onValueChange={([value]) => setSettings(prev => ({
                      ...prev,
                      weights: { ...prev.weights, genre_match: value }
                    }))}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-zinc-300 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      Artist/Choir Match
                    </label>
                    <span className="text-blue-400 font-semibold">{settings.weights.artist_match}%</span>
                  </div>
                  <Slider
                    value={[settings.weights.artist_match]}
                    onValueChange={([value]) => setSettings(prev => ({
                      ...prev,
                      weights: { ...prev.weights, artist_match: value }
                    }))}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-zinc-300 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      Popularity Score
                    </label>
                    <span className="text-green-400 font-semibold">{settings.weights.popularity}%</span>
                  </div>
                  <Slider
                    value={[settings.weights.popularity]}
                    onValueChange={([value]) => setSettings(prev => ({
                      ...prev,
                      weights: { ...prev.weights, popularity: value }
                    }))}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-zinc-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      Recency Bonus
                    </label>
                    <span className="text-yellow-400 font-semibold">{settings.weights.recency}%</span>
                  </div>
                  <Slider
                    value={[settings.weights.recency]}
                    onValueChange={([value]) => setSettings(prev => ({
                      ...prev,
                      weights: { ...prev.weights, recency: value }
                    }))}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Total Weight</span>
                  <span className={`font-bold ${
                    Object.values(settings.weights).reduce((a, b) => a + b, 0) === 100 
                      ? 'text-green-400' 
                      : 'text-red-400'
                  }`}>
                    {Object.values(settings.weights).reduce((a, b) => a + b, 0)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-violet-500" />
                Content Tags
              </CardTitle>
              <CardDescription>Manage tags that can be applied to albums and songs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Create New Tag */}
              <div className="p-4 bg-zinc-800 rounded-lg space-y-4">
                <h4 className="text-white font-medium">Create New Tag</h4>
                <div className="flex gap-4">
                  <Input
                    placeholder="Tag name (e.g., Mpya, Trending)"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="flex-1 bg-zinc-900 border-zinc-700"
                  />
                  <div className="flex gap-1">
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          newTagColor === color ? 'scale-110 ring-2 ring-white' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Button onClick={createTag} className="bg-violet-600 hover:bg-violet-700 gap-2">
                    <Plus className="w-4 h-4" />
                    Add Tag
                  </Button>
                </div>
              </div>
              
              {/* Existing Tags */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {tags.map(tag => (
                  <div 
                    key={tag.tag_id} 
                    className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-white">{tag.name}</span>
                      {tag.is_system && (
                        <Badge variant="outline" className="text-xs">System</Badge>
                      )}
                    </div>
                    {!tag.is_system && (
                      <button
                        onClick={() => deleteTag(tag.tag_id)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-white">Advanced Settings</CardTitle>
              <CardDescription>Fine-tune recommendation behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">Recommendation Pool Size</label>
                  <Input
                    type="number"
                    value={settings.recommendation_pool_size}
                    onChange={(e) => setSettings(prev => ({ ...prev, recommendation_pool_size: parseInt(e.target.value) || 50 }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Number of songs to consider before ranking</p>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">Min Plays for Trending</label>
                  <Input
                    type="number"
                    value={settings.min_plays_for_trending}
                    onChange={(e) => setSettings(prev => ({ ...prev, min_plays_for_trending: parseInt(e.target.value) || 10 }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Minimum plays to be considered trending</p>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">New Release Boost (Days)</label>
                  <Input
                    type="number"
                    value={settings.boost_new_releases_days}
                    onChange={(e) => setSettings(prev => ({ ...prev, boost_new_releases_days: parseInt(e.target.value) || 14 }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Days to boost new releases in recommendations</p>
                </div>
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">Recently Played Exclusion (Hours)</label>
                  <Input
                    type="number"
                    value={settings.recently_played_hours}
                    onChange={(e) => setSettings(prev => ({ ...prev, recently_played_hours: parseInt(e.target.value) || 2 }))}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 mt-1">Exclude songs played within this time</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                <div>
                  <p className="text-white font-medium">Exclude Recently Played</p>
                  <p className="text-zinc-400 text-sm">Don't recommend songs user just played</p>
                </div>
                <Switch
                  checked={settings.exclude_recently_played}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, exclude_recently_played: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                <div>
                  <p className="text-white font-medium">Prefer Premium Content</p>
                  <p className="text-zinc-400 text-sm">Prioritize premium content for subscribers</p>
                </div>
                <Switch
                  checked={settings.prefer_premium_content}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, prefer_premium_content: checked }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecommendationEnginePage;
