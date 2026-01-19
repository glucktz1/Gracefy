"""
TTS Service - Text-to-Speech using Google Cloud TTS
Generates audio from Bible text and stores for reuse
Supports Swahili and multiple languages with high-quality voices
Smart caching system to reduce API costs
"""
import os
import uuid
import base64
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Google Cloud TTS voices - organized by gender for easy selection
MALE_VOICES = [
    {"id": "sw-KE-Chirp3-HD-Achird", "name": "Achird", "description": "Sauti ya kiume - kina", "language": "sw-KE", "gender": "MALE"},
    {"id": "sw-KE-Chirp3-HD-Charon", "name": "Charon", "description": "Sauti ya kiume - mamlaka", "language": "sw-KE", "gender": "MALE"},
    {"id": "sw-KE-Chirp3-HD-Fenrir", "name": "Fenrir", "description": "Sauti ya kiume - imara", "language": "sw-KE", "gender": "MALE"},
    {"id": "sw-KE-Chirp3-HD-Orus", "name": "Orus", "description": "Sauti ya kiume - simulizi", "language": "sw-KE", "gender": "MALE"},
    {"id": "en-US-Chirp3-HD-Charon", "name": "English Charon", "description": "English male voice", "language": "en-US", "gender": "MALE"},
]

FEMALE_VOICES = [
    {"id": "sw-KE-Chirp3-HD-Achernar", "name": "Achernar", "description": "Sauti ya kike - tulivu", "language": "sw-KE", "gender": "FEMALE"},
    {"id": "sw-KE-Chirp3-HD-Aoede", "name": "Aoede", "description": "Sauti ya kike - joto", "language": "sw-KE", "gender": "FEMALE"},
    {"id": "sw-KE-Chirp3-HD-Gacrux", "name": "Gacrux", "description": "Sauti ya kike - wazi", "language": "sw-KE", "gender": "FEMALE"},
    {"id": "sw-KE-Chirp3-HD-Zephyr", "name": "Zephyr", "description": "Sauti ya kike - laini", "language": "sw-KE", "gender": "FEMALE"},
    {"id": "en-US-Chirp3-HD-Achernar", "name": "English Achernar", "description": "English female voice", "language": "en-US", "gender": "FEMALE"},
    {"id": "en-GB-Chirp3-HD-Aoede", "name": "British Aoede", "description": "British female voice", "language": "en-GB", "gender": "FEMALE"},
]

# Combined list
AVAILABLE_VOICES = FEMALE_VOICES + MALE_VOICES

# Default voices
DEFAULT_FEMALE_VOICE = "sw-KE-Chirp3-HD-Achernar"
DEFAULT_MALE_VOICE = "sw-KE-Chirp3-HD-Charon"
DEFAULT_VOICE = DEFAULT_FEMALE_VOICE
DEFAULT_LANGUAGE = "sw-KE"


class TTSService:
    def __init__(self, db):
        self.db = db
        self.api_key = os.environ.get("GOOGLE_API_KEY")
        self.tts_url = "https://texttospeech.googleapis.com/v1/text:synthesize"
        
    def _generate_audio_hash(self, text: str, voice: str, speed: float) -> str:
        """Generate a unique hash for caching purposes"""
        content = f"{text}|{voice}|{speed}|google"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _get_language_for_voice(self, voice_id: str) -> str:
        """Get the language code for a voice"""
        for v in AVAILABLE_VOICES:
            if v["id"] == voice_id:
                return v["language"]
        parts = voice_id.split("-")
        if len(parts) >= 2:
            return f"{parts[0]}-{parts[1]}"
        return DEFAULT_LANGUAGE
    
    def get_voice_by_gender(self, gender: str = "female", language: str = "sw") -> str:
        """Get default voice based on gender preference"""
        voices = FEMALE_VOICES if gender.lower() == "female" else MALE_VOICES
        # Find voice matching language
        for v in voices:
            if language in v["language"].lower():
                return v["id"]
        # Fallback to first voice of that gender
        return voices[0]["id"] if voices else DEFAULT_VOICE
    
    def get_voices_by_gender(self, gender: str = None) -> List[Dict]:
        """Get voices filtered by gender"""
        if gender and gender.lower() == "male":
            return MALE_VOICES
        elif gender and gender.lower() == "female":
            return FEMALE_VOICES
        return AVAILABLE_VOICES
    
    async def get_cached_audio(self, text: str, voice: str = None, speed: float = 1.0) -> Optional[Dict]:
        """Check if audio is already cached for this text"""
        if not voice:
            voice = DEFAULT_VOICE
        audio_hash = self._generate_audio_hash(text, voice, speed)
        
        cached = await self.db.bible_audio_cache.find_one(
            {"audio_hash": audio_hash},
            {"_id": 0}
        )
        
        if cached:
            # Update access stats
            await self.db.bible_audio_cache.update_one(
                {"audio_hash": audio_hash},
                {
                    "$inc": {"access_count": 1},
                    "$set": {"last_accessed": datetime.now(timezone.utc)}
                }
            )
            return cached
        return None
    
    async def get_cache_stats(self) -> Dict:
        """Get statistics about the audio cache"""
        total_cached = await self.db.bible_audio_cache.count_documents({})
        total_size_pipeline = [
            {"$group": {"_id": None, "total_size": {"$sum": "$file_size_bytes"}, "total_accesses": {"$sum": "$access_count"}}}
        ]
        size_result = await self.db.bible_audio_cache.aggregate(total_size_pipeline).to_list(1)
        
        return {
            "total_cached_audio": total_cached,
            "total_size_bytes": size_result[0]["total_size"] if size_result else 0,
            "total_size_mb": round((size_result[0]["total_size"] if size_result else 0) / (1024 * 1024), 2),
            "total_accesses": size_result[0]["total_accesses"] if size_result else 0,
            "estimated_api_calls_saved": size_result[0]["total_accesses"] - total_cached if size_result else 0
        }
    
    async def generate_audio(
        self,
        text: str,
        voice: str = None,
        speed: float = 1.0,
        pitch: float = 0.0,
        gender: str = None,
        cache: bool = True
    ) -> Dict[str, Any]:
        """Generate audio from text using Google Cloud TTS with smart caching"""
        try:
            # Map old voice names to Google voices
            voice_mapping = {
                "nova": "sw-KE-Chirp3-HD-Achernar",
                "alloy": "sw-KE-Chirp3-HD-Aoede",
                "echo": "sw-KE-Chirp3-HD-Charon",
                "fable": "sw-KE-Chirp3-HD-Gacrux",
                "onyx": "sw-KE-Chirp3-HD-Fenrir",
                "shimmer": "sw-KE-Chirp3-HD-Zephyr",
                "Rachel": "sw-KE-Chirp3-HD-Achernar",
                "Josh": "sw-KE-Chirp3-HD-Charon",
                "male": DEFAULT_MALE_VOICE,
                "female": DEFAULT_FEMALE_VOICE,
            }
            
            # Handle gender preference
            if gender and not voice:
                voice = self.get_voice_by_gender(gender)
            
            # Use default or mapped voice
            if not voice or voice in voice_mapping:
                voice = voice_mapping.get(voice, DEFAULT_VOICE)
            
            # Check cache first
            audio_hash = self._generate_audio_hash(text, voice, speed)
            
            if cache:
                cached = await self.db.bible_audio_cache.find_one(
                    {"audio_hash": audio_hash},
                    {"_id": 0}
                )
                if cached:
                    logger.info(f"Returning cached audio: {audio_hash}")
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
                        "provider": "google",
                        "duration_estimate": len(text) / 15
                    }
            
            # Google TTS has a 5000 byte limit per request
            if len(text.encode('utf-8')) > 5000:
                text = text[:4500]
                logger.warning("Text truncated to fit Google TTS limit")
            
            # Get language code for the voice
            language_code = self._get_language_for_voice(voice)
            
            # Build the request
            request_body = {
                "input": {"text": text},
                "voice": {
                    "languageCode": language_code,
                    "name": voice
                },
                "audioConfig": {
                    "audioEncoding": "MP3",
                    "speakingRate": speed,
                    "pitch": pitch,
                    "effectsProfileId": ["small-bluetooth-speaker-class-device"]
                }
            }
            
            # Make the API request
            response = requests.post(
                f"{self.tts_url}?key={self.api_key}",
                json=request_body,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code != 200:
                error_msg = response.json().get("error", {}).get("message", response.text)
                logger.error(f"Google TTS API error: {error_msg}")
                raise Exception(f"Google TTS API error: {error_msg}")
            
            result = response.json()
            audio_base64 = result.get("audioContent", "")
            
            if not audio_base64:
                raise Exception("No audio content returned from Google TTS")
            
            audio_bytes = base64.b64decode(audio_base64)
            audio_id = f"audio_{uuid.uuid4().hex[:12]}"
            
            # Cache the audio
            if cache:
                cache_doc = {
                    "audio_id": audio_id,
                    "audio_hash": audio_hash,
                    "audio_base64": audio_base64,
                    "text_length": len(text),
                    "voice": voice,
                    "language": language_code,
                    "speed": speed,
                    "pitch": pitch,
                    "provider": "google",
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
                "language": language_code,
                "provider": "google",
                "file_size_bytes": len(audio_bytes),
                "duration_estimate": len(text) / 15
            }
            
        except Exception as e:
            logger.error(f"Google TTS generation error: {e}")
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
        created_by: str = None,
        # New devotional card fields
        heading: str = None,
        subtitle: str = None,
        card_type: str = "snippet",  # "snippet", "daily_devotion", "featured"
        thumbnail_url: str = None,
        is_featured: bool = False,
        display_order: int = 0
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
            
            # Select appropriate voice based on language
            if not voice:
                voice = "sw-KE-Chirp3-HD-Achernar" if language == "sw" else "en-US-Chirp3-HD-Achernar"
            
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
                "voice": audio_result.get("voice", voice),
                "speed": speed,
                "audio_id": audio_result["audio_id"],
                "audio_base64": audio_result["audio_base64"],
                "duration_estimate": audio_result.get("duration_estimate", 0),
                "provider": "google",
                "is_active": True,
                "play_count": 0,
                "created_by": created_by,
                # New devotional card fields
                "heading": heading or title,
                "subtitle": subtitle or description,
                "card_type": card_type,
                "thumbnail_url": thumbnail_url,
                "is_featured": is_featured,
                "display_order": display_order,
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
            await self.db.bible_snippets.update_one(
                {"snippet_id": snippet_id},
                {"$inc": {"play_count": 1}}
            )
            await self._track_listening_analytics(snippet_id, snippet.get("book_name"), snippet.get("chapter"))
        
        return snippet
    
    async def update_snippet(self, snippet_id: str, updates: Dict) -> bool:
        """Update a snippet"""
        allowed_fields = ["title", "description", "is_active", "heading", "subtitle", 
                         "card_type", "thumbnail_url", "is_featured", "display_order"]
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
        
        total_listens = await self.db.bible_analytics.count_documents(
            {"type": "bible_listen", "timestamp": {"$gte": start_date}}
        )
        
        book_pipeline = [
            {"$match": {"type": "bible_listen", "timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$book_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        popular_books = await self.db.bible_analytics.aggregate(book_pipeline).to_list(10)
        
        time_pipeline = [
            {"$match": {"type": "bible_listen", "timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$time_of_day", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        listening_times = await self.db.bible_analytics.aggregate(time_pipeline).to_list(10)
        
        daily_pipeline = [
            {"$match": {"type": "bible_listen", "timestamp": {"$gte": start_date}}},
            {"$group": {"_id": "$date", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
            {"$limit": 30}
        ]
        daily_trend = await self.db.bible_analytics.aggregate(daily_pipeline).to_list(30)
        
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
