#!/usr/bin/env python3
"""
Test script for the updated filtered sales API
"""
import requests
import json
from datetime import datetime, timedelta

# Configuration
API_BASE_URL = "http://localhost:8000"
AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzM0NzI5NjAwLCJpYXQiOjE3MzQ3MjYwMDAsImp0aSI6IjEyMzQ1Njc4OTAiLCJ1c2VyX2lkIjoiYWFhMDkwOGItN2RkNS00ZTQ0LWE1ODgtM2EwNzcwZjQ2ZTQwIn0.test_signature"

def test_updated_filtered_sales_api():
    """Test the updated filtered sales API with comprehensive data"""
    
    # Get today's date
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Test parameters
    params = {
        'campaign_id': '550e8400-e29b-41d4-a716-446655440000',  # Use a real campaign ID
        'start_date': today,
        'end_date': today,
        'page': 1,
        'page_size': 5
    }
    
    headers = {
        'Authorization': f'Bearer {AUTH_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    try:
        print("🧪 Testing Updated Filtered Sales API...")
        print(f"📅 Date: {today}")
        print(f"🎯 Campaign ID: {params['campaign_id']}")
        print()
        
        # Make the API call
        response = requests.get(
            f"{API_BASE_URL}/api/dashboard/sales/filtered/",
            params=params,
            headers=headers
        )
        
        print(f"📡 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ API call successful!")
            print()
            
            # Check response structure
            print("📊 Response Structure:")
            print(f"   - Total Count: {data.get('total_count', 'N/A')}")
            print(f"   - Page: {data.get('page', 'N/A')}")
            print(f"   - Page Size: {data.get('page_size', 'N/A')}")
            print(f"   - Total Pages: {data.get('total_pages', 'N/A')}")
            print(f"   - Results Count: {len(data.get('results', []))}")
            print()
            
            # Check if results exist
            results = data.get('results', [])
            if results:
                print("🎉 COMPREHENSIVE DATA FOUND!")
                print()
                
                # Show first result with all fields
                first_result = results[0]
                print("📋 First Sales Record (All Fields):")
                print(f"   - ID: {first_result.get('id', 'N/A')}")
                print(f"   - Date: {first_result.get('date', 'N/A')}")
                print(f"   - Name: {first_result.get('name', 'N/A')}")
                print(f"   - Email: {first_result.get('email', 'N/A')}")
                print(f"   - Number: {first_result.get('number', 'N/A')}")
                print(f"   - Status: {first_result.get('status', 'N/A')}")
                print(f"   - Outcome: {first_result.get('outcome', 'N/A')}")
                print(f"   - Value: {first_result.get('value', 'N/A')}")
                print(f"   - Commission: {first_result.get('commission', 'N/A')}")
                print(f"   - Notes: {first_result.get('notes', 'N/A')}")
                print(f"   - Campaign: {first_result.get('campaign', 'N/A')}")
                print(f"   - Campaign ID: {first_result.get('campaign_id', 'N/A')}")
                print(f"   - Employee Name: {first_result.get('employee_name', 'N/A')}")
                print(f"   - Employee ID: {first_result.get('employee_id', 'N/A')}")
                print(f"   - Manager Name: {first_result.get('manager_name', 'N/A')}")
                print(f"   - Manager ID: {first_result.get('manager_id', 'N/A')}")
                print(f"   - Area Name: {first_result.get('area_name', 'N/A')}")
                print(f"   - Area ID: {first_result.get('area_id', 'N/A')}")
                print(f"   - Completed At: {first_result.get('completed_at', 'N/A')}")
                print(f"   - Metadata: {first_result.get('metadata', 'N/A')}")
                print()
                
                # Check if all required fields are present
                required_fields = [
                    'id', 'date', 'name', 'email', 'number', 'status',
                    'outcome', 'value', 'commission', 'notes', 'campaign',
                    'campaign_id', 'employee_name', 'employee_id',
                    'manager_name', 'manager_id', 'area_name', 'area_id',
                    'completed_at', 'metadata'
                ]
                
                missing_fields = []
                for field in required_fields:
                    if field not in first_result:
                        missing_fields.append(field)
                
                if missing_fields:
                    print("❌ Missing Fields:")
                    for field in missing_fields:
                        print(f"   - {field}")
                else:
                    print("✅ All required fields are present!")
                
            else:
                print("⚠️  No sales data found for the specified criteria")
                print("   This might be normal if there are no sales for today")
                
        else:
            print("❌ API call failed!")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Make sure the Django server is running on port 8000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_updated_filtered_sales_api() 