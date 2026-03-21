/**
 * HLS Transcoding Status Page
 * Admin page to monitor and control HLS adaptive streaming transcoding
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, Pause, RefreshCw, AlertCircle, CheckCircle2, Clock, 
  Music, Loader2, BarChart3, Server
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const HLSTranscodingPage = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/admin/hls/status`);
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch HLS status:', error);
      toast.error('Failed to fetch transcoding status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStartTranscoding = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/admin/hls/start`);
      toast.success('Batch transcoding started!');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to start transcoding');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopTranscoding = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/admin/hls/stop`);
      toast.success('Transcoding will stop after current song');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to stop transcoding');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/api/admin/hls/retry-failed`);
      toast.success(response.data.message);
      fetchStatus();
    } catch (error) {
      toast.error('Failed to retry failed jobs');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTranscodeSingle = async (songId) => {
    try {
      await axios.post(`${API}/api/admin/hls/transcode/${songId}`);
      toast.success('Transcoding started for song');
      fetchStatus();
    } catch (error) {
      toast.error('Failed to start transcoding');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const stats = status?.statistics || {};
  const isRunning = status?.batch_transcoding_running;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">HLS Adaptive Streaming</h1>
          <p className="text-zinc-400 mt-1">
            Convert songs to HLS format for adaptive quality streaming
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchStatus}
          className="border-zinc-700"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Songs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.total_songs || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">{stats.completed || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">{stats.pending || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{stats.failed || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-500" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">
                {stats.completed || 0} of {stats.total_songs || 0} songs transcoded
              </span>
              <span className="text-white font-medium">{stats.progress_percent || 0}%</span>
            </div>
            <Progress value={stats.progress_percent || 0} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-violet-500" />
            Batch Transcoding Control
          </CardTitle>
          <CardDescription>
            {isRunning ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Running
              </Badge>
            ) : (
              <Badge className="bg-zinc-700 text-zinc-400">Stopped</Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {!isRunning ? (
            <Button
              onClick={handleStartTranscoding}
              disabled={actionLoading || stats.pending === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Start Batch Transcoding
            </Button>
          ) : (
            <Button
              onClick={handleStopTranscoding}
              disabled={actionLoading}
              variant="destructive"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Pause className="w-4 h-4 mr-2" />
              )}
              Stop Transcoding
            </Button>
          )}
          
          {stats.failed > 0 && (
            <Button
              onClick={handleRetryFailed}
              disabled={actionLoading}
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry {stats.failed} Failed
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Currently Processing */}
      {status?.currently_processing?.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
              Currently Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.currently_processing.map((song) => (
                <div
                  key={song.song_id}
                  className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Music className="w-4 h-4 text-violet-400" />
                    <span className="text-white">{song.title}</span>
                  </div>
                  <Badge className="bg-violet-500/20 text-violet-400">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Processing
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Completed */}
      {status?.recent_completed?.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Recently Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.recent_completed.map((song) => (
                <div
                  key={song.song_id}
                  className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Music className="w-4 h-4 text-emerald-400" />
                    <span className="text-white">{song.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-sm">
                      {song.hls_duration_seconds ? `${Math.round(song.hls_duration_seconds)}s` : ''}
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Done
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Jobs */}
      {status?.recent_failed?.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Failed Transcoding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {status.recent_failed.map((song) => (
                <div
                  key={song.song_id}
                  className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <Music className="w-4 h-4 text-red-400" />
                      <span className="text-white">{song.title}</span>
                    </div>
                    {song.hls_error && (
                      <p className="text-red-400 text-xs mt-1 ml-7 truncate max-w-md">
                        {song.hls_error}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTranscodeSingle(song.song_id)}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Music className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h4 className="font-medium text-white">About HLS Adaptive Streaming</h4>
              <p className="text-zinc-400 text-sm mt-1">
                HLS (HTTP Live Streaming) automatically adjusts audio quality based on the user's network speed.
                Each song is transcoded into 3 quality levels: 96kbps (low), 192kbps (medium), and 320kbps (high).
                Users on slow connections will hear lower quality audio without buffering, while users on fast
                connections get high-quality audio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HLSTranscodingPage;
