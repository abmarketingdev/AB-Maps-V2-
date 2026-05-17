#!/usr/bin/env python3
"""
Test script to verify the new campaign_areas endpoint works correctly
"""
import requests
import json
import sys

# Configuration
API_BASE = "http://localhost:8000"
CAMPAIGN_AREAS_ENDPOINT = f"{API_BASE}/api/areas/areas/campaign_areas/"

def test_campaign_areas_endpoint():
    """Test the campaign_areas endpoint with different scenarios"""
    
    print("Testing campaign_areas endpoint...")
    print("=" * 50)
    
    # Test 1: No authentication
    print("\n1. Testing without authentication (should fail)")
    try:
        response = requests.get(CAMPAIGN_AREAS_ENDPOINT)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 2: No campaign_id header
    print("\n2. Testing without X-Campaign-ID header (should fail)")
    try:
        headers = {
            'Authorization': 'Bearer your_token_here',
            'Content-Type': 'application/json'
        }
        response = requests.get(CAMPAIGN_AREAS_ENDPOINT, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 3: Invalid campaign_id
    print("\n3. Testing with invalid campaign_id (should fail)")
    try:
        headers = {
            'Authorization': 'Bearer your_token_here',
            'X-Campaign-ID': 'invalid-uuid',
            'Content-Type': 'application/json'
        }
        response = requests.get(CAMPAIGN_AREAS_ENDPOINT, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Test 4: Valid campaign_id (you'll need to replace with actual values)
    print("\n4. Testing with valid campaign_id (replace with actual values)")
    print("To test this properly, you need:")
    print("- A valid JWT token")
    print("- A valid campaign ID")
    print("- Areas assigned to that campaign")
    
    campaign_id = input("Enter a valid campaign ID (or press Enter to skip): ").strip()
    if campaign_id:
        token = input("Enter a valid JWT token: ").strip()
        if token:
            try:
                headers = {
                    'Authorization': f'Bearer {token}',
                    'X-Campaign-ID': campaign_id,
                    'Content-Type': 'application/json'
                }
                response = requests.get(CAMPAIGN_AREAS_ENDPOINT, headers=headers)
                print(f"Status: {response.status_code}")
                if response.status_code == 200:
                    data = response.json()
                    print(f"Found {len(data)} areas for campaign {campaign_id}")
                    for area in data:
                        print(f"  - {area.get('name', 'Unknown')} (ID: {area.get('id', 'Unknown')})")
                else:
                    print(f"Response: {response.text}")
            except Exception as e:
                print(f"Error: {e}")
    
    print("\n" + "=" * 50)
    print("Test completed!")

if __name__ == "__main__":
    test_campaign_areas_endpoint() 