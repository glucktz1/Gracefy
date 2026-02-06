/**
 * DownloadContext - Robust song download manager
 * 
 * Uses Expo SDK 54+ new File System API (no deprecated methods)
 * - File, Directory, Paths from expo-file-system/next
 * - No getInfoAsync, makeDirectoryAsync, deleteAsync
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { File, Paths, Directory } from 'expo-file-system/next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contentAPI } from '../services/api';
import { showToast } from '../components/Toast';

const DownloadContext = createContext(null);

// Constants
const STORAGE_KEY = '@gracefy_downloads_v4';
const DOWNLOAD_DIR_NAME = 'gracefy_songs';
const MIN_FILE_SIZE = 10000; // Minimum 10KB for valid audio

export const DOWNLOAD_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const DownloadProvider = ({ children }) => {
  const [downloads, setDownloads] = useState({});
  const [activeDownloads, setActiveDownloads] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const abortControllers = useRef({});

  // Initialize on mount
  useEffect(() => {
    initializeDownloads();
    return () => {
      // Cleanup: abort all active downloads
      Object.values(abortControllers.current).forEach(controller => {
        if (controller?.abort) controller.abort();
      });
    };
  }, []);

  // Process queue when items are added
  useEffect(() => {
    if (downloadQueue.length > 0 && !isProcessing) {
      processNextDownload();
    }
  }, [downloadQueue, isProcessing]);

  // Get download directory path
  const getDownloadDirPath = () => {
    return `${Paths.document}/${DOWNLOAD_DIR_NAME}`;
  };

  // Ensure download directory exists
  const ensureDownloadDir = () => {
    try {
      const dir = new Directory(Paths.document, DOWNLOAD_DIR_NAME);
      if (!dir.exists) {
        dir.create();
        console.log('[Downloads] Created directory');
      }
      return true;
    } catch (e) {
      console.error('[Downloads] Failed to create directory:', e);
      return false;
    }
  };

  // Check if file exists
  const fileExists = (filePath) => {
    try {
      const file = new File(filePath);
      return file.exists;
    } catch (e) {
      return false;
    }
  };

  // Get file size
  const getFileSize = (filePath) => {
    try {
      const file = new File(filePath);
      return file.exists ? (file.size || 0) : 0;
    } catch (e) {
      return 0;
    }
  };

  // Delete file
  const deleteFile = (filePath) => {
    try {
      const file = new File(filePath);
      if (file.exists) {
        file.delete();
      }
    } catch (e) {
      console.log('[Downloads] Delete error:', e);
    }
  };

  // Initialize downloads from storage
  const initializeDownloads = async () => {
    try {
      ensureDownloadDir();

      const savedDownloads = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedDownloads) {
        const parsed = JSON.parse(savedDownloads);
        
        // Verify files still exist
        const verified = {};
        for (const [songId, data] of Object.entries(parsed)) {
          if (data.file_path && fileExists(data.file_path)) {
            verified[songId] = data;
          }
        }
        
        setDownloads(verified);
        console.log('[Downloads] Loaded', Object.keys(verified).length, 'downloads');
      }
      
      setInitialized(true);
    } catch (error) {
      console.error('[Downloads] Init error:', error);
      setInitialized(true);
    }
  };

  // Persist downloads to storage
  const persistDownloads = async (newDownloads) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newDownloads));
    } catch (error) {
      console.error('[Downloads] Persist error:', error);
    }
  };

  // Check if song is downloaded
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

  // Get download progress
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
    if (!song?.song_id) return false;

    if (isDownloaded(song.song_id)) {
      console.log('[Downloads] Already downloaded:', song.title);
      return false;
    }

    if (downloadQueue.find(s => s.song_id === song.song_id)) {
      console.log('[Downloads] Already in queue:', song.title);
      return false;
    }

    if (activeDownloads[song.song_id]) {
      console.log('[Downloads] Already downloading:', song.title);
      return false;
    }

    if (!song.audio_url) {
      console.error('[Downloads] No audio URL:', song.title);
      return false;
    }

    console.log('[Downloads] Queuing:', song.title);
    setDownloadQueue(prev => [...prev, song]);
    return true;
  }, [downloads, downloadQueue, activeDownloads, isDownloaded]);

  // Queue multiple songs (album)
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

  // Process next download in queue using fetch API
  const processNextDownload = useCallback(async () => {
    if (isProcessing || downloadQueue.length === 0) return;
    
    setIsProcessing(true);
    const song = downloadQueue[0];

    try {
      console.log('[Downloads] Starting:', song.title);
      
      // Update status
      setActiveDownloads(prev => ({
        ...prev,
        [song.song_id]: { progress: 0, status: DOWNLOAD_STATUS.DOWNLOADING, song }
      }));

      // Remove from queue
      setDownloadQueue(prev => prev.slice(1));

      // Get audio URL
      let audioUrl = song.audio_url;
      
      if (!audioUrl?.startsWith('http')) {
        try {
          const response = await contentAPI.getSongDownloadUrl(song.song_id);
          audioUrl = response?.data?.direct_url || response?.data?.download_url || response?.data?.audio_url;
        } catch (e) {
          console.error('[Downloads] API error:', e);
        }
      }

      if (!audioUrl?.startsWith('http')) {
        throw new Error('Hakuna URL ya kupakua');
      }

      // Ensure directory exists
      if (!ensureDownloadDir()) {
        throw new Error('Haiwezi kutengeneza folder');
      }

      // Create file path
      const safeTitle = (song.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const fileName = `${safeTitle}_${song.song_id}.mp3`;
      const filePath = `${getDownloadDirPath()}/${fileName}`;

      console.log('[Downloads] URL:', audioUrl);
      console.log('[Downloads] Path:', filePath);

      // Delete existing file
      deleteFile(filePath);

      // Create abort controller for this download
      const abortController = new AbortController();
      abortControllers.current[song.song_id] = abortController;

      // Download using fetch API with progress tracking
      const response = await fetch(audioUrl, {
        signal: abortController.signal,
        headers: {
          'Accept': 'audio/mpeg, audio/*, */*',
          'User-Agent': 'Gracefy-App/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      // Read response as array buffer with progress
      const reader = response.body.getReader();
      const chunks = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        receivedBytes += value.length;

        // Update progress
        if (totalBytes > 0) {
          const progress = Math.min(Math.round((receivedBytes / totalBytes) * 100), 99);
          setActiveDownloads(prev => ({
            ...prev,
            [song.song_id]: { 
              ...prev[song.song_id], 
              progress,
              bytesWritten: receivedBytes,
              totalBytes
            }
          }));
        }
      }

      // Update to verifying status
      setActiveDownloads(prev => ({
        ...prev,
        [song.song_id]: { 
          ...prev[song.song_id], 
          progress: 99, 
          status: DOWNLOAD_STATUS.VERIFYING 
        }
      }));

      // Combine chunks into single array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioData = new Uint8Array(totalLength);
      let position = 0;
      for (const chunk of chunks) {
        audioData.set(chunk, position);
        position += chunk.length;
      }

      console.log('[Downloads] Downloaded bytes:', audioData.length);

      // Verify minimum size
      if (audioData.length < MIN_FILE_SIZE) {
        throw new Error(`Faili ndogo sana (${audioData.length} bytes)`);
      }

      // Write file using new File API
      const file = new File(filePath);
      file.write(audioData);

      // Verify file was written
      if (!file.exists) {
        throw new Error('Faili haikuhifadhiwa');
      }

      const finalSize = file.size || audioData.length;
      console.log('[Downloads] File size:', finalSize);

      // Success - save to state
      const downloadData = {
        ...song,
        file_path: filePath,
        file_size: finalSize,
        downloaded_at: new Date().toISOString(),
        verified: true,
      };

      setDownloads(prev => {
        const updated = { ...prev, [song.song_id]: downloadData };
        persistDownloads(updated);
        return updated;
      });

      setActiveDownloads(prev => ({
        ...prev,
        [song.song_id]: { 
          progress: 100, 
          status: DOWNLOAD_STATUS.COMPLETED, 
          song,
          fileSize: finalSize
        }
      }));

      console.log('[Downloads] ✓ Completed:', song.title);
      showToast(`"${song.title}" imepakuliwa ✓`, 'success');

      // Cleanup after delay
      setTimeout(() => {
        setActiveDownloads(prev => {
          const updated = { ...prev };
          delete updated[song.song_id];
          return updated;
        });
        delete abortControllers.current[song.song_id];
      }, 3000);

    } catch (error) {
      console.error('[Downloads] ✗ Failed:', error.message);
      
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

      setTimeout(() => {
        setActiveDownloads(prev => {
          const updated = { ...prev };
          delete updated[song.song_id];
          return updated;
        });
        delete abortControllers.current[song.song_id];
      }, 5000);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, downloadQueue, persistDownloads]);

  // Cancel download
  const cancelDownload = useCallback((songId) => {
    // Abort active download
    if (abortControllers.current[songId]) {
      abortControllers.current[songId].abort();
      delete abortControllers.current[songId];
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

  // Remove downloaded song
  const removeDownload = useCallback(async (songId) => {
    const download = downloads[songId];
    if (!download) return;

    try {
      if (download.file_path) {
        deleteFile(download.file_path);
      }

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
      for (const download of Object.values(downloads)) {
        if (download.file_path) {
          deleteFile(download.file_path);
        }
      }

      setDownloads({});
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[Downloads] Cleared all');
    } catch (error) {
      console.error('[Downloads] Clear error:', error);
    }
  }, [downloads]);

  // Get downloaded songs array
  const getDownloadedSongs = useCallback(() => {
    return Object.values(downloads).sort((a, b) => 
      new Date(b.downloaded_at) - new Date(a.downloaded_at)
    );
  }, [downloads]);

  // Get total download size
  const getTotalDownloadSize = useCallback(() => {
    return Object.values(downloads).reduce((total, d) => total + (d.file_size || 0), 0);
  }, [downloads]);

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
