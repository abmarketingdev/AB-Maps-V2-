#!/usr/bin/env python3
"""
Fix the manager relationship properly.
"""
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'be_files', 'backend'))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ab_maps.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import Manager

User = get_user_model()

def fix_manager_relationship():
    """Fix the manager relationship properly."""
    print("Fixing Manager Relationship")
    print("=" * 50)
    
    # Get test user
    test_manager_user = User.objects.filter(username='test_manager').first()
    
    if not test_manager_user:
        print("❌ Test manager user not found!")
        return
    
    print(f"✅ Test manager user: {test_manager_user.username}")
    
    # Find the existing manager
    existing_manager = Manager.objects.filter(email=test_manager_user.email).first()
    
    if not existing_manager:
        print("❌ No existing manager found!")
        return
    
    print(f"✅ Found existing manager: {existing_manager.name}")
    
    # Check if manager already has a user
    try:
        if existing_manager.user:
            print(f"Manager already has user: {existing_manager.user.username}")
            if existing_manager.user != test_manager_user:
                print("❌ Manager is linked to different user!")
                # Unlink from other user
                existing_manager.user = None
                existing_manager.save()
                print("✅ Unlinked manager from other user")
    except Manager.user.RelatedObjectDoesNotExist:
        print("✅ Manager has no user relationship (this is expected)")
    
    # Link manager to test user (from User side)
    test_manager_user.manager = existing_manager
    test_manager_user.save()
    
    print("✅ Linked manager to test user")
    
    # Verify the relationship
    test_manager_user.refresh_from_db()
    try:
        manager = test_manager_user.manager
        if manager:
            print(f"✅ Verification successful: {manager.name}")
        else:
            print("❌ Relationship still not working!")
    except Manager.DoesNotExist:
        print("❌ Relationship still not working!")

if __name__ == "__main__":
    fix_manager_relationship() 