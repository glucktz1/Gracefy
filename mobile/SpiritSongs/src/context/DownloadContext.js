/**
 * DownloadContext - Robust song download manager with file validation
 * 
 * Features:
 * - Queue-based downloads
 * - Progress tracking with real-time UI updates
 * - File integrity validation (size check)
 * - State synchronization - only marks downloaded when file verified
 * - Persistent storage with AsyncStorage
 * 
 * Updated for Expo SDK 54+ - uses new File API instead of deprecated methods
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { File, Paths, Directory } from 'expo-file-system/next';
import { downloadAsync } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contentAPI } from '../services/api';
import { showToast } from '../components/Toast';

const DownloadContext = createContext(null);

// Constants
const STORAGE_KEY = '@gracefy_downloads_v3';
const DOWNLOAD_DIR_NAME = 'gracefy_songs';
const MIN_FILE_SIZE = 10000; // Minimum 10KB for a valid audio file
const MAX_CONCURRENT = 1;

export const DOWNLOAD_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const DownloadProvider = ({ children }) => {
  // Downloaded songs map: { song_id: { song data, file_path, downloaded_at } }
  const [downloads, setDownloads] = useState({});
  // Active downloads: { song_id: { progress, status, song } }
  const [activeDownloads, setActiveDownloads] = useState({});
  // Download queue
  const [downloadQueue, setDownloadQueue] = useState([]);
  // Currently processing
  const [isProcessing, setIsProcessing] = useState(false);
  // Download tasks reference for cancellation
  const downloadTasksRef = useRef({});
  // Initialization flag
  const [initialized, setInitialized] = useState(false);

  // Initialize download directory and load saved downloads
  useEffect(() => {
    initializeDownloads();
    return () => {
      // Cleanup: cancel all active downloads
      Object.values(downloadTasksRef.current).forEach(task => {
        if (task?.cancelAsync) {
          task.cancelAsync();
        }
      });
    };
  }, []);

  // Process download queue
  useEffect(() => {
    if (downloadQueue.length > 0 && !isProcessing) {
      processNextDownload();
    }
  }, [downloadQueue, isProcessing]);

  // Helper: Get download directory
  const getDownloadDirectory = () => {
    return new Directory(Paths.document, DOWNLOAD_DIR_NAME);
  };

  // Helper: Check if file exists using new API
  const checkFileExists = async (filePath) => {
    try {
      const file = new File(filePath);
      return file.exists;
    } catch (e) {
      return false;
    }
  };

  // Helper: Get file size using new API
  const getFileSize = async (filePath) => {
    try {
      const file = new File(filePath);
      if (file.exists) {
        return file.size || 0;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  // Helper: Delete file using new API
  const deleteFile = async (filePath) => {
    try {
      const file = new File(filePath);
      if (file.exists) {
        file.delete();
      }
    } catch (e) {
      console.log('[Downloads] Delete error:', e);
    }
  };

  const initializeDownloads = async () => {
    try {
      // Ensure download directory exists using new API
      const downloadDir = getDownloadDirectory();
      if (!downloadDir.exists) {
        downloadDir.create();
        console.log('[Downloads] Created download directory');
      }

      // Load saved downloads from storage
      const savedDownloads = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedDownloads) {
        const parsed = JSON.parse(savedDownloads);
        
        // Verify files still exist
        const verifiedDownloads = {};
        for (const [songId, data] of Object.entries(parsed)) {
          if (data.file_path) {
            const exists = await checkFileExists(data.file_path);
            if (exists) {
              verifiedDownloads[songId] = data;
            }
          }
        }
        
        setDownloads(verifiedDownloads);
        console.log('[Downloads] Loaded', Object.keys(verifiedDownloads).length, 'downloads');
      }
      
      setInitialized(true);
    } catch (error) {
      console.error('[Downloads] Initialization error:', error);
      setInitialized(true);
    }
  };

  // Save downloads to persistent storage
  const persistDownloads = async (newDownloads) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDownloads));
    } catch (error) {
      console.error('[Downloads] Failed to persist downloads:', error);
    }
  };

  // Check if a song is downloaded
  const isDownloaded = useCallback((songId) => {
    return !!downloads[songId];
  }, [downloads]);

  // Get download status
  const getDownloadStatus = useCallback((songId) => {
    if (downloads[songId]) return DOWNLOAD_STATUS.COMPLETED;
    if (activeDownloads[songId]) return activeDownloads[songId].status;
    if (downloadQueue.find(s => s.song_id === songId)) return DOWNLOAD_STATUS.QUEUED;
    return DOWNLOAD_STATUS.IDLE;
  }, [downloads, activeDownloads, downloadQueue]);

  // Get download progress (0-100)
  const getDownloadProgress = useCallback((songId) => {
    if (downloads[songId]) return 100;
    return activeDownloads[songId]?.progress || 0;
  }, [downloads, activeDownloads]);

  // Get downloaded file path
  const getDownloadedFilePath = useCallback((songId) => {
    return downloads[songId]?.file_path || null;
  }, [downloads]);

  // Queue a song for download
  const queueDownload = useCallback((song) => {
    if (!song?.song_id) {
      console.error('[Downloads] Invalid song object');
      return false;
    }

    // Check if already downloaded or in queue
    if (isDownloaded(song.song_id)) {
      console.log('[Downloads] Song already downloaded:', song.title);
      return false;
    }

    if (downloadQueue.find(s => s.song_id === song.song_id)) {
      console.log('[Downloads] Song already in queue:', song.title);
      return false;
    }

    if (activeDownloads[song.song_id]) {
      console.log('[Downloads] Song already downloading:', song.title);
      return false;
    }

    // Check if song has audio URL
    if (!song.audio_url) {
      console.error('[Downloads] Song has no audio URL:', song.title);
      return false;
    }

    console.log('[Downloads] Queuing download:', song.title);
    setDownloadQueue(prev => [...prev, song]);
    return true;
  }, [downloads, downloadQueue, activeDownloads, isDownloaded]);

  // Queue multiple songs (album download)
  const queueAlbumDownload = useCallback((songs) => {
    if (!songs || songs.length === 0) {
      return { success: false, queued: 0, skipped: 0, message: 'Hakuna nyimbo' };
    }

    let queued = 0;
    let skipped = 0;

    songs.forEach(song => {
      if (queueDownload(song)) {
        queued++;
      } else {
        skipped++;
      }
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

  // Process download queue - one at a time with proper validation
  const processNextDownload = useCallback(async () => {
    if (isProcessing || downloadQueue.length === 0) return;
    
    setIsProcessing(true);
    const song = downloadQueue[0];

    try {
      console.log('[Downloads] Starting download for:', song.title);
      
      // Update status to downloading
      setActiveDownloads(prev => ({
        ...prev,
        [song.song_id]: { progress: 0, status: DOWNLOAD_STATUS.DOWNLOADING, song }
      }));

      // Remove from queue
      setDownloadQueue(prev => prev.slice(1));

      // Get download URL
      let audioUrl = song.audio_url;
      
      // If URL is relative or missing, try to get full URL from API
      if (!audioUrl?.startsWith('http')) {
        try {
          console.log('[Downloads] Fetching download URL from API...');
          const response = await contentAPI.getSongDownloadUrl(song.song_id);
          audioUrl = response?.data?.direct_url || response?.data?.download_url || response?.data?.audio_url;
          console.log('[Downloads] Got URL from API:', audioUrl);
        } catch (e) {
          console.error('[Downloads] Failed to get download URL from API:', e);
        }
      }

      if (!audioUrl?.startsWith('http')) {
        throw new Error('Haiwezi kupata URL ya kupakua - hakuna link');
      }

      // Ensure download directory exists
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
      if (!dirInfo.exists) {
        console.log('[Downloads] Creating download directory...');
        await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
      }

      // Create safe filename
      const safeTitle = (song.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const fileName = `${safeTitle}_${song.song_id}.mp3`;
      const filePath = DOWNLOAD_DIR + fileName;

      console.log('[Downloads] Downloading from:', audioUrl);
      console.log('[Downloads] Saving to:', filePath);

      // Delete existing file if present (fresh download)
      const existingFile = await FileSystem.getInfoAsync(filePath);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }

      // Create download with progress callback
      const downloadResumable = FileSystem.createDownloadResumable(
        audioUrl,
        filePath,
        {
          headers: {
            'Accept': 'audio/mpeg, audio/*, */*',
            'User-Agent': 'Gracefy-App/1.0'
          }
        },
        (progress) => {
          if (progress.totalBytesExpectedToWrite > 0) {
            const percent = Math.round(
              (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
            );
            const safePercent = Math.min(Math.max(percent, 0), 99); // Cap at 99 until verified
            
            setActiveDownloads(prev => ({
              ...prev,
              [song.song_id]: { 
                ...prev[song.song_id], 
                progress: safePercent,
                bytesWritten: progress.totalBytesWritten,
                totalBytes: progress.totalBytesExpectedToWrite
              }
            }));
          }
        }
      );

      // Store reference for potential cancellation
      downloadTasksRef.current[song.song_id] = downloadResumable;

      // Execute download
      const result = await downloadResumable.downloadAsync();
      
      console.log('[Downloads] Download result:', result);

      // Update to verifying status
      setActiveDownloads(prev => ({
        ...prev,
        [song.song_id]: { 
          ...prev[song.song_id], 
          progress: 99, 
          status: DOWNLOAD_STATUS.VERIFYING 
        }
      }));

      // CRITICAL: Verify file actually exists and has valid size
      if (!result?.uri) {
        throw new Error('Download haikurudisha faili - jaribu tena');
      }

      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      console.log('[Downloads] File verification:', {
        exists: fileInfo.exists,
        size: fileInfo.size,
        uri: result.uri
      });

      if (!fileInfo.exists) {
        throw new Error('Faili haikuhifadhiwa kwenye kifaa - jaribu tena');
      }

      if (fileInfo.size < MIN_FILE_SIZE) {
        // File too small - likely an error response, delete it
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw new Error(`Faili ni ndogo sana (${fileInfo.size} bytes) - huenda ni tatizo la mtandao`);
      }

      // SUCCESS: File verified, save to downloads state
      const downloadData = {
        ...song,
        file_path: result.uri,
        file_size: fileInfo.size,
        downloaded_at: new Date().toISOString(),
        verified: true,
      };

      // Update downloads state and persist
      setDownloads(prev => {
        const updated = { ...prev, [song.song_id]: downloadData };
        persistDownloads(updated);
        return updated;
      });

      // Update to completed status
      setActiveDownloads(prev => ({
        ...prev,
        [song.song_id]: { 
          progress: 100, 
          status: DOWNLOAD_STATUS.COMPLETED, 
          song,
          fileSize: fileInfo.size
        }
      }));

      console.log('[Downloads] ✓ Verified and saved:', song.title, '- Size:', fileInfo.size);
      showToast(`"${song.title}" imepakuliwa ✓`, 'success');

      // Remove from active downloads after delay (keep showing success briefly)
      setTimeout(() => {
        setActiveDownloads(prev => {
          const updated = { ...prev };
          delete updated[song.song_id];
          return updated;
        });
        delete downloadTasksRef.current[song.song_id];
      }, 3000);

    } catch (error) {
      console.error('[Downloads] ✗ Download failed:', error.message);
      
      // Update status to failed
      setActiveDownloads(prev => ({
        ...prev,
        [song.song_id]: { 
          progress: 0, 
          status: DOWNLOAD_STATUS.FAILED, 
          song,
          error: error.message
        }
      }));

      showToast(`Imeshindikana: ${error.message}`, 'error');

      // Remove from active after delay
      setTimeout(() => {
        setActiveDownloads(prev => {
          const updated = { ...prev };
          delete updated[song.song_id];
          return updated;
        });
        delete downloadTasksRef.current[song.song_id];
      }, 5000);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, downloadQueue, persistDownloads]);

  // Cancel a download
  const cancelDownload = useCallback(async (songId) => {
    // Cancel active download
    if (downloadTasksRef.current[songId]) {
      try {
        await downloadTasksRef.current[songId].cancelAsync();
      } catch (e) {
        console.error('[Downloads] Cancel error:', e);
      }
      delete downloadTasksRef.current[songId];
    }

    // Remove from queue
    setDownloadQueue(prev => prev.filter(s => s.song_id !== songId));
    
    // Remove from active
    setActiveDownloads(prev => {
      const updated = { ...prev };
      delete updated[songId];
      return updated;
    });
  }, []);

  // Remove a downloaded song
  const removeDownload = useCallback(async (songId) => {
    const download = downloads[songId];
    if (!download) return;

    try {
      // Delete file
      if (download.file_path) {
        const fileInfo = await FileSystem.getInfoAsync(download.file_path);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(download.file_path);
        }
      }

      // Remove from state
      setDownloads(prev => {
        const updated = { ...prev };
        delete updated[songId];
        persistDownloads(updated);
        return updated;
      });

      console.log('[Downloads] Removed:', download.title);
    } catch (error) {
      console.error('[Downloads] Remove error:', error);
    }
  }, [downloads]);

  // Clear all downloads
  const clearAllDownloads = useCallback(async () => {
    try {
      // Delete all files
      for (const download of Object.values(downloads)) {
        if (download.file_path) {
          try {
            await FileSystem.deleteAsync(download.file_path);
          } catch (e) {
            console.error('[Downloads] Delete file error:', e);
          }
        }
      }

      // Clear state
      setDownloads({});
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[Downloads] Cleared all downloads');
    } catch (error) {
      console.error('[Downloads] Clear all error:', error);
    }
  }, [downloads]);

  // Get all downloaded songs as array
  const getDownloadedSongs = useCallback(() => {
    return Object.values(downloads).sort((a, b) => 
      new Date(b.downloaded_at) - new Date(a.downloaded_at)
    );
  }, [downloads]);

  // Get total download size
  const getTotalDownloadSize = useCallback(() => {
    return Object.values(downloads).reduce((total, d) => total + (d.file_size || 0), 0);
  }, [downloads]);

  // Get download count
  const downloadCount = Object.keys(downloads).length;

  // Queue count
  const queueCount = downloadQueue.length + Object.keys(activeDownloads).length;

  const value = {
    // State
    downloads,
    activeDownloads,
    downloadQueue,
    downloadCount,
    queueCount,
    initialized,
    
    // Methods
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
