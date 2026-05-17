#!/usr/bin/env python3
"""
Script to check existing campaigns and their UUIDs.
"""
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'be_files', 'backend'))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ab_maps.settings')
django.setup()

from campaigns.models import Campaign
from users.models import Manager, Employee
from django.contrib.auth import get_user_model

User = get_user_model()

def check_campaigns():
    """Check existing campaigns and their UUIDs."""
    print("Checking existing campaigns...")
    print("=" * 50)
    
    # Check campaigns
    campaigns = Campaign.objects.all()
    print(f"Found {campaigns.count()} campaigns:")
    
    if campaigns.count() == 0:
        print("❌ No campaigns found!")
        print("\nTo create test campaigns, run:")
        print("python create_test_data.py")
        return
    
    for campaign in campaigns:
        print(f"✅ Campaign: {campaign.name}")
        print(f"   ID: {campaign.id}")
        print(f"   Created by: {campaign.created_by.name if campaign.created_by else 'Unknown'}")
        print(f"   Created at: {campaign.created_at}")
        print("-" * 30)
    
    # Check users
    print("\nChecking users...")
    print("=" * 30)
    
    managers = Manager.objects.all()
    print(f"Found {managers.count()} managers:")
    for manager in managers:
        print(f"✅ Manager: {manager.name} (ID: {manager.id})")
    
    employees = Employee.objects.all()
    print(f"Found {employees.count()} employees:")
    for employee in employees:
        print(f"✅ Employee: {employee.name} (ID: {employee.id})")
    
    # Check sales data
    print("\nChecking sales data...")
    print("=" * 30)
    
    from dashboard.models import Sales
    sales = Sales.objects.all()
    print(f"Found {sales.count()} sales records:")
    
    if sales.count() > 0:
        # Group by campaign
        for campaign in campaigns:
            campaign_sales = sales.filter(campaign=campaign)
            print(f"   {campaign.name}: {campaign_sales.count()} sales")
    
    print("\n" + "=" * 50)
    print("TESTING INSTRUCTIONS")
    print("=" * 50)
    
    if campaigns.count() > 0:
        first_campaign = campaigns.first()
        print(f"1. Use this campaign ID for testing: {first_campaign.id}")
        print(f"2. Test the API with:")
        print(f"   curl 'http://localhost:8000/api/dashboard/sales/filtered/?campaign_id={first_campaign.id}&start_date=2025-07-20&end_date=2025-07-20'")
        print(f"3. Or visit the frontend and select: {first_campaign.name}")
    else:
        print("1. Create test data first: python create_test_data.py")
        print("2. Then run this script again to get campaign IDs")

if __name__ == "__main__":
    check_campaigns() 