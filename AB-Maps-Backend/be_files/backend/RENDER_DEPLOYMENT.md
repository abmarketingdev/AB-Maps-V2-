# Render Deployment Guide for AB Maps Backend

## Prerequisites

1. **GitHub Repository**: Your code should be in a GitHub repository
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **PostgreSQL Database**: We'll create this on Render

## Step-by-Step Deployment

### Step 1: Prepare Your Repository

Make sure your repository contains these files:
- `render.yaml` - Render configuration
- `build.sh` - Build script
- `requirements_production.txt` - Production dependencies
- `ab_maps/settings_production.py` - Production settings

### Step 2: Create Database on Render

1. Go to your Render dashboard
2. Click "New +" → "PostgreSQL"
3. Configure:
   - **Name**: `ab-maps-postgres`
   - **Database**: `ab_maps_db`
   - **User**: `ab_maps_user`
   - **Plan**: Free (or choose your plan)
4. Click "Create Database"
5. **Important**: Note down the connection details (we'll need them later)

### Step 3: Create Web Service

1. In Render dashboard, click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:

#### Basic Settings:
- **Name**: `ab-maps-backend`
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (if backend is in root)

#### Build & Deploy Settings:
- **Build Command**: `./build.sh`
- **Start Command**: `daphne -b 0.0.0.0 -p $PORT ab_maps.asgi:application`

### Step 4: Configure Environment Variables

In your web service settings, add these environment variables:

#### Required Variables:
```
SECRET_KEY=your-secret-key-here
DEBUG=false
DJANGO_SETTINGS_MODULE=ab_maps.settings_production
```

#### Database Variables (from your PostgreSQL service):
```
POSTGRES_DB=ab_maps_db
POSTGRES_USER=ab_maps_user
POSTGRES_PASSWORD=your-database-password
POSTGRES_HOST=your-database-host
POSTGRES_PORT=5432
```

#### Redis Variables (Required for WebSockets):
```
REDIS_URL=redis://localhost:6379
```

**Note**: For WebSocket support, you'll need a Redis instance. You can:
1. Use Render's Redis service (recommended)
2. Use a free Redis service like Redis Cloud
3. Set up your own Redis instance

#### CORS Variables (add your frontend domains):
```
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
```

### Step 5: Deploy

1. Click "Create Web Service"
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Run migrations
   - Start the application

### Step 6: Verify Deployment

1. Check the deployment logs for any errors
2. Visit your service URL (e.g., `https://ab-maps-backend.onrender.com`)
3. Test the API endpoints:
   - `https://your-service-url.com/api/`
   - `https://your-service-url.com/admin/`

## Troubleshooting

### Common Issues:

#### 1. Build Failures
- Check the build logs in Render dashboard
- Ensure all required files are in the repository
- Verify the build script has execute permissions

#### 2. Database Connection Issues
- Verify database credentials are correct
- Check if the database is running
- Ensure PostGIS extension is enabled

#### 3. Static Files Not Loading
- Check if `collectstatic` ran successfully
- Verify `STATIC_ROOT` and `STATIC_URL` settings
- Ensure WhiteNoise is properly configured

#### 4. CORS Issues
- Add your frontend domain to `CORS_ALLOWED_ORIGINS`
- Check if the domain format is correct (include protocol)

### Debugging Commands:

You can run these commands in the Render shell:

```bash
# Check Python version
python --version

# Check installed packages
pip list

# Test database connection
python manage.py dbshell

# Check Django settings
python manage.py check --deploy

# Run migrations manually
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | `django-insecure-...` |
| `DEBUG` | Debug mode | `false` |
| `DJANGO_SETTINGS_MODULE` | Settings module | `ab_maps.settings_production` |
| `POSTGRES_DB` | Database name | `ab_maps_db` |
| `POSTGRES_USER` | Database user | `ab_maps_user` |
| `POSTGRES_PASSWORD` | Database password | `your-password` |
| `POSTGRES_HOST` | Database host | `dpg-xxx-a.oregon-postgres.render.com` |
| `POSTGRES_PORT` | Database port | `5432` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `CORS_ALLOWED_ORIGINS` | Allowed origins | `https://your-domain.com` |

## Security Considerations

1. **Never commit sensitive data** to your repository
2. **Use environment variables** for all secrets
3. **Enable HTTPS** (Render does this automatically)
4. **Set DEBUG=false** in production
5. **Use strong SECRET_KEY**

## Performance Optimization

1. **Enable caching** with Redis
2. **Use CDN** for static files
3. **Optimize database queries**
4. **Monitor performance** with Render's built-in tools

## WebSocket Support

Your application is configured to support WebSockets using Django Channels and Daphne ASGI server.

### WebSocket Endpoints:
- `ws://your-service-url.com/ws/tracking/` - Location tracking WebSocket
- `ws://your-service-url.com/ws/tracking/dashboard/` - Manager dashboard WebSocket

### WebSocket Authentication:
Connect with JWT token as query parameter:
```
ws://your-service-url.com/ws/tracking/?token=your-jwt-token
```

### Testing WebSockets:
You can test WebSocket connections using tools like:
- Browser WebSocket API
- wscat: `wscat -c "ws://your-service-url.com/ws/tracking/?token=your-jwt-token"`
- Postman WebSocket support

## Next Steps

After successful deployment:

1. **Update frontend URLs** to point to your new backend
2. **Test all API endpoints**
3. **Test WebSocket connections**
4. **Set up monitoring** and logging
5. **Configure custom domain** (optional)
6. **Set up SSL certificates** (automatic with Render)

## Support

If you encounter issues:

1. Check Render's [documentation](https://render.com/docs)
2. Review the deployment logs
3. Test locally with production settings
4. Contact Render support if needed 