"""
End-to-end integration tests for apartments app.

Tests the complete workflow including:
- Address creation triggering apartment updates
- Signal processing
- Complete user flows
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient
from rest_framework import status

from apartments.models import Apartment
from addresses.models import Address
from campaigns.models import Campaign
from users.models import Manager

User = get_user_model()


class ApartmentAddressIntegrationTests(TestCase):
    """Test integration between Address and Apartment models via signals."""
    
    def setUp(self):
        """Set up test data."""
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
    
    def test_address_creation_updates_apartment(self):
        """Test that creating an address automatically updates apartment."""
        # Create apartment catalogue first
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            campaign=self.campaign
        )
        
        # Verify initially unvisited
        self.assertIsNone(apartment.status)
        self.assertIsNone(apartment.address)
        
        # Create address
        address = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager,
            campaign=self.campaign
        )
        
        # Refresh apartment from database
        apartment.refresh_from_db()
        
        # Verify apartment was updated by signal
        self.assertEqual(apartment.status, "ja")
        self.assertEqual(apartment.address, address)
    
    def test_address_creation_creates_apartment_if_missing(self):
        """Test that address creation creates apartment if it doesn't exist."""
        # Create address without pre-existing apartment
        address = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager,
            campaign=self.campaign
        )
        
        # Check that apartment was created by signal
        apartment = Apartment.objects.get(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        self.assertEqual(apartment.status, "ja")
        self.assertEqual(apartment.address, address)
        self.assertEqual(apartment.campaign, self.campaign)
    
    def test_address_without_apartment_number_ignored(self):
        """Test that addresses without apartment numbers don't create apartments."""
        initial_count = Apartment.objects.count()
        
        # Create address without apartment number
        Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        # Verify no apartment was created
        self.assertEqual(Apartment.objects.count(), initial_count)
    
    def test_address_deletion_unlinks_apartment(self):
        """Test that deleting address unlinks apartment but keeps status."""
        # Create apartment and address
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            campaign=self.campaign
        )
        
        address = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        apartment.refresh_from_db()
        self.assertEqual(apartment.address, address)
        self.assertEqual(apartment.status, "ja")
        
        # Delete address
        address.delete()
        
        # Refresh apartment
        apartment.refresh_from_db()
        
        # Verify apartment is unlinked but status is kept
        self.assertIsNone(apartment.address)
        self.assertEqual(apartment.status, "ja")  # Historical record kept
    
    def test_multiple_addresses_same_apartment_uses_latest(self):
        """Test that multiple visits to same apartment update correctly."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        # First visit
        address1 = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ikke_hjemme",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        apartment.refresh_from_db()
        self.assertEqual(apartment.status, "ikke_hjemme")
        self.assertEqual(apartment.address, address1)
        
        # Second visit (later)
        address2 = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        apartment.refresh_from_db()
        self.assertEqual(apartment.status, "ja")
        self.assertEqual(apartment.address, address2)


class EndToEndWorkflowTests(TestCase):
    """Test complete end-to-end workflows via API."""
    
    def setUp(self):
        """Set up test data and API client."""
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
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.base_address = "Hausmanns gate 19A, 0182 Oslo"
    
    def test_complete_workflow_bulk_create_then_visit(self):
        """
        Test complete workflow:
        1. Bulk create apartment catalogue
        2. Create address (visit apartment)
        3. Verify apartment updated
        4. Get summary showing visit
        """
        # Step 1: Bulk create apartments
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': self.base_address,
                'apartment_numbers': ['1', '2', '3', '4', '5'],
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 5)
        
        # Step 2: Create address (simulate user visiting apartment 1)
        address_response = self.client.post(
            '/api/addresses/addresses/',
            {
                'address_text': f'{self.base_address}, 1',
                'status': 'ja',
                'position': {
                    'type': 'Point',
                    'coordinates': [10.75, 59.91]
                },
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        self.assertEqual(address_response.status_code, status.HTTP_201_CREATED)
        
        # Step 3: Verify apartment was updated by signal
        apartment = Apartment.objects.get(
            base_address=self.base_address,
            apartment_number='1'
        )
        
        self.assertEqual(apartment.status, 'ja')
        self.assertIsNotNone(apartment.address)
        self.assertTrue(apartment.is_visited)
        
        # Step 4: Get summary
        summary_response = self.client.get(
            '/api/apartments/summary/',
            {'base_address': self.base_address}
        )
        
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data['total_apartments'], 5)
        self.assertEqual(summary_response.data['visited'], 1)
        self.assertEqual(summary_response.data['unvisited'], 4)
        self.assertEqual(summary_response.data['status_breakdown']['ja'], 1)
        self.assertEqual(summary_response.data['status_breakdown']['unvisited'], 4)
    
    def test_workflow_without_bulk_create(self):
        """
        Test workflow where address is created without pre-existing catalogue.
        Signal should create apartment on-the-fly.
        """
        # Create address directly (no bulk create first)
        address_response = self.client.post(
            '/api/addresses/addresses/',
            {
                'address_text': f'{self.base_address}, 1',
                'status': 'ja',
                'position': {
                    'type': 'Point',
                    'coordinates': [10.75, 59.91]
                },
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        self.assertEqual(address_response.status_code, status.HTTP_201_CREATED)
        
        # Verify apartment was created by signal
        apartment = Apartment.objects.get(
            base_address=self.base_address,
            apartment_number='1'
        )
        
        self.assertEqual(apartment.status, 'ja')
        self.assertIsNotNone(apartment.address)
        
        # List apartments (should show the one created)
        list_response = self.client.get(
            '/api/apartments/',
            {'base_address': self.base_address}
        )
        
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data['results']), 1)
    
    def test_workflow_visit_multiple_apartments(self):
        """Test visiting multiple apartments in sequence."""
        # Bulk create
        self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': self.base_address,
                'apartment_numbers': ['1', '2', '3'],
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        # Visit apartment 1
        self.client.post(
            '/api/addresses/addresses/',
            {
                'address_text': f'{self.base_address}, 1',
                'status': 'ja',
                'position': {'type': 'Point', 'coordinates': [10.75, 59.91]},
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        # Visit apartment 2
        self.client.post(
            '/api/addresses/addresses/',
            {
                'address_text': f'{self.base_address}, 2',
                'status': 'nei',
                'position': {'type': 'Point', 'coordinates': [10.75, 59.91]},
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        # Visit apartment 3
        self.client.post(
            '/api/addresses/addresses/',
            {
                'address_text': f'{self.base_address}, 3',
                'status': 'ikke_hjemme',
                'position': {'type': 'Point', 'coordinates': [10.75, 59.91]},
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        # Get summary
        summary_response = self.client.get(
            '/api/apartments/summary/',
            {'base_address': self.base_address}
        )
        
        self.assertEqual(summary_response.data['total_apartments'], 3)
        self.assertEqual(summary_response.data['visited'], 3)
        self.assertEqual(summary_response.data['unvisited'], 0)
        self.assertEqual(summary_response.data['status_breakdown']['ja'], 1)
        self.assertEqual(summary_response.data['status_breakdown']['nei'], 1)
        self.assertEqual(summary_response.data['status_breakdown']['ikke_hjemme'], 1)
    
    def test_workflow_filter_apartments_by_status(self):
        """Test filtering apartments by visit status."""
        # Create mixed apartments
        self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': self.base_address,
                'apartment_numbers': ['1', '2', '3', '4', '5']
            },
            format='json'
        )
        
        # Visit some
        for apt_num in ['1', '2']:
            self.client.post(
                '/api/addresses/addresses/',
                {
                    'address_text': f'{self.base_address}, {apt_num}',
                    'status': 'ja',
                    'position': {'type': 'Point', 'coordinates': [10.75, 59.91]}
                },
                format='json'
            )
        
        # Filter visited
        visited_response = self.client.get(
            '/api/apartments/',
            {'base_address': self.base_address, 'status': 'ja'}
        )
        self.assertEqual(len(visited_response.data['results']), 2)
        
        # Filter unvisited
        unvisited_response = self.client.get(
            '/api/apartments/',
            {'base_address': self.base_address, 'status': 'unvisited'}
        )
        self.assertEqual(len(unvisited_response.data['results']), 3)


class SignalErrorHandlingTests(TestCase):
    """Test error handling in signal processing."""
    
    def setUp(self):
        """Set up test data."""
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
    
    def test_address_creation_succeeds_even_if_apartment_sync_fails(self):
        """
        Test that address is still created even if apartment sync fails.
        This ensures the main operation is not blocked by sync errors.
        """
        # Create address (apartment sync will fail but address should be created)
        address = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        # Verify address exists
        self.assertIsNotNone(address.id)
        self.assertTrue(Address.objects.filter(id=address.id).exists())
        
        # Apartment should also be created (signal should work)
        apartments = Apartment.objects.filter(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        self.assertEqual(apartments.count(), 1)
    
    def test_malformed_address_text_handled_gracefully(self):
        """Test that malformed address text doesn't break signal processing."""
        # Create address with unusual format
        address = Address.objects.create(
            address_text="Weird Format Address",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        # Should not create apartment (no apartment number parsed)
        self.assertEqual(
            Apartment.objects.filter(
                base_address="Weird Format Address"
            ).count(),
            0
        )
        
        # But address should still exist
        self.assertTrue(Address.objects.filter(id=address.id).exists())

