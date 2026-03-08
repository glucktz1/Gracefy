/**
 * DownloadContext - Simple & Reliable Download Manager
 * 
 * Uses the stable FileSystem.downloadAsync API which handles:
 * - HTTP download with progress tracking
 * - Direct file writing to disk
 * - Resumable downloads
 * 
 * This avoids the experimental expo-file-system/next API issues
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
// Use legacy API for createDownloadResumable (stable in SDK 54)
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { contentAPI, downloadTrackingAPI } from '../services/api';
import { showToast } from '../components/Toast';
import { useAuth } from './AuthContext';

const DownloadContext = createContext(null);

// Constants
const STORAGE_KEY = '@gracefy_downloads_v7';
const DOWNLOAD_DIR = FileSystem.documentDirectory + 'gracefy_downloads/';
const MIN_FILE_SIZE = 10000; // 10KB minimum for valid audio

export const DOWNLOAD_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const DownloadProvider = ({ children }) => {
  const { user } = useAuth();
  const [downloads, setDownloads] = useState({});
  const [activeDownloads, setActiveDownloads] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  const downloadResumables = useRef({});

  // ==================== INITIALIZATION ====================
  
  useEffect(() => {
    initializeDownloads();
    return () => {
      // Cancel any active downloads on unmount
      Object.values(downloadResumables.current).forEach(resumable => {
        try {
          resumable?.pauseAsync?.();
        } catch (e) {
          // Ignore
        }
      });
    };
  }, []);

  // Process queue when items are added
  useEffect(() => {
    if (downloadQueue.length > 0 && !isProcessing) {
      processNextDownload();
    }
  }, [downloadQueue, isProcessing]);

  const initializeDownloads = async () => {
    try {
      // Ensure download directory exists
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
        console.log('[Downloads] Created download directory');
      }

      // Load saved downloads and verify files exist
      const savedDownloads = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedDownloads) {
        const parsed = JSON.parse(savedDownloads);
        const verified = {};
        
        for (const [songId, data] of Object.entries(parsed)) {
          if (data.file_path) {
            const fileInfo = await FileSystem.getInfoAsync(data.file_path);
            if (fileInfo.exists && (fileInfo.size || 0) > MIN_FILE_SIZE) {
              verified[songId] = { ...data, verified_size: fileInfo.size };
            } else {
              console.log('[Downloads] File missing or too small:', data.title);
              // Clean up invalid file
              try {
                await FileSystem.deleteAsync(data.file_path, { idempotent: true });
              } catch (e) {}
            }
          }
        }
        
        setDownloads(verified);
        console.log('[Downloads] Loaded', Object.keys(verified).length, 'verified downloads');
      }
      
      setInitialized(true);
    } catch (error) {
      console.error('[Downloads] Init error:', error);
      setInitialized(true);
    }
  };

  const persistDownloads = async (newDownloads) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDownloads));
    } catch (error) {
      console.error('[Downloads] Persist error:', error);
    }
  };

  // ==================== STATUS HELPERS ====================
  
  const isDownloaded = useCallback((songId) => {
    return !!downloads[songId];
  }, [downloads]);

  const getDownloadStatus = useCallback((songId) => {
    if (downloads[songId]) return DOWNLOAD_STATUS.COMPLETED;
    if (activeDownloads[songId]) return activeDownloads[songId].status;
    if (downloadQueue.find(s => s.song_id === songId)) return DOWNLOAD_STATUS.QUEUED;
    return DOWNLOAD_STATUS.IDLE;
  }, [downloads, activeDownloads, downloadQueue]);

  const getDownloadProgress = useCallback((songId) => {
    if (downloads[songId]) return 100;
    return activeDownloads[songId]?.progress || 0;
  }, [downloads, activeDownloads]);

  const getDownloadedFilePath = useCallback((songId) => {
    return downloads[songId]?.file_path || null;
  }, [downloads]);

  const getDownloadedSongs = useCallback(() => {
    return Object.values(downloads).sort((a, b) => 
      new Date(b.downloaded_at || 0) - new Date(a.downloaded_at || 0)
    );
  }, [downloads]);

  const getTotalDownloadSize = useCallback(() => {
    return Object.values(downloads).reduce((total, d) => total + (d.file_size || 0), 0);
  }, [downloads]);

  // ==================== QUEUE MANAGEMENT ====================
  
  const queueDownload = useCallback((song) => {
    if (!song?.song_id || !song?.audio_url) {
      console.log('[Downloads] Invalid song data');
      return false;
    }

    if (isDownloaded(song.song_id)) {
      console.log('[Downloads] Already downloaded:', song.title);
      return false;
    }

    if (downloadQueue.find(s => s.song_id === song.song_id) || activeDownloads[song.song_id]) {
      console.log('[Downloads] Already in queue:', song.title);
      return false;
    }

    console.log('[Downloads] Queuing:', song.title);
    setDownloadQueue(prev => [...prev, song]);
    return true;
  }, [downloads, downloadQueue, activeDownloads, isDownloaded]);

  const queueAlbumDownload = useCallback((songs) => {
    if (!songs?.length) {
      return { success: false, queued: 0, skipped: 0, message: 'Hakuna nyimbo' };
    }

    let queued = 0, skipped = 0;
    songs.forEach(song => {
      if (queueDownload(song)) queued++;
      else skipped++;
    });

    return {
      success: queued > 0,
      queued,
      skipped,
      message: queued > 0 
        ? `Nyimbo ${queued} zinapakuliwa${skipped > 0 ? `, ${skipped} zilirukwa` : ''}`
        : 'Nyimbo zote tayari zimepakuliwa'
    };
  }, [queueDownload]);

  // ==================== MAIN DOWNLOAD PROCESS ====================
  
  const processNextDownload = useCallback(async () => {
    if (isProcessing || downloadQueue.length === 0) return;
    
    setIsProcessing(true);
    const song = downloadQueue[0];
    const songId = song.song_id;

    console.log('[Downloads] ========================================');
    console.log('[Downloads] Starting download:', song.title);

    // Remove from queue
    setDownloadQueue(prev => prev.slice(1));

    // Update status
    setActiveDownloads(prev => ({
      ...prev,
      [songId]: { status: DOWNLOAD_STATUS.DOWNLOADING, progress: 0, song }
    }));

    try {
      // Get the download URL
      let audioUrl = song.audio_url;
      
      // If not a full URL, get it from the API
      if (!audioUrl?.startsWith('http')) {
        try {
          const response = await contentAPI.getSongDownloadUrl(songId);
          audioUrl = response?.data?.direct_url || response?.data?.download_url || audioUrl;
        } catch (e) {
          console.error('[Downloads] API error:', e.message);
        }
      }

      if (!audioUrl?.startsWith('http')) {
        throw new Error('URL ya kupakua haipo');
      }

      console.log('[Downloads] URL:', audioUrl.substring(0, 80) + '...');

      // Create filename
      const safeTitle = (song.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
      const fileName = `${safeTitle}_${songId}.mp3`;
      const filePath = DOWNLOAD_DIR + fileName;

      // Delete any existing file
      try {
        const existingFile = await FileSystem.getInfoAsync(filePath);
        if (existingFile.exists) {
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      } catch (e) {}

      // Create the download resumable with progress callback
      const progressCallback = (downloadProgress) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
        let progress = 0;
        
        if (totalBytesExpectedToWrite > 0) {
          progress = Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100);
        } else if (totalBytesWritten > 0) {
          // Estimate progress if total size unknown
          progress = Math.min(Math.round(totalBytesWritten / 5000000 * 100), 99);
        }

        setActiveDownloads(prev => ({
          ...prev,
          [songId]: { 
            status: DOWNLOAD_STATUS.DOWNLOADING, 
            progress,
            song,
            bytesWritten: totalBytesWritten,
            totalBytes: totalBytesExpectedToWrite
          }
        }));
      };

      // Use FileSystem.downloadAsync - the most stable method
      const downloadResumable = FileSystem.createDownloadResumable(
        audioUrl,
        filePath,
        {},
        progressCallback
      );

      // Store reference for cancellation
      downloadResumables.current[songId] = downloadResumable;

      // Start download
      console.log('[Downloads] Starting FileSystem.downloadAsync...');
      const result = await downloadResumable.downloadAsync();

      if (!result?.uri) {
        throw new Error('Download hakukamilika');
      }

      console.log('[Downloads] Download complete, verifying file...');

      // Verify the downloaded file
      const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
      
      if (!fileInfo.exists) {
        throw new Error('Faili haipo baada ya kupakua');
      }

      const fileSize = fileInfo.size || 0;
      console.log('[Downloads] File size:', fileSize, 'bytes');

      if (fileSize < MIN_FILE_SIZE) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw new Error(`Faili ndogo sana (${fileSize} bytes)`);
      }

      // Success! Save to state
      const downloadData = {
        ...song,
        file_path: result.uri,
        file_size: fileSize,
        downloaded_at: new Date().toISOString(),
      };

      setDownloads(prev => {
        const updated = { ...prev, [songId]: downloadData };
        persistDownloads(updated);
        return updated;
      });

      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { status: DOWNLOAD_STATUS.COMPLETED, progress: 100, song, fileSize }
      }));

      console.log('[Downloads] ✓ SUCCESS:', song.title, '-', fileSize, 'bytes');
      showToast(`"${song.title}" imepakuliwa ✓`, 'success');

      // Track download in analytics
      try {
        const deviceId = Application.androidId || Device.osBuildId || 'unknown';
        await downloadTrackingAPI.recordDownload('song', songId, user?.user_id, deviceId);
        console.log('[Downloads] Download tracked in analytics');
      } catch (e) {
        console.log('[Downloads] Analytics tracking failed:', e.message);
      }

      // Clean up after delay
      setTimeout(() => {
        setActiveDownloads(prev => {
          const { [songId]: _, ...rest } = prev;
          return rest;
        });
        delete downloadResumables.current[songId];
      }, 2000);

    } catch (error) {
      console.error('[Downloads] ✗ FAILED:', error.message);
      
      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { status: DOWNLOAD_STATUS.FAILED, progress: 0, song, error: error.message }
      }));

      showToast(`Imeshindikana: ${error.message}`, 'error');

      // Clean up after delay
      setTimeout(() => {
        setActiveDownloads(prev => {
          const { [songId]: _, ...rest } = prev;
          return rest;
        });
        delete downloadResumables.current[songId];
      }, 3000);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, downloadQueue]);

  // ==================== MANAGEMENT FUNCTIONS ====================
  
  const cancelDownload = useCallback(async (songId) => {
    const resumable = downloadResumables.current[songId];
    if (resumable) {
      try {
        await resumable.pauseAsync();
      } catch (e) {}
      delete downloadResumables.current[songId];
    }
    
    setDownloadQueue(prev => prev.filter(s => s.song_id !== songId));
    setActiveDownloads(prev => {
      const { [songId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const removeDownload = useCallback(async (songId) => {
    const download = downloads[songId];
    if (!download) return;

    if (download.file_path) {
      try {
        await FileSystem.deleteAsync(download.file_path, { idempotent: true });
      } catch (e) {
        console.log('[Downloads] Delete error:', e.message);
      }
    }

    setDownloads(prev => {
      const { [songId]: _, ...rest } = prev;
      persistDownloads(rest);
      return rest;
    });

    console.log('[Downloads] Removed:', download.title);
  }, [downloads]);

  const clearAllDownloads = useCallback(async () => {
    for (const download of Object.values(downloads)) {
      if (download.file_path) {
        try {
          await FileSystem.deleteAsync(download.file_path, { idempotent: true });
        } catch (e) {}
      }
    }

    setDownloads({});
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('[Downloads] Cleared all');
  }, [downloads]);

  // ==================== CONTEXT VALUE ====================
  
  const downloadCount = Object.keys(downloads).length;
  const queueCount = downloadQueue.length + Object.keys(activeDownloads).length;

  const value = {
    downloads,
    activeDownloads,
    downloadQueue,
    downloadCount,
    queueCount,
    initialized,
    isDownloaded,
    getDownloadStatus,
    getDownloadProgress,
    getDownloadedFilePath,
    getDownloadedSongs,
    getTotalDownloadSize,
    queueDownload,
    queueAlbumDownload,
    cancelDownload,
    removeDownload,
    clearAllDownloads,
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
      downloads: {},
      activeDownloads: {},
      downloadQueue: [],
      downloadCount: 0,
      queueCount: 0,
      initialized: false,
      isDownloaded: () => false,
      getDownloadStatus: () => DOWNLOAD_STATUS.IDLE,
      getDownloadProgress: () => 0,
      getDownloadedFilePath: () => null,
      getDownloadedSongs: () => [],
      getTotalDownloadSize: () => 0,
      queueDownload: () => false,
      queueAlbumDownload: () => ({ success: false, queued: 0, skipped: 0 }),
      cancelDownload: () => {},
      removeDownload: () => {},
      clearAllDownloads: () => {},
    };
  }
  return context;
};

export default DownloadContext;
