"""
Test Legal & Compliance, Branding Settings, and Lent Category Fix
Tests for:
1. Legal pages API (Terms, Privacy, Contact)
2. Branding settings API
3. Lent section category filtering
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLegalPages:
    """Test Legal & Compliance API endpoints"""
    
    def test_get_terms_of_service_english(self):
        """Test GET /api/legal/terms_of_service returns English content"""
        response = requests.get(f"{BASE_URL}/api/legal/terms_of_service?lang=en")
        assert response.status_code == 200
        data = response.json()
        
        assert data["page_id"] == "terms_of_service"
        assert data["title"] == "Terms of Service"
        assert "Terms of Service" in data["content"]
        assert "Acceptance of Terms" in data["content"]
    
    def test_get_terms_of_service_swahili(self):
        """Test GET /api/legal/terms_of_service returns Swahili content"""
        response = requests.get(f"{BASE_URL}/api/legal/terms_of_service?lang=sw")
        assert response.status_code == 200
        data = response.json()
        
        assert data["page_id"] == "terms_of_service"
        assert data["title"] == "Masharti ya Huduma"
        assert "Masharti ya Huduma" in data["content"]
    
    def test_get_privacy_policy_english(self):
        """Test GET /api/legal/privacy_policy returns English content"""
        response = requests.get(f"{BASE_URL}/api/legal/privacy_policy?lang=en")
        assert response.status_code == 200
        data = response.json()
        
        assert data["page_id"] == "privacy_policy"
        assert data["title"] == "Privacy Policy"
        assert "Privacy Policy" in data["content"]
        assert "Information We Collect" in data["content"]
    
    def test_get_privacy_policy_swahili(self):
        """Test GET /api/legal/privacy_policy returns Swahili content"""
        response = requests.get(f"{BASE_URL}/api/legal/privacy_policy?lang=sw")
        assert response.status_code == 200
        data = response.json()
        
        assert data["page_id"] == "privacy_policy"
        assert data["title"] == "Sera ya Faragha"
        assert "Sera ya Faragha" in data["content"]
    
    def test_get_contact_page_english(self):
        """Test GET /api/legal/contact returns English content"""
        response = requests.get(f"{BASE_URL}/api/legal/contact?lang=en")
        assert response.status_code == 200
        data = response.json()
        
        assert data["page_id"] == "contact"
        assert data["title"] == "Contact Us"
        assert "Contact Us" in data["content"]
        assert "support@gracefy.com" in data["content"]
    
    def test_get_contact_page_swahili(self):
        """Test GET /api/legal/contact returns Swahili content"""
        response = requests.get(f"{BASE_URL}/api/legal/contact?lang=sw")
        assert response.status_code == 200
        data = response.json()
        
        assert data["page_id"] == "contact"
        assert data["title"] == "Wasiliana Nasi"
        assert "Wasiliana Nasi" in data["content"]
    
    def test_invalid_legal_page_returns_404(self):
        """Test GET /api/legal/invalid returns 404"""
        response = requests.get(f"{BASE_URL}/api/legal/invalid_page")
        assert response.status_code == 404


class TestBrandingSettings:
    """Test Branding Settings API endpoints"""
    
    def test_get_branding_settings(self):
        """Test GET /api/branding returns branding configuration"""
        response = requests.get(f"{BASE_URL}/api/branding")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert "app_name" in data
        assert "logo_url" in data or "logo" in data
        # Branding should have color settings
        assert "primary_color" in data or "colors" in data or data.get("app_name") is not None


class TestLentCategoryFix:
    """Test Lent section category filtering - 'Nasikia Yesu waniita' should NOT appear in Lent"""
    
    def test_lent_section_exists(self):
        """Test that Lent section (section_922b32cfdfbf) exists and is active"""
        response = requests.get(f"{BASE_URL}/api/user/home?platform=web")
        assert response.status_code == 200
        data = response.json()
        
        sections = data.get("sections", [])
        lent_section = next(
            (s for s in sections if s.get("section_id") == "section_922b32cfdfbf"),
            None
        )
        
        assert lent_section is not None, "Lent section not found"
        assert lent_section.get("is_active") == True
        assert "kwaresma" in lent_section.get("name", "").lower() or "lent" in lent_section.get("name", "").lower()
    
    def test_lent_section_has_lent_tagged_albums(self):
        """Test that Lent section contains albums with Lent tags"""
        response = requests.get(f"{BASE_URL}/api/user/section/section_922b32cfdfbf")
        assert response.status_code == 200
        data = response.json()
        
        items = data.get("items", [])
        assert len(items) > 0, "Lent section should have albums"
        
        # Check that albums have Lent-related tags
        for item in items:
            tags = item.get("tags", [])
            title = item.get("title", "").lower()
            # Albums should either have kwaresma tag or be Lent-themed
            has_lent_tag = any("kwaresma" in str(tag).lower() or "lent" in str(tag).lower() for tag in tags)
            is_lent_themed = any(word in title for word in ["msalaba", "kwaresma", "lent", "dhambi", "makosa"])
            assert has_lent_tag or is_lent_themed, f"Album '{item.get('title')}' doesn't appear to be Lent content"
    
    def test_nasikia_yesu_waniita_not_in_lent_section(self):
        """Test that 'Nasikia Yesu waniita' is NOT in the Lent section"""
        response = requests.get(f"{BASE_URL}/api/user/section/section_922b32cfdfbf")
        assert response.status_code == 200
        data = response.json()
        
        items = data.get("items", [])
        
        # Check that 'Nasikia Yesu waniita' is not in the Lent section
        nasikia_albums = [
            item for item in items 
            if "nasikia" in item.get("title", "").lower()
        ]
        
        assert len(nasikia_albums) == 0, f"'Nasikia Yesu waniita' should NOT be in Lent section, but found: {nasikia_albums}"
    
    def test_nasikia_yesu_waniita_in_praise_worship_section(self):
        """Test that 'Nasikia Yesu waniita' IS in the Praise & Worship section"""
        response = requests.get(f"{BASE_URL}/api/user/section/section_0fd748966c83")
        assert response.status_code == 200
        data = response.json()
        
        items = data.get("items", [])
        
        # Check that 'Nasikia Yesu waniita' is in the Praise & Worship section
        nasikia_albums = [
            item for item in items 
            if "nasikia" in item.get("title", "").lower()
        ]
        
        assert len(nasikia_albums) > 0, "'Nasikia Yesu waniita' should be in Praise & Worship section"
        assert nasikia_albums[0].get("album_id") == "alb_db50d9f82e0e"
    
    def test_lent_section_uses_correct_category_id(self):
        """Test that Lent section is configured with correct link_category_id"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?platform=web")
        assert response.status_code == 200
        data = response.json()
        
        sections = data.get("sections", [])
        lent_section = next(
            (s for s in sections if s.get("section_id") == "section_922b32cfdfbf"),
            None
        )
        
        assert lent_section is not None, "Lent section not found in layout sections"
        # The section should have link_category_id set to songcat_f13791e16795 (Kwaresma)
        link_category_id = lent_section.get("link_category_id")
        assert link_category_id == "songcat_f13791e16795", f"Expected link_category_id 'songcat_f13791e16795', got '{link_category_id}'"


class TestAdminLegalPages:
    """Test Admin Legal Pages API endpoints"""
    
    def test_get_all_legal_pages_admin(self):
        """Test GET /api/admin/legal returns all legal pages"""
        response = requests.get(f"{BASE_URL}/api/admin/legal")
        assert response.status_code == 200
        data = response.json()
        
        pages = data.get("pages", [])
        assert len(pages) == 3, "Should have 3 legal pages (terms, privacy, contact)"
        
        page_ids = [p.get("page_id") for p in pages]
        assert "terms_of_service" in page_ids
        assert "privacy_policy" in page_ids
        assert "contact" in page_ids


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
