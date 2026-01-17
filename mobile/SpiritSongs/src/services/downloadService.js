import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { getAudioUrl } from './api';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}songs/`;
const DOWNLOADS_INDEX_KEY = 'downloaded_songs';

// Ensure downloads directory exists with retry
const ensureDownloadsDir = async (retries = 3) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
        console.log('Downloads directory created:', DOWNLOADS_DIR);
      }
      // Verify it was created
      const verifyInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (verifyInfo.exists) {
        return true;
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} - Error creating downloads directory:`, error);
      if (attempt === retries - 1) {
        // Last attempt - try alternative location
        try {
          const altDir = `${FileSystem.cacheDirectory}downloads/`;
          await FileSystem.makeDirectoryAsync(altDir, { intermediates: true });
          console.log('Using alternative cache directory:', altDir);
          return true;
        } catch (altError) {
          console.error('Alternative directory also failed:', altError);
          return false;
        }
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
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
    const downloadPath = `${DOWNLOADS_DIR}${songId}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(downloadPath);
    return fileInfo.exists;
  } catch (error) {
    return false;
  }
};

// Download a song - Using callback-based download
export const downloadSong = async (song, album, onProgress) => {
  try {
    console.log('Download requested for:', song.title);
    
    const dirReady = await ensureDownloadsDir();
    if (!dirReady) {
      console.error('Directory creation failed');
      throw new Error('Could not create downloads directory. Please check app permissions.');
    }
    
    const audioUrl = getAudioUrl(song.audio_url);
    if (!audioUrl) {
      console.error('No audio URL for song:', song.song_id);
      throw new Error('No audio URL available for this song');
    }
    
    console.log('Starting download from:', audioUrl);
    
    // Determine download path - use cache dir as fallback
    let downloadPath = `${DOWNLOADS_DIR}${song.song_id}.mp3`;
    
    // Verify directory exists before download
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!dirInfo.exists) {
      // Try cache directory as fallback
      const cacheDir = `${FileSystem.cacheDirectory}downloads/`;
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      downloadPath = `${cacheDir}${song.song_id}.mp3`;
      console.log('Using cache directory for download:', downloadPath);
    }
    
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
      {},
      callback
    );
    
    // Start download
    const result = await downloadResumable.downloadAsync();
    
    if (result && result.uri) {
      console.log('Download complete:', result.uri);
      
      // Update downloads index
      const downloads = await getDownloadedSongs();
      const songData = {
        song_id: song.song_id,
        title: song.title,
        artist_name: song.artist_name || album?.artist_name || 'Unknown Artist',
        duration: song.duration,
        thumbnail: song.thumbnail || album?.thumbnail,
        album_id: album?.album_id,
        album_title: album?.title,
        downloaded_at: new Date().toISOString(),
        local_path: downloadPath,
      };
      
      // Remove existing entry if any, then add new
      const filtered = downloads.filter(d => d.song_id !== song.song_id);
      filtered.push(songData);
      await saveDownloadedSongs(filtered);
      
      return { success: true, path: downloadPath };
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
    const downloadPath = `${DOWNLOADS_DIR}${songId}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(downloadPath);
    
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(downloadPath, { idempotent: true });
    }
    
    // Update downloads index
    const downloads = await getDownloadedSongs();
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
    const downloadPath = `${DOWNLOADS_DIR}${songId}.mp3`;
    const fileInfo = await FileSystem.getInfoAsync(downloadPath);
    return fileInfo.exists ? downloadPath : null;
  } catch (error) {
    return null;
  }
};

// Get total download size
export const getDownloadsSize = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (!dirInfo.exists) return 0;
    
    const files = await FileSystem.readDirectoryAsync(DOWNLOADS_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(`${DOWNLOADS_DIR}${file}`);
        if (fileInfo.size) {
          totalSize += fileInfo.size;
        }
      } catch (e) {
        // Skip files that can't be read
      }
    }
    
    return totalSize;
  } catch (error) {
    return 0;
  }
};

// Clear all downloads
export const clearAllDownloads = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(DOWNLOADS_DIR, { idempotent: true });
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
