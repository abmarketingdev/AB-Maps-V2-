#!/usr/bin/env python3
"""
Test script for the new all_campaigns API endpoint.
"""
import requests
import json

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_all_campaigns_endpoint():
    """Test the all_campaigns endpoint."""
    
    # First, we need to get a JWT token by logging in as a manager
    # This is just a test - in real usage, you'd use actual credentials
    
    print("Testing all_campaigns API endpoint...")
    print("=" * 50)
    
    # Test the endpoint URL structure
    endpoint_url = f"{BASE_URL}/api/campaigns/campaigns/all_campaigns/"
    print(f"Endpoint URL: {endpoint_url}")
    
    # Test without authentication (should return 401)
    print("\n1. Testing without authentication...")
    try:
        response = requests.get(endpoint_url)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 401:
            print("✓ Correctly requires authentication")
        else:
            print(f"✗ Unexpected status code: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("✗ Could not connect to server. Make sure Django server is running on port 8000")
        return
    
    # Test with invalid authentication (should return 401)
    print("\n2. Testing with invalid authentication...")
    headers = {"Authorization": "Bearer invalid_token"}
    try:
        response = requests.get(endpoint_url, headers=headers)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 401:
            print("✓ Correctly rejects invalid tokens")
        else:
            print(f"✗ Unexpected status code: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("✗ Could not connect to server")
        return
    
    print("\n3. API Documentation should be available at:")
    print(f"   - Swagger UI: {BASE_URL}/swagger/")
    print(f"   - DRF Spectacular: {BASE_URL}/api/docs/")
    print(f"   - ReDoc: {BASE_URL}/redoc/")
    
    print("\n4. Expected endpoint behavior:")
    print("   - URL: GET /api/campaigns/campaigns/all_campaigns/")
    print("   - Authentication: Required (Manager only)")
    print("   - Query Parameters:")
    print("     * search: Search campaigns by name or description")
    print("     * ordering: Order by field (e.g., name, created_at, -created_at)")
    print("     * created_by: Filter by manager ID")
    print("   - Response: List of campaigns with created_by information")
    
    print("\n5. Example response format:")
    example_response = [
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "name": "Summer Campaign 2024",
            "description": "Campaign for summer sales",
            "created_at": "2024-01-15T10:30:00Z",
            "updated_at": "2024-01-15T10:30:00Z",
            "created_by": "John Doe",
            "created_by_id": "456e7890-e89b-12d3-a456-426614174001"
        }
    ]
    print(json.dumps(example_response, indent=2))
    
    print("\n" + "=" * 50)
    print("Test completed. To test with real authentication:")
    print("1. Start the Django server: python manage.py runserver")
    print("2. Login as a manager to get a JWT token")
    print("3. Use the token in Authorization header: Bearer <token>")
    print("4. Make GET request to the endpoint")

if __name__ == "__main__":
    test_all_campaigns_endpoint() 