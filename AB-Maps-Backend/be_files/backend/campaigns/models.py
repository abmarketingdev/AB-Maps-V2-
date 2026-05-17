"""
Models for the campaigns app.
"""
import uuid
from django.db import models
from django.utils import timezone
from areas.models import Area


class Campaign(models.Model):
    """Campaign model for AB Maps system."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        'users.Manager',
        on_delete=models.CASCADE,
        related_name='created_campaigns',
        help_text="Manager who created this campaign"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    brand_color_hex = models.CharField(
        max_length=7,
        null=True,
        blank=True,
        help_text="Optional QC UI accent color (#RRGGBB); unset means default theme",
    )

    class Meta:
        db_table = 'campaign'
        verbose_name = 'Campaign'
        verbose_name_plural = 'Campaigns'

    def __str__(self):
        return self.name


class CampaignForm(models.Model):
    """Campaign Form model for storing form submissions."""
    STATUS_CHOICES = [
        ('done', 'Done'),
        ('not_done', 'Not Done'),
    ]
    
    # Unique identifier for the form
    unique_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Campaign relationship
    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name='forms',
        db_column='campaign_id',
        help_text="Campaign this form belongs to"
    )
    
    # Status of the form
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='not_done',
        help_text="Form completion status"
    )
    
    # Sales representative (can be either Manager or Employee)
    sales_rep_id = models.UUIDField(
        help_text="ID of the manager or employee who submitted the form",
        null=True,
        blank=True
    )
    
    # Personal information
    first_name = models.CharField(max_length=255, help_text="First name of the person", null=True, blank=True)
    last_name = models.CharField(max_length=255, help_text="Last name of the person", null=True, blank=True)
    email = models.EmailField(help_text="Email address", null=True, blank=True)
    sms_phone_number = models.CharField(max_length=20, help_text="SMS phone number", null=True, blank=True)
    kidnumber = models.CharField(max_length=50, null=True, blank=True, help_text="KID number (can be null)")
    date_of_birth = models.DateField(help_text="Date of birth", null=True, blank=True)
    
    # Address relationship (cascading)
    address = models.ForeignKey(
        'addresses.Address',
        on_delete=models.CASCADE,
        related_name='campaign_forms',
        null=True,
        blank=True,
        db_column='address_id',
        help_text="Associated address - when address is deleted, this form is also deleted"
    )
    
    # Address information (manual entry - kept for backward compatibility)
    address_text = models.CharField(max_length=500, help_text="Street address", null=True, blank=True)
    postnummer = models.CharField(max_length=10, help_text="Postal code", null=True, blank=True)
    posted = models.CharField(max_length=255, help_text="City/Postal area", null=True, blank=True)
    
    # Financial information
    kontonummer = models.CharField(max_length=50, help_text="Account number", null=True, blank=True)
    gavebeløp = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True,
        blank=True,
        help_text="Donation amount"
    )
    beløpsgrense = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True,
        blank=True,
        help_text="Amount limit"
    )
    
    # Tax deduction information
    skattefradrag_fødselsnummer = models.CharField(
        max_length=11, 
        help_text="National ID number for tax deduction",
        null=True,
        blank=True
    )
    
    # Metadata
    current_date = models.DateTimeField(default=timezone.now, help_text="Date when form was submitted")
    personel_number = models.CharField(max_length=50, help_text="Personnel number", null=True, blank=True)
    skip = models.BooleanField(default=False, help_text="Whether to skip this form")
    
    # Signature (base64 encoded)
    signature = models.TextField(help_text="Base64 encoded signature", null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # KID Generation fields
    kid_number = models.CharField(max_length=50, null=True, blank=True, help_text="Generated KID number")
    kid_generated_at = models.DateTimeField(null=True, blank=True, help_text="When KID was generated")
    kid_generation_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('success', 'Success'),
            ('failed', 'Failed')
        ],
        default='pending',
        help_text="Status of KID generation"
    )
    kid_error_message = models.TextField(null=True, blank=True, help_text="Error message if KID generation failed")
    
    # External API tracking
    external_person_id = models.CharField(max_length=100, null=True, blank=True, help_text="PersonId from LagrePerson API")
    external_agreement_id = models.CharField(max_length=100, null=True, blank=True, help_text="Agreement ID from LagreGiveravtale API")

    class Meta:
        db_table = 'campaign_form'
        verbose_name = 'Campaign Form'
        verbose_name_plural = 'Campaign Forms'
        indexes = [
            models.Index(fields=['campaign', 'status']),
            models.Index(fields=['sales_rep_id']),
            models.Index(fields=['current_date']),
            models.Index(fields=['address']),
        ]

    def __str__(self):
        return f"Form {self.unique_id} - {self.first_name} {self.last_name} ({self.campaign.name})"

    @property
    def full_name(self):
        """Return the full name of the person."""
        first = self.first_name or ""
        last = self.last_name or ""
        full = f"{first} {last}".strip()
        return full if full else "Unnamed"


class CampaignArea(models.Model):
    """Many-to-many relationship between Campaign and Area."""
    campaign = models.ForeignKey('Campaign', on_delete=models.CASCADE)
    area = models.ForeignKey('areas.Area', on_delete=models.CASCADE, db_column='area_id')  # ON DELETE CASCADE
    
    class Meta:
        db_table = 'campaign_area'
        unique_together = ('campaign', 'area')
        verbose_name = 'Campaign Area'
        verbose_name_plural = 'Campaign Areas'

    def __str__(self):
        return f"{self.campaign.name} - Area {self.area.id}"


class CampaignEmployee(models.Model):
    """Many-to-many relationship between Campaign and Employee/Manager."""
    campaign = models.ForeignKey('Campaign', on_delete=models.CASCADE, related_name='campaign_employees')
    employee = models.ForeignKey(
        'users.Employee', 
        on_delete=models.CASCADE, 
        related_name='campaign_assignments',
        null=True,
        blank=True
    )
    manager = models.ForeignKey(
        'users.Manager',
        on_delete=models.CASCADE,
        related_name='campaign_assignments',
        null=True,
        blank=True
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'campaign_employee'
        unique_together = [
            ('campaign', 'employee'),
            ('campaign', 'manager'),
        ]
        verbose_name = 'Campaign Assignment'
        verbose_name_plural = 'Campaign Assignments'
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(employee__isnull=False, manager__isnull=True) |
                    models.Q(employee__isnull=True, manager__isnull=False)
                ),
                name='campaign_employee_exactly_one_person'
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
        return f"{self.campaign.name} - {person.name} ({person_type})"
    
    @property
    def person(self):
        """Get the person (employee or manager) assigned to this campaign."""
        return self.employee if self.employee else self.manager
    
    @property
    def person_type(self):
        """Get the type of person: 'employee' or 'manager'."""
        return 'employee' if self.employee else 'manager'
