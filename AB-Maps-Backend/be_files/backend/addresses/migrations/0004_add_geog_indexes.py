from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("addresses", "0003_address_campaign"),
        ("uploaded_addresses", "0002_uploadedaddress_batch_sequence_and_more"),
    ]

    operations = [
        migrations.RunSQL("CREATE EXTENSION IF NOT EXISTS postgis;"),

        migrations.RunSQL(
            """
            ALTER TABLE address
            ADD COLUMN IF NOT EXISTS geog geography(Point,4326)
            GENERATED ALWAYS AS (position::geography) STORED;
            """,
            reverse_sql="ALTER TABLE address DROP COLUMN IF EXISTS geog;"
        ),
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_address_geog_gist
            ON address USING GIST (geog);
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_address_geog_gist;"
        ),

        migrations.RunSQL(
            """
            ALTER TABLE uploaded_address
            ADD COLUMN IF NOT EXISTS geog geography(Point,4326)
            GENERATED ALWAYS AS (
                CASE
                  WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                  THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                  ELSE NULL
                END
            ) STORED;
            """,
            reverse_sql="ALTER TABLE uploaded_address DROP COLUMN IF EXISTS geog;"
        ),
        migrations.RunSQL(
            """
            CREATE INDEX IF NOT EXISTS idx_uploaded_address_geog_gist
            ON uploaded_address USING GIST (geog);
            """,
            reverse_sql="DROP INDEX IF EXISTS idx_uploaded_address_geog_gist;"
        ),
    ]
