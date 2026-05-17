# Generated migration to add GIST index on polygon_geometry::geography
# This index optimizes ST_DWithin queries in the nearby endpoint

from django.db import migrations, connection


def create_geography_index(apps, schema_editor):
    """Create GIST index on polygon_geometry::geography for spatial queries."""
    with connection.cursor() as cursor:
        # Check if index already exists
        cursor.execute("""
            SELECT 1 
            FROM pg_indexes 
            WHERE indexname = 'area_polygon_geog_gix'
        """)
        if cursor.fetchone():
            # Index already exists, skip
            return
        
        # Create the GIST index on the geography cast
        cursor.execute("""
            CREATE INDEX area_polygon_geog_gix
            ON area
            USING GIST ((polygon_geometry::geography))
        """)


def drop_geography_index(apps, schema_editor):
    """Drop the GIST index on polygon_geometry::geography."""
    with connection.cursor() as cursor:
        cursor.execute("""
            DROP INDEX IF EXISTS area_polygon_geog_gix
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('areas', '0006_add_manager_to_area_employee'),
    ]

    operations = [
        migrations.RunPython(
            create_geography_index,
            drop_geography_index,
        ),
    ]

