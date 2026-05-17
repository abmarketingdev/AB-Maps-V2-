# Generated manually to add geom_3857 column and indexes for MVT tile performance

from django.db import migrations


def apply_geom_3857(apps, schema_editor):
    """
    Add geom_3857 column and indexes to admin.areas.
    Safely skips if the admin schema does not exist.
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if admin schema exists
        cursor.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'admin'"
        )
        if not cursor.fetchone():
            return

        # Check if admin.areas table exists
        cursor.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'admin' AND table_name = 'areas'"
        )
        if not cursor.fetchone():
            return

        cursor.execute("""
            -- Add geom_3857 column (Web Mercator for fast tile generation)
            ALTER TABLE admin.areas
            ADD COLUMN IF NOT EXISTS geom_3857 GEOMETRY(MULTIPOLYGON, 3857);

            -- Populate from existing geom (one-time operation)
            UPDATE admin.areas
            SET geom_3857 = ST_Transform(geom, 3857)
            WHERE geom IS NOT NULL AND geom_3857 IS NULL;

            -- Create spatial index for tile intersection (CRITICAL for performance)
            CREATE INDEX IF NOT EXISTS idx_admin_areas_geom3857
            ON admin.areas USING GIST (geom_3857);

            -- Create hierarchical filtering indexes
            CREATE INDEX IF NOT EXISTS idx_admin_areas_level_parent
            ON admin.areas(level, parent_code);

            CREATE INDEX IF NOT EXISTS idx_admin_areas_level_parentparent
            ON admin.areas(level, parent_parent_code);
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('locked_areas', '0003_add_ssb_04362_stats_to_admin_areas'),
    ]

    operations = [
        migrations.RunPython(apply_geom_3857, migrations.RunPython.noop),
    ]
