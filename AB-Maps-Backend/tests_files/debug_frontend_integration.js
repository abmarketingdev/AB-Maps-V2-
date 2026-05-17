/**
 * Debug script to test frontend integration
 * Run this in the browser console to debug the sales API integration
 */

// Test the API directly with the same parameters the frontend should be using
async function debugFrontendIntegration() {
  console.log('🔍 Debugging Frontend Integration...');
  
  // Test 1: Check localStorage for campaign
  console.log('\n📋 Test 1: Checking localStorage for campaign');
  const selectedCampaign = localStorage.getItem('selectedCampaign');
  console.log('Selected campaign from localStorage:', selectedCampaign);
  
  if (selectedCampaign) {
    try {
      const campaign = JSON.parse(selectedCampaign);
      console.log('Parsed campaign:', campaign);
      console.log('Campaign ID:', campaign.id);
      console.log('Campaign Name:', campaign.name);
    } catch (error) {
      console.error('Error parsing campaign:', error);
    }
  } else {
    console.log('❌ No campaign selected in localStorage');
  }
  
  // Test 2: Check authentication
  console.log('\n🔐 Test 2: Checking authentication');
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  console.log('Auth token exists:', !!token);
  if (token) {
    console.log('Token preview:', token.substring(0, 50) + '...');
  }
  
  // Test 3: Test API call with current frontend parameters
  console.log('\n🌐 Test 3: Testing API call with frontend parameters');
  
  const campaignId = selectedCampaign ? JSON.parse(selectedCampaign).id : null;
  const startDate = '2025-07-20';
  const endDate = '2025-07-20';
  
  if (!campaignId) {
    console.log('❌ No campaign ID available');
    return;
  }
  
  const params = new URLSearchParams({
    campaign_id: campaignId,
    start_date: startDate,
    end_date: endDate,
    page: '1',
    page_size: '50',
    status: 'pending,completed,callback'
  });
  
  const url = `http://localhost:8000/api/dashboard/sales/filtered/?${params.toString()}`;
  console.log('API URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', data);
      console.log('Total results:', data.total_count);
      console.log('Results count:', data.results?.length || 0);
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
  }
  
  // Test 4: Test with known working campaign ID
  console.log('\n🔧 Test 4: Testing with known working campaign ID');
  
  const workingParams = new URLSearchParams({
    campaign_id: '6f0c3353-c04f-44a5-8b83-9fc376e3db54', // Norsk Folkehjelp
    start_date: startDate,
    end_date: endDate,
    page: '1',
    page_size: '50',
    status: 'pending,completed,callback'
  });
  
  const workingUrl = `http://localhost:8000/api/dashboard/sales/filtered/?${workingParams.toString()}`;
  console.log('Working API URL:', workingUrl);
  
  try {
    const workingResponse = await fetch(workingUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Working response status:', workingResponse.status);
    
    if (workingResponse.ok) {
      const workingData = await workingResponse.json();
      console.log('✅ Working API Response:', workingData);
      console.log('Working total results:', workingData.total_count);
    } else {
      const workingErrorText = await workingResponse.text();
      console.log('❌ Working API Error:', workingErrorText);
    }
  } catch (error) {
    console.error('❌ Working fetch error:', error);
  }
}

// Run the debug function
debugFrontendIntegration(); 