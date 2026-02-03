/**
 * DownloadContext - Robust download management with comprehensive error handling
 * Features:
 * - Download single songs or entire albums
 * - Real-time download progress tracking
 * - Offline playback support
 * - Download queue management
 * - Proper URL handling for different audio sources
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAudioUrl, contentAPI, API_BASE_URL } from '../services/api';

const DownloadContext = createContext();

const DOWNLOADS_KEY = '@gracefy_downloads_v3';
const DOWNLOAD_QUEUE_KEY = '@gracefy_download_queue_v2';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads/`;

// Download states
export const DOWNLOAD_STATUS = {
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused',
};

export const DownloadProvider = ({ children }) => {
  // Downloaded songs (completed)
  const [downloads, setDownloads] = useState([]);
  const [downloadedSongIds, setDownloadedSongIds] = useState(new Set());
  
  // Active downloads with progress
  const [activeDownloads, setActiveDownloads] = useState({}); // { songId: { progress: 0-100, status, song } }
  const [downloadQueue, setDownloadQueue] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const downloadTasksRef = useRef({});
  const isProcessingQueue = useRef(false);

  // Initialize
  useEffect(() => {
    initializeDownloads();
    return () => {
      // Cleanup active downloads on unmount
      Object.values(downloadTasksRef.current).forEach(task => {
        if (task?.cancelAsync) {
          task.cancelAsync();
        }
      });
    };
  }, []);

  // Process queue when it changes
  useEffect(() => {
    processDownloadQueue();
  }, [downloadQueue]);

  const initializeDownloads = async () => {
    console.log('[Downloads] Initializing...');
    try {
      setLoading(true);
      
      // Ensure download directory exists
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
        console.log('[Downloads] Created download directory');
      }

      // Load saved downloads
      const savedDownloads = await AsyncStorage.getItem(DOWNLOADS_KEY);
      let downloadsList = savedDownloads ? JSON.parse(savedDownloads) : [];
      
      // Verify each file still exists
      const verifiedDownloads = [];
      for (const song of downloadsList) {
        if (song.localPath) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(song.localPath);
            if (fileInfo.exists && fileInfo.size > 10000) { // At least 10KB
              verifiedDownloads.push(song);
            } else {
              console.log('[Downloads] File missing or too small:', song.song_id);
            }
          } catch (e) {
            console.log('[Downloads] File verification failed:', song.song_id);
          }
        }
      }
      
      setDownloads(verifiedDownloads);
      setDownloadedSongIds(new Set(verifiedDownloads.map(s => s.song_id)));
      console.log('[Downloads] Loaded', verifiedDownloads.length, 'downloads');
      
      // Save verified list back
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(verifiedDownloads));

      // Load any pending queue items
      const savedQueue = await AsyncStorage.getItem(DOWNLOAD_QUEUE_KEY);
      if (savedQueue) {
        const queueItems = JSON.parse(savedQueue);
        setDownloadQueue(queueItems);
      }
    } catch (error) {
      console.error('[Downloads] Error initializing:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if a song is downloaded
  const isDownloaded = useCallback((songId) => {
    return downloadedSongIds.has(songId);
  }, [downloadedSongIds]);

  // Get download progress for a song (0-100 or null if not downloading)
  const getDownloadProgress = useCallback((songId) => {
    const activeDownload = activeDownloads[songId];
    if (activeDownload) {
      return activeDownload.progress;
    }
    return null;
  }, [activeDownloads]);

  // Get download status
  const getDownloadStatus = useCallback((songId) => {
    if (downloadedSongIds.has(songId)) {
      return DOWNLOAD_STATUS.COMPLETED;
    }
    const activeDownload = activeDownloads[songId];
    if (activeDownload) {
      return activeDownload.status;
    }
    const inQueue = downloadQueue.find(s => s.song_id === songId);
    if (inQueue) {
      return DOWNLOAD_STATUS.QUEUED;
    }
    return null;
  }, [downloadedSongIds, activeDownloads, downloadQueue]);

  // Get local path for a downloaded song
  const getLocalPath = useCallback((songId) => {
    const song = downloads.find(s => s.song_id === songId);
    return song?.localPath || null;
  }, [downloads]);

  // Add song to download queue
  const queueDownload = useCallback(async (song) => {
    if (!song?.song_id) {
      console.error('[Downloads] queueDownload: No song_id');
      return { success: false, message: 'Invalid song' };
    }
    
    // Check if song has audio URL
    const audioUrl = song.audio_url;
    if (!audioUrl || audioUrl.trim() === '') {
      console.error('[Downloads] No audio URL for song:', song.song_id);
      return { success: false, message: 'Wimbo huu hauna faili ya sauti' };
    }
    
    // Skip if already downloaded or in queue
    if (downloadedSongIds.has(song.song_id)) {
      console.log('[Downloads] Already downloaded:', song.song_id);
      return { success: true, message: 'Already downloaded' };
    }
    
    if (downloadQueue.find(s => s.song_id === song.song_id)) {
      console.log('[Downloads] Already in queue:', song.song_id);
      return { success: true, message: 'Already in queue' };
    }

    if (activeDownloads[song.song_id]) {
      console.log('[Downloads] Download in progress:', song.song_id);
      return { success: true, message: 'Download in progress' };
    }

    console.log('[Downloads] Adding to queue:', song.title, song.song_id, 'URL:', audioUrl);
    const newQueue = [...downloadQueue, song];
    setDownloadQueue(newQueue);
    await AsyncStorage.setItem(DOWNLOAD_QUEUE_KEY, JSON.stringify(newQueue));
    
    return { success: true, message: 'Added to download queue' };
  }, [downloadQueue, downloadedSongIds, activeDownloads]);

  // Download multiple songs (album)
  const queueAlbumDownload = useCallback(async (songs) => {
    if (!songs?.length) return { success: false, message: 'No songs to download' };
    
    const newSongs = songs.filter(song => 
      song?.song_id && 
      !downloadedSongIds.has(song.song_id) && 
      !downloadQueue.find(s => s.song_id === song.song_id) &&
      !activeDownloads[song.song_id]
    );

    if (newSongs.length === 0) {
      return { success: true, message: 'All songs already downloaded or queued' };
    }

    console.log('[Downloads] Adding', newSongs.length, 'songs to queue');
    const newQueue = [...downloadQueue, ...newSongs];
    setDownloadQueue(newQueue);
    await AsyncStorage.setItem(DOWNLOAD_QUEUE_KEY, JSON.stringify(newQueue));
    
    return { success: true, message: `${newSongs.length} songs added to queue` };
  }, [downloadQueue, downloadedSongIds, activeDownloads]);

  // Process download queue
  const processDownloadQueue = useCallback(async () => {
    if (isProcessingQueue.current || downloadQueue.length === 0) return;
    
    // Check how many active downloads we have
    const activeCount = Object.keys(activeDownloads).length;
    if (activeCount >= 2) return; // Max 2 concurrent downloads
    
    isProcessingQueue.current = true;
    
    const song = downloadQueue[0];
    if (!song) {
      isProcessingQueue.current = false;
      return;
    }

    // Remove from queue
    const remainingQueue = downloadQueue.slice(1);
    setDownloadQueue(remainingQueue);
    await AsyncStorage.setItem(DOWNLOAD_QUEUE_KEY, JSON.stringify(remainingQueue));
    
    // Start download
    await startDownload(song);
    
    isProcessingQueue.current = false;
  }, [downloadQueue, activeDownloads]);

  // Build the correct download URL
  const buildDownloadUrl = (downloadPath, directUrl) => {
    // Get the base URL without /api
    const baseUrl = API_BASE_URL.replace('/api', '');
    
    console.log('[Downloads] Building URL from:', { downloadPath, directUrl, baseUrl });
    
    // If downloadPath is a relative API path
    if (downloadPath && downloadPath.startsWith('/api/')) {
      const fullUrl = `${baseUrl}${downloadPath}`;
      console.log('[Downloads] Using API path:', fullUrl);
      return fullUrl;
    }
    
    // If downloadPath is already a full URL
    if (downloadPath && downloadPath.startsWith('http')) {
      console.log('[Downloads] Using full URL:', downloadPath);
      return downloadPath;
    }
    
    // Use directUrl if it's an internal file stream
    if (directUrl && directUrl.startsWith('/api/files/')) {
      const fullUrl = `${baseUrl}${directUrl}`;
      console.log('[Downloads] Using direct file URL:', fullUrl);
      return fullUrl;
    }
    
    // If directUrl is a full URL (CDN), use streaming proxy
    if (directUrl && directUrl.startsWith('http')) {
      // CDN URLs often fail, but try them anyway
      console.log('[Downloads] Using CDN URL:', directUrl);
      return directUrl;
    }
    
    return null;
  };

  // Start actual download
  const startDownload = async (song) => {
    const songId = song.song_id;
    console.log('[Downloads] Starting download for:', song.title, songId);
    
    // Check audio URL first
    const songAudioUrl = song.audio_url;
    if (!songAudioUrl || songAudioUrl.trim() === '') {
      console.error('[Downloads] No audio URL for:', songId);
      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { 
          progress: 0, 
          status: DOWNLOAD_STATUS.FAILED, 
          song,
          error: 'No audio file available' 
        }
      }));
      setTimeout(() => {
        setActiveDownloads(prev => {
          const updated = { ...prev };
          delete updated[songId];
          return updated;
        });
      }, 3000);
      return false;
    }
    
    try {
      // Set initial status
      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { progress: 0, status: DOWNLOAD_STATUS.DOWNLOADING, song }
      }));

      // Build the download URL
      let fileUrl = null;
      let fileName = `${song.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'song'}_${songId}.mp3`;

      // First try to get download URL from API
      try {
        console.log('[Downloads] Fetching download URL from API...');
        const response = await contentAPI.getSongDownloadUrl(songId);
        console.log('[Downloads] API response:', response?.data);
        
        if (response.data) {
          fileUrl = buildDownloadUrl(response.data.download_url, response.data.direct_url);
          
          if (response.data.filename) {
            fileName = response.data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          }
        }
      } catch (e) {
        console.error('[Downloads] Failed to get download URL from API:', e.response?.data || e.message);
      }

      // Fallback: Use song's audio_url directly
      if (!fileUrl && songAudioUrl) {
        console.log('[Downloads] Using song.audio_url:', songAudioUrl);
        fileUrl = buildDownloadUrl(null, songAudioUrl);
      }

      if (!fileUrl) {
        throw new Error('Could not determine download URL');
      }

      console.log('[Downloads] Final download URL:', fileUrl);
      const downloadPath = `${DOWNLOAD_DIR}${fileName}`;

      // Create download resumable for progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        fileUrl,
        downloadPath,
        { 
          headers: { 
            'Accept': 'audio/mpeg, audio/*, */*',
            'User-Agent': 'Gracefy-App/1.0'
          } 
        },
        (downloadProgress) => {
          const progress = Math.round(
            (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
          );
          const safeProgress = isNaN(progress) || !isFinite(progress) ? 0 : Math.min(progress, 100);
          setActiveDownloads(prev => ({
            ...prev,
            [songId]: { 
              ...prev[songId], 
              progress: safeProgress
            }
          }));
        }
      );

      // Store reference for cancellation
      downloadTasksRef.current[songId] = downloadResumable;

      // Start download
      console.log('[Downloads] Starting file download...');
      const result = await downloadResumable.downloadAsync();
      
      // Clean up task reference
      delete downloadTasksRef.current[songId];

      console.log('[Downloads] Download result:', result);

      if (result?.uri) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        console.log('[Downloads] File info:', fileInfo);
        
        // Check if the downloaded file is valid (not an error page)
        if (fileInfo.exists && fileInfo.size > 50000) { // At least 50KB for a real audio file
          // Success! Add to completed downloads
          const downloadedSong = {
            ...song,
            localPath: result.uri,
            fileSize: fileInfo.size,
            downloadedAt: new Date().toISOString(),
          };

          const newDownloads = [downloadedSong, ...downloads];
          setDownloads(newDownloads);
          setDownloadedSongIds(new Set(newDownloads.map(s => s.song_id)));
          await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(newDownloads));

          // Remove from active
          setActiveDownloads(prev => {
            const updated = { ...prev };
            delete updated[songId];
            return updated;
          });

          console.log('[Downloads] SUCCESS:', song.title, '- Size:', fileInfo.size, 'bytes');
          return true;
        } else {
          // File too small - likely an error page or failed download
          console.error('[Downloads] File too small:', fileInfo.size, 'bytes');
          
          // Try to read the file to see if it's an error
          try {
            const content = await FileSystem.readAsStringAsync(result.uri, { length: 500 });
            console.log('[Downloads] File content preview:', content.substring(0, 200));
            
            // Check if it's an HTML error page
            if (content.includes('<!DOCTYPE') || content.includes('<html') || content.includes('403') || content.includes('Forbidden')) {
              throw new Error('Server imezuia kupakua faili hii');
            }
          } catch (readError) {
            if (readError.message.includes('imezuia')) {
              throw readError;
            }
          }
          
          // Delete the invalid file
          try {
            await FileSystem.deleteAsync(result.uri);
          } catch (e) {}
          
          throw new Error(`Faili ni ndogo sana (${fileInfo.size} bytes)`);
        }
      } else {
        throw new Error('Download haikurudisha faili');
      }
    } catch (error) {
      console.error('[Downloads] FAILED:', song.title, '-', error.message);
      
      // Mark as failed with user-friendly message
      let userMessage = error.message;
      if (error.message.includes('Network') || error.message.includes('timeout')) {
        userMessage = 'Tatizo la mtandao';
      } else if (error.message.includes('403') || error.message.includes('Forbidden') || error.message.includes('imezuia')) {
        userMessage = 'Faili haiwezi kupakuliwa';
      }
      
      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { 
          ...prev[songId], 
          status: DOWNLOAD_STATUS.FAILED, 
          error: userMessage 
        }
      }));

      // Remove from active after delay
      setTimeout(() => {
        setActiveDownloads(prev => {
          const updated = { ...prev };
          delete updated[songId];
          return updated;
        });
      }, 5000);
      
      return false;
    }
  };

  // Cancel a download
  const cancelDownload = useCallback(async (songId) => {
    console.log('[Downloads] Canceling:', songId);
    
    // Cancel if actively downloading
    const task = downloadTasksRef.current[songId];
    if (task?.cancelAsync) {
      try {
        await task.cancelAsync();
      } catch (e) {
        console.log('[Downloads] Cancel error:', e);
      }
      delete downloadTasksRef.current[songId];
    }

    // Remove from active downloads
    setActiveDownloads(prev => {
      const updated = { ...prev };
      delete updated[songId];
      return updated;
    });

    // Remove from queue if present
    const newQueue = downloadQueue.filter(s => s.song_id !== songId);
    if (newQueue.length !== downloadQueue.length) {
      setDownloadQueue(newQueue);
      await AsyncStorage.setItem(DOWNLOAD_QUEUE_KEY, JSON.stringify(newQueue));
    }

    return true;
  }, [downloadQueue]);

  // Remove a completed download
  const removeDownload = useCallback(async (songId) => {
    console.log('[Downloads] Removing:', songId);
    const song = downloads.find(s => s.song_id === songId);
    
    // Delete the file
    if (song?.localPath) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(song.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(song.localPath);
          console.log('[Downloads] File deleted');
        }
      } catch (e) {
        console.log('[Downloads] Could not delete file:', e);
      }
    }
    
    const newDownloads = downloads.filter(s => s.song_id !== songId);
    setDownloads(newDownloads);
    setDownloadedSongIds(new Set(newDownloads.map(s => s.song_id)));
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(newDownloads));
    
    return true;
  }, [downloads]);

  // Clear all downloads
  const clearAllDownloads = useCallback(async () => {
    console.log('[Downloads] Clearing all...');
    
    // Cancel all active downloads
    for (const songId of Object.keys(downloadTasksRef.current)) {
      const task = downloadTasksRef.current[songId];
      if (task?.cancelAsync) {
        try {
          await task.cancelAsync();
        } catch (e) {}
      }
    }
    downloadTasksRef.current = {};

    // Delete all files
    for (const song of downloads) {
      if (song.localPath) {
        try {
          await FileSystem.deleteAsync(song.localPath);
        } catch (e) {}
      }
    }

    setDownloads([]);
    setDownloadedSongIds(new Set());
    setActiveDownloads({});
    setDownloadQueue([]);
    
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify([]));
    await AsyncStorage.setItem(DOWNLOAD_QUEUE_KEY, JSON.stringify([]));
    
    return true;
  }, [downloads]);

  // Get total download size
  const getTotalSize = useCallback(() => {
    return downloads.reduce((total, song) => total + (song.fileSize || 0), 0);
  }, [downloads]);

  // Format bytes to readable string
  const formatSize = useCallback((bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, []);

  const value = {
    // State
    downloads,
    downloadedSongIds,
    activeDownloads,
    downloadQueue,
    loading,
    
    // Status checks
    isDownloaded,
    getDownloadProgress,
    getDownloadStatus,
    getLocalPath,
    
    // Actions
    queueDownload,
    queueAlbumDownload,
    cancelDownload,
    removeDownload,
    clearAllDownloads,
    
    // Utils
    getTotalSize,
    formatSize,
    refreshDownloads: initializeDownloads,
    
    // Constants
    DOWNLOAD_STATUS,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloads = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    console.warn('[Downloads] useDownloads called outside DownloadProvider');
    return {
      downloads: [],
      downloadedSongIds: new Set(),
      activeDownloads: {},
      downloadQueue: [],
      loading: false,
      isDownloaded: () => false,
      getDownloadProgress: () => null,
      getDownloadStatus: () => null,
      getLocalPath: () => null,
      queueDownload: async () => ({ success: false }),
      queueAlbumDownload: async () => ({ success: false }),
      cancelDownload: async () => false,
      removeDownload: async () => false,
      clearAllDownloads: async () => false,
      getTotalSize: () => 0,
      formatSize: () => '0 B',
      refreshDownloads: async () => {},
      DOWNLOAD_STATUS: {},
    };
  }
  return context;
};

export default DownloadContext;
