"""
Unit tests for apartments app models.
"""
from django.test import TestCase
from django.db import IntegrityError
from apartments.models import Apartment
from campaigns.models import Campaign
from addresses.models import Address
from users.models import Manager
from django.contrib.gis.geos import Point


class ApartmentModelTests(TestCase):
    """Tests for Apartment model."""
    
    def setUp(self):
        """Set up test data."""
        # Create a manager for addresses
        self.manager = Manager.objects.create(
            name="Test Manager",
            email="manager@test.com",
            phone="12345678"
        )
        
        # Create a campaign
        self.campaign = Campaign.objects.create(
            name="Test Campaign",
            description="Test Description"
        )
    
    def test_create_apartment(self):
        """Test creating a basic apartment record."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        self.assertIsNotNone(apartment.id)
        self.assertEqual(apartment.base_address, "Hausmanns gate 19A, 0182 Oslo")
        self.assertEqual(apartment.apartment_number, "1")
        self.assertIsNone(apartment.status)
        self.assertIsNone(apartment.address)
        self.assertIsNone(apartment.campaign)
    
    def test_create_apartment_with_campaign(self):
        """Test creating apartment with campaign."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            campaign=self.campaign
        )
        
        self.assertEqual(apartment.campaign, self.campaign)
    
    def test_create_apartment_with_status(self):
        """Test creating apartment with status."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            status="ja"
        )
        
        self.assertEqual(apartment.status, "ja")
        self.assertTrue(apartment.is_visited)
    
    def test_unique_constraint(self):
        """Test that unique constraint prevents duplicate apartments."""
        # Create first apartment
        Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        # Try to create duplicate
        with self.assertRaises(IntegrityError):
            Apartment.objects.create(
                base_address="Hausmanns gate 19A, 0182 Oslo",
                apartment_number="1"
            )
    
    def test_different_apartments_same_building(self):
        """Test creating different apartments in same building."""
        apt1 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        apt2 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="2"
        )
        
        self.assertNotEqual(apt1.id, apt2.id)
        self.assertEqual(apt1.base_address, apt2.base_address)
        self.assertNotEqual(apt1.apartment_number, apt2.apartment_number)
    
    def test_same_apartment_different_buildings(self):
        """Test creating same apartment number in different buildings."""
        apt1 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        apt2 = Apartment.objects.create(
            base_address="Storgata 5, Oslo",
            apartment_number="1"
        )
        
        self.assertNotEqual(apt1.id, apt2.id)
        self.assertNotEqual(apt1.base_address, apt2.base_address)
        self.assertEqual(apt1.apartment_number, apt2.apartment_number)
    
    def test_normalize_apartment_number_on_save(self):
        """Test that apartment number is normalized on save."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="01"  # Leading zero
        )
        
        apartment.refresh_from_db()
        self.assertEqual(apartment.apartment_number, "1")  # Normalized
    
    def test_normalize_uppercase(self):
        """Test that apartment number is uppercased."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="2a"  # Lowercase
        )
        
        apartment.refresh_from_db()
        self.assertEqual(apartment.apartment_number, "2A")  # Uppercase
    
    def test_normalize_remove_spaces(self):
        """Test that spaces are removed from apartment number."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number=" 1 A "  # Spaces
        )
        
        apartment.refresh_from_db()
        self.assertEqual(apartment.apartment_number, "1A")  # No spaces
    
    def test_normalize_remove_hyphens(self):
        """Test that hyphens are removed from apartment number."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="H-0102"  # Hyphen
        )
        
        apartment.refresh_from_db()
        self.assertEqual(apartment.apartment_number, "H0102")  # No hyphen (zeros kept for alphanumeric)
    
    def test_str_representation_unvisited(self):
        """Test string representation for unvisited apartment."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        str_repr = str(apartment)
        self.assertIn("○", str_repr)  # Unvisited marker
        self.assertIn("Hausmanns gate 19A, 0182 Oslo", str_repr)
        self.assertIn("1", str_repr)
    
    def test_str_representation_visited(self):
        """Test string representation for visited apartment."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            status="ja"
        )
        
        str_repr = str(apartment)
        self.assertIn("✓", str_repr)  # Visited marker
        self.assertIn("Hausmanns gate 19A, 0182 Oslo", str_repr)
        self.assertIn("1", str_repr)
    
    def test_is_visited_property_false(self):
        """Test is_visited property for unvisited apartment."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        self.assertFalse(apartment.is_visited)
    
    def test_is_visited_property_true(self):
        """Test is_visited property for visited apartment."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            status="ja"
        )
        
        self.assertTrue(apartment.is_visited)
    
    def test_visit_info_unvisited(self):
        """Test visit_info property for unvisited apartment."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        info = apartment.visit_info
        self.assertFalse(info['visited'])
        self.assertIsNone(info['status'])
        self.assertIsNone(info['address_id'])
        self.assertIsNone(info['visited_at'])
    
    def test_visit_info_visited(self):
        """Test visit_info property for visited apartment."""
        # Create an address first (signal will auto-create apartment)
        address = Address.objects.create(
            address_text="Hausmanns gate 19A, 0182 Oslo, 1",
            status="ja",
            position=Point(10.75, 59.91, srid=4326),
            manager=self.manager
        )
        
        # Get the apartment created by the signal
        apartment = Apartment.objects.get(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        info = apartment.visit_info
        self.assertTrue(info['visited'])
        self.assertEqual(info['status'], "ja")
        self.assertEqual(info['address_id'], str(address.id))
        self.assertIsNotNone(info['visited_at'])
    
    def test_ordering(self):
        """Test that apartments are ordered by base_address and apartment_number."""
        apt3 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="3"
        )
        apt1 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        apt2 = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="2"
        )
        
        apartments = list(Apartment.objects.all())
        self.assertEqual(apartments[0].apartment_number, "1")
        self.assertEqual(apartments[1].apartment_number, "2")
        self.assertEqual(apartments[2].apartment_number, "3")
    
    def test_filter_by_base_address(self):
        """Test filtering apartments by base address."""
        # Create apartments in two buildings
        Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="2"
        )
        Apartment.objects.create(
            base_address="Storgata 5, Oslo",
            apartment_number="1"
        )
        
        hausmanns_apartments = Apartment.objects.filter(
            base_address="Hausmanns gate 19A, 0182 Oslo"
        )
        self.assertEqual(hausmanns_apartments.count(), 2)
    
    def test_filter_by_campaign(self):
        """Test filtering apartments by campaign."""
        Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            campaign=self.campaign
        )
        Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="2"
        )
        
        campaign_apartments = Apartment.objects.filter(campaign=self.campaign)
        self.assertEqual(campaign_apartments.count(), 1)
    
    def test_filter_visited(self):
        """Test filtering visited apartments."""
        Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1",
            status="ja"
        )
        Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="2"
        )
        
        visited = Apartment.objects.filter(status__isnull=False)
        unvisited = Apartment.objects.filter(status__isnull=True)
        
        self.assertEqual(visited.count(), 1)
        self.assertEqual(unvisited.count(), 1)
    
    def test_timestamps(self):
        """Test that timestamps are automatically set."""
        apartment = Apartment.objects.create(
            base_address="Hausmanns gate 19A, 0182 Oslo",
            apartment_number="1"
        )
        
        self.assertIsNotNone(apartment.created_at)
        self.assertIsNotNone(apartment.updated_at)
        self.assertEqual(apartment.created_at.date(), apartment.updated_at.date())


class ApartmentNormalizeTests(TestCase):
    """Tests for Apartment.normalize_apartment_number static method."""
    
    def test_normalize_leading_zeros(self):
        """Test normalization of leading zeros."""
        self.assertEqual(Apartment.normalize_apartment_number("01"), "1")
        self.assertEqual(Apartment.normalize_apartment_number("001"), "1")
        self.assertEqual(Apartment.normalize_apartment_number("0001"), "1")
    
    def test_normalize_only_zeros(self):
        """Test normalization of only zeros."""
        self.assertEqual(Apartment.normalize_apartment_number("0"), "0")
        self.assertEqual(Apartment.normalize_apartment_number("00"), "0")
        self.assertEqual(Apartment.normalize_apartment_number("000"), "0")
    
    def test_normalize_lowercase(self):
        """Test normalization to uppercase."""
        self.assertEqual(Apartment.normalize_apartment_number("a"), "A")
        self.assertEqual(Apartment.normalize_apartment_number("2a"), "2A")
        self.assertEqual(Apartment.normalize_apartment_number("h0102"), "H0102")  # Zeros kept for alphanumeric
    
    def test_normalize_spaces(self):
        """Test removal of spaces."""
        self.assertEqual(Apartment.normalize_apartment_number(" 1 "), "1")
        self.assertEqual(Apartment.normalize_apartment_number("1 A"), "1A")
        self.assertEqual(Apartment.normalize_apartment_number("  H  0102  "), "H0102")  # Zeros kept for alphanumeric
    
    def test_normalize_hyphens(self):
        """Test removal of hyphens."""
        self.assertEqual(Apartment.normalize_apartment_number("H-0102"), "H0102")  # Zeros kept for alphanumeric
        self.assertEqual(Apartment.normalize_apartment_number("1-A"), "1A")
    
    def test_normalize_combined(self):
        """Test normalization with multiple rules."""
        self.assertEqual(Apartment.normalize_apartment_number(" h-0102 "), "H0102")  # Zeros kept for alphanumeric
        self.assertEqual(Apartment.normalize_apartment_number("  01-a  "), "1A")
    
    def test_normalize_empty(self):
        """Test normalization of empty string."""
        self.assertEqual(Apartment.normalize_apartment_number(""), "")
    
    def test_normalize_none(self):
        """Test normalization of None."""
        self.assertIsNone(Apartment.normalize_apartment_number(None))

