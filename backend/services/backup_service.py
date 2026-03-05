"""
Database Backup Service for Gracefy
====================================
Provides automated MongoDB backup functionality.
"""

import os
import asyncio
import subprocess
from datetime import datetime, timezone
from pathlib import Path
import logging
import json

logger = logging.getLogger(__name__)

# Backup configuration
BACKUP_DIR = Path("/app/backups")
MAX_BACKUPS = 7  # Keep last 7 backups


class BackupService:
    """MongoDB backup service."""
    
    def __init__(self):
        self.backup_dir = BACKUP_DIR
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.mongo_url = os.environ.get("MONGO_URL", "")
        self.db_name = os.environ.get("DB_NAME", "gracefy")
    
    async def create_backup(self, backup_name: str = None) -> dict:
        """
        Create a MongoDB backup.
        Returns backup info or error.
        """
        try:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_name = backup_name or f"backup_{timestamp}"
            backup_path = self.backup_dir / backup_name
            
            # Use mongodump for backup
            cmd = [
                "mongodump",
                f"--uri={self.mongo_url}",
                f"--db={self.db_name}",
                f"--out={backup_path}",
                "--gzip"
            ]
            
            logger.info(f"Starting backup: {backup_name}")
            
            # Run backup command
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                logger.error(f"Backup failed: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "backup_name": backup_name
                }
            
            # Get backup size
            backup_size = sum(
                f.stat().st_size for f in backup_path.rglob("*") if f.is_file()
            ) if backup_path.exists() else 0
            
            # Create backup metadata
            metadata = {
                "backup_name": backup_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "database": self.db_name,
                "size_bytes": backup_size,
                "size_mb": round(backup_size / (1024 * 1024), 2),
                "path": str(backup_path)
            }
            
            # Save metadata
            with open(backup_path / "metadata.json", "w") as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"Backup completed: {backup_name} ({metadata['size_mb']} MB)")
            
            # Cleanup old backups
            await self._cleanup_old_backups()
            
            return {
                "success": True,
                **metadata
            }
            
        except FileNotFoundError:
            # mongodump not installed - use alternative method
            return await self._backup_via_api()
        except Exception as e:
            logger.error(f"Backup error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _backup_via_api(self) -> dict:
        """
        Alternative backup method using MongoDB driver.
        Exports collections to JSON files.
        """
        try:
            from core.database import get_db
            
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_name = f"backup_json_{timestamp}"
            backup_path = self.backup_dir / backup_name
            backup_path.mkdir(parents=True, exist_ok=True)
            
            db = get_db()
            
            # Get all collection names
            collections = await db.list_collection_names()
            
            total_docs = 0
            collection_stats = {}
            
            for collection_name in collections:
                try:
                    collection = db[collection_name]
                    docs = await collection.find({}, {"_id": 0}).to_list(None)
                    
                    # Save to JSON file
                    file_path = backup_path / f"{collection_name}.json"
                    with open(file_path, "w") as f:
                        json.dump(docs, f, default=str, indent=2)
                    
                    collection_stats[collection_name] = len(docs)
                    total_docs += len(docs)
                    
                except Exception as e:
                    logger.warning(f"Failed to backup collection {collection_name}: {e}")
            
            # Get backup size
            backup_size = sum(
                f.stat().st_size for f in backup_path.rglob("*") if f.is_file()
            )
            
            metadata = {
                "backup_name": backup_name,
                "backup_type": "json_export",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "database": self.db_name,
                "collections": collection_stats,
                "total_documents": total_docs,
                "size_bytes": backup_size,
                "size_mb": round(backup_size / (1024 * 1024), 2),
                "path": str(backup_path)
            }
            
            with open(backup_path / "metadata.json", "w") as f:
                json.dump(metadata, f, indent=2)
            
            logger.info(f"JSON backup completed: {backup_name} ({total_docs} documents)")
            
            await self._cleanup_old_backups()
            
            return {
                "success": True,
                **metadata
            }
            
        except Exception as e:
            logger.error(f"JSON backup error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def _cleanup_old_backups(self):
        """Remove old backups, keeping only the most recent ones."""
        try:
            backups = sorted(
                [d for d in self.backup_dir.iterdir() if d.is_dir()],
                key=lambda x: x.stat().st_mtime,
                reverse=True
            )
            
            for old_backup in backups[MAX_BACKUPS:]:
                import shutil
                shutil.rmtree(old_backup)
                logger.info(f"Removed old backup: {old_backup.name}")
                
        except Exception as e:
            logger.warning(f"Cleanup error: {e}")
    
    async def list_backups(self) -> list:
        """List all available backups."""
        backups = []
        
        for backup_dir in sorted(self.backup_dir.iterdir(), reverse=True):
            if backup_dir.is_dir():
                metadata_file = backup_dir / "metadata.json"
                if metadata_file.exists():
                    with open(metadata_file) as f:
                        metadata = json.load(f)
                    backups.append(metadata)
                else:
                    backups.append({
                        "backup_name": backup_dir.name,
                        "path": str(backup_dir),
                        "created_at": datetime.fromtimestamp(
                            backup_dir.stat().st_mtime, timezone.utc
                        ).isoformat()
                    })
        
        return backups
    
    async def restore_backup(self, backup_name: str) -> dict:
        """
        Restore from a backup.
        WARNING: This will overwrite existing data!
        """
        backup_path = self.backup_dir / backup_name
        
        if not backup_path.exists():
            return {"success": False, "error": "Backup not found"}
        
        try:
            # Check if it's a mongodump backup or JSON backup
            metadata_file = backup_path / "metadata.json"
            if metadata_file.exists():
                with open(metadata_file) as f:
                    metadata = json.load(f)
                
                if metadata.get("backup_type") == "json_export":
                    return await self._restore_from_json(backup_path)
            
            # Try mongorestore
            cmd = [
                "mongorestore",
                f"--uri={self.mongo_url}",
                f"--db={self.db_name}",
                "--drop",  # Drop existing collections
                "--gzip",
                f"{backup_path}/{self.db_name}"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                return {
                    "success": False,
                    "error": stderr.decode() if stderr else "Restore failed"
                }
            
            return {
                "success": True,
                "message": f"Restored from {backup_name}",
                "restored_at": datetime.now(timezone.utc).isoformat()
            }
            
        except FileNotFoundError:
            return await self._restore_from_json(backup_path)
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _restore_from_json(self, backup_path: Path) -> dict:
        """Restore from JSON backup."""
        try:
            from core.database import get_db
            db = get_db()
            
            restored_collections = []
            
            for json_file in backup_path.glob("*.json"):
                if json_file.name == "metadata.json":
                    continue
                
                collection_name = json_file.stem
                
                with open(json_file) as f:
                    docs = json.load(f)
                
                if docs:
                    # Drop and recreate collection
                    await db[collection_name].drop()
                    await db[collection_name].insert_many(docs)
                    restored_collections.append({
                        "collection": collection_name,
                        "documents": len(docs)
                    })
            
            return {
                "success": True,
                "message": "Restored from JSON backup",
                "restored_collections": restored_collections,
                "restored_at": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}


# Global backup service instance
backup_service = BackupService()


# Scheduled backup task
async def scheduled_backup_task():
    """Run daily backups at 3 AM UTC."""
    while True:
        now = datetime.now(timezone.utc)
        # Calculate seconds until 3 AM UTC
        target = now.replace(hour=3, minute=0, second=0, microsecond=0)
        if now >= target:
            target = target.replace(day=target.day + 1)
        
        wait_seconds = (target - now).total_seconds()
        await asyncio.sleep(wait_seconds)
        
        try:
            result = await backup_service.create_backup()
            if result["success"]:
                logger.info(f"Scheduled backup completed: {result['backup_name']}")
            else:
                logger.error(f"Scheduled backup failed: {result.get('error')}")
        except Exception as e:
            logger.error(f"Scheduled backup error: {e}")
