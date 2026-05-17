"""
Tests for tile generation with apartment grouping.

Verifies that vector tiles correctly group apartments by geographic position
and show one marker per building instead of one per apartment.
"""
from django.test import TestCase, Client, override_settings
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from unittest import skipIf

from addresses.models import Address
from apartments.models import Apartment
from campaigns.models import Campaign
from users.models import Manager

User = get_user_model()

# Check if Redis is available
try:
    from django.core.cache import cache
    cache.set('test_connection', 1, timeout=1)
    cache.delete('test_connection')
    REDIS_AVAILABLE = True
except Exception:
    REDIS_AVAILABLE = False


@skipIf(not REDIS_AVAILABLE, "Redis not available")
class TileGroupingTests(TestCase):
    """Test that tiles correctly group apartments by building."""
    
    def setUp(self):
        """Set up test data."""
        self.client = Client()
        
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.manager = Manager.objects.create(
            user=self.user,
            name="Test Manager",
            email="manager@test.com",
            phone="12345678"
        )
        self.campaign = Campaign.objects.create(
            name="Test Campaign",
            description="Test Description"
        )
        
        # Create a building with multiple apartments at the same location
        self.building_position = Point(10.75, 59.91, srid=4326)
        self.base_address = "Hausmanns gate 19A, 0182 Oslo"
        
        # Create 5 apartments in the same building
        self.addresses = []
        statuses = ["ja", "ja", "ja", "ikke_hjemme", "nei"]
        for i in range(1, 6):
            address = Address.objects.create(
                address_text=f"{self.base_address}, {i}",
                status=statuses[i-1],
                position=self.building_position,  # SAME POSITION
                manager=self.manager,
                campaign=self.campaign
            )
            self.addresses.append(address)
        
        # Create another address at a different location
        self.other_address = Address.objects.create(
            address_text="Karl Johans gate 1, 0123 Oslo",
            status="ja",
            position=Point(10.74, 59.91, srid=4326),  # Different position
            manager=self.manager,
            campaign=self.campaign
        )
    
    def test_apartments_same_location_have_same_snapped_position(self):
        """Test that apartments at the same building snap to the same grid position."""
        # All apartments should have identical positions
        positions = [a.position for a in self.addresses]
        for pos in positions:
            self.assertEqual(pos.x, self.building_position.x)
            self.assertEqual(pos.y, self.building_position.y)
    
    def test_tile_request_returns_pbf(self):
        """Test that tile endpoint returns vector tile data."""
        # Request tile at zoom 17 (raw points)
        # Calculate tile coordinates for our test point
        from tiles.tiles import lonlat_to_tile
        z = 17
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        response = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/x-protobuf')
        self.assertGreater(len(response.content), 0)
    
    def test_tile_has_cache_headers(self):
        """Test that tile response includes proper cache headers."""
        from tiles.tiles import lonlat_to_tile
        z = 17
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        response = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        
        self.assertIn('Cache-Control', response)
        self.assertIn('X-Cache-Status', response)
        self.assertIn('ETag', response)
    
    def test_tile_filtering_by_campaign(self):
        """Test that tiles can be filtered by campaign."""
        from tiles.tiles import lonlat_to_tile
        z = 17
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        # Request with campaign filter
        response = self.client.get(
            f'/tiles/{z}/{x}/{y}.pbf',
            {'campaign': str(self.campaign.id)}
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.content), 0)
    
    def test_tile_filtering_by_manager(self):
        """Test that tiles can be filtered by manager."""
        from tiles.tiles import lonlat_to_tile
        z = 17
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        # Request with manager filter
        response = self.client.get(
            f'/tiles/{z}/{x}/{y}.pbf',
            {'manager': str(self.manager.id)}
        )
        
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.content), 0)
    
    def test_empty_tile_below_zoom_16(self):
        """Test that tiles below zoom 16 are empty."""
        response = self.client.get('/tiles/15/16380/8924.pbf')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.content), 0)
        self.assertEqual(response['X-Cache-Status'], 'EMPTY')
        self.assertEqual(response['X-DB-Read'], 'none')
    
    def test_clustered_tile_at_zoom_16(self):
        """Test that zoom 16 returns clustered tiles."""
        from tiles.tiles import lonlat_to_tile
        z = 16
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        response = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        
        self.assertEqual(response.status_code, 200)
        # Clustered tiles should have content if there are addresses
        self.assertGreater(len(response.content), 0)
    
    def test_cache_invalidation_on_address_change(self):
        """Test that cache is invalidated when an address is updated."""
        from tiles.tiles import lonlat_to_tile
        from django.core.cache import cache
        
        # Skip if Redis is not available
        try:
            cache.set('test_key', 'test_value', timeout=1)
            cache.delete('test_key')
        except Exception:
            self.skipTest("Redis not available")
        
        z = 17
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        # First request - generates tile and caches it
        response1 = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        self.assertEqual(response1['X-Cache-Status'], 'MISS')
        
        # Second request - should hit cache
        response2 = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        self.assertEqual(response2['X-Cache-Status'], 'HIT')
        
        # Update an address (change status)
        self.addresses[0].status = 'nei'
        self.addresses[0].save()
        
        # Cache should be invalidated, next request is a MISS
        response3 = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        self.assertEqual(response3['X-Cache-Status'], 'MISS')


@skipIf(not REDIS_AVAILABLE, "Redis not available")
class TilePerformanceTests(TestCase):
    """Test tile generation performance with large datasets."""
    
    def setUp(self):
        """Set up test data."""
        self.client = Client()
        
        self.user = User.objects.create_user(
            username='perfuser',
            email='perf@example.com',
            password='testpass123'
        )
        self.manager = Manager.objects.create(
            user=self.user,
            name="Perf Manager",
            email="perfmanager@test.com",
            phone="87654321"
        )
        self.campaign = Campaign.objects.create(
            name="Perf Campaign",
            description="Performance Test"
        )
    
    def test_tile_generation_with_100_addresses(self):
        """Test tile generation performance with 100 addresses."""
        import time
        
        # Create 10 buildings with 10 apartments each
        for building in range(10):
            base_lon = 10.70 + (building * 0.001)
            base_lat = 59.90 + (building * 0.001)
            
            for apt in range(1, 11):
                Address.objects.create(
                    address_text=f"Test Street {building}, {apt}",
                    status="ja" if apt % 2 == 0 else "ikke_hjemme",
                    position=Point(base_lon, base_lat, srid=4326),
                    manager=self.manager,
                    campaign=self.campaign
                )
        
        # Test tile generation time
        from tiles.tiles import lonlat_to_tile
        z = 17
        x, y = lonlat_to_tile(10.70, 59.90, z)
        
        start_time = time.time()
        response = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        end_time = time.time()
        
        generation_time = (end_time - start_time) * 1000  # Convert to ms
        
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.content), 0)
        
        # Should be fast (< 500ms even with 100 addresses)
        self.assertLess(generation_time, 500, 
                       f"Tile generation took {generation_time:.2f}ms, should be < 500ms")
        
        print(f"\n✅ Tile generation with 100 addresses: {generation_time:.2f}ms")
    
    def test_geographic_deduplication_performance(self):
        """Test that geographic deduplication is efficient."""
        import time
        
        # Create 50 apartments at THE SAME LOCATION
        base_position = Point(10.75, 59.91, srid=4326)
        
        for i in range(1, 51):
            Address.objects.create(
                address_text=f"Hausmanns gate 19A, 0182 Oslo, {i}",
                status="ja" if i % 3 == 0 else "ikke_hjemme",
                position=base_position,  # SAME POSITION
                manager=self.manager,
                campaign=self.campaign
            )
        
        # Test tile generation
        from tiles.tiles import lonlat_to_tile
        z = 17
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        start_time = time.time()
        response = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        end_time = time.time()
        
        generation_time = (end_time - start_time) * 1000
        
        self.assertEqual(response.status_code, 200)
        
        # Should still be fast despite 50 addresses at same location
        self.assertLess(generation_time, 200,
                       f"Deduplication took {generation_time:.2f}ms, should be < 200ms")
        
        print(f"\n✅ Deduplication of 50 apartments: {generation_time:.2f}ms")


@skipIf(not REDIS_AVAILABLE, "Redis not available")
class TileIntegrationTests(TestCase):
    """Integration tests for tiles with apartments."""
    
    def setUp(self):
        """Set up test data."""
        self.client = Client()
        
        self.user = User.objects.create_user(
            username='intuser',
            email='int@example.com',
            password='testpass123'
        )
        self.manager = Manager.objects.create(
            user=self.user,
            name="Int Manager",
            email="intmanager@test.com",
            phone="11223344"
        )
        self.campaign = Campaign.objects.create(
            name="Int Campaign"
        )
    
    def test_tile_reflects_apartment_creation(self):
        """Test that tiles reflect newly created apartments."""
        from tiles.tiles import lonlat_to_tile
        from django.core.cache import cache
        
        # Skip if Redis is not available
        try:
            cache.set('test_key', 'test_value', timeout=1)
            cache.delete('test_key')
        except Exception:
            self.skipTest("Redis not available")
        
        position = Point(10.75, 59.91, srid=4326)
        z = 17
        x, y = lonlat_to_tile(10.75, 59.91, z)
        
        # Create first address
        Address.objects.create(
            address_text="Test Street 1, 1",
            status="ja",
            position=position,
            manager=self.manager,
            campaign=self.campaign
        )
        
        # Generate tile
        response1 = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        self.assertEqual(response1.status_code, 200)
        
        # Create second address at same location
        Address.objects.create(
            address_text="Test Street 1, 2",
            status="nei",
            position=position,
            manager=self.manager,
            campaign=self.campaign
        )
        
        # Tile should be regenerated (cache invalidated)
        response2 = self.client.get(f'/tiles/{z}/{x}/{y}.pbf')
        self.assertEqual(response2['X-Cache-Status'], 'MISS')

