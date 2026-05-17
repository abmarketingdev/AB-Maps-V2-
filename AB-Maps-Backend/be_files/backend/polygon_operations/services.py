import json
import time
import logging
from django.db import connection, transaction
from django.contrib.gis.geos import GEOSGeometry
from django.utils import timezone

from addresses.models import Address
from uploaded_addresses.models import UploadedAddress
from areas.models import Area
from buildings.models import Building
from apartments.models import Apartment
from campaigns.models import Campaign, CampaignArea
from tiles.tiles import invalidate_point_tiles

logger = logging.getLogger(__name__)


class PolygonDeletionService:
    """Service for deleting entities within a polygon boundary."""
    
    MAX_AREA_KM2 = 100  # Maximum polygon area in km²
    
    def __init__(self, polygon_geojson: dict, campaign_id: str):
        self.polygon_geojson = polygon_geojson
        self.campaign_id = campaign_id
        self.polygon_wkt = None
        self.campaign = None
        self._validate()
    
    def _validate(self):
        """Validate inputs."""
        # Validate campaign
        try:
            self.campaign = Campaign.objects.get(id=self.campaign_id)
        except Campaign.DoesNotExist:
            raise ValueError("Campaign not found")
        
        # Validate and convert polygon
        geom = GEOSGeometry(json.dumps(self.polygon_geojson))
        if not geom.valid:
            raise ValueError("Invalid polygon geometry")
        
        self.polygon_wkt = geom.wkt
        
        # Calculate area in km²
        self.area_km2 = geom.transform(3857, clone=True).area / 1_000_000
        
        if self.area_km2 > self.MAX_AREA_KM2:
            raise ValueError(
                f"Polygon area ({self.area_km2:.2f} km²) exceeds maximum {self.MAX_AREA_KM2} km²"
            )
    
    def get_addresses_in_polygon(self) -> dict:
        """Get all addresses within the polygon."""
        addresses = Address.objects.filter(
            campaign_id=self.campaign_id,
            position__isnull=False
        ).extra(
            where=[
                "ST_Contains(ST_GeomFromText(%s, 4326), position)"
            ],
            params=[self.polygon_wkt]
        )
        
        # Count by status
        status_counts = {}
        for status, _ in Address.STATUS_CHOICES:
            status_counts[status] = addresses.filter(status=status).count()
        
        return {
            'count': addresses.count(),
            'details': status_counts,
            'queryset': addresses,
            'sample_ids': list(addresses.values_list('id', flat=True)[:5])
        }
    
    def get_uploaded_addresses_in_polygon(self) -> dict:
        """Get all uploaded addresses within the polygon."""
        uploaded = UploadedAddress.objects.filter(
            campaign_id=self.campaign_id,
            geom__isnull=False
        ).extra(
            where=[
                "ST_Contains(ST_GeomFromText(%s, 4326), geom)"
            ],
            params=[self.polygon_wkt]
        )
        
        geocoded_count = uploaded.filter(geocoded_at__isnull=False).count()
        
        return {
            'count': uploaded.count(),
            'geocoded': geocoded_count,
            'failed_geocoding': uploaded.count() - geocoded_count,
            'queryset': uploaded,
            'sample_ids': list(uploaded.values_list('id', flat=True)[:5])
        }
    
    def get_buildings_in_polygon(self) -> dict:
        """Get all buildings within the polygon."""
        buildings = Building.objects.filter(
            campaign_id=self.campaign_id
        ).extra(
            where=[
                "ST_Contains(ST_GeomFromText(%s, 4326), position)"
            ],
            params=[self.polygon_wkt]
        )
        
        building_ids = list(buildings.values_list('id', flat=True))
        apartment_count = Apartment.objects.filter(building_id__in=building_ids).count()
        
        return {
            'count': buildings.count(),
            'apartments_affected': apartment_count,
            'queryset': buildings,
            'sample_ids': list(buildings.values_list('id', flat=True)[:5])
        }
    
    def get_areas_in_polygon(self, include_partial: bool = False) -> dict:
        """Get areas within the polygon."""
        # Get area IDs in campaign
        campaign_area_ids = CampaignArea.objects.filter(
            campaign_id=self.campaign_id
        ).values_list('area_id', flat=True)
        
        areas = Area.objects.filter(
            id__in=campaign_area_ids,
            polygon_geometry__isnull=False
        )
        
        if include_partial:
            # Include areas that intersect the polygon
            areas = areas.extra(
                where=[
                    "ST_Intersects(ST_GeomFromText(%s, 4326), polygon_geometry)"
                ],
                params=[self.polygon_wkt]
            )
        else:
            # Only areas fully contained
            areas = areas.extra(
                where=[
                    "ST_Contains(ST_GeomFromText(%s, 4326), polygon_geometry)"
                ],
                params=[self.polygon_wkt]
            )
        
        return {
            'count': areas.count(),
            'names': list(areas.values_list('name', flat=True)),
            'ids': list(areas.values_list('id', flat=True)),
            'queryset': areas
        }
    
    def preview(self, entity_types: list, include_partial_areas: bool = False) -> dict:
        """Preview what will be deleted (dry run)."""
        result = {
            'addresses': None,
            'uploaded_addresses': None,
            'buildings': None,
            'areas': None
        }
        
        total = 0
        
        if 'addresses' in entity_types:
            data = self.get_addresses_in_polygon()
            result['addresses'] = {k: v for k, v in data.items() if k != 'queryset'}
            total += data['count']
        
        if 'uploaded_addresses' in entity_types:
            data = self.get_uploaded_addresses_in_polygon()
            result['uploaded_addresses'] = {k: v for k, v in data.items() if k != 'queryset'}
            total += data['count']
        
        if 'buildings' in entity_types:
            data = self.get_buildings_in_polygon()
            result['buildings'] = {k: v for k, v in data.items() if k != 'queryset'}
            total += data['count']
        
        if 'areas' in entity_types:
            data = self.get_areas_in_polygon(include_partial_areas)
            result['areas'] = {k: v for k, v in data.items() if k != 'queryset'}
            total += data['count']
        
        return {
            'will_delete': {k: v for k, v in result.items() if v is not None},
            'total_will_delete': total
        }
    
    @transaction.atomic
    def execute(self, entity_types: list, include_partial_areas: bool = False) -> dict:
        """Execute deletion within transaction."""
        start_time = time.time()
        result = {
            'addresses': None,
            'uploaded_addresses': None,
            'buildings': None,
            'areas': None
        }
        
        total = 0
        
        # Collect positions BEFORE deletion for cache invalidation
        # Django bulk delete doesn't trigger signals, so we must invalidate manually
        positions_to_invalidate = []
        
        # Order matters due to foreign keys!
        
        # 1. Get building IDs first (needed for apartments and addresses)
        building_ids = []
        apt_count = 0
        deleted_building_addresses = 0
        if 'buildings' in entity_types:
            building_data = self.get_buildings_in_polygon()
            buildings_queryset = building_data['queryset']
            
            # Get building IDs - evaluate queryset immediately
            building_ids = list(buildings_queryset.values_list('id', flat=True))
            logger.info(f"🏢 Found {len(building_ids)} buildings to delete: {building_ids[:5]}...")
            
            if building_ids:
                # Collect building positions BEFORE deletion
                for building in buildings_queryset.only('position', 'campaign_id'):
                    if building.position:
                        positions_to_invalidate.append({
                            'lon': building.position.x,
                            'lat': building.position.y,
                            'campaign_id': str(building.campaign_id) if building.campaign_id else None
                        })
                
                # Step 1: Delete apartments first
                apt_count = Apartment.objects.filter(building_id__in=building_ids).delete()[0]
                logger.info(f"🗑️ Deleted {apt_count} apartments for {len(building_ids)} buildings")
                
                # Step 2: DELETE addresses linked to buildings (not just unlink)
                # This prevents "zombie addresses" from appearing as standalone houses
                deleted_building_addresses = Address.objects.filter(building_id__in=building_ids).delete()[0]
                logger.info(
                    f"🗑️ Deleted {deleted_building_addresses} addresses linked to buildings"
                )
                
                # Step 3: Delete buildings themselves
                building_count = Building.objects.filter(id__in=building_ids).delete()[0]
                logger.info(f"🗑️ Deleted {building_count} buildings")
                
                result['buildings'] = {
                    'count': building_count,
                    'apartments_deleted': apt_count,
                    'addresses_deleted': deleted_building_addresses,
                    'found_via_addresses': False
                }
                total += building_count
            else:
                logger.warning("⚠️ No buildings found in polygon")
                result['buildings'] = {
                    'count': 0,
                    'apartments_deleted': 0,
                    'addresses_deleted': 0
                }
        
        # 2. Delete addresses - IMPORTANT: Check for building_id and delete buildings too
        # When addresses have building_id, they represent apartment visits
        # We need to delete the associated buildings and apartments
        if 'addresses' in entity_types:
            addr_data = self.get_addresses_in_polygon()
            addresses_queryset = addr_data['queryset']
            
            # Step 1: Find all unique building_ids from addresses in polygon
            # These are addresses that represent apartment visits
            address_building_ids = list(
                addresses_queryset.filter(building_id__isnull=False)
                .values_list('building_id', flat=True)
                .distinct()
            )
            
            # Step 2: If we found addresses with building_id, delete those buildings
            # (This will also delete apartments and all addresses linked to those buildings)
            if address_building_ids:
                logger.info(
                    f"🏢 Found {len(address_building_ids)} buildings linked to addresses in polygon"
                )
                
                # Add to building_ids list if not already there (from explicit building deletion)
                new_building_ids = [bid for bid in address_building_ids if bid not in building_ids]
                if new_building_ids:
                    building_ids.extend(new_building_ids)
                    
                    # Collect building positions BEFORE deletion
                    for building in Building.objects.filter(id__in=new_building_ids).only('position', 'campaign_id'):
                        if building.position:
                            positions_to_invalidate.append({
                                'lon': building.position.x,
                                'lat': building.position.y,
                                'campaign_id': str(building.campaign_id) if building.campaign_id else None
                            })
                    
                    # Delete apartments for these buildings
                    new_apt_count = Apartment.objects.filter(building_id__in=new_building_ids).delete()[0]
                    apt_count += new_apt_count
                    logger.info(f"🗑️ Deleted {new_apt_count} apartments for {len(new_building_ids)} buildings found via addresses")
                    
                    # Delete all addresses linked to these buildings
                    new_deleted_addresses = Address.objects.filter(building_id__in=new_building_ids).delete()[0]
                    deleted_building_addresses += new_deleted_addresses
                    logger.info(f"🗑️ Deleted {new_deleted_addresses} addresses linked to buildings found via addresses")
                    
                    # Delete the buildings themselves
                    new_building_count = Building.objects.filter(id__in=new_building_ids).delete()[0]
                    logger.info(f"🗑️ Deleted {new_building_count} buildings found via addresses")
                    
                    # Update result - merge counts if buildings were also explicitly requested
                    if 'buildings' in entity_types:
                        # Buildings were explicitly requested, so merge the counts
                        if result.get('buildings'):
                            result['buildings']['count'] += new_building_count
                            result['buildings']['apartments_deleted'] += new_apt_count
                            result['buildings']['addresses_deleted'] += new_deleted_addresses
                            result['buildings']['found_via_addresses'] = len(new_building_ids)
                        else:
                            result['buildings'] = {
                                'count': new_building_count,
                                'apartments_deleted': new_apt_count,
                                'addresses_deleted': new_deleted_addresses,
                                'found_via_addresses': len(new_building_ids)
                            }
                        total += new_building_count
                    else:
                        # Buildings not explicitly requested, but found via addresses
                        result['buildings'] = {
                            'count': new_building_count,
                            'apartments_deleted': new_apt_count,
                            'addresses_deleted': new_deleted_addresses,
                            'found_via_addresses': True
                        }
                        total += new_building_count
            
            # Step 3: Delete standalone addresses (addresses without building_id)
            # Filter out addresses that are already linked to buildings we're deleting
            standalone_addresses = addresses_queryset.filter(building_id__isnull=True)
            if building_ids:
                # Also exclude addresses linked to buildings we already deleted
                standalone_addresses = standalone_addresses.exclude(building_id__in=building_ids)
            
            # Collect address positions BEFORE deletion
            for addr in standalone_addresses.only('position', 'campaign_id', 'manager_id', 'employee_id'):
                if addr.position:
                    positions_to_invalidate.append({
                        'lon': addr.position.x,
                        'lat': addr.position.y,
                        'campaign_id': str(addr.campaign_id) if addr.campaign_id else None,
                        'manager_id': str(addr.manager_id) if addr.manager_id else None,
                        'employee_id': str(addr.employee_id) if addr.employee_id else None
                    })
            
            deleted_standalone_count = standalone_addresses.delete()[0]
            logger.info(f"🗑️ Deleted {deleted_standalone_count} standalone addresses")
            
            result['addresses'] = {
                'count': deleted_standalone_count + deleted_building_addresses,
                'standalone_deleted': deleted_standalone_count,
                'building_linked_deleted': deleted_building_addresses,
                'buildings_found_via_addresses': len(address_building_ids) if address_building_ids else 0,
                'details': addr_data['details']
            }
            total += deleted_standalone_count + deleted_building_addresses
        
        # 4. Delete areas
        if 'areas' in entity_types:
            area_data = self.get_areas_in_polygon(include_partial_areas)
            area_ids = list(area_data['queryset'].values_list('id', flat=True))
            area_names = list(area_data['queryset'].values_list('name', flat=True))
            
            # Delete CampaignArea links first
            if area_ids:
                CampaignArea.objects.filter(
                    area_id__in=area_ids, 
                    campaign_id=self.campaign_id
                ).delete()
                
                # Delete areas
                deleted_count = area_data['queryset'].delete()[0]
                result['areas'] = {
                    'count': deleted_count,
                    'names': area_names,
                    'ids': area_ids  # Include IDs for frontend to remove from map
                }
                total += deleted_count
            else:
                result['areas'] = {
                    'count': 0,
                    'names': [],
                    'ids': []
                }
        
        # 5. Delete uploaded addresses
        if 'uploaded_addresses' in entity_types:
            uploaded_data = self.get_uploaded_addresses_in_polygon()
            
            # Collect uploaded address positions BEFORE deletion
            for uploaded in uploaded_data['queryset'].only('geom', 'campaign_id'):
                if uploaded.geom:
                    positions_to_invalidate.append({
                        'lon': uploaded.geom.x,
                        'lat': uploaded.geom.y,
                        'campaign_id': str(uploaded.campaign_id) if uploaded.campaign_id else None
                    })
            
            deleted_count = uploaded_data['queryset'].delete()[0]
            result['uploaded_addresses'] = {
                'count': deleted_count,
                'geocoded': uploaded_data['geocoded'],
                'failed_geocoding': uploaded_data['failed_geocoding']
            }
            total += deleted_count
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        # Schedule cache invalidation AFTER transaction commits
        # This ensures data is actually deleted before invalidating cache
        def invalidate_tile_cache():
            invalidated_count = 0
            seen_tiles = set()  # Avoid redundant invalidations for same tile
            
            for pos in positions_to_invalidate:
                # Create a rough tile key to deduplicate (z16 precision)
                tile_key = (round(pos['lon'], 4), round(pos['lat'], 4))
                if tile_key in seen_tiles:
                    continue
                seen_tiles.add(tile_key)
                
                invalidate_point_tiles(
                    lon=pos['lon'],
                    lat=pos['lat'],
                    campaign_id=pos.get('campaign_id'),
                    manager_id=pos.get('manager_id'),
                    employee_id=pos.get('employee_id')
                )
                invalidated_count += 1
            
            logger.info(
                f"🗑️ Cache invalidation: {invalidated_count} unique tile positions "
                f"invalidated for {len(positions_to_invalidate)} deleted entities"
            )
        
        transaction.on_commit(invalidate_tile_cache)
        
        logger.info(
            f"Polygon deletion completed for campaign {self.campaign_id}: "
            f"{total} entities deleted in {execution_time_ms}ms"
        )
        
        return {
            'deleted': {k: v for k, v in result.items() if v is not None},
            'total_deleted': total,
            'execution_time_ms': execution_time_ms,
            'deleted_at': timezone.now()
        }

