import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getAudioUrl } from './api';

// Use documentDirectory for iOS and cacheDirectory for Android (more reliable on Android)
const getDownloadsDir = () => {
  if (Platform.OS === 'android') {
    return `${FileSystem.cacheDirectory}gracefy_songs/`;
  }
  return `${FileSystem.documentDirectory}songs/`;
};

const DOWNLOADS_DIR = getDownloadsDir();
const DOWNLOADS_INDEX_KEY = 'downloaded_songs';

// Ensure downloads directory exists with retry and better error handling
const ensureDownloadsDir = async (retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // First check if the parent directory is accessible
      const parentDir = Platform.OS === 'android' 
        ? FileSystem.cacheDirectory 
        : FileSystem.documentDirectory;
      
      const parentInfo = await FileSystem.getInfoAsync(parentDir);
      if (!parentInfo.exists) {
        console.error('Parent directory does not exist:', parentDir);
        throw new Error('Storage not accessible');
      }
      
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
        console.log('Downloads directory created:', DOWNLOADS_DIR);
      }
      
      // Verify it was created
      const verifyInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (verifyInfo.exists) {
        return { success: true, dir: DOWNLOADS_DIR };
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} - Error creating downloads directory:`, error);
      
      if (attempt === retries - 1) {
        // Last attempt - try alternative location (cache directory on both platforms)
        try {
          const altDir = `${FileSystem.cacheDirectory}gracefy_downloads/`;
          const altDirInfo = await FileSystem.getInfoAsync(altDir);
          if (!altDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(altDir, { intermediates: true });
          }
          console.log('Using alternative cache directory:', altDir);
          return { success: true, dir: altDir };
        } catch (altError) {
          console.error('Alternative directory also failed:', altError);
          return { success: false, dir: null };
        }
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return { success: false, dir: null };
};

// Get list of downloaded songs
export const getDownloadedSongs = async () => {
  try {
    const data = await SecureStore.getItemAsync(DOWNLOADS_INDEX_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting downloaded songs:', error);
    return [];
  }
};

// Save downloaded songs index
const saveDownloadedSongs = async (songs) => {
  try {
    await SecureStore.setItemAsync(DOWNLOADS_INDEX_KEY, JSON.stringify(songs));
  } catch (error) {
    console.error('Error saving downloads index:', error);
  }
};

// Check if a song is downloaded - checks both index and file existence
export const isSongDownloaded = async (songId) => {
  try {
    // First check from index (has the actual path)
    const downloads = await getDownloadedSongs();
    const downloaded = downloads.find(d => d.song_id === songId);
    if (downloaded && downloaded.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(downloaded.local_path);
      return fileInfo.exists;
    }
    
    // Fallback: check in standard directory
    const dirResult = await ensureDownloadsDir();
    if (dirResult.success) {
      const safeId = songId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const downloadPath = `${dirResult.dir}${safeId}.mp3`;
      const fileInfo = await FileSystem.getInfoAsync(downloadPath);
      return fileInfo.exists;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking download status:', error);
    return false;
  }
};

// Download a song - Using callback-based download
export const downloadSong = async (song, album, onProgress) => {
  try {
    console.log('Download requested for:', song.title);
    
    const dirResult = await ensureDownloadsDir();
    if (!dirResult.success) {
      console.error('Directory creation failed');
      throw new Error('Could not create downloads directory. Please check app permissions or try again.');
    }
    
    const downloadDir = dirResult.dir;
    
    const audioUrl = getAudioUrl(song.audio_url);
    if (!audioUrl) {
      console.error('No audio URL for song:', song.song_id);
      throw new Error('No audio URL available for this song');
    }
    
    console.log('Starting download from:', audioUrl);
    console.log('Download directory:', downloadDir);
    
    // Sanitize filename - remove special characters
    const safeId = song.song_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    let downloadPath = `${downloadDir}${safeId}.mp3`;
    
    // Use callback-based download with progress
    const callback = (downloadProgress) => {
      if (downloadProgress.totalBytesExpectedToWrite > 0) {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) {
          onProgress(progress);
        }
      }
    };
    
    // Create download resumable
    const downloadResumable = FileSystem.createDownloadResumable(
      audioUrl,
      downloadPath,
      {
        headers: {
          'Accept': 'audio/mpeg, audio/*',
        },
      },
      callback
    );
    
    // Start download
    const result = await downloadResumable.downloadAsync();
    
    if (result && result.uri) {
      console.log('Download complete:', result.uri);
      
      // Verify file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Downloaded file is empty or missing');
      }
      
      // Update downloads index
      const downloads = await getDownloadedSongs();
      const songData = {
        song_id: song.song_id,
        title: song.title,
        artist_name: song.artist_name || album?.artist_name || 'Unknown Artist',
        duration: song.duration,
        thumbnail: song.thumbnail || song.thumbnail_url || album?.thumbnail || album?.thumbnail_url,
        album_id: album?.album_id,
        album_title: album?.title,
        downloaded_at: new Date().toISOString(),
        local_path: result.uri, // Use the actual result URI
      };
      
      // Remove existing entry if any, then add new
      const filtered = downloads.filter(d => d.song_id !== song.song_id);
      filtered.push(songData);
      await saveDownloadedSongs(filtered);
      
      return { success: true, path: result.uri };
    }
    
    throw new Error('Download failed - no result');
  } catch (error) {
    console.error('Error downloading song:', error);
    throw error;
  }
};

// Remove a downloaded song
export const removeDownload = async (songId) => {
  try {
    // First check from index (has the actual path)
    const downloads = await getDownloadedSongs();
    const downloaded = downloads.find(d => d.song_id === songId);
    
    if (downloaded && downloaded.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(downloaded.local_path);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(downloaded.local_path, { idempotent: true });
      }
    } else {
      // Fallback: try standard location
      const dirResult = await ensureDownloadsDir();
      if (dirResult.success) {
        const safeId = songId.replace(/[^a-zA-Z0-9_-]/g, '_');
        const downloadPath = `${dirResult.dir}${safeId}.mp3`;
        const fileInfo = await FileSystem.getInfoAsync(downloadPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(downloadPath, { idempotent: true });
        }
      }
    }
    
    // Update downloads index
    const filtered = downloads.filter(d => d.song_id !== songId);
    await saveDownloadedSongs(filtered);
    
    return { success: true };
  } catch (error) {
    console.error('Error removing download:', error);
    throw error;
  }
};

// Get local path for a downloaded song
export const getLocalSongPath = async (songId) => {
  try {
    // First check from index (has the actual path)
    const downloads = await getDownloadedSongs();
    const downloaded = downloads.find(d => d.song_id === songId);
    
    if (downloaded && downloaded.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(downloaded.local_path);
      if (fileInfo.exists) {
        return downloaded.local_path;
      }
    }
    
    // Fallback: check in standard directory
    const dirResult = await ensureDownloadsDir();
    if (dirResult.success) {
      const safeId = songId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const downloadPath = `${dirResult.dir}${safeId}.mp3`;
      const fileInfo = await FileSystem.getInfoAsync(downloadPath);
      if (fileInfo.exists) {
        return downloadPath;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting local song path:', error);
    return null;
  }
};

// Get total download size
export const getDownloadsSize = async () => {
  try {
    const downloads = await getDownloadedSongs();
    let totalSize = 0;
    
    for (const download of downloads) {
      if (download.local_path) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(download.local_path);
          if (fileInfo.exists && fileInfo.size) {
            totalSize += fileInfo.size;
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error getting downloads size:', error);
    return 0;
  }
};

// Clear all downloads
export const clearAllDownloads = async () => {
  try {
    // Delete all files from downloaded songs index
    const downloads = await getDownloadedSongs();
    for (const download of downloads) {
      if (download.local_path) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(download.local_path);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(download.local_path, { idempotent: true });
          }
        } catch (e) {
          console.log('Error deleting file:', e);
        }
      }
    }
    
    // Also try to clean up the download directory
    const dirResult = await ensureDownloadsDir();
    if (dirResult.success) {
      try {
        await FileSystem.deleteAsync(dirResult.dir, { idempotent: true });
      } catch (e) {
        console.log('Error deleting directory:', e);
      }
    }
    
    await saveDownloadedSongs([]);
    return { success: true };
  } catch (error) {
    console.error('Error clearing downloads:', error);
    throw error;
  }
};

export default {
  getDownloadedSongs,
  isSongDownloaded,
  downloadSong,
  removeDownload,
  getLocalSongPath,
  getDownloadsSize,
  clearAllDownloads,
};
