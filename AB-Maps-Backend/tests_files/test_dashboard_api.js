// Test script to verify dashboard API endpoint
const API_BASE_URL = 'http://localhost:8000';

async function testDashboardAPI() {
  try {
    // Test the activities summary endpoint
    const url = `${API_BASE_URL}/api/dashboard/activities/summary/?campaign_id=test-campaign-id&include_trends=true`;
    
    console.log('Testing URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail without proper authentication, but we can see if the endpoint exists
      },
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('Response data:', data);
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Test if the backend is running
async function testBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/`);
    console.log('Backend health check status:', response.status);
  } catch (error) {
    console.error('Backend not reachable:', error.message);
  }
}

console.log('Testing Dashboard API...');
testBackendHealth().then(() => {
  testDashboardAPI();
}); 