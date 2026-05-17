"""
Threshold Evaluator Service

Evaluates employee / campaign / team metrics against the admin-configurable
thresholds stored in AnalyticsThreshold.

Alert severity levels:
    CRITICAL  – threshold breached for ≥ consecutive_days_threshold
    WARNING   – threshold breached but fewer than consecutive_days_threshold
    INFO      – performance is declining but still above threshold
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from dashboard.models import AnalyticsThreshold
from dashboard.services.analytics_calculator import AnalyticsCalculator
from users.models import Employee, Manager


class AlertSeverity(str, Enum):
    CRITICAL = 'critical'
    WARNING = 'warning'
    INFO = 'info'


class AlertType(str, Enum):
    LOW_DOORS_PER_DAY = 'low_doors_per_day'
    LOW_YES_RATE = 'low_yes_rate'
    HIGH_NO_RATE = 'high_no_rate'
    LOW_CONTACT_RATE = 'low_contact_rate'
    PERFORMANCE_DROP = 'performance_drop'
    CONSECUTIVE_LOW_DOORS = 'consecutive_low_doors'
    CONSECUTIVE_LOW_YES_RATE = 'consecutive_low_yes_rate'


@dataclass
class Alert:
    """Single performance alert."""
    alert_type: str
    severity: str
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    current_value: float = 0.0
    threshold_value: float = 0.0
    consecutive_days: int = 0
    message: str = ''
    daily_details: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'alert_type': self.alert_type,
            'severity': self.severity,
            'employee_id': self.employee_id,
            'employee_name': self.employee_name,
            'campaign_id': self.campaign_id,
            'campaign_name': self.campaign_name,
            'current_value': self.current_value,
            'threshold_value': self.threshold_value,
            'consecutive_days': self.consecutive_days,
            'message': self.message,
            'daily_details': self.daily_details,
        }


class ThresholdEvaluator:
    """
    Evaluates analytics data against the AnalyticsThreshold configuration.

    Uses the hierarchy:
        employee-specific → campaign-specific → manager-specific → global
    """

    def __init__(self):
        self.calculator = AnalyticsCalculator()

    # ------------------------------------------------------------------ #
    #  PUBLIC API                                                         #
    # ------------------------------------------------------------------ #

    def evaluate_all(
        self,
        analytics_data: Dict[str, Any],
        end_date: date,
    ) -> List[Dict[str, Any]]:
        """
        Evaluate every employee and campaign in the analytics_data
        against the matching threshold and return a list of alert dicts.

        Parameters:
            analytics_data: output of AnalyticsCalculator.calculate_all()
            end_date: last day of the reporting period (for consecutive-day checks)
        """
        alerts: List[Alert] = []

        employees = analytics_data.get('employees', [])
        campaigns = analytics_data.get('campaigns', [])
        comparisons = analytics_data.get('comparisons', {})

        # Per-worker checks (employees and managers)
        for emp in employees:
            worker_type = emp.get('worker_type', 'employee')  # 'employee' or 'manager'
            worker_id = emp['employee_id']  # This field contains the ID for both types
            
            # Resolve threshold - if it's a manager, use manager_id for threshold resolution
            if worker_type == 'manager':
                threshold = self._resolve_threshold(
                    employee_id=None,
                    campaign_id=None,
                    manager_id=worker_id,
                )
            else:
                threshold = self._resolve_threshold(
                    employee_id=worker_id,
                    campaign_id=None,
                    manager_id=None,
                )
            alerts.extend(self._check_employee(emp, threshold, end_date, worker_type=worker_type))

        # Per-campaign checks
        for camp in campaigns:
            threshold = self._resolve_threshold(
                employee_id=None,
                campaign_id=camp['campaign_id'],
                manager_id=None,
            )
            alerts.extend(self._check_campaign(camp, threshold))

        # Sort: critical first, then warning, then info
        severity_order = {AlertSeverity.CRITICAL: 0, AlertSeverity.WARNING: 1, AlertSeverity.INFO: 2}
        alerts.sort(key=lambda a: severity_order.get(a.severity, 99))

        return [a.to_dict() for a in alerts]

    # ------------------------------------------------------------------ #
    #  THRESHOLD RESOLUTION (hierarchy)                                    #
    # ------------------------------------------------------------------ #

    def _resolve_threshold(
        self,
        employee_id: Optional[str] = None,
        campaign_id: Optional[str] = None,
        manager_id: Optional[str] = None,
    ) -> AnalyticsThreshold:
        """
        Resolve which threshold to use based on hierarchy:
            1. employee-specific (highest priority)
            2. campaign-specific
            3. manager-specific
            4. global
        Falls back to hard-coded defaults if nothing is configured.
        """
        # 1. Employee-specific
        if employee_id:
            try:
                return AnalyticsThreshold.objects.get(
                    scope='employee', employee_id=employee_id, is_active=True
                )
            except AnalyticsThreshold.DoesNotExist:
                pass

            # Try to find the employee's manager for manager-level fallback
            try:
                emp = Employee.objects.get(pk=employee_id)
                if hasattr(emp, 'user') and emp.user and emp.user.manager_id:
                    manager_id = str(emp.user.manager_id)
            except Employee.DoesNotExist:
                pass

        # 2. Campaign-specific
        if campaign_id:
            try:
                return AnalyticsThreshold.objects.get(
                    scope='campaign', campaign_id=campaign_id, is_active=True
                )
            except AnalyticsThreshold.DoesNotExist:
                pass

        # 3. Manager-specific
        if manager_id:
            try:
                return AnalyticsThreshold.objects.get(
                    scope='manager', manager_id=manager_id, is_active=True
                )
            except AnalyticsThreshold.DoesNotExist:
                pass

        # 4. Global
        try:
            return AnalyticsThreshold.objects.get(scope='global', is_active=True)
        except AnalyticsThreshold.DoesNotExist:
            pass

        # 5. Hard-coded defaults (if DB has nothing at all)
        return self._default_threshold()

    @staticmethod
    def _default_threshold() -> AnalyticsThreshold:
        """Return an unsaved AnalyticsThreshold with sensible defaults."""
        return AnalyticsThreshold(
            scope='global',
            min_doors_per_day=70,
            min_doors_per_week=350,
            min_yes_rate_percent=Decimal('30.00'),
            max_no_rate_percent=Decimal('50.00'),
            min_contact_rate_percent=Decimal('60.00'),
            consecutive_days_threshold=3,
            performance_drop_alert_percent=Decimal('20.00'),
            max_inactive_hours=4,
            is_active=True,
        )

    # ------------------------------------------------------------------ #
    #  EMPLOYEE CHECKS                                                    #
    # ------------------------------------------------------------------ #

    def _check_employee(
        self,
        emp: Dict[str, Any],
        threshold: AnalyticsThreshold,
        end_date: date,
        worker_type: str = 'employee',
    ) -> List[Alert]:
        """
        Run all threshold checks for a single worker (employee or manager).
        
        Parameters:
            emp: Worker data dict (from employee breakdown)
            threshold: Resolved threshold to use
            end_date: End date for consecutive day checks
            worker_type: 'employee' or 'manager'
        """
        alerts: List[Alert] = []
        emp_id = emp['employee_id']
        emp_name = emp.get('employee_name', emp_id)

        # --- Doors per day check ---
        if emp['doors_per_day'] < threshold.min_doors_per_day:
            alerts.append(Alert(
                alert_type=AlertType.LOW_DOORS_PER_DAY,
                severity=AlertSeverity.WARNING,
                employee_id=emp_id,
                employee_name=emp_name,
                current_value=emp['doors_per_day'],
                threshold_value=float(threshold.min_doors_per_day),
                message=(
                    f"{emp_name} averaged {emp['doors_per_day']} doors/day "
                    f"(minimum: {threshold.min_doors_per_day})."
                ),
            ))

        # --- Yes-rate check ---
        if emp['yes_rate'] < float(threshold.min_yes_rate_percent):
            alerts.append(Alert(
                alert_type=AlertType.LOW_YES_RATE,
                severity=AlertSeverity.WARNING,
                employee_id=emp_id,
                employee_name=emp_name,
                current_value=emp['yes_rate'],
                threshold_value=float(threshold.min_yes_rate_percent),
                message=(
                    f"{emp_name} has a {emp['yes_rate']}% yes-rate "
                    f"(minimum: {float(threshold.min_yes_rate_percent)}%)."
                ),
            ))

        # --- No-rate check ---
        if emp['no_rate'] > float(threshold.max_no_rate_percent):
            alerts.append(Alert(
                alert_type=AlertType.HIGH_NO_RATE,
                severity=AlertSeverity.WARNING,
                employee_id=emp_id,
                employee_name=emp_name,
                current_value=emp['no_rate'],
                threshold_value=float(threshold.max_no_rate_percent),
                message=(
                    f"{emp_name} has a {emp['no_rate']}% rejection rate "
                    f"(maximum: {float(threshold.max_no_rate_percent)}%)."
                ),
            ))

        # --- Contact-rate check ---
        if emp['contact_rate'] < float(threshold.min_contact_rate_percent):
            alerts.append(Alert(
                alert_type=AlertType.LOW_CONTACT_RATE,
                severity=AlertSeverity.INFO,
                employee_id=emp_id,
                employee_name=emp_name,
                current_value=emp['contact_rate'],
                threshold_value=float(threshold.min_contact_rate_percent),
                message=(
                    f"{emp_name} has a {emp['contact_rate']}% contact rate "
                    f"(minimum: {float(threshold.min_contact_rate_percent)}%)."
                ),
            ))

        # --- Consecutive-day checks (upgrades WARNING → CRITICAL) ---
        consec = self.calculator.calculate_consecutive_day_stats(
            employee_id=emp_id,
            end_date=end_date,
            lookback_days=max(7, threshold.consecutive_days_threshold + 2),
            min_doors_threshold=threshold.min_doors_per_day,
            min_yes_rate_threshold=float(threshold.min_yes_rate_percent),
            worker_type=worker_type,
        )

        if consec['consecutive_low_doors'] >= threshold.consecutive_days_threshold:
            # Upgrade or add a CRITICAL alert
            alerts.append(Alert(
                alert_type=AlertType.CONSECUTIVE_LOW_DOORS,
                severity=AlertSeverity.CRITICAL,
                employee_id=emp_id,
                employee_name=emp_name,
                current_value=emp['doors_per_day'],
                threshold_value=float(threshold.min_doors_per_day),
                consecutive_days=consec['consecutive_low_doors'],
                message=(
                    f"🚨 {emp_name} has been below {threshold.min_doors_per_day} doors/day "
                    f"for {consec['consecutive_low_doors']} consecutive days."
                ),
                daily_details=consec['daily_details'],
            ))

        if consec['consecutive_low_yes_rate'] >= threshold.consecutive_days_threshold:
            alerts.append(Alert(
                alert_type=AlertType.CONSECUTIVE_LOW_YES_RATE,
                severity=AlertSeverity.CRITICAL,
                employee_id=emp_id,
                employee_name=emp_name,
                current_value=emp['yes_rate'],
                threshold_value=float(threshold.min_yes_rate_percent),
                consecutive_days=consec['consecutive_low_yes_rate'],
                message=(
                    f"🚨 {emp_name} has been below {float(threshold.min_yes_rate_percent)}% yes-rate "
                    f"for {consec['consecutive_low_yes_rate']} consecutive days."
                ),
                daily_details=consec['daily_details'],
            ))

        return alerts

    # ------------------------------------------------------------------ #
    #  CAMPAIGN CHECKS                                                    #
    # ------------------------------------------------------------------ #

    def _check_campaign(
        self,
        camp: Dict[str, Any],
        threshold: AnalyticsThreshold,
    ) -> List[Alert]:
        """Run threshold checks for a single campaign."""
        alerts: List[Alert] = []
        camp_id = camp['campaign_id']
        camp_name = camp.get('campaign_name', camp_id)

        if camp['yes_rate'] < float(threshold.min_yes_rate_percent):
            alerts.append(Alert(
                alert_type=AlertType.LOW_YES_RATE,
                severity=AlertSeverity.WARNING,
                campaign_id=camp_id,
                campaign_name=camp_name,
                current_value=camp['yes_rate'],
                threshold_value=float(threshold.min_yes_rate_percent),
                message=(
                    f"Campaign '{camp_name}' has a {camp['yes_rate']}% yes-rate "
                    f"(minimum: {float(threshold.min_yes_rate_percent)}%)."
                ),
            ))

        if camp['no_rate'] > float(threshold.max_no_rate_percent):
            alerts.append(Alert(
                alert_type=AlertType.HIGH_NO_RATE,
                severity=AlertSeverity.WARNING,
                campaign_id=camp_id,
                campaign_name=camp_name,
                current_value=camp['no_rate'],
                threshold_value=float(threshold.max_no_rate_percent),
                message=(
                    f"Campaign '{camp_name}' has a {camp['no_rate']}% rejection rate "
                    f"(maximum: {float(threshold.max_no_rate_percent)}%)."
                ),
            ))

        return alerts
