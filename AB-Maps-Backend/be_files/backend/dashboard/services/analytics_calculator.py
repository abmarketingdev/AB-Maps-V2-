"""
Analytics Calculator Service

Calculates all performance metrics from the Address table (single source of truth).
Every door knocked = one Address record.
Statuses: 'ja', 'nei', 'ikke_hjemme', 'folg_opp'.

All calculations are pure queries — no caching, no side effects.
"""
import statistics
from collections import defaultdict
from datetime import date, datetime, timedelta, time
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.db.models import Count, Q, F
from django.db.models.functions import TruncDate, TruncHour, ExtractHour
from django.utils import timezone

from addresses.models import Address
from campaigns.models import Campaign, CampaignEmployee
from users.models import Employee, Manager


TALKMORE_NEI_KEYS = (
    'ikke_interessert',
    'darlig_erfaring',
    'bindingstid',
    'bedrift',
    'pris',
    'eksisterende_kunde',
)


class AnalyticsCalculator:
    """
    Stateless service that queries the Address table and returns
    structured analytics dictionaries.
    """

    # ------------------------------------------------------------------ #
    #  PUBLIC API                                                         #
    # ------------------------------------------------------------------ #

    def calculate_all(
        self,
        start_date: date,
        end_date: date,
        campaign_ids: Optional[List[str]] = None,
        employee_ids: Optional[List[str]] = None,
        manager_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Master entry-point: calculate every metric for the given filters.

        Returns a dictionary with sections:
            summary, campaigns, employees, daily_breakdown, hourly_breakdown,
            comparisons, top_performers, insights
        """
        # Build base queryset ------------------------------------------------
        qs = self._build_queryset(start_date, end_date, campaign_ids, employee_ids, manager_id)

        # Previous period for comparison (same duration, immediately before)
        period_days = (end_date - start_date).days + 1
        prev_start = start_date - timedelta(days=period_days)
        prev_end = start_date - timedelta(days=1)
        prev_qs = self._build_queryset(prev_start, prev_end, campaign_ids, employee_ids, manager_id)

        # Calculate sections --------------------------------------------------
        summary = self._calculate_summary(qs, period_days)
        prev_summary = self._calculate_summary(prev_qs, period_days)

        campaigns = self._calculate_campaign_breakdown(qs)
        employees = self._calculate_employee_breakdown(qs, start_date, end_date)
        daily_breakdown = self._calculate_daily_breakdown(qs)
        hourly_breakdown = self._calculate_hourly_breakdown(qs)

        comparisons = self._calculate_comparisons(summary, prev_summary)
        top_performers = self._identify_top_performers(employees)
        work_time_summary = self._calculate_work_time_summary(
            start_date, end_date, employee_ids, manager_id
        )

        return {
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': period_days,
            },
            'summary': summary,
            'previous_period_summary': prev_summary,
            'comparisons': comparisons,
            'campaigns': campaigns,
            'employees': employees,
            'daily_breakdown': daily_breakdown,
            'hourly_breakdown': hourly_breakdown,
            'top_performers': top_performers,
            'work_time_summary': work_time_summary,
        }

    # ------------------------------------------------------------------ #
    #  INDIVIDUAL METRIC CALCULATORS                                      #
    # ------------------------------------------------------------------ #

    def calculate_employee_metrics(
        self,
        employee_id: str,
        start_date: date,
        end_date: date,
        campaign_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Calculate detailed metrics for a single employee."""
        qs = self._build_queryset(start_date, end_date, campaign_ids, employee_ids=[employee_id])
        total = qs.count()
        if total == 0:
            return self._empty_employee_metrics(employee_id, start_date, end_date)

        status_counts = self._status_counts(qs)
        period_days = (end_date - start_date).days + 1
        daily_counts = self._daily_door_counts(qs)

        return {
            'employee_id': employee_id,
            'period': {'start_date': start_date.isoformat(), 'end_date': end_date.isoformat()},
            'total_doors': total,
            'doors_per_day': round(total / period_days, 1) if period_days > 0 else 0,
            'status_counts': status_counts,
            'yes_rate': self._percent(status_counts.get('ja', 0), total),
            'no_rate': self._percent(status_counts.get('nei', 0), total),
            'not_home_rate': self._percent(status_counts.get('ikke_hjemme', 0), total),
            'follow_up_rate': self._percent(status_counts.get('folg_opp', 0), total),
            'contact_rate': self._percent(
                total - status_counts.get('ikke_hjemme', 0), total
            ),
            'daily_door_counts': daily_counts,
            'consistency_score': self._consistency_score(daily_counts),
            'best_day': max(daily_counts.items(), key=lambda x: x[1]) if daily_counts else None,
            'worst_day': min(daily_counts.items(), key=lambda x: x[1]) if daily_counts else None,
        }

    def calculate_consecutive_day_stats(
        self,
        employee_id: str,
        end_date: date,
        lookback_days: int = 7,
        min_doors_threshold: int = 70,
        min_yes_rate_threshold: float = 30.0,
        worker_type: str = 'employee',
    ) -> Dict[str, Any]:
        """
        Check for consecutive days where a worker (employee or manager) is below thresholds.
        Looks back `lookback_days` from `end_date`.

        Parameters:
            employee_id: The ID of the employee or manager
            worker_type: 'employee' or 'manager' to determine which field to filter on

        Returns:
            consecutive_low_doors: int (number of consecutive recent days below door threshold)
            consecutive_low_yes_rate: int (same for yes-rate)
            daily_details: list of per-day dicts
        """
        start_date = end_date - timedelta(days=lookback_days - 1)
        if worker_type == 'manager':
            qs = Address.objects.filter(
                manager_id=employee_id,
                recorded_at__date__gte=start_date,
                recorded_at__date__lte=end_date,
            )
        else:
            qs = Address.objects.filter(
                employee_id=employee_id,
                recorded_at__date__gte=start_date,
                recorded_at__date__lte=end_date,
            )

        # Build day-by-day stats
        daily_details = []
        for offset in range(lookback_days):
            day = start_date + timedelta(days=offset)
            day_qs = qs.filter(recorded_at__date=day)
            total = day_qs.count()
            ja_count = day_qs.filter(status='ja').count()
            yes_rate = round((ja_count / total) * 100, 2) if total > 0 else 0.0
            daily_details.append({
                'date': day.isoformat(),
                'doors': total,
                'ja': ja_count,
                'yes_rate': yes_rate,
                'below_doors_threshold': total < min_doors_threshold if total > 0 else False,
                'below_yes_rate_threshold': yes_rate < min_yes_rate_threshold if total > 0 else False,
            })

        # Count consecutive bad days (from most recent going backwards)
        consecutive_low_doors = 0
        consecutive_low_yes_rate = 0

        for detail in reversed(daily_details):
            # Only count days where the employee actually worked
            if detail['doors'] == 0:
                break  # non-working day resets the streak
            if detail['below_doors_threshold']:
                consecutive_low_doors += 1
            else:
                break

        for detail in reversed(daily_details):
            if detail['doors'] == 0:
                break
            if detail['below_yes_rate_threshold']:
                consecutive_low_yes_rate += 1
            else:
                break

        return {
            'employee_id': employee_id,
            'lookback_days': lookback_days,
            'consecutive_low_doors': consecutive_low_doors,
            'consecutive_low_yes_rate': consecutive_low_yes_rate,
            'daily_details': daily_details,
        }

    # ------------------------------------------------------------------ #
    #  PRIVATE HELPERS — queryset builders                                #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_queryset(
        start_date: date,
        end_date: date,
        campaign_ids: Optional[List[str]] = None,
        employee_ids: Optional[List[str]] = None,
        manager_id: Optional[str] = None,
    ):
        """Build the filtered Address queryset for a date range."""
        start_dt = timezone.make_aware(datetime.combine(start_date, time.min))
        end_dt = timezone.make_aware(datetime.combine(end_date, time.max))

        qs = Address.objects.filter(recorded_at__range=(start_dt, end_dt))

        if campaign_ids:
            qs = qs.filter(campaign_id__in=campaign_ids)
        if employee_ids:
            qs = qs.filter(employee_id__in=employee_ids)
        if manager_id:
            qs = qs.filter(manager_id=manager_id)

        return qs

    # ------------------------------------------------------------------ #
    #  PRIVATE HELPERS — metric calculations                              #
    # ------------------------------------------------------------------ #

    def _calculate_summary(self, qs, period_days: int) -> Dict[str, Any]:
        """Aggregate summary across the entire queryset."""
        total = qs.count()
        if total == 0:
            return self._empty_summary(period_days)

        status_counts = self._status_counts(qs)
        ja = status_counts.get('ja', 0)
        nei = status_counts.get('nei', 0)
        ikke_hjemme = status_counts.get('ikke_hjemme', 0)
        folg_opp = status_counts.get('folg_opp', 0)
        contacted = total - ikke_hjemme

        # Count both employees and managers (all workers) - ONLY those assigned to campaigns
        # Get IDs of employees/managers who have campaign assignments
        assigned_employee_ids = set(
            CampaignEmployee.objects.exclude(employee__isnull=True)
            .values_list('employee_id', flat=True)
            .distinct()
        )
        assigned_manager_ids = set(
            CampaignEmployee.objects.exclude(manager__isnull=True)
            .values_list('manager_id', flat=True)
            .distinct()
        )
        
        # Count only workers who are assigned to campaigns
        unique_employees = qs.exclude(employee__isnull=True).filter(
            employee_id__in=assigned_employee_ids
        ).values('employee').distinct().count()
        unique_managers = qs.exclude(manager__isnull=True).filter(
            manager_id__in=assigned_manager_ids
        ).values('manager').distinct().count()
        unique_workers = unique_employees + unique_managers

        return {
            'total_doors': total,
            'doors_per_day': round(total / period_days, 1) if period_days > 0 else 0,
            'status_counts': status_counts,
            'ja': ja,
            'nei': nei,
            'ikke_hjemme': ikke_hjemme,
            'folg_opp': folg_opp,
            'yes_rate': self._percent(ja, total),
            'no_rate': self._percent(nei, total),
            'not_home_rate': self._percent(ikke_hjemme, total),
            'follow_up_rate': self._percent(folg_opp, total),
            'contact_rate': self._percent(contacted, total),
            'unique_employees': unique_workers,  # Includes both employees and managers
            'avg_doors_per_employee': (
                round(total / unique_workers, 1) if unique_workers > 0 else 0
            ),
            'period_days': period_days,
        }

    def _empty_summary(self, period_days: int) -> Dict[str, Any]:
        return {
            'total_doors': 0,
            'doors_per_day': 0,
            'status_counts': {'ja': 0, 'nei': 0, 'ikke_hjemme': 0, 'folg_opp': 0},
            'ja': 0, 'nei': 0, 'ikke_hjemme': 0, 'folg_opp': 0,
            'yes_rate': 0.0, 'no_rate': 0.0,
            'not_home_rate': 0.0, 'follow_up_rate': 0.0,
            'contact_rate': 0.0,
            'unique_employees': 0,
            'avg_doors_per_employee': 0,
            'period_days': period_days,
        }

    def _calculate_campaign_breakdown(self, qs) -> List[Dict[str, Any]]:
        """Per-campaign status breakdown."""
        campaigns_data = (
            qs.exclude(campaign__isnull=True)
            .values('campaign__id', 'campaign__name')
            .annotate(
                total=Count('id'),
                ja=Count('id', filter=Q(status='ja')),
                nei=Count('id', filter=Q(status='nei')),
                ikke_hjemme=Count('id', filter=Q(status='ikke_hjemme')),
                folg_opp=Count('id', filter=Q(status='folg_opp')),
                num_employees=Count('employee', distinct=True),
                num_managers=Count('manager', distinct=True),
                nei_ikke_interessert=Count('id', filter=Q(status='nei', nei_subcategory='ikke_interessert')),
                nei_darlig_erfaring=Count('id', filter=Q(status='nei', nei_subcategory='darlig_erfaring')),
                nei_bindingstid=Count('id', filter=Q(status='nei', nei_subcategory='bindingstid')),
                nei_bedrift=Count('id', filter=Q(status='nei', nei_subcategory='bedrift')),
                nei_pris=Count('id', filter=Q(status='nei', nei_subcategory='pris')),
                nei_eksisterende_kunde=Count('id', filter=Q(status='nei', nei_subcategory='eksisterende_kunde')),
                nei_unspecified=Count('id', filter=Q(status='nei', nei_subcategory__isnull=True)),
            )
            .order_by('-total')
        )

        result = []
        for c in campaigns_data:
            total = c['total']
            name = c['campaign__name'] or ''
            is_talkmore = name.strip().lower() == 'talkmore'

            entry = {
                'campaign_id': str(c['campaign__id']),
                'campaign_name': c['campaign__name'],
                'total_doors': total,
                'ja': c['ja'],
                'nei': c['nei'],
                'ikke_hjemme': c['ikke_hjemme'],
                'folg_opp': c['folg_opp'],
                'yes_rate': self._percent(c['ja'], total),
                'no_rate': self._percent(c['nei'], total),
                'not_home_rate': self._percent(c['ikke_hjemme'], total),
                'follow_up_rate': self._percent(c['folg_opp'], total),
                'contact_rate': self._percent(total - c['ikke_hjemme'], total),
                'num_employees': c['num_employees'] + c.get('num_managers', 0),  # Total workers (employees + managers)
                'is_talkmore': is_talkmore,
            }

            if is_talkmore:
                breakdown = {key: c[f'nei_{key}'] for key in TALKMORE_NEI_KEYS}
                breakdown['unspecified'] = c['nei_unspecified']
                entry['nei_breakdown'] = breakdown

            result.append(entry)
        return result

    def _calculate_employee_breakdown(
        self, qs, start_date: date, end_date: date
    ) -> List[Dict[str, Any]]:
        """
        Per-worker metrics (includes both employees and managers).
        Returns a combined list where managers and employees are treated the same.
        ONLY includes workers who are assigned to at least one campaign.
        """
        period_days = (end_date - start_date).days + 1
        result = []

        # Get IDs of employees/managers who have campaign assignments
        assigned_employee_ids = set(
            CampaignEmployee.objects.exclude(employee__isnull=True)
            .values_list('employee_id', flat=True)
            .distinct()
        )
        assigned_manager_ids = set(
            CampaignEmployee.objects.exclude(manager__isnull=True)
            .values_list('manager_id', flat=True)
            .distinct()
        )

        # Get employee data - ONLY those assigned to campaigns
        employees_data = (
            qs.exclude(employee__isnull=True)
            .filter(employee_id__in=assigned_employee_ids)
            .values('employee__id', 'employee__name')
            .annotate(
                total=Count('id'),
                ja=Count('id', filter=Q(status='ja')),
                nei=Count('id', filter=Q(status='nei')),
                ikke_hjemme=Count('id', filter=Q(status='ikke_hjemme')),
                folg_opp=Count('id', filter=Q(status='folg_opp')),
            )
            .order_by('-total')
        )

        for e in employees_data:
            total = e['total']
            daily_counts = self._daily_door_counts(
                qs.filter(employee_id=e['employee__id'])
            )
            result.append({
                'employee_id': str(e['employee__id']),
                'employee_name': e['employee__name'],
                'worker_type': 'employee',  # Indicates this is an employee
                'total_doors': total,
                'doors_per_day': round(total / period_days, 1) if period_days > 0 else 0,
                'ja': e['ja'],
                'nei': e['nei'],
                'ikke_hjemme': e['ikke_hjemme'],
                'folg_opp': e['folg_opp'],
                'yes_rate': self._percent(e['ja'], total),
                'no_rate': self._percent(e['nei'], total),
                'not_home_rate': self._percent(e['ikke_hjemme'], total),
                'follow_up_rate': self._percent(e['folg_opp'], total),
                'contact_rate': self._percent(total - e['ikke_hjemme'], total),
                'daily_door_counts': daily_counts,
                'consistency_score': self._consistency_score(daily_counts),
            })

        # Get manager data - ONLY those assigned to campaigns
        managers_data = (
            qs.exclude(manager__isnull=True)
            .filter(manager_id__in=assigned_manager_ids)
            .values('manager__id', 'manager__name')
            .annotate(
                total=Count('id'),
                ja=Count('id', filter=Q(status='ja')),
                nei=Count('id', filter=Q(status='nei')),
                ikke_hjemme=Count('id', filter=Q(status='ikke_hjemme')),
                folg_opp=Count('id', filter=Q(status='folg_opp')),
            )
            .order_by('-total')
        )

        for m in managers_data:
            total = m['total']
            daily_counts = self._daily_door_counts(
                qs.filter(manager_id=m['manager__id'])
            )
            result.append({
                'employee_id': str(m['manager__id']),  # Using employee_id field for consistency
                'employee_name': m['manager__name'],
                'worker_type': 'manager',  # Indicates this is a manager
                'total_doors': total,
                'doors_per_day': round(total / period_days, 1) if period_days > 0 else 0,
                'ja': m['ja'],
                'nei': m['nei'],
                'ikke_hjemme': m['ikke_hjemme'],
                'folg_opp': m['folg_opp'],
                'yes_rate': self._percent(m['ja'], total),
                'no_rate': self._percent(m['nei'], total),
                'not_home_rate': self._percent(m['ikke_hjemme'], total),
                'follow_up_rate': self._percent(m['folg_opp'], total),
                'contact_rate': self._percent(total - m['ikke_hjemme'], total),
                'daily_door_counts': daily_counts,
                'consistency_score': self._consistency_score(daily_counts),
            })

        # Sort combined list by total_doors descending
        result.sort(key=lambda x: x['total_doors'], reverse=True)
        return result

    def _calculate_daily_breakdown(self, qs) -> List[Dict[str, Any]]:
        """Aggregate day-by-day breakdown."""
        daily = (
            qs.annotate(day=TruncDate('recorded_at'))
            .values('day')
            .annotate(
                total=Count('id'),
                ja=Count('id', filter=Q(status='ja')),
                nei=Count('id', filter=Q(status='nei')),
                ikke_hjemme=Count('id', filter=Q(status='ikke_hjemme')),
                folg_opp=Count('id', filter=Q(status='folg_opp')),
            )
            .order_by('day')
        )

        result = []
        for d in daily:
            total = d['total']
            result.append({
                'date': d['day'].isoformat() if d['day'] else None,
                'total_doors': total,
                'ja': d['ja'],
                'nei': d['nei'],
                'ikke_hjemme': d['ikke_hjemme'],
                'folg_opp': d['folg_opp'],
                'yes_rate': self._percent(d['ja'], total),
            })
        return result

    def _calculate_hourly_breakdown(self, qs) -> List[Dict[str, Any]]:
        """Performance by hour of the day (identifies peak hours)."""
        hourly = (
            qs.annotate(hour=ExtractHour('recorded_at'))
            .values('hour')
            .annotate(
                total=Count('id'),
                ja=Count('id', filter=Q(status='ja')),
            )
            .order_by('hour')
        )

        result = []
        for h in hourly:
            total = h['total']
            result.append({
                'hour': h['hour'],
                'total_doors': total,
                'ja': h['ja'],
                'yes_rate': self._percent(h['ja'], total),
            })
        return result

    def _calculate_comparisons(
        self,
        current: Dict[str, Any],
        previous: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Week-over-week (or period-over-period) comparison."""
        def _change(curr, prev, key):
            c = curr.get(key, 0)
            p = previous.get(key, 0)
            diff = c - p if isinstance(c, (int, float)) else float(c) - float(p)
            pct_change = round((diff / p) * 100, 1) if p else 0.0
            return {'current': c, 'previous': p, 'change': round(diff, 2), 'change_pct': pct_change}

        return {
            'total_doors': _change(current, previous, 'total_doors'),
            'yes_rate': _change(current, previous, 'yes_rate'),
            'no_rate': _change(current, previous, 'no_rate'),
            'contact_rate': _change(current, previous, 'contact_rate'),
            'doors_per_day': _change(current, previous, 'doors_per_day'),
        }

    @staticmethod
    def _identify_top_performers(employees: List[Dict]) -> Dict[str, Any]:
        """Pick top / bottom performers from the employee list."""
        if not employees:
            return {'top_yes_rate': None, 'top_doors': None, 'bottom_yes_rate': None, 'bottom_doors': None}

        by_yes = sorted(employees, key=lambda e: e['yes_rate'], reverse=True)
        by_doors = sorted(employees, key=lambda e: e['total_doors'], reverse=True)

        return {
            'top_yes_rate': {
                'employee_id': by_yes[0]['employee_id'],
                'employee_name': by_yes[0]['employee_name'],
                'value': by_yes[0]['yes_rate'],
            } if by_yes else None,
            'top_doors': {
                'employee_id': by_doors[0]['employee_id'],
                'employee_name': by_doors[0]['employee_name'],
                'value': by_doors[0]['total_doors'],
            } if by_doors else None,
            'bottom_yes_rate': {
                'employee_id': by_yes[-1]['employee_id'],
                'employee_name': by_yes[-1]['employee_name'],
                'value': by_yes[-1]['yes_rate'],
            } if len(by_yes) > 1 else None,
            'bottom_doors': {
                'employee_id': by_doors[-1]['employee_id'],
                'employee_name': by_doors[-1]['employee_name'],
                'value': by_doors[-1]['total_doors'],
            } if len(by_doors) > 1 else None,
        }

    # ------------------------------------------------------------------ #
    #  UTILITY HELPERS                                                    #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _status_counts(qs) -> Dict[str, int]:
        """Return {status: count} dict from a queryset."""
        counts = qs.values('status').annotate(count=Count('id'))
        return {item['status']: item['count'] for item in counts}

    @staticmethod
    def _percent(part: int, total: int) -> float:
        """Safe percentage calculation: (part / total) * 100, rounded to 1 dp."""
        if total == 0:
            return 0.0
        return round((part / total) * 100, 1)

    @staticmethod
    def _daily_door_counts(qs) -> Dict[str, int]:
        """
        Return {date_string: count} for each day in the queryset.
        Works for both employee and manager querysets.
        """
        daily = (
            qs.annotate(day=TruncDate('recorded_at'))
            .values('day')
            .annotate(count=Count('id'))
            .order_by('day')
        )
        return {
            d['day'].isoformat(): d['count']
            for d in daily
            if d['day']
        }

    @staticmethod
    def _consistency_score(daily_counts: Dict[str, int]) -> float:
        """
        Consistency score based on Coefficient of Variation (CV).

        consistency = max(0, (1 - CV)) * 100
        CV = std_dev / mean

        100% = perfectly consistent (std_dev=0)
        0%   = highly inconsistent (std_dev >= mean)
        """
        values = list(daily_counts.values())
        if len(values) < 2:
            return 100.0  # only one data point → perfectly consistent by definition

        avg = statistics.mean(values)
        if avg == 0:
            return 0.0

        std = statistics.stdev(values)
        cv = std / avg
        return round(max(0.0, (1 - cv)) * 100, 1)

    @staticmethod
    def _empty_employee_metrics(employee_id: str, start_date: date, end_date: date):
        return {
            'employee_id': employee_id,
            'period': {'start_date': start_date.isoformat(), 'end_date': end_date.isoformat()},
            'total_doors': 0,
            'doors_per_day': 0,
            'status_counts': {'ja': 0, 'nei': 0, 'ikke_hjemme': 0, 'folg_opp': 0},
            'yes_rate': 0.0, 'no_rate': 0.0,
            'not_home_rate': 0.0, 'follow_up_rate': 0.0,
            'contact_rate': 0.0,
            'daily_door_counts': {},
            'consistency_score': 0.0,
            'best_day': None,
            'worst_day': None,
        }

    # ------------------------------------------------------------------ #
    #  WORK-TIME SUMMARY (WorkSession-based)                              #
    # ------------------------------------------------------------------ #

    def _calculate_work_time_summary(
        self,
        start_date: date,
        end_date: date,
        employee_ids: Optional[List[str]] = None,
        manager_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compute working-time aggregates from WorkSession data for the period.

        Returns:
            period_days, active_threshold_seconds, and sub-dicts for
            employees, managers, and combined — each with:
                total, active_count, active_pct, avg_daily_seconds, avg_daily_minutes
        """
        from tracking.services import get_working_seconds_for_period, ACTIVE_THRESHOLD_SECONDS
        from users.models import Employee, Manager

        period_days = (end_date - start_date).days + 1

        # ── Employees ─────────────────────────────────────────────────────
        emp_qs = Employee.objects.all()
        if employee_ids:
            emp_qs = emp_qs.filter(id__in=employee_ids)

        emp_seconds: Dict[str, int] = {}
        for emp in emp_qs:
            secs = get_working_seconds_for_period(start_date, end_date, employee=emp)
            emp_seconds[str(emp.id)] = secs

        emp_total = len(emp_seconds)
        emp_active = sum(1 for s in emp_seconds.values() if s > ACTIVE_THRESHOLD_SECONDS)
        emp_avg_daily = (
            round(sum(emp_seconds.values()) / (emp_total * period_days), 1)
            if emp_total > 0 and period_days > 0
            else 0
        )

        # ── Managers ──────────────────────────────────────────────────────
        mgr_qs = Manager.objects.all()
        if manager_id:
            mgr_qs = mgr_qs.filter(id=manager_id)

        mgr_seconds: Dict[str, int] = {}
        for mgr in mgr_qs:
            secs = get_working_seconds_for_period(start_date, end_date, manager=mgr)
            mgr_seconds[str(mgr.id)] = secs

        mgr_total = len(mgr_seconds)
        mgr_active = sum(1 for s in mgr_seconds.values() if s > ACTIVE_THRESHOLD_SECONDS)
        mgr_avg_daily = (
            round(sum(mgr_seconds.values()) / (mgr_total * period_days), 1)
            if mgr_total > 0 and period_days > 0
            else 0
        )

        # ── Combined ──────────────────────────────────────────────────────
        all_seconds = list(emp_seconds.values()) + list(mgr_seconds.values())
        all_total = emp_total + mgr_total
        all_active = emp_active + mgr_active
        all_avg_daily = (
            round(sum(all_seconds) / (all_total * period_days), 1)
            if all_total > 0 and period_days > 0
            else 0
        )

        def _pct(active, total):
            return round((active / total) * 100, 1) if total > 0 else 0.0

        return {
            'period_days': period_days,
            'active_threshold_seconds': ACTIVE_THRESHOLD_SECONDS,
            'employees': {
                'total': emp_total,
                'active_count': emp_active,
                'active_pct': _pct(emp_active, emp_total),
                'avg_daily_seconds': emp_avg_daily,
                'avg_daily_minutes': round(emp_avg_daily / 60, 1),
            },
            'managers': {
                'total': mgr_total,
                'active_count': mgr_active,
                'active_pct': _pct(mgr_active, mgr_total),
                'avg_daily_seconds': mgr_avg_daily,
                'avg_daily_minutes': round(mgr_avg_daily / 60, 1),
            },
            'combined': {
                'total': all_total,
                'active_count': all_active,
                'active_pct': _pct(all_active, all_total),
                'avg_daily_seconds': all_avg_daily,
                'avg_daily_minutes': round(all_avg_daily / 60, 1),
            },
        }
