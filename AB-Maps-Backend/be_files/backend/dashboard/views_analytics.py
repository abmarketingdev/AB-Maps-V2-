"""
API views for the analytics / weekly-report system.

All endpoints require authentication via JWT.
Admin = is_staff=True AND is_superuser=True.

Endpoints:
    1. AnalyticsThresholdViewSet  – CRUD for threshold red-lines
    2. PreviewAnalyticsAPIView    – JSON preview of analytics
    3. DownloadReportAPIView      – PDF download
    4. ManualTriggerReportAPIView – Generate + email report on demand
"""
import logging
from datetime import date, timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from .models import AnalyticsThreshold, AnalyticsReport
from .permissions import IsAdmin, IsAdminOrManager, IsAdminOrManagerReadOnly
from .serializers import (
    AnalyticsThresholdSerializer,
    ReportRequestSerializer,
    AnalyticsPreviewSerializer,
    ManualTriggerReportSerializer,
)
from .services.analytics_calculator import AnalyticsCalculator
from .services.threshold_evaluator import ThresholdEvaluator
from .services.pdf_generator import PDFGenerator

logger = logging.getLogger(__name__)

# lazy imports used inside views to avoid circular deps at module load
def _get_work_time_deps():
    from tracking.services import get_working_seconds_for_period, ACTIVE_THRESHOLD_SECONDS
    from users.models import Employee, Manager
    return get_working_seconds_for_period, ACTIVE_THRESHOLD_SECONDS, Employee, Manager


# ====================================================================== #
#  1. THRESHOLD CRUD                                                      #
# ====================================================================== #

class AnalyticsThresholdViewSet(viewsets.ModelViewSet):
    """
    CRUD for analytics performance thresholds.

    - **Admin (is_staff + is_superuser)**: full create / update / delete.
    - **Manager**: read-only access.
    - **Employee / unauthenticated**: denied.
    """
    serializer_class = AnalyticsThresholdSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerReadOnly]
    lookup_field = 'pk'

    def get_queryset(self):
        qs = AnalyticsThreshold.objects.select_related('manager', 'campaign', 'employee')
        # Managers can only see thresholds relevant to them
        user = self.request.user
        if not (user.is_staff and user.is_superuser):
            if hasattr(user, 'manager') and user.manager:
                qs = qs.filter(
                    scope__in=['global', 'manager'],
                ) | qs.filter(
                    scope='campaign',
                    campaign__created_by=user.manager,
                )
            else:
                qs = qs.none()
        return qs.order_by('-updated_at')

    @extend_schema(
        summary="List all thresholds",
        description="Returns all active/inactive thresholds visible to the user.",
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Create a new threshold",
        description="Admin-only. Creates a performance threshold for a scope.",
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @extend_schema(
        summary="Retrieve a single threshold",
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        summary="Update a threshold",
        description="Admin-only. Update red-line thresholds.",
    )
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @extend_schema(
        summary="Partial update a threshold",
        description="Admin-only. Partially update threshold fields.",
    )
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(
        summary="Delete a threshold",
        description="Admin-only. Permanently delete a threshold.",
    )
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


# ====================================================================== #
#  2. PREVIEW ANALYTICS  (JSON)                                           #
# ====================================================================== #

class PreviewAnalyticsAPIView(APIView):
    """
    Returns a full JSON analytics preview for the requested date range.

    The response includes summary, campaigns, employees, daily/hourly
    breakdowns, comparisons, top performers, and threshold alerts.

    **Access**: Admin or Manager (JWT required).
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    @extend_schema(
        summary="Preview analytics data (JSON)",
        description=(
            "Returns all calculated analytics for a date range, "
            "including alerts. Use this to build a dashboard or preview "
            "before downloading the PDF."
        ),
        parameters=[
            OpenApiParameter('start_date', str, required=True, description='YYYY-MM-DD'),
            OpenApiParameter('end_date', str, required=True, description='YYYY-MM-DD'),
            OpenApiParameter('campaign_ids', str, required=False, description='Comma-separated UUIDs'),
            OpenApiParameter('employee_ids', str, required=False, description='Comma-separated UUIDs'),
            OpenApiParameter('manager_id', str, required=False, description='Manager UUID'),
        ],
        responses={200: AnalyticsPreviewSerializer},
    )
    def get(self, request):
        # Parse and validate query params
        params = self._parse_params(request)
        serializer = ReportRequestSerializer(data=params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data

        # Scope narrowing for managers
        validated = self._apply_manager_scope(request.user, validated)

        try:
            calculator = AnalyticsCalculator()
            evaluator = ThresholdEvaluator()

            analytics = calculator.calculate_all(
                start_date=validated['start_date'],
                end_date=validated['end_date'],
                campaign_ids=[str(c) for c in validated.get('campaign_ids', [])],
                employee_ids=[str(e) for e in validated.get('employee_ids', [])],
                manager_id=str(validated['manager_id']) if validated.get('manager_id') else None,
            )

            alerts = evaluator.evaluate_all(analytics, validated['end_date'])

            response_data = {**analytics, 'alerts': alerts}
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error generating analytics preview: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to generate analytics preview.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @staticmethod
    def _parse_params(request) -> dict:
        """Convert GET query params to the shape ReportRequestSerializer expects."""
        data = {
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
        }
        campaign_ids = request.query_params.get('campaign_ids', '')
        if campaign_ids:
            data['campaign_ids'] = [c.strip() for c in campaign_ids.split(',') if c.strip()]

        employee_ids = request.query_params.get('employee_ids', '')
        if employee_ids:
            data['employee_ids'] = [e.strip() for e in employee_ids.split(',') if e.strip()]

        manager_id = request.query_params.get('manager_id')
        if manager_id:
            data['manager_id'] = manager_id

        return data

    @staticmethod
    def _apply_manager_scope(user, validated: dict) -> dict:
        """Restrict managers to their own team data."""
        if user.is_staff and user.is_superuser:
            return validated  # admins see everything

        if hasattr(user, 'manager') and user.manager:
            validated['manager_id'] = user.manager.pk
        return validated


# ====================================================================== #
#  3. DOWNLOAD REPORT  (PDF)                                              #
# ====================================================================== #

class DownloadReportAPIView(APIView):
    """
    Generates and downloads a PDF analytics report for the given date range.

    **Access**: Admin or Manager (JWT required).
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    @extend_schema(
        summary="Download analytics PDF report",
        description=(
            "Generates a multi-page PDF report containing charts, tables, "
            "and alerts for the requested date range. Returns the PDF as "
            "a file attachment."
        ),
        parameters=[
            OpenApiParameter('start_date', str, required=True, description='YYYY-MM-DD'),
            OpenApiParameter('end_date', str, required=True, description='YYYY-MM-DD'),
            OpenApiParameter('campaign_ids', str, required=False, description='Comma-separated UUIDs'),
            OpenApiParameter('employee_ids', str, required=False, description='Comma-separated UUIDs'),
            OpenApiParameter('manager_id', str, required=False, description='Manager UUID'),
        ],
        responses={
            200: OpenApiResponse(description="PDF file download"),
        },
    )
    def get(self, request):
        # Parse and validate
        params = PreviewAnalyticsAPIView._parse_params(request)
        serializer = ReportRequestSerializer(data=params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        validated = PreviewAnalyticsAPIView._apply_manager_scope(request.user, validated)

        try:
            calculator = AnalyticsCalculator()
            evaluator = ThresholdEvaluator()
            pdf_gen = PDFGenerator()

            # Calculate analytics
            analytics = calculator.calculate_all(
                start_date=validated['start_date'],
                end_date=validated['end_date'],
                campaign_ids=[str(c) for c in validated.get('campaign_ids', [])],
                employee_ids=[str(e) for e in validated.get('employee_ids', [])],
                manager_id=str(validated['manager_id']) if validated.get('manager_id') else None,
            )

            # Evaluate thresholds
            alerts = evaluator.evaluate_all(analytics, validated['end_date'])

            # Resolve the threshold for red-line values in graphs
            threshold = evaluator._resolve_threshold()

            # Generate PDF
            title = (
                f"Analyse Rapport: "
                f"{validated['start_date'].strftime('%d. %b %Y')} — "
                f"{validated['end_date'].strftime('%d. %b %Y')}"
            )
            pdf_buffer = pdf_gen.generate_report(
                analytics_data=analytics,
                alerts=alerts,
                threshold=threshold,
                report_title=title,
            )

            # Build HTTP response with PDF
            filename = (
                f"AB_Maps_Analytics_"
                f"{validated['start_date'].strftime('%Y%m%d')}_"
                f"{validated['end_date'].strftime('%Y%m%d')}.pdf"
            )
            response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        except Exception as e:
            logger.error(f"Error generating PDF report: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to generate PDF report.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ====================================================================== #
#  4. MANUAL TRIGGER  (generate + email)                                  #
# ====================================================================== #

class ManualTriggerReportAPIView(APIView):
    """
    Admin-only endpoint to manually trigger a weekly analytics report.

    This generates the report for the past 7 days and sends it via email
    to the configured AvtaleGiro email (atavelgiro@absystem.no).

    **Access**: Admin only (is_staff + is_superuser).
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        summary="Manually trigger & email a report",
        description=(
            "Admin-only. Generates the analytics report for the last 7 days "
            "and emails it as a PDF attachment to the specified recipient(s). "
            "Requires at least one recipient email address in the request body."
        ),
        request=ManualTriggerReportSerializer,
        responses={
            200: OpenApiResponse(description="Report sent successfully"),
            400: OpenApiResponse(description="Invalid request (missing or invalid emails)"),
            500: OpenApiResponse(description="Email delivery failed"),
        },
    )
    def post(self, request):
        import time
        from django.conf import settings
        
        # Validate request data
        serializer = ManualTriggerReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Invalid request', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        recipient_emails = serializer.validated_data['recipient_emails']
        
        start_time = time.time()
        report = None
        
        try:
            end_date = date.today() - timedelta(days=1)  # yesterday
            start_date = end_date - timedelta(days=6)      # 7-day window

            # Store recipient emails as comma-separated string
            recipient_emails_str = ', '.join(recipient_emails)

            # Create report record (status='pending' initially)
            report = AnalyticsReport.objects.create(
                start_date=start_date,
                end_date=end_date,
                source='manual',
                status='pending',
                recipient_email=recipient_emails_str,
            )

            calculator = AnalyticsCalculator()
            evaluator = ThresholdEvaluator()
            pdf_gen = PDFGenerator()

            # Calculate
            analytics = calculator.calculate_all(
                start_date=start_date,
                end_date=end_date,
            )
            alerts = evaluator.evaluate_all(analytics, end_date)
            threshold = evaluator._resolve_threshold()

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

            # Prepare email subject
            email_subject = (
                f"AB Maps Ukentlig Analyse Rapport — "
                f"{start_date.strftime('%d. %b')} til {end_date.strftime('%d. %b %Y')}"
            )

            # Send email to all recipients
            self._send_report_email(pdf_buffer, start_date, end_date, analytics, alerts, email_subject, recipient_emails)

            # Calculate execution time
            execution_time = time.time() - start_time

            # Get summary metrics
            summary = analytics.get('summary', {})
            critical_alerts = [a for a in alerts if a.get('severity') == 'critical']

            # Update report record with success
            report.status = 'success'
            report.sent_at = timezone.now()
            report.email_subject = email_subject
            report.total_doors = summary.get('total_doors', 0)
            report.unique_workers = summary.get('unique_employees', 0)  # This includes both employees and managers
            report.alerts_count = len(alerts)
            report.critical_alerts_count = len(critical_alerts)
            report.execution_time_seconds = round(execution_time, 2)
            report.pdf_size_bytes = pdf_size
            report.save()

            return Response({
                'status': 'success',
                'message': 'Report generated and sent successfully.',
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                },
                'summary': {
                    'total_doors': summary.get('total_doors', 0),
                    'alerts_count': len(alerts),
                },
                'report_id': str(report.id),
            }, status=status.HTTP_200_OK)

        except Exception as e:
            execution_time = time.time() - start_time if 'start_time' in locals() else 0
            
            # Update report record with failure
            if report:
                report.status = 'failed'
                report.error_message = str(e)
                report.execution_time_seconds = round(execution_time, 2)
                report.save()
            
            logger.error(f"Error in manual report trigger: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to generate / send report: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @staticmethod
    def _send_report_email(pdf_buffer, start_date, end_date, analytics, alerts, subject=None, recipient_emails=None):
        """Send the PDF as an email attachment to multiple recipients with HTML template."""
        from django.core.mail import EmailMultiAlternatives
        from django.template.loader import render_to_string
        from django.conf import settings
        from django.utils import timezone
        from datetime import timedelta

        summary = analytics.get('summary', {})
        critical_count = len([a for a in alerts if a.get('severity') == 'critical'])

        if subject is None:
            subject = (
                f"AB Maps Ukentlig Analyse Rapport — "
                f"{start_date.strftime('%d. %b')} til {end_date.strftime('%d. %b %Y')}"
            )

        # Use provided recipient emails or fall back to settings
        if recipient_emails is None:
            default_email = getattr(settings, 'ANALYTICS_REPORT_EMAIL', 'atavelgiro@absystem.no')
            recipient_emails = [default_email]

        # Calculate period days
        period_days = (end_date - start_date).days + 1

        # Prepare context for HTML template
        context = {
            'start_date': start_date,
            'end_date': end_date,
            'total_doors': summary.get('total_doors', 0),
            'yes_rate': summary.get('yes_rate', 0),
            'contact_rate': summary.get('contact_rate', 0),
            'unique_workers': summary.get('unique_employees', 0),  # Includes both employees and managers
            'alerts_count': len(alerts),
            'critical_alerts_count': critical_count,
            'period_days': period_days,
            'generated_at': timezone.now(),
            'current_year': timezone.now().year,
        }

        # Render HTML email template
        html_body = render_to_string('emails/weekly_analytics_report.html', context)

        # Create plain text fallback
        text_body = f"""Hei,

Vedlagt finner du den ukentlige analyse rapporten for AB Maps.

📊 Oppsummering:
  • Dører Banket: {summary.get('total_doors', 0):,}
  • Ja-Rate: {summary.get('yes_rate', 0):.1f}%
  • Kontakt Rate: {summary.get('contact_rate', 0):.1f}%
  • Aktive Arbeidere: {summary.get('unique_employees', 0)}
  • Varsler: {len(alerts)} ({critical_count} kritiske)

Rapporteringsperiode: {start_date.strftime('%d. %b %Y')} — {end_date.strftime('%d. %b %Y')}

Den fullstendige rapporten med grafer og detaljert analyse er vedlagt som PDF-fil.

Med vennlig hilsen,
AB Maps Analyse System
"""

        # Create email with both HTML and plain text
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_body,  # Plain text fallback
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'admin@absystem.no'),
            to=recipient_emails,
        )
        email.attach_alternative(html_body, 'text/html')  # HTML version

        # Attach PDF
        filename = (
            f"AB_Maps_Analytics_"
            f"{start_date.strftime('%Y%m%d')}_"
            f"{end_date.strftime('%Y%m%d')}.pdf"
        )
        pdf_buffer.seek(0)
        email.attach(filename, pdf_buffer.read(), 'application/pdf')
        email.send(fail_silently=False)

        logger.info(f"Weekly report sent to {', '.join(recipient_emails)}")


# ====================================================================== #
#  5. WORK-TIME STATS                                                      #
# ====================================================================== #

class WorkTimeStatsAPIView(APIView):
    """
    Returns per-actor working-time stats for a date range plus aggregate
    summaries across employees and managers.

    **Access**: Admin or Manager (JWT required).
    Managers are scoped to their own team; admins see all.

    Query params: start_date, end_date (YYYY-MM-DD, required).
    """
    permission_classes = [IsAuthenticated, IsAdminOrManager]

    @extend_schema(
        summary="Working-time stats for employees & managers",
        description=(
            "Returns aggregate working-time statistics (active %, avg daily "
            "seconds/minutes) for employees, managers, and combined, plus "
            "a per-actor breakdown for the requested date range."
        ),
        parameters=[
            OpenApiParameter('start_date', str, required=True, description='YYYY-MM-DD'),
            OpenApiParameter('end_date', str, required=True, description='YYYY-MM-DD'),
            OpenApiParameter('campaign_ids', str, required=False, description='Comma-separated campaign UUIDs; filters to members of those campaigns'),
            OpenApiParameter('employee_ids', str, required=False, description='Comma-separated UUIDs'),
            OpenApiParameter('manager_id', str, required=False, description='Manager UUID'),
        ],
        responses={200: OpenApiResponse(description="Work-time stats JSON")},
    )
    def get(self, request):
        params = PreviewAnalyticsAPIView._parse_params(request)
        serializer = ReportRequestSerializer(data=params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated = serializer.validated_data
        validated = PreviewAnalyticsAPIView._apply_manager_scope(request.user, validated)

        start_date = validated['start_date']
        end_date = validated['end_date']
        campaign_ids = [str(c) for c in validated.get('campaign_ids', [])]
        employee_ids = [str(e) for e in validated.get('employee_ids', [])]
        manager_id = str(validated['manager_id']) if validated.get('manager_id') else None

        try:
            get_working_seconds_for_period, ACTIVE_THRESHOLD_SECONDS, Employee, Manager = _get_work_time_deps()
            from campaigns.models import CampaignEmployee  # noqa: PLC0415

            period_days = (end_date - start_date).days + 1

            emp_qs = Employee.objects.all()
            if campaign_ids:
                emp_qs = emp_qs.filter(
                    campaign_assignments__campaign_id__in=campaign_ids
                ).distinct()
            if employee_ids:
                emp_qs = emp_qs.filter(id__in=employee_ids)

            employees_out = []
            for emp in emp_qs:
                secs = get_working_seconds_for_period(start_date, end_date, employee=emp)
                employees_out.append({
                    'id': str(emp.id),
                    'name': emp.name,
                    'total_seconds': secs,
                    'total_minutes': round(secs / 60, 1),
                    'avg_daily_seconds': round(secs / period_days, 1) if period_days else 0,
                    'avg_daily_minutes': round(secs / 60 / period_days, 1) if period_days else 0,
                    'is_active': secs > ACTIVE_THRESHOLD_SECONDS,
                })

            mgr_qs = Manager.objects.all()
            if campaign_ids:
                mgr_qs = mgr_qs.filter(
                    campaign_assignments__campaign_id__in=campaign_ids
                ).distinct()
            if manager_id:
                mgr_qs = mgr_qs.filter(id=manager_id)

            managers_out = []
            for mgr in mgr_qs:
                secs = get_working_seconds_for_period(start_date, end_date, manager=mgr)
                managers_out.append({
                    'id': str(mgr.id),
                    'name': mgr.name,
                    'total_seconds': secs,
                    'total_minutes': round(secs / 60, 1),
                    'avg_daily_seconds': round(secs / period_days, 1) if period_days else 0,
                    'avg_daily_minutes': round(secs / 60 / period_days, 1) if period_days else 0,
                    'is_active': secs > ACTIVE_THRESHOLD_SECONDS,
                })

            def _agg(actor_list):
                total = len(actor_list)
                active = sum(1 for a in actor_list if a['is_active'])
                all_secs = sum(a['total_seconds'] for a in actor_list)
                avg_daily_secs = round(all_secs / (total * period_days), 1) if total and period_days else 0
                return {
                    'total': total,
                    'active_count': active,
                    'active_pct': round((active / total) * 100, 1) if total else 0.0,
                    'avg_daily_seconds': avg_daily_secs,
                    'avg_daily_minutes': round(avg_daily_secs / 60, 1),
                }

            combined = employees_out + managers_out
            return Response({
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'days': period_days,
                },
                'active_threshold_seconds': ACTIVE_THRESHOLD_SECONDS,
                'aggregate': {
                    'employees': _agg(employees_out),
                    'managers': _agg(managers_out),
                    'combined': _agg(combined),
                },
                'employees': employees_out,
                'managers': managers_out,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error generating work-time stats: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to generate work-time stats.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
