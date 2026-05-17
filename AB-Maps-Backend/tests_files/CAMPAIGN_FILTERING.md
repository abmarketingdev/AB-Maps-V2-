# Campaign Filtering Implementation

## Overview

This implementation adds campaign-based filtering to the areas API (`GET /api/areas/areas/`) so that only areas belonging to the current campaign are shown. This ensures that managers and employees only see areas relevant to their current campaign context.

## Implementation Details

### Backend Changes

#### 1. Modified `areas/views.py`

**File**: `be_files/backend/areas/views.py`

**Changes Made**:

1. **Enhanced `get_queryset` Method**: Added campaign filtering logic
2. **Header Parsing**: Handles both UUID strings and JSON objects in `X-Campaign-ID` header
3. **Campaign Filtering**: Uses `CampaignArea` relationship to filter areas
4. **Logging**: Added comprehensive logging for debugging
5. **Error Handling**: Graceful handling of invalid campaign IDs

### How It Works

#### **1. Campaign ID Extraction**
```python
# Get campaign_id from headers
campaign_id = self.request.headers.get('X-Campaign-ID')

# Handle both UUID strings and JSON objects
if campaign_id.startswith('{'):
    # It's a JSON object, extract the ID
    campaign_data = json.loads(campaign_id)
    campaign_id = campaign_data.get('id')
```

#### **2. Area Filtering**
```python
# Filter areas to only show those belonging to the current campaign
campaign_areas = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
queryset = queryset.filter(id__in=campaign_areas)
```

#### **3. User-Specific Filtering**
- **Managers**: Can see all areas in their current campaign
- **Employees**: Can only see areas they're assigned to within the campaign
- **Others**: No access to areas

### API Behavior

#### **With Campaign ID Header**
- **Request**: `GET /api/areas/areas/` with `X-Campaign-ID: <campaign_id>`
- **Response**: Only areas belonging to the specified campaign
- **Logging**: Shows number of areas found for the campaign

#### **Without Campaign ID Header**
- **Request**: `GET /api/areas/areas/` without `X-Campaign-ID`
- **Response**: All areas (legacy behavior for backward compatibility)
- **Logging**: Indicates no campaign filtering applied

### Frontend Integration

The frontend should send the campaign ID in the `X-Campaign-ID` header:

```javascript
// Example: Sending campaign ID in headers
const headers = {
  'Authorization': `Bearer ${token}`,
  'X-Campaign-ID': campaignId, // Just the UUID, not the full object
  'Content-Type': 'application/json'
};

fetch('/api/areas/areas/', { headers })
```

### Benefits

1. **Campaign Isolation**: Each campaign's areas are completely isolated
2. **Security**: Users can only see areas relevant to their current campaign
3. **Performance**: Reduced data transfer by filtering at the database level
4. **Scalability**: Supports multiple campaigns without data leakage
5. **Backward Compatibility**: Still works without campaign ID header

### Testing

Use the test script to verify functionality:
```bash
python test_campaign_filtering.py
```

### Logging

The implementation includes comprehensive logging:
- Campaign ID extraction from headers
- Number of areas found for each campaign
- Error handling for invalid campaign IDs
- Legacy behavior when no campaign ID is provided

### Error Handling

- **Invalid JSON**: Returns empty result set
- **Invalid Campaign ID**: Returns empty result set
- **Missing Campaign**: Logs warning and returns empty result set
- **Database Errors**: Logs error and returns empty result set

This ensures the API remains stable even when campaign data is corrupted or missing. 