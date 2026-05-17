# Generated migration to add additional optimization indexes

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('talkmore_enrichment', '0003_add_geom_gist_index'),
    ]

    operations = [
        # Add index on status for EnrichedAddressResult (useful for filtering by status)
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS enriched_address_result_status_idx ON talkmore_enriched_address_result (status) WHERE status IN ('done', 'no_data', 'failed');",
            reverse_sql="DROP INDEX IF EXISTS enriched_address_result_status_idx;",
        ),
        # Add index on created_at for EnrichmentJob (useful for querying recent jobs)
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS enrichment_job_created_at_idx ON talkmore_enrichment_job (created_at DESC);",
            reverse_sql="DROP INDEX IF EXISTS enrichment_job_created_at_idx;",
        ),
        # Add index on campaign_id for EnrichmentJob (useful for filtering by campaign)
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS enrichment_job_campaign_id_idx ON talkmore_enrichment_job (campaign_id);",
            reverse_sql="DROP INDEX IF EXISTS enrichment_job_campaign_id_idx;",
        ),
        # Add index on expires_at for PhoneCarrierCache (useful for cache cleanup)
        migrations.RunSQL(
            sql="CREATE INDEX IF NOT EXISTS phone_carrier_cache_expires_at_idx ON talkmore_phone_carrier_cache (expires_at) WHERE expires_at IS NOT NULL;",
            reverse_sql="DROP INDEX IF EXISTS phone_carrier_cache_expires_at_idx;",
        ),
    ]
