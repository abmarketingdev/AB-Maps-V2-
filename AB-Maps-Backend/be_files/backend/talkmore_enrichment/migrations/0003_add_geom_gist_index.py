# Generated migration to add GIST index on geom field

from django.contrib.postgres.operations import CreateExtension
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('talkmore_enrichment', '0002_alter_enrichmentjob_area'),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS enriched_address_result_geom_gist_idx ON talkmore_enriched_address_result USING GIST (geom);",
            reverse_sql="DROP INDEX IF EXISTS enriched_address_result_geom_gist_idx;",
        ),
    ]
