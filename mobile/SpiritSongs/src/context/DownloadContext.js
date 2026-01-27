import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DownloadContext = createContext();

const DOWNLOADS_KEY = '@gracefy_downloads';
const DOWNLOAD_DIR = `${FileSystem.documentDirectory}downloads/`;

export const DownloadProvider = ({ children }) => {
  const [downloads, setDownloads] = useState([]);
  const [downloadedSongIds, setDownloadedSongIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Load downloads from AsyncStorage on mount
  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      setLoading(true);
      
      // Load saved downloads metadata
      const savedDownloads = await AsyncStorage.getItem(DOWNLOADS_KEY);
      let downloadsList = savedDownloads ? JSON.parse(savedDownloads) : [];
      
      // Verify each file still exists
      const verifiedDownloads = [];
      for (const song of downloadsList) {
        if (song.localPath) {
          const fileInfo = await FileSystem.getInfoAsync(song.localPath);
          if (fileInfo.exists && fileInfo.size > 1000) {
            verifiedDownloads.push(song);
          }
        }
      }
      
      // Update state
      setDownloads(verifiedDownloads);
      setDownloadedSongIds(new Set(verifiedDownloads.map(s => s.song_id)));
      
      // Save verified list back
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(verifiedDownloads));
    } catch (error) {
      console.error('Error loading downloads:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if a song is downloaded
  const isDownloaded = useCallback((songId) => {
    return downloadedSongIds.has(songId);
  }, [downloadedSongIds]);

  // Get local path for a downloaded song
  const getLocalPath = useCallback((songId) => {
    const song = downloads.find(s => s.song_id === songId);
    return song?.localPath || null;
  }, [downloads]);

  // Add a download to the list
  const addDownload = async (song, localPath) => {
    try {
      const downloadedSong = {
        ...song,
        localPath,
        downloadedAt: new Date().toISOString(),
      };
      
      const newDownloads = [downloadedSong, ...downloads.filter(s => s.song_id !== song.song_id)];
      setDownloads(newDownloads);
      setDownloadedSongIds(new Set(newDownloads.map(s => s.song_id)));
      
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(newDownloads));
      return true;
    } catch (error) {
      console.error('Error adding download:', error);
      return false;
    }
  };

  // Remove a download
  const removeDownload = async (songId) => {
    try {
      const song = downloads.find(s => s.song_id === songId);
      
      // Delete the file
      if (song?.localPath) {
        const fileInfo = await FileSystem.getInfoAsync(song.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(song.localPath);
        }
      }
      
      const newDownloads = downloads.filter(s => s.song_id !== songId);
      setDownloads(newDownloads);
      setDownloadedSongIds(new Set(newDownloads.map(s => s.song_id)));
      
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(newDownloads));
      return true;
    } catch (error) {
      console.error('Error removing download:', error);
      return false;
    }
  };

  // Clear all downloads
  const clearAllDownloads = async () => {
    try {
      // Delete all files
      for (const song of downloads) {
        if (song.localPath) {
          try {
            await FileSystem.deleteAsync(song.localPath);
          } catch (e) {
            console.log('Could not delete:', song.localPath);
          }
        }
      }
      
      setDownloads([]);
      setDownloadedSongIds(new Set());
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify([]));
      return true;
    } catch (error) {
      console.error('Error clearing downloads:', error);
      return false;
    }
  };

  // Get total download size
  const getTotalSize = useCallback(async () => {
    let totalSize = 0;
    for (const song of downloads) {
      if (song.localPath) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(song.localPath);
          if (fileInfo.exists) {
            totalSize += fileInfo.size || 0;
          }
        } catch (e) {
          // ignore
        }
      }
    }
    return totalSize;
  }, [downloads]);

  const value = {
    downloads,
    downloadedSongIds,
    loading,
    isDownloaded,
    getLocalPath,
    addDownload,
    removeDownload,
    clearAllDownloads,
    getTotalSize,
    refreshDownloads: loadDownloads,
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
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
};

export default DownloadContext;
