"""
Models for the QC System app.

Phase 9 optimizations:
- Composite indexes for common query patterns
- CheckConstraints for data integrity
- Validators for field ranges
"""
import uuid
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


# Choice constants
STATUS_CHOICES = [
    ('til_behandling', 'To be processed'),
    ('forste_oppring', 'First call attempt'),
    ('andre_oppring', 'Second call attempt'),
    ('tredje_oppring', 'Third call attempt'),
    ('si_opp', 'Cancellation requested'),
    ('negativ_tilbakemelding', 'Negative feedback'),
    ('positiv_tilbakemelding', 'Positive feedback'),
    ('other_inquiries', 'Other inquiries'),
    ('noeytral_tilbakemelding', 'Neutral'),
    ('giverinspill', 'Giverinspill'),
    ('reservert', 'Reserved'),
    ('utmeldt', 'Unsubscribed / cancelled themselves'),
]

QC_RESULT_CHOICES = [
    ('Svarte', 'Answered'),
    ('Ikke svar', 'No answer'),
    ('Opptatt', 'Busy'),
]

SVARTE_CATEGORY_CHOICES = [
    ('negativ', 'Negative'),
    ('positiv', 'Positive'),
    ('annen', 'Other'),
    ('noeytral', 'Neutral'),
    ('giverinspill', 'Giverinspill'),
    ('reservert', 'Reserved'),
]

SI_OPP_CHOICES = [
    ('JA', 'Yes'),
    ('NEI', 'No'),
]

IMPORT_STATUS_CHOICES = [
    ('Fullfort', 'Completed'),
    ('Feilet', 'Failed'),
    ('Behandler', 'Processing'),
]

THEME_CHOICES = [
    ('lys', 'Light'),
    ('mork', 'Dark'),
    ('system', 'System'),
]

TRANSFER_REQUEST_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('accepted', 'Accepted'),
    ('declined', 'Declined'),
    ('cancelled', 'Cancelled'),
]


class QCContact(models.Model):
    """
    Main contact model for QC processing.
    Represents a customer contact that needs to be processed through the QC workflow.
    """
    # Identification
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Customer Information
    customer_name = models.CharField(max_length=255)  # Kept for backward compat; prefer first_name + last_name
    first_name = models.CharField(max_length=255, blank=True, default='')
    last_name = models.CharField(max_length=255, blank=True, default='')
    phone_number = models.CharField(max_length=50, help_text="Format: '+47 XXX XX XXX'")
    
    # Assignment & Tracking
    seller_name = models.CharField(
        max_length=255,
        help_text="Original seller who created this contact"
    )
    assigned_to = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_qc_contacts',
        limit_choices_to={'employee_type': 'qc_emp'},
        help_text="QC employee assigned to process this contact"
    )
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_contacts',
        help_text="Campaign this contact belongs to"
    )
    import_record = models.ForeignKey(
        'ImportRecord',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contacts',
        help_text="Import record/list this contact originated from",
    )
    
    # Sales ID from CSV row — set at import, source of truth unless overridden per contact
    sales_id = models.CharField(max_length=255, blank=True, default='')

    # External contact identifier from CSV row (optional; null if not mapped or empty)
    contact_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)

    # Business date for grouping/filtering (sale date chosen at import; not system import time)
    user_added_import_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        help_text='User-specified sale/batch date at CSV import',
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    qc_approved_at = models.DateTimeField(null=True, blank=True)
    
    # Workflow Status
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='til_behandling',
        db_index=True,
        help_text="Current workflow status"
    )
    attempt_count = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Number of call attempts (0-3 typical, max 10)"
    )
    
    # Priority & Urgency
    urgent = models.BooleanField(default=False)
    urgent_message = models.TextField(blank=True)
    
    # QC Results
    qc_result = models.CharField(
        max_length=20,
        choices=QC_RESULT_CHOICES,
        null=True,
        blank=True,
        help_text="Result of the QC call"
    )
    svarte_category = models.CharField(
        max_length=20,
        choices=SVARTE_CATEGORY_CHOICES,
        null=True,
        blank=True,
        help_text="Sub-category when qc_result is 'Svarte'"
    )
    si_opp = models.CharField(
        max_length=10,
        choices=SI_OPP_CHOICES,
        null=True,
        blank=True,
        help_text="Whether customer wants to cancel (JA/NEI)"
    )

    # Multi-category flags: contact can appear in multiple lists (e.g. Giverinnspill + Oppsigelse)
    is_oppsigelse = models.BooleanField(default=False, help_text="Also appears in Oppsigelser list")
    is_giverinspill = models.BooleanField(default=False, help_text="Also appears in Giverinnspill list")
    is_ris = models.BooleanField(default=False, help_text="Also appears in Ris (negative) list")
    is_noeytral = models.BooleanField(default=False, help_text="Also appears in Nøytral list")
    is_annen = models.BooleanField(default=False, help_text="Also appears in Andre henvendelser list")
    is_positiv = models.BooleanField(default=False, help_text="Also appears in Positiv/Ros list")
    is_reservert = models.BooleanField(default=False, help_text="Also appears in Reservert list")
    is_utmeldt = models.BooleanField(default=False, help_text="Also appears in Utmeldt list")
    
    # Comments & Notes
    comment = models.TextField(blank=True)
    qc_agent_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Name of the QC agent who processed this contact"
    )
    
    class Meta:
        db_table = 'qc_contact'
        verbose_name = 'QC Contact'
        verbose_name_plural = 'QC Contacts'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['seller_name']),
            models.Index(fields=['created_at']),
            models.Index(fields=['urgent']),
            models.Index(fields=['campaign']),
            # Composite indexes for common query patterns
            models.Index(
                fields=['assigned_to', 'status'],
                name='qc_contact_assignee_status',
            ),
            models.Index(
                fields=['assigned_to', 'status', 'urgent'],
                name='qc_contact_assignee_status_urg',
            ),
            models.Index(
                fields=['assigned_to', 'status', 'created_at'],
                name='qc_contact_assignee_status_cr',
            ),
            models.Index(
                fields=['campaign', 'status'],
                name='qc_contact_campaign_status',
            ),
            models.Index(
                fields=['import_record', 'assigned_to', 'status', 'urgent', 'created_at'],
                name='qc_contact_imp_asg_st_urg_cr',
            ),
            # Covers: WHERE campaign_id=? ORDER BY user_added_import_date, created_at
            models.Index(
                fields=['campaign', 'user_added_import_date', 'created_at'],
                name='qc_contact_campaign_date_cr',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(attempt_count__gte=0, attempt_count__lte=10),
                name='qc_contact_attempt_count_range',
            ),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.customer_name} ({self.status})"


class QCHistory(models.Model):
    """
    Immutable record of completed QC calls.
    Provides an audit trail of all QC processing activities.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Reference to original contact
    contact = models.ForeignKey(
        'QCContact',
        on_delete=models.CASCADE,
        related_name='history_entries',
        help_text="Original contact this history entry belongs to"
    )
    
    # Denormalized data for quick access (avoids joins)
    customer_name = models.CharField(max_length=255)
    first_name = models.CharField(max_length=255, blank=True, default='')
    last_name = models.CharField(max_length=255, blank=True, default='')
    phone_number = models.CharField(max_length=50)
    
    # QC Results
    qc_result = models.CharField(
        max_length=20,
        choices=QC_RESULT_CHOICES,
        help_text="Result of the QC call"
    )
    svarte_category = models.CharField(
        max_length=20,
        choices=SVARTE_CATEGORY_CHOICES,
        null=True,
        blank=True,
        help_text="Sub-category when qc_result is 'Svarte'"
    )
    si_opp = models.CharField(
        max_length=10,
        choices=SI_OPP_CHOICES,
        null=True,
        blank=True,
        help_text="Whether customer wants to cancel (JA/NEI)"
    )
    
    # Comments & Agent
    comment = models.TextField(blank=True)
    qc_agent_name = models.CharField(max_length=255)
    qc_agent = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_history_entries',
        help_text="QC agent who processed this call"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField(
        auto_now_add=True,
        help_text="Date for efficient date filtering (YYYY-MM-DD)"
    )
    tid = models.CharField(
        max_length=5,
        help_text="Time in 'HH:MM' format (24-hour)"
    )
    
    class Meta:
        db_table = 'qc_history'
        verbose_name = 'QC History'
        verbose_name_plural = 'QC History Entries'
        indexes = [
            models.Index(fields=['contact']),
            models.Index(fields=['qc_agent']),
            models.Index(fields=['date']),
            models.Index(fields=['created_at']),
            # Composite indexes for dashboard stats & history filtering
            models.Index(
                fields=['qc_agent', 'date'],
                name='qc_history_agent_date',
            ),
            models.Index(
                fields=['date', 'qc_result'],
                name='qc_history_date_result',
            ),
            models.Index(
                fields=['qc_agent', 'date', 'qc_result'],
                name='qc_history_agent_date_result',
            ),
            models.Index(
                fields=['contact', 'created_at'],
                name='qc_history_contact_created',
            ),
            models.Index(
                fields=['qc_agent', 'created_at'],
                name='qc_history_agent_created',
            ),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.customer_name} - {self.qc_result} ({self.tid})"


class QCSettings(models.Model):
    """
    Per-user settings/preferences for QC employees.
    Each QC user has exactly one settings object.
    """
    user = models.OneToOneField(
        'users.User',
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='qc_settings',
        help_text="User these settings belong to"
    )
    
    # Settings
    daily_goal = models.IntegerField(
        default=100,
        validators=[MinValueValidator(1), MaxValueValidator(9999)],
        help_text="Target number of calls per day"
    )
    auto_copy_phone = models.BooleanField(
        default=True,
        help_text="Auto-copy phone number to clipboard"
    )
    theme = models.CharField(
        max_length=20,
        choices=THEME_CHOICES,
        default='lys',
        help_text="UI theme preference"
    )
    selected_import_record = models.ForeignKey(
        'ImportRecord',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='selected_by_users',
        help_text="Selected import list context for this user",
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'qc_settings'
        verbose_name = 'QC Settings'
        verbose_name_plural = 'QC Settings'
    
    def __str__(self):
        return f"Settings for {self.user.username}"


class ImportRecord(models.Model):
    """
    Track file imports of contacts.
    Records who imported what, when, and the status of the import.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    filename = models.CharField(max_length=255)
    list_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text="Human-friendly list name set at import time",
    )
    list_slug = models.SlugField(
        max_length=255,
        null=True,
        blank=True,
        db_index=True,
        help_text="Normalized list identifier for API filtering and uniqueness",
    )
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_imports',
        help_text="Campaign this import belongs to"
    )
    
    # Import details
    count = models.IntegerField(
        default=0,
        help_text="Number of contacts imported"
    )
    status = models.CharField(
        max_length=20,
        choices=IMPORT_STATUS_CHOICES,
        default='Behandler',
        help_text="Import status"
    )
    
    # User who performed import
    imported_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_imports',
        help_text="User who performed this import"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField(
        auto_now_add=True,
        help_text="Date of import (YYYY-MM-DD)"
    )
    user_added_import_date = models.DateField(
        null=True,
        blank=True,
        help_text='Sale/batch date provided by user for this import',
    )

    class Meta:
        db_table = 'qc_import_record'
        verbose_name = 'QC Import Record'
        verbose_name_plural = 'QC Import Records'
        indexes = [
            models.Index(fields=['date']),
            models.Index(fields=['status']),
            models.Index(fields=['list_slug']),
            # Composite index for filtered import history
            models.Index(
                fields=['campaign', 'date'],
                name='qc_import_campaign_date',
            ),
            models.Index(
                fields=['campaign', 'list_slug'],
                name='qc_import_campaign_list_slug',
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'list_slug'],
                condition=models.Q(list_slug__isnull=False),
                name='qc_import_campaign_list_slug_unique',
            ),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.filename} - {self.status} ({self.count} contacts)"


class ContactAssignment(models.Model):
    """
    Tracks contact assignment counts per QC employee.
    Used for load balancing and fair distribution of contacts.
    """
    qc_employee = models.OneToOneField(
        'users.User',
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='qc_assignment_stats',
        limit_choices_to={'employee_type': 'qc_emp'},
        help_text="QC employee these stats belong to"
    )
    
    # Assignment counts
    total_assigned = models.IntegerField(
        default=0,
        help_text="Total contacts ever assigned to this employee"
    )
    active_assigned = models.IntegerField(
        default=0,
        help_text="Contacts currently assigned and not yet completed"
    )
    completed_today = models.IntegerField(
        default=0,
        help_text="Contacts completed today (resets daily)"
    )
    
    # Timestamps
    last_assigned_at = models.DateTimeField(null=True, blank=True)
    last_reset_at = models.DateField(
        auto_now_add=True,
        help_text="Date of last reset (for daily reset of completed_today)"
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'qc_contact_assignment'
        verbose_name = 'QC Contact Assignment'
        verbose_name_plural = 'QC Contact Assignments'
    
    def __str__(self):
        return f"Assignment stats for {self.qc_employee.username}"


class QCTransferRequest(models.Model):
    """
    Pending/processed transfer request created by a QC user and reviewed by QC admin.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requested_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_transfer_requests_created',
        help_text="User who requested the transfer",
    )
    target_agent = models.ForeignKey(
        'users.User',
        on_delete=models.PROTECT,
        related_name='qc_transfer_requests_targeted',
        help_text="Intended recipient of transferred contacts",
    )
    status = models.CharField(
        max_length=20,
        choices=TRANSFER_REQUEST_STATUS_CHOICES,
        default='pending',
        db_index=True,
    )
    requested_count = models.IntegerField(default=0)
    note = models.TextField(blank=True)
    decline_reason = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_transfer_requests_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'qc_transfer_request'
        verbose_name = 'QC Transfer Request'
        verbose_name_plural = 'QC Transfer Requests'
        indexes = [
            models.Index(
                fields=['status', 'created_at'],
                name='qc_tr_req_status_created',
            ),
            models.Index(
                fields=['requested_by', 'status'],
                name='qc_tr_req_requester_status',
            ),
            models.Index(
                fields=['target_agent', 'status'],
                name='qc_tr_req_target_status',
            ),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"Transfer request {self.id} ({self.status})"


class QCTransferRequestItem(models.Model):
    """
    Contact rows included in a transfer request.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        QCTransferRequest,
        on_delete=models.CASCADE,
        related_name='items',
    )
    contact = models.ForeignKey(
        QCContact,
        on_delete=models.CASCADE,
        related_name='transfer_request_items',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'qc_transfer_request_item'
        verbose_name = 'QC Transfer Request Item'
        verbose_name_plural = 'QC Transfer Request Items'
        constraints = [
            models.UniqueConstraint(
                fields=['request', 'contact'],
                name='qc_transfer_request_item_request_contact_unique',
            ),
        ]
        indexes = [
            models.Index(fields=['request']),
            models.Index(fields=['contact']),
        ]
        ordering = ['created_at']

    def __str__(self):
        return f"Request {self.request_id} -> Contact {self.contact_id}"


class QCFavourite(models.Model):
    """
    Per-user favourite contacts (e.g. Ros / positive feedback).
    Each QC employee has their own list of favourite contacts.
    """
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='qc_favourites',
        help_text="QC user who favourited this contact",
    )
    contact = models.ForeignKey(
        QCContact,
        on_delete=models.CASCADE,
        related_name='favourited_by',
        help_text="Contact that was favourited",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'qc_favourite'
        verbose_name = 'QC Favourite'
        verbose_name_plural = 'QC Favourites'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'contact'],
                name='qc_favourite_user_contact_unique',
            ),
        ]
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['contact']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} fav #{self.contact_id}"


class QCCheckOff(models.Model):
    """
    Per-user, per-scope check-off of contacts (e.g. main overview vs SI opp / AH board).
    Scopes are independent: checking off on one board does not affect the other.
    """
    class Scope(models.TextChoices):
        DEFAULT = 'default', 'Default overview'
        SIOPP_AH = 'siopp_ah', 'SI opp / AH overview'

    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='qc_check_offs',
        help_text="QC user who checked off this contact",
    )
    contact = models.ForeignKey(
        QCContact,
        on_delete=models.CASCADE,
        related_name='checked_off_by',
        help_text="Contact that was checked off",
    )
    scope = models.CharField(
        max_length=32,
        choices=Scope.choices,
        default=Scope.DEFAULT,
        db_index=True,
        help_text="Which board/context this check-off applies to",
    )
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'qc_check_off'
        verbose_name = 'QC Check-off'
        verbose_name_plural = 'QC Check-offs'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'contact', 'scope'],
                name='qc_check_off_user_contact_scope_unique',
            ),
        ]
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['contact']),
            models.Index(fields=['user', 'scope']),
        ]
        ordering = ['-checked_at']

    def __str__(self):
        return f"{self.user.username} checked #{self.contact_id} ({self.scope})"


class XPEvent(models.Model):
    """
    Append-only log of gamification XP events.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='qc_xp_events',
    )
    event_type = models.CharField(max_length=64, db_index=True)
    xp_amount = models.IntegerField(default=0)
    contact_id = models.UUIDField(null=True, blank=True, db_index=True)
    metadata = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'qc_xp_event'
        verbose_name = 'QC XP Event'
        verbose_name_plural = 'QC XP Events'
        indexes = [
            models.Index(fields=['user', 'created_at'], name='qc_xp_user_created'),
            models.Index(fields=['created_at'], name='qc_xp_created'),
            models.Index(fields=['user', 'event_type', 'created_at'], name='qc_xp_user_type_created'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_id}:{self.event_type}:{self.xp_amount}"


class UserGamification(models.Model):
    """
    Denormalized gamification snapshot per user.
    """
    user = models.OneToOneField(
        'users.User',
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='qc_gamification',
    )
    total_xp = models.IntegerField(default=0)
    level = models.IntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(7)])
    streak_days = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    last_active_date = models.DateField(null=True, blank=True)
    leaderboard_opt_out = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'qc_user_gamification'
        verbose_name = 'QC User Gamification'
        verbose_name_plural = 'QC User Gamification'

    def __str__(self):
        return f"{self.user.username}: lvl{self.level} xp={self.total_xp}"


class Badge(models.Model):
    """
    Badge catalogue for gamification achievements.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    condition_type = models.CharField(max_length=64, db_index=True)
    condition_value = models.IntegerField(default=0)

    class Meta:
        db_table = 'qc_badge'
        verbose_name = 'QC Badge'
        verbose_name_plural = 'QC Badges'
        ordering = ['name']

    def __str__(self):
        return self.name


class UserBadge(models.Model):
    """
    User unlocked badges.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='qc_user_badges',
    )
    badge = models.ForeignKey(
        Badge,
        on_delete=models.CASCADE,
        related_name='unlocked_by',
    )
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'qc_user_badge'
        verbose_name = 'QC User Badge'
        verbose_name_plural = 'QC User Badges'
        constraints = [
            models.UniqueConstraint(fields=['user', 'badge'], name='qc_user_badge_unique')
        ]
        indexes = [
            models.Index(fields=['user', 'unlocked_at'], name='qc_user_badge_user_unlocked'),
        ]
        ordering = ['-unlocked_at']

    def __str__(self):
        return f"{self.user.username} -> {self.badge.code}"


class SalesChiefNotifyLog(models.Model):
    """
    Audit log for every email digest sent to a sales chief.
    Stores a snapshot of all included contacts so the record survives
    even if contacts are later deleted.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Who sent it
    sent_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_notify_logs_sent',
        help_text="QC admin who triggered the email",
    )
    sent_by_name = models.CharField(max_length=255, blank=True, help_text="Snapshot of sender name")

    # Who received it
    sales_chief = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qc_notify_logs_received',
        help_text="Sales chief the email was sent to",
    )
    sales_chief_name = models.CharField(max_length=255, blank=True)
    sales_chief_email = models.EmailField(blank=True, help_text="Snapshot of recipient email at send time")

    # Contacts included
    contact_count = models.IntegerField(default=0)
    contacts_snapshot = models.JSONField(
        default=list,
        help_text="Snapshot list of contact dicts at send time (id, name, seller, sale_date, status_label, comment)",
    )

    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'qc_sales_chief_notify_log'
        verbose_name = 'Sales Chief Notify Log'
        verbose_name_plural = 'Sales Chief Notify Logs'
        indexes = [
            models.Index(fields=['sent_by', 'sent_at'], name='qc_notify_log_sent_by_at'),
            models.Index(fields=['sales_chief', 'sent_at'], name='qc_notify_log_chief_at'),
            models.Index(fields=['sent_at'], name='qc_notify_log_sent_at'),
        ]
        ordering = ['-sent_at']

    def __str__(self):
        return f"Digest to {self.sales_chief_name} at {self.sent_at:%Y-%m-%d %H:%M} ({self.contact_count} contacts)"


class AuditEvent(models.Model):
    """
    Append-only audit trail of every meaningful action in the QC system.
    Written at trigger points in views; read only by QC admins via the audit-log endpoint.
    """
    ACTION_TYPES = [
        ('call_outcome',     'Call Outcome'),
        ('si_opp_flag',      'Si Opp Flagged'),
        ('utmeldt_flag',     'Utmeldt Flagged'),
        ('comment_edit',     'Comment Edited'),
        ('bulk_transfer',    'Bulk Transfer'),
        ('urgent_set',       'Urgent Flag Set'),
        ('urgent_cleared',   'Urgent Flag Cleared'),
        ('login',            'Login'),
        ('logout',           'Logout'),
        ('import_started',   'Import Started'),
        ('import_completed', 'Import Completed'),
        ('settings_changed', 'Settings Changed'),
    ]

    STATUS_CHOICES = [
        ('success', 'Success'),
        ('error',   'Error'),
        ('flagged', 'Flagged'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    action_type = models.CharField(max_length=32, choices=ACTION_TYPES, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='success')

    # Who performed the action — denormalized for history stability if user is later deleted
    agent = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events',
    )
    agent_name = models.CharField(max_length=128, blank=True)
    agent_id_code = models.CharField(max_length=32, blank=True)  # ab_person_id e.g. "5010"

    # What it affected — all nullable, not all actions touch a contact
    contact = models.ForeignKey(
        'QCContact',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events',
    )
    customer_name = models.CharField(max_length=256, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_events',
    )

    # Full action payload — varies by action_type
    details = models.JSONField(default=dict)

    class Meta:
        db_table = 'qc_audit_event'
        verbose_name = 'Audit Event'
        verbose_name_plural = 'Audit Events'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['agent', 'timestamp'],       name='qc_audit_agent_ts'),
            models.Index(fields=['action_type', 'timestamp'], name='qc_audit_type_ts'),
            models.Index(fields=['contact', 'timestamp'],     name='qc_audit_contact_ts'),
            models.Index(fields=['campaign', 'timestamp'],    name='qc_audit_campaign_ts'),
        ]

    def __str__(self):
        return f"{self.action_type} by {self.agent_name} at {self.timestamp:%Y-%m-%d %H:%M}"
