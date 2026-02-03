/**
 * DownloadContext - Spotify-like download management
 * Features:
 * - Download single songs or entire albums
 * - Real-time download progress tracking
 * - Offline playback support
 * - Download queue management
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAudioUrl, contentAPI } from '../services/api';

const DownloadContext = createContext();

const DOWNLOADS_KEY = '@gracefy_downloads_v2';
const DOWNLOAD_QUEUE_KEY = '@gracefy_download_queue';
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
    try {
      setLoading(true);
      
      // Ensure download directory exists
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
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
            }
          } catch (e) {
            console.log('File verification failed:', song.song_id);
          }
        }
      }
      
      setDownloads(verifiedDownloads);
      setDownloadedSongIds(new Set(verifiedDownloads.map(s => s.song_id)));
      
      // Save verified list back
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(verifiedDownloads));

      // Load any pending queue items
      const savedQueue = await AsyncStorage.getItem(DOWNLOAD_QUEUE_KEY);
      if (savedQueue) {
        const queueItems = JSON.parse(savedQueue);
        setDownloadQueue(queueItems);
      }
    } catch (error) {
      console.error('Error initializing downloads:', error);
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
    if (!song?.song_id) return false;
    
    // Skip if already downloaded or in queue
    if (downloadedSongIds.has(song.song_id)) {
      return { success: true, message: 'Already downloaded' };
    }
    
    if (downloadQueue.find(s => s.song_id === song.song_id)) {
      return { success: true, message: 'Already in queue' };
    }

    if (activeDownloads[song.song_id]) {
      return { success: true, message: 'Download in progress' };
    }

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

  // Start actual download
  const startDownload = async (song) => {
    const songId = song.song_id;
    
    try {
      // Set initial status
      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { progress: 0, status: DOWNLOAD_STATUS.DOWNLOADING, song }
      }));

      // Get download URL
      let fileUrl = null;
      let fileName = `${song.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'song'}_${songId}.mp3`;

      try {
        const response = await contentAPI.getSongDownloadUrl(songId);
        if (response.data?.download_url) {
          fileUrl = getAudioUrl(response.data.download_url);
          if (response.data.filename) {
            fileName = response.data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
          }
        }
      } catch (e) {
        console.log('Could not get download URL from API, using audio_url');
      }

      // Fallback to song's audio_url
      if (!fileUrl) {
        fileUrl = song?.audio_url || song?.file_url;
        if (!fileUrl) {
          throw new Error('No audio URL available');
        }
        fileUrl = getAudioUrl(fileUrl);
      }

      const downloadPath = `${DOWNLOAD_DIR}${fileName}`;

      // Create download resumable for progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        fileUrl,
        downloadPath,
        { headers: { 'Accept': 'audio/mpeg, audio/*, */*' } },
        (downloadProgress) => {
          const progress = Math.round(
            (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
          );
          setActiveDownloads(prev => ({
            ...prev,
            [songId]: { 
              ...prev[songId], 
              progress: isNaN(progress) ? 0 : progress 
            }
          }));
        }
      );

      // Store reference for cancellation
      downloadTasksRef.current[songId] = downloadResumable;

      // Start download
      const result = await downloadResumable.downloadAsync();
      
      // Clean up task reference
      delete downloadTasksRef.current[songId];

      if (result?.uri) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        if (fileInfo.exists && fileInfo.size > 10000) {
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

          return true;
        } else {
          throw new Error('Downloaded file is too small or corrupt');
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      
      // Mark as failed
      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { ...prev[songId], status: DOWNLOAD_STATUS.FAILED }
      }));

      // Remove from active after delay
      setTimeout(() => {
        setActiveDownloads(prev => {
          const updated = { ...prev };
          delete updated[songId];
          return updated;
        });
      }, 3000);
      
      return false;
    }
  };

  // Cancel a download
  const cancelDownload = useCallback(async (songId) => {
    // Cancel if actively downloading
    const task = downloadTasksRef.current[songId];
    if (task?.cancelAsync) {
      try {
        await task.cancelAsync();
      } catch (e) {
        console.log('Cancel error:', e);
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
    const song = downloads.find(s => s.song_id === songId);
    
    // Delete the file
    if (song?.localPath) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(song.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(song.localPath);
        }
      } catch (e) {
        console.log('Could not delete file:', e);
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
    console.warn('useDownloads called outside DownloadProvider');
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
