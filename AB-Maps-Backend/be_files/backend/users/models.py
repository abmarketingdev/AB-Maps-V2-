"""
Models for the users app.
"""
import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError


class Manager(models.Model):
    """Manager model for AB Maps system."""
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('busy', 'Busy'),
        ('away', 'Away'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline')
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'manager'
        verbose_name = 'Manager'
        verbose_name_plural = 'Managers'

    def __str__(self):
        return f"{self.name} ({self.email})"


class Employee(models.Model):
    """Employee model for AB Maps system."""
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('busy', 'Busy'),
        ('away', 'Away'),
        ('working', 'Working'),
        ('break', 'Break'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline')
    is_online = models.BooleanField(default=False)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employee'
        verbose_name = 'Employee'
        verbose_name_plural = 'Employees'

    def __str__(self):
        return f"{self.name} ({self.email})"


class User(AbstractUser):
    """Custom User model extending Django's AbstractUser."""
    
    # Employee type choices - only for employees, not managers
    EMPLOYEE_TYPE_CHOICES = [
        ('maps_emp', 'Maps Employee'),
        ('qc_emp', 'QC Employee'),
    ]
    
    # Admin type choices - only for superusers (is_superuser=True and is_staff=True)
    ADMIN_TYPE_CHOICES = [
        ('maps_admin', 'Maps Admin'),
        ('qc_admin', 'QC Admin'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ab_person_id = models.CharField(
        max_length=4,
        unique=True,
        null=True,
        blank=True,
        help_text="4-digit unique person ID (manually set by admin)"
    )
    employee = models.OneToOneField(
        Employee, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='user'
    )
    manager = models.OneToOneField(
        Manager, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='user'
    )
    employee_type = models.CharField(
        max_length=20,
        choices=EMPLOYEE_TYPE_CHOICES,
        null=True,
        blank=True,
        help_text="Employee type - only for employees, not managers"
    )
    admin_type = models.CharField(
        max_length=20,
        choices=ADMIN_TYPE_CHOICES,
        null=True,
        blank=True,
        help_text="Admin type - only for superusers (is_superuser=True and is_staff=True)"
    )
    is_sales_chief = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Sales chief — included in QC sales-chief directory when True",
    )

    class Meta:
        db_table = 'auth_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def clean(self):
        """
        Validate that employee_type and admin_type are set correctly.
        This ensures data integrity at the model level.
        """
        super().clean()
        
        # Rule 1: If employee_type is set, user MUST have an employee relationship
        if self.employee_type is not None:
            if not self.employee:
                raise ValidationError({
                    'employee_type': 'employee_type can only be set for users with an employee relationship.'
                })
        
        # Rule 2: If user has a manager relationship, employee_type MUST be None
        if self.manager is not None and self.manager:
            if self.employee_type is not None:
                raise ValidationError({
                    'employee_type': 'employee_type cannot be set for managers or superusers.'
                })
        
        # Rule 3: If admin_type is set, user MUST be a superuser (is_superuser=True and is_staff=True)
        if self.admin_type is not None:
            if not (self.is_superuser and self.is_staff):
                raise ValidationError({
                    'admin_type': 'admin_type can only be set for superusers (is_superuser=True and is_staff=True).'
                })
        
        # Rule 4: If user is a superuser, admin_type should be set (but can be None for backward compatibility)
        # This is a soft validation - we allow None for existing superusers
        
        # Rule 5: If user is NOT a superuser, admin_type MUST be None
        if not (self.is_superuser and self.is_staff):
            if self.admin_type is not None:
                raise ValidationError({
                    'admin_type': 'admin_type cannot be set for non-superusers.'
                })

    def save(self, *args, **kwargs):
        """
        Override save to:
        1. Ensure employee_type is None for managers/superusers (auto-cleanup)
        2. Ensure admin_type is None for non-superusers (auto-cleanup)
        3. Call full_clean() to run validation before saving
        """
        # Auto-cleanup: Ensure employee_type is None for managers/superusers
        if self.manager and self.employee_type is not None:
            self.employee_type = None
        
        # Auto-cleanup: Ensure admin_type is None for non-superusers
        if not (self.is_superuser and self.is_staff):
            if self.admin_type is not None:
                self.admin_type = None
        
        # Run validation (clean() method) before saving
        # This ensures data integrity even if validation wasn't called explicitly
        self.full_clean()
        
        super().save(*args, **kwargs)

    def __str__(self):
        # Avoid database queries in async contexts
        if hasattr(self, '_employee_cache') and self._employee_cache is not None:
            return f"{self._employee_cache.name} (Employee)"
        elif hasattr(self, '_manager_cache') and self._manager_cache is not None:
            return f"{self._manager_cache.name} (Manager)"
        return self.username


class SalesChiefTeamMember(models.Model):
    """
    Links a sales chief (User.is_sales_chief=True) to their team members (other Users).
    Each row is one membership — a member can only appear once per chief.
    """
    ROLE_CHOICES = [
        ('manager', 'Manager'),
        ('employee', 'Employee'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sales_chief = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='team_members',
        limit_choices_to={'is_sales_chief': True},
    )
    member = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='chief_memberships',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sales_chief_team_member'
        unique_together = [('sales_chief', 'member')]
        verbose_name = 'Sales Chief Team Member'
        verbose_name_plural = 'Sales Chief Team Members'

    def __str__(self):
        return f"{self.member} → {self.sales_chief} ({self.role})"
