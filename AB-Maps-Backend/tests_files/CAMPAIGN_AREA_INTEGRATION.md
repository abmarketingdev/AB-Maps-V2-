# Campaign-Area Integration

## Overview

This implementation automatically creates `CampaignArea` entries whenever a new area is created, linking areas to the current campaign from the frontend localStorage. This helps track all campaigns and sales by maintaining the relationship between campaigns and geographic areas.

## Implementation Details

### Backend Changes

#### 1. Modified `areas/views.py`

**File**: `be_files/backend/areas/views.py`

**Changes Made**:

1. **Import Statements**: Added imports for `CampaignArea` and `Campaign` models
2. **perform_create Method**: Enhanced to automatically create `CampaignArea` entries
3. **perform_destroy Method**: Added to automatically delete `CampaignArea` entries when areas are deleted
4. **Logging**: Added comprehensive logging for debugging and monitoring

#### 2. Key Features

- **Automatic Campaign Assignment**: When an area is created, it's automatically assigned to the current campaign
- **Header-based Campaign ID**: Uses `X-Campaign-ID` header from frontend requests
- **Error Handling**: Graceful handling of missing campaigns or other errors
- **Cascade Deletion**: When areas are deleted, associated `CampaignArea` entries are also deleted
- **Duplicate Prevention**: Uses `get_or_create` to prevent duplicate entries

### Frontend Integration

#### 1. Campaign ID Transmission

The frontend (`ab-maps-fe-manager`) automatically includes the campaign ID in API requests:

```javascript
// From areaService.js
const getAuthHeaders = () => {
  const token = authService.getAccessToken();
  const campaignId = authService.getCampaignId();
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
  
  // Add campaign_id to headers if available
  if (campaignId) {
    headers['X-Campaign-ID'] = campaignId;
  }
  
  return headers;
};
```

#### 2. Flow from Sales Dashboard

1. User navigates from sales dashboard to AB Maps with campaign details in URL
2. Campaign ID is stored in localStorage
3. When creating areas, the campaign ID is automatically included in API requests
4. Backend creates both the area and the campaign-area relationship

## API Endpoints

### Area Creation
- **Endpoint**: `POST /api/areas/areas/`
- **Headers**: `X-Campaign-ID: <campaign_uuid>`
- **Behavior**: Creates area + automatic `CampaignArea` entry

### Area Deletion
- **Endpoint**: `DELETE /api/areas/areas/{id}/`
- **Behavior**: Deletes area + all associated `CampaignArea` entries

## Database Schema

### CampaignArea Model
```python
class CampaignArea(models.Model):
    campaign = models.ForeignKey('Campaign', on_delete=models.CASCADE)
    area = models.ForeignKey('areas.Area', on_delete=models.CASCADE, db_column='area_id')
    
    class Meta:
        db_table = 'campaign_area'
        unique_together = ('campaign', 'area')
```

## Error Handling

### Campaign Not Found
- If the campaign ID in headers doesn't exist, the area is still created
- Warning is logged but operation continues
- This prevents area creation from failing due to invalid campaign IDs

### Database Errors
- All database operations are wrapped in try-catch blocks
- Errors are logged but don't prevent area creation/deletion
- This ensures the core functionality remains robust

## Logging

The implementation includes comprehensive logging:

- **Info Level**: Successful campaign-area assignments and deletions
- **Warning Level**: Missing campaigns or duplicate entries
- **Error Level**: Database errors or other exceptions

## Testing

### Manual Testing
1. Create a campaign in the sales dashboard
2. Navigate to AB Maps with the campaign ID
3. Create a new area
4. Verify that a `CampaignArea` entry is created in the database
5. Delete the area and verify the `CampaignArea` entry is also deleted

### Automated Testing
Run the test script:
```bash
cd be_files/backend
python test_campaign_area_integration.py
```

## Benefits

1. **Automatic Tracking**: All areas created in AB Maps are automatically linked to campaigns
2. **Sales Integration**: Enables tracking of sales performance by geographic areas
3. **Data Consistency**: Ensures no areas are orphaned without campaign associations
4. **Simplified Workflow**: No manual campaign assignment required
5. **Audit Trail**: Complete history of area-campaign relationships

## Future Enhancements

1. **Bulk Operations**: Support for bulk area creation with campaign assignment
2. **Campaign Validation**: Validate campaign existence before area creation
3. **Area Transfer**: Allow moving areas between campaigns
4. **Reporting**: Enhanced reporting based on campaign-area relationships 