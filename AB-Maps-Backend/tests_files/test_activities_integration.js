/**
 * Test script to verify the activities integration
 * Run this in the browser console to test the activities API integration
 */

async function testActivitiesIntegration() {
  console.log('🧪 Testing Activities Integration...');
  
  // Test 1: Check if activities API returns data for NGO Campaign
  console.log('\n📋 Test 1: Testing activities API with NGO Campaign');
  
  const params = new URLSearchParams({
    campaign_id: 'c333b56c-a938-41bc-9387-4592c8548b95', // NGO Campaign
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
  
  // Test 2: Check localStorage campaign selection
  console.log('\n🔧 Test 2: Checking localStorage campaign selection');
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
    console.log('No campaign selected in localStorage');
  }
  
  // Test 3: Test frontend integration
  console.log('\n🌐 Test 3: Testing frontend integration');
  console.log('To test the frontend:');
  console.log('1. Refresh the page');
  console.log('2. Check if activities are displayed in the table');
  console.log('3. Verify the pagination shows correct counts');
  console.log('4. Test filtering by date range');
  console.log('5. Test search functionality');
}

// Run the test
testActivitiesIntegration(); 