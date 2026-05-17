#!/usr/bin/env python3
"""
Simple API test script for AB Maps backend.
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_endpoint(url, method="GET", data=None, expected_status=200):
    """Test an API endpoint."""
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{url}")
        elif method == "POST":
            response = requests.post(f"{BASE_URL}{url}", json=data)
        else:
            print(f"❌ Unsupported method: {method}")
            return False
        
        if response.status_code == expected_status:
            print(f"✅ {method} {url} - Status: {response.status_code}")
            return True
        else:
            print(f"❌ {method} {url} - Expected: {expected_status}, Got: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ {method} {url} - Error: {str(e)}")
        return False

def main():
    """Test all main API endpoints."""
    print("🧪 Testing AB Maps Backend API Endpoints\n")
    
    # Test basic endpoints
    endpoints = [
        ("/admin/", "GET", None, 200),  # Admin interface
        ("/api/schema/", "GET", None, 200),  # API schema
        ("/swagger/", "GET", None, 200),  # Swagger UI
        ("/redoc/", "GET", None, 200),  # ReDoc UI
        ("/api/docs/", "GET", None, 200),  # DRF Spectacular
    ]
    
    # Test API endpoints (should return 401 for unauthenticated requests)
    api_endpoints = [
        ("/api/auth/login/", "GET", None, 405),  # Method not allowed (POST only)
        ("/api/users/users/", "GET", None, 401),  # Unauthorized
        ("/api/areas/areas/", "GET", None, 401),  # Unauthorized
        ("/api/addresses/addresses/", "GET", None, 401),  # Unauthorized
        ("/api/tracking/locations/", "GET", None, 401),  # Unauthorized
        ("/api/teams/teams/", "GET", None, 401),  # Unauthorized
        ("/api/campaigns/campaigns/", "GET", None, 401),  # Unauthorized
    ]
    
    print("📋 Testing Basic Endpoints:")
    for url, method, data, expected in endpoints:
        test_endpoint(url, method, data, expected)
    
    print("\n🔐 Testing API Endpoints (Unauthorized Expected):")
    for url, method, data, expected in api_endpoints:
        test_endpoint(url, method, data, expected)
    
    print("\n🎉 API Testing Complete!")
    print("\n📖 Available Documentation:")
    print(f"   • Swagger UI: {BASE_URL}/swagger/")
    print(f"   • ReDoc: {BASE_URL}/redoc/")
    print(f"   • DRF Spectacular: {BASE_URL}/api/docs/")
    print(f"   • API Schema: {BASE_URL}/api/schema/")
    
    print("\n🔗 WebSocket Endpoints:")
    print(f"   • Location Tracking: ws://localhost:8000/ws/tracking/")
    print(f"   • Manager Dashboard: ws://localhost:8000/ws/tracking/dashboard/")

if __name__ == "__main__":
    main() 