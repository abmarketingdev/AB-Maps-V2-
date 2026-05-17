#!/usr/bin/env python3
"""
Test script to verify campaign_id integration with addresses API
"""
import requests
import json
import uuid

# Configuration
BASE_URL = "http://localhost:8000"
ADDRESSES_ENDPOINT = f"{BASE_URL}/api/addresses/addresses/"

def test_address_creation_with_campaign():
    """Test creating an address with campaign_id"""
    
    # Sample campaign ID (you'll need to replace this with a real one from your database)
    campaign_id = "550e8400-e29b-41d4-a716-446655440000"  # Example UUID
    
    # Sample address data
    address_data = {
        "address_text": "Test Address 123, Oslo, Norway",
        "status": "ja",
        "position": {
            "type": "Point",
            "coordinates": [10.7522, 59.9139]
        },
        "tags": {
            "source": "test_script",
            "timestamp": "2024-01-01T12:00:00Z"
        },
        "campaign_id": campaign_id,
        "employee_id": None,  # Will be set by backend based on user
        "manager_id": None    # Will be set by backend based on user
    }
    
    print("Testing address creation with campaign_id...")
    print(f"Address data: {json.dumps(address_data, indent=2)}")
    
    try:
        # Note: This will fail without authentication, but it tests the API structure
        response = requests.post(
            ADDRESSES_ENDPOINT,
            json=address_data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_TOKEN_HERE'  # Replace with actual token
            }
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code == 201:
            print("✅ Success! Address created with campaign_id")
            print(f"Response data: {json.dumps(response.json(), indent=2)}")
        elif response.status_code == 401:
            print("⚠️  Authentication required (expected without valid token)")
            print("This confirms the API endpoint is working")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - make sure the Django server is running on localhost:8000")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_address_filtering_by_campaign():
    """Test filtering addresses by campaign"""
    
    campaign_id = "550e8400-e29b-41d4-a716-446655440000"  # Example UUID
    
    print(f"\nTesting address filtering by campaign_id: {campaign_id}")
    
    try:
        response = requests.get(
            f"{ADDRESSES_ENDPOINT}?campaign={campaign_id}",
            headers={
                'Authorization': 'Bearer YOUR_TOKEN_HERE'  # Replace with actual token
            }
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Retrieved addresses filtered by campaign")
            print(f"Found {len(data.get('results', []))} addresses")
        elif response.status_code == 401:
            print("⚠️  Authentication required (expected without valid token)")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - make sure the Django server is running")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_campaign_endpoint():
    """Test the new by_campaign endpoint"""
    
    campaign_id = "550e8400-e29b-41d4-a716-446655440000"  # Example UUID
    
    print(f"\nTesting by_campaign endpoint with campaign_id: {campaign_id}")
    
    try:
        response = requests.get(
            f"{ADDRESSES_ENDPOINT}by_campaign/?campaign_id={campaign_id}",
            headers={
                'Authorization': 'Bearer YOUR_TOKEN_HERE'  # Replace with actual token
            }
        )
        
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Retrieved addresses using by_campaign endpoint")
            print(f"Found {len(data.get('results', []))} addresses")
        elif response.status_code == 401:
            print("⚠️  Authentication required (expected without valid token)")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - make sure the Django server is running")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🧪 Testing Campaign-Address Integration")
    print("=" * 50)
    
    test_address_creation_with_campaign()
    test_address_filtering_by_campaign()
    test_campaign_endpoint()
    
    print("\n" + "=" * 50)
    print("📝 Instructions:")
    print("1. Make sure Django server is running: python manage.py runserver")
    print("2. Replace 'YOUR_TOKEN_HERE' with a valid JWT token")
    print("3. Replace the example campaign_id with a real one from your database")
    print("4. Run this script to test the integration") 