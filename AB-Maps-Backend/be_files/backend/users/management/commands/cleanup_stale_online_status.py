"""
Django management command to clean up stale online statuses.

This command marks users as offline if they haven't been seen for more than 5 minutes.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from users.models import Employee, Manager


class Command(BaseCommand):
    help = 'Clean up stale online statuses for employees and managers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout',
            type=int,
            default=30,
            help='Timeout in minutes for considering a user offline (default: 30)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes'
        )

    def handle(self, *args, **options):
        timeout_minutes = options['timeout']
        dry_run = options['dry_run']
        
        # Calculate the cutoff time
        cutoff_time = timezone.now() - timedelta(minutes=timeout_minutes)
        
        self.stdout.write(f"Checking for users not seen since {cutoff_time}")
        self.stdout.write(f"Timeout: {timeout_minutes} minutes")
        self.stdout.write(f"Dry run: {dry_run}")
        
        # Check employees
        stale_employees = Employee.objects.filter(
            is_online=True,
            last_seen__lt=cutoff_time
        )
        
        # Check managers
        stale_managers = Manager.objects.filter(
            is_online=True,
            last_seen__lt=cutoff_time
        )
        
        total_stale = stale_employees.count() + stale_managers.count()
        
        if total_stale == 0:
            self.stdout.write(
                self.style.SUCCESS('No stale online statuses found!')
            )
            return
        
        self.stdout.write(f"Found {stale_employees.count()} stale employees:")
        for employee in stale_employees:
            self.stdout.write(f"  - {employee.name} (last seen: {employee.last_seen})")
        
        self.stdout.write(f"Found {stale_managers.count()} stale managers:")
        for manager in stale_managers:
            self.stdout.write(f"  - {manager.name} (last seen: {manager.last_seen})")
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'DRY RUN: Would mark {total_stale} users as offline')
            )
        else:
            # Update employees
            updated_employees = stale_employees.update(is_online=False)
            
            # Update managers
            updated_managers = stale_managers.update(is_online=False)
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully marked {updated_employees} employees and {updated_managers} managers as offline'
                )
            ) 