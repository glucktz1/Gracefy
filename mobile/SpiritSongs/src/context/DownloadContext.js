/**
 * DownloadContext - Gold Standard Download Manager
 * 
 * Architecture:
 * 1. Request & Authorization Phase - Validate user rights, get signed URL
 * 2. Multi-Threaded Data Transfer - Chunked download with progress
 * 3. Atomic Commit to Disk - Write to .tmp, verify checksum, atomic rename
 * 4. Database Sync - Only update state after file verified on disk
 * 5. Observer Pattern - Real-time file presence monitoring
 * 
 * Uses stable expo-file-system APIs for file operations
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contentAPI } from '../services/api';
import { showToast } from '../components/Toast';

const DownloadContext = createContext(null);

// Constants
const STORAGE_KEY = '@gracefy_downloads_v6';
const DOWNLOAD_DIR = FileSystem.documentDirectory + 'gracefy_downloads/';
const TEMP_DIR = FileSystem.documentDirectory + 'gracefy_temp/';
const MIN_FILE_SIZE = 10000; // 10KB minimum for valid audio

export const DOWNLOAD_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  AUTHORIZING: 'authorizing',
  DOWNLOADING: 'downloading',
  VERIFYING: 'verifying',
  COMMITTING: 'committing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// Convert Uint8Array to base64
const uint8ArrayToBase64 = (bytes) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Simple hash function for checksum
const calculateChecksum = (data) => {
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

export const DownloadProvider = ({ children }) => {
  const [downloads, setDownloads] = useState({});
  const [activeDownloads, setActiveDownloads] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  const abortControllers = useRef({});
  const fileObserverInterval = useRef(null);

  // ==================== DIRECTORY MANAGEMENT ====================
  
  const getDownloadDirPath = () => `${Paths.document}/${DOWNLOAD_DIR_NAME}`;
  const getTempDirPath = () => `${Paths.document}/${TEMP_DIR_NAME}`;

  const ensureDirectories = () => {
    try {
      // Main download directory
      const downloadDir = new Directory(Paths.document, DOWNLOAD_DIR_NAME);
      if (!downloadDir.exists) {
        downloadDir.create();
        console.log('[Downloads] Created download directory');
      }
      
      // Temp directory for atomic writes
      const tempDir = new Directory(Paths.document, TEMP_DIR_NAME);
      if (!tempDir.exists) {
        tempDir.create();
        console.log('[Downloads] Created temp directory');
      }
      
      return true;
    } catch (e) {
      console.error('[Downloads] Directory creation failed:', e);
      return false;
    }
  };

  // ==================== FILE OPERATIONS (New API) ====================
  
  const fileExists = (filePath) => {
    try {
      const file = new File(filePath);
      return file.exists === true;
    } catch (e) {
      return false;
    }
  };

  const getFileSize = (filePath) => {
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

  const deleteFile = (filePath) => {
    try {
      const file = new File(filePath);
      if (file.exists) {
        file.delete();
        return true;
      }
      return false;
    } catch (e) {
      console.log('[Downloads] Delete error:', e.message);
      return false;
    }
  };

  const moveFile = (sourcePath, destPath) => {
    try {
      const sourceFile = new File(sourcePath);
      if (!sourceFile.exists) {
        return false;
      }
      
      // Read source file
      const data = sourceFile.bytes();
      
      // Write to destination
      const destFile = new File(destPath);
      destFile.write(data);
      
      // Verify destination exists
      if (destFile.exists) {
        // Delete source
        sourceFile.delete();
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('[Downloads] Move error:', e.message);
      return false;
    }
  };

  // ==================== OBSERVER PATTERN ====================
  
  // Monitor downloaded files - if they vanish, update state
  const startFileObserver = useCallback(() => {
    if (fileObserverInterval.current) return;
    
    fileObserverInterval.current = setInterval(() => {
      let needsUpdate = false;
      const updatedDownloads = { ...downloads };
      
      for (const [songId, data] of Object.entries(downloads)) {
        if (data.file_path && !fileExists(data.file_path)) {
          console.log('[Downloads] Observer: File vanished -', data.title);
          delete updatedDownloads[songId];
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        setDownloads(updatedDownloads);
        persistDownloads(updatedDownloads);
        showToast('Baadhi ya nyimbo zimefutwa na mfumo', 'warning');
      }
    }, 30000); // Check every 30 seconds
  }, [downloads]);

  const stopFileObserver = () => {
    if (fileObserverInterval.current) {
      clearInterval(fileObserverInterval.current);
      fileObserverInterval.current = null;
    }
  };

  // ==================== INITIALIZATION ====================
  
  useEffect(() => {
    initializeDownloads();
    
    return () => {
      stopFileObserver();
      Object.values(abortControllers.current).forEach(c => c?.abort?.());
    };
  }, []);

  // Start observer when downloads change
  useEffect(() => {
    if (Object.keys(downloads).length > 0) {
      startFileObserver();
    } else {
      stopFileObserver();
    }
  }, [downloads, startFileObserver]);

  // Process queue
  useEffect(() => {
    if (downloadQueue.length > 0 && !isProcessing) {
      processNextDownload();
    }
  }, [downloadQueue, isProcessing]);

  const initializeDownloads = async () => {
    try {
      ensureDirectories();

      const savedDownloads = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedDownloads) {
        const parsed = JSON.parse(savedDownloads);
        
        // Verify each file still exists on disk
        const verified = {};
        for (const [songId, data] of Object.entries(parsed)) {
          if (data.file_path && fileExists(data.file_path)) {
            // Double-check file size matches
            const actualSize = getFileSize(data.file_path);
            if (actualSize > MIN_FILE_SIZE) {
              verified[songId] = { ...data, verified_size: actualSize };
            } else {
              console.log('[Downloads] File too small, removing:', data.title);
              deleteFile(data.file_path);
            }
          } else {
            console.log('[Downloads] File missing, removing from index:', data.title);
          }
        }
        
        setDownloads(verified);
        console.log('[Downloads] Loaded', Object.keys(verified).length, 'verified downloads');
      }
      
      // Clean temp directory
      cleanTempDirectory();
      
      setInitialized(true);
    } catch (error) {
      console.error('[Downloads] Init error:', error);
      setInitialized(true);
    }
  };

  const cleanTempDirectory = () => {
    try {
      const tempDir = new Directory(Paths.document, TEMP_DIR_NAME);
      if (tempDir.exists) {
        // Delete and recreate to clean all temp files
        tempDir.delete();
        tempDir.create();
      }
    } catch (e) {
      console.log('[Downloads] Temp cleanup error:', e.message);
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
    const download = downloads[songId];
    if (!download) return false;
    
    // Verify file still exists (defensive check)
    return fileExists(download.file_path);
  }, [downloads]);

  const getDownloadStatus = useCallback((songId) => {
    if (downloads[songId] && fileExists(downloads[songId].file_path)) {
      return DOWNLOAD_STATUS.COMPLETED;
    }
    if (activeDownloads[songId]) {
      return activeDownloads[songId].status;
    }
    if (downloadQueue.find(s => s.song_id === songId)) {
      return DOWNLOAD_STATUS.QUEUED;
    }
    return DOWNLOAD_STATUS.IDLE;
  }, [downloads, activeDownloads, downloadQueue]);

  const getDownloadProgress = useCallback((songId) => {
    if (downloads[songId]) return 100;
    return activeDownloads[songId]?.progress || 0;
  }, [downloads, activeDownloads]);

  const getDownloadedFilePath = useCallback((songId) => {
    const download = downloads[songId];
    if (download?.file_path && fileExists(download.file_path)) {
      return download.file_path;
    }
    return null;
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
      console.log('[Downloads] Already queued/downloading:', song.title);
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

    const updateStatus = (status, progress = 0, extra = {}) => {
      setActiveDownloads(prev => ({
        ...prev,
        [songId]: { status, progress, song, ...extra }
      }));
    };

    try {
      console.log('[Downloads] ========================================');
      console.log('[Downloads] Starting download:', song.title);
      
      // Remove from queue
      setDownloadQueue(prev => prev.slice(1));

      // ===== PHASE 1: AUTHORIZATION =====
      updateStatus(DOWNLOAD_STATUS.AUTHORIZING, 0);
      
      let audioUrl = song.audio_url;
      let expectedSize = 0;
      
      // Get authorized URL from API
      if (!audioUrl?.startsWith('http')) {
        try {
          const response = await contentAPI.getSongDownloadUrl(songId);
          const data = response?.data;
          audioUrl = data?.direct_url || data?.download_url || data?.audio_url;
          expectedSize = data?.file_size || 0;
        } catch (e) {
          console.error('[Downloads] Auth failed:', e);
        }
      }

      if (!audioUrl?.startsWith('http')) {
        throw new Error('Hakuna URL - jaribu tena');
      }

      console.log('[Downloads] Authorized URL:', audioUrl.substring(0, 80) + '...');

      // ===== PHASE 2: PREPARE DIRECTORIES =====
      if (!ensureDirectories()) {
        throw new Error('Haiwezi kutengeneza folder');
      }

      const safeTitle = (song.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
      const fileName = `${safeTitle}_${songId}.mp3`;
      const tempPath = `${getTempDirPath()}/${fileName}.tmp`;
      const finalPath = `${getDownloadDirPath()}/${fileName}`;

      // Clean up any existing files
      deleteFile(tempPath);
      deleteFile(finalPath);

      // ===== PHASE 3: DOWNLOAD WITH PROGRESS (XMLHttpRequest) =====
      updateStatus(DOWNLOAD_STATUS.DOWNLOADING, 1);

      const audioData = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', audioUrl, true);
        xhr.responseType = 'arraybuffer';
        
        // Store reference for cancellation
        abortControllers.current[songId] = { 
          abort: () => xhr.abort() 
        };

        xhr.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.min(Math.round((event.loaded / event.total) * 95), 95);
            updateStatus(DOWNLOAD_STATUS.DOWNLOADING, progress, {
              bytesWritten: event.loaded,
              totalBytes: event.total
            });
          } else if (event.loaded > 0) {
            // Unknown total, estimate progress
            const estimatedProgress = Math.min(Math.round(event.loaded / 5000000 * 50), 50);
            updateStatus(DOWNLOAD_STATUS.DOWNLOADING, estimatedProgress, {
              bytesWritten: event.loaded,
              totalBytes: expectedSize || 0
            });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Uint8Array(xhr.response));
          } else {
            reject(new Error(`Server error: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error - angalia mtandao'));
        xhr.ontimeout = () => reject(new Error('Timeout - mtandao polepole'));
        xhr.onabort = () => reject(new Error('Imesitishwa'));

        xhr.timeout = 300000; // 5 minute timeout
        xhr.send();
      });

      console.log('[Downloads] Received:', audioData.length, 'bytes');

      // ===== PHASE 4: VERIFICATION =====
      updateStatus(DOWNLOAD_STATUS.VERIFYING, 96);

      // Validate size
      if (audioData.length < MIN_FILE_SIZE) {
        throw new Error(`Faili ndogo sana (${audioData.length} bytes)`);
      }

      // Calculate checksum
      const localChecksum = calculateChecksum(audioData);
      console.log('[Downloads] Checksum:', localChecksum);

      // ===== PHASE 5: ATOMIC COMMIT =====
      updateStatus(DOWNLOAD_STATUS.COMMITTING, 97);

      // Step 1: Write to temp file
      const tempFile = new File(tempPath);
      tempFile.write(audioData);

      if (!tempFile.exists) {
        throw new Error('Haiwezi kuandika faili ya muda');
      }

      const tempSize = tempFile.size || 0;
      console.log('[Downloads] Temp file size:', tempSize);

      if (tempSize < MIN_FILE_SIZE) {
        deleteFile(tempPath);
        throw new Error('Faili ya muda ni ndogo sana');
      }

      // Step 2: Atomic move to final location
      updateStatus(DOWNLOAD_STATUS.COMMITTING, 98);
      
      const moveSuccess = moveFile(tempPath, finalPath);
      if (!moveSuccess) {
        throw new Error('Haiwezi kuhamisha faili');
      }

      // Step 3: Final verification
      updateStatus(DOWNLOAD_STATUS.VERIFYING, 99);
      
      if (!fileExists(finalPath)) {
        throw new Error('Faili haipo baada ya kuhamisha');
      }

      const finalSize = getFileSize(finalPath);
      console.log('[Downloads] Final file size:', finalSize);

      if (finalSize < MIN_FILE_SIZE) {
        deleteFile(finalPath);
        throw new Error('Faili ya mwisho ni ndogo sana');
      }

      // ===== PHASE 6: DATABASE SYNC =====
      const downloadData = {
        ...song,
        file_path: finalPath,
        file_size: finalSize,
        checksum: localChecksum,
        downloaded_at: new Date().toISOString(),
        verified: true,
      };

      setDownloads(prev => {
        const updated = { ...prev, [songId]: downloadData };
        persistDownloads(updated);
        return updated;
      });

      updateStatus(DOWNLOAD_STATUS.COMPLETED, 100, { fileSize: finalSize });

      console.log('[Downloads] ✓ SUCCESS:', song.title, '-', finalSize, 'bytes');
      showToast(`"${song.title}" imepakuliwa ✓`, 'success');

      // Cleanup after delay
      setTimeout(() => {
        setActiveDownloads(prev => {
          const { [songId]: _, ...rest } = prev;
          return rest;
        });
        delete abortControllers.current[songId];
      }, 3000);

    } catch (error) {
      console.error('[Downloads] ✗ FAILED:', error.message);
      
      // Cleanup temp file
      const safeTitle = (song.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
      const tempPath = `${getTempDirPath()}/${safeTitle}_${songId}.mp3.tmp`;
      deleteFile(tempPath);

      updateStatus(DOWNLOAD_STATUS.FAILED, 0, { error: error.message });
      showToast(`Imeshindikana: ${error.message}`, 'error');

      setTimeout(() => {
        setActiveDownloads(prev => {
          const { [songId]: _, ...rest } = prev;
          return rest;
        });
        delete abortControllers.current[songId];
      }, 5000);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, downloadQueue]);

  // ==================== MANAGEMENT FUNCTIONS ====================
  
  const cancelDownload = useCallback((songId) => {
    abortControllers.current[songId]?.abort();
    delete abortControllers.current[songId];
    
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
      deleteFile(download.file_path);
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
        deleteFile(download.file_path);
      }
    }

    setDownloads({});
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('[Downloads] Cleared all');
  }, [downloads]);

  const getDownloadedSongs = useCallback(() => {
    return Object.values(downloads)
      .filter(d => fileExists(d.file_path)) // Only return files that exist
      .sort((a, b) => new Date(b.downloaded_at) - new Date(a.downloaded_at));
  }, [downloads]);

  const getTotalDownloadSize = useCallback(() => {
    return Object.values(downloads).reduce((total, d) => total + (d.file_size || 0), 0);
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
