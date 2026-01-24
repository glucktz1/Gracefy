import requests
import sys
import json
from datetime import datetime

class ChristianAppAPITester:
    def __init__(self, base_url="https://gracefy-dev.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

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

    def test_analytics_overview(self):
        """Test analytics overview endpoint"""
        return self.run_test(
            "Analytics Overview",
            "GET",
            "analytics/overview",
            200
        )

    def test_analytics_trends(self):
        """Test analytics trends endpoint"""
        return self.run_test(
            "Analytics Trends",
            "GET", 
            "analytics/trends",
            200
        )

    def test_categories_crud(self):
        """Test categories CRUD operations"""
        # Create category
        category_data = {
            "name": "Test Category",
            "description": "Test category description",
            "type": "music",
            "icon": "🎵",
            "status": "active"
        }
        
        success, response = self.run_test(
            "Create Category",
            "POST",
            "categories",
            200,
            data=category_data
        )
        
        if not success:
            return False
        
        # Get categories
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )
        
        if not success:
            return False
        
        # Find our created category
        categories = response.get('categories', [])
        test_category = None
        for cat in categories:
            if cat.get('name') == 'Test Category':
                test_category = cat
                break
        
        if test_category:
            category_id = test_category['category_id']
            
            # Update category
            update_data = {"name": "Updated Test Category"}
            success, _ = self.run_test(
                "Update Category",
                "PUT",
                f"categories/{category_id}",
                200,
                data=update_data
            )
            
            # Delete category
            success, _ = self.run_test(
                "Delete Category",
                "DELETE",
                f"categories/{category_id}",
                200
            )
        
        return True

    def test_albums_crud(self):
        """Test albums CRUD operations"""
        album_data = {
            "title": "Test Album",
            "description": "Test album description",
            "artist_name": "Test Artist",
            "status": "active"
        }
        
        success, response = self.run_test(
            "Create Album",
            "POST",
            "albums",
            200,
            data=album_data
        )
        
        if not success:
            return False
        
        # Get albums
        success, response = self.run_test(
            "Get Albums",
            "GET",
            "albums",
            200
        )
        
        if success and response.get('albums'):
            albums = response['albums']
            test_album = None
            for album in albums:
                if album.get('title') == 'Test Album':
                    test_album = album
                    break
            
            if test_album:
                album_id = test_album['album_id']
                
                # Get single album
                success, _ = self.run_test(
                    "Get Single Album",
                    "GET",
                    f"albums/{album_id}",
                    200
                )
                
                # Update album
                update_data = {"title": "Updated Test Album"}
                success, _ = self.run_test(
                    "Update Album",
                    "PUT",
                    f"albums/{album_id}",
                    200,
                    data=update_data
                )
                
                # Delete album
                success, _ = self.run_test(
                    "Delete Album",
                    "DELETE",
                    f"albums/{album_id}",
                    200
                )
        
        return True

    def test_songs_crud(self):
        """Test songs CRUD operations"""
        # First create an album for the song
        album_data = {
            "title": "Song Test Album",
            "artist_name": "Test Artist"
        }
        
        success, album_response = self.run_test(
            "Create Album for Song Test",
            "POST",
            "albums",
            200,
            data=album_data
        )
        
        if not success:
            return False
        
        album_id = album_response.get('album_id')
        if not album_id:
            self.log_result("Songs CRUD", False, "No album_id returned from album creation")
            return False
        
        # Create song
        song_data = {
            "title": "Test Song",
            "album_id": album_id,
            "duration": 240,
            "track_number": 1
        }
        
        success, response = self.run_test(
            "Create Song",
            "POST",
            "songs",
            200,
            data=song_data
        )
        
        if not success:
            return False
        
        # Get songs
        success, response = self.run_test(
            "Get Songs",
            "GET",
            "songs",
            200
        )
        
        if success and response.get('songs'):
            songs = response['songs']
            test_song = None
            for song in songs:
                if song.get('title') == 'Test Song':
                    test_song = song
                    break
            
            if test_song:
                song_id = test_song['song_id']
                
                # Update song
                update_data = {"title": "Updated Test Song"}
                success, _ = self.run_test(
                    "Update Song",
                    "PUT",
                    f"songs/{song_id}",
                    200,
                    data=update_data
                )
                
                # Delete song
                success, _ = self.run_test(
                    "Delete Song",
                    "DELETE",
                    f"songs/{song_id}",
                    200
                )
        
        # Clean up album
        self.run_test(
            "Delete Test Album",
            "DELETE",
            f"albums/{album_id}",
            200
        )
        
        return True

    def test_churches_crud(self):
        """Test churches CRUD operations"""
        church_data = {
            "name": "Test Church",
            "location": "Test Location",
            "priest_name": "Test Priest",
            "status": "pending"
        }
        
        success, response = self.run_test(
            "Create Church",
            "POST",
            "churches",
            200,
            data=church_data
        )
        
        if not success:
            return False
        
        # Get churches
        success, response = self.run_test(
            "Get Churches",
            "GET",
            "churches",
            200
        )
        
        if success and response.get('churches'):
            churches = response['churches']
            test_church = None
            for church in churches:
                if church.get('name') == 'Test Church':
                    test_church = church
                    break
            
            if test_church:
                church_id = test_church['church_id']
                
                # Get single church
                success, _ = self.run_test(
                    "Get Single Church",
                    "GET",
                    f"churches/{church_id}",
                    200
                )
                
                # Update church
                update_data = {"name": "Updated Test Church"}
                success, _ = self.run_test(
                    "Update Church",
                    "PUT",
                    f"churches/{church_id}",
                    200,
                    data=update_data
                )
                
                # Delete church
                success, _ = self.run_test(
                    "Delete Church",
                    "DELETE",
                    f"churches/{church_id}",
                    200
                )
        
        return True

    def test_leaders_crud(self):
        """Test religious leaders CRUD operations"""
        leader_data = {
            "name": "Test Leader",
            "title": "pastor",
            "bio": "Test leader bio",
            "status": "pending"
        }
        
        success, response = self.run_test(
            "Create Religious Leader",
            "POST",
            "leaders",
            200,
            data=leader_data
        )
        
        if not success:
            return False
        
        # Get leaders
        success, response = self.run_test(
            "Get Religious Leaders",
            "GET",
            "leaders",
            200
        )
        
        if success and response.get('leaders'):
            leaders = response['leaders']
            test_leader = None
            for leader in leaders:
                if leader.get('name') == 'Test Leader':
                    test_leader = leader
                    break
            
            if test_leader:
                leader_id = test_leader['leader_id']
                
                # Update leader
                update_data = {"name": "Updated Test Leader"}
                success, _ = self.run_test(
                    "Update Religious Leader",
                    "PUT",
                    f"leaders/{leader_id}",
                    200,
                    data=update_data
                )
                
                # Delete leader
                success, _ = self.run_test(
                    "Delete Religious Leader",
                    "DELETE",
                    f"leaders/{leader_id}",
                    200
                )
        
        return True

    def test_singers_crud(self):
        """Test singers CRUD operations"""
        singer_data = {
            "name": "Test Singer",
            "type": "solo",
            "bio": "Test singer bio",
            "status": "active"
        }
        
        success, response = self.run_test(
            "Create Singer",
            "POST",
            "singers",
            200,
            data=singer_data
        )
        
        if not success:
            return False
        
        # Get singers
        success, response = self.run_test(
            "Get Singers",
            "GET",
            "singers",
            200
        )
        
        if success and response.get('singers'):
            singers = response['singers']
            test_singer = None
            for singer in singers:
                if singer.get('name') == 'Test Singer':
                    test_singer = singer
                    break
            
            if test_singer:
                singer_id = test_singer['singer_id']
                
                # Update singer
                update_data = {"name": "Updated Test Singer"}
                success, _ = self.run_test(
                    "Update Singer",
                    "PUT",
                    f"singers/{singer_id}",
                    200,
                    data=update_data
                )
                
                # Delete singer
                success, _ = self.run_test(
                    "Delete Singer",
                    "DELETE",
                    f"singers/{singer_id}",
                    200
                )
        
        return True

    def test_seminars_crud(self):
        """Test seminars CRUD operations"""
        seminar_data = {
            "title": "Test Seminar",
            "topic": "Test Topic",
            "date": "2024-12-25",
            "time": "10:00",
            "status": "scheduled"
        }
        
        success, response = self.run_test(
            "Create Seminar",
            "POST",
            "seminars",
            200,
            data=seminar_data
        )
        
        if not success:
            return False
        
        # Get seminars
        success, response = self.run_test(
            "Get Seminars",
            "GET",
            "seminars",
            200
        )
        
        if success and response.get('seminars'):
            seminars = response['seminars']
            test_seminar = None
            for seminar in seminars:
                if seminar.get('title') == 'Test Seminar':
                    test_seminar = seminar
                    break
            
            if test_seminar:
                seminar_id = test_seminar['seminar_id']
                
                # Update seminar
                update_data = {"title": "Updated Test Seminar"}
                success, _ = self.run_test(
                    "Update Seminar",
                    "PUT",
                    f"seminars/{seminar_id}",
                    200,
                    data=update_data
                )
                
                # Delete seminar
                success, _ = self.run_test(
                    "Delete Seminar",
                    "DELETE",
                    f"seminars/{seminar_id}",
                    200
                )
        
        return True

    def test_audiorooms_crud(self):
        """Test audio rooms CRUD operations"""
        room_data = {
            "title": "Test Audio Room",
            "description": "Test room description",
            "status": "scheduled"
        }
        
        success, response = self.run_test(
            "Create Audio Room",
            "POST",
            "audiorooms",
            200,
            data=room_data
        )
        
        if not success:
            return False
        
        # Get audio rooms
        success, response = self.run_test(
            "Get Audio Rooms",
            "GET",
            "audiorooms",
            200
        )
        
        if success and response.get('rooms'):
            rooms = response['rooms']
            test_room = None
            for room in rooms:
                if room.get('title') == 'Test Audio Room':
                    test_room = room
                    break
            
            if test_room:
                room_id = test_room['room_id']
                
                # Update room
                update_data = {"title": "Updated Test Audio Room"}
                success, _ = self.run_test(
                    "Update Audio Room",
                    "PUT",
                    f"audiorooms/{room_id}",
                    200,
                    data=update_data
                )
                
                # Delete room
                success, _ = self.run_test(
                    "Delete Audio Room",
                    "DELETE",
                    f"audiorooms/{room_id}",
                    200
                )
        
        return True

    def test_donations_crud(self):
        """Test donation campaigns CRUD operations"""
        donation_data = {
            "title": "Test Campaign",
            "description": "Test campaign description",
            "goal_amount": 1000.0,
            "status": "active"
        }
        
        success, response = self.run_test(
            "Create Donation Campaign",
            "POST",
            "donations",
            200,
            data=donation_data
        )
        
        if not success:
            return False
        
        # Get donations
        success, response = self.run_test(
            "Get Donation Campaigns",
            "GET",
            "donations",
            200
        )
        
        if success and response.get('campaigns'):
            campaigns = response['campaigns']
            test_campaign = None
            for campaign in campaigns:
                if campaign.get('title') == 'Test Campaign':
                    test_campaign = campaign
                    break
            
            if test_campaign:
                campaign_id = test_campaign['campaign_id']
                
                # Update campaign
                update_data = {"title": "Updated Test Campaign"}
                success, _ = self.run_test(
                    "Update Donation Campaign",
                    "PUT",
                    f"donations/{campaign_id}",
                    200,
                    data=update_data
                )
                
                # Delete campaign
                success, _ = self.run_test(
                    "Delete Donation Campaign",
                    "DELETE",
                    f"donations/{campaign_id}",
                    200
                )
        
        return True

    def test_bookings_crud(self):
        """Test priest bookings operations"""
        success, response = self.run_test(
            "Get Priest Bookings",
            "GET",
            "bookings",
            200
        )
        return success

    def test_approvals(self):
        """Test approvals endpoint"""
        success, response = self.run_test(
            "Get Pending Approvals",
            "GET",
            "approvals",
            200
        )
        return success

    def test_file_upload(self):
        """Test file upload endpoint"""
        # Create a simple test file
        import tempfile
        import os
        
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write("Test file content")
                temp_file_path = f.name
            
            # Test file upload
            url = f"{self.api_url}/upload"
            
            with open(temp_file_path, 'rb') as f:
                files = {'file': ('test.txt', f, 'text/plain')}
                headers = {}
                if self.session_token:
                    headers['Authorization'] = f'Bearer {self.session_token}'
                
                response = requests.post(url, files=files, headers=headers, timeout=10)
            
            # Clean up
            os.unlink(temp_file_path)
            
            success = response.status_code == 200
            if success:
                self.log_result("File Upload", True)
                return True, response.json() if response.content else {}
            else:
                error_msg = f"Expected 200, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_result("File Upload", False, error_msg)
                return False, {}
                
        except Exception as e:
            self.log_result("File Upload", False, f"Upload failed: {str(e)}")
            return False, {}

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Christian App API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test analytics endpoints
        self.test_analytics_overview()
        self.test_analytics_trends()
        
        # Test CRUD operations for all entities
        self.test_categories_crud()
        self.test_albums_crud()
        self.test_songs_crud()
        self.test_churches_crud()
        self.test_leaders_crud()
        self.test_singers_crud()
        self.test_seminars_crud()
        self.test_audiorooms_crud()
        self.test_donations_crud()
        self.test_bookings_crud()
        self.test_approvals()
        self.test_file_upload()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
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
    tester = ChristianAppAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
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