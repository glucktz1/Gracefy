"""
Audio Encoding Service for Gracefy
Handles asynchronous audio transcoding with FFmpeg to create multiple quality variants.
"""

import os
import subprocess
import asyncio
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, List
from motor.motor_asyncio import AsyncIOMotorClient
import base64
import tempfile

logger = logging.getLogger(__name__)

# Quality presets for adaptive streaming
QUALITY_PRESETS = {
    "low": {"bitrate": "128k", "sample_rate": "44100"},
    "medium": {"bitrate": "256k", "sample_rate": "44100"},
    "high": {"bitrate": "320k", "sample_rate": "48000"},
}

# Output formats
OUTPUT_FORMATS = ["mp3", "m4a"]  # MP3 and AAC

# Temp directory for encoding
ENCODING_TEMP_DIR = Path("/tmp/gracefy_encoding")
ENCODING_TEMP_DIR.mkdir(exist_ok=True)


class EncodingService:
    """Service for handling audio encoding operations"""
    
    def __init__(self, db):
        self.db = db
        self._encoding_tasks: Dict[str, asyncio.Task] = {}
    
    async def start_encoding_job(
        self,
        file_id: str,
        original_content: bytes,
        original_filename: str,
        original_content_type: str
    ) -> str:
        """
        Start an asynchronous encoding job.
        Returns the encoding_job_id immediately.
        """
        job_id = f"enc_{uuid.uuid4().hex[:12]}"
        
        # Create job record in database
        job_doc = {
            "job_id": job_id,
            "file_id": file_id,
            "original_filename": original_filename,
            "original_content_type": original_content_type,
            "status": "pending",  # pending, processing, completed, failed
            "progress": 0,
            "variants": [],
            "error_message": None,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.encoding_jobs.insert_one(job_doc)
        
        # Start the encoding task in background
        task = asyncio.create_task(
            self._process_encoding(job_id, file_id, original_content, original_filename)
        )
        self._encoding_tasks[job_id] = task
        
        logger.info(f"Started encoding job {job_id} for file {file_id}")
        return job_id
    
    async def _process_encoding(
        self,
        job_id: str,
        file_id: str,
        original_content: bytes,
        original_filename: str
    ):
        """Process the encoding job in background"""
        temp_input = None
        temp_outputs = []
        
        try:
            # Update status to processing
            await self.db.encoding_jobs.update_one(
                {"job_id": job_id},
                {"$set": {"status": "processing", "progress": 5}}
            )
            
            # Write original content to temp file
            input_ext = Path(original_filename).suffix or ".mp3"
            temp_input = ENCODING_TEMP_DIR / f"{job_id}_input{input_ext}"
            temp_input.write_bytes(original_content)
            
            # Get audio duration for progress calculation
            duration = await self._get_audio_duration(str(temp_input))
            
            variants = []
            total_variants = len(QUALITY_PRESETS) * len(OUTPUT_FORMATS)
            completed_variants = 0
            
            # Process each quality preset and format
            for quality, settings in QUALITY_PRESETS.items():
                for output_format in OUTPUT_FORMATS:
                    variant_id = f"var_{uuid.uuid4().hex[:8]}"
                    output_ext = f".{output_format}"
                    temp_output = ENCODING_TEMP_DIR / f"{job_id}_{quality}_{output_format}{output_ext}"
                    temp_outputs.append(temp_output)
                    
                    # Encode
                    success = await self._encode_file(
                        str(temp_input),
                        str(temp_output),
                        output_format,
                        settings["bitrate"],
                        settings["sample_rate"]
                    )
                    
                    if success and temp_output.exists():
                        # Read encoded file
                        encoded_content = temp_output.read_bytes()
                        encoded_base64 = base64.b64encode(encoded_content).decode('utf-8')
                        
                        # Get file size
                        file_size = len(encoded_content)
                        
                        # Store variant in database
                        variant_doc = {
                            "variant_id": variant_id,
                            "file_id": file_id,
                            "job_id": job_id,
                            "quality": quality,
                            "format": output_format,
                            "bitrate": settings["bitrate"],
                            "sample_rate": settings["sample_rate"],
                            "content_type": f"audio/{'mpeg' if output_format == 'mp3' else 'mp4'}",
                            "size": file_size,
                            "data": encoded_base64,
                            "duration": duration,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        await self.db.audio_variants.insert_one(variant_doc)
                        
                        variants.append({
                            "variant_id": variant_id,
                            "quality": quality,
                            "format": output_format,
                            "bitrate": settings["bitrate"],
                            "size": file_size,
                            "url": f"/api/files/{file_id}/variant/{quality}/{output_format}"
                        })
                        
                        logger.info(f"Created variant: {quality}/{output_format} for job {job_id}")
                    else:
                        logger.error(f"Failed to encode {quality}/{output_format} for job {job_id}")
                    
                    # Update progress
                    completed_variants += 1
                    progress = 5 + int((completed_variants / total_variants) * 90)
                    await self.db.encoding_jobs.update_one(
                        {"job_id": job_id},
                        {"$set": {"progress": progress}}
                    )
            
            # Update job as completed
            await self.db.encoding_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": "completed",
                    "progress": 100,
                    "variants": variants,
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update the original file record with variants info
            await self.db.files.update_one(
                {"file_id": file_id},
                {"$set": {
                    "encoding_status": "completed",
                    "encoding_job_id": job_id,
                    "variants": variants,
                    "has_variants": True
                }}
            )
            
            logger.info(f"Encoding job {job_id} completed with {len(variants)} variants")
            
        except Exception as e:
            logger.error(f"Encoding job {job_id} failed: {str(e)}")
            await self.db.encoding_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": "failed",
                    "error_message": str(e),
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            await self.db.files.update_one(
                {"file_id": file_id},
                {"$set": {"encoding_status": "failed", "encoding_error": str(e)}}
            )
        
        finally:
            # Cleanup temp files
            if temp_input and temp_input.exists():
                temp_input.unlink()
            for temp_output in temp_outputs:
                if temp_output.exists():
                    temp_output.unlink()
    
    async def _encode_file(
        self,
        input_path: str,
        output_path: str,
        output_format: str,
        bitrate: str,
        sample_rate: str
    ) -> bool:
        """Encode a single file using FFmpeg"""
        try:
            if output_format == "mp3":
                cmd = [
                    "ffmpeg", "-y", "-i", input_path,
                    "-codec:a", "libmp3lame",
                    "-b:a", bitrate,
                    "-ar", sample_rate,
                    "-ac", "2",  # Stereo
                    output_path
                ]
            else:  # m4a (AAC)
                cmd = [
                    "ffmpeg", "-y", "-i", input_path,
                    "-codec:a", "aac",
                    "-b:a", bitrate,
                    "-ar", sample_rate,
                    "-ac", "2",  # Stereo
                    output_path
                ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"FFmpeg error: {stderr.decode()}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Encoding error: {str(e)}")
            return False
    
    async def _get_audio_duration(self, file_path: str) -> Optional[float]:
        """Get audio duration using FFprobe"""
        try:
            cmd = [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "csv=p=0",
                file_path
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                duration_str = stdout.decode().strip()
                return float(duration_str) if duration_str else None
            
            return None
            
        except Exception as e:
            logger.error(f"FFprobe error: {str(e)}")
            return None
    
    async def get_job_status(self, job_id: str) -> Optional[Dict]:
        """Get the status of an encoding job"""
        job = await self.db.encoding_jobs.find_one({"job_id": job_id}, {"_id": 0})
        return job
    
    async def get_variant(
        self,
        file_id: str,
        quality: str,
        output_format: str
    ) -> Optional[Dict]:
        """Get a specific variant of an encoded file"""
        variant = await self.db.audio_variants.find_one({
            "file_id": file_id,
            "quality": quality,
            "format": output_format
        }, {"_id": 0})
        return variant
    
    async def get_best_variant(self, file_id: str, preferred_format: str = "m4a") -> Optional[Dict]:
        """Get the best quality variant for a file"""
        # Try high quality first, then medium, then low
        for quality in ["high", "medium", "low"]:
            variant = await self.get_variant(file_id, quality, preferred_format)
            if variant:
                return variant
        
        # If preferred format not available, try the other format
        other_format = "mp3" if preferred_format == "m4a" else "m4a"
        for quality in ["high", "medium", "low"]:
            variant = await self.get_variant(file_id, quality, other_format)
            if variant:
                return variant
        
        return None
    
    async def cleanup_old_jobs(self, days: int = 7):
        """Clean up old encoding jobs and temp files"""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_str = cutoff.isoformat()
        
        # Delete old jobs
        result = await self.db.encoding_jobs.delete_many({
            "created_at": {"$lt": cutoff_str},
            "status": {"$in": ["completed", "failed"]}
        })
        
        logger.info(f"Cleaned up {result.deleted_count} old encoding jobs")


# Singleton instance (will be initialized with db)
_encoding_service: Optional[EncodingService] = None


def get_encoding_service(db) -> EncodingService:
    """Get or create the encoding service instance"""
    global _encoding_service
    if _encoding_service is None:
        _encoding_service = EncodingService(db)
    return _encoding_service
