#!/usr/bin/env python3
"""
Test user permissions directly in Django.
"""
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'be_files', 'backend'))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ab_maps.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import Manager, Employee
from campaigns.models import Campaign
from dashboard.models import Sales
from dashboard.views import DashboardPermission
from rest_framework.test import APIRequestFactory
from rest_framework.permissions import IsAuthenticated

User = get_user_model()

def test_user_permissions():
    """Test user permissions directly."""
    print("Testing User Permissions Directly")
    print("=" * 50)
    
    # Get test user
    test_manager_user = User.objects.filter(username='test_manager').first()
    
    if not test_manager_user:
        print("❌ Test manager user not found!")
        return
    
    print(f"✅ Test manager user: {test_manager_user.username}")
    
    # Check manager relationship
    try:
        manager = test_manager_user.manager
        if manager:
            print(f"✅ Manager relationship: {manager.name} (ID: {manager.id})")
        else:
            print("❌ Manager relationship is None!")
            return
    except Manager.DoesNotExist:
        print("❌ Manager relationship does not exist!")
        return
    
    # Test DashboardPermission directly
    print("\nTesting DashboardPermission:")
    permission = DashboardPermission()
    factory = APIRequestFactory()
    
    # Create a mock request
    request = factory.get('/api/dashboard/sales/filtered/')
    request.user = test_manager_user
    
    # Test permission
    has_permission = permission.has_permission(request, None)
    print(f"DashboardPermission.has_permission: {has_permission}")
    
    if not has_permission:
        print("❌ User does not have dashboard permission!")
        print("Checking user attributes:")
        print(f"   is_authenticated: {test_manager_user.is_authenticated}")
        print(f"   hasattr(user, 'manager'): {hasattr(test_manager_user, 'manager')}")
        print(f"   user.manager: {test_manager_user.manager}")
        return
    
    print("✅ User has dashboard permission!")
    
    # Test sales access
    print("\nTesting Sales Access:")
    sales_count = Sales.objects.all().count()
    print(f"Total sales: {sales_count}")
    
    # Test specific campaign
    campaign = Campaign.objects.filter(name='Norsk Folkehjelp').first()
    if campaign:
        campaign_sales = Sales.objects.filter(campaign=campaign).count()
        print(f"Sales for 'Norsk Folkehjelp': {campaign_sales}")
        
        # Test the actual query
        from datetime import datetime, timedelta
        from django.utils import timezone
        
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 12, 31)
        
        start_datetime = timezone.make_aware(start_date)
        end_datetime = timezone.make_aware(end_date + timedelta(days=1))
        
        filtered_sales = Sales.objects.filter(
            campaign_id=campaign.id,
            created_at__gte=start_datetime,
            created_at__lt=end_datetime
        )
        
        print(f"Filtered sales (2024): {filtered_sales.count()}")
        
        if filtered_sales.exists():
            first_sale = filtered_sales.first()
            print(f"Sample sale: {first_sale.contact_name} - {first_sale.status}")
            print(f"Sale created_at: {first_sale.created_at}")
        else:
            print("❌ No sales found with filter!")
            # Check what dates the sales actually have
            all_campaign_sales = Sales.objects.filter(campaign=campaign)
            if all_campaign_sales.exists():
                print("Sales dates in database:")
                for sale in all_campaign_sales[:5]:  # Show first 5
                    print(f"   {sale.contact_name}: {sale.created_at}")
    else:
        print("❌ Campaign 'Norsk Folkehjelp' not found!")

def test_api_with_correct_dates():
    """Test the API with the correct date range."""
    print("\n" + "=" * 50)
    print("Testing API with Correct Dates")
    print("=" * 50)
    
    # Check what dates the sales actually have
    sales = Sales.objects.all()[:10]  # Get first 10 sales
    print("Sample sales dates:")
    for sale in sales:
        print(f"   {sale.contact_name}: {sale.created_at.date()}")
    
    # Find the date range of existing sales
    from django.db.models import Min, Max
    date_range = Sales.objects.aggregate(
        min_date=Min('created_at'),
        max_date=Max('created_at')
    )
    
    print(f"\nSales date range:")
    print(f"   Min date: {date_range['min_date']}")
    print(f"   Max date: {date_range['max_date']}")
    
    # Use the actual date range for testing
    if date_range['min_date'] and date_range['max_date']:
        start_date = date_range['min_date'].date()
        end_date = date_range['max_date'].date()
        
        print(f"\nUse these dates for API testing:")
        print(f"   start_date: {start_date}")
        print(f"   end_date: {end_date}")

if __name__ == "__main__":
    test_user_permissions()
    test_api_with_correct_dates() 