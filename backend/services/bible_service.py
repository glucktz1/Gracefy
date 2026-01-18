"""
Bible Service - Handles Bible data fetching, storage, and retrieval
Supports Swahili Bible (Neno/Habari Njema) and other translations
"""
import aiohttp
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# Bible data sources - Using SourceForge public domain Bible
SWAHILI_BIBLE_URL = "https://sourceforge.net/projects/biblesuper/files/All%20Bibles%20-%20JSON/SW-Swahili/swahili.json/download"
ENGLISH_BIBLE_URL = "https://sourceforge.net/projects/biblesuper/files/All%20Bibles%20-%20JSON/EN-English/english_kjv.json/download"

# Book name mappings (English to Swahili)
BOOK_NAMES = {
    "en": {
        "Genesis": "Genesis", "Exodus": "Exodus", "Leviticus": "Leviticus",
        "Numbers": "Numbers", "Deuteronomy": "Deuteronomy", "Joshua": "Joshua",
        "Judges": "Judges", "Ruth": "Ruth", "1 Samuel": "1 Samuel",
        "2 Samuel": "2 Samuel", "1 Kings": "1 Kings", "2 Kings": "2 Kings",
        "1 Chronicles": "1 Chronicles", "2 Chronicles": "2 Chronicles",
        "Ezra": "Ezra", "Nehemiah": "Nehemiah", "Esther": "Esther",
        "Job": "Job", "Psalms": "Psalms", "Proverbs": "Proverbs",
        "Ecclesiastes": "Ecclesiastes", "Song of Solomon": "Song of Solomon",
        "Isaiah": "Isaiah", "Jeremiah": "Jeremiah", "Lamentations": "Lamentations",
        "Ezekiel": "Ezekiel", "Daniel": "Daniel", "Hosea": "Hosea",
        "Joel": "Joel", "Amos": "Amos", "Obadiah": "Obadiah",
        "Jonah": "Jonah", "Micah": "Micah", "Nahum": "Nahum",
        "Habakkuk": "Habakkuk", "Zephaniah": "Zephaniah", "Haggai": "Haggai",
        "Zechariah": "Zechariah", "Malachi": "Malachi",
        "Matthew": "Matthew", "Mark": "Mark", "Luke": "Luke", "John": "John",
        "Acts": "Acts", "Romans": "Romans", "1 Corinthians": "1 Corinthians",
        "2 Corinthians": "2 Corinthians", "Galatians": "Galatians",
        "Ephesians": "Ephesians", "Philippians": "Philippians",
        "Colossians": "Colossians", "1 Thessalonians": "1 Thessalonians",
        "2 Thessalonians": "2 Thessalonians", "1 Timothy": "1 Timothy",
        "2 Timothy": "2 Timothy", "Titus": "Titus", "Philemon": "Philemon",
        "Hebrews": "Hebrews", "James": "James", "1 Peter": "1 Peter",
        "2 Peter": "2 Peter", "1 John": "1 John", "2 John": "2 John",
        "3 John": "3 John", "Jude": "Jude", "Revelation": "Revelation"
    },
    "sw": {
        "Genesis": "Mwanzo", "Exodus": "Kutoka", "Leviticus": "Mambo ya Walawi",
        "Numbers": "Hesabu", "Deuteronomy": "Kumbukumbu la Torati", "Joshua": "Yoshua",
        "Judges": "Waamuzi", "Ruth": "Ruthu", "1 Samuel": "1 Samweli",
        "2 Samuel": "2 Samweli", "1 Kings": "1 Wafalme", "2 Kings": "2 Wafalme",
        "1 Chronicles": "1 Mambo ya Nyakati", "2 Chronicles": "2 Mambo ya Nyakati",
        "Ezra": "Ezra", "Nehemiah": "Nehemia", "Esther": "Esta",
        "Job": "Ayubu", "Psalms": "Zaburi", "Proverbs": "Mithali",
        "Ecclesiastes": "Mhubiri", "Song of Solomon": "Wimbo Ulio Bora",
        "Isaiah": "Isaya", "Jeremiah": "Yeremia", "Lamentations": "Maombolezo",
        "Ezekiel": "Ezekieli", "Daniel": "Danieli", "Hosea": "Hosea",
        "Joel": "Yoeli", "Amos": "Amosi", "Obadiah": "Obadia",
        "Jonah": "Yona", "Micah": "Mika", "Nahum": "Nahumu",
        "Habakkuk": "Habakuki", "Zephaniah": "Sefania", "Haggai": "Hagai",
        "Zechariah": "Zekaria", "Malachi": "Malaki",
        "Matthew": "Mathayo", "Mark": "Marko", "Luke": "Luka", "John": "Yohana",
        "Acts": "Matendo", "Romans": "Warumi", "1 Corinthians": "1 Wakorintho",
        "2 Corinthians": "2 Wakorintho", "Galatians": "Wagalatia",
        "Ephesians": "Waefeso", "Philippians": "Wafilipi",
        "Colossians": "Wakolosai", "1 Thessalonians": "1 Wathesalonike",
        "2 Thessalonians": "2 Wathesalonike", "1 Timothy": "1 Timotheo",
        "2 Timothy": "2 Timotheo", "Titus": "Tito", "Philemon": "Filemoni",
        "Hebrews": "Waebrania", "James": "Yakobo", "1 Peter": "1 Petro",
        "2 Peter": "2 Petro", "1 John": "1 Yohana", "2 John": "2 Yohana",
        "3 John": "3 Yohana", "Jude": "Yuda", "Revelation": "Ufunuo"
    }
}

# Standard book order
BOOK_ORDER = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther",
    "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
    "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea",
    "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
    "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
    "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians",
    "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus",
    "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John",
    "2 John", "3 John", "Jude", "Revelation"
]


class BibleService:
    def __init__(self, db):
        self.db = db
        
    async def fetch_and_store_bible(self, language: str = "sw") -> Dict[str, Any]:
        """Fetch Bible data from external source and store in MongoDB"""
        try:
            url = SWAHILI_BIBLE_URL if language == "sw" else ENGLISH_BIBLE_URL
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=120), allow_redirects=True) as response:
                    if response.status != 200:
                        raise Exception(f"Failed to fetch Bible data: HTTP {response.status}")
                    
                    bible_data = await response.json()
            
            # Process and store the Bible data
            books_stored = 0
            verses_stored = 0
            books_processed = set()
            
            # SourceForge format: {"metadata": {...}, "verses": [{book_name, book, chapter, verse, text}, ...]}
            if isinstance(bible_data, dict) and "verses" in bible_data:
                verses_list = bible_data.get("verses", [])
                
                for verse_data in verses_list:
                    book_name = verse_data.get("book_name", "Unknown")
                    chapter = verse_data.get("chapter", 1)
                    verse_num = verse_data.get("verse", 1)
                    text = verse_data.get("text", "")
                    book_number = verse_data.get("book", 0)
                    
                    # Store book if not already done
                    if book_name not in books_processed:
                        # Determine testament based on book number (1-39 OT, 40-66 NT)
                        testament = "old" if book_number < 40 else "new"
                        
                        book_doc = {
                            "book_id": f"book_{language}_{book_name.lower().replace(' ', '_')}",
                            "name": book_name,
                            "name_localized": BOOK_NAMES.get(language, {}).get(book_name, book_name),
                            "language": language,
                            "testament": testament,
                            "order": book_number,
                            "updated_at": datetime.now(timezone.utc)
                        }
                        
                        await self.db.bible_books.update_one(
                            {"book_id": book_doc["book_id"]},
                            {"$set": book_doc},
                            upsert=True
                        )
                        books_processed.add(book_name)
                        books_stored += 1
                    
                    # Store verse
                    verse_doc = {
                        "verse_id": f"verse_{language}_{book_name.lower().replace(' ', '_')}_{chapter}_{verse_num}",
                        "book_name": book_name,
                        "book_name_localized": BOOK_NAMES.get(language, {}).get(book_name, book_name),
                        "chapter": chapter,
                        "verse": verse_num,
                        "text": text,
                        "language": language,
                        "reference": f"{book_name} {chapter}:{verse_num}",
                        "reference_localized": f"{BOOK_NAMES.get(language, {}).get(book_name, book_name)} {chapter}:{verse_num}"
                    }
                    
                    await self.db.bible_verses.update_one(
                        {"verse_id": verse_doc["verse_id"]},
                        {"$set": verse_doc},
                        upsert=True
                    )
                    verses_stored += 1
            
            # Legacy format: list of books with chapters
            elif isinstance(bible_data, list):
                for book_data in bible_data:
                    book_name = book_data.get("book") or book_data.get("name", "Unknown")
                    chapters = book_data.get("chapters", [])
                    
                    # Determine testament
                    book_order = BOOK_ORDER.index(book_name) if book_name in BOOK_ORDER else 99
                    testament = "old" if book_order < 39 else "new"
                    
                    book_doc = {
                        "book_id": f"book_{language}_{book_name.lower().replace(' ', '_')}",
                        "name": book_name,
                        "name_localized": BOOK_NAMES.get(language, {}).get(book_name, book_name),
                        "language": language,
                        "testament": testament,
                        "order": book_order,
                        "chapter_count": len(chapters),
                        "updated_at": datetime.now(timezone.utc)
                    }
                    
                    await self.db.bible_books.update_one(
                        {"book_id": book_doc["book_id"]},
                        {"$set": book_doc},
                        upsert=True
                    )
                    books_stored += 1
                    
                    for chapter_idx, chapter_data in enumerate(chapters):
                        chapter_num = chapter_idx + 1
                        verses = chapter_data if isinstance(chapter_data, list) else chapter_data.get("verses", [])
                        
                        for verse_idx, verse_text in enumerate(verses):
                            verse_num = verse_idx + 1
                            verse_doc = {
                                "verse_id": f"verse_{language}_{book_name.lower().replace(' ', '_')}_{chapter_num}_{verse_num}",
                                "book_name": book_name,
                                "book_name_localized": BOOK_NAMES.get(language, {}).get(book_name, book_name),
                                "chapter": chapter_num,
                                "verse": verse_num,
                                "text": verse_text if isinstance(verse_text, str) else verse_text.get("text", ""),
                                "language": language,
                                "reference": f"{book_name} {chapter_num}:{verse_num}",
                                "reference_localized": f"{BOOK_NAMES.get(language, {}).get(book_name, book_name)} {chapter_num}:{verse_num}"
                            }
                            
                            await self.db.bible_verses.update_one(
                                {"verse_id": verse_doc["verse_id"]},
                                {"$set": verse_doc},
                                upsert=True
                            )
                            verses_stored += 1
            
            # Create indexes
            await self.db.bible_books.create_index("book_id", unique=True)
            await self.db.bible_books.create_index("language")
            await self.db.bible_books.create_index("order")
            await self.db.bible_verses.create_index("verse_id", unique=True)
            await self.db.bible_verses.create_index([("book_name", 1), ("chapter", 1), ("verse", 1)])
            await self.db.bible_verses.create_index("language")
            await self.db.bible_verses.create_index([("language", 1), ("book_name", 1)])
            
            return {
                "success": True,
                "language": language,
                "books_stored": books_stored,
                "verses_stored": verses_stored
            }
            
        except Exception as e:
            logger.error(f"Error fetching Bible data: {e}")
            raise
    
    async def get_books(self, language: str = "sw") -> List[Dict]:
        """Get all books for a language"""
        books = await self.db.bible_books.find(
            {"language": language},
            {"_id": 0}
        ).sort("order", 1).to_list(100)
        return books
    
    async def get_chapters(self, book_name: str, language: str = "sw") -> List[int]:
        """Get all chapter numbers for a book"""
        # Find distinct chapters for this book
        chapters = await self.db.bible_verses.distinct(
            "chapter",
            {"book_name": book_name, "language": language}
        )
        return sorted(chapters)
    
    async def get_verses(self, book_name: str, chapter: int, language: str = "sw") -> List[Dict]:
        """Get all verses for a chapter"""
        verses = await self.db.bible_verses.find(
            {"book_name": book_name, "chapter": chapter, "language": language},
            {"_id": 0}
        ).sort("verse", 1).to_list(200)
        return verses
    
    async def get_verse(self, book_name: str, chapter: int, verse: int, language: str = "sw") -> Optional[Dict]:
        """Get a specific verse"""
        verse_doc = await self.db.bible_verses.find_one(
            {"book_name": book_name, "chapter": chapter, "verse": verse, "language": language},
            {"_id": 0}
        )
        return verse_doc
    
    async def get_passage(self, book_name: str, chapter: int, start_verse: int, end_verse: int, language: str = "sw") -> List[Dict]:
        """Get a range of verses (passage)"""
        verses = await self.db.bible_verses.find(
            {
                "book_name": book_name,
                "chapter": chapter,
                "verse": {"$gte": start_verse, "$lte": end_verse},
                "language": language
            },
            {"_id": 0}
        ).sort("verse", 1).to_list(200)
        return verses
    
    async def search_verses(self, query: str, language: str = "sw", limit: int = 50) -> List[Dict]:
        """Search for verses containing text"""
        # Create text index if not exists
        try:
            await self.db.bible_verses.create_index([("text", "text")])
        except:
            pass
        
        verses = await self.db.bible_verses.find(
            {"$text": {"$search": query}, "language": language},
            {"_id": 0, "score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
        return verses
    
    async def get_bible_stats(self, language: str = "sw") -> Dict:
        """Get statistics about the stored Bible data"""
        book_count = await self.db.bible_books.count_documents({"language": language})
        verse_count = await self.db.bible_verses.count_documents({"language": language})
        
        return {
            "language": language,
            "book_count": book_count,
            "verse_count": verse_count,
            "has_data": book_count > 0
        }
