import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { libraryService } from '../services/api';
import AnimatedBars from './AnimatedBars';
import { COLORS } from '../config';

const SongListItem = ({ 
  song, 
  album, 
  index, 
  queue = [], 
  showIndex = true,
  showThumbnail = false,
  onAddToPlaylist,
}) => {
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { isFavorite, addFavorite, removeFavorite, isAuthenticated } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [liked, setLiked] = useState(isFavorite(song.song_id));

  const isCurrentSong = currentSong?.song_id === song.song_id;
  const isCurrentlyPlaying = isCurrentSong && isPlaying;

  const handlePlay = () => {
    const songQueue = queue.length > 0 ? queue : [{ song, album }];
    playSong(song, album, songQueue, index);
  };

  const handleLike = async () => {
    if (!isAuthenticated) return;
    
    try {
      if (liked) {
        await libraryService.removeFromFavorites(song.song_id);
        removeFavorite(song.song_id);
        setLiked(false);
      } else {
        await libraryService.addToFavorites('song', song.song_id);
        addFavorite('song', song.song_id);
        setLiked(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleShare = () => {
    setMenuVisible(false);
    // Share functionality would go here
  };

  const handleAddToPlaylist = () => {
    setMenuVisible(false);
    if (onAddToPlaylist) {
      onAddToPlaylist(song);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.container, isCurrentSong && styles.activeContainer]} 
        onPress={handlePlay}
        activeOpacity={0.7}
      >
        {/* Index or Thumbnail or Bars */}
        <View style={styles.leftSection}>
          {isCurrentlyPlaying ? (
            <AnimatedBars isPlaying={true} size="small" />
          ) : showThumbnail ? (
            <View style={styles.thumbnailContainer}>
              {song.thumbnail || album?.thumbnail ? (
                <Image 
                  source={{ uri: song.thumbnail || album?.thumbnail }} 
                  style={styles.thumbnail}
                />
              ) : (
                <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.thumbnail}>
                  <Ionicons name="musical-notes" size={16} color="rgba(255,255,255,0.6)" />
                </LinearGradient>
              )}
            </View>
          ) : showIndex ? (
            <Text style={[styles.indexText, isCurrentSong && styles.activeText]}>
              {index + 1}
            </Text>
          ) : null}
        </View>

        {/* Song Info */}
        <View style={styles.infoContainer}>
          <Text 
            style={[styles.songTitle, isCurrentSong && styles.activeText]} 
            numberOfLines={1}
          >
            {song.title}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {song.artist_name || album?.artist_name || 'Unknown Artist'}
          </Text>
        </View>

        {/* Like Button */}
        {isAuthenticated && (
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Ionicons 
              name={liked ? 'heart' : 'heart-outline'} 
              size={20} 
              color={liked ? COLORS.primary : COLORS.textSecondary} 
            />
          </TouchableOpacity>
        )}

        {/* Duration */}
        <Text style={styles.duration}>{formatDuration(song.duration)}</Text>

        {/* Menu Button */}
        <TouchableOpacity 
          onPress={() => setMenuVisible(true)} 
          style={styles.menuButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Action Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            {/* Song Header in Menu */}
            <View style={styles.menuHeader}>
              <View style={styles.menuThumbnail}>
                {song.thumbnail || album?.thumbnail ? (
                  <Image 
                    source={{ uri: song.thumbnail || album?.thumbnail }} 
                    style={styles.menuThumbnailImg}
                  />
                ) : (
                  <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.menuThumbnailImg}>
                    <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                )}
              </View>
              <View style={styles.menuHeaderInfo}>
                <Text style={styles.menuSongTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.menuArtistName} numberOfLines={1}>
                  {song.artist_name || album?.artist_name}
                </Text>
              </View>
            </View>

            {/* Menu Options */}
            <View style={styles.menuOptions}>
              <TouchableOpacity style={styles.menuOption} onPress={handleLike}>
                <Ionicons 
                  name={liked ? 'heart' : 'heart-outline'} 
                  size={24} 
                  color={liked ? COLORS.primary : COLORS.textPrimary} 
                />
                <Text style={styles.menuOptionText}>
                  {liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuOption} onPress={handleAddToPlaylist}>
                <Ionicons name="add-circle-outline" size={24} color={COLORS.textPrimary} />
                <Text style={styles.menuOptionText}>Add to Playlist</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuOption} onPress={handleShare}>
                <Ionicons name="share-outline" size={24} color={COLORS.textPrimary} />
                <Text style={styles.menuOptionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuOption}>
                <Ionicons name="person-outline" size={24} color={COLORS.textPrimary} />
                <Text style={styles.menuOptionText}>View Artist</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuOption}>
                <Ionicons name="disc-outline" size={24} color={COLORS.textPrimary} />
                <Text style={styles.menuOptionText}>View Album</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  activeContainer: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  leftSection: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  activeText: {
    color: COLORS.primary,
  },
  thumbnailContainer: {
    width: 40,
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  songTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  artistName: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  actionButton: {
    padding: 8,
  },
  duration: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginHorizontal: 8,
    minWidth: 40,
    textAlign: 'right',
  },
  menuButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: COLORS.backgroundCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
  },
  menuThumbnailImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  menuSongTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  menuArtistName: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  menuOptions: {
    paddingTop: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuOptionText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    marginLeft: 16,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SongListItem;
