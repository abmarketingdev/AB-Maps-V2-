# AB Maps Backend

A comprehensive Django REST API backend for the AB Maps system with real-time location tracking, area management, and user management.

## Features

- **User Management**: Custom user model with Manager and Employee roles
- **Authentication**: JWT-based authentication with refresh tokens
- **Areas Management**: GIS-enabled area creation and management
- **Address Tracking**: Address status tracking with Norwegian status system
- **Real-time Tracking**: WebSocket-based live location tracking
- **Campaigns**: Campaign management with direct employee assignments
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation

## Tech Stack

- **Django 4.2.7**: Web framework
- **Django REST Framework**: API framework
- **PostGIS**: Spatial database
- **Channels**: WebSocket support
- **Redis**: Caching and message broker
- **JWT**: Authentication
- **GeoDjango**: GIS functionality

## Prerequisites

- Python 3.8+
- PostgreSQL with PostGIS extension
- Redis server
- GDAL libraries

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ab_maps_backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   Create a `.env` file in the project root:
   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   REDIS_URL=redis://localhost:6379
   ```

5. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE ab_maps_db_main;
   CREATE EXTENSION postgis;
   ```

6. **Run migrations**
   ```bash
   python manage.py migrate
   ```

7. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

8. **Start the development server**
   ```bash
   python manage.py runserver
   ```

## API Endpoints

### Authentication
- `POST /api/auth/login/` - User login
- `POST /api/auth/refresh/` - Refresh JWT token
- `POST /api/auth/logout/` - User logout

### Users
- `GET/POST /api/users/users/` - List/Create users
- `GET/PUT/PATCH/DELETE /api/users/users/{id}/` - User CRUD
- `GET/POST /api/users/managers/` - Manager management
- `GET/POST /api/users/employees/` - Employee management

### Areas
- `GET/POST /api/areas/areas/` - List/Create areas
- `GET/PUT/PATCH/DELETE /api/areas/areas/{id}/` - Area CRUD
- `POST /api/areas/areas/{id}/add_employee/` - Add employee to area
- `GET /api/areas/areas/my_areas/` - Get manager's areas
- `GET /api/areas/areas/assigned_areas/` - Get employee's assigned areas

### Addresses
- `GET/POST /api/addresses/addresses/` - List/Create addresses
- `GET/PUT/PATCH/DELETE /api/addresses/addresses/{id}/` - Address CRUD
- `GET/POST /api/addresses/statuses/` - Address status management
- `POST /api/addresses/statuses/bulk_create/` - Bulk status creation

### Tracking
- `GET/POST /api/tracking/locations/` - Location tracking
- `GET /api/tracking/locations/latest/` - Latest locations (managers only)
- `GET /api/tracking/locations/real_time/` - Real-time locations (managers only)

### Campaigns
- `GET/POST /api/campaigns/campaigns/` - Campaign management
- `GET/POST /api/campaigns/campaign-forms/` - Campaign form management
- `GET/POST /api/campaigns/campaign-areas/` - Campaign area assignments
- `GET/POST /api/campaigns/campaign-employees/` - Campaign employee assignments

## WebSocket Endpoints

### Real-time Tracking
- `ws://localhost:8000/ws/tracking/` - Location tracking WebSocket
- `ws://localhost:8000/ws/tracking/dashboard/` - Manager dashboard WebSocket

### WebSocket Authentication
Connect with JWT token as query parameter:
```
ws://localhost:8000/ws/tracking/?token=your-jwt-token
```

## Business Logic

### User Roles
- **Managers**: Can create areas, view all employees, manage campaigns and areas
- **Employees**: Can view assigned areas, update address statuses
- **Admins**: Full system access

### Area Management
- Managers can create and manage their own areas
- Managers can view all areas but only edit their own
- Employees can view areas they're assigned to

### Location Tracking
- Employees can send location updates
- Managers can view real-time employee locations
- WebSocket-based real-time updates

### Address Status System
- Norwegian status options: "Ja", "Ikke hjemme", "Nei"
- Both managers and employees can create address statuses
- Status history tracking

## Development

### Running Tests
```bash
python manage.py test
```

### API Documentation
- Swagger UI: `http://localhost:8000/swagger/`
- ReDoc: `http://localhost:8000/redoc/`
- DRF Spectacular: `http://localhost:8000/api/docs/`

### Database Management
```bash
# Create new migration
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Reset database (development only)
python manage.py flush
```

### Static Files
```bash
# Collect static files
python manage.py collectstatic

# Serve static files (development)
python manage.py runserver
```

## Production Deployment

### Environment Variables
```env
SECRET_KEY=your-production-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.com
REDIS_URL=redis://your-redis-server:6379
DATABASE_URL=postgresql://user:password@host:port/database
```

### Gunicorn Configuration
```bash
gunicorn ab_maps.wsgi:application --bind 0.0.0.0:8000
```

### ASGI Server (for WebSockets)
```bash
uvicorn ab_maps.asgi:application --host 0.0.0.0 --port 8000
```

## Project Structure

```
ab_maps_backend/
├── ab_maps/                 # Project settings
├── users/                   # User management
├── custom_auth/            # JWT authentication
├── areas/                  # Area management
├── addresses/              # Address tracking
├── tracking/               # Location tracking
├── campaigns/              # Campaign management
├── static/                 # Static files
├── logs/                   # Application logs
├── requirements.txt        # Python dependencies
└── README.md              # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is proprietary software for AB Maps.

## Support

For support and questions, please contact the development team. 