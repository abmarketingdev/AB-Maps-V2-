# Uploaded Addresses Feature

This Django app provides functionality for uploading addresses via CSV files and automatically geocoding them using the OpenStreetMap Nominatim API.

## Features

- 📁 **CSV Upload**: Upload address lists via CSV files
- 🌍 **Automatic Geocoding**: Convert addresses to coordinates using Nominatim API
- 🔄 **Background Processing**: Asynchronous geocoding using Celery
- 🔐 **JWT Authentication**: Secure API endpoints with JWT tokens
- 📊 **Admin Interface**: Full Django admin integration with custom filters
- 🔄 **Retry Mechanism**: Automatic retry for failed geocoding attempts
- 📈 **Progress Tracking**: Monitor geocoding status and progress

## API Endpoints

### Upload CSV File
```
POST /api/uploaded-addresses/upload-csv/
```

**Request:**
- Content-Type: `multipart/form-data`
- Parameters:
  - `file`: CSV file (must have 'address' column)
  - `campaign_id`: UUID of the campaign

**Response:**
```json
{
  "message": "Successfully uploaded 3 addresses",
  "created_count": 3,
  "failed_count": 0,
  "failed_rows": [],
  "addresses": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "address_text": "123 Main Street, Oslo",
      "latitude": null,
      "longitude": null,
      "added_at": "2024-01-15T10:30:00Z",
      "geocoded_at": null,
      "is_geocoded": false,
      "coordinates": null,
      "manager": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "John Manager",
        "email": "john@example.com"
      },
      "campaign": {
        "id": "789e0123-e89b-12d3-a456-426614174002",
        "name": "Test Campaign",
        "description": "Test campaign description"
      }
    }
  ]
}
```

### List Uploaded Addresses
```
GET /api/uploaded-addresses/
```

**Query Parameters:**
- `campaign_id`: Filter by campaign ID
- `manager_id`: Filter by manager ID
- `geocoded`: Filter by geocoding status (true/false)

**Response:**
```json
[
  {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "address_text": "123 Main Street, Oslo",
    "latitude": 59.911377,
    "longitude": 10.749404,
    "added_at": "2024-01-15T10:30:00Z",
    "geocoded_at": "2024-01-15T10:31:00Z",
    "is_geocoded": true,
    "coordinates": [59.911377, 10.749404],
    "manager": {...},
    "campaign": {...}
  }
]
```

### Retry Geocoding
```
POST /api/uploaded-addresses/{id}/retry-geocoding/
```

**Response:**
```json
{
  "message": "Geocoding task triggered successfully",
  "address_id": "456e7890-e89b-12d3-a456-426614174001"
}
```

## CSV Format

The CSV file must contain these columns: `street`, `postal_code`, `city`, `country`. The system will automatically merge them into OSM format for geocoding.

```csv
street,postal_code,city,country
Karl Johans gate 1,0154,Oslo,Norway
Aker Brygge 1,0250,Oslo,Norway
Vigelandsparken,0268,Oslo,Norway
```

**Required fields:**
- `street`: Street address (required)
- `city`: City name (required)
- `postal_code`: Postal code (optional)
- `country`: Country name (optional)

**Generated address format:** `street, postal_code, city, country`

## Model Structure

### UploadedAddress Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `manager` | ForeignKey | Manager who uploaded the address |
| `campaign` | ForeignKey | Campaign the address belongs to |
| `address_text` | CharField | Full address from CSV |
| `latitude` | FloatField | Geocoded latitude (nullable) |
| `longitude` | FloatField | Geocoded longitude (nullable) |
| `added_at` | DateTimeField | When address was uploaded |
| `geocoded_at` | DateTimeField | When address was geocoded (nullable) |

## Celery Tasks

### geocode_address(address_id)
Geocodes a single address using the Nominatim API.

**Features:**
- Automatic retry on failure (max 3 attempts)
- Rate limiting compliance
- Error logging and handling
- Norway-specific geocoding

### retry_failed_geocoding()
Periodic task that runs every 15 minutes to retry failed geocoding attempts.

### bulk_geocode_addresses(address_ids)
Bulk geocodes multiple addresses.

## Setup Instructions

### 1. Install Dependencies
```bash
pip install django-celery-beat requests
```

### 2. Add to INSTALLED_APPS
```python
INSTALLED_APPS = [
    # ...
    'django_celery_beat',
    'uploaded_addresses',
]
```

### 3. Run Migrations
```bash
python manage.py makemigrations uploaded_addresses
python manage.py migrate
```

### 4. Configure Celery
Ensure Celery is properly configured in your Django project:

```python
# settings.py
CELERY_BROKER_URL = 'redis://localhost:6379'
CELERY_RESULT_BACKEND = 'redis://localhost:6379'
```

### 5. Start Celery Worker
```bash
celery -A ab_maps worker -l info -Q geocoding
```

### 6. Start Celery Beat (for periodic tasks)
```bash
celery -A ab_maps beat -l info
```

## Usage Examples

### Upload CSV File
```python
import requests

url = "http://localhost:8000/api/uploaded-addresses/upload-csv/"
files = {'file': open('addresses.csv', 'rb')}
data = {'campaign_id': 'your-campaign-uuid'}

response = requests.post(url, files=files, data=data, headers={
    'Authorization': 'Bearer your-jwt-token'
})

print(response.json())
```

### List Addresses
```python
import requests

url = "http://localhost:8000/api/uploaded-addresses/"
params = {'campaign_id': 'your-campaign-uuid', 'geocoded': 'true'}

response = requests.get(url, params=params, headers={
    'Authorization': 'Bearer your-jwt-token'
})

addresses = response.json()
for address in addresses:
    print(f"{address['address_text']}: {address['coordinates']}")
```

## Admin Interface

The Django admin interface provides:

- **List View**: All uploaded addresses with geocoding status
- **Filters**: Campaign, manager, geocoding status, dates
- **Search**: Address text, campaign name, manager name
- **Actions**: Retry geocoding, bulk geocode
- **Custom Display**: Color-coded geocoding status, clickable links

## Error Handling

### Common Errors

1. **Invalid CSV Format**
   - Ensure CSV has 'address' column
   - Check file encoding (UTF-8 recommended)

2. **Geocoding Failures**
   - Address not found in Norway
   - API rate limiting
   - Network connectivity issues

3. **Authentication Errors**
   - Invalid JWT token
   - Insufficient permissions (managers only)

### Debugging

Enable debug logging:
```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'uploaded_addresses': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

## Rate Limiting

The Nominatim API has usage limits:
- Maximum 1 request per second
- User-Agent header required
- Respect robots.txt

The implementation includes:
- Automatic retry with exponential backoff
- Proper User-Agent headers
- Error handling for rate limits

## Security Considerations

- JWT authentication required for all endpoints
- Only managers can upload addresses
- File size limits (10MB max)
- Input validation and sanitization
- SQL injection protection via Django ORM

## Testing

Run the test suite:
```bash
python test_uploaded_addresses_simple.py
```

This will test:
- CSV parsing functionality
- Nominatim API connectivity
- Celery task imports
- Model structure
- Serializer functionality
- Permission classes

## Troubleshooting

### Celery Tasks Not Running
1. Check Celery worker is running
2. Verify Redis connection
3. Check task queue configuration

### Geocoding Failures
1. Check internet connectivity
2. Verify Nominatim API status
3. Review address format
4. Check rate limiting

### Database Issues
1. Run migrations: `python manage.py migrate`
2. Check database connection
3. Verify model relationships

## Contributing

1. Follow Django coding standards
2. Add tests for new features
3. Update documentation
4. Use meaningful commit messages

## License

This feature is part of the AB Maps system and follows the same licensing terms. 