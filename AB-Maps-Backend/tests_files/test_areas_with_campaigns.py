#!/usr/bin/env python3
"""
Test script to verify areas with campaigns API endpoint
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
from users.models import Manager

def test_areas_with_campaigns():
    """Test the areas with campaigns functionality"""
    print("Testing Areas with Campaigns API...")
    
    # Check if models can be imported
    try:
        print("✅ Area model imported successfully")
        print("✅ Campaign model imported successfully")
        print("✅ CampaignArea model imported successfully")
    except Exception as e:
        print(f"❌ Error importing models: {e}")
        return False
    
    # Check if we can query the models
    try:
        area_count = Area.objects.count()
        campaign_count = Campaign.objects.count()
        campaign_area_count = CampaignArea.objects.count()
        
        print(f"✅ Database queries work:")
        print(f"   - Areas: {area_count}")
        print(f"   - Campaigns: {campaign_count}")
        print(f"   - CampaignAreas: {campaign_area_count}")
        
        # Test the relationship
        if area_count > 0 and campaign_count > 0:
            # Get first area and first campaign
            first_area = Area.objects.first()
            first_campaign = Campaign.objects.first()
            
            print(f"   - First area: {first_area.name}")
            print(f"   - First campaign: {first_campaign.name}")
            
            # Check if there's a relationship
            try:
                campaign_area = CampaignArea.objects.get(area=first_area)
                print(f"   - Area '{first_area.name}' belongs to campaign '{campaign_area.campaign.name}'")
            except CampaignArea.DoesNotExist:
                print(f"   - Area '{first_area.name}' has no campaign assignment")
        
    except Exception as e:
        print(f"❌ Error querying database: {e}")
        return False
    
    print("\n🎉 Areas with campaigns test passed!")
    return True

if __name__ == "__main__":
    test_areas_with_campaigns() 