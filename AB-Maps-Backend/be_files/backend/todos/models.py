"""
Models for the Todos app.
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Todo(models.Model):
    """
    Personal todo/task model for AB Maps users.
    
    Each user (manager or employee) manages their own tasks.
    No assignment system - purely personal productivity.
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED = 'completed', 'Completed'
    
    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
    
    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # Owner (who this task belongs to)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='todos',
        help_text="User who owns this task"
    )
    
    # Task information
    title = models.CharField(
        max_length=255,
        help_text="Task title"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed description (optional)"
    )
    
    # Task properties
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM
    )
    
    # Timing
    deadline = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Task deadline (optional)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Explicit assignment flag for frontend filtering
    is_admin_assigned = models.BooleanField(
        default=False,
        help_text="True if this task was assigned by another user (admin/manager)"
    )
    
    # Track who assigned this task
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_todos',
        help_text="User who assigned this task (if assigned)"
    )
    
    # Optional: Link to entities for context
    related_address = models.ForeignKey(
        'addresses.Address',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='todos',
        help_text="Optional: Address this task relates to"
    )
    related_campaign = models.ForeignKey(
        'campaigns.Campaign',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='todos',
        help_text="Optional: Campaign this task relates to"
    )
    
    class Meta:
        db_table = 'todo'
        verbose_name = 'Todo'
        verbose_name_plural = 'Todos'
        ordering = ['-priority', 'deadline', '-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'deadline']),
            models.Index(fields=['user', 'is_admin_assigned']),
            models.Index(fields=['status', 'deadline']),
            models.Index(fields=['assigned_by', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.get_status_display()}"
    
    def save(self, *args, **kwargs):
        """Auto-set completed_at when marked as completed."""
        if self.status == self.Status.COMPLETED and not self.completed_at:
            self.completed_at = timezone.now()
        
        # Clear completed_at if status changed back
        if self.status != self.Status.COMPLETED:
            self.completed_at = None
        
        super().save(*args, **kwargs)
    
    @property
    def is_overdue(self):
        """Check if task is overdue."""
        if not self.deadline:
            return False
        return timezone.now() > self.deadline and self.status != self.Status.COMPLETED
    
    @property
    def days_until_deadline(self):
        """Calculate days until deadline."""
        if not self.deadline:
            return None
        delta = self.deadline - timezone.now()
        return delta.days
    