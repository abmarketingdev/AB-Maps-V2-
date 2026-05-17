# My Areas Campaign Filtering Implementation

## Overview

This implementation adds campaign-based filtering to the `my_areas` endpoint (`GET /api/areas/areas/my_areas/`) so that managers only see areas they created that belong to the current campaign from the `X-Campaign-ID` header.

## Implementation Details

### Backend Changes

#### 1. Modified `areas/views.py`

**File**: `be_files/backend/areas/views.py`

**Changes Made**:

1. **Enhanced `my_areas` Method**: Added campaign filtering logic
2. **Header Parsing**: Handles both UUID strings and JSON objects in `X-Campaign-ID` header
3. **Campaign Filtering**: Uses `CampaignArea` relationship to filter areas
4. **Logging**: Added comprehensive logging for debugging
5. **Error Handling**: Graceful handling of invalid campaign IDs

### How It Works

#### **1. Campaign ID Extraction**
```python
# Get campaign_id from headers
campaign_id = request.headers.get('X-Campaign-ID')

# Handle both UUID strings and JSON objects
if campaign_id.startswith('{'):
    # It's a JSON object, extract the ID
    campaign_data = json.loads(campaign_id)
    campaign_id = campaign_data.get('id')
```

#### **2. Area Filtering**
```python
# Start with areas created by the current manager
areas = Area.objects.filter(created_by=user.manager)

# Filter areas to only show those belonging to the current campaign
campaign_areas = CampaignArea.objects.filter(campaign_id=campaign_id).values_list('area_id', flat=True)
areas = areas.filter(id__in=campaign_areas)
```

### API Behavior

#### **With Campaign ID Header**
- **Request**: `GET /api/areas/areas/my_areas/` with `X-Campaign-ID: <campaign_id>`
- **Response**: Only areas created by the manager that belong to the specified campaign
- **Logging**: Shows number of areas found for the campaign

#### **Without Campaign ID Header**
- **Request**: `GET /api/areas/areas/my_areas/` without `X-Campaign-ID`
- **Response**: All areas created by the manager (legacy behavior for backward compatibility)
- **Logging**: Indicates no campaign filtering applied

### Frontend Integration

The frontend should send the campaign ID in the `X-Campaign-ID` header:

```javascript
// Example: Sending campaign ID in headers for my_areas endpoint
const headers = {
  'Authorization': `Bearer ${token}`,
  'X-Campaign-ID': campaignId, // Just the UUID, not the full object
  'Content-Type': 'application/json'
};

fetch('/api/areas/areas/my_areas/', { headers })
```

### Benefits

1. **Campaign Isolation**: Managers only see their areas relevant to the current campaign
2. **Security**: Ensures managers can't see their areas from other campaigns
3. **Performance**: Reduced data transfer by filtering at the database level
4. **Scalability**: Supports multiple campaigns without data leakage
5. **Backward Compatibility**: Still works without campaign ID header

### Testing

Use the test script to verify functionality:
```bash
python test_my_areas_filtering.py
```

### Logging

The implementation includes comprehensive logging:
- Campaign ID extraction from headers
- Number of areas found for each campaign
- Error handling for invalid campaign IDs
- Legacy behavior when no campaign ID is provided

### Error Handling

- **Invalid JSON**: Returns 400 Bad Request with error message
- **Invalid Campaign ID**: Returns 400 Bad Request with error message
- **Missing Campaign**: Returns 400 Bad Request with error message
- **Database Errors**: Returns 500 Internal Server Error with error message

### Comparison with Main Areas Endpoint

| Feature | Main Areas Endpoint | My Areas Endpoint |
|---------|-------------------|------------------|
| **Base Filter** | All areas | Areas created by current manager |
| **Campaign Filter** | All areas in campaign | Manager's areas in campaign |
| **Permission** | Managers and employees | Managers only |
| **Use Case** | View all areas in campaign | View manager's areas in campaign |

This ensures that the `my_areas` endpoint provides campaign-specific filtering while maintaining the security boundary that managers can only see their own areas. 