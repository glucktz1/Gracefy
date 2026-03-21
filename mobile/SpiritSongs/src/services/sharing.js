/**
 * Social Sharing Service for Gracefy
 * 
 * Allows users to share:
 * - Songs with deep links
 * - Albums
 * - Playlists
 * - App itself
 */

import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Share, Platform } from 'react-native';
import { getImageUrl } from './api';

const APP_URL = 'https://gracefy.net';
const APP_STORE_URL = 'https://play.google.com/store/apps/details?id=com.gracefy.app';
const DEEP_LINK_SCHEME = 'gracefy://';

/**
 * Share a song via native share dialog
 */
export const shareSong = async (song, album = null) => {
  try {
    const songTitle = song?.title || 'Wimbo';
    const artistName = album?.artist_name || song?.artist_name || 'Gracefy';
    const albumTitle = album?.title || '';
    
    // Create shareable message
    const message = albumTitle 
      ? `🎵 Sikiliza "${songTitle}" kutoka ${albumTitle} na ${artistName} kwenye Gracefy!\n\n${APP_URL}/song/${song.song_id}`
      : `🎵 Sikiliza "${songTitle}" na ${artistName} kwenye Gracefy!\n\n${APP_URL}/song/${song.song_id}`;
    
    const result = await Share.share({
      message,
      title: `${songTitle} - ${artistName}`,
      url: `${APP_URL}/song/${song.song_id}`, // iOS only
    });
    
    return result;
  } catch (error) {
    console.error('[Share] Error sharing song:', error);
    throw error;
  }
};

/**
 * Share an album via native share dialog
 */
export const shareAlbum = async (album) => {
  try {
    const albumTitle = album?.title || 'Albamu';
    const artistName = album?.artist_name || 'Gracefy';
    const songsCount = album?.songs_count || '';
    
    // Create shareable message
    const songsText = songsCount ? ` (Nyimbo ${songsCount})` : '';
    const message = `🎶 Sikiliza albamu "${albumTitle}"${songsText} na ${artistName} kwenye Gracefy!\n\n${APP_URL}/album/${album.album_id}`;
    
    const result = await Share.share({
      message,
      title: `${albumTitle} - ${artistName}`,
      url: `${APP_URL}/album/${album.album_id}`,
    });
    
    return result;
  } catch (error) {
    console.error('[Share] Error sharing album:', error);
    throw error;
  }
};

/**
 * Share a playlist via native share dialog
 */
export const sharePlaylist = async (playlist) => {
  try {
    const playlistName = playlist?.name || 'Orodha ya Nyimbo';
    const songsCount = playlist?.songs?.length || playlist?.songs_count || '';
    
    // Create shareable message
    const songsText = songsCount ? ` (Nyimbo ${songsCount})` : '';
    const message = `🎵 Angalia orodha yangu ya nyimbo "${playlistName}"${songsText} kwenye Gracefy!\n\n${APP_URL}/playlist/${playlist.playlist_id}`;
    
    const result = await Share.share({
      message,
      title: playlistName,
      url: `${APP_URL}/playlist/${playlist.playlist_id}`,
    });
    
    return result;
  } catch (error) {
    console.error('[Share] Error sharing playlist:', error);
    throw error;
  }
};

/**
 * Share the app itself
 */
export const shareApp = async () => {
  try {
    const message = `🎵 Gracefy - Programu bora ya muziki wa Kikristo!\n\nSikiliza nyimbo, mafundisho, na redio za Kikristo bure.\n\nPakua sasa: ${APP_STORE_URL}`;
    
    const result = await Share.share({
      message,
      title: 'Gracefy - Christian Music',
      url: APP_STORE_URL,
    });
    
    return result;
  } catch (error) {
    console.error('[Share] Error sharing app:', error);
    throw error;
  }
};

/**
 * Share currently playing song (quick share from player)
 */
export const shareNowPlaying = async (currentTrack, currentAlbum) => {
  if (!currentTrack) {
    throw new Error('No song is currently playing');
  }
  
  return shareSong({
    song_id: currentTrack.song_id || currentTrack.id,
    title: currentTrack.title,
    artist_name: currentTrack.artist,
  }, currentAlbum);
};

/**
 * Share with image (downloads thumbnail and shares with it)
 * Note: This requires expo-sharing and works on supported platforms
 */
export const shareWithImage = async (item, type = 'song') => {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      // Fall back to regular share
      if (type === 'song') return shareSong(item);
      if (type === 'album') return shareAlbum(item);
      return shareApp();
    }
    
    // Get thumbnail URL
    const thumbnailUrl = getImageUrl(item.thumbnail || item.artwork);
    if (!thumbnailUrl) {
      // No image, use regular share
      if (type === 'song') return shareSong(item);
      if (type === 'album') return shareAlbum(item);
      return shareApp();
    }
    
    // Download image temporarily
    const fileUri = FileSystem.cacheDirectory + `share_${Date.now()}.jpg`;
    const downloadResult = await FileSystem.downloadAsync(thumbnailUrl, fileUri);
    
    if (downloadResult.status === 200) {
      // Share with the downloaded image
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: type === 'song' ? item.title : item.title || 'Gracefy',
      });
    } else {
      // Image download failed, use regular share
      if (type === 'song') return shareSong(item);
      if (type === 'album') return shareAlbum(item);
    }
  } catch (error) {
    console.error('[Share] Error sharing with image:', error);
    // Fall back to regular share on error
    if (type === 'song') return shareSong(item);
    if (type === 'album') return shareAlbum(item);
  }
};

export default {
  shareSong,
  shareAlbum,
  sharePlaylist,
  shareApp,
  shareNowPlaying,
  shareWithImage,
};
