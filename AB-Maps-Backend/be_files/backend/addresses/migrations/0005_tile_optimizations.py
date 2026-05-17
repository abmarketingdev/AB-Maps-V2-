from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('addresses', '0004_add_geog_indexes'),
        ('areas', '0001_initial'),
    ]

    operations = [
        # Ensure PostGIS is enabled (idempotent)
        migrations.RunSQL(
            "CREATE EXTENSION IF NOT EXISTS postgis;",
            reverse_sql=migrations.RunSQL.noop
        ),
        
        # Create optimized GiST indexes for tile queries if they don't exist
        migrations.RunSQL(
            """
            DO $$
            BEGIN
              -- Index for Address position field
              IF NOT EXISTS (
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'address_position_gist'
                  AND n.nspname = 'public'
              ) THEN
                CREATE INDEX address_position_gist ON address USING GIST (position);
              END IF;

              -- Index for Area polygon_geometry field
              IF NOT EXISTS (
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'area_polygon_geometry_gist'
                  AND n.nspname = 'public'
              ) THEN
                CREATE INDEX area_polygon_geometry_gist ON area USING GIST (polygon_geometry);
              END IF;
            END$$;
            """,
            reverse_sql=migrations.RunSQL.noop
        ),
    ]
