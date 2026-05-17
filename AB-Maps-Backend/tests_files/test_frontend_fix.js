/**
 * Test script to verify the frontend fix
 * Run this in the browser console to test the sales API integration
 */

async function testFrontendFix() {
  console.log('🧪 Testing Frontend Fix...');
  
  // Test 1: Check if "Norsk Folkehjelp" is selected by default
  console.log('\n📋 Test 1: Checking default campaign selection');
  const selectedCampaign = localStorage.getItem('selectedCampaign');
  console.log('Selected campaign from localStorage:', selectedCampaign);
  
  if (selectedCampaign) {
    try {
      const campaign = JSON.parse(selectedCampaign);
      console.log('Parsed campaign:', campaign);
      console.log('Campaign ID:', campaign.id);
      console.log('Campaign Name:', campaign.name);
      
      if (campaign.name === 'Norsk Folkehjelp') {
        console.log('✅ Correct campaign selected!');
      } else {
        console.log('❌ Wrong campaign selected. Expected: Norsk Folkehjelp, Got:', campaign.name);
      }
    } catch (error) {
      console.error('Error parsing campaign:', error);
    }
  } else {
    console.log('❌ No campaign selected in localStorage');
  }
  
  // Test 2: Test API call with the selected campaign
  console.log('\n🌐 Test 2: Testing API call with selected campaign');
  
  const campaignId = selectedCampaign ? JSON.parse(selectedCampaign).id : null;
  
  if (!campaignId) {
    console.log('❌ No campaign ID available');
    return;
  }
  
  const params = new URLSearchParams({
    campaign_id: campaignId,
    page: '1',
    page_size: '50',
    status: 'pending,completed,callback'
  });
  
  const url = `http://localhost:8000/api/dashboard/sales/filtered/?${params.toString()}`;
  console.log('API URL:', url);
  
  try {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', data);
      console.log('Total results:', data.total_count);
      console.log('Results count:', data.results?.length || 0);
      
      if (data.total_count > 0) {
        console.log('✅ SUCCESS: Data is being returned!');
        console.log('First result:', data.results[0]);
      } else {
        console.log('❌ No data returned for this campaign');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
  }
  
  // Test 3: Test with NGO Campaign (should return no data)
  console.log('\n🔧 Test 3: Testing with NGO Campaign (should return no data)');
  
  const ngoParams = new URLSearchParams({
    campaign_id: 'c333b56c-a938-41bc-9387-4592c8548b95', // NGO Campaign
    page: '1',
    page_size: '50',
    status: 'pending,completed,callback'
  });
  
  const ngoUrl = `http://localhost:8000/api/dashboard/sales/filtered/?${ngoParams.toString()}`;
  console.log('NGO Campaign API URL:', ngoUrl);
  
  try {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const ngoResponse = await fetch(ngoUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('NGO response status:', ngoResponse.status);
    
    if (ngoResponse.ok) {
      const ngoData = await ngoResponse.json();
      console.log('NGO Campaign API Response:', ngoData);
      console.log('NGO Campaign total results:', ngoData.total_count);
      
      if (ngoData.total_count === 0) {
        console.log('✅ Expected: NGO Campaign has no data');
      } else {
        console.log('❌ Unexpected: NGO Campaign has data');
      }
    } else {
      const ngoErrorText = await ngoResponse.text();
      console.log('❌ NGO Campaign API Error:', ngoErrorText);
    }
  } catch (error) {
    console.error('❌ NGO Campaign fetch error:', error);
  }
}

// Run the test
testFrontendFix(); 