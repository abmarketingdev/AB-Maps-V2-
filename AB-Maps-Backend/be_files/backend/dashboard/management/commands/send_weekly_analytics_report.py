"""
Management command to send weekly analytics report via cron job.

This command:
- Calculates analytics for the previous 7 days
- Generates PDF report
- Sends email to atavelgiro@absystem.no
- Tracks the report in AnalyticsReport model
- Prevents duplicate sends for the same date range

Usage:
    python manage.py send_weekly_analytics_report

Schedule: Every Monday at 9 AM UTC (configured in render.yaml)
"""
import time
import logging
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings

from dashboard.models import AnalyticsReport
from dashboard.services.analytics_calculator import AnalyticsCalculator
from dashboard.services.threshold_evaluator import ThresholdEvaluator
from dashboard.services.pdf_generator import PDFGenerator
from dashboard.views_analytics import ManualTriggerReportAPIView

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Generate and send weekly analytics report via email'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force send even if report already exists for this period',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Generate report but do not send email (for testing)',
        )

    def handle(self, *args, **options):
        start_time = time.time()
        report = None
        force = options.get('force', False)
        dry_run = options.get('dry_run', False)

        try:
            # Calculate date range (last 7 days)
            end_date = date.today() - timedelta(days=1)  # yesterday
            start_date = end_date - timedelta(days=6)    # 7-day window

            self.stdout.write(
                f"Generating weekly analytics report for {start_date} to {end_date}"
            )

            # Check if report already exists for this period
            if not force:
                existing = AnalyticsReport.objects.filter(
                    start_date=start_date,
                    end_date=end_date,
                    source='cron',
                    status='success'
                ).first()

                if existing:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Report already sent for {start_date} to {end_date}. "
                            f"Use --force to send again."
                        )
                    )
                    self.stdout.write(
                        f"Existing report ID: {existing.id}, sent at: {existing.sent_at}"
                    )
                    return

            # Get recipient email (hardcoded for cron job)
            recipient_email = getattr(settings, 'ANALYTICS_REPORT_EMAIL', 'atavelgiro@absystem.no')

            # Create report record (status='pending' initially)
            report = AnalyticsReport.objects.create(
                start_date=start_date,
                end_date=end_date,
                source='cron',
                status='pending',
                recipient_email=recipient_email,
            )

            self.stdout.write("Calculating analytics...")
            calculator = AnalyticsCalculator()
            evaluator = ThresholdEvaluator()
            pdf_gen = PDFGenerator()

            # Calculate analytics
            analytics = calculator.calculate_all(
                start_date=start_date,
                end_date=end_date,
            )
            alerts = evaluator.evaluate_all(analytics, end_date)
            threshold = evaluator._resolve_threshold()

            self.stdout.write("Generating PDF...")
            title = (
                f"Ukentlig Analyse Rapport: "
                f"{start_date.strftime('%d. %b %Y')} — "
                f"{end_date.strftime('%d. %b %Y')}"
            )
            pdf_buffer = pdf_gen.generate_report(
                analytics_data=analytics,
                alerts=alerts,
                threshold=threshold,
                report_title=title,
            )

            # Get PDF size
            pdf_buffer.seek(0, 2)  # Seek to end
            pdf_size = pdf_buffer.tell()
            pdf_buffer.seek(0)  # Reset to beginning

            # Prepare email subject (Norwegian)
            email_subject = (
                f"AB Maps Ukentlig Analyse Rapport — "
                f"{start_date.strftime('%d. %b')} til {end_date.strftime('%d. %b %Y')}"
            )

            # Send email (unless dry-run)
            if not dry_run:
                self.stdout.write(f"Sending email to {recipient_email}...")
                ManualTriggerReportAPIView._send_report_email(
                    pdf_buffer,
                    start_date,
                    end_date,
                    analytics,
                    alerts,
                    email_subject,
                    [recipient_email]  # Single recipient for cron job
                )
                self.stdout.write(self.style.SUCCESS(f"Email sent successfully to {recipient_email}"))
            else:
                self.stdout.write(self.style.WARNING("DRY RUN: Email not sent"))

            # Calculate execution time
            execution_time = time.time() - start_time

            # Get summary metrics
            summary = analytics.get('summary', {})
            critical_alerts = [a for a in alerts if a.get('severity') == 'critical']

            # Update report record with success
            report.status = 'success' if not dry_run else 'pending'
            report.sent_at = timezone.now() if not dry_run else None
            report.email_subject = email_subject
            report.total_doors = summary.get('total_doors', 0)
            report.unique_workers = summary.get('unique_employees', 0)  # Includes both employees and managers
            report.alerts_count = len(alerts)
            report.critical_alerts_count = len(critical_alerts)
            report.execution_time_seconds = round(execution_time, 2)
            report.pdf_size_bytes = pdf_size
            report.save()

            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Report generated successfully!\n"
                f"   Period: {start_date} to {end_date}\n"
                f"   Total Doors: {summary.get('total_doors', 0):,}\n"
                f"   Alerts: {len(alerts)} ({len(critical_alerts)} critical)\n"
                f"   Execution Time: {execution_time:.2f}s\n"
                f"   PDF Size: {pdf_size:,} bytes\n"
                f"   Report ID: {report.id}"
            ))

        except Exception as e:
            execution_time = time.time() - start_time if 'start_time' in locals() else 0

            # Update report record with failure
            if report:
                report.status = 'failed'
                report.error_message = str(e)
                report.execution_time_seconds = round(execution_time, 2)
                report.save()

            self.stdout.write(
                self.style.ERROR(f"\n❌ Error generating/sending report: {str(e)}")
            )
            logger.error(f"Error in weekly analytics report cron job: {e}", exc_info=True)
            raise
