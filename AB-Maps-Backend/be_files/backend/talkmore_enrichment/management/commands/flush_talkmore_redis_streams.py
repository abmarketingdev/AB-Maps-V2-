"""
Fix B: Clear stale Talkmore enrichment data from Redis.

Use when Worker D loops on "EnrichmentJob ... not found" — usually after DB reset,
deleted areas, or pointing workers at a different database than before.

Stop ALL workers (A–D) before running, then restart them. Consumer groups are
recreated automatically on next read.

Usage:
    python manage.py flush_talkmore_redis_streams --yes
"""
import logging

from django.core.management.base import BaseCommand

from talkmore_enrichment.services.redis_streams import (
    STREAM_JOB_INGEST,
    STREAM_ADDR_DISCOVERY,
    STREAM_ADDR_ENRICH_1881,
    STREAM_FINAL_WRITE,
    STREAM_DEADLETTER_JOB_INGEST,
    STREAM_DEADLETTER_ADDR_DISCOVERY,
    STREAM_DEADLETTER_ADDR_ENRICH_1881,
    STREAM_DEADLETTER_FINAL_WRITE,
    get_redis_client,
)

logger = logging.getLogger(__name__)

ALL_STREAMS = (
    STREAM_JOB_INGEST,
    STREAM_ADDR_DISCOVERY,
    STREAM_ADDR_ENRICH_1881,
    STREAM_FINAL_WRITE,
    STREAM_DEADLETTER_JOB_INGEST,
    STREAM_DEADLETTER_ADDR_DISCOVERY,
    STREAM_DEADLETTER_ADDR_ENRICH_1881,
    STREAM_DEADLETTER_FINAL_WRITE,
)


class Command(BaseCommand):
    help = (
        "Delete Talkmore pipeline Redis streams (pending + history). "
        "Stop workers A–D first. Requires --yes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Confirm deletion (required)",
        )

    def handle(self, *args, **options):
        if not options["yes"]:
            self.stdout.write(
                self.style.ERROR(
                    "Refusing to delete streams without --yes. "
                    "Stop workers A–D, then run:\n"
                    "  python manage.py flush_talkmore_redis_streams --yes"
                )
            )
            return

        client = get_redis_client()
        deleted = []
        missing = []

        for name in ALL_STREAMS:
            try:
                n = client.delete(name)
                if n:
                    deleted.append(name)
                    self.stdout.write(self.style.SUCCESS(f"Deleted {name}"))
                else:
                    missing.append(name)
                    self.stdout.write(f"  (not present) {name}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error deleting {name}: {e}"))
                raise

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Removed {len(deleted)} stream(s). "
                "Restart workers A, B, C, D. New Talkmore areas will enqueue fresh jobs."
            )
        )
        if missing:
            logger.info("Streams that did not exist: %s", missing)
