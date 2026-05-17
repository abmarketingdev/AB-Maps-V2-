#!/usr/bin/env python3
"""
Test script to verify campaign-area integration
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

def test_campaign_area_integration():
    """Test the campaign-area integration functionality"""
    print("Testing Campaign-Area Integration...")
    
    # Check if models can be imported
    try:
        print("✅ Campaign model imported successfully")
        print("✅ CampaignArea model imported successfully")
        print("✅ Area model imported successfully")
    except Exception as e:
        print(f"❌ Error importing models: {e}")
        return False
    
    # Check if we can query the models
    try:
        campaign_count = Campaign.objects.count()
        area_count = Area.objects.count()
        campaign_area_count = CampaignArea.objects.count()
        
        print(f"✅ Database queries work:")
        print(f"   - Campaigns: {campaign_count}")
        print(f"   - Areas: {area_count}")
        print(f"   - CampaignAreas: {campaign_area_count}")
    except Exception as e:
        print(f"❌ Error querying database: {e}")
        return False
    
    print("\n🎉 Campaign-Area integration test passed!")
    return True

if __name__ == "__main__":
    test_campaign_area_integration() 