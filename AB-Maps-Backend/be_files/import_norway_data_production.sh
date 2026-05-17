#!/bin/bash
# =============================================================================
# Import Norwegian Kartverket Data into Production PostGIS Database
# =============================================================================
# This script imports the raw PostGIS dump file into the production database
# and transforms it to the optimized local_apartments table.
# The dump file uses SRID 25833 (UTM Zone 33N) and will be transformed to 4326.
#
# Usage: ./import_norway_data_production.sh
# =============================================================================

set -e  # Exit on error

# Production database connection settings
DB_NAME="ab_maps_db_frankfurt"
DB_USER="ab_maps_db_frankfurt_user"
DB_PASSWORD="kF46etuUWlv8vfMEHaRLeGDZpQD6a7Tk"
DB_HOST="dpg-d48a37k9c44c73b1hrn0-a.frankfurt-postgres.render.com"
DB_PORT="5432"

# SQL files
RAW_SQL_FILE="Basisdata_0000_Norge_25833_MatrikkelenAdresseLeilighetsniva_PostGIS.sql"
TRANSFORM_SQL_FILE="transform_data.sql"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=============================================================================${NC}"
echo -e "${GREEN}Norwegian Kartverket Data Import - PRODUCTION${NC}"
echo -e "${GREEN}=============================================================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will modify the PRODUCTION database!${NC}"
echo -e "${YELLOW}Database: ${DB_NAME}${NC}"
echo -e "${YELLOW}Host: ${DB_HOST}${NC}"
echo ""

# Confirmation prompt
read -p "Are you sure you want to proceed? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

# Check if SQL files exist
if [ ! -f "$RAW_SQL_FILE" ]; then
    echo -e "${RED}ERROR: Raw SQL file not found: $RAW_SQL_FILE${NC}"
    echo "Please ensure the file is in the current directory."
    exit 1
fi

if [ ! -f "$TRANSFORM_SQL_FILE" ]; then
    echo -e "${RED}ERROR: Transform SQL file not found: $TRANSFORM_SQL_FILE${NC}"
    echo "Please ensure the file is in the current directory."
    exit 1
fi

# Get file size for progress indication
RAW_FILE_SIZE=$(du -h "$RAW_SQL_FILE" | cut -f1)
echo -e "${BLUE}Raw data file: $RAW_SQL_FILE${NC}"
echo -e "${BLUE}Size: $RAW_FILE_SIZE${NC}"
echo ""

# Set password environment variable (avoids interactive prompt)
export PGPASSWORD="$DB_PASSWORD"

# Test database connection
echo -e "${YELLOW}Testing database connection...${NC}"
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Cannot connect to production database!${NC}"
    echo "Please check your credentials and network connection."
    unset PGPASSWORD
    exit 1
fi
echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# Check for existing data from previous incomplete imports
echo -e "${YELLOW}Checking for existing data from previous imports...${NC}"
SCHEMA_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT EXISTS (
        SELECT FROM information_schema.schemata 
        WHERE schema_name = 'matrikkelenadresseleilighetsniva_4b5d30deb33d4832aed9910991eac'
    );
" 2>/dev/null | xargs || echo "f")

TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'local_apartments'
    );
" 2>/dev/null | xargs || echo "f")

if [ "$SCHEMA_EXISTS" = "t" ] || [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${YELLOW}⚠️  Found existing data from a previous import!${NC}"
    if [ "$SCHEMA_EXISTS" = "t" ]; then
        echo -e "${YELLOW}  - Raw data schema exists${NC}"
    fi
    if [ "$TABLE_EXISTS" = "t" ]; then
        ROW_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM public.local_apartments;" 2>/dev/null | xargs || echo "0")
        echo -e "${YELLOW}  - local_apartments table exists with ${ROW_COUNT} rows${NC}"
    fi
    echo ""
    echo -e "${YELLOW}This could cause errors or duplicate data if not cleaned up.${NC}"
    echo ""
    read -p "Do you want to drop existing data and start fresh? (yes/no): " -r
    echo
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${YELLOW}Cleaning up existing data...${NC}"
        if [ "$TABLE_EXISTS" = "t" ]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP TABLE IF EXISTS public.local_apartments CASCADE;" 2>/dev/null || true
            echo -e "${GREEN}✓ Dropped local_apartments table${NC}"
        fi
        if [ "$SCHEMA_EXISTS" = "t" ]; then
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA IF EXISTS matrikkelenadresseleilighetsniva_4b5d30deb33d4832aed9910991eac CASCADE;" 2>/dev/null || true
            echo -e "${GREEN}✓ Dropped raw data schema${NC}"
        fi
        echo ""
    else
        echo -e "${YELLOW}Continuing with existing data (may cause errors if tables exist)...${NC}"
        echo ""
    fi
fi

# =============================================================================
# Step 1: Import raw data
# =============================================================================
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${GREEN}Step 1: Importing raw Norwegian address data...${NC}"
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${YELLOW}This may take 15-45 minutes depending on network speed...${NC}"
echo -e "${YELLOW}Optimized for remote database (no single-transaction mode)${NC}"
echo ""

# Set PostgreSQL environment variables for optimized bulk loading
export PGCONNECT_TIMEOUT=300
export PGOPTIONS="-c statement_timeout=0 -c lock_timeout=0 -c idle_in_transaction_session_timeout=0"

# Import the raw SQL dump
# OPTIMIZED FOR REMOTE DATABASE:
# - NO --single-transaction (allows auto-commits, much faster for remote DBs)
#   This is safe because COPY statements are atomic per table
# - Connection timeout increased via PGCONNECT_TIMEOUT
# - Statement timeout disabled via PGOPTIONS
# - Progress monitoring with percentage using pv (pipe viewer)
# - ON_ERROR_STOP to abort on errors
START_TIME=$(date +%s)
echo -e "${BLUE}Starting import at $(date)...${NC}"
echo ""

# Check if pv (pipe viewer) is available for progress monitoring
if ! command -v pv &> /dev/null; then
    echo -e "${YELLOW}Installing 'pv' (pipe viewer) for progress monitoring...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y pv > /dev/null 2>&1 || {
            echo -e "${RED}Failed to install pv. Please install manually: sudo apt-get install pv${NC}"
            exit 1
        }
    elif command -v yum &> /dev/null; then
        sudo yum install -y pv > /dev/null 2>&1 || {
            echo -e "${RED}Failed to install pv. Please install manually: sudo yum install pv${NC}"
            exit 1
        }
    else
        echo -e "${RED}Please install 'pv' manually for progress monitoring${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Using pv for progress monitoring with percentage...${NC}"
echo ""
echo -e "${YELLOW}Note: Transfer speed depends on your network connection to Frankfurt.${NC}"
echo -e "${YELLOW}If speed is very slow (<100KB/s), it may take 2-4 hours to complete.${NC}"
echo -e "${YELLOW}The import will continue working - just be patient!${NC}"
echo ""

# Get file size for accurate percentage calculation
FILE_SIZE=$(stat -f%z "$RAW_SQL_FILE" 2>/dev/null || stat -c%s "$RAW_SQL_FILE" 2>/dev/null || echo 0)

if [ "$FILE_SIZE" -gt 0 ]; then
    # Use pv to show file transfer progress (percentage of file transferred)
    # Pipe to psql WITHOUT -q flag so we can see COPY completion messages
    # COPY messages show "COPY N" where N = number of rows imported (confirmation it's working)
    echo -e "${BLUE}File transfer progress (top) and row import confirmations (below):${NC}"
    echo ""
    
    # Run pv and psql - pv shows file transfer %, psql shows COPY confirmations
    pv -s "$FILE_SIZE" -p -t -e -r "$RAW_SQL_FILE" | psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -v ON_ERROR_STOP=1 \
        2>&1 | tee /tmp/psql_output.log | \
    while IFS= read -r line; do
        # Show COPY completion messages with row counts (confirmation that it's working)
        if [[ "$line" =~ ^COPY[[:space:]]+([0-9]+) ]]; then
            ROWS="${BASH_REMATCH[1]}"
            echo -e "${GREEN}✓ Table import completed: ${ROWS} rows imported${NC}"
        # Show CREATE statements
        elif [[ "$line" =~ ^CREATE[[:space:]]+(SCHEMA|TABLE) ]]; then
            echo -e "${BLUE}→ $line${NC}"
        # Show errors
        elif [[ "$line" =~ ERROR|FATAL ]]; then
            echo -e "${RED}✗ $line${NC}"
        fi
    done
else
    # Fallback if we can't get file size
    echo -e "${YELLOW}Warning: Could not determine file size${NC}"
    echo -e "${BLUE}Importing (showing row import confirmations)...${NC}"
    echo ""
    psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$RAW_SQL_FILE" \
        -v ON_ERROR_STOP=1 \
        2>&1 | \
    while IFS= read -r line; do
        if [[ "$line" =~ ^COPY[[:space:]]+([0-9]+) ]]; then
            ROWS="${BASH_REMATCH[1]}"
            echo -e "${GREEN}✓ Table completed: ${ROWS} rows imported${NC}"
        elif [[ "$line" =~ ERROR|FATAL ]]; then
            echo -e "${RED}✗ $line${NC}"
        fi
    done
fi

IMPORT_EXIT_CODE=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo ""
echo -e "${BLUE}Import duration: ${DURATION} seconds ($(($DURATION / 60)) minutes)${NC}"

# Unset the PGOPTIONS to avoid affecting subsequent commands
unset PGOPTIONS

# Check exit status
if [ $IMPORT_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Raw data import completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}✗ Raw data import failed!${NC}"
    echo "Check the error messages above."
    unset PGPASSWORD
    exit 1
fi

# =============================================================================
# Step 2: Transform data
# =============================================================================
echo ""
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${GREEN}Step 2: Transforming data to optimized format...${NC}"
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${YELLOW}This may take 5-15 minutes...${NC}"
echo ""

# Run the transformation script
psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$TRANSFORM_SQL_FILE" \
    --single-transaction \
    --set ON_ERROR_STOP=on

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Data transformation completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}✗ Data transformation failed!${NC}"
    echo "Check the error messages above."
    unset PGPASSWORD
    exit 1
fi

# =============================================================================
# Step 3: Verify and report
# =============================================================================
echo ""
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${GREEN}Step 3: Verifying import...${NC}"
echo -e "${GREEN}=============================================================================${NC}"

# Get final counts
APARTMENT_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM public.local_apartments;" | xargs)
BUILDING_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM public.cache_apartment_search;" 2>/dev/null | xargs || echo "0")

echo ""
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${GREEN}✓ Import Complete!${NC}"
echo -e "${GREEN}=============================================================================${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  ${BLUE}• Apartments imported:${NC} ${GREEN}${APARTMENT_COUNT}${NC}"
echo -e "  ${BLUE}• Buildings grouped:${NC} ${GREEN}${BUILDING_COUNT}${NC}"
echo ""
echo -e "${BLUE}Tables created:${NC}"
echo -e "  ${GREEN}✓${NC} public.local_apartments (SRID 4326)"
echo -e "  ${GREEN}✓${NC} public.cache_apartment_search (materialized view)"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify data: SELECT COUNT(*) FROM public.local_apartments;"
echo "2. Test spatial query:"
echo "   SELECT COUNT(*) FROM public.local_apartments"
echo "   WHERE ST_Intersects(position, ST_GeomFromText('POINT(10.7522 59.9139)', 4326));"
echo "3. Start your enrichment workers"
echo ""
echo -e "${GREEN}=============================================================================${NC}"

# Clear password from environment
unset PGPASSWORD

echo ""
echo -e "${GREEN}Done!${NC}"
