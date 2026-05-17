#!/usr/bin/env python3
"""
Script to create test data for the filtered sales API.
This script helps you create sample campaigns and sales data for testing.
"""
import os
import sys
import django
from datetime import datetime, timedelta
import uuid

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'be_files', 'backend'))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ab_maps.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import Manager, Employee
from campaigns.models import Campaign
from dashboard.models import Sales
from django.utils import timezone

User = get_user_model()

def create_test_data():
    """Create test data for the filtered sales API."""
    print("Creating test data for filtered sales API...")
    
    # Create a test manager if it doesn't exist
    manager_user, created = User.objects.get_or_create(
        username='test_manager',
        defaults={
            'email': 'manager@test.com',
            'first_name': 'Test',
            'last_name': 'Manager'
        }
    )
    
    if created:
        manager_user.set_password('testpass123')
        manager_user.save()
        print("✅ Created test manager user")
    
    manager, created = Manager.objects.get_or_create(
        user=manager_user,
        defaults={
            'name': 'Test Manager',
            'email': 'manager@test.com',
            'phone': '12345678'
        }
    )
    
    if created:
        print("✅ Created test manager")
    
    # Create a test employee if it doesn't exist
    employee_user, created = User.objects.get_or_create(
        username='test_employee',
        defaults={
            'email': 'employee@test.com',
            'first_name': 'Test',
            'last_name': 'Employee'
        }
    )
    
    if created:
        employee_user.set_password('testpass123')
        employee_user.save()
        print("✅ Created test employee user")
    
    employee, created = Employee.objects.get_or_create(
        user=employee_user,
        defaults={
            'name': 'Test Employee',
            'email': 'employee@test.com',
            'phone': '87654321',
            'manager': manager
        }
    )
    
    if created:
        print("✅ Created test employee")
    
    # Create test campaigns
    campaigns = []
    campaign_names = [
        "Norsk Folkehjelp",
        "Standard OMS", 
        "Test Campaign 1",
        "Test Campaign 2"
    ]
    
    for name in campaign_names:
        campaign, created = Campaign.objects.get_or_create(
            name=name,
            defaults={
                'description': f'Test campaign: {name}',
                'created_by': manager
            }
        )
        campaigns.append(campaign)
        if created:
            print(f"✅ Created campaign: {name}")
    
    # Create test sales data
    sales_created = 0
    statuses = ['pending', 'completed', 'callback', 'cancelled', 'no_answer']
    contact_names = [
        'Dana Barzinje', 'John Smith', 'Maria Garcia', 'Ole Hansen',
        'Anna Johansen', 'Per Olsen', 'Kari Nilsen', 'Erik Berg',
        'Sofia Andersen', 'Lars Kristensen'
    ]
    
    # Create sales for the last 30 days
    for i in range(30):
        date = timezone.now() - timedelta(days=i)
        
        # Create 2-5 sales per day
        for j in range(2 + (i % 4)):
            # Randomly select campaign, status, and contact
            campaign = campaigns[i % len(campaigns)]
            status = statuses[i % len(statuses)]
            contact_name = contact_names[(i + j) % len(contact_names)]
            
            # Create unique phone and email
            phone = f"4863183{i:02d}"
            email = f"{contact_name.lower().replace(' ', '.')}@example.com"
            
            # Create the sale
            sale = Sales.objects.create(
                employee=employee,
                manager=manager,
                campaign=campaign,
                contact_name=contact_name,
                contact_phone=phone,
                contact_email=email,
                status=status,
                outcome=status.upper(),
                value=100.00 + (i * 10),
                commission=10.00 + (i * 1),
                notes=f"Test sale {i}-{j}",
                created_at=date,
                updated_at=date
            )
            sales_created += 1
    
    print(f"✅ Created {sales_created} test sales records")
    
    # Print campaign IDs for testing
    print("\n" + "="*50)
    print("CAMPAIGN IDs FOR TESTING")
    print("="*50)
    for campaign in campaigns:
        print(f"Campaign: {campaign.name}")
        print(f"ID: {campaign.id}")
        print(f"Sales count: {campaign.sales.count()}")
        print("-" * 30)
    
    print("\n" + "="*50)
    print("TESTING INSTRUCTIONS")
    print("="*50)
    print("1. Start the Django server:")
    print("   cd be_files/backend")
    print("   python manage.py runserver")
    print()
    print("2. Test the API with one of the campaign IDs above:")
    print("   python test_filtered_sales_api.py")
    print()
    print("3. Or use curl:")
    print("   curl 'http://localhost:8000/api/dashboard/sales/filtered/?campaign_id=<CAMPAIGN_ID>&start_date=2024-01-01&end_date=2024-12-31'")
    print()
    print("4. Login credentials:")
    print("   Manager: test_manager / testpass123")
    print("   Employee: test_employee / testpass123")

if __name__ == "__main__":
    create_test_data() 