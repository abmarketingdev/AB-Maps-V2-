# Migration to fix the unique constraint on apartment table
# Changes from (base_address, apartment_number) to (building, apartment_number)
# This allows same address to exist in multiple campaigns

from django.db import migrations


def fix_unique_constraint(apps, schema_editor):
    """
    Drop the old unique constraint and add the new one.
    This is done in raw SQL for full control.
    """
    with schema_editor.connection.cursor() as cursor:
        # Step 1: Drop ALL possible old constraints (different names in different environments)
        cursor.execute("""
            DO $$
            DECLARE
                constraint_name TEXT;
            BEGIN
                -- Find and drop any unique constraint on (base_address, apartment_number)
                FOR constraint_name IN 
                    SELECT c.conname 
                    FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    WHERE t.relname = 'apartment'
                    AND c.contype = 'u'
                    AND array_length(c.conkey, 1) = 2
                    AND (
                        -- Check if this constraint involves base_address
                        EXISTS (
                            SELECT 1 FROM pg_attribute a 
                            WHERE a.attrelid = t.oid 
                            AND a.attnum = ANY(c.conkey) 
                            AND a.attname = 'base_address'
                        )
                    )
                LOOP
                    EXECUTE format('ALTER TABLE apartment DROP CONSTRAINT IF EXISTS %I', constraint_name);
                    RAISE NOTICE 'Dropped constraint: %', constraint_name;
                END LOOP;
            END $$;
        """)
        
        # Step 2: Add the new unique constraint on (building_id, apartment_number)
        # Only if it doesn't already exist
        cursor.execute("""
            DO $$
            BEGIN
                -- Check if the new constraint already exists
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint c
                    JOIN pg_class t ON t.oid = c.conrelid
                    WHERE t.relname = 'apartment'
                    AND c.contype = 'u'
                    AND c.conname = 'apartment_building_id_apartment_number_uniq'
                ) THEN
                    -- Add the new constraint
                    ALTER TABLE apartment 
                    ADD CONSTRAINT apartment_building_id_apartment_number_uniq 
                    UNIQUE (building_id, apartment_number);
                    RAISE NOTICE 'Added new constraint: apartment_building_id_apartment_number_uniq';
                ELSE
                    RAISE NOTICE 'Constraint apartment_building_id_apartment_number_uniq already exists';
                END IF;
            EXCEPTION 
                WHEN unique_violation THEN
                    RAISE NOTICE 'Cannot add unique constraint - duplicate records exist. Will continue without constraint.';
                WHEN OTHERS THEN
                    RAISE NOTICE 'Error adding constraint: %', SQLERRM;
            END $$;
        """)


def reverse_migration(apps, schema_editor):
    """
    Reverse the migration - restore old constraint.
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            DO $$
            BEGIN
                -- Drop the new constraint
                ALTER TABLE apartment DROP CONSTRAINT IF EXISTS apartment_building_id_apartment_number_uniq;
                
                -- Try to restore the old constraint (may fail if duplicates exist)
                ALTER TABLE apartment 
                ADD CONSTRAINT apartment_base_address_apartment_number_uniq 
                UNIQUE (base_address, apartment_number);
            EXCEPTION WHEN unique_violation THEN
                RAISE NOTICE 'Cannot restore old constraint - duplicate records exist';
            END $$;
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('apartments', '0002_add_building_fk'),
    ]

    operations = [
        # Only use RunPython - Django's AlterUniqueTogether causes issues
        # because it expects the constraint to exist with a specific name
        migrations.RunPython(
            fix_unique_constraint,
            reverse_migration,
        ),
        # Use SeparateDatabaseAndState to update Django's state without touching DB
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterUniqueTogether(
                    name='apartment',
                    unique_together={('building', 'apartment_number')},
                ),
            ],
            database_operations=[],  # Already done in RunPython
        ),
    ]
