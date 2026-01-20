"""
Bunny CDN Service for Gracefy
Handles file uploads to Bunny Storage and generates CDN URLs for media delivery.
"""

import os
import httpx
import uuid
import logging
from pathlib import Path
from typing import Optional, Dict, Tuple
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Storage API base URL (region-specific)
STORAGE_REGION_URLS = {
    'de': 'https://storage.bunnycdn.com',  # Germany (default)
    'ny': 'https://ny.storage.bunnycdn.com',  # New York
    'la': 'https://la.storage.bunnycdn.com',  # Los Angeles
    'sg': 'https://sg.storage.bunnycdn.com',  # Singapore
    'syd': 'https://syd.storage.bunnycdn.com',  # Sydney
    'uk': 'https://uk.storage.bunnycdn.com',  # UK
    'se': 'https://se.storage.bunnycdn.com',  # Stockholm
    'br': 'https://br.storage.bunnycdn.com',  # Brazil
    'jh': 'https://jh.storage.bunnycdn.com',  # Johannesburg
}

def get_bunny_config():
    """Get Bunny CDN configuration from environment (called lazily)"""
    return {
        'storage_zone': os.environ.get('BUNNY_STORAGE_ZONE', 'gracefy-media'),
        'api_key': os.environ.get('BUNNY_API_KEY', ''),
        'cdn_url': os.environ.get('BUNNY_CDN_URL', 'https://gracefy-cdn.b-cdn.net'),
        'storage_region': os.environ.get('BUNNY_STORAGE_REGION', 'de'),
    }

def get_storage_base_url(region: str = None) -> str:
    """Get the storage API base URL for the configured region"""
    if region is None:
        region = get_bunny_config()['storage_region']
    return STORAGE_REGION_URLS.get(region, STORAGE_REGION_URLS['de'])


class BunnyCDNService:
    """Service for uploading files to Bunny CDN and managing media"""
    
    def __init__(self):
        config = get_bunny_config()
        self.storage_zone = config['storage_zone']
        self.api_key = config['api_key']
        self.cdn_url = config['cdn_url'].rstrip('/')
        self.storage_url = get_storage_base_url(config['storage_region'])
        
        if not self.api_key:
            logger.warning("BUNNY_API_KEY not set - CDN uploads will fail")
    
    def is_configured(self) -> bool:
        """Check if Bunny CDN is properly configured"""
        return bool(self.api_key and self.storage_zone)
    
    def get_cdn_url(self, path: str) -> str:
        """Generate the CDN URL for a file path"""
        path = path.lstrip('/')
        return f"{self.cdn_url}/{path}"
    
    def _get_storage_path(self, folder: str, filename: str) -> str:
        """Generate storage path with folder organization"""
        # Organize by folder: audio/, images/, thumbnails/
        return f"{folder}/{filename}"
    
    async def upload_file(
        self,
        content: bytes,
        filename: str,
        folder: str = "audio",
        content_type: Optional[str] = None
    ) -> Dict:
        """
        Upload a file to Bunny Storage
        
        Args:
            content: File content as bytes
            filename: Original filename
            folder: Folder to store in (audio, images, thumbnails)
            content_type: MIME type of the file
            
        Returns:
            Dict with cdn_url, storage_path, size, etc.
        """
        if not self.is_configured():
            raise Exception("Bunny CDN not configured - missing API key")
        
        # Generate unique filename to avoid collisions
        ext = Path(filename).suffix.lower() or '.mp3'
        unique_filename = f"{uuid.uuid4().hex[:12]}_{datetime.now().strftime('%Y%m%d')}{ext}"
        storage_path = self._get_storage_path(folder, unique_filename)
        
        # Build upload URL
        upload_url = f"{self.storage_url}/{self.storage_zone}/{storage_path}"
        
        headers = {
            "AccessKey": self.api_key,
            "Content-Type": content_type or "application/octet-stream",
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.put(
                    upload_url,
                    content=content,
                    headers=headers
                )
                
                if response.status_code in [200, 201]:
                    cdn_url = self.get_cdn_url(storage_path)
                    logger.info(f"Uploaded to Bunny CDN: {cdn_url}")
                    
                    return {
                        "success": True,
                        "cdn_url": cdn_url,
                        "storage_path": storage_path,
                        "filename": unique_filename,
                        "original_filename": filename,
                        "size": len(content),
                        "content_type": content_type,
                        "folder": folder,
                        "uploaded_at": datetime.now(timezone.utc).isoformat()
                    }
                else:
                    error_msg = f"Bunny CDN upload failed: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    return {
                        "success": False,
                        "error": error_msg,
                        "status_code": response.status_code
                    }
                    
        except Exception as e:
            error_msg = f"Bunny CDN upload error: {str(e)}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg
            }
    
    async def upload_audio(self, content: bytes, filename: str, content_type: str = "audio/mpeg") -> Dict:
        """Upload an audio file to the audio folder"""
        return await self.upload_file(content, filename, folder="audio", content_type=content_type)
    
    async def upload_image(self, content: bytes, filename: str, content_type: str = "image/jpeg") -> Dict:
        """Upload an image to the images folder"""
        return await self.upload_file(content, filename, folder="images", content_type=content_type)
    
    async def upload_thumbnail(self, content: bytes, filename: str, content_type: str = "image/jpeg") -> Dict:
        """Upload a thumbnail to the thumbnails folder"""
        return await self.upload_file(content, filename, folder="thumbnails", content_type=content_type)
    
    async def delete_file(self, storage_path: str) -> Dict:
        """
        Delete a file from Bunny Storage
        
        Args:
            storage_path: Path in storage (e.g., audio/abc123.mp3)
            
        Returns:
            Dict with success status
        """
        if not self.is_configured():
            raise Exception("Bunny CDN not configured")
        
        delete_url = f"{self.storage_url}/{self.storage_zone}/{storage_path}"
        
        headers = {
            "AccessKey": self.api_key,
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(delete_url, headers=headers)
                
                if response.status_code in [200, 204]:
                    logger.info(f"Deleted from Bunny CDN: {storage_path}")
                    return {"success": True, "deleted_path": storage_path}
                else:
                    return {
                        "success": False,
                        "error": f"Delete failed: {response.status_code}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def list_files(self, folder: str = "") -> Dict:
        """
        List files in a folder
        
        Args:
            folder: Folder path to list (empty for root)
            
        Returns:
            Dict with files list
        """
        if not self.is_configured():
            raise Exception("Bunny CDN not configured")
        
        list_url = f"{self.storage_url}/{self.storage_zone}/{folder}/"
        
        headers = {
            "AccessKey": self.api_key,
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(list_url, headers=headers)
                
                if response.status_code == 200:
                    files = response.json()
                    return {
                        "success": True,
                        "files": files,
                        "count": len(files)
                    }
                else:
                    return {
                        "success": False,
                        "error": f"List failed: {response.status_code}"
                    }
                    
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_storage_stats(self) -> Dict:
        """Get storage usage statistics"""
        try:
            # List all folders to calculate stats
            folders = ["audio", "images", "thumbnails"]
            total_files = 0
            total_size = 0
            folder_stats = {}
            
            for folder in folders:
                result = await self.list_files(folder)
                if result.get("success"):
                    files = result.get("files", [])
                    folder_size = sum(f.get("Length", 0) for f in files)
                    folder_count = len(files)
                    total_files += folder_count
                    total_size += folder_size
                    folder_stats[folder] = {
                        "count": folder_count,
                        "size_bytes": folder_size,
                        "size_mb": round(folder_size / (1024 * 1024), 2)
                    }
            
            return {
                "success": True,
                "total_files": total_files,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2),
                "total_size_gb": round(total_size / (1024 * 1024 * 1024), 3),
                "folders": folder_stats,
                "cdn_url": self.cdn_url,
                "storage_zone": self.storage_zone
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton instance
_bunny_service: Optional[BunnyCDNService] = None

def get_bunny_service() -> BunnyCDNService:
    """Get or create the Bunny CDN service instance"""
    global _bunny_service
    if _bunny_service is None:
        _bunny_service = BunnyCDNService()
    return _bunny_service


# Utility function to check if CDN is enabled
def is_cdn_enabled() -> bool:
    """Check if CDN is enabled and properly configured"""
    service = get_bunny_service()
    return service.is_configured()
