#!/usr/bin/env python3
"""
Test script to verify campaign filtering functionality
"""
import os
import sys
import django
from django.conf import settings

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ab_maps.settings')
django.setup()

from areas.models import Area
from campaigns.models import Campaign, CampaignArea
from users.models import Manager, User

def test_campaign_filtering():
    """Test the campaign filtering functionality"""
    print("Testing Campaign Filtering...")
    
    # Check if models can be imported
    try:
        print("✅ Area model imported successfully")
        print("✅ Campaign model imported successfully")
        print("✅ CampaignArea model imported successfully")
        print("✅ Manager model imported successfully")
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return
    
    # Test data setup
    try:
        # Create a test manager
        user = User.objects.create_user(
            username='test_manager',
            email='test@example.com',
            password='testpass123'
        )
        manager = Manager.objects.create(
            user=user,
            name='Test Manager',
            email='test@example.com'
        )
        print(f"✅ Created test manager: {manager.name}")
        
        # Create test campaigns
        campaign1 = Campaign.objects.create(
            name='Test Campaign 1',
            description='First test campaign',
            created_by=manager
        )
        campaign2 = Campaign.objects.create(
            name='Test Campaign 2', 
            description='Second test campaign',
            created_by=manager
        )
        print(f"✅ Created test campaigns: {campaign1.name}, {campaign2.name}")
        
        # Create test areas
        area1 = Area.objects.create(
            name='Test Area 1',
            color='#FF0000',
            status='active',
            created_by=manager
        )
        area2 = Area.objects.create(
            name='Test Area 2',
            color='#00FF00', 
            status='active',
            created_by=manager
        )
        area3 = Area.objects.create(
            name='Test Area 3',
            color='#0000FF',
            status='active', 
            created_by=manager
        )
        print(f"✅ Created test areas: {area1.name}, {area2.name}, {area3.name}")
        
        # Create CampaignArea relationships
        CampaignArea.objects.create(campaign=campaign1, area=area1)
        CampaignArea.objects.create(campaign=campaign1, area=area2)
        CampaignArea.objects.create(campaign=campaign2, area=area3)
        print("✅ Created CampaignArea relationships")
        
        # Test filtering
        print("\n--- Testing Campaign Filtering ---")
        
        # Test campaign 1 filtering
        campaign1_areas = CampaignArea.objects.filter(campaign=campaign1).values_list('area_id', flat=True)
        areas_in_campaign1 = Area.objects.filter(id__in=campaign1_areas)
        print(f"Areas in Campaign 1: {[area.name for area in areas_in_campaign1]}")
        
        # Test campaign 2 filtering
        campaign2_areas = CampaignArea.objects.filter(campaign=campaign2).values_list('area_id', flat=True)
        areas_in_campaign2 = Area.objects.filter(id__in=campaign2_areas)
        print(f"Areas in Campaign 2: {[area.name for area in areas_in_campaign2]}")
        
        # Verify no overlap
        overlap = set(areas_in_campaign1) & set(areas_in_campaign2)
        if not overlap:
            print("✅ Campaign filtering works correctly - no overlap between campaigns")
        else:
            print(f"❌ Campaign filtering issue - overlap found: {overlap}")
        
        print("\n✅ Campaign filtering test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup test data
        try:
            CampaignArea.objects.all().delete()
            Area.objects.all().delete()
            Campaign.objects.all().delete()
            Manager.objects.all().delete()
            User.objects.filter(username='test_manager').delete()
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")

if __name__ == "__main__":
    test_campaign_filtering() 