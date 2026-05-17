# Generated manually to fix missing ForeignKeys
from django.db import migrations, connection


def safe_add_foreign_keys(apps, schema_editor):
    """Safely add foreign key columns if they don't exist."""
    with connection.cursor() as cursor:
        # Check if area_id column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'area_employee' 
            AND column_name = 'area_id'
        """)
        area_id_exists = cursor.fetchone() is not None
        
        # Check if employee_id column exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'area_employee' 
            AND column_name = 'employee_id'
        """)
        employee_id_exists = cursor.fetchone() is not None
        
        # Add area_id if it doesn't exist
        if not area_id_exists:
            cursor.execute("""
                ALTER TABLE area_employee 
                ADD COLUMN area_id UUID REFERENCES area(id) ON DELETE CASCADE
            """)
            print("Added area_id column to area_employee table")
        
        # Add employee_id if it doesn't exist
        if not employee_id_exists:
            cursor.execute("""
                ALTER TABLE area_employee 
                ADD COLUMN employee_id UUID REFERENCES employee(id) ON DELETE CASCADE
            """)
            print("Added employee_id column to area_employee table")
        
        # Add unique constraint if it doesn't exist
        cursor.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'area_employee' 
            AND constraint_type = 'UNIQUE'
            AND constraint_name LIKE '%area_employee_area_id_employee_id%'
        """)
        unique_constraint_exists = cursor.fetchone() is not None
        
        if not unique_constraint_exists:
            cursor.execute("""
                ALTER TABLE area_employee 
                ADD CONSTRAINT area_employee_area_id_employee_id_unique 
                UNIQUE (area_id, employee_id)
            """)
            print("Added unique constraint to area_employee table")


def reverse_add_foreign_keys(apps, schema_editor):
    """Reverse operation - remove foreign key columns."""
    with connection.cursor() as cursor:
        # Remove unique constraint
        cursor.execute("""
            ALTER TABLE area_employee 
            DROP CONSTRAINT IF EXISTS area_employee_area_id_employee_id_unique
        """)
        
        # Remove columns
        cursor.execute("""
            ALTER TABLE area_employee 
            DROP COLUMN IF EXISTS area_id
        """)
        
        cursor.execute("""
            ALTER TABLE area_employee 
            DROP COLUMN IF EXISTS employee_id
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('areas', '0001_initial'),
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            safe_add_foreign_keys,
            reverse_add_foreign_keys,
        ),
    ]

