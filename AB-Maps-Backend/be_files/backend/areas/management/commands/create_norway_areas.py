"""
Django management command to create 2000 non-overlapping rectangular areas around Norway.

Usage:
    python manage.py create_norway_areas --user_id=b2da666f-883d-4cb0-a45e-4b428c4b08da

This command will create 2000 rectangular areas covering Norway in a grid pattern,
all owned by the specified user (admin_lars).
"""

import uuid
import random
from django.core.management.base import BaseCommand, CommandError
from django.contrib.gis.geos import Polygon
from django.db import transaction
from areas.models import Area
from users.models import Manager
from campaigns.models import Campaign, CampaignArea


class Command(BaseCommand):
    help = 'Create 2000 non-overlapping rectangular areas around Norway for a specific user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--manager_id',
            type=str,
            required=True,
            help='UUID of the manager (admin_lars) to assign areas to'
        )
        parser.add_argument(
            '--campaign_id',
            type=str,
            required=True,
            help='UUID of the campaign to associate all areas with'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating areas'
        )

    def handle(self, *args, **options):
        manager_id = options['manager_id']
        campaign_id = options['campaign_id']
        dry_run = options['dry_run']

        try:
            # Validate manager exists directly
            manager = Manager.objects.get(id=manager_id)
            self.stdout.write(
                self.style.SUCCESS(f'Found manager: {manager.name} (ID: {manager.id})')
            )
            
            # Validate campaign exists
            campaign = Campaign.objects.get(id=campaign_id)
            self.stdout.write(
                self.style.SUCCESS(f'Found campaign: {campaign.name} (ID: {campaign.id})')
            )

            if dry_run:
                self.stdout.write(
                    self.style.WARNING('DRY RUN MODE - No areas will be created')
                )

            # Norway geographic bounds
            norway_bounds = {
                'min_lat': 57.0,  # Southernmost point
                'max_lat': 81.0,  # Northernmost point (Svalbard)
                'min_lon': 4.0,   # Westernmost point
                'max_lon': 31.0    # Easternmost point
            }

            # Grid configuration for 2000 areas
            grid_rows = 50
            grid_cols = 40
            total_areas = grid_rows * grid_cols

            self.stdout.write(f'Creating {total_areas} areas in a {grid_rows}x{grid_cols} grid')
            self.stdout.write(f'Grid cell size: ~0.675° longitude × 0.48° latitude')

            # Calculate cell dimensions
            lat_step = (norway_bounds['max_lat'] - norway_bounds['min_lat']) / grid_rows
            lon_step = (norway_bounds['max_lon'] - norway_bounds['min_lon']) / grid_cols

            areas_to_create = []
            colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
            ]

            for row in range(grid_rows):
                for col in range(grid_cols):
                    # Calculate cell coordinates
                    lat_start = norway_bounds['min_lat'] + (row * lat_step)
                    lat_end = lat_start + lat_step
                    lon_start = norway_bounds['min_lon'] + (col * lon_step)
                    lon_end = lon_start + lon_step

                    # Create polygon coordinates (clockwise order)
                    polygon_coords = [
                        [lon_start, lat_start],  # Southwest
                        [lon_end, lat_start],   # Southeast
                        [lon_end, lat_end],     # Northeast
                        [lon_start, lat_end],   # Northwest
                        [lon_start, lat_start]  # Close polygon
                    ]

                    # Create area name
                    area_name = f"Norway_Area_{row+1:02d}_{col+1:02d}"

                    # Random color for visual distinction
                    color = random.choice(colors)

                    if dry_run:
                        self.stdout.write(
                            f'Would create: {area_name} at ({lat_start:.3f}, {lon_start:.3f}) to ({lat_end:.3f}, {lon_end:.3f})'
                        )
                    else:
                        # Create Area object
                        area = Area(
                            id=uuid.uuid4(),
                            name=area_name,
                            polygon_geometry=Polygon(polygon_coords, srid=4326),
                            color=color,
                            status='open',
                            fylke=f'Grid_{row+1:02d}_{col+1:02d}',
                            house_count=random.randint(50, 500),  # Random house count
                            created_by=manager,
                            manager=manager
                        )
                        areas_to_create.append(area)

            if not dry_run:
                # Bulk create all areas
                with transaction.atomic():
                    created_areas = Area.objects.bulk_create(areas_to_create)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Successfully created {len(created_areas)} areas for manager {manager.name}'
                        )
                    )

                    # Create CampaignArea entries for all created areas
                    campaign_areas_to_create = []
                    for area in created_areas:
                        campaign_area = CampaignArea(
                            campaign=campaign,
                            area=area
                        )
                        campaign_areas_to_create.append(campaign_area)
                    
                    # Bulk create CampaignArea entries
                    created_campaign_areas = CampaignArea.objects.bulk_create(campaign_areas_to_create)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Successfully created {len(created_campaign_areas)} CampaignArea entries for campaign {campaign.name}'
                        )
                    )

                    # Verify creation
                    total_created = Area.objects.filter(created_by=manager).count()
                    total_campaign_areas = CampaignArea.objects.filter(campaign=campaign).count()
                    self.stdout.write(f'Total areas in database for {manager.name}: {total_created}')
                    self.stdout.write(f'Total CampaignArea entries for campaign {campaign.name}: {total_campaign_areas}')

            else:
                self.stdout.write(
                    self.style.SUCCESS(f'DRY RUN: Would create {total_areas} areas')
                )

        except Manager.DoesNotExist:
            raise CommandError(f'Manager with ID {manager_id} does not exist')
        except Campaign.DoesNotExist:
            raise CommandError(f'Campaign with ID {campaign_id} does not exist')
        except Exception as e:
            raise CommandError(f'Error creating areas: {str(e)}')
