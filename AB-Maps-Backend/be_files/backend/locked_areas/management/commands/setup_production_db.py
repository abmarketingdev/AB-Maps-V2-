"""
Django management command to setup production database.
Run this on Render: python manage.py setup_production_db
"""

from django.core.management.base import BaseCommand
from django.db import connection
from django.conf import settings


class Command(BaseCommand):
    help = 'Setup production database with missing tables and data'

    def handle(self, *args, **options):
        self.stdout.write('Setting up production database...')
        
        with connection.cursor() as cursor:
            # Check if locked_areas table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'locked_areas'
                );
            """)
            locked_areas_exists = cursor.fetchone()[0]
            
            if not locked_areas_exists:
                self.stdout.write('Creating locked_areas table...')
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
                
                self.stdout.write(self.style.SUCCESS('✅ locked_areas table created'))
            else:
                self.stdout.write('✅ locked_areas table already exists')
            
            # Check if todos table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'todos_todo'
                );
            """)
            todos_exists = cursor.fetchone()[0]
            
            if not todos_exists:
                self.stdout.write('Creating todos_todo table...')
                # This should be handled by Django migrations, but let's check
                self.stdout.write('⚠️  todos_todo table missing - run migrations')
            else:
                self.stdout.write('✅ todos_todo table exists')
            
            # Check if learning tables exist
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'learning_section'
                );
            """)
            learning_exists = cursor.fetchone()[0]
            
            if not learning_exists:
                self.stdout.write('⚠️  learning tables missing - run migrations')
            else:
                self.stdout.write('✅ learning tables exist')
            
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
            
            self.stdout.write(self.style.SUCCESS('✅ locked_areas_with_details view created'))
            
            # Final status
            cursor.execute("SELECT COUNT(*) FROM locked_areas;")
            count = cursor.fetchone()[0]
            self.stdout.write(f'📊 locked_areas table has {count} records')
            
        self.stdout.write(self.style.SUCCESS('🎉 Production database setup complete!'))
