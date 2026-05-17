# Generated manually to add SSB 04362 statistics fields to admin.areas table

from django.db import migrations


def apply_admin_areas_stats(apps, schema_editor):
    """
    Add SSB statistics columns to admin.areas table.
    Safely skips if the admin schema does not exist.
    """
    with schema_editor.connection.cursor() as cursor:
        # Check if admin schema exists
        cursor.execute(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'admin'"
        )
        if not cursor.fetchone():
            # admin schema doesn't exist (e.g. test DB) — skip
            return

        # Check if admin.areas table exists
        cursor.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'admin' AND table_name = 'areas'"
        )
        if not cursor.fetchone():
            return

        # Check if admin.areas is a VIEW and convert to TABLE if needed
        cursor.execute("""
            DO $$
            DECLARE
                is_view BOOLEAN;
                has_area_key BOOLEAN;
                has_geom BOOLEAN;
                has_pk BOOLEAN;
            BEGIN
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.views
                    WHERE table_schema = 'admin'
                    AND table_name = 'areas'
                ) INTO is_view;

                IF is_view THEN
                    CREATE TABLE admin.areas_new AS
                    SELECT * FROM admin.areas;
                    DROP VIEW IF EXISTS admin.areas CASCADE;
                    ALTER TABLE admin.areas_new RENAME TO areas;

                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'admin'
                        AND table_name = 'areas'
                        AND column_name = 'area_key'
                    ) INTO has_area_key;

                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.table_constraints
                        WHERE table_schema = 'admin'
                        AND table_name = 'areas'
                        AND constraint_type = 'PRIMARY KEY'
                    ) INTO has_pk;

                    IF has_area_key AND NOT has_pk THEN
                        ALTER TABLE admin.areas ADD PRIMARY KEY (area_key);
                    END IF;

                    CREATE INDEX IF NOT EXISTS idx_admin_areas_level ON admin.areas(level);
                    CREATE INDEX IF NOT EXISTS idx_admin_areas_code ON admin.areas(code);
                    CREATE INDEX IF NOT EXISTS idx_admin_areas_level_code ON admin.areas(level, code);
                    CREATE INDEX IF NOT EXISTS idx_admin_areas_parent ON admin.areas(parent_code);
                    CREATE INDEX IF NOT EXISTS idx_admin_areas_parentparent ON admin.areas(parent_parent_code);

                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'admin'
                        AND table_name = 'areas'
                        AND column_name = 'geom'
                    ) INTO has_geom;

                    IF has_geom THEN
                        CREATE INDEX IF NOT EXISTS idx_admin_areas_geom ON admin.areas USING GIST (geom);
                    END IF;
                END IF;
            END $$;
        """)

        # Female age bins
        cursor.execute("""
            ALTER TABLE admin.areas
            ADD COLUMN IF NOT EXISTS f_0_5 INTEGER,
            ADD COLUMN IF NOT EXISTS f_6_15 INTEGER,
            ADD COLUMN IF NOT EXISTS f_16_19 INTEGER,
            ADD COLUMN IF NOT EXISTS f_20_24 INTEGER,
            ADD COLUMN IF NOT EXISTS f_25_29 INTEGER,
            ADD COLUMN IF NOT EXISTS f_30_49 INTEGER,
            ADD COLUMN IF NOT EXISTS f_50_59 INTEGER,
            ADD COLUMN IF NOT EXISTS f_60_66 INTEGER,
            ADD COLUMN IF NOT EXISTS f_67_69 INTEGER,
            ADD COLUMN IF NOT EXISTS f_70_79 INTEGER,
            ADD COLUMN IF NOT EXISTS f_80p INTEGER;
        """)

        # Male age bins
        cursor.execute("""
            ALTER TABLE admin.areas
            ADD COLUMN IF NOT EXISTS m_0_5 INTEGER,
            ADD COLUMN IF NOT EXISTS m_6_15 INTEGER,
            ADD COLUMN IF NOT EXISTS m_16_19 INTEGER,
            ADD COLUMN IF NOT EXISTS m_20_24 INTEGER,
            ADD COLUMN IF NOT EXISTS m_25_29 INTEGER,
            ADD COLUMN IF NOT EXISTS m_30_49 INTEGER,
            ADD COLUMN IF NOT EXISTS m_50_59 INTEGER,
            ADD COLUMN IF NOT EXISTS m_60_66 INTEGER,
            ADD COLUMN IF NOT EXISTS m_67_69 INTEGER,
            ADD COLUMN IF NOT EXISTS m_70_79 INTEGER,
            ADD COLUMN IF NOT EXISTS m_80p INTEGER;
        """)

        # Totals
        cursor.execute("""
            ALTER TABLE admin.areas
            ADD COLUMN IF NOT EXISTS female_total INTEGER,
            ADD COLUMN IF NOT EXISTS male_total INTEGER,
            ADD COLUMN IF NOT EXISTS population_total INTEGER;
        """)

        # Aggregates
        cursor.execute("""
            ALTER TABLE admin.areas
            ADD COLUMN IF NOT EXISTS pop_0_15 INTEGER,
            ADD COLUMN IF NOT EXISTS pop_16_29 INTEGER,
            ADD COLUMN IF NOT EXISTS pop_30_66 INTEGER,
            ADD COLUMN IF NOT EXISTS pop_67_plus INTEGER,
            ADD COLUMN IF NOT EXISTS donor_pool_adults INTEGER,
            ADD COLUMN IF NOT EXISTS donor_pool_stable INTEGER,
            ADD COLUMN IF NOT EXISTS donor_pool_seniors INTEGER;
        """)

        # Shares
        cursor.execute("""
            ALTER TABLE admin.areas
            ADD COLUMN IF NOT EXISTS share_30_66 NUMERIC(5, 4),
            ADD COLUMN IF NOT EXISTS share_67_plus NUMERIC(5, 4),
            ADD COLUMN IF NOT EXISTS female_share NUMERIC(5, 4),
            ADD COLUMN IF NOT EXISTS male_share NUMERIC(5, 4);
        """)

        # Mean age estimates
        cursor.execute("""
            ALTER TABLE admin.areas
            ADD COLUMN IF NOT EXISTS mean_age_est_total DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS mean_age_est_female DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS mean_age_est_male DOUBLE PRECISION;
        """)

        # Metadata
        cursor.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'admin'
                    AND table_name = 'areas'
                    AND column_name = 'stats_year'
                ) THEN
                    ALTER TABLE admin.areas ADD COLUMN stats_year INTEGER;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'admin'
                    AND table_name = 'areas'
                    AND column_name = 'stats_updated_at'
                ) THEN
                    ALTER TABLE admin.areas ADD COLUMN stats_updated_at TIMESTAMP WITH TIME ZONE;
                END IF;
            END $$;
        """)

        # Indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_admin_areas_level_code
            ON admin.areas (level, code);

            CREATE INDEX IF NOT EXISTS idx_admin_areas_stats_year
            ON admin.areas (stats_year);
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('locked_areas', '0002_add_ssb_age_stats_fields'),
    ]

    operations = [
        migrations.RunPython(apply_admin_areas_stats, migrations.RunPython.noop),
    ]
