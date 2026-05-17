/**
 * Test script to verify the frontend activities integration
 * Run this in the browser console to test the frontend
 */

async function testFrontendActivities() {
  console.log('🧪 Testing Frontend Activities Integration...');
  
  // Test 1: Check if NGO Campaign is selected by default
  console.log('\n📋 Test 1: Checking default campaign selection');
  const selectedCampaign = localStorage.getItem('selectedCampaign');
  console.log('Selected campaign from localStorage:', selectedCampaign);
  
  if (selectedCampaign) {
    try {
      const campaign = JSON.parse(selectedCampaign);
      console.log('Parsed campaign:', campaign);
      console.log('Campaign ID:', campaign.id);
      console.log('Campaign Name:', campaign.name);
      
      if (campaign.name === 'NGO Campaign') {
        console.log('✅ Correct campaign selected!');
      } else {
        console.log('❌ Wrong campaign selected. Expected: NGO Campaign, Got:', campaign.name);
      }
    } catch (error) {
      console.error('Error parsing campaign:', error);
    }
  } else {
    console.log('❌ No campaign selected in localStorage');
  }
  
  // Test 2: Test activities API call
  console.log('\n🌐 Test 2: Testing activities API call');
  
  const campaignId = selectedCampaign ? JSON.parse(selectedCampaign).id : null;
  
  if (!campaignId) {
    console.log('❌ No campaign ID available');
    return;
  }
  
  const params = new URLSearchParams({
    campaign_id: campaignId,
    page: '1',
    page_size: '50'
  });
  
  const url = `http://localhost:8000/api/dashboard/activities/filtered/?${params.toString()}`;
  console.log('Activities API URL:', url);
  
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
      console.log('✅ Activities API Response:', data);
      console.log('Total activities:', data.total_count);
      console.log('Results count:', data.results?.length || 0);
      
      if (data.total_count > 0) {
        console.log('✅ SUCCESS: Activities data is being returned!');
        console.log('First activity:', data.results[0]);
        
        // Test the data structure
        const firstActivity = data.results[0];
        console.log('Activity structure check:');
        console.log('- ID:', firstActivity.id);
        console.log('- Date:', firstActivity.date);
        console.log('- Name:', firstActivity.name);
        console.log('- Outcome:', firstActivity.outcome);
        console.log('- Campaign:', firstActivity.campaign);
        console.log('- Mobile:', firstActivity.mobile);
      } else {
        console.log('❌ No activities returned for this campaign');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
  }
  
  // Test 3: Test search functionality
  console.log('\n🔍 Test 3: Testing search functionality');
  
  const searchParams = new URLSearchParams({
    campaign_id: campaignId,
    search: 'Dana',
    page: '1',
    page_size: '50'
  });
  
  const searchUrl = `http://localhost:8000/api/dashboard/activities/filtered/?${searchParams.toString()}`;
  console.log('Search API URL:', searchUrl);
  
  try {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('✅ Search results:', searchData.total_count, 'activities found');
    } else {
      console.log('❌ Search API Error');
    }
  } catch (error) {
    console.error('❌ Search fetch error:', error);
  }
  
  // Test 4: Frontend integration check
  console.log('\n🎨 Test 4: Frontend Integration Check');
  console.log('To verify the frontend is working:');
  console.log('1. Refresh the page');
  console.log('2. Check if "NGO Campaign" is selected in the dropdown');
  console.log('3. Verify 9 activities are displayed in the table');
  console.log('4. Test the search box by typing "Dana"');
  console.log('5. Test date filtering by selecting dates');
  console.log('6. Check pagination shows "Viser 9 av 9 resultater"');
}

// Run the test
testFrontendActivities(); 