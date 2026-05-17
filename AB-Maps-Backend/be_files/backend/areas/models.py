"""
Models for the areas app.
"""
import uuid
from django.db import models
from django.contrib.gis.db import models as gis_models
from django.utils import timezone
from django.core.exceptions import ValidationError


class Area(models.Model):
    """Area model for AB Maps system."""
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    polygon_geometry = gis_models.PolygonField(srid=4326, null=True, blank=True)
    color = models.CharField(max_length=7, null=True, blank=True)  # Hex color
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    fylke = models.CharField(max_length=100, null=True, blank=True)
    house_count = models.IntegerField(null=True, blank=True)
    apartment_count = models.IntegerField(default=0, help_text="Total number of apartments in this area")
    created_by = models.ForeignKey(
        'users.Manager',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_areas',
        help_text="Manager who created this area",
        default=None
    )
    manager = models.ForeignKey(
        'users.Manager', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='managed_areas'
    )
    employees = models.ManyToManyField(
        'users.Employee', 
        through='AreaEmployee',
        related_name='assigned_areas'
    )
    start_date = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="Start date for the area. Auto-set to created_at if not provided."
    )
    end_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="End date for the area. Areas with end_date < current_date are considered expired."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'area'
        verbose_name = 'Area'
        verbose_name_plural = 'Areas'

    def clean(self):
        """Validate that end_date is after start_date."""
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValidationError({
                    'end_date': 'End date must be after start date.'
                })
    
    def save(self, *args, **kwargs):
        """Auto-set start_date to current time for new areas if not provided."""
        if not self.start_date and not self.pk:
            # New area, set start_date to current time
            # Note: For existing areas without start_date, migration will handle it
            self.start_date = timezone.now()
        self.full_clean()
        super().save(*args, **kwargs)
    
    @property
    def is_expired(self):
        """Check if area has expired (end_date < current_date)."""
        if not self.end_date:
            return False
        return timezone.now().date() > self.end_date.date()
    
    @property
    def is_active(self):
        """Check if area is currently active (within date range)."""
        if not self.start_date or not self.end_date:
            return True  # Legacy areas without dates are considered active
        now = timezone.now().date()
        return self.start_date.date() <= now <= self.end_date.date()

    def __str__(self):
        return self.name


class AreaEmployee(models.Model):
    """Many-to-many relationship between Area and Employee/Manager."""
    area = models.ForeignKey(Area, on_delete=models.CASCADE)
    employee = models.ForeignKey(
        'users.Employee', 
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='area_assignments'
    )
    manager = models.ForeignKey(
        'users.Manager',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='area_assignments'
    )
    
    class Meta:
        db_table = 'area_employee'
        unique_together = [
            ('area', 'employee'),
            ('area', 'manager'),
        ]
        verbose_name = 'Area Assignment'
        verbose_name_plural = 'Area Assignments'
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(employee__isnull=False, manager__isnull=True) |
                    models.Q(employee__isnull=True, manager__isnull=False)
                ),
                name='area_employee_exactly_one_person'
            )
        ]

    def clean(self):
        """Validate that exactly one of employee or manager is set."""
        from django.core.exceptions import ValidationError
        if not self.employee and not self.manager:
            raise ValidationError('Either employee or manager must be set.')
        if self.employee and self.manager:
            raise ValidationError('Cannot set both employee and manager.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        person = self.employee if self.employee else self.manager
        person_type = "Employee" if self.employee else "Manager"
        return f"{self.area.name} - {person.name} ({person_type})"
    
    @property
    def person(self):
        """Get the person (employee or manager) assigned to this area."""
        return self.employee if self.employee else self.manager
    
    @property
    def person_type(self):
        """Get the type of person: 'employee' or 'manager'."""
        return 'employee' if self.employee else 'manager'
