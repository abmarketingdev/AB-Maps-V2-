#!/usr/bin/env python3
"""
Test script for the filtered sales API endpoint.
"""
import requests
import json
from datetime import datetime, timedelta

# API configuration
BASE_URL = "http://localhost:8000"
API_ENDPOINT = f"{BASE_URL}/api/dashboard/sales/filtered/"

# Test parameters
def test_filtered_sales_api():
    """Test the filtered sales API endpoint."""
    
    # First, authenticate to get a token
    login_url = f"{BASE_URL}/api/auth/login/"
    login_data = {
        "username": "test_manager",
        "password": "testpass123"
    }
    
    try:
        login_response = requests.post(login_url, json=login_data)
        if login_response.status_code != 200:
            print("❌ Login failed. Creating test user first...")
            return
            
        auth_data = login_response.json()
        access_token = auth_data.get('access')
        
        if not access_token:
            print("❌ No access token received")
            return
            
        print("✅ Authentication successful")
        
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return
    
    # Test parameters - using real campaign ID from test data and correct dates
    params = {
        'campaign_id': '6f0c3353-c04f-44a5-8b83-9fc376e3db54',  # Norsk Folkehjelp campaign
        'start_date': '2025-07-20',
        'end_date': '2025-07-20',
        'page': 1,
        'page_size': 10,
        'status': 'pending,completed,callback',  # Optional: filter by status
        'search': ''  # Optional: search in name or email
    }
    
    print("Testing Filtered Sales API Endpoint")
    print("=" * 50)
    print(f"URL: {API_ENDPOINT}")
    print(f"Parameters: {json.dumps(params, indent=2)}")
    print()
    
    try:
        # Make the API request with authentication
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        response = requests.get(API_ENDPOINT, params=params, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Response:")
            print(json.dumps(data, indent=2))
            
            # Validate response structure
            required_fields = ['results', 'total_count', 'page', 'page_size', 'total_pages']
            for field in required_fields:
                if field in data:
                    print(f"✅ {field}: {data[field]}")
                else:
                    print(f"❌ Missing field: {field}")
            
            # Validate results structure
            if 'results' in data and isinstance(data['results'], list):
                print(f"✅ Found {len(data['results'])} sales records")
                if data['results']:
                    first_result = data['results'][0]
                    required_result_fields = ['date', 'name', 'email', 'number', 'status']
                    for field in required_result_fields:
                        if field in first_result:
                            print(f"✅ Result field '{field}': {first_result[field]}")
                        else:
                            print(f"❌ Missing result field: {field}")
            else:
                print("❌ Results field is missing or not a list")
                
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

def test_without_required_params():
    """Test the API without required parameters to verify validation."""
    print("\n" + "=" * 50)
    print("Testing API without required parameters")
    print("=" * 50)
    
    # Test without campaign_id
    params = {
        'start_date': '2024-01-01',
        'end_date': '2024-01-31'
    }
    
    try:
        response = requests.get(API_ENDPOINT, params=params)
        print(f"Status Code (without campaign_id): {response.status_code}")
        if response.status_code == 400:
            print("✅ Correctly returned 400 for missing campaign_id")
            print(f"Error message: {response.json()}")
        else:
            print("❌ Expected 400 but got different status code")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request Error: {e}")

if __name__ == "__main__":
    test_filtered_sales_api()
    test_without_required_params() 