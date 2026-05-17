#!/bin/bash

echo "🚀 AB Maps Backend - Render Build Script"
echo "========================================"

# Exit on any error
set -e

echo "📦 Installing Python dependencies..."
pip install -r requirements_production.txt

echo "🔍 Checking if locked_areas table exists (may need to fake migration)..."
# Only run fake command if migrations exist
if python manage.py showmigrations locked_areas 2>/dev/null | grep -q "0001_initial"; then
    python manage.py fake_initial_if_exists || echo "⚠️  Could not fake migration (may not exist yet)"
else
    echo "ℹ️  locked_areas migrations not found - will create table manually if needed"
fi

echo "🗄️  Running Django migrations..."
python manage.py migrate

echo "🔧 Setting up production database..."
python manage.py shell << 'EOF'
from django.db import connection

with connection.cursor() as cursor:
    # Check if locked_areas table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'locked_areas'
        );
    """)
    exists = cursor.fetchone()[0]
    
    if not exists:
        print("Creating locked_areas table...")
        cursor.execute("""
            CREATE TABLE locked_areas (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                area_key VARCHAR(255) NOT NULL,
                area_type VARCHAR(50) NOT NULL,
                area_code VARCHAR(50) NOT NULL,
                area_name VARCHAR(255) NOT NULL,
                campaign_id UUID NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
                locked_by_id UUID NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
                locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        
        # Create unique constraint
        cursor.execute("""
            ALTER TABLE locked_areas 
            ADD CONSTRAINT locked_areas_campaign_area_unique 
            UNIQUE (campaign_id, area_key);
        """)
        
        # Create indexes
        cursor.execute("CREATE INDEX idx_locked_areas_campaign_id ON locked_areas(campaign_id);")
        cursor.execute("CREATE INDEX idx_locked_areas_locked_by_id ON locked_areas(locked_by_id);")
        cursor.execute("CREATE INDEX idx_locked_areas_area_key ON locked_areas(area_key);")
        cursor.execute("CREATE INDEX idx_locked_areas_is_active ON locked_areas(is_active);")
        
        print("✅ locked_areas table created successfully")
    else:
        print("✅ locked_areas table already exists")
    
    # Create locked_areas_with_details view
    cursor.execute("""
        CREATE OR REPLACE VIEW locked_areas_with_details AS
        SELECT 
            la.id,
            la.area_key,
            la.area_type,
            la.area_code,
            la.area_name,
            la.campaign_id,
            la.locked_by_id,
            la.locked_at,
            la.is_active,
            la.created_at,
            la.updated_at,
            
            -- Campaign details
            c.name as campaign_name,
            
            -- User details
            u.username,
            u.first_name,
            u.last_name,
            COALESCE(
                e.name,
                m.name,
                u.first_name || ' ' || u.last_name,
                u.username
            ) as locked_by_name,
            CASE 
                WHEN e.id IS NOT NULL THEN 'employee'
                WHEN m.id IS NOT NULL THEN 'manager'
                ELSE 'user'
            END as user_type,
            
            -- Profile details
            COALESCE(e.id, m.id) as profile_id,
            COALESCE(e.name, m.name) as profile_name,
            COALESCE(e.email, m.email) as profile_email
            
        FROM locked_areas la
        LEFT JOIN campaign c ON la.campaign_id = c.id
        LEFT JOIN auth_user u ON la.locked_by_id = u.id
        LEFT JOIN employee e ON u.employee_id = e.id
        LEFT JOIN manager m ON u.manager_id = m.id;
    """)
    
    print("✅ locked_areas_with_details view created")
    
    # Final status
    cursor.execute("SELECT COUNT(*) FROM locked_areas;")
    count = cursor.fetchone()[0]
    print(f"📊 locked_areas table has {count} records")
EOF

echo "🎉 Build process complete!"