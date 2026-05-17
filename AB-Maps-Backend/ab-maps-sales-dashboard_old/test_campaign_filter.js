// Test script to verify campaign filter functionality
// This can be run in the browser console on the areas page

async function testCampaignFilter() {
  console.log('Testing Campaign Filter...');
  
  try {
    // Test fetchAllCampaigns function
    const { fetchAllCampaigns } = await import('./services/campaignService');
    const campaigns = await fetchAllCampaigns();
    
    console.log('All campaigns found:', campaigns.length);
    campaigns.forEach(campaign => {
      console.log(`- ${campaign.name} (ID: ${campaign.id})`);
    });
    
    // Test fetchCampaignsWithTeams function (for comparison)
    const { fetchCampaignsWithTeams } = await import('./services/campaignService');
    const myCampaigns = await fetchCampaignsWithTeams();
    
    console.log('\nMy campaigns found:', myCampaigns.length);
    myCampaigns.forEach(campaign => {
      console.log(`- ${campaign.name} (ID: ${campaign.id})`);
    });
    
    console.log('\n✅ Campaign filter test completed!');
    console.log(`All campaigns: ${campaigns.length}, My campaigns: ${myCampaigns.length}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCampaignFilter(); 