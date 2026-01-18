"""
Bible Module API Tests
Tests for Biblia na Vitabu vya Dini (Bible and Religious Books) feature
- Bible data stats, books, chapters, verses
- TTS audio generation for verses
- Admin snippet management
- Analytics tracking
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBibleStats:
    """Test Bible statistics endpoint"""
    
    def test_get_bible_stats(self):
        """GET /api/bible/stats - returns Bible data statistics"""
        response = requests.get(f"{BASE_URL}/api/bible/stats?language=sw")
        assert response.status_code == 200
        
        data = response.json()
        assert "language" in data
        assert "book_count" in data
        assert "verse_count" in data
        assert "has_data" in data
        assert data["language"] == "sw"
        print(f"✓ Bible stats: {data['book_count']} books, {data['verse_count']} verses, has_data={data['has_data']}")


class TestBibleBooks:
    """Test Bible books endpoints"""
    
    def test_get_bible_books(self):
        """GET /api/bible/books - returns list of Bible books"""
        response = requests.get(f"{BASE_URL}/api/bible/books?language=sw")
        assert response.status_code == 200
        
        data = response.json()
        assert "books" in data
        assert "count" in data
        assert isinstance(data["books"], list)
        
        if data["count"] > 0:
            book = data["books"][0]
            assert "book_id" in book
            assert "name" in book
            assert "language" in book
            print(f"✓ Found {data['count']} Bible books")
        else:
            print("⚠ No Bible books found - data may not be initialized")
    
    def test_get_book_chapters(self):
        """GET /api/bible/books/{book}/chapters - returns chapters for a book"""
        # First get a book name
        books_response = requests.get(f"{BASE_URL}/api/bible/books?language=sw")
        books_data = books_response.json()
        
        if books_data["count"] == 0:
            pytest.skip("No Bible books available - skipping chapter test")
        
        book_name = books_data["books"][0]["name"]
        response = requests.get(f"{BASE_URL}/api/bible/books/{book_name}/chapters?language=sw")
        assert response.status_code == 200
        
        data = response.json()
        assert "book" in data
        assert "chapters" in data
        assert "count" in data
        assert data["book"] == book_name
        assert isinstance(data["chapters"], list)
        print(f"✓ Book '{book_name}' has {data['count']} chapters")
    
    def test_get_chapter_verses(self):
        """GET /api/bible/books/{book}/chapters/{chapter} - returns verses"""
        # First get a book name
        books_response = requests.get(f"{BASE_URL}/api/bible/books?language=sw")
        books_data = books_response.json()
        
        if books_data["count"] == 0:
            pytest.skip("No Bible books available - skipping verses test")
        
        book_name = books_data["books"][0]["name"]
        
        # Get chapters
        chapters_response = requests.get(f"{BASE_URL}/api/bible/books/{book_name}/chapters?language=sw")
        chapters_data = chapters_response.json()
        
        if chapters_data["count"] == 0:
            pytest.skip("No chapters available - skipping verses test")
        
        chapter = chapters_data["chapters"][0]
        response = requests.get(f"{BASE_URL}/api/bible/books/{book_name}/chapters/{chapter}?language=sw")
        assert response.status_code == 200
        
        data = response.json()
        assert "book" in data
        assert "chapter" in data
        assert "verses" in data
        assert "count" in data
        assert data["book"] == book_name
        assert data["chapter"] == chapter
        assert isinstance(data["verses"], list)
        
        if data["count"] > 0:
            verse = data["verses"][0]
            assert "verse" in verse
            assert "text" in verse
            assert "reference" in verse
            print(f"✓ {book_name} chapter {chapter} has {data['count']} verses")
            print(f"  Sample verse: {verse['reference']} - {verse['text'][:50]}...")
        else:
            print(f"⚠ No verses found for {book_name} chapter {chapter}")


class TestBibleTTS:
    """Test Bible TTS (Text-to-Speech) endpoints"""
    
    def test_get_tts_voices(self):
        """GET /api/bible/tts/voices - returns available TTS voices"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        
        data = response.json()
        assert "voices" in data
        assert isinstance(data["voices"], list)
        assert len(data["voices"]) > 0
        
        voice = data["voices"][0]
        assert "id" in voice
        assert "name" in voice
        assert "description" in voice
        print(f"✓ Found {len(data['voices'])} TTS voices: {[v['id'] for v in data['voices']]}")
    
    def test_generate_verse_audio(self):
        """POST /api/bible/tts/verse - generates TTS audio for a verse"""
        # First get a verse
        books_response = requests.get(f"{BASE_URL}/api/bible/books?language=sw")
        books_data = books_response.json()
        
        if books_data["count"] == 0:
            pytest.skip("No Bible books available - skipping TTS test")
        
        book_name = books_data["books"][0]["name"]
        
        # Get chapters
        chapters_response = requests.get(f"{BASE_URL}/api/bible/books/{book_name}/chapters?language=sw")
        chapters_data = chapters_response.json()
        
        if chapters_data["count"] == 0:
            pytest.skip("No chapters available - skipping TTS test")
        
        chapter = chapters_data["chapters"][0]
        
        # Get verses
        verses_response = requests.get(f"{BASE_URL}/api/bible/books/{book_name}/chapters/{chapter}?language=sw")
        verses_data = verses_response.json()
        
        if verses_data["count"] == 0:
            pytest.skip("No verses available - skipping TTS test")
        
        verse_num = verses_data["verses"][0]["verse"]
        
        # Generate TTS audio
        response = requests.post(f"{BASE_URL}/api/bible/tts/verse", json={
            "book_name": book_name,
            "chapter": chapter,
            "verse": verse_num,
            "language": "sw",
            "voice": "nova"
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert "audio_base64" in data
        assert "reference" in data
        assert "verse_text" in data
        assert len(data["audio_base64"]) > 100  # Should have substantial audio data
        print(f"✓ Generated TTS audio for {data['reference']}")
        print(f"  Audio size: {len(data['audio_base64'])} chars (base64)")
    
    def test_generate_verse_audio_missing_params(self):
        """POST /api/bible/tts/verse - returns 400 for missing parameters"""
        response = requests.post(f"{BASE_URL}/api/bible/tts/verse", json={
            "book_name": "Matthew"
            # Missing chapter and verse
        })
        assert response.status_code == 400
        print("✓ Returns 400 for missing parameters")
    
    def test_generate_verse_audio_not_found(self):
        """POST /api/bible/tts/verse - returns 404 for non-existent verse"""
        response = requests.post(f"{BASE_URL}/api/bible/tts/verse", json={
            "book_name": "NonExistentBook",
            "chapter": 999,
            "verse": 999,
            "language": "sw"
        })
        assert response.status_code == 404
        print("✓ Returns 404 for non-existent verse")


class TestBibleSnippets:
    """Test Bible snippets endpoints (admin and user)"""
    
    def test_get_user_snippets(self):
        """GET /api/bible/snippets - returns active snippets for users"""
        response = requests.get(f"{BASE_URL}/api/bible/snippets")
        assert response.status_code == 200
        
        data = response.json()
        assert "snippets" in data
        assert isinstance(data["snippets"], list)
        print(f"✓ Found {len(data['snippets'])} active snippets for users")
        
        if len(data["snippets"]) > 0:
            snippet = data["snippets"][0]
            assert "snippet_id" in snippet
            assert "title" in snippet
            assert "reference" in snippet
            print(f"  Sample snippet: {snippet['title']} - {snippet['reference']}")
    
    def test_get_admin_snippets(self):
        """GET /api/admin/bible/snippets - returns all snippets for admin"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/snippets")
        assert response.status_code == 200
        
        data = response.json()
        assert "snippets" in data
        assert "total" in data
        assert isinstance(data["snippets"], list)
        print(f"✓ Admin view: {data['total']} total snippets")
    
    def test_create_snippet(self):
        """POST /api/admin/bible/snippets - creates a Bible snippet with audio"""
        # First check if we have Bible data
        books_response = requests.get(f"{BASE_URL}/api/bible/books?language=sw")
        books_data = books_response.json()
        
        if books_data["count"] == 0:
            pytest.skip("No Bible books available - skipping snippet creation test")
        
        book_name = books_data["books"][0]["name"]
        
        # Get chapters
        chapters_response = requests.get(f"{BASE_URL}/api/bible/books/{book_name}/chapters?language=sw")
        chapters_data = chapters_response.json()
        
        if chapters_data["count"] == 0:
            pytest.skip("No chapters available - skipping snippet creation test")
        
        chapter = chapters_data["chapters"][0]
        
        # Create snippet
        response = requests.post(f"{BASE_URL}/api/admin/bible/snippets", json={
            "title": "TEST_Snippet_" + str(int(time.time())),
            "description": "Test snippet created by automated testing",
            "book_name": book_name,
            "chapter": chapter,
            "start_verse": 1,
            "end_verse": 3,
            "language": "sw",
            "voice": "nova",
            "speed": 1.0
        })
        
        assert response.status_code == 200
        
        data = response.json()
        assert "snippet_id" in data
        assert "title" in data
        assert "reference" in data
        assert "audio_id" in data
        print(f"✓ Created snippet: {data['title']} ({data['reference']})")
        
        # Store snippet_id for cleanup
        return data["snippet_id"]
    
    def test_get_snippet_with_audio(self):
        """GET /api/bible/snippets/{snippet_id} - returns snippet with audio data"""
        # First get snippets
        snippets_response = requests.get(f"{BASE_URL}/api/bible/snippets")
        snippets_data = snippets_response.json()
        
        if len(snippets_data["snippets"]) == 0:
            pytest.skip("No snippets available - skipping audio retrieval test")
        
        snippet_id = snippets_data["snippets"][0]["snippet_id"]
        
        response = requests.get(f"{BASE_URL}/api/bible/snippets/{snippet_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "snippet_id" in data
        assert "audio_base64" in data
        assert len(data["audio_base64"]) > 100  # Should have audio data
        print(f"✓ Retrieved snippet audio: {data['title']}")
        print(f"  Audio size: {len(data['audio_base64'])} chars (base64)")
    
    def test_get_snippet_not_found(self):
        """GET /api/bible/snippets/{snippet_id} - returns 404 for non-existent snippet"""
        response = requests.get(f"{BASE_URL}/api/bible/snippets/nonexistent_snippet_id")
        assert response.status_code == 404
        print("✓ Returns 404 for non-existent snippet")


class TestBibleAnalytics:
    """Test Bible analytics endpoint"""
    
    def test_get_analytics(self):
        """GET /api/admin/bible/analytics - returns Bible analytics data"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/analytics?days=30")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_listens" in data
        assert "popular_books" in data
        assert "listening_times" in data
        assert "daily_trend" in data
        assert "top_snippets" in data
        assert "period_days" in data
        
        assert isinstance(data["popular_books"], list)
        assert isinstance(data["listening_times"], list)
        assert isinstance(data["daily_trend"], list)
        assert isinstance(data["top_snippets"], list)
        
        print(f"✓ Analytics: {data['total_listens']} total listens in {data['period_days']} days")
        print(f"  Popular books: {len(data['popular_books'])}")
        print(f"  Listening times: {data['listening_times']}")


class TestBibleSearch:
    """Test Bible search endpoint"""
    
    def test_search_bible(self):
        """GET /api/bible/search - searches Bible for text"""
        response = requests.get(f"{BASE_URL}/api/bible/search?q=Mungu&language=sw&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "query" in data
        assert "results" in data
        assert "count" in data
        assert data["query"] == "Mungu"
        
        print(f"✓ Search for 'Mungu' returned {data['count']} results")
        if data["count"] > 0:
            result = data["results"][0]
            print(f"  Sample result: {result.get('reference', 'N/A')}")


class TestBiblePassage:
    """Test Bible passage endpoint"""
    
    def test_get_passage(self):
        """GET /api/bible/passage/{book}/{chapter}/{start}/{end} - returns passage"""
        # First get a book name
        books_response = requests.get(f"{BASE_URL}/api/bible/books?language=sw")
        books_data = books_response.json()
        
        if books_data["count"] == 0:
            pytest.skip("No Bible books available - skipping passage test")
        
        book_name = books_data["books"][0]["name"]
        
        # Get chapters
        chapters_response = requests.get(f"{BASE_URL}/api/bible/books/{book_name}/chapters?language=sw")
        chapters_data = chapters_response.json()
        
        if chapters_data["count"] == 0:
            pytest.skip("No chapters available - skipping passage test")
        
        chapter = chapters_data["chapters"][0]
        
        response = requests.get(f"{BASE_URL}/api/bible/passage/{book_name}/{chapter}/1/5?language=sw")
        assert response.status_code == 200
        
        data = response.json()
        assert "reference" in data
        assert "verses" in data
        assert "combined_text" in data
        assert "count" in data
        
        print(f"✓ Passage {data['reference']} has {data['count']} verses")
        print(f"  Combined text length: {len(data['combined_text'])} chars")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
