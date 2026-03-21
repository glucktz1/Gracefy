/**
 * ShareButton Component
 * 
 * Reusable share button for songs, albums, playlists
 */

import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shareSong, shareAlbum, sharePlaylist, shareNowPlaying } from '../services/sharing';

const ShareButton = ({ 
  type = 'song', // 'song', 'album', 'playlist', 'now-playing'
  item = null,
  currentTrack = null,
  currentAlbum = null,
  size = 24,
  color = '#fff',
  style = {},
  onShareStart,
  onShareEnd,
}) => {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    
    setIsSharing(true);
    onShareStart?.();
    
    try {
      let result;
      
      switch (type) {
        case 'song':
          if (!item) throw new Error('No song to share');
          result = await shareSong(item, item.album);
          break;
          
        case 'album':
          if (!item) throw new Error('No album to share');
          result = await shareAlbum(item);
          break;
          
        case 'playlist':
          if (!item) throw new Error('No playlist to share');
          result = await sharePlaylist(item);
          break;
          
        case 'now-playing':
          if (!currentTrack) throw new Error('No song is playing');
          result = await shareNowPlaying(currentTrack, currentAlbum);
          break;
          
        default:
          throw new Error('Invalid share type');
      }
      
      console.log('[Share] Share result:', result?.action);
    } catch (error) {
      console.error('[Share] Error:', error);
      // Only show error if it's not a user cancellation
      if (error.message && !error.message.includes('cancel')) {
        Alert.alert('Hitilafu', 'Imeshindwa kushiriki. Jaribu tena.');
      }
    } finally {
      setIsSharing(false);
      onShareEnd?.();
    }
  };

  return (
    <TouchableOpacity 
      onPress={handleShare} 
      disabled={isSharing}
      style={[styles.button, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {isSharing ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name="share-social-outline" size={size} color={color} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ShareButton;
