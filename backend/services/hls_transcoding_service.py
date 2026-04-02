"""
HLS Adaptive Streaming Transcoding Service

Converts MP3 files to HLS format with multiple quality tiers:
- 96kbps (low) - for slow connections
- 192kbps (medium) - balanced quality
- 320kbps (high) - best quality

Uses FFmpeg for transcoding and uploads to Bunny CDN.
"""

import os
import asyncio
import subprocess
import tempfile
import shutil
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Bunny CDN Configuration
BUNNY_STORAGE_ZONE = os.environ.get('BUNNY_STORAGE_ZONE', 'gracefy-media')
BUNNY_API_KEY = os.environ.get('BUNNY_API_KEY', '')
BUNNY_CDN_URL = os.environ.get('BUNNY_CDN_URL', 'https://gracefy-cdn.b-cdn.net')
BUNNY_STORAGE_REGION = os.environ.get('BUNNY_STORAGE_REGION', 'de')

# Quality tiers for adaptive streaming
QUALITY_TIERS = [
    {'name': 'low', 'bitrate': '96k', 'bandwidth': 96000},
    {'name': 'medium', 'bitrate': '192k', 'bandwidth': 192000},
    {'name': 'high', 'bitrate': '320k', 'bandwidth': 320000},
]

# Segment duration in seconds (6 seconds is optimal for music streaming)
# Shorter segments = faster start but more requests
# Longer segments = smoother playback but slower start
SEGMENT_DURATION = 6


def get_storage_url():
    """Get Bunny storage URL based on region"""
    if BUNNY_STORAGE_REGION == 'de':
        return f"https://storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}"
    return f"https://{BUNNY_STORAGE_REGION}.storage.bunnycdn.com/{BUNNY_STORAGE_ZONE}"


async def download_source_audio(audio_url: str, temp_dir: str) -> Optional[str]:
    """Download source MP3 file to temp directory"""
    try:
        source_path = os.path.join(temp_dir, 'source.mp3')
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(audio_url)
            response.raise_for_status()
            
            with open(source_path, 'wb') as f:
                f.write(response.content)
        
        logger.info(f"Downloaded source audio: {len(response.content)} bytes")
        return source_path
    except Exception as e:
        logger.error(f"Failed to download source audio: {e}")
        return None


def transcode_to_hls(source_path: str, output_dir: str, song_id: str) -> Dict:
    """
    Transcode MP3 to HLS with multiple quality tiers using FFmpeg.
    
    Returns dict with paths to generated files and master playlist.
    """
    result = {
        'success': False,
        'master_playlist': None,
        'variants': [],
        'segments': [],
        'error': None
    }
    
    try:
        # Create output directories for each quality tier
        for tier in QUALITY_TIERS:
            tier_dir = os.path.join(output_dir, tier['name'])
            os.makedirs(tier_dir, exist_ok=True)
        
        # Generate HLS for each quality tier
        for tier in QUALITY_TIERS:
            tier_dir = os.path.join(output_dir, tier['name'])
            playlist_path = os.path.join(tier_dir, 'playlist.m3u8')
            segment_pattern = os.path.join(tier_dir, 'segment_%03d.ts')
            
            # FFmpeg command for HLS transcoding
            cmd = [
                'ffmpeg', '-y',
                '-i', source_path,
                '-c:a', 'aac',
                '-b:a', tier['bitrate'],
                '-ac', '2',  # Stereo
                '-ar', '44100',  # Sample rate
                '-f', 'hls',
                '-hls_time', str(SEGMENT_DURATION),
                '-hls_list_size', '0',  # Keep all segments in playlist
                '-hls_segment_filename', segment_pattern,
                '-hls_playlist_type', 'vod',
                playlist_path
            ]
            
            logger.info(f"Transcoding {tier['name']} quality...")
            process = subprocess.run(cmd, capture_output=True, text=True)
            
            if process.returncode != 0:
                logger.error(f"FFmpeg error for {tier['name']}: {process.stderr}")
                result['error'] = f"Transcoding failed for {tier['name']}: {process.stderr}"
                return result
            
            # Collect generated files
            result['variants'].append({
                'name': tier['name'],
                'bitrate': tier['bitrate'],
                'bandwidth': tier['bandwidth'],
                'playlist': playlist_path
            })
            
            # Collect segment files
            for f in os.listdir(tier_dir):
                if f.endswith('.ts'):
                    result['segments'].append(os.path.join(tier_dir, f))
        
        # Generate master playlist
        master_playlist_path = os.path.join(output_dir, 'master.m3u8')
        master_content = "#EXTM3U\n#EXT-X-VERSION:3\n\n"
        
        for tier in QUALITY_TIERS:
            master_content += f"#EXT-X-STREAM-INF:BANDWIDTH={tier['bandwidth']},NAME=\"{tier['name']}\"\n"
            master_content += f"{tier['name']}/playlist.m3u8\n\n"
        
        with open(master_playlist_path, 'w') as f:
            f.write(master_content)
        
        result['master_playlist'] = master_playlist_path
        result['success'] = True
        logger.info(f"HLS transcoding complete: {len(result['segments'])} segments created")
        
    except Exception as e:
        logger.error(f"Transcoding error: {e}")
        result['error'] = str(e)
    
    return result


async def upload_to_bunny_cdn(local_path: str, remote_path: str) -> bool:
    """Upload a file to Bunny CDN storage"""
    try:
        storage_url = get_storage_url()
        upload_url = f"{storage_url}/{remote_path}"
        
        with open(local_path, 'rb') as f:
            file_content = f.read()
        
        headers = {
            'AccessKey': BUNNY_API_KEY,
            'Content-Type': 'application/octet-stream'
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.put(upload_url, content=file_content, headers=headers)
            
            if response.status_code in [200, 201]:
                logger.debug(f"Uploaded: {remote_path}")
                return True
            else:
                logger.error(f"Upload failed: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Upload error for {remote_path}: {e}")
        return False


async def upload_hls_files(output_dir: str, song_id: str) -> Dict:
    """Upload all HLS files to Bunny CDN"""
    result = {
        'success': False,
        'master_url': None,
        'uploaded_files': 0,
        'error': None
    }
    
    try:
        base_path = f"hls/{song_id}"
        upload_tasks = []
        
        # Walk through output directory and upload all files
        for root, dirs, files in os.walk(output_dir):
            for filename in files:
                local_path = os.path.join(root, filename)
                
                # Calculate relative path from output_dir
                rel_path = os.path.relpath(local_path, output_dir)
                remote_path = f"{base_path}/{rel_path}"
                
                upload_tasks.append((local_path, remote_path))
        
        # Upload files (could be parallelized but Bunny has rate limits)
        for local_path, remote_path in upload_tasks:
            success = await upload_to_bunny_cdn(local_path, remote_path)
            if success:
                result['uploaded_files'] += 1
            else:
                result['error'] = f"Failed to upload {remote_path}"
                return result
        
        result['master_url'] = f"{BUNNY_CDN_URL}/{base_path}/master.m3u8"
        result['success'] = True
        logger.info(f"Uploaded {result['uploaded_files']} HLS files for {song_id}")
        
    except Exception as e:
        logger.error(f"Upload error: {e}")
        result['error'] = str(e)
    
    return result


async def transcode_song(song_id: str, audio_url: str, db) -> Dict:
    """
    Main function to transcode a song to HLS format.
    
    1. Downloads source MP3
    2. Transcodes to HLS with multiple qualities
    3. Uploads to Bunny CDN
    4. Updates database with HLS URL
    """
    result = {
        'success': False,
        'song_id': song_id,
        'hls_url': None,
        'error': None,
        'duration_seconds': 0
    }
    
    start_time = datetime.now(timezone.utc)
    temp_dir = None
    
    try:
        # Update status to processing
        await db.songs.update_one(
            {'song_id': song_id},
            {'$set': {
                'hls_status': 'processing',
                'hls_started_at': start_time.isoformat()
            }}
        )
        
        # Create temp directory
        temp_dir = tempfile.mkdtemp(prefix=f'hls_{song_id}_')
        output_dir = os.path.join(temp_dir, 'output')
        os.makedirs(output_dir)
        
        logger.info(f"Starting HLS transcoding for {song_id}")
        
        # Step 1: Download source audio
        source_path = await download_source_audio(audio_url, temp_dir)
        if not source_path:
            raise Exception("Failed to download source audio")
        
        # Step 2: Transcode to HLS
        transcode_result = transcode_to_hls(source_path, output_dir, song_id)
        if not transcode_result['success']:
            raise Exception(transcode_result.get('error', 'Transcoding failed'))
        
        # Step 3: Upload to Bunny CDN
        upload_result = await upload_hls_files(output_dir, song_id)
        if not upload_result['success']:
            raise Exception(upload_result.get('error', 'Upload failed'))
        
        # Step 4: Update database
        end_time = datetime.now(timezone.utc)
        duration = (end_time - start_time).total_seconds()
        
        await db.songs.update_one(
            {'song_id': song_id},
            {'$set': {
                'hls_url': upload_result['master_url'],
                'hls_status': 'completed',
                'hls_completed_at': end_time.isoformat(),
                'hls_duration_seconds': duration
            }}
        )
        
        result['success'] = True
        result['hls_url'] = upload_result['master_url']
        result['duration_seconds'] = duration
        logger.info(f"HLS transcoding complete for {song_id} in {duration:.1f}s")
        
    except Exception as e:
        logger.error(f"HLS transcoding failed for {song_id}: {e}")
        result['error'] = str(e)
        
        # Update status to failed
        await db.songs.update_one(
            {'song_id': song_id},
            {'$set': {
                'hls_status': 'failed',
                'hls_error': str(e),
                'hls_failed_at': datetime.now(timezone.utc).isoformat()
            }}
        )
    
    finally:
        # Cleanup temp directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp dir: {e}")
    
    return result


async def get_transcoding_stats(db) -> Dict:
    """Get overall transcoding statistics"""
    try:
        total = await db.songs.count_documents({'status': 'active'})
        completed = await db.songs.count_documents({'hls_status': 'completed'})
        processing = await db.songs.count_documents({'hls_status': 'processing'})
        failed = await db.songs.count_documents({'hls_status': 'failed'})
        pending = total - completed - processing - failed
        
        return {
            'total_songs': total,
            'completed': completed,
            'processing': processing,
            'failed': failed,
            'pending': pending,
            'progress_percent': round((completed / total * 100) if total > 0 else 0, 1)
        }
    except Exception as e:
        logger.error(f"Failed to get transcoding stats: {e}")
        return {'error': str(e)}


async def get_pending_songs(db, limit: int = 10) -> List[Dict]:
    """Get songs that need transcoding"""
    try:
        # Find songs with audio_url but no hls_status or failed status
        songs = await db.songs.find(
            {
                'status': 'active',
                'audio_url': {'$exists': True, '$ne': None, '$regex': '^https?://'},
                '$or': [
                    {'hls_status': {'$exists': False}},
                    {'hls_status': None},
                    {'hls_status': 'failed'}
                ]
            },
            {'_id': 0, 'song_id': 1, 'title': 1, 'audio_url': 1, 'hls_status': 1}
        ).limit(limit).to_list(limit)
        
        return songs
    except Exception as e:
        logger.error(f"Failed to get pending songs: {e}")
        return []


# Background task flag
_transcoding_task_running = False
_transcoding_task = None


async def start_batch_transcoding(db, batch_size: int = 5):
    """Start background batch transcoding of all pending songs"""
    global _transcoding_task_running, _transcoding_task
    
    if _transcoding_task_running:
        logger.info("Batch transcoding already running")
        return {'status': 'already_running'}
    
    _transcoding_task_running = True
    
    async def process_batch():
        global _transcoding_task_running
        
        try:
            while _transcoding_task_running:
                # Get next batch of pending songs
                pending = await get_pending_songs(db, batch_size)
                
                if not pending:
                    logger.info("No more pending songs to transcode")
                    break
                
                for song in pending:
                    if not _transcoding_task_running:
                        break
                    
                    try:
                        await transcode_song(song['song_id'], song['audio_url'], db)
                    except Exception as e:
                        logger.error(f"Error transcoding {song['song_id']}: {e}")
                    
                    # Small delay between songs to avoid overwhelming the system
                    await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"Batch transcoding error: {e}")
        finally:
            _transcoding_task_running = False
            logger.info("Batch transcoding stopped")
    
    _transcoding_task = asyncio.create_task(process_batch())
    return {'status': 'started'}


async def stop_batch_transcoding():
    """Stop the background batch transcoding"""
    global _transcoding_task_running
    _transcoding_task_running = False
    return {'status': 'stopping'}


def is_transcoding_running() -> bool:
    """Check if batch transcoding is currently running"""
    return _transcoding_task_running
