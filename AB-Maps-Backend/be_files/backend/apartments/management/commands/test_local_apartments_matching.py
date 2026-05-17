"""
Management command to test local_apartments matching.

Tests the matching functionality by:
1. Taking base_address and apartment_number from apartments table
2. Finding matching records in local_apartments table
3. Displaying match results with scores and geometry comparison
"""
import json
from django.core.management.base import BaseCommand
from django.db import connection
from django.contrib.gis.geos import Point
from apartments.models import Apartment
from apartments.local_apartments_matcher import (
    find_local_apartments_for_building,
    parse_cadastral_address,
    normalize_unit_id
)


class Command(BaseCommand):
    help = 'Test local_apartments matching for apartments in database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--building-id',
            type=str,
            help='Test specific building by ID'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=5,
            help='Number of apartments to test (default: 5)'
        )
        parser.add_argument(
            '--campaign-id',
            type=str,
            help='Filter by campaign ID'
        )

    def handle(self, *args, **options):
        building_id = options.get('building_id')
        limit = options.get('limit', 5)
        campaign_id = options.get('campaign_id')

        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write(self.style.SUCCESS('Testing Local Apartments Matching'))
        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write('')

        if building_id:
            # Test specific building
            self.test_building(building_id)
        else:
            # Test multiple apartments
            self.test_multiple_apartments(limit, campaign_id)

    def test_building(self, building_id):
        """Test matching for a specific building."""
        from apartments.local_apartments_matcher import get_building_local_apartments_mapping

        self.stdout.write(f'Testing Building: {building_id}')
        self.stdout.write('-' * 80)

        try:
            result = get_building_local_apartments_mapping(
                building_id,
                include_geometry_comparison=True
            )

            if 'error' in result:
                self.stdout.write(self.style.ERROR(f"Error: {result['error']}"))
                return

            # Display building info
            building = result['building']
            self.stdout.write(self.style.SUCCESS(f"\n📌 Building Information:"))
            self.stdout.write(f"  ID: {building['id']}")
            self.stdout.write(f"  Address: {building['base_address']}")
            self.stdout.write(f"  Position: {building['position']['lat']:.6f}, {building['position']['lon']:.6f}")
            self.stdout.write(f"  Apartments: {building['apartment_count']}")

            # Display apartments
            if result['apartments']:
                self.stdout.write(self.style.SUCCESS(f"\n🏠 Apartments ({len(result['apartments'])}):"))
                for apt in result['apartments']:
                    status_icon = "✓" if apt['status'] else "○"
                    self.stdout.write(f"  {status_icon} {apt['apartment_number']} (status: {apt['status'] or 'unvisited'})")

            # Display matches
            matches = result['local_apartments_matches']
            self.stdout.write(self.style.SUCCESS(f"\n🔍 Local Apartments Matches ({len(matches)}):"))
            
            if not matches:
                self.stdout.write(self.style.WARNING("  No matches found"))
            else:
                for i, match in enumerate(matches[:10], 1):  # Show top 10
                    match_icon = "✅" if match.get('matches_apartment') else "⚠️"
                    self.stdout.write(f"\n  {i}. {match_icon} Match Score: {match.get('match_score', 0)}")
                    self.stdout.write(f"     Full Address: {match['full_address']}")
                    if match.get('unit_id'):
                        self.stdout.write(f"     Unit ID: {match['unit_id']}")
                    if match.get('grunnkretsnavn'):
                        self.stdout.write(f"     Area: {match['grunnkretsnavn']}")
                    if match.get('postcode'):
                        self.stdout.write(f"     Postcode: {match['postcode']}")
                    if match.get('distance_meters'):
                        self.stdout.write(f"     Distance: {match['distance_meters']:.2f} meters")
                    
                    # Show parsed components
                    if match.get('property_number'):
                        self.stdout.write(f"     Property: {match['property_number']}/{match.get('section_number', '?')}")
                        if match.get('unit_id'):
                            self.stdout.write(f"     Unit: {match['unit_id']}")

            # Display geometry comparison
            if result.get('geometry_comparison'):
                geom = result['geometry_comparison']
                self.stdout.write(self.style.SUCCESS(f"\n📐 Geometry Comparison:"))
                self.stdout.write(f"  Total compared: {geom['total_compared']}")
                self.stdout.write(f"  Within tolerance ({geom['tolerance_meters']}m): {geom['within_tolerance']}")
                if geom.get('average_distance'):
                    self.stdout.write(f"  Average distance: {geom['average_distance']:.2f}m")
                if geom.get('min_distance'):
                    self.stdout.write(f"  Min distance: {geom['min_distance']:.2f}m")
                if geom.get('max_distance'):
                    self.stdout.write(f"  Max distance: {geom['max_distance']:.2f}m")

            # Display summary
            summary = result['match_summary']
            self.stdout.write(self.style.SUCCESS(f"\n📊 Match Summary:"))
            self.stdout.write(f"  Total matches: {summary['total_matches']}")
            self.stdout.write(f"  Matched apartments: {summary['matched_apartments']}")
            self.stdout.write(f"  Best match score: {summary['best_match_score']}")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            import traceback
            self.stdout.write(traceback.format_exc())

    def test_multiple_apartments(self, limit, campaign_id):
        """Test matching for multiple apartments."""
        self.stdout.write(f'Testing {limit} apartments from database')
        self.stdout.write('-' * 80)

        # Get apartments
        queryset = Apartment.objects.select_related('building').all()
        
        if campaign_id:
            queryset = queryset.filter(building__campaign_id=campaign_id)
        
        apartments = queryset[:limit]

        if not apartments:
            self.stdout.write(self.style.WARNING("No apartments found in database"))
            return

        self.stdout.write(f"\nFound {len(apartments)} apartments to test\n")

        for idx, apartment in enumerate(apartments, 1):
            self.stdout.write(self.style.SUCCESS(f"\n{'=' * 80}"))
            self.stdout.write(self.style.SUCCESS(f"Test {idx}/{len(apartments)}: Apartment {apartment.apartment_number}"))
            self.stdout.write(f"{'=' * 80}")

            if not apartment.building:
                self.stdout.write(self.style.WARNING("  ⚠️  No building associated with this apartment"))
                continue

            building = apartment.building
            base_address = building.base_address
            apartment_number = apartment.apartment_number

            self.stdout.write(f"\n📌 Apartment Info:")
            self.stdout.write(f"  ID: {apartment.id}")
            self.stdout.write(f"  Apartment Number: {apartment_number}")
            self.stdout.write(f"  Status: {apartment.status or 'unvisited'}")

            self.stdout.write(f"\n🏢 Building Info:")
            self.stdout.write(f"  ID: {building.id}")
            self.stdout.write(f"  Base Address: {base_address}")
            self.stdout.write(f"  Position: {building.position.y:.6f}, {building.position.x:.6f}")

            # Find matches
            try:
                matches = find_local_apartments_for_building(
                    base_address,
                    building.position,
                    [apartment_number]
                )

                self.stdout.write(f"\n🔍 Local Apartments Matches: {len(matches)}")

                if not matches:
                    self.stdout.write(self.style.WARNING("  ⚠️  No matches found"))
                    self.stdout.write(f"\n  Trying to find any local_apartments near this building...")
                    
                    # Try without apartment number filter
                    all_matches = find_local_apartments_for_building(
                        base_address,
                        building.position,
                        None
                    )
                    
                    if all_matches:
                        self.stdout.write(f"  Found {len(all_matches)} nearby addresses (without unit matching):")
                        for match in all_matches[:3]:
                            self.stdout.write(f"    - {match['full_address']} (score: {match.get('match_score', 0)})")
                    else:
                        self.stdout.write(self.style.ERROR("  ❌ No nearby addresses found at all"))
                else:
                    # Show matches
                    for i, match in enumerate(matches[:5], 1):  # Show top 5
                        is_match = match.get('matches_apartment', False)
                        match_icon = "✅" if is_match else "⚠️"
                        
                        self.stdout.write(f"\n  {i}. {match_icon} Score: {match.get('match_score', 0)}")
                        self.stdout.write(f"     Address: {match['full_address']}")
                        
                        if match.get('unit_id'):
                            normalized_match = normalize_unit_id(match['unit_id'])
                            normalized_apt = normalize_unit_id(apartment_number)
                            unit_match = normalized_match == normalized_apt
                            
                            self.stdout.write(f"     Unit ID: {match['unit_id']}")
                            self.stdout.write(f"     Unit Match: {'✅ YES' if unit_match else '❌ NO'}")
                            if not unit_match:
                                self.stdout.write(f"       (Normalized: '{normalized_match}' vs '{normalized_apt}')")
                        
                        if match.get('grunnkretsnavn'):
                            self.stdout.write(f"     Area: {match['grunnkretsnavn']}")
                        
                        if match.get('distance_meters'):
                            self.stdout.write(f"     Distance: {match['distance_meters']:.2f}m")
                        
                        # Parse and show cadastral components
                        parsed = parse_cadastral_address(match['full_address'])
                        if parsed:
                            self.stdout.write(f"     Parsed: Property {parsed['property_number']}/{parsed['section_number']}")
                            if parsed.get('unit_id'):
                                self.stdout.write(f"              Unit: {parsed['unit_id']}")

                    # Check if we found exact match
                    exact_matches = [m for m in matches if m.get('matches_apartment')]
                    if exact_matches:
                        self.stdout.write(self.style.SUCCESS(f"\n  ✅ Found {len(exact_matches)} exact apartment match(es)!"))
                    else:
                        self.stdout.write(self.style.WARNING(f"\n  ⚠️  No exact apartment number match found"))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ❌ Error finding matches: {e}"))
                import traceback
                self.stdout.write(traceback.format_exc())

        self.stdout.write(self.style.SUCCESS(f"\n\n{'=' * 80}"))
        self.stdout.write(self.style.SUCCESS("Testing Complete!"))
        self.stdout.write(f"{'=' * 80}\n")
