# Dashboard App Complete Guide

## Overview

The Dashboard app is a comprehensive analytics and reporting system for the AB Maps platform. It provides real-time metrics, performance tracking, and data visualization for both managers and employees.

## Data Models

### 1. Activity Model
Tracks user activities for analytics:
```python
class Activity(models.Model):
    ACTIVITY_TYPES = [
        ('address_contact', 'Address Contact'),
        ('location_update', 'Location Update'),
        ('area_assignment', 'Area Assignment'),
        ('status_change', 'Status Change'),
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('campaign_start', 'Campaign Start'),
        ('campaign_end', 'Campaign End'),
    ]
    
    # Fields: employee, manager, campaign, area, activity_type, description, metadata
```

### 2. Sales Model
Tracks sales interactions and outcomes:
```python
class Sales(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('callback', 'Callback Requested'),
        ('no_answer', 'No Answer'),
    ]
    
    # Fields: employee, manager, campaign, area, contact_name, status, outcome, value, commission
```

### 3. PerformanceMetrics Model
Stores calculated performance metrics for caching:
```python
class PerformanceMetrics(models.Model):
    # Time period: date, hour, period_type (hourly/daily/weekly/monthly)
    # Scope: employee, manager, campaign, area
    # Metrics: total_calls, successful_calls, total_sales, conversion_rate, avg_call_duration
```

### 4. DashboardSummary Model
Stores dashboard summary data for quick access:
```python
class DashboardSummary(models.Model):
    # Scope: manager, employee, date
    # Metrics: total_orders, total_calls, conversion_rate, online_employees, total_work_time
```

### 5. TimeTracking Model
Tracks employee work time and activities:
```python
class TimeTracking(models.Model):
    STATUS_CHOICES = [
        ('ready', 'Ready'),
        ('break', 'Break'),
        ('call', 'On Call'),
        ('after_work', 'After Work'),
        ('offline', 'Offline'),
    ]
```

## API Endpoints

### Base URL: `/api/dashboard/`

### 1. Activities Endpoints
```
GET    /api/dashboard/activities/                    # List all activities
POST   /api/dashboard/activities/                    # Create new activity
GET    /api/dashboard/activities/{id}/               # Get specific activity
PUT    /api/dashboard/activities/{id}/               # Update activity
DELETE /api/dashboard/activities/{id}/               # Delete activity
GET    /api/dashboard/activities/dashboard_data/     # Get formatted activities for dashboard
```

**Dashboard Data Parameters:**
- `days` (int): Number of days to look back (default: 7)
- `activity_type` (str): Filter by activity type

### 2. Sales Endpoints
```
GET    /api/dashboard/sales/                         # List all sales
POST   /api/dashboard/sales/                         # Create new sale
GET    /api/dashboard/sales/{id}/                    # Get specific sale
PUT    /api/dashboard/sales/{id}/                    # Update sale
DELETE /api/dashboard/sales/{id}/                    # Delete sale
GET    /api/dashboard/sales/dashboard_data/          # Get formatted sales for dashboard
```

**Dashboard Data Parameters:**
- `days` (int): Number of days to look back (default: 7)
- `status` (str): Filter by status

### 3. Performance Metrics Endpoints
```
GET    /api/dashboard/performance/                   # List all performance metrics
POST   /api/dashboard/performance/                   # Create new metric
GET    /api/dashboard/performance/{id}/              # Get specific metric
PUT    /api/dashboard/performance/{id}/              # Update metric
DELETE /api/dashboard/performance/{id}/              # Delete metric
GET    /api/dashboard/performance/dashboard_performance/  # Get performance charts data
GET    /api/dashboard/performance/dashboard_campaigns/    # Get campaign performance data
GET    /api/dashboard/performance/dashboard_conversion/   # Get conversion funnel data
```

**Performance Parameters:**
- `period` (str): Period type (hourly/daily/weekly/monthly, default: hourly)
- `days` (int): Number of days to look back (default: 1)

### 4. Dashboard Summary Endpoints
```
GET    /api/dashboard/summaries/                     # List all summaries
POST   /api/dashboard/summaries/                     # Create new summary
GET    /api/dashboard/summaries/{id}/                # Get specific summary
PUT    /api/dashboard/summaries/{id}/                # Update summary
DELETE /api/dashboard/summaries/{id}/                # Delete summary
GET    /api/dashboard/summaries/summary_data/        # Get dashboard summary data
```

**Summary Data Parameters:**
- `date` (str): Date in YYYY-MM-DD format (default: today)

### 5. Time Tracking Endpoints
```
GET    /api/dashboard/time-tracking/                 # List all time tracking entries
POST   /api/dashboard/time-tracking/                 # Create new time tracking entry
GET    /api/dashboard/time-tracking/{id}/            # Get specific entry
PUT    /api/dashboard/time-tracking/{id}/            # Update entry
DELETE /api/dashboard/time-tracking/{id}/            # Delete entry
```

### 6. Leaderboard Endpoints
```
GET    /api/dashboard/leaderboard/leaderboard/       # Get leaderboard data
```

**Leaderboard Parameters:**
- `days` (int): Number of days to look back (default: 30)
- `team` (str): Filter by team

## Data Flow Process

### How Data Gets Into Dashboard

#### 1. Address Status Updates (Primary Data Source)
```javascript
// Frontend: Employee updates address status
const payload = {
  address_text: address,
  status: statusValue, // 'ja', 'nei', 'ikke_hjemme'
  position: geoJsonPosition,
  employee_id: user.user_info?.id,
  campaign_id: campaignId,
};

// This creates an Address record which feeds into dashboard metrics
```

#### 2. Time Tracking
```javascript
// Frontend: Employee updates time status
const timeEntry = {
  status: 'ready', // 'ready', 'break', 'call', 'after_work', 'offline'
  start_time: new Date(),
  employee_id: employeeId,
};
```

#### 3. Sales Creation
```javascript
// Frontend: Create sales record
const sale = {
  contact_name: "John Doe",
  contact_phone: "+4712345678",
  status: "completed",
  outcome: "Ja",
  value: 1500.00,
  commission: 150.00,
  campaign_id: campaignId,
  employee_id: employeeId,
};
```

#### 4. Activity Logging
```python
# Backend: Automatic activity logging
Activity.objects.create(
    employee=employee,
    campaign=campaign,
    activity_type='address_contact',
    description=f'Contacted {address}',
    metadata={'status': status, 'phone': phone}
)
```

### Real-time Data Calculation

The dashboard calculates metrics in real-time from the Address model:

```python
# In summary_data endpoint
addresses = Address.objects.filter(
    recorded_at__range=(start_of_day, end_of_day),
    manager=user.manager  # or employee=user.employee
)

total_calls = addresses.count()
yes_responses = addresses.filter(status='Ja').count()
no_responses = addresses.filter(status='Nei').count()
callback_requests = addresses.filter(status='Tilbakeringing').count()
```

## Manager vs Employee Metrics

### Manager Metrics
Managers can see:
- **All employees' data** under their management
- **Aggregated metrics** across all employees
- **Campaign performance** for all campaigns they created
- **Team leaderboards** and comparisons
- **System-wide summaries**

### Employee Metrics
Employees can only see:
- **Their own data** and performance
- **Personal time tracking**
- **Individual sales records**
- **Personal dashboard summary**

## Campaign Metrics

### Campaign Data Structure
```python
class Campaign(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    created_by = models.ForeignKey('users.Manager')
    # Related: areas, employees, addresses
```

### Campaign Performance Metrics
1. **Total Calls**: Count of addresses created for the campaign
2. **Successful Calls**: Count of 'Ja' responses
3. **Conversion Rate**: (Successful Calls / Total Calls) * 100
4. **Employee Performance**: Per-employee metrics within campaign
5. **Area Coverage**: Addresses per area within campaign

### Getting Campaign Metrics
```python
# Get campaign performance
GET /api/dashboard/performance/dashboard_campaigns/?days=30

# Get specific campaign metrics
PerformanceMetrics.objects.filter(
    campaign=campaign,
    date__gte=start_date
).aggregate(
    total_calls=Sum('total_calls'),
    total_sales=Sum('total_sales'),
    avg_conversion=Avg('conversion_rate')
)
```

## Employee Metrics

### Individual Employee Metrics
1. **Total Calls Made**: Addresses created by employee
2. **Hit Rate**: (Yes responses / Total calls) * 100
3. **Time Tracking**: Ready, break, call, after-work time
4. **Sales Performance**: Orders, confirmed, completed, commission
5. **Campaign Progress**: Progress within assigned campaigns

### Employee Dashboard Data
```python
# Employee-specific summary
summary_data = {
    'orders': yes_responses,  # Simplified: yes responses as orders
    'total_calls': total_calls,
    'yes_responses': yes_responses,
    'no_responses': no_responses,
    'callback_requests': callback_requests,
    'active_campaign': active_campaign.name,
    'total_work_time': "0t 0m",
    'total_break_time': "0t 0m",
    'total_call_time': "0t 0m",
}
```

## Adding Data to Dashboard

### 1. Creating Activities
```python
# Backend: Log user activity
Activity.objects.create(
    employee=employee,
    campaign=campaign,
    activity_type='address_contact',
    description='Contacted customer',
    metadata={'phone': '+4712345678', 'outcome': 'Ja'}
)
```

### 2. Creating Sales Records
```python
# Backend: Create sales record
Sales.objects.create(
    employee=employee,
    manager=employee.manager,
    campaign=campaign,
    contact_name="John Doe",
    contact_phone="+4712345678",
    status="completed",
    outcome="Ja",
    value=1500.00,
    commission=150.00
)
```

### 3. Updating Time Tracking
```python
# Backend: Create time tracking entry
TimeTracking.objects.create(
    employee=employee,
    status='call',
    start_time=timezone.now(),
    duration=30  # minutes
)
```

### 4. Performance Metrics Calculation
```python
# Backend: Calculate and store performance metrics
PerformanceMetrics.objects.create(
    date=timezone.now().date(),
    hour=timezone.now().hour,
    period_type='hourly',
    employee=employee,
    campaign=campaign,
    total_calls=10,
    successful_calls=3,
    total_sales=3,
    conversion_rate=30.0,
    avg_call_duration=180,  # seconds
    total_work_time=480     # minutes
)
```

## Dashboard Summary Data

### Main Dashboard Endpoint
```
GET /api/dashboard/summaries/summary_data/?date=today
```

### Response Structure
```json
{
  "orders": 0,                    // Total orders (Bestillinger)
  "total_calls": 2,              // Total calls made (Totale samtaler)
  "yes_responses": 2,            // Answered yes (Svarte ja)
  "no_responses": 0,             // Answered no (Svarte nei)
  "callback_requests": 0,        // Callbacks (Tilbakeringing)
  "active_campaign": "Selected Campaign",  // Active campaign name
  "online_employees": 0,         // Online employees count
  "total_employees": 0,          // Total employees count
  "total_work_time": "0t 0m",    // Total logged time (Logget Tid)
  "total_break_time": "0t 0m",   // Break time (Pause)
  "total_call_time": "0t 0m"     // Talk time (Samtaletid)
}
```

## Permission System

### DashboardPermission Class
```python
class DashboardPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # Managers can access all dashboard data
        if hasattr(request.user, 'manager') and request.user.manager:
            return True
        
        # Employees can access their own dashboard data
        if hasattr(request.user, 'employee') and request.user.employee:
            return True
        
        return False
```

### Data Filtering by User Type
- **Managers**: See all data under their management
- **Employees**: See only their own data
- **System-wide data**: Only accessible to managers

## Real-time Updates

### WebSocket Integration
The dashboard integrates with WebSocket consumers for real-time updates:

```python
# In tracking/consumers.py
class ManagerDashboardConsumer(AsyncWebsocketConsumer):
    async def get_dashboard_data(self):
        # Get real-time dashboard data
        employees = Employee.objects.filter(manager=self.manager)
        addresses = Address.objects.filter(
            recorded_at__gte=timezone.now() - timedelta(hours=1),
            manager=self.manager
        )
        # Return formatted data for real-time updates
```

## Usage Examples

### Frontend Integration
```javascript
// Fetch dashboard summary data
const response = await fetch('/api/dashboard/summaries/summary_data/', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const dashboardData = await response.json();
// Use data to populate dashboard cards
```

### Backend Integration
```python
# Create dashboard summary
summary = DashboardSummary.objects.create(
    manager=manager,
    date=timezone.now().date(),
    total_orders=10,
    total_calls=50,
    successful_calls=15,
    conversion_rate=30.0,
    online_employees=5,
    total_employees=10,
    total_work_time=480,  # minutes
    total_break_time=60,  # minutes
    total_call_time=120   # minutes
)
```

## Best Practices

1. **Data Consistency**: Always use the same data sources for calculations
2. **Performance**: Use database indexes for frequently queried fields
3. **Caching**: Store calculated metrics in PerformanceMetrics for faster access
4. **Real-time Updates**: Use WebSocket for live dashboard updates
5. **Error Handling**: Implement proper error handling for all API calls
6. **Permissions**: Always check user permissions before returning data
7. **Data Validation**: Validate all input data before storing

## Troubleshooting

### Common Issues
1. **Empty Dashboard**: Check if addresses are being created with proper employee/manager associations
2. **Permission Errors**: Verify user authentication and role assignments
3. **Missing Campaign Data**: Ensure campaigns are properly linked to addresses
4. **Time Tracking Issues**: Check if time tracking entries are being created correctly

### Debug Endpoints
```python
# Check user permissions
GET /api/dashboard/summaries/summary_data/?date=today

# Verify data exists
GET /api/dashboard/activities/
GET /api/dashboard/sales/
GET /api/dashboard/time-tracking/
``` 