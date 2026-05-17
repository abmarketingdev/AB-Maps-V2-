# Activity Model Complete Guide

## Overview

The Activity model serves as an audit trail that automatically logs user actions in the system. When you create a new Address, an Activity record is automatically created with all the relevant information.

## Activity Model Fields

### **Core Fields**

```python
class Activity(models.Model):
    # Primary Key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # User References
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True)
    manager = models.ForeignKey(Manager, on_delete=models.CASCADE, null=True, blank=True)
    
    # Context References
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, null=True, blank=True)
    area = models.ForeignKey(Area, on_delete=models.CASCADE, null=True, blank=True)
    
    # Activity Information
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES)
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)  # Rich data storage
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### **Activity Types**

```python
ACTIVITY_TYPES = [
    ('address_contact', 'Address Contact'),      # When address is created
    ('location_update', 'Location Update'),      # When location is updated
    ('area_assignment', 'Area Assignment'),      # When area is assigned
    ('status_change', 'Status Change'),          # When status changes
    ('login', 'User Login'),                     # When user logs in
    ('logout', 'User Logout'),                   # When user logs out
    ('campaign_start', 'Campaign Start'),        # When campaign starts
    ('campaign_end', 'Campaign End'),            # When campaign ends
]
```

## Data Flow: Address → Activity

### **When You Create a New Address**

```javascript
// Frontend creates address
const payload = {
  address_text: "123 Main Street, Oslo",
  status: "ja",
  position: { lat: 59.9139, lng: 10.7522 },
  tags: { source: 'map_click', timestamp: '2024-01-15T10:30:00Z' },
  employee_id: "employee-uuid",
  campaign_id: "campaign-uuid"
};
```

### **Automatic Activity Creation**

When the Address is saved, a signal automatically creates an Activity record:

```python
# Signal automatically creates this Activity record
Activity.objects.create(
    employee=employee,                    # Employee who created the address
    manager=None,                        # No manager for employee-created addresses
    campaign=campaign,                   # Campaign the address belongs to
    area=None,                          # No area assigned yet
    activity_type='address_contact',     # Type of activity
    description='Contacted address: 123 Main Street, Oslo',
    metadata={
        'address_id': 'address-uuid',
        'address_text': '123 Main Street, Oslo',
        'status': 'ja',
        'position': {
            'lat': 59.9139,
            'lng': 10.7522
        },
        'tags': {
            'source': 'map_click',
            'timestamp': '2024-01-15T10:30:00Z'
        },
        'recorded_at': '2024-01-15T10:30:00Z',
        'campaign_name': 'Winter Campaign 2024',
        'user_type': 'employee',
        'user_name': 'John Doe'
    }
)
```

## Complete Field Reference

### **1. Basic Activity Information**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | UUID | Unique identifier | `"550e8400-e29b-41d4-a716-446655440000"` |
| `activity_type` | String | Type of activity | `"address_contact"` |
| `description` | Text | Human-readable description | `"Contacted address: 123 Main Street"` |
| `created_at` | DateTime | When activity occurred | `2024-01-15T10:30:00Z` |
| `updated_at` | DateTime | Last update time | `2024-01-15T10:30:00Z` |

### **2. User References**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `employee` | ForeignKey | Employee who performed action | `Employee(id="emp-123", name="John Doe")` |
| `manager` | ForeignKey | Manager who performed action | `Manager(id="mgr-456", name="Jane Smith")` |

### **3. Context References**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `campaign` | ForeignKey | Related campaign | `Campaign(id="camp-789", name="Winter Campaign")` |
| `area` | ForeignKey | Related area | `Area(id="area-101", name="Oslo Central")` |

### **4. Rich Metadata (JSON Field)**

The `metadata` field contains all the detailed information:

```json
{
  "address_id": "550e8400-e29b-41d4-a716-446655440000",
  "address_text": "123 Main Street, Oslo, Norway",
  "status": "ja",
  "position": {
    "lat": 59.9139,
    "lng": 10.7522
  },
  "tags": {
    "source": "map_click",
    "timestamp": "2024-01-15T10:30:00Z",
    "device": "mobile",
    "accuracy": 5.2
  },
  "recorded_at": "2024-01-15T10:30:00Z",
  "campaign_name": "Winter Campaign 2024",
  "user_type": "employee",
  "user_name": "John Doe",
  "team": "Sales Team A",
  "area_name": "Oslo Central",
  "phone_number": "+4712345678",
  "outcome": "Positive response",
  "notes": "Customer interested in product"
}
```

## API Endpoints to Access Activity Data

### **1. List All Activities**
```
GET /api/dashboard/activities/
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "activity_type": "address_contact",
    "description": "Contacted address: 123 Main Street, Oslo",
    "employee": {
      "id": "emp-123",
      "name": "John Doe"
    },
    "campaign": {
      "id": "camp-789",
      "name": "Winter Campaign 2024"
    },
    "metadata": {
      "address_id": "addr-456",
      "address_text": "123 Main Street, Oslo",
      "status": "ja",
      "position": {"lat": 59.9139, "lng": 10.7522}
    },
    "created_at": "2024-01-15T10:30:00Z",
    "created_at_formatted": "15. Jan 10:30"
  }
]
```

### **2. Get Dashboard Activities**
```
GET /api/dashboard/activities/dashboard_data/?days=7&activity_type=address_contact
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "date": "15. Jan 10:30",
    "activity": "Address Contact",
    "campaign": "Winter Campaign 2024",
    "name": "John Doe",
    "mobile": "+4712345678",
    "outcome": "ja",
    "employee_id": "emp-123",
    "manager_id": ""
  }
]
```

## How to Get All Fields

### **1. Via API**
```javascript
// Fetch all activities
const response = await fetch('/api/dashboard/activities/', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const activities = await response.json();
console.log('All activity fields:', activities[0]);
```

### **2. Via Django ORM**
```python
# Get all activities with related data
activities = Activity.objects.select_related(
    'employee', 'manager', 'campaign', 'area'
).all()

for activity in activities:
    print(f"Activity ID: {activity.id}")
    print(f"Type: {activity.activity_type}")
    print(f"Description: {activity.description}")
    print(f"Employee: {activity.employee.name if activity.employee else 'None'}")
    print(f"Manager: {activity.manager.name if activity.manager else 'None'}")
    print(f"Campaign: {activity.campaign.name if activity.campaign else 'None'}")
    print(f"Area: {activity.area.name if activity.area else 'None'}")
    print(f"Created: {activity.created_at}")
    print(f"Metadata: {activity.metadata}")
    print("---")
```

### **3. Filter Activities**
```python
# Get activities by type
address_contacts = Activity.objects.filter(activity_type='address_contact')

# Get activities by employee
employee_activities = Activity.objects.filter(employee=employee)

# Get activities by campaign
campaign_activities = Activity.objects.filter(campaign=campaign)

# Get activities by date range
from datetime import datetime, timedelta
recent_activities = Activity.objects.filter(
    created_at__gte=datetime.now() - timedelta(days=7)
)
```

## Status Change Tracking

When an address status is updated, a separate Activity record is created:

```python
# When status changes from 'ja' to 'nei'
Activity.objects.create(
    employee=employee,
    activity_type='status_change',
    description='Status changed from ja to nei for 123 Main Street, Oslo',
    metadata={
        'address_id': 'addr-456',
        'address_text': '123 Main Street, Oslo',
        'old_status': 'ja',
        'new_status': 'nei',
        'position': {'lat': 59.9139, 'lng': 10.7522},
        'campaign_name': 'Winter Campaign 2024',
        'user_type': 'employee',
        'user_name': 'John Doe'
    }
)
```

## Summary

When you create a new Address, you automatically get a complete Activity record with:

1. **Basic Info**: ID, type, description, timestamps
2. **User Info**: Employee/manager who created it
3. **Context Info**: Campaign, area references
4. **Rich Metadata**: All address details, position, tags, etc.

This provides a complete audit trail of all user actions in the system, making it easy to track who did what, when, and where. 