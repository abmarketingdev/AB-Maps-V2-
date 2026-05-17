/**
 * Complete Workflow Test Script
 * Tests the entire workflow: Login → Campaign Selection → Salg Page → Campaign Filtering
 */

async function testCompleteWorkflow() {
  console.log('🚀 Testing Complete Workflow...');
  
  // Test 1: Check localStorage campaign selection
  console.log('\n📋 Test 1: Checking localStorage campaign selection');
  const selectedCampaign = localStorage.getItem('selectedCampaign');
  console.log('Selected campaign from localStorage:', selectedCampaign);
  
  if (selectedCampaign) {
    try {
      const campaign = JSON.parse(selectedCampaign);
      console.log('✅ Campaign found in localStorage:');
      console.log('- ID:', campaign.id);
      console.log('- Name:', campaign.name);
      
      // Verify it's the expected campaign
      if (campaign.name === 'NGO Campaign') {
        console.log('✅ Correct campaign selected in localStorage!');
      } else {
        console.log('⚠️  Different campaign selected:', campaign.name);
      }
    } catch (error) {
      console.error('❌ Error parsing campaign:', error);
    }
  } else {
    console.log('❌ No campaign selected in localStorage');
  }
  
  // Test 2: Test activities API with localStorage campaign
  console.log('\n🌐 Test 2: Testing activities API with localStorage campaign');
  
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
      console.log('✅ Activities API Response:');
      console.log('- Total activities:', data.total_count);
      console.log('- Results count:', data.results?.length || 0);
      console.log('- Page:', data.page);
      console.log('- Total pages:', data.total_pages);
      
      if (data.total_count > 0) {
        console.log('✅ SUCCESS: Activities data is being returned!');
        console.log('First activity sample:', data.results[0]);
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
  
  // Test 3: Test campaign filtering (simulate changing campaign)
  console.log('\n🔄 Test 3: Testing campaign filtering');
  
  // Get all available campaigns first
  try {
    const campaignsResponse = await fetch('http://localhost:8000/api/campaigns/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('token')}`
      }
    });
    
    if (campaignsResponse.ok) {
      const campaigns = await campaignsResponse.json();
      console.log('Available campaigns:', campaigns.map(c => ({ id: c.id, name: c.name })));
      
      // Test filtering with a different campaign (if available)
      if (campaigns.length > 1) {
        const differentCampaign = campaigns.find(c => c.name !== 'NGO Campaign');
        if (differentCampaign) {
          console.log(`Testing filter with different campaign: ${differentCampaign.name}`);
          
          const filterParams = new URLSearchParams({
            campaign_id: differentCampaign.id,
            page: '1',
            page_size: '50'
          });
          
          const filterUrl = `http://localhost:8000/api/dashboard/activities/filtered/?${filterParams.toString()}`;
          
          const filterResponse = await fetch(filterUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('token')}`
            }
          });
          
          if (filterResponse.ok) {
            const filterData = await filterResponse.json();
            console.log(`✅ Filtered results for ${differentCampaign.name}:`, filterData.total_count, 'activities');
          } else {
            console.log('❌ Filter API Error');
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Campaigns fetch error:', error);
  }
  
  // Test 4: Test search functionality
  console.log('\n🔍 Test 4: Testing search functionality');
  
  const searchParams = new URLSearchParams({
    campaign_id: campaignId,
    search: 'Dana',
    page: '1',
    page_size: '50'
  });
  
  const searchUrl = `http://localhost:8000/api/dashboard/activities/filtered/?${searchParams.toString()}`;
  
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
      console.log('✅ Search results for "Dana":', searchData.total_count, 'activities found');
      
      if (searchData.total_count > 0) {
        console.log('Sample search result:', searchData.results[0]);
      }
    } else {
      console.log('❌ Search API Error');
    }
  } catch (error) {
    console.error('❌ Search fetch error:', error);
  }
  
  // Test 5: Test date filtering
  console.log('\n📅 Test 5: Testing date filtering');
  
  const dateParams = new URLSearchParams({
    campaign_id: campaignId,
    start_date: '2025-07-20',
    end_date: '2025-07-20',
    page: '1',
    page_size: '50'
  });
  
  const dateUrl = `http://localhost:8000/api/dashboard/activities/filtered/?${dateParams.toString()}`;
  
  try {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const dateResponse = await fetch(dateUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (dateResponse.ok) {
      const dateData = await dateResponse.json();
      console.log('✅ Date filtered results (2025-07-20):', dateData.total_count, 'activities found');
    } else {
      console.log('❌ Date filter API Error');
    }
  } catch (error) {
    console.error('❌ Date filter fetch error:', error);
  }
  
  // Test 6: Frontend integration verification
  console.log('\n🎨 Test 6: Frontend Integration Verification');
  console.log('To verify the complete workflow:');
  console.log('1. ✅ Login and select "NGO Campaign" in campaign selector');
  console.log('2. ✅ Navigate to "Salg" page');
  console.log('3. ✅ Verify "NGO Campaign" is selected in the filter dropdown');
  console.log('4. ✅ Verify 9 activities are displayed in the table');
  console.log('5. ✅ Test changing campaign in the filter dropdown - should immediately show new data');
  console.log('6. ✅ Test search by typing "Dana" - should filter to 2 results');
  console.log('7. ✅ Test date filtering by selecting 2025-07-20 - should show activities for that date');
  console.log('8. ✅ Verify pagination shows correct counts');
  console.log('9. ✅ Test "Alle Kampanjer" option - should reset to localStorage campaign');
  
  console.log('\n🎯 Expected Behavior:');
  console.log('- Campaign filter takes precedence over localStorage when changed');
  console.log('- Changes are immediate (no page refresh needed)');
  console.log('- All filtering options work: campaign, search, date range');
  console.log('- Table displays correct data structure with 7 columns');
  console.log('- Status badges show correct colors for outcomes');
}

// Run the complete workflow test
testCompleteWorkflow(); 