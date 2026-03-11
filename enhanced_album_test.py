import requests
import sys
import json
from datetime import datetime

class EnhancedAlbumTester:
    def __init__(self, base_url="https://prod-db-migration.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}

    def log_result(self, test_name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
            self.failed_tests.append({"test": test_name, "error": details})
        
        self.test_results[test_name] = {
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                self.log_result(name, True)
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_result(name, False, error_msg)
                return False, {}

        except Exception as e:
            self.log_result(name, False, f"Request failed: {str(e)}")
            return False, {}

    def test_enhanced_album_creation(self):
        """Test album creation with new enhanced fields"""
        # First create a category and singer for the album
        category_data = {
            "name": "Christmas",
            "description": "Christmas music category",
            "type": "music",
            "icon": "🎄",
            "status": "active"
        }
        
        success, cat_response = self.run_test(
            "Create Category for Album Test",
            "POST",
            "categories",
            200,
            data=category_data
        )
        
        if not success:
            return False
        
        category_id = cat_response.get('category_id')
        
        singer_data = {
            "name": "Test Choir",
            "type": "choir",
            "bio": "Test choir for album testing",
            "status": "active"
        }
        
        success, singer_response = self.run_test(
            "Create Singer for Album Test",
            "POST",
            "singers",
            200,
            data=singer_data
        )
        
        if not success:
            return False
        
        singer_id = singer_response.get('singer_id')
        
        # Test enhanced album creation with all new fields
        album_data = {
            "title": "Enhanced Test Album",
            "description": "Test album with enhanced fields",
            "artist_id": singer_id,
            "artist_name": "Test Choir",
            "category_id": category_id,
            "category_name": "Christmas",
            "thumbnail": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            "release_date": "2024-12-25",
            "monetization_type": "premium",
            "status": "active"
        }
        
        success, album_response = self.run_test(
            "Create Enhanced Album",
            "POST",
            "albums",
            200,
            data=album_data
        )
        
        if not success:
            return False
        
        album_id = album_response.get('album_id')
        
        # Verify the album was created with all fields
        success, get_response = self.run_test(
            "Get Enhanced Album",
            "GET",
            f"albums/{album_id}",
            200
        )
        
        if success:
            album = get_response.get('album', {})
            # Check if new fields are present
            required_fields = ['monetization_type', 'category_name', 'status', 'artist_name']
            missing_fields = []
            for field in required_fields:
                if field not in album:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result("Enhanced Album Fields Check", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("Enhanced Album Fields Check", True, "All enhanced fields present")
        
        return album_id

    def test_bulk_album_operations(self, album_ids):
        """Test bulk operations for albums"""
        if not album_ids:
            return False
        
        # Test bulk status update
        bulk_status_data = {
            "album_ids": album_ids,
            "status": "inactive"
        }
        
        success, _ = self.run_test(
            "Bulk Album Status Update",
            "POST",
            "albums/bulk-status",
            200,
            data=bulk_status_data
        )
        
        if not success:
            return False
        
        # Verify status was updated
        for album_id in album_ids:
            success, response = self.run_test(
                f"Verify Album {album_id} Status",
                "GET",
                f"albums/{album_id}",
                200
            )
            if success:
                album = response.get('album', {})
                if album.get('status') != 'inactive':
                    self.log_result(f"Album {album_id} Status Verification", False, f"Status not updated to inactive")
                else:
                    self.log_result(f"Album {album_id} Status Verification", True)
        
        # Test bulk delete (commented out to preserve test data)
        # bulk_delete_data = {
        #     "album_ids": album_ids
        # }
        # 
        # success, _ = self.run_test(
        #     "Bulk Album Delete",
        #     "POST",
        #     "albums/bulk-delete",
        #     200,
        #     data=bulk_delete_data
        # )
        
        return True

    def test_enhanced_song_operations(self, album_id):
        """Test enhanced song operations"""
        if not album_id:
            return False
        
        # Create songs with enhanced fields
        song_data = {
            "title": "Enhanced Test Song",
            "album_id": album_id,
            "duration": 225,  # 3:45 in seconds
            "duration_formatted": "3:45",
            "audio_url": "data:audio/mp3;base64,test",
            "lyrics": "Test song lyrics",
            "track_number": 1,
            "status": "active"
        }
        
        success, song_response = self.run_test(
            "Create Enhanced Song",
            "POST",
            "songs",
            200,
            data=song_data
        )
        
        if not success:
            return False
        
        song_id = song_response.get('song_id')
        
        # Create multiple songs for bulk testing
        song_ids = [song_id]
        for i in range(2, 4):
            song_data_bulk = {
                "title": f"Bulk Test Song {i}",
                "album_id": album_id,
                "duration": 180 + i * 10,
                "duration_formatted": f"3:{str(i*10).zfill(2)}",
                "track_number": i,
                "status": "active"
            }
            
            success, bulk_song_response = self.run_test(
                f"Create Bulk Song {i}",
                "POST",
                "songs",
                200,
                data=song_data_bulk
            )
            
            if success:
                song_ids.append(bulk_song_response.get('song_id'))
        
        # Test bulk song status update
        bulk_song_status_data = {
            "song_ids": song_ids,
            "status": "inactive"
        }
        
        success, _ = self.run_test(
            "Bulk Song Status Update",
            "POST",
            "songs/bulk-status",
            200,
            data=bulk_song_status_data
        )
        
        # Test bulk song delete (commented out to preserve test data)
        # bulk_song_delete_data = {
        #     "song_ids": song_ids
        # }
        # 
        # success, _ = self.run_test(
        #     "Bulk Song Delete",
        #     "POST",
        #     "songs/bulk-delete",
        #     200,
        #     data=bulk_song_delete_data
        # )
        
        return True

    def test_bulk_song_creation(self, album_id):
        """Test bulk song creation endpoint"""
        if not album_id:
            return False
        
        bulk_songs_data = [
            {
                "title": "Bulk Song 1",
                "album_id": album_id,
                "duration": 200,
                "duration_formatted": "3:20",
                "track_number": 10,
                "status": "active"
            },
            {
                "title": "Bulk Song 2", 
                "album_id": album_id,
                "duration": 240,
                "duration_formatted": "4:00",
                "track_number": 11,
                "status": "active"
            }
        ]
        
        success, response = self.run_test(
            "Bulk Song Creation",
            "POST",
            "songs/bulk",
            200,
            data=bulk_songs_data
        )
        
        return success

    def run_all_enhanced_tests(self):
        """Run all enhanced album management tests"""
        print("🚀 Starting Enhanced Album Management Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test enhanced album creation
        album_id = self.test_enhanced_album_creation()
        
        if album_id:
            # Test bulk operations
            self.test_bulk_album_operations([album_id])
            
            # Test enhanced song operations
            self.test_enhanced_song_operations(album_id)
            
            # Test bulk song creation
            self.test_bulk_song_creation(album_id)
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 ENHANCED ALBUM TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"   • {failure['test']}: {failure['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = EnhancedAlbumTester()
    success = tester.run_all_enhanced_tests()
    
    # Save detailed results
    with open('/app/enhanced_album_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed': tester.tests_passed,
                'failed': len(tester.failed_tests),
                'success_rate': (tester.tests_passed/tester.tests_run*100) if tester.tests_run > 0 else 0
            },
            'failed_tests': tester.failed_tests,
            'detailed_results': tester.test_results,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())