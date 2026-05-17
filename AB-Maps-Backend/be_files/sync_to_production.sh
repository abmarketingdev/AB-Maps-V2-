#!/bin/bash

# Script to sync data to production database from local machine
# Usage: ./sync_to_production.sh [--sync-counties] [--populate-geom3857] [--import-ssb CSV_FILE --year YEAR]

cd "$(dirname "$0")/backend"

# Production database connection details
PROD_HOST="dpg-d48a37k9c44c73b1hrn0-a"
PROD_DB="ab_maps_db_frankfurt"
PROD_USER="ab_maps_db_frankfurt_user"
PROD_PASSWORD="kF46etuUWlv8vfMEHaRLeGDZpQD6a7Tk"
PROD_PORT="5432"

echo "🚀 Syncing data to production database..."
echo "========================================"
echo ""

# Build command arguments
CMD_ARGS="--prod-host $PROD_HOST --prod-db $PROD_DB --prod-user $PROD_USER --prod-password $PROD_PASSWORD --prod-port $PROD_PORT"

# Add operation flags
if [ "$1" == "--sync-counties" ] || [ "$1" == "--all" ]; then
    CMD_ARGS="$CMD_ARGS --sync-counties"
fi

if [ "$1" == "--populate-geom3857" ] || [ "$1" == "--all" ]; then
    CMD_ARGS="$CMD_ARGS --populate-geom3857"
fi

if [ "$1" == "--import-ssb" ]; then
    if [ -z "$2" ] || [ -z "$3" ]; then
        echo "❌ Error: --import-ssb requires CSV file path and --year"
        echo "Usage: ./sync_to_production.sh --import-ssb /path/to/file.csv --year 2025"
        exit 1
    fi
    CMD_ARGS="$CMD_ARGS --import-ssb $2 --year $3"
fi

# If no arguments, show usage
if [ -z "$1" ]; then
    echo "Usage:"
    echo "  ./sync_to_production.sh --sync-counties      # Sync counties to admin.areas"
    echo "  ./sync_to_production.sh --populate-geom3857  # Populate geom_3857 column"
    echo "  ./sync_to_production.sh --all                # Run all sync operations"
    echo "  ./sync_to_production.sh --import-ssb /path/to/file.csv --year 2025"
    echo ""
    exit 0
fi

# Run the sync command
python manage.py sync_production_data $CMD_ARGS

