/**
 * LiveListenerBadge - small "🔴 N listening" social-proof badge
 *
 * Renders nothing when count <= 0. Pulse animation draws the eye.
 */

import React from 'react';
import { useLiveListenersForAlbum, useLiveListenersForSong } from '../hooks/useLiveListenerCounts';

const formatCount = (n) => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
};

export const LiveListenerBadge = ({ albumId, songId, size = 'sm', className = '' }) => {
  const albumCount = useLiveListenersForAlbum(albumId);
  const songCount = useLiveListenersForSong(songId);
  const count = songId ? songCount : albumCount;

  if (!count || count <= 0) return null;

  const sizeCls =
    size === 'lg'
      ? 'text-xs px-2.5 py-1 gap-1.5'
      : 'text-[10px] px-1.5 py-0.5 gap-1';

  return (
    <div
      data-testid={`live-listener-badge-${albumId || songId}`}
      className={`inline-flex items-center ${sizeCls} rounded-full bg-black/70 backdrop-blur-sm border border-red-500/30 text-white font-semibold shadow-lg ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <span>{formatCount(count)}</span>
    </div>
  );
};

export default LiveListenerBadge;
