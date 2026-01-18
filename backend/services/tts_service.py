"""
TTS Service - Text-to-Speech using ElevenLabs
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

# ElevenLabs voices - multilingual voices that work well with Swahili
AVAILABLE_VOICES = [
    {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "description": "Calm, clear American female"},
    {"id": "AZnzlk1XvdvUeBnXmlld", "name": "Domi", "description": "Strong, confident female"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella", "description": "Soft, warm female"},
    {"id": "ErXwobaYiN019PkySvjV", "name": "Antoni", "description": "Well-rounded male"},
    {"id": "MF3mGyEYCl7XYWbV9V6O", "name": "Elli", "description": "Emotional, expressive female"},
    {"id": "TxGEqnHWrfWFTfGW9XjX", "name": "Josh", "description": "Deep, narrative male"},
    {"id": "VR6AewLTigWG4xSOukaG", "name": "Arnold", "description": "Crisp, authoritative male"},
    {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "description": "Deep, narration male"},
    {"id": "yoZ06aMxZJJ28mfd3POQ", "name": "Sam", "description": "Raspy, dynamic male"},
    {"id": "jBpfuIE2acCO8z3wKNLl", "name": "Gigi", "description": "Childish, animated female"},
    {"id": "oWAxZDx7w5VEj9dCyTzz", "name": "Grace", "description": "Southern American female"},
]

# Default voice for Bible reading
DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"  # Rachel - calm and clear


class TTSService:
    def __init__(self, db):
        self.db = db
        self.api_key = os.environ.get("ELEVENLABS_API_KEY")
        self._client = None
        
    def _get_client(self):
        """Lazy initialization of ElevenLabs client"""
        if self._client is None:
            from elevenlabs import ElevenLabs
            self._client = ElevenLabs(api_key=self.api_key)
        return self._client
    
    def _generate_audio_hash(self, text: str, voice: str, stability: float) -> str:
        """Generate a unique hash for caching purposes"""
        content = f"{text}|{voice}|{stability}|elevenlabs"
        return hashlib.md5(content.encode()).hexdigest()
    
    async def generate_audio(
        self,
        text: str,
        voice: str = None,
        speed: float = 1.0,
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        cache: bool = True
    ) -> Dict[str, Any]:
        """Generate audio from text using ElevenLabs TTS"""
        try:
            # Use default voice if not specified or if old OpenAI voice name provided
            if not voice or voice in ["nova", "alloy", "echo", "fable", "onyx", "shimmer", "ash", "coral", "sage"]:
                voice = DEFAULT_VOICE
            
            # Check cache first
            audio_hash = self._generate_audio_hash(text, voice, stability)
            
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
                        "provider": "elevenlabs",
                        "duration_estimate": len(text) / 15
                    }
            
            # Generate new audio using ElevenLabs
            client = self._get_client()
            
            # ElevenLabs has a 5000 char limit per request
            if len(text) > 5000:
                text = text[:5000]
                logger.warning("Text truncated to 5000 characters")
            
            # Use eleven_multilingual_v2 for better Swahili support
            from elevenlabs import VoiceSettings
            
            voice_settings = VoiceSettings(
                stability=stability,
                similarity_boost=similarity_boost,
                style=0.0,
                use_speaker_boost=True
            )
            
            audio_generator = client.text_to_speech.convert(
                text=text,
                voice_id=voice,
                model_id="eleven_multilingual_v2",
                voice_settings=voice_settings
            )
            
            # Collect audio data from generator
            audio_bytes = b""
            for chunk in audio_generator:
                audio_bytes += chunk
            
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
                    "stability": stability,
                    "similarity_boost": similarity_boost,
                    "model": "eleven_multilingual_v2",
                    "provider": "elevenlabs",
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
                "provider": "elevenlabs",
                "file_size_bytes": len(audio_bytes),
                "duration_estimate": len(text) / 15
            }
            
        except Exception as e:
            logger.error(f"ElevenLabs TTS generation error: {e}")
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
        voice: str = None,
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
                "voice": audio_result.get("voice", DEFAULT_VOICE),
                "speed": speed,
                "audio_id": audio_result["audio_id"],
                "audio_base64": audio_result["audio_base64"],
                "duration_estimate": audio_result.get("duration_estimate", 0),
                "provider": "elevenlabs",
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
            {"_id": 0, "audio_base64": 0}
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
    
    async def fetch_elevenlabs_voices(self) -> List[Dict]:
        """Fetch all available voices from ElevenLabs API"""
        try:
            client = self._get_client()
            voices_response = client.voices.get_all()
            
            voices = []
            for voice in voices_response.voices:
                voices.append({
                    "id": voice.voice_id,
                    "name": voice.name,
                    "description": voice.description or f"{voice.labels.get('accent', '')} {voice.labels.get('gender', '')}".strip(),
                    "preview_url": voice.preview_url,
                    "category": voice.category
                })
            
            return voices
        except Exception as e:
            logger.error(f"Error fetching ElevenLabs voices: {e}")
            return AVAILABLE_VOICES
