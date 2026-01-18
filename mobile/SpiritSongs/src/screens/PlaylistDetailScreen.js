/**
 * Playlist Detail Screen
 * Shows songs in a user playlist with Play All functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Alert, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { libraryService, getThumbnailUrl, contentService } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import SongListItem from '../components/SongListItem';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

export default function PlaylistDetailScreen({ route, navigation }) {
  const { playlistId } = route.params;
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { currentSong, playSong } = usePlayer();

  const fetchPlaylist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get playlist details with songs
      const data = await libraryService.getPlaylist(playlistId);
      console.log('Playlist data:', data);
      
      setPlaylist(data.playlist || data);
      
      // Parse songs from the response - backend returns {song, album} objects
      const songsFromResponse = data.songs || [];
      const parsedSongs = songsFromResponse.map(item => {
        // If item has a 'song' property, extract it
        if (item.song) {
          return {
            ...item.song,
            album: item.album,
          };
        }
        // Otherwise, use the item directly
        return item;
      });
      
      setSongs(parsedSongs);
    } catch (error) {
      console.error('Error fetching playlist:', error);
      setError('Could not load playlist');
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  const handlePlayAll = () => {
    if (songs.length === 0) {
      Alert.alert('Empty Playlist', 'Add some songs to this playlist first');
      return;
    }
    
    const queue = songs.map(song => ({
      song,
      album: {
        album_id: playlist?.playlist_id,
        title: playlist?.name || 'Playlist',
        artist_name: 'Various Artists',
        thumbnail: song.thumbnail,
      }
    }));
    
    playSong(songs[0], queue[0].album, queue, 0);
  };

  const handlePlaySong = (song, index) => {
    const album = {
      album_id: playlist?.playlist_id,
      title: playlist?.name || 'Playlist',
      artist_name: song.artist_name || 'Unknown Artist',
      thumbnail: song.thumbnail,
    };
    
    const queue = songs.map(s => ({
      song: s,
      album: {
        album_id: playlist?.playlist_id,
        title: playlist?.name || 'Playlist',
        artist_name: s.artist_name || 'Unknown Artist',
        thumbnail: s.thumbnail,
      }
    }));
    
    playSong(song, album, queue, index);
  };

  const handleRemoveSong = async (song) => {
    Alert.alert(
      'Remove Song',
      `Remove "${song.title}" from this playlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Note: Backend API needed for removing from playlist
              setSongs(prev => prev.filter(s => s.song_id !== song.song_id));
              Alert.alert('Removed', 'Song removed from playlist');
            } catch (error) {
              Alert.alert('Error', 'Could not remove song');
            }
          }
        }
      ]
    );
  };

  const handleShuffle = () => {
    if (songs.length === 0) {
      Alert.alert('Empty Playlist', 'Add some songs to this playlist first');
      return;
    }
    
    const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
    const queue = shuffledSongs.map(song => ({
      song,
      album: {
        album_id: playlist?.playlist_id,
        title: playlist?.name || 'Playlist',
        artist_name: song.artist_name || 'Unknown Artist',
        thumbnail: song.thumbnail,
      }
    }));
    
    playSong(shuffledSongs[0], queue[0].album, queue, 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchPlaylist}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentPadding}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Playlist Cover */}
        <View style={styles.coverSection}>
          <View style={styles.coverArt}>
            <LinearGradient 
              colors={['#4CAF50', '#2E7D32']} 
              style={styles.coverGradient}
            >
              <Ionicons name="musical-notes" size={60} color="rgba(255,255,255,0.5)" />
            </LinearGradient>
          </View>
          
          <Text style={styles.playlistName}>{playlist?.name || 'Playlist'}</Text>
          <Text style={styles.playlistMeta}>
            {songs.length} song{songs.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.shuffleBtn}
            onPress={handleShuffle}
          >
            <Ionicons name="shuffle" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.playAllBtn}
            onPress={handlePlayAll}
            disabled={songs.length === 0}
          >
            <Ionicons name="play" size={28} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Songs List */}
        <View style={styles.songsList}>
          {songs.length > 0 ? (
            songs.map((song, index) => (
              <TouchableOpacity
                key={song.song_id || index}
                style={[
                  styles.songItem,
                  currentSong?.song_id === song.song_id && styles.songItemActive
                ]}
                onPress={() => handlePlaySong(song, index)}
                onLongPress={() => handleRemoveSong(song)}
              >
                <Text style={styles.songIndex}>{index + 1}</Text>
                <View style={styles.songArt}>
                  {song.thumbnail ? (
                    <Image 
                      source={{ uri: getThumbnailUrl(song.thumbnail) }} 
                      style={styles.songImg} 
                    />
                  ) : (
                    <LinearGradient 
                      colors={['#333', '#222']} 
                      style={styles.songImg}
                    >
                      <Ionicons name="musical-notes" size={16} color="rgba(255,255,255,0.3)" />
                    </LinearGradient>
                  )}
                </View>
                <View style={styles.songInfo}>
                  <Text 
                    style={[
                      styles.songTitle,
                      currentSong?.song_id === song.song_id && styles.activeSongTitle
                    ]} 
                    numberOfLines={1}
                  >
                    {song.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {song.artist_name || 'Unknown Artist'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.moreBtn}
                  onPress={() => handleRemoveSong(song)}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Songs Yet</Text>
              <Text style={styles.emptySubtitle}>
                Add songs to this playlist from the Now Playing screen
              </Text>
            </View>
          )}
        </View>

        {/* Long Press Hint */}
        {songs.length > 0 && (
          <Text style={styles.hintText}>
            Long press a song to remove it
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverSection: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  coverArt: {
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  coverGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistName: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  playlistMeta: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
    paddingHorizontal: 32,
  },
  shuffleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playAllBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  songsList: {
    paddingHorizontal: 16,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  songItemActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
  },
  songIndex: {
    color: COLORS.textMuted,
    fontSize: 14,
    width: 28,
    textAlign: 'center',
  },
  songArt: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  songImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  activeSongTitle: {
    color: '#3498DB',
  },
  songArtist: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  moreBtn: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    paddingBottom: 32,
  },
});
