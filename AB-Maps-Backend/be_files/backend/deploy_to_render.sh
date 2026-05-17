#!/bin/bash

echo "🚀 AB Maps Backend - Render Deployment Script"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "❌ Error: manage.py not found. Please run this script from the backend directory."
    exit 1
fi

echo "📋 Current directory: $(pwd)"
echo "📦 Checking git status..."

# Check git status
if ! git status > /dev/null 2>&1; then
    echo "❌ Error: Not a git repository. Please initialize git first."
    exit 1
fi

# Show status
git status

echo ""
echo "📤 Ready to push to GitHub?"
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Add all changes
echo "📦 Adding changes..."
git add .

# Commit
echo "💾 Committing changes..."
git commit -m "Deploy: Prepare for Render deployment $(date '+%Y-%m-%d %H:%M:%S')"

# Push
echo "📤 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Successfully pushed to GitHub!"
echo ""
echo "🌐 Next Steps for Render Deployment:"
echo "===================================="
echo ""
echo "1. Go to https://render.com and sign up/login"
echo ""
echo "2. Create a PostgreSQL Database:"
echo "   - Click 'New +' → 'PostgreSQL'"
echo "   - Name: ab-maps-postgres"
echo "   - Database: ab_maps_db"
echo "   - User: ab_maps_user"
echo "   - Plan: Free"
echo ""
echo "3. Create a Web Service:"
echo "   - Click 'New +' → 'Web Service'"
echo "   - Connect your GitHub repository"
echo "   - Name: ab-maps-backend"
echo "   - Environment: Python 3"
echo "   - Build Command: ./build.sh"
echo "   - Start Command: daphne -b 0.0.0.0 -p \$PORT ab_maps.asgi:application"
echo ""
echo "4. Set Environment Variables:"
echo "   - SECRET_KEY=your-secret-key"
echo "   - DEBUG=false"
echo "   - DJANGO_SETTINGS_MODULE=ab_maps.settings_production"
echo "   - POSTGRES_DB=ab_maps_db"
echo "   - POSTGRES_USER=ab_maps_user"
echo "   - POSTGRES_PASSWORD=from-database"
echo "   - POSTGRES_HOST=from-database"
echo "   - POSTGRES_PORT=5432"
echo "   - REDIS_URL=redis://localhost:6379"
echo ""
echo "5. Deploy and test!"
echo ""
echo "📖 For detailed instructions, see: RENDER_DEPLOYMENT.md"
echo "" 