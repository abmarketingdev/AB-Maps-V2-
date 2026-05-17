"""
API integration tests for apartments app.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apartments.models import Apartment
from campaigns.models import Campaign
from addresses.models import Address
from users.models import Manager, Employee
from django.contrib.gis.geos import Point

User = get_user_model()


class ApartmentAPITests(TestCase):
    """Tests for Apartment API endpoints."""
    
    def setUp(self):
        """Set up test data."""
        # Create user and manager
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
        
        # Create campaign
        self.campaign = Campaign.objects.create(
            name="Test Campaign",
            description="Test Description"
        )
        
        # Create test apartments
        self.apartment1 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            campaign=self.campaign
        )
        self.apartment2 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="2",
            status="ja",
            campaign=self.campaign
        )
        
        # Set up API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_list_apartments(self):
        """Test listing apartments."""
        response = self.client.get('/api/apartments/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_list_apartments_filter_by_base_address(self):
        """Test filtering apartments by base address."""
        # Create apartment in different building
        Apartment.objects.create(
            base_address="Storgata 5, Oslo",
            apartment_number="1"
        )
        
        response = self.client.get(
            '/api/apartments/',
            {'base_address': 'Hausmanns gate 19A, 0182 Oslo'}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
        for apt in response.data['results']:
            self.assertEqual(apt['base_address'], 'Hausmanns gate 19A, 0182 Oslo')
    
    def test_list_apartments_filter_by_campaign(self):
        """Test filtering apartments by campaign."""
        # Create apartment without campaign
        Apartment.objects.create(
            base_address="Storgata 5, Oslo",
            apartment_number="1"
        )
        
        response = self.client.get(
            '/api/apartments/',
            {'campaign': str(self.campaign.id)}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_list_apartments_filter_by_status(self):
        """Test filtering apartments by status."""
        response = self.client.get(
            '/api/apartments/',
            {'status': 'ja'}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['status'], 'ja')
    
    def test_list_apartments_filter_unvisited(self):
        """Test filtering unvisited apartments."""
        response = self.client.get(
            '/api/apartments/',
            {'status': 'unvisited'}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNone(response.data['results'][0]['status'])
    
    def test_retrieve_apartment(self):
        """Test retrieving a single apartment."""
        response = self.client.get(f'/api/apartments/{self.apartment1.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], str(self.apartment1.id))
        self.assertEqual(response.data['apartment_number'], "1")
        self.assertIn('visit_info', response.data)
    
    def test_update_apartment_status(self):
        """Test updating apartment status."""
        response = self.client.patch(
            f'/api/apartments/{self.apartment1.id}/',
            {'status': 'ja'}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ja')
        
        # Verify in database
        self.apartment1.refresh_from_db()
        self.assertEqual(self.apartment1.status, 'ja')
    
    def test_update_apartment_with_address(self):
        """Test updating apartment with address link."""
        # Create an address
        address = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        response = self.client.patch(
            f'/api/apartments/{self.apartment1.id}/',
            {
                'status': 'ja',
                'address_id': str(address.id)
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ja')
        
        # Verify in database
        self.apartment1.refresh_from_db()
        self.assertEqual(self.apartment1.address, address)
    
    def test_update_apartment_invalid_address(self):
        """Test updating apartment with invalid address ID."""
        response = self.client.patch(
            f'/api/apartments/{self.apartment1.id}/',
            {
                'status': 'ja',
                'address_id': '00000000-0000-0000-0000-000000000000'
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_delete_apartment(self):
        """Test deleting an apartment."""
        apt_id = self.apartment1.id
        
        response = self.client.delete(f'/api/apartments/{apt_id}/')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Apartment.objects.filter(id=apt_id).exists())
    
    def test_create_single_apartment_not_allowed(self):
        """Test that single apartment creation is not allowed."""
        response = self.client.post(
            '/api/apartments/',
            {
                'base_address': 'Storgata 5, Oslo',
                'apartment_number': '1'
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertIn('bulk-create', response.data['hint'])


class ApartmentBulkCreateAPITests(TestCase):
    """Tests for bulk create endpoint."""
    
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
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_bulk_create_apartments(self):
        """Test bulk creating apartments."""
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': ['1', '2', '3', '4', '5']
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 5)
        self.assertEqual(response.data['skipped'], 0)
        self.assertEqual(response.data['total'], 5)
        
        # Verify in database
        apartments = Apartment.objects.filter(
            base_address='Hausmanns gate 19A, 0182 Oslo'
        )
        self.assertEqual(apartments.count(), 5)
    
    def test_bulk_create_with_campaign(self):
        """Test bulk creating apartments with campaign."""
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': ['1', '2', '3'],
                'campaign_id': str(self.campaign.id)
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 3)
        
        # Verify campaign is set
        apartments = Apartment.objects.filter(
            base_address='Hausmanns gate 19A, 0182 Oslo'
        )
        for apt in apartments:
            self.assertEqual(apt.campaign, self.campaign)
    
    def test_bulk_create_idempotent(self):
        """Test that bulk create is idempotent."""
        # First call
        response1 = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': ['1', '2', '3']
            },
            format='json'
        )
        
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response1.data['created'], 3)
        self.assertEqual(response1.data['skipped'], 0)
        
        # Second call with same data
        response2 = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': ['1', '2', '3']
            },
            format='json'
        )
        
        self.assertEqual(response2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response2.data['created'], 0)
        self.assertEqual(response2.data['skipped'], 3)
        
        # Verify only 3 exist (not 6)
        apartments = Apartment.objects.filter(
            base_address='Hausmanns gate 19A, 0182 Oslo'
        )
        self.assertEqual(apartments.count(), 3)
    
    def test_bulk_create_partial_overlap(self):
        """Test bulk create with partial overlap."""
        # Create some apartments first
        Apartment.objects.create(
            base_address='Hausmanns gate 19A, 0182 Oslo',
            apartment_number='1'
        )
        Apartment.objects.create(
            base_address='Hausmanns gate 19A, 0182 Oslo',
            apartment_number='2'
        )
        
        # Bulk create with overlap
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': ['2', '3', '4', '5']
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 3)  # 3, 4, 5
        self.assertEqual(response.data['skipped'], 1)  # 2
        
        # Verify total
        apartments = Apartment.objects.filter(
            base_address='Hausmanns gate 19A, 0182 Oslo'
        )
        self.assertEqual(apartments.count(), 5)
    
    def test_bulk_create_large_number(self):
        """Test bulk creating 100 apartments."""
        apartment_numbers = [str(i) for i in range(1, 101)]
        
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': apartment_numbers
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 100)
        self.assertEqual(response.data['total'], 100)
    
    def test_bulk_create_missing_base_address(self):
        """Test bulk create without base address."""
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'apartment_numbers': ['1', '2', '3']
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('base_address', response.data)
    
    def test_bulk_create_empty_apartment_numbers(self):
        """Test bulk create with empty apartment numbers."""
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': []
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_bulk_create_invalid_campaign(self):
        """Test bulk create with invalid campaign ID."""
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': ['1', '2', '3'],
                'campaign_id': '00000000-0000-0000-0000-000000000000'
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_bulk_create_deduplicates_input(self):
        """Test that duplicate apartment numbers in input are deduplicated."""
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Hausmanns gate 19A, 0182 Oslo',
                'apartment_numbers': ['1', '2', '2', '3', '3', '3']
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created'], 3)
        self.assertEqual(response.data['total'], 3)  # Deduplicated


class ApartmentSummaryAPITests(TestCase):
    """Tests for summary endpoint."""
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.campaign = Campaign.objects.create(
            name="Test Campaign",
            description="Test Description"
        )
        
        # Create apartments with various statuses
        self.base_address = "Hausmanns gate 19A, 0182 Oslo"
        Apartment.objects.create(
            base_address=self.base_address,
            apartment_number="1",
            status="ja",
            campaign=self.campaign
        )
        Apartment.objects.create(
            base_address=self.base_address,
            apartment_number="2",
            status="ja",
            campaign=self.campaign
        )
        Apartment.objects.create(
            base_address=self.base_address,
            apartment_number="3",
            status="nei",
            campaign=self.campaign
        )
        Apartment.objects.create(
            base_address=self.base_address,
            apartment_number="4",
            status="ikke_hjemme",
            campaign=self.campaign
        )
        Apartment.objects.create(
            base_address=self.base_address,
            apartment_number="5",
            campaign=self.campaign
        )
        Apartment.objects.create(
            base_address=self.base_address,
            apartment_number="6",
            campaign=self.campaign
        )
        
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_get_summary(self):
        """Test getting apartment summary."""
        response = self.client.get(
            '/api/apartments/summary/',
            {'base_address': self.base_address}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['base_address'], self.base_address)
        self.assertEqual(response.data['total_apartments'], 6)
        self.assertEqual(response.data['visited'], 4)
        self.assertEqual(response.data['unvisited'], 2)
        
        # Check status breakdown
        breakdown = response.data['status_breakdown']
        self.assertEqual(breakdown['ja'], 2)
        self.assertEqual(breakdown['nei'], 1)
        self.assertEqual(breakdown['ikke_hjemme'], 1)
        self.assertEqual(breakdown['unvisited'], 2)
    
    def test_get_summary_filter_by_campaign(self):
        """Test getting summary filtered by campaign."""
        # Create apartment in different campaign
        other_campaign = Campaign.objects.create(
            name="Other Campaign",
            description="Other"
        )
        Apartment.objects.create(
            base_address=self.base_address,
            apartment_number="100",
            campaign=other_campaign
        )
        
        response = self.client.get(
            '/api/apartments/summary/',
            {
                'base_address': self.base_address,
                'campaign': str(self.campaign.id)
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_apartments'], 6)  # Not 7
    
    def test_get_summary_missing_base_address(self):
        """Test getting summary without base address."""
        response = self.client.get('/api/apartments/summary/')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('base_address', response.data['error'])
    
    def test_get_summary_nonexistent_building(self):
        """Test getting summary for building with no apartments."""
        response = self.client.get(
            '/api/apartments/summary/',
            {'base_address': 'Nonexistent Street 123, Oslo'}
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_apartments'], 0)
        self.assertEqual(response.data['visited'], 0)
        self.assertEqual(response.data['unvisited'], 0)


class ApartmentPermissionTests(TestCase):
    """Tests for API permissions."""
    
    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        self.client = APIClient()
    
    def test_list_requires_authentication(self):
        """Test that listing requires authentication."""
        response = self.client.get('/api/apartments/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_retrieve_requires_authentication(self):
        """Test that retrieve requires authentication."""
        response = self.client.get(f'/api/apartments/{self.apartment.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_bulk_create_requires_authentication(self):
        """Test that bulk create requires authentication."""
        response = self.client.post(
            '/api/apartments/bulk-create/',
            {
                'base_address': 'Test Address',
                'apartment_numbers': ['1', '2', '3']
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_authenticated_user_can_access(self):
        """Test that authenticated users can access endpoints."""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get('/api/apartments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

