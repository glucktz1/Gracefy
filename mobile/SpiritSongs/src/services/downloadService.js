import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getAudioUrl } from './api';

// Use app-specific directories that don't require permissions
const getDownloadsDirOptions = () => {
  const options = [];
  
  // Primary: document directory (persistent, app-specific)
  if (FileSystem.documentDirectory) {
    options.push(`${FileSystem.documentDirectory}songs/`);
  }
  
  // Secondary: cache directory
  if (FileSystem.cacheDirectory) {
    options.push(`${FileSystem.cacheDirectory}gracefy_songs/`);
  }
  
  return options;
};

const DOWNLOADS_INDEX_KEY = 'downloaded_songs';
const WORKING_DIR_KEY = 'working_downloads_dir';

// Get the working downloads directory (cached once found)
let workingDir = null;

// No permission request needed for app-specific directories
const requestStoragePermission = async () => {
  // App-specific directories don't need permissions on modern Android
  return { granted: true, message: 'Using app-specific storage' };
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
  
  // Request/check permissions first on Android (for logging purposes)
  const permResult = await requestStoragePermission();
  console.log('Storage permission result:', permResult.message);
  
  // Try each directory option - prioritize documentDirectory as it's persistent
  const dirOptions = getDownloadsDirOptions();
  console.log('Trying', dirOptions.length, 'directory options...');
  
  for (const dir of dirOptions) {
    try {
      console.log('Trying directory:', dir);
      
      // Check if directory exists
      let dirInfo;
      try {
        dirInfo = await FileSystem.getInfoAsync(dir);
      } catch (infoError) {
        console.log('Error checking directory info:', dir, infoError.message);
        continue;
      }
      
      if (!dirInfo.exists) {
        // Try to create it
        try {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          console.log('Created directory:', dir);
        } catch (mkdirError) {
          console.log('Failed to create directory:', dir, mkdirError.message);
          // Check if it was created despite the error
          try {
            const recheckInfo = await FileSystem.getInfoAsync(dir);
            if (!recheckInfo.exists) {
              console.log('Directory still does not exist after creation attempt');
              continue;
            }
          } catch (e) {
            continue;
          }
        }
      }
      
      // Verify directory is accessible by creating a test file
      const testFile = `${dir}test_${Date.now()}.tmp`;
      try {
        await FileSystem.writeAsStringAsync(testFile, 'test', { encoding: FileSystem.EncodingType.UTF8 });
        // Try to delete test file
        try {
          await FileSystem.deleteAsync(testFile, { idempotent: true });
        } catch (deleteError) {
          // Ignore delete errors
        }
        console.log('Directory is writable:', dir);
        
        // Save this as the working directory
        workingDir = dir;
        try {
          await SecureStore.setItemAsync(WORKING_DIR_KEY, dir);
        } catch (saveError) {
          console.log('Could not save working dir to SecureStore:', saveError.message);
        }
        
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
  return { 
    success: false, 
    dir: null, 
    error: 'Imeshindwa kupata nafasi ya kuhifadhi. Tafadhali jaribu tena.' 
  };
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
      console.error('Directory creation failed:', dirResult.error);
      throw new Error(dirResult.error || 'Imeshindwa kupata nafasi ya kuhifadhi.');
    }
    
    const downloadDir = dirResult.dir;
    
    const audioUrl = getAudioUrl(song.audio_url);
    if (!audioUrl) {
      console.error('No audio URL for song:', song.song_id);
      throw new Error('Hakuna link ya wimbo huu');
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
        throw new Error('Faili iliyopakuliwa ni tupu');
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
    
    throw new Error('Upakulizi umeshindwa - jaribu tena');
  } catch (error) {
    console.error('Error downloading song:', error);
    
    // Try to refresh directory cache and give a helpful error
    workingDir = null;
    
    // Return a user-friendly error message
    if (error.message.includes('permission') || error.message.includes('access') || error.message.includes('denied')) {
      throw new Error('Tafadhali funga na ufungue app tena, kisha jaribu kupakua.');
    }
    
    if (error.message.includes('network') || error.message.includes('Network')) {
      throw new Error('Hakuna mtandao. Tafadhali angalia muunganisho wako.');
    }
    
    throw new Error(error.message || 'Imeshindwa kupakua wimbo');
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
