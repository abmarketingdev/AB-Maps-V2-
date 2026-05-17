"""
Unit tests for apartments app utility functions.
"""
from django.test import TestCase
from apartments.utils import (
    parse_address_text,
    validate_address_format,
    format_apartment_address,
    is_apartment_address,
    get_apartment_count_from_numbers,
)


class ParseAddressTextTests(TestCase):
    """Tests for parse_address_text function."""
    
    def test_parse_with_numeric_apartment(self):
        """Test parsing address with numeric apartment number."""
        base, apt = parse_address_text("Hausmanns gate 19A, 0182 Oslo, 1")
        self.assertEqual(base, "Hausmanns gate 19A, 0182 Oslo")
        self.assertEqual(apt, "1")
    
    def test_parse_with_alphanumeric_apartment(self):
        """Test parsing address with alphanumeric apartment number."""
        base, apt = parse_address_text("Hausmanns gate 19A, 0182 Oslo, H0102")
        self.assertEqual(base, "Hausmanns gate 19A, 0182 Oslo")
        self.assertEqual(apt, "H0102")
    
    def test_parse_with_letter_apartment(self):
        """Test parsing address with letter apartment number."""
        base, apt = parse_address_text("Storgata 5, Oslo, 2A")
        self.assertEqual(base, "Storgata 5, Oslo")
        self.assertEqual(apt, "2A")
    
    def test_parse_without_apartment(self):
        """Test parsing address without apartment number."""
        base, apt = parse_address_text("Hausmanns gate 19A, 0182 Oslo")
        self.assertEqual(base, "Hausmanns gate 19A, 0182 Oslo")
        self.assertIsNone(apt)
    
    def test_parse_simple_address(self):
        """Test parsing simple address without commas."""
        base, apt = parse_address_text("Storgata 5 Oslo")
        self.assertEqual(base, "Storgata 5 Oslo")
        self.assertIsNone(apt)
    
    def test_parse_with_hyphenated_apartment(self):
        """Test parsing address with hyphenated apartment number."""
        base, apt = parse_address_text("Karl Johans gate 1, Oslo, H-0102")
        self.assertEqual(base, "Karl Johans gate 1, Oslo")
        self.assertEqual(apt, "H-0102")
    
    def test_parse_with_spaces_in_apartment(self):
        """Test parsing address with spaces in apartment number."""
        base, apt = parse_address_text("Storgata 5, Oslo, 1 A")
        self.assertEqual(base, "Storgata 5, Oslo")
        self.assertEqual(apt, "1 A")
    
    def test_parse_multiple_commas(self):
        """Test parsing address with multiple commas."""
        base, apt = parse_address_text("A, B, C, 1")
        self.assertEqual(base, "A, B, C")
        self.assertEqual(apt, "1")
    
    def test_parse_empty_string(self):
        """Test parsing empty string."""
        base, apt = parse_address_text("")
        self.assertEqual(base, "")
        self.assertIsNone(apt)
    
    def test_parse_with_extra_whitespace(self):
        """Test parsing address with extra whitespace."""
        base, apt = parse_address_text("  Hausmanns gate 19A, 0182 Oslo,  1  ")
        self.assertEqual(base, "Hausmanns gate 19A, 0182 Oslo")
        self.assertEqual(apt, "1")
    
    def test_parse_leading_zeros(self):
        """Test parsing apartment number with leading zeros."""
        base, apt = parse_address_text("Storgata 5, Oslo, 01")
        self.assertEqual(base, "Storgata 5, Oslo")
        self.assertEqual(apt, "01")
    
    def test_parse_lowercase_letter(self):
        """Test parsing with lowercase letter in apartment."""
        base, apt = parse_address_text("Storgata 5, Oslo, 2a")
        self.assertEqual(base, "Storgata 5, Oslo")
        self.assertEqual(apt, "2a")
    
    def test_parse_zero_apartment(self):
        """Test parsing apartment number zero."""
        base, apt = parse_address_text("Storgata 5, Oslo, 0")
        self.assertEqual(base, "Storgata 5, Oslo")
        self.assertEqual(apt, "0")
    
    def test_parse_complex_apartment_code(self):
        """Test parsing complex apartment code."""
        base, apt = parse_address_text("Hausmanns gate 19A, 0182 Oslo, H1234B")
        self.assertEqual(base, "Hausmanns gate 19A, 0182 Oslo")
        self.assertEqual(apt, "H1234B")
    
    def test_parse_very_long_last_segment(self):
        """Test that very long last segments are not treated as apartments."""
        # City names or other parts shouldn't be treated as apartments
        address = "Storgata 5, VeryLongCityNameHere"
        base, apt = parse_address_text(address)
        # Should return the whole thing as base since "VeryLongCityNameHere" 
        # is likely not an apartment number
        self.assertEqual(base, address)
        self.assertIsNone(apt)
    
    def test_parse_norwegian_special_chars(self):
        """Test parsing Norwegian addresses with special characters."""
        base, apt = parse_address_text("Storgata 5, Tromsø, 1")
        self.assertEqual(base, "Storgata 5, Tromsø")
        self.assertEqual(apt, "1")
    
    def test_parse_single_digit(self):
        """Test parsing single digit apartment."""
        base, apt = parse_address_text("Address, 5")
        self.assertEqual(base, "Address")
        self.assertEqual(apt, "5")
    
    def test_parse_double_digit(self):
        """Test parsing double digit apartment."""
        base, apt = parse_address_text("Address, 42")
        self.assertEqual(base, "Address")
        self.assertEqual(apt, "42")
    
    def test_parse_three_digit(self):
        """Test parsing three digit apartment."""
        base, apt = parse_address_text("Address, 123")
        self.assertEqual(base, "Address")
        self.assertEqual(apt, "123")
    
    def test_parse_real_oslo_address_1(self):
        """Test with real Oslo address format #1."""
        base, apt = parse_address_text("Hausmanns gate 19A, 0182 Oslo, 1")
        self.assertEqual(base, "Hausmanns gate 19A, 0182 Oslo")
        self.assertEqual(apt, "1")
    
    def test_parse_real_oslo_address_2(self):
        """Test with real Oslo address format #2."""
        base, apt = parse_address_text("Markveien 58, 0554 Oslo, 301")
        self.assertEqual(base, "Markveien 58, 0554 Oslo")
        self.assertEqual(apt, "301")


class ValidateAddressFormatTests(TestCase):
    """Tests for validate_address_format function."""
    
    def test_validate_with_apartment(self):
        """Test validation of address with apartment."""
        self.assertTrue(validate_address_format("Hausmanns gate 19A, 0182 Oslo, 1"))
    
    def test_validate_without_apartment(self):
        """Test validation of address without apartment."""
        self.assertTrue(validate_address_format("Hausmanns gate 19A, 0182 Oslo"))
    
    def test_validate_empty_string(self):
        """Test validation of empty string."""
        self.assertFalse(validate_address_format(""))
    
    def test_validate_whitespace_only(self):
        """Test validation of whitespace-only string."""
        self.assertFalse(validate_address_format("   "))
    
    def test_validate_require_apartment_with_apartment(self):
        """Test validation requiring apartment when present."""
        self.assertTrue(
            validate_address_format(
                "Hausmanns gate 19A, 0182 Oslo, 1",
                require_apartment=True
            )
        )
    
    def test_validate_require_apartment_without_apartment(self):
        """Test validation requiring apartment when absent."""
        self.assertFalse(
            validate_address_format(
                "Hausmanns gate 19A, 0182 Oslo",
                require_apartment=True
            )
        )


class FormatApartmentAddressTests(TestCase):
    """Tests for format_apartment_address function."""
    
    def test_format_simple(self):
        """Test formatting simple apartment address."""
        result = format_apartment_address("Hausmanns gate 19A, 0182 Oslo", "1")
        self.assertEqual(result, "Hausmanns gate 19A, 0182 Oslo, 1")
    
    def test_format_with_spaces(self):
        """Test formatting with extra spaces."""
        result = format_apartment_address("  Hausmanns gate 19A, 0182 Oslo  ", "  1  ")
        self.assertEqual(result, "Hausmanns gate 19A, 0182 Oslo, 1")
    
    def test_format_alphanumeric(self):
        """Test formatting with alphanumeric apartment."""
        result = format_apartment_address("Storgata 5, Oslo", "H0102")
        self.assertEqual(result, "Storgata 5, Oslo, H0102")
    
    def test_format_round_trip(self):
        """Test that format and parse are inverse operations."""
        original_base = "Hausmanns gate 19A, 0182 Oslo"
        original_apt = "1"
        
        formatted = format_apartment_address(original_base, original_apt)
        parsed_base, parsed_apt = parse_address_text(formatted)
        
        self.assertEqual(parsed_base, original_base)
        self.assertEqual(parsed_apt, original_apt)


class IsApartmentAddressTests(TestCase):
    """Tests for is_apartment_address function."""
    
    def test_is_apartment_true(self):
        """Test identifying address with apartment."""
        self.assertTrue(is_apartment_address("Hausmanns gate 19A, 0182 Oslo, 1"))
    
    def test_is_apartment_false(self):
        """Test identifying address without apartment."""
        self.assertFalse(is_apartment_address("Hausmanns gate 19A, 0182 Oslo"))
    
    def test_is_apartment_alphanumeric(self):
        """Test identifying address with alphanumeric apartment."""
        self.assertTrue(is_apartment_address("Storgata 5, Oslo, H0102"))


class GetApartmentCountTests(TestCase):
    """Tests for get_apartment_count_from_numbers function."""
    
    def test_count_all_numeric(self):
        """Test counting all numeric apartment numbers."""
        stats = get_apartment_count_from_numbers(["1", "2", "3", "4", "5"])
        self.assertEqual(stats['total'], 5)
        self.assertEqual(stats['numeric'], 5)
        self.assertEqual(stats['alphanumeric'], 0)
        self.assertEqual(stats['format'], 'numeric')
    
    def test_count_all_alphanumeric(self):
        """Test counting all alphanumeric apartment numbers."""
        stats = get_apartment_count_from_numbers(["1A", "2B", "H0102", "H0103"])
        self.assertEqual(stats['total'], 4)
        self.assertEqual(stats['numeric'], 0)
        self.assertEqual(stats['alphanumeric'], 4)
        self.assertEqual(stats['format'], 'alphanumeric')
    
    def test_count_mixed(self):
        """Test counting mixed apartment numbers."""
        stats = get_apartment_count_from_numbers(["1", "2", "3A", "4B"])
        self.assertEqual(stats['total'], 4)
        self.assertEqual(stats['numeric'], 2)
        self.assertEqual(stats['alphanumeric'], 2)
        self.assertEqual(stats['format'], 'mixed')
    
    def test_count_empty_list(self):
        """Test counting empty list."""
        stats = get_apartment_count_from_numbers([])
        self.assertEqual(stats['total'], 0)
        self.assertEqual(stats['numeric'], 0)
        self.assertEqual(stats['alphanumeric'], 0)
        self.assertEqual(stats['format'], 'unknown')
    
    def test_count_with_spaces(self):
        """Test counting numbers with spaces."""
        stats = get_apartment_count_from_numbers([" 1 ", " 2 ", " 3A "])
        self.assertEqual(stats['total'], 3)
        self.assertEqual(stats['numeric'], 2)
        self.assertEqual(stats['alphanumeric'], 1)

