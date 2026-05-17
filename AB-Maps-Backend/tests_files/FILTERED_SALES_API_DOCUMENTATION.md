# Filtered Sales API Documentation

## Overview

The Filtered Sales API endpoint provides sales data filtered by campaign and date range, specifically designed for the manager dashboard. It returns data in the exact format needed for the sales table display.

## Endpoint

```
GET /api/dashboard/sales/filtered/
```

## Authentication

This endpoint requires authentication. Users must be logged in and have appropriate permissions:
- **Managers**: Can access all sales data
- **Employees**: Can only access their own sales data

## Required Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `campaign_id` | string | Campaign ID to filter by (from localStorage) | `"550e8400-e29b-41d4-a716-446655440000"` |
| `start_date` | string | Start date in YYYY-MM-DD format | `"2024-03-01"` |
| `end_date` | string | End date in YYYY-MM-DD format | `"2024-03-31"` |

## Optional Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Filter by status (comma-separated) | `"pending,completed"` |
| `search` | string | Search in contact name or email | `"john"` |
| `page` | integer | Page number (default: 1) | `1` |
| `page_size` | integer | Items per page (default: 50) | `25` |

## Response Format

### Success Response (200)

```json
{
  "results": [
    {
      "date": "10. Mar 23:35",
      "name": "Dana Barzinje",
      "email": "dana@example.com",
      "number": "48631833",
      "status": "Venter"
    },
    {
      "date": "10. Mar 22:15",
      "name": "John Smith",
      "email": "john@example.com",
      "number": "48631834",
      "status": "Fullført"
    }
  ],
  "total_count": 2,
  "page": 1,
  "page_size": 50,
  "total_pages": 1
}
```

### Error Response (400)

```json
{
  "error": "campaign_id is required"
}
```

## Status Mapping

The API automatically maps internal status values to Norwegian display names:

| Internal Status | Display Name |
|-----------------|--------------|
| `pending` | `Venter` |
| `completed` | `Fullført` |
| `cancelled` | `Kansellert` |
| `callback` | `Tilbakeringing` |
| `no_answer` | `Ingen Svar` |

## Example Usage

### JavaScript/Frontend

```javascript
// Get campaign ID from localStorage
const campaignId = localStorage.getItem('selectedCampaignId');

// Set date range (last 30 days)
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);

// Format dates
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Make API request
const response = await fetch(`/api/dashboard/sales/filtered/?` + new URLSearchParams({
  campaign_id: campaignId,
  start_date: formatDate(startDate),
  end_date: formatDate(endDate),
  page: 1,
  page_size: 50,
  status: 'pending,completed,callback'
}));

const data = await response.json();

if (response.ok) {
  // Process the sales data
  console.log(`Found ${data.total_count} sales records`);
  data.results.forEach(sale => {
    console.log(`${sale.date} - ${sale.name} (${sale.status})`);
  });
} else {
  console.error('API Error:', data.error);
}
```

### Python/Backend Testing

```python
import requests

params = {
    'campaign_id': 'your-campaign-id',
    'start_date': '2024-03-01',
    'end_date': '2024-03-31',
    'page': 1,
    'page_size': 25,
    'status': 'pending,completed',
    'search': 'john'
}

response = requests.get('http://localhost:8000/api/dashboard/sales/filtered/', params=params)
data = response.json()

print(f"Total sales: {data['total_count']}")
for sale in data['results']:
    print(f"{sale['date']} - {sale['name']} ({sale['status']})")
```

## Integration with Frontend

### 1. Campaign Selection

The campaign ID should be retrieved from localStorage where it's stored when the manager selects a campaign:

```javascript
const selectedCampaign = JSON.parse(localStorage.getItem('selectedCampaign'));
const campaignId = selectedCampaign?.id;
```

### 2. Date Range Selection

The date range should be set by the manager through the date picker components in the UI:

```javascript
const dateRange = {
  startDate: '2024-03-01',
  endDate: '2024-03-31'
};
```

### 3. Status Filtering

The status filter can be applied based on the "Vis påbegynte" checkbox and other UI controls:

```javascript
const statusFilter = showStarted ? 'pending,completed,callback' : 'completed';
```

### 4. Search Functionality

The search parameter can be used with the "Søk kontakter..." input field:

```javascript
const searchQuery = document.getElementById('search-input').value;
```

## Pagination

The API supports pagination with the following parameters:
- `page`: Current page number (1-based)
- `page_size`: Number of items per page
- Response includes `total_pages` for navigation

## Error Handling

Common error scenarios and their responses:

1. **Missing Required Parameters**
   ```json
   {"error": "campaign_id is required"}
   {"error": "start_date is required"}
   {"error": "end_date is required"}
   ```

2. **Invalid Date Format**
   ```json
   {"error": "Invalid date format. Use YYYY-MM-DD"}
   ```

3. **Authentication Required**
   ```json
   {"detail": "Authentication credentials were not provided."}
   ```

## Performance Considerations

- The API uses database indexes on `campaign_id`, `created_at`, and `status` fields
- Pagination is implemented to handle large datasets efficiently
- Search queries use case-insensitive matching
- Date range filtering is optimized with proper datetime handling

## Testing

Use the provided test script to verify the API functionality:

```bash
python test_filtered_sales_api.py
```

Make sure to:
1. Start the Django development server
2. Replace the test campaign ID with a real one from your database
3. Verify that the response structure matches the expected format 