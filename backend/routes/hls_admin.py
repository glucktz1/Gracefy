"""
HLS Transcoding Admin Routes

Provides endpoints for:
- Viewing transcoding status and statistics
- Starting/stopping batch transcoding
- Manually triggering transcoding for specific songs
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from datetime import datetime, timezone
from typing import Optional
import logging

from core.database import get_db
from services.hls_transcoding_service import (
    transcode_song,
    get_transcoding_stats,
    get_pending_songs,
    start_batch_transcoding,
    stop_batch_transcoding,
    is_transcoding_running
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/hls", tags=["hls-transcoding"])


@router.get("/status")
async def get_hls_status():
    """Get overall HLS transcoding status and statistics"""
    db = get_db()
    
    stats = await get_transcoding_stats(db)
    is_running = is_transcoding_running()
    
    # Get recently processed songs
    recent_completed = await db.songs.find(
        {'hls_status': 'completed'},
        {'_id': 0, 'song_id': 1, 'title': 1, 'hls_completed_at': 1, 'hls_duration_seconds': 1}
    ).sort('hls_completed_at', -1).limit(10).to_list(10)
    
    recent_failed = await db.songs.find(
        {'hls_status': 'failed'},
        {'_id': 0, 'song_id': 1, 'title': 1, 'hls_failed_at': 1, 'hls_error': 1}
    ).sort('hls_failed_at', -1).limit(10).to_list(10)
    
    currently_processing = await db.songs.find(
        {'hls_status': 'processing'},
        {'_id': 0, 'song_id': 1, 'title': 1, 'hls_started_at': 1}
    ).to_list(10)
    
    return {
        'statistics': stats,
        'batch_transcoding_running': is_running,
        'currently_processing': currently_processing,
        'recent_completed': recent_completed,
        'recent_failed': recent_failed
    }


@router.post("/start")
async def start_transcoding():
    """Start batch transcoding of all pending songs"""
    db = get_db()
    
    if is_transcoding_running():
        return {'status': 'already_running', 'message': 'Batch transcoding is already in progress'}
    
    await start_batch_transcoding(db, batch_size=3)
    
    return {
        'status': 'started',
        'message': 'Batch transcoding started. Check /status for progress.'
    }


@router.post("/stop")
async def stop_transcoding():
    """Stop batch transcoding"""
    await stop_batch_transcoding()
    
    return {
        'status': 'stopping',
        'message': 'Batch transcoding will stop after current song completes.'
    }


@router.post("/transcode/{song_id}")
async def transcode_single_song(song_id: str, background_tasks: BackgroundTasks):
    """Manually trigger transcoding for a specific song"""
    db = get_db()
    
    # Get the song
    song = await db.songs.find_one(
        {'song_id': song_id},
        {'_id': 0, 'song_id': 1, 'title': 1, 'audio_url': 1, 'hls_status': 1}
    )
    
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    if not song.get('audio_url'):
        raise HTTPException(status_code=400, detail="Song has no audio URL")
    
    if song.get('hls_status') == 'processing':
        return {'status': 'already_processing', 'message': 'Song is already being transcoded'}
    
    # Start transcoding in background
    async def transcode_task():
        await transcode_song(song['song_id'], song['audio_url'], db)
    
    background_tasks.add_task(transcode_task)
    
    return {
        'status': 'queued',
        'message': f'Transcoding started for "{song.get("title", song_id)}"',
        'song_id': song_id
    }


@router.get("/pending")
async def get_pending_transcoding(limit: int = 50):
    """Get list of songs pending transcoding"""
    db = get_db()
    
    pending = await get_pending_songs(db, limit)
    
    return {
        'count': len(pending),
        'songs': pending
    }


@router.post("/retry-failed")
async def retry_failed_transcoding(background_tasks: BackgroundTasks):
    """Retry all failed transcoding jobs"""
    db = get_db()
    
    # Reset all failed songs to pending
    result = await db.songs.update_many(
        {'hls_status': 'failed'},
        {'$unset': {'hls_status': '', 'hls_error': '', 'hls_failed_at': ''}}
    )
    
    if result.modified_count == 0:
        return {'status': 'no_failed', 'message': 'No failed transcoding jobs to retry'}
    
    return {
        'status': 'reset',
        'message': f'Reset {result.modified_count} failed jobs. Start batch transcoding to process them.',
        'count': result.modified_count
    }


@router.delete("/clear/{song_id}")
async def clear_hls_data(song_id: str):
    """Clear HLS data for a song (useful for re-transcoding)"""
    db = get_db()
    
    result = await db.songs.update_one(
        {'song_id': song_id},
        {'$unset': {
            'hls_url': '',
            'hls_status': '',
            'hls_started_at': '',
            'hls_completed_at': '',
            'hls_failed_at': '',
            'hls_error': '',
            'hls_duration_seconds': ''
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Song not found")
    
    return {'status': 'cleared', 'song_id': song_id}


@router.get("/song/{song_id}")
async def get_song_hls_status(song_id: str):
    """Get HLS transcoding status for a specific song"""
    db = get_db()
    
    song = await db.songs.find_one(
        {'song_id': song_id},
        {
            '_id': 0,
            'song_id': 1,
            'title': 1,
            'audio_url': 1,
            'hls_url': 1,
            'hls_status': 1,
            'hls_started_at': 1,
            'hls_completed_at': 1,
            'hls_failed_at': 1,
            'hls_error': 1,
            'hls_duration_seconds': 1
        }
    )
    
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    return song
