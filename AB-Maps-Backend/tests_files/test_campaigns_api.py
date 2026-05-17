#!/usr/bin/env python3
"""
Test script for the campaigns API endpoint.
"""
import requests
import json

# API configuration
BASE_URL = "http://localhost:8000"
CAMPAIGNS_ENDPOINT = f"{BASE_URL}/api/campaigns/campaigns/"

def test_campaigns_api():
    """Test the campaigns API endpoint."""
    
    print("Testing Campaigns API Endpoint")
    print("=" * 50)
    print(f"URL: {CAMPAIGNS_ENDPOINT}")
    print()
    
    try:
        # Make the API request
        response = requests.get(CAMPAIGNS_ENDPOINT)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Response:")
            print(json.dumps(data, indent=2))
            
            # Validate response structure
            if isinstance(data, list):
                print(f"✅ Response is a list with {len(data)} campaigns")
                if data:
                    first_campaign = data[0]
                    print(f"✅ First campaign: {first_campaign.get('name', 'Unknown')}")
                    print(f"✅ Campaign ID: {first_campaign.get('id', 'Unknown')}")
                    
                    # Validate UUID format
                    import re
                    uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)
                    if uuid_pattern.match(first_campaign.get('id', '')):
                        print("✅ Campaign ID is a valid UUID")
                    else:
                        print("❌ Campaign ID is not a valid UUID")
            else:
                print("❌ Response is not a list")
                print(f"Response type: {type(data)}")
                
        else:
            print("❌ Error Response:")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Make sure the Django server is running on localhost:8000")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request Error: {e}")
    except json.JSONDecodeError as e:
        print(f"❌ JSON Decode Error: {e}")
        print(f"Response text: {response.text}")

def test_with_authentication():
    """Test the campaigns API with authentication."""
    print("\n" + "="*50)
    print("Testing with authentication")
    print("="*50)
    
    # First, try to login
    login_url = f"{BASE_URL}/api/auth/login/"
    login_data = {
        "username": "test_manager",
        "password": "testpass123"
    }
    
    try:
        login_response = requests.post(login_url, json=login_data)
        if login_response.status_code == 200:
            auth_data = login_response.json()
            access_token = auth_data.get('access')
            
            if access_token:
                print("✅ Login successful")
                
                # Test campaigns API with authentication
                headers = {
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                }
                
                response = requests.get(CAMPAIGNS_ENDPOINT, headers=headers)
                print(f"Authenticated request status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"✅ Authenticated request successful: {len(data)} campaigns")
                    if data:
                        print(f"First campaign: {data[0].get('name')} (ID: {data[0].get('id')})")
                else:
                    print(f"❌ Authenticated request failed: {response.text}")
            else:
                print("❌ No access token in login response")
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            print(login_response.text)
            
    except Exception as e:
        print(f"❌ Authentication test error: {e}")

if __name__ == "__main__":
    test_campaigns_api()
    test_with_authentication() 