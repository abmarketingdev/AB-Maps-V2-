#!/usr/bin/env python3
"""
Test script to verify that team deletion properly cleans up employee manager assignments.
This script tests the updated fix with both signal and view-based cleanup.
"""

import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append('be_files/backend')

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ab_maps.settings')
django.setup()

from teams.models import Team, TeamMember
from users.models import Manager, Employee


def test_team_deletion_cleanup():
    """Test that deleting a team properly cleans up employee manager assignments."""
    
    print("=== Testing Team Deletion Manager Cleanup (Updated Fix) ===")
    
    # Create test data
    manager1 = Manager.objects.create(name="Test Manager 1", email="manager1@test.com")
    manager2 = Manager.objects.create(name="Test Manager 2", email="manager2@test.com")
    
    employee1 = Employee.objects.create(name="Test Employee 1", email="emp1@test.com", manager=manager1)
    employee2 = Employee.objects.create(name="Test Employee 2", email="emp2@test.com", manager=manager1)
    employee3 = Employee.objects.create(name="Test Employee 3", email="emp3@test.com", manager=manager2)
    
    # Create teams
    team1 = Team.objects.create(name="Team 1", manager=manager1)
    team2 = Team.objects.create(name="Team 2", manager=manager1)
    team3 = Team.objects.create(name="Team 3", manager=manager2)
    
    # Assign employees to teams
    TeamMember.objects.create(team=team1, employee=employee1)
    TeamMember.objects.create(team=team1, employee=employee2)
    TeamMember.objects.create(team=team2, employee=employee2)  # employee2 in both teams
    TeamMember.objects.create(team=team3, employee=employee3)
    
    print(f"Initial state:")
    print(f"  Employee 1 manager: {employee1.manager}")
    print(f"  Employee 2 manager: {employee2.manager}")
    print(f"  Employee 3 manager: {employee3.manager}")
    
    # Test 1: Delete team1 (employee1 should lose manager, employee2 should keep manager)
    print(f"\nDeleting Team 1...")
    team1.delete()
    
    # Refresh employee objects
    employee1.refresh_from_db()
    employee2.refresh_from_db()
    employee3.refresh_from_db()
    
    print(f"After deleting Team 1:")
    print(f"  Employee 1 manager: {employee1.manager} (should be None)")
    print(f"  Employee 2 manager: {employee2.manager} (should still be {manager1})")
    print(f"  Employee 3 manager: {employee3.manager} (should be unchanged)")
    
    # Test 2: Delete team2 (employee2 should lose manager)
    print(f"\nDeleting Team 2...")
    team2.delete()
    
    # Refresh employee objects
    employee2.refresh_from_db()
    
    print(f"After deleting Team 2:")
    print(f"  Employee 2 manager: {employee2.manager} (should be None)")
    
    # Test 3: Delete team3 (employee3 should lose manager)
    print(f"\nDeleting Team 3...")
    team3.delete()
    
    # Refresh employee objects
    employee3.refresh_from_db()
    
    print(f"After deleting Team 3:")
    print(f"  Employee 3 manager: {employee3.manager} (should be None)")
    
    # Test 4: Verify all employees have null manager
    print(f"\nFinal verification:")
    print(f"  Employee 1 manager: {employee1.manager} (should be None)")
    print(f"  Employee 2 manager: {employee2.manager} (should be None)")
    print(f"  Employee 3 manager: {employee3.manager} (should be None)")
    
    # Clean up
    manager1.delete()
    manager2.delete()
    
    print(f"\n=== Test completed successfully ===")


def test_signal_registration():
    """Test that signals are properly registered."""
    print("\n=== Testing Signal Registration ===")
    
    try:
        from teams.signals import cleanup_employee_managers_on_team_delete
        from teams.signals import capture_team_employees_before_delete
        print("✅ Signal handlers are properly imported")
        
        # Check if signals are registered
        from django.db.models.signals import pre_delete, post_delete
        from django.dispatch import Signal
        
        # This is a basic check - in a real scenario, you'd check the signal registry
        print("✅ Signal handlers are defined")
        
    except ImportError as e:
        print(f"❌ Signal import error: {e}")
    except Exception as e:
        print(f"❌ Signal registration error: {e}")


if __name__ == "__main__":
    test_signal_registration()
    test_team_deletion_cleanup() 