#!/bin/bash
set -e

# ── Build the Next.js dashboard ─────────────────────────────────────────────
echo "🔧 Installing & building dashboard (Next.js)…"
npm install --legacy-peer-deps --include=dev
npm run build

# ── Build the Manager React app under /manager ──────────────────────────────
echo "🧱 Building manager React app…"
cd ../manager

npm install --legacy-peer-deps
# Tell CRA to prefix all assets with /manager and set environment variables
REACT_APP_API_URL=https://api-prod-frankfurt.onrender.com/api \
REACT_APP_BACKEND_URL=https://api-prod-frankfurt.onrender.com \
REACT_APP_TILE_SERVER_URL=https://api-prod-frankfurt.onrender.com \
REACT_APP_LOGIN_URL=https://abmaps.absystem.no/login \
REACT_APP_FRONTEND_URL=https://abmaps.absystem.no/manager \
PUBLIC_URL=/manager npm run build

# Copy the built files into dashboard/public/manager
rm -rf ../dashboard/public/manager
mkdir -p ../dashboard/public/manager
cp -r build/* ../dashboard/public/manager

# Copy worker files for manager (if they exist)
if [ -d "public/workers" ]; then
    echo "📁 Copying manager worker files..."
    mkdir -p ../dashboard/public/manager/workers
    cp -r public/workers/* ../dashboard/public/manager/workers/
else
    echo "⚠️  Warning: No workers directory found in manager"
fi

# Return to dashboard/
cd ../dashboard

# ── Build the Employee React app under /emp ──────────────────────────────
echo "👷 Building emp React app…"
cd ../emp

npm install --legacy-peer-deps
# Tell CRA to prefix all assets with /emp and set environment variables
REACT_APP_API_URL=https://api-prod-frankfurt.onrender.com/api \
REACT_APP_BACKEND_URL=https://api-prod-frankfurt.onrender.com \
REACT_APP_TILE_SERVER_URL=https://api-prod-frankfurt.onrender.com \
REACT_APP_LOGIN_URL=https://abmaps.absystem.no/login \
REACT_APP_FRONTEND_URL=https://abmaps.absystem.no/emp \
PUBLIC_URL=/emp npm run build

# Copy the built files into dashboard/public/emp
rm -rf ../dashboard/public/emp
mkdir -p ../dashboard/public/emp
cp -r build/* ../dashboard/public/emp

# Copy worker files for emp (if they exist)
if [ -d "public/workers" ]; then
    echo "📁 Copying emp worker files..."
    mkdir -p ../dashboard/public/emp/workers
    cp -r public/workers/* ../dashboard/public/emp/workers/
else
    echo "⚠️  Warning: No workers directory found in emp"
fi

# Return to dashboard/ (not strictly necessary at script end)
cd ../dashboard

echo "✅ All builds complete!"
echo "📋 Build summary:"
echo "   - Dashboard: Next.js app built"
echo "   - Manager: React app built and copied to /manager"
echo "   - Employee: React app built and copied to /emp"
echo "   - Worker files: Copied (if available)"
