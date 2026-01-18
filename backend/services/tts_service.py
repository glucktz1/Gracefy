"""
TTS Service - Text-to-Speech using OpenAI via Emergent Integrations
Generates audio from Bible text and stores for reuse
"""
import os
import uuid
import base64
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Available voices
AVAILABLE_VOICES = [
    {"id": "alloy", "name": "Alloy", "description": "Neutral, balanced"},
    {"id": "ash", "name": "Ash", "description": "Clear, articulate"},
    {"id": "coral", "name": "Coral", "description": "Warm, friendly"},
    {"id": "echo", "name": "Echo", "description": "Smooth, calm"},
    {"id": "fable", "name": "Fable", "description": "Expressive, storytelling"},
    {"id": "nova", "name": "Nova", "description": "Energetic, upbeat"},
    {"id": "onyx", "name": "Onyx", "description": "Deep, authoritative"},
    {"id": "sage", "name": "Sage", "description": "Wise, measured"},
    {"id": "shimmer", "name": "Shimmer", "description": "Bright, cheerful"}
]


class TTSService:
    def __init__(self, db):
        self.db = db
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")
        self._tts_client = None
        
    async def _get_tts_client(self):
        """Lazy initialization of TTS client"""
        if self._tts_client is None:
            from emergentintegrations.llm.openai import OpenAITextToSpeech
            self._tts_client = OpenAITextToSpeech(api_key=self.api_key)
        return self._tts_client
    
    def _generate_audio_hash(self, text: str, voice: str, speed: float) -> str:
        """Generate a unique hash for caching purposes"""
        content = f"{text}|{voice}|{speed}"
        return hashlib.md5(content.encode()).hexdigest()
    
    async def generate_audio(
        self,
        text: str,
        voice: str = "nova",
        speed: float = 1.0,
        model: str = "tts-1",
        cache: bool = True
    ) -> Dict[str, Any]:
        """Generate audio from text using OpenAI TTS"""
        try:
            # Check cache first
            audio_hash = self._generate_audio_hash(text, voice, speed)
            
            if cache:
                cached = await self.db.bible_audio_cache.find_one(
                    {"audio_hash": audio_hash},
                    {"_id": 0}
                )
                if cached:
                    logger.info(f"Returning cached audio: {audio_hash}")
                    # Update access count
                    await self.db.bible_audio_cache.update_one(
                        {"audio_hash": audio_hash},
                        {
                            "$inc": {"access_count": 1},
                            "$set": {"last_accessed": datetime.now(timezone.utc)}
                        }
                    )
                    return {
                        "audio_id": cached["audio_id"],
                        "audio_base64": cached["audio_base64"],
                        "cached": True,
                        "voice": voice,
                        "duration_estimate": len(text) / 15  # Rough estimate
                    }
            
            # Generate new audio
            tts_client = await self._get_tts_client()
            
            # Split text if too long (4096 char limit)
            if len(text) > 4000:
                # For long text, we'll just take first 4000 chars with warning
                text = text[:4000]
                logger.warning("Text truncated to 4000 characters")
            
            audio_bytes = await tts_client.generate_speech(
                text=text,
                model=model,
                voice=voice,
                speed=speed
            )
            
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            audio_id = f"audio_{uuid.uuid4().hex[:12]}"
            
            # Cache the audio
            if cache:
                cache_doc = {
                    "audio_id": audio_id,
                    "audio_hash": audio_hash,
                    "audio_base64": audio_base64,
                    "text_length": len(text),
                    "voice": voice,
                    "speed": speed,
                    "model": model,
                    "file_size_bytes": len(audio_bytes),
                    "created_at": datetime.now(timezone.utc),
                    "last_accessed": datetime.now(timezone.utc),
                    "access_count": 1
                }
                await self.db.bible_audio_cache.insert_one(cache_doc)
            
            return {
                "audio_id": audio_id,
                "audio_base64": audio_base64,
                "cached": False,
                "voice": voice,
                "file_size_bytes": len(audio_bytes),
                "duration_estimate": len(text) / 15
            }
            
        except Exception as e:
            logger.error(f"TTS generation error: {e}")
            raise
    
    async def create_bible_snippet(
        self,
        title: str,
        description: str,
        book_name: str,
        chapter: int,
        start_verse: int,
        end_verse: int,
        language: str = "sw",
        voice: str = "nova",
        speed: float = 1.0,
        created_by: str = None
    ) -> Dict[str, Any]:
        """Create a pre-generated Bible snippet with audio"""
        try:
            # Get the verses
            verses = await self.db.bible_verses.find(
                {
                    "book_name": book_name,
                    "chapter": chapter,
                    "verse": {"$gte": start_verse, "$lte": end_verse},
                    "language": language
                },
                {"_id": 0}
            ).sort("verse", 1).to_list(200)
            
            if not verses:
                raise ValueError("No verses found for the specified reference")
            
            # Combine verse texts
            full_text = " ".join([v["text"] for v in verses])
            reference = f"{book_name} {chapter}:{start_verse}-{end_verse}" if start_verse != end_verse else f"{book_name} {chapter}:{start_verse}"
            
            # Generate audio
            audio_result = await self.generate_audio(
                text=full_text,
                voice=voice,
                speed=speed,
                cache=True
            )
            
            snippet_id = f"snippet_{uuid.uuid4().hex[:12]}"
            
            snippet_doc = {
                "snippet_id": snippet_id,
                "title": title,
                "description": description,
                "reference": reference,
                "book_name": book_name,
                "chapter": chapter,
                "start_verse": start_verse,
                "end_verse": end_verse,
                "language": language,
                "text": full_text,
                "voice": voice,
                "speed": speed,
                "audio_id": audio_result["audio_id"],
                "audio_base64": audio_result["audio_base64"],
                "duration_estimate": audio_result.get("duration_estimate", 0),
                "is_active": True,
                "play_count": 0,
                "created_by": created_by,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            await self.db.bible_snippets.insert_one(snippet_doc)
            
            # Don't return the full audio in the response
            snippet_doc.pop("audio_base64", None)
            snippet_doc.pop("_id", None)
            
            return snippet_doc
            
        except Exception as e:
            logger.error(f"Error creating Bible snippet: {e}")
            raise
    
    async def get_snippets(
        self,
        language: str = None,
        book_name: str = None,
        limit: int = 50,
        skip: int = 0,
        active_only: bool = True
    ) -> List[Dict]:
        """Get Bible snippets"""
        query = {}
        if language:
            query["language"] = language
        if book_name:
            query["book_name"] = book_name
        if active_only:
            query["is_active"] = True
        
        snippets = await self.db.bible_snippets.find(
            query,
            {"_id": 0, "audio_base64": 0}  # Exclude large audio data
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        return snippets
    
    async def get_snippet_audio(self, snippet_id: str) -> Optional[Dict]:
        """Get snippet with audio data"""
        snippet = await self.db.bible_snippets.find_one(
            {"snippet_id": snippet_id},
            {"_id": 0}
        )
        
        if snippet:
            # Track play
            await self.db.bible_snippets.update_one(
                {"snippet_id": snippet_id},
                {"$inc": {"play_count": 1}}
            )
            # Track analytics
            await self._track_listening_analytics(snippet_id, snippet.get("book_name"), snippet.get("chapter"))
        
        return snippet
    
    async def update_snippet(self, snippet_id: str, updates: Dict) -> bool:
        """Update a snippet"""
        allowed_fields = ["title", "description", "is_active"]
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
        filtered_updates["updated_at"] = datetime.now(timezone.utc)
        
        result = await self.db.bible_snippets.update_one(
            {"snippet_id": snippet_id},
            {"$set": filtered_updates}
        )
        return result.modified_count > 0
    
    async def delete_snippet(self, snippet_id: str) -> bool:
        """Delete a snippet"""
        result = await self.db.bible_snippets.delete_one({"snippet_id": snippet_id})
        return result.deleted_count > 0
    
    async def _track_listening_analytics(self, snippet_id: str, book_name: str, chapter: int):
        """Track Bible listening analytics"""
        now = datetime.now(timezone.utc)
        hour = now.hour
        
        # Determine time of day
        if 5 <= hour < 12:
            time_of_day = "morning"
        elif 12 <= hour < 17:
            time_of_day = "afternoon"
        elif 17 <= hour < 21:
            time_of_day = "evening"
        else:
            time_of_day = "night"
        
        analytics_doc = {
            "type": "bible_listen",
            "snippet_id": snippet_id,
            "book_name": book_name,
            "chapter": chapter,
            "time_of_day": time_of_day,
            "hour": hour,
            "date": now.strftime("%Y-%m-%d"),
            "timestamp": now
        }
        
        await self.db.bible_analytics.insert_one(analytics_doc)
    
    async def get_analytics(self, days: int = 30) -> Dict:
        """Get Bible listening analytics"""
        from datetime import timedelta
        
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Total listens
        total_listens = await self.db.bible_analytics.count_documents(
            {"type": "bible_listen", "timestamp": {"$gte": start_date}}
        )
        
        # Listens by book
        book_pipeline = [
            {"$match": {"type": "bible_listen", "timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$book_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        popular_books = await self.db.bible_analytics.aggregate(book_pipeline).to_list(10)
        
        # Listens by time of day
        time_pipeline = [
            {"$match": {"type": "bible_listen", "timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$time_of_day", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        listening_times = await self.db.bible_analytics.aggregate(time_pipeline).to_list(10)
        
        # Daily trend
        daily_pipeline = [
            {"$match": {"type": "bible_listen", "timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$date", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
            {"$limit": 30}
        ]
        daily_trend = await self.db.bible_analytics.aggregate(daily_pipeline).to_list(30)
        
        # Top snippets
        top_snippets = await self.db.bible_snippets.find(
            {"is_active": True},
            {"_id": 0, "audio_base64": 0}
        ).sort("play_count", -1).limit(5).to_list(5)
        
        return {
            "total_listens": total_listens,
            "popular_books": [{"book": b["_id"], "count": b["count"]} for b in popular_books],
            "listening_times": [{"time": t["_id"], "count": t["count"]} for t in listening_times],
            "daily_trend": [{"date": d["_id"], "count": d["count"]} for d in daily_trend],
            "top_snippets": top_snippets,
            "period_days": days
        }
    
    def get_available_voices(self) -> List[Dict]:
        """Get list of available TTS voices"""
        return AVAILABLE_VOICES
