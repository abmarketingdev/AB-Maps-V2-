#!/usr/bin/env python3
"""
Debug script to check user permissions and fix issues.
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

User = get_user_model()

def debug_user_permissions():
    """Debug user permissions and relationships."""
    print("Debugging User Permissions")
    print("=" * 50)
    
    # Check test users
    test_manager_user = User.objects.filter(username='test_manager').first()
    test_employee_user = User.objects.filter(username='test_employee').first()
    
    print("1. Checking Test Manager User:")
    if test_manager_user:
        print(f"   ✅ User exists: {test_manager_user.username}")
        print(f"   Email: {test_manager_user.email}")
        print(f"   Is active: {test_manager_user.is_active}")
        print(f"   Is staff: {test_manager_user.is_staff}")
        print(f"   Is superuser: {test_manager_user.is_superuser}")
        
        # Check manager relationship
        try:
            manager = test_manager_user.manager
            if manager:
                print(f"   ✅ Manager relationship exists: {manager.name}")
                print(f"   Manager ID: {manager.id}")
            else:
                print("   ❌ Manager relationship is None!")
                print("   Looking for existing manager...")
                
                # Try to find existing manager
                existing_manager = Manager.objects.filter(email=test_manager_user.email).first()
                if existing_manager:
                    print(f"   ✅ Found existing manager: {existing_manager.name}")
                    # Link the manager to the user
                    existing_manager.user = test_manager_user
                    existing_manager.save()
                    print(f"   ✅ Linked manager to user")
                    manager = existing_manager
                else:
                    print("   Creating new manager relationship...")
                    # Create manager relationship
                    manager = Manager.objects.create(
                        user=test_manager_user,
                        name="Test Manager",
                        email=test_manager_user.email,
                        phone="123456789",
                        status="active"
                    )
                    print(f"   ✅ Created manager: {manager.name} (ID: {manager.id})")
        except Manager.DoesNotExist:
            print("   ❌ No manager relationship found!")
            print("   Creating manager relationship...")
            
            # Create manager relationship
            manager = Manager.objects.create(
                user=test_manager_user,
                name="Test Manager",
                email=test_manager_user.email,
                phone="123456789",
                status="active"
            )
            print(f"   ✅ Created manager: {manager.name} (ID: {manager.id})")
    else:
        print("   ❌ Test manager user not found!")
    
    print("\n2. Checking Test Employee User:")
    if test_employee_user:
        print(f"   ✅ User exists: {test_employee_user.username}")
        print(f"   Email: {test_employee_user.email}")
        print(f"   Is active: {test_employee_user.is_active}")
        
        # Check employee relationship
        try:
            employee = test_employee_user.employee
            if employee:
                print(f"   ✅ Employee relationship exists: {employee.name}")
                print(f"   Employee ID: {employee.id}")
            else:
                print("   ❌ Employee relationship is None!")
                print("   Looking for existing employee...")
                
                # Try to find existing employee
                existing_employee = Employee.objects.filter(email=test_employee_user.email).first()
                if existing_employee:
                    print(f"   ✅ Found existing employee: {existing_employee.name}")
                    # Link the employee to the user
                    existing_employee.user = test_employee_user
                    existing_employee.save()
                    print(f"   ✅ Linked employee to user")
                    employee = existing_employee
                else:
                    print("   Creating new employee relationship...")
                    # Create employee relationship
                    employee = Employee.objects.create(
                        user=test_employee_user,
                        name="Test Employee",
                        email=test_employee_user.email,
                        phone="987654321",
                        status="active"
                    )
                    print(f"   ✅ Created employee: {employee.name} (ID: {employee.id})")
        except Employee.DoesNotExist:
            print("   ❌ No employee relationship found!")
            print("   Creating employee relationship...")
            
            # Create employee relationship
            employee = Employee.objects.create(
                user=test_employee_user,
                name="Test Employee",
                email=test_employee_user.email,
                phone="987654321",
                status="active"
            )
            print(f"   ✅ Created employee: {employee.name} (ID: {employee.id})")
    else:
        print("   ❌ Test employee user not found!")
    
    print("\n3. Testing Sales Access:")
    if test_manager_user and hasattr(test_manager_user, 'manager'):
        # Test if manager can access sales
        sales_count = Sales.objects.all().count()
        print(f"   Total sales in database: {sales_count}")
        
        # Test specific campaign sales
        campaign = Campaign.objects.filter(name='Norsk Folkehjelp').first()
        if campaign:
            campaign_sales = Sales.objects.filter(campaign=campaign).count()
            print(f"   Sales for 'Norsk Folkehjelp' campaign: {campaign_sales}")
            
            # Test the actual query that the API uses
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
            
            print(f"   Filtered sales (2024): {filtered_sales.count()}")
            
            if filtered_sales.exists():
                first_sale = filtered_sales.first()
                print(f"   Sample sale: {first_sale.contact_name} - {first_sale.status}")
            else:
                print("   ❌ No sales found with the filter!")
        else:
            print("   ❌ Campaign 'Norsk Folkehjelp' not found!")
    
    print("\n4. Testing API Permissions:")
    print("   Now test the API again with:")
    print("   python test_filtered_sales_api.py")

def fix_user_permissions():
    """Fix user permissions by ensuring proper relationships exist."""
    print("\n" + "=" * 50)
    print("Fixing User Permissions")
    print("=" * 50)
    
    # Ensure test manager has proper relationship
    test_manager_user = User.objects.filter(username='test_manager').first()
    if test_manager_user:
        try:
            manager = test_manager_user.manager
            print(f"✅ Manager relationship exists: {manager.name}")
        except Manager.DoesNotExist:
            print("Creating manager relationship...")
            manager = Manager.objects.create(
                user=test_manager_user,
                name="Test Manager",
                email=test_manager_user.email,
                phone="123456789",
                status="active"
            )
            print(f"✅ Created manager: {manager.name}")
    
    # Ensure test employee has proper relationship
    test_employee_user = User.objects.filter(username='test_employee').first()
    if test_employee_user:
        try:
            employee = test_employee_user.employee
            print(f"✅ Employee relationship exists: {employee.name}")
        except Employee.DoesNotExist:
            print("Creating employee relationship...")
            employee = Employee.objects.create(
                user=test_employee_user,
                name="Test Employee",
                email=test_employee_user.email,
                phone="987654321",
                status="active"
            )
            print(f"✅ Created employee: {employee.name}")

if __name__ == "__main__":
    debug_user_permissions()
    fix_user_permissions() 