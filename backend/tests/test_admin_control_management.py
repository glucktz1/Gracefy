"""
Test Admin Panel "Control and Management" API Fixes
====================================================
Tests CDN Management, RBAC, Approvals, Bible TTS Settings, and Layout Manager APIs.
"""

import pytest
import requests
import os

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check to ensure API is reachable"""
    
    def test_api_health(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"API health: {data}")


class TestCDNManagementDashboard:
    """Test CDN Management Dashboard APIs - /api/admin/cdn/stats"""
    
    def test_cdn_stats_endpoint_exists(self):
        """Verify CDN stats endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/admin/cdn/stats", timeout=10)
        assert response.status_code == 200, f"CDN stats endpoint failed: {response.status_code} - {response.text}"
        print(f"CDN stats endpoint returned 200")
    
    def test_cdn_stats_has_folders_object(self):
        """Verify CDN stats includes folders object with audio, images, thumbnails"""
        response = requests.get(f"{BASE_URL}/api/admin/cdn/stats", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        # Check folders structure
        assert "folders" in data, f"Missing 'folders' in response: {data.keys()}"
        folders = data["folders"]
        
        # Check audio folder
        assert "audio" in folders, f"Missing 'audio' in folders: {folders.keys()}"
        assert "count" in folders["audio"], "Missing 'count' in audio folder"
        assert "size_mb" in folders["audio"], "Missing 'size_mb' in audio folder"
        
        # Check images folder
        assert "images" in folders, f"Missing 'images' in folders: {folders.keys()}"
        assert "count" in folders["images"], "Missing 'count' in images folder"
        assert "size_mb" in folders["images"], "Missing 'size_mb' in images folder"
        
        # Check thumbnails folder
        assert "thumbnails" in folders, f"Missing 'thumbnails' in folders: {folders.keys()}"
        assert "count" in folders["thumbnails"], "Missing 'count' in thumbnails folder"
        assert "size_mb" in folders["thumbnails"], "Missing 'size_mb' in thumbnails folder"
        
        print(f"Folders structure correct: {folders}")
    
    def test_cdn_stats_has_total_size_mb(self):
        """Verify CDN stats includes total_size_mb field"""
        response = requests.get(f"{BASE_URL}/api/admin/cdn/stats", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        assert "total_size_mb" in data, f"Missing 'total_size_mb' in response: {data.keys()}"
        print(f"total_size_mb: {data['total_size_mb']}")
    
    def test_cdn_stats_has_file_counts(self):
        """Verify CDN stats includes cdn_files and local_files counts"""
        response = requests.get(f"{BASE_URL}/api/admin/cdn/stats", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        assert "cdn_files" in data, f"Missing 'cdn_files' in response: {data.keys()}"
        assert "local_files" in data, f"Missing 'local_files' in response: {data.keys()}"
        
        print(f"File counts - CDN: {data['cdn_files']}, Local: {data['local_files']}")


class TestRBACRoleManagement:
    """Test RBAC (Role-Based Access Control) APIs"""
    
    def test_rbac_roles_endpoint_exists(self):
        """Verify /api/rbac/roles endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/rbac/roles", timeout=10)
        assert response.status_code == 200, f"RBAC roles endpoint failed: {response.status_code} - {response.text}"
    
    def test_rbac_roles_has_all_roles_array(self):
        """Verify /api/rbac/roles includes all_roles array"""
        response = requests.get(f"{BASE_URL}/api/rbac/roles", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        # Check for all_roles array
        assert "all_roles" in data, f"Missing 'all_roles' in response: {data.keys()}"
        assert isinstance(data["all_roles"], list), "'all_roles' should be an array"
        
        # Also check system_roles and custom_roles
        assert "system_roles" in data, f"Missing 'system_roles' in response"
        assert "custom_roles" in data, f"Missing 'custom_roles' in response"
        
        print(f"Found {len(data['all_roles'])} total roles, {len(data['system_roles'])} system roles")
    
    def test_rbac_stats_endpoint(self):
        """Verify /api/rbac/stats endpoint returns expected structure"""
        response = requests.get(f"{BASE_URL}/api/rbac/stats", timeout=10)
        assert response.status_code == 200, f"RBAC stats endpoint failed: {response.status_code}"
        data = response.json()
        
        # Check for role_stats object
        assert "role_stats" in data, f"Missing 'role_stats' in response: {data.keys()}"
        role_stats = data["role_stats"]
        
        # If there are any roles, verify structure
        if role_stats:
            for role_key, role_data in role_stats.items():
                assert "name" in role_data, f"Missing 'name' in role_stats[{role_key}]"
                assert "color" in role_data, f"Missing 'color' in role_stats[{role_key}]"
                assert "count" in role_data, f"Missing 'count' in role_stats[{role_key}]"
        
        print(f"RBAC stats: {len(role_stats)} roles, total_users: {data.get('total_users')}")
    
    def test_rbac_permissions_flat_array(self):
        """Verify /api/rbac/permissions returns flat array with required fields"""
        response = requests.get(f"{BASE_URL}/api/rbac/permissions", timeout=10)
        assert response.status_code == 200, f"RBAC permissions endpoint failed: {response.status_code}"
        data = response.json()
        
        assert "permissions" in data, f"Missing 'permissions' in response: {data.keys()}"
        permissions = data["permissions"]
        assert isinstance(permissions, list), "'permissions' should be an array"
        
        # Check first permission has required fields
        if permissions:
            first_perm = permissions[0]
            assert "permission_id" in first_perm, f"Missing 'permission_id' in permission: {first_perm.keys()}"
            assert "name" in first_perm, f"Missing 'name' in permission"
            assert "description" in first_perm, f"Missing 'description' in permission"
            assert "category" in first_perm, f"Missing 'category' in permission"
        
        print(f"Found {len(permissions)} permissions")
    
    def test_rbac_users_has_assigned_role(self):
        """Verify /api/rbac/users returns users with assigned_role and user_type fields"""
        response = requests.get(f"{BASE_URL}/api/rbac/users", timeout=10)
        assert response.status_code == 200, f"RBAC users endpoint failed: {response.status_code}"
        data = response.json()
        
        assert "users" in data, f"Missing 'users' in response"
        users = data["users"]
        
        # Check fields on users if any exist
        if users:
            first_user = users[0]
            assert "assigned_role" in first_user, f"Missing 'assigned_role' in user: {first_user.keys()}"
            assert "user_type" in first_user, f"Missing 'user_type' in user: {first_user.keys()}"
            print(f"First user: role={first_user.get('assigned_role')}, type={first_user.get('user_type')}")
        else:
            print("No users found (empty list) - structure verified")
    
    def test_rbac_assign_role_endpoint_exists(self):
        """Verify POST /api/rbac/users/{user_id}/assign-role endpoint exists"""
        # Use a non-existent user_id to test endpoint existence (should return 404, not 405)
        response = requests.post(
            f"{BASE_URL}/api/rbac/users/nonexistent_user_123/assign-role",
            json={"role_id": "role_user"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        # Should be 404 (user not found), not 405 (method not allowed)
        assert response.status_code == 404, f"Assign role endpoint returned unexpected status: {response.status_code}"
        print("Assign role endpoint exists (returned 404 for non-existent user)")


class TestApprovalsWorkflow:
    """Test Approvals Workflow APIs"""
    
    def test_approvals_endpoint_exists(self):
        """Verify GET /api/approvals endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/approvals", timeout=10)
        assert response.status_code == 200, f"Approvals endpoint failed: {response.status_code}"
    
    def test_approvals_returns_choirs_with_singer_id(self):
        """Verify approvals returns choirs with singer_id field"""
        response = requests.get(f"{BASE_URL}/api/approvals", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        # Should have choirs array
        assert "choirs" in data, f"Missing 'choirs' in response: {data.keys()}"
        choirs = data["choirs"]
        
        # If there are pending choirs, verify singer_id field exists
        if choirs:
            first_choir = choirs[0]
            assert "singer_id" in first_choir, f"Missing 'singer_id' in choir: {first_choir.keys()}"
            print(f"Found {len(choirs)} pending choirs, first singer_id: {first_choir.get('singer_id')}")
        else:
            print("No pending choirs - structure verified")
    
    def test_choir_registrations_endpoint(self):
        """Verify GET /api/admin/choir-registrations endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/choir-registrations", timeout=10)
        assert response.status_code == 200, f"Choir registrations endpoint failed: {response.status_code}"
        data = response.json()
        
        assert "registrations" in data, f"Missing 'registrations' in response"
        registrations = data["registrations"]
        
        # Verify singer_id field if registrations exist
        if registrations:
            first_reg = registrations[0]
            assert "singer_id" in first_reg, f"Missing 'singer_id' in registration: {first_reg.keys()}"
            print(f"Found {len(registrations)} registrations, first singer_id: {first_reg.get('singer_id')}")
        else:
            print("No registrations - structure verified")
    
    def test_choir_approve_endpoint_exists(self):
        """Verify POST /api/admin/choir/{singer_id}/approve endpoint exists"""
        # Use a non-existent singer_id to test endpoint existence
        response = requests.post(
            f"{BASE_URL}/api/admin/choir/nonexistent_singer_123/approve",
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        # Should be 200 (endpoint works even if choir doesn't exist) or any non-405 status
        assert response.status_code != 405, f"Approve endpoint doesn't exist: {response.status_code}"
        print(f"Approve endpoint exists, returned: {response.status_code}")


class TestBibleTTSSettings:
    """Test Bible TTS Settings APIs"""
    
    def test_tts_settings_get_endpoint(self):
        """Verify GET /api/admin/bible/tts-settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/tts-settings", timeout=10)
        assert response.status_code == 200, f"TTS settings endpoint failed: {response.status_code}"
    
    def test_tts_settings_has_default_speed(self):
        """Verify TTS settings includes default_speed field"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/tts-settings", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        assert "default_speed" in data, f"Missing 'default_speed' in TTS settings: {data.keys()}"
        default_speed = data["default_speed"]
        assert isinstance(default_speed, (int, float)), f"default_speed should be numeric: {type(default_speed)}"
        print(f"TTS settings default_speed: {default_speed}")
    
    def test_tts_settings_update_speed(self):
        """Test updating TTS speed setting"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/bible/tts-settings", timeout=10)
        original_speed = get_response.json().get("default_speed", 1.0)
        
        # Update to new speed
        new_speed = 1.5
        update_response = requests.put(
            f"{BASE_URL}/api/admin/bible/tts-settings",
            json={"default_speed": new_speed},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        assert update_response.status_code == 200, f"Update TTS settings failed: {update_response.status_code}"
        
        # Verify the update persisted
        verify_response = requests.get(f"{BASE_URL}/api/admin/bible/tts-settings", timeout=10)
        updated_data = verify_response.json()
        assert updated_data.get("default_speed") == new_speed, f"Speed not updated: expected {new_speed}, got {updated_data.get('default_speed')}"
        print(f"Successfully updated speed to {new_speed}")
        
        # Restore original speed
        requests.put(
            f"{BASE_URL}/api/admin/bible/tts-settings",
            json={"default_speed": original_speed},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
    
    def test_tts_settings_speed_validation_min(self):
        """Test that speed below 0.5 is rejected"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/tts-settings",
            json={"default_speed": 0.3},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        assert response.status_code == 400, f"Should reject speed < 0.5: {response.status_code}"
        print("Correctly rejected speed below 0.5")
    
    def test_tts_settings_speed_validation_max(self):
        """Test that speed above 2.0 is rejected"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/tts-settings",
            json={"default_speed": 2.5},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        assert response.status_code == 400, f"Should reject speed > 2.0: {response.status_code}"
        print("Correctly rejected speed above 2.0")


class TestLayoutManager:
    """Test Layout Manager APIs"""
    
    def test_layout_sections_endpoint(self):
        """Verify GET /api/layout/sections endpoint"""
        response = requests.get(f"{BASE_URL}/api/layout/sections", timeout=10)
        assert response.status_code == 200, f"Layout sections endpoint failed: {response.status_code}"
    
    def test_layout_sections_include_inactive(self):
        """Verify GET /api/layout/sections?include_inactive=true returns all sections"""
        # First get without include_inactive (active only)
        active_response = requests.get(f"{BASE_URL}/api/layout/sections", timeout=10)
        assert active_response.status_code == 200
        active_data = active_response.json()
        active_sections = active_data.get("sections", [])
        
        # Then get with include_inactive=true
        all_response = requests.get(f"{BASE_URL}/api/layout/sections?include_inactive=true", timeout=10)
        assert all_response.status_code == 200
        all_data = all_response.json()
        all_sections = all_data.get("sections", [])
        
        # Should have at least as many sections
        assert len(all_sections) >= len(active_sections), "include_inactive should return same or more sections"
        print(f"Active sections: {len(active_sections)}, All sections: {len(all_sections)}")
    
    def test_layout_sections_structure(self):
        """Verify layout sections have expected structure"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?include_inactive=true", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        assert "sections" in data, f"Missing 'sections' in response"
        sections = data["sections"]
        
        # If there are sections, check structure
        if sections:
            first_section = sections[0]
            # Check common fields
            assert "section_id" in first_section or "name" in first_section, f"Missing identifier in section: {first_section.keys()}"
            print(f"Found {len(sections)} sections")
        else:
            print("No sections found")


class TestIntegrationComplete:
    """Verify all endpoints work together"""
    
    def test_all_admin_endpoints_accessible(self):
        """Quick check that all admin endpoints are accessible"""
        endpoints = [
            "/api/admin/cdn/stats",
            "/api/rbac/roles",
            "/api/rbac/stats",
            "/api/rbac/permissions",
            "/api/rbac/users",
            "/api/approvals",
            "/api/admin/choir-registrations",
            "/api/admin/bible/tts-settings",
            "/api/layout/sections?include_inactive=true"
        ]
        
        results = {}
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            results[endpoint] = response.status_code
            print(f"{endpoint}: {response.status_code}")
        
        # All should be 200
        failed = [ep for ep, status in results.items() if status != 200]
        assert not failed, f"Failed endpoints: {failed}"
        print("All admin endpoints accessible!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
