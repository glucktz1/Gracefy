/**
 * useLiveListenerCounts - polls /api/analytics/live-listeners/counts
 *
 * Returns `{ byAlbum, bySong, total }` and refreshes every 30s.
 * The badge component re-renders only when the count for its specific
 * album / song actually changes.
 */

import { useEffect, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Module-level state so all <LiveListenerBadge /> instances share one fetch.
let _cache = { byAlbum: {}, bySong: {}, total: 0 };
let _listeners = new Set();
let _interval = null;

const _notify = () => _listeners.forEach((cb) => cb(_cache));

const _fetch = async () => {
  try {
    const res = await axios.get(`${API}/analytics/live-listeners/counts`);
    _cache = {
      byAlbum: res.data?.by_album || {},
      bySong: res.data?.by_song || {},
      total: res.data?.total || 0,
    };
    _notify();
  } catch (_) {
    // network blip - keep last cache
  }
};

const _ensurePolling = () => {
  if (_interval) return;
  _fetch();
  _interval = setInterval(_fetch, 30000);
};

const _stopIfIdle = () => {
  if (_listeners.size === 0 && _interval) {
    clearInterval(_interval);
    _interval = null;
  }
};

export const useLiveListenerCounts = () => {
  const [counts, setCounts] = useState(_cache);

  useEffect(() => {
    _listeners.add(setCounts);
    _ensurePolling();
    return () => {
      _listeners.delete(setCounts);
      _stopIfIdle();
    };
  }, []);

  return counts;
};

export const useLiveListenersForAlbum = (albumId) => {
  const { byAlbum } = useLiveListenerCounts();
  return albumId ? byAlbum[albumId] || 0 : 0;
};

export const useLiveListenersForSong = (songId) => {
  const { bySong } = useLiveListenerCounts();
  return songId ? bySong[songId] || 0 : 0;
};
