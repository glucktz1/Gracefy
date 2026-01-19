import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform, PermissionsAndroid } from 'react-native';
import { getAudioUrl } from './api';

// Use multiple fallback directories for maximum compatibility
const getDownloadsDirOptions = () => {
  const options = [];
  
  // Primary: cache directory (more reliable on Android)
  if (FileSystem.cacheDirectory) {
    options.push(`${FileSystem.cacheDirectory}gracefy_songs/`);
  }
  
  // Secondary: document directory (persistent storage)
  if (FileSystem.documentDirectory) {
    options.push(`${FileSystem.documentDirectory}songs/`);
  }
  
  // Tertiary: another cache path
  if (FileSystem.cacheDirectory) {
    options.push(`${FileSystem.cacheDirectory}gracefy_downloads/`);
  }
  
  return options;
};

const DOWNLOADS_INDEX_KEY = 'downloaded_songs';
const WORKING_DIR_KEY = 'working_downloads_dir';

// Get the working downloads directory (cached once found)
let workingDir = null;

// Request Android storage permissions if needed
const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') return true;
  
  try {
    // For Android 13+, we don't need to request legacy storage permissions
    // since we're using app-specific directories
    if (Platform.Version >= 33) {
      return true;
    }
    
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message: 'Gracefy needs storage access to download songs for offline listening.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.log('Permission request error:', err);
    return true; // Continue anyway with app-specific storage
  }
};

// Ensure downloads directory exists with multiple fallbacks
const ensureDownloadsDir = async (forceRefresh = false) => {
  // Return cached working directory if available
  if (!forceRefresh && workingDir) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(workingDir);
      if (dirInfo.exists) {
        return { success: true, dir: workingDir };
      }
    } catch (e) {
      console.log('Cached dir no longer valid, finding new one...');
    }
    workingDir = null;
  }
  
  // Try to get saved working directory
  if (!forceRefresh) {
    try {
      const savedDir = await SecureStore.getItemAsync(WORKING_DIR_KEY);
      if (savedDir) {
        const dirInfo = await FileSystem.getInfoAsync(savedDir);
        if (dirInfo.exists) {
          workingDir = savedDir;
          return { success: true, dir: savedDir };
        }
      }
    } catch (e) {
      console.log('Error checking saved dir:', e);
    }
  }
  
  // Request permissions first on Android
  await requestStoragePermission();
  
  // Try each directory option
  const dirOptions = getDownloadsDirOptions();
  
  for (const dir of dirOptions) {
    try {
      console.log('Trying directory:', dir);
      
      // Check if directory exists
      const dirInfo = await FileSystem.getInfoAsync(dir);
      
      if (!dirInfo.exists) {
        // Try to create it
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        console.log('Created directory:', dir);
      }
      
      // Verify directory is accessible by creating a test file
      const testFile = `${dir}test_${Date.now()}.tmp`;
      try {
        await FileSystem.writeAsStringAsync(testFile, 'test', { encoding: FileSystem.EncodingType.UTF8 });
        await FileSystem.deleteAsync(testFile, { idempotent: true });
        console.log('Directory is writable:', dir);
        
        // Save this as the working directory
        workingDir = dir;
        await SecureStore.setItemAsync(WORKING_DIR_KEY, dir);
        
        return { success: true, dir: dir };
      } catch (testError) {
        console.log('Directory not writable:', dir, testError.message);
        continue;
      }
    } catch (error) {
      console.log('Error with directory:', dir, error.message);
      continue;
    }
  }
  
  console.error('All directory options failed');
  return { success: false, dir: null, error: 'No writable directory found' };
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

// Check if a song is downloaded
export const isSongDownloaded = async (songId) => {
  try {
    const downloads = await getDownloadedSongs();
    const downloaded = downloads.find(d => d.song_id === songId);
    if (downloaded && downloaded.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(downloaded.local_path);
      return fileInfo.exists;
    }
    return false;
  } catch (error) {
    console.error('Error checking download status:', error);
    return false;
  }
};

// Download a song
export const downloadSong = async (song, album, onProgress) => {
  try {
    console.log('Download requested for:', song.title);
    
    // Ensure directory is available
    const dirResult = await ensureDownloadsDir();
    if (!dirResult.success) {
      console.error('Directory creation failed');
      throw new Error(
        'Unable to access storage. Please try again or check that the app has storage permission.'
      );
    }
    
    const downloadDir = dirResult.dir;
    
    const audioUrl = getAudioUrl(song.audio_url);
    if (!audioUrl) {
      console.error('No audio URL for song:', song.song_id);
      throw new Error('No audio URL available for this song');
    }
    
    console.log('Starting download from:', audioUrl);
    console.log('Download directory:', downloadDir);
    
    // Sanitize filename
    const safeId = song.song_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadPath = `${downloadDir}${safeId}.mp3`;
    
    // Check if already downloaded
    try {
      const existingFile = await FileSystem.getInfoAsync(downloadPath);
      if (existingFile.exists && existingFile.size > 0) {
        console.log('Song already downloaded at:', downloadPath);
        
        // Update index
        const downloads = await getDownloadedSongs();
        if (!downloads.find(d => d.song_id === song.song_id)) {
          const songData = {
            song_id: song.song_id,
            title: song.title,
            artist_name: song.artist_name || album?.artist_name || 'Unknown Artist',
            duration: song.duration,
            thumbnail: song.thumbnail || song.thumbnail_url || album?.thumbnail || album?.thumbnail_url,
            album_id: album?.album_id,
            album_title: album?.title,
            downloaded_at: new Date().toISOString(),
            local_path: downloadPath,
          };
          downloads.push(songData);
          await saveDownloadedSongs(downloads);
        }
        
        return { success: true, path: downloadPath };
      }
    } catch (e) {
      // File doesn't exist, continue with download
    }
    
    // Progress callback
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
      
      // Verify file
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Downloaded file is empty or missing');
      }
      
      console.log('File size:', fileInfo.size, 'bytes');
      
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
        local_path: result.uri,
        file_size: fileInfo.size,
      };
      
      const filtered = downloads.filter(d => d.song_id !== song.song_id);
      filtered.push(songData);
      await saveDownloadedSongs(filtered);
      
      return { success: true, path: result.uri };
    }
    
    throw new Error('Download failed - no result returned');
  } catch (error) {
    console.error('Error downloading song:', error);
    
    // Try to refresh directory cache and give a helpful error
    workingDir = null;
    
    if (error.message.includes('permission') || error.message.includes('access')) {
      throw new Error('Storage permission denied. Please allow storage access in app settings.');
    }
    
    throw error;
  }
};

// Remove a downloaded song
export const removeDownload = async (songId) => {
  try {
    const downloads = await getDownloadedSongs();
    const downloaded = downloads.find(d => d.song_id === songId);
    
    if (downloaded && downloaded.local_path) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(downloaded.local_path);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(downloaded.local_path, { idempotent: true });
        }
      } catch (e) {
        console.log('Error deleting file:', e);
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
    const downloads = await getDownloadedSongs();
    const downloaded = downloads.find(d => d.song_id === songId);
    
    if (downloaded && downloaded.local_path) {
      const fileInfo = await FileSystem.getInfoAsync(downloaded.local_path);
      if (fileInfo.exists) {
        return downloaded.local_path;
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
      if (download.file_size) {
        totalSize += download.file_size;
      } else if (download.local_path) {
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
    
    // Clear working directory cache
    workingDir = null;
    await SecureStore.deleteItemAsync(WORKING_DIR_KEY);
    
    await saveDownloadedSongs([]);
    return { success: true };
  } catch (error) {
    console.error('Error clearing downloads:', error);
    throw error;
  }
};

// Test storage accessibility
export const testStorageAccess = async () => {
  try {
    const result = await ensureDownloadsDir(true);
    return {
      success: result.success,
      directory: result.dir,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      directory: null,
      error: error.message,
    };
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
  testStorageAccess,
};
