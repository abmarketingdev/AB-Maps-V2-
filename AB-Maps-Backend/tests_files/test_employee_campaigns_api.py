#!/usr/bin/env python3
"""
Test script for employee campaign API endpoints
"""
import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

def test_employee_campaigns_api():
    """Test the employee campaign API endpoints"""
    
    print("🧪 Testing Employee Campaign API Endpoints")
    print("=" * 50)
    
    # Test 1: Get campaign IDs for employee
    print("\n1. Testing GET /api/campaigns/campaigns/my_campaign_ids/")
    print("-" * 60)
    
    try:
        # You'll need to replace this with a valid employee token
        headers = {
            'Authorization': 'Bearer YOUR_EMPLOYEE_TOKEN_HERE',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(
            f"{API_BASE}/campaigns/campaigns/my_campaign_ids/",
            headers=headers
        )
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Make sure the Django server is running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Get full campaign details for employee
    print("\n2. Testing GET /api/campaigns/campaigns/my_campaigns_employee/")
    print("-" * 60)
    
    try:
        response = requests.get(
            f"{API_BASE}/campaigns/campaigns/my_campaigns_employee/",
            headers=headers
        )
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Make sure the Django server is running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Test completed!")
    print("\n📝 Notes:")
    print("- Replace 'YOUR_EMPLOYEE_TOKEN_HERE' with a valid employee JWT token")
    print("- Make sure the Django server is running: python manage.py runserver")
    print("- Ensure there are CampaignEmployee records in the database")

if __name__ == "__main__":
    test_employee_campaigns_api() 