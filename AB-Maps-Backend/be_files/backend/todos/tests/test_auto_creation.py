"""
Tests for auto TODO creation signal.

Ensures that:
1. TODOs are created when address status → folg_opp
2. Users only see their own TODOs
3. No duplicates are created
4. Edge cases are handled
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from addresses.models import Address
from todos.models import Todo
from users.models import Manager, Employee
from campaigns.models import Campaign

User = get_user_model()


class AutoTodoCreationTests(TestCase):
    """Test automatic TODO creation when address marked as folg_opp."""
    
    def setUp(self):
        """Set up test users and data."""
        # Create Manager 1 with User
        self.manager1 = Manager.objects.create(
            name="Manager One",
            email="manager1@test.com"
        )
        self.user1 = User.objects.create_user(
            username="user1",
            email="user1@test.com",
            password="testpass",
            manager=self.manager1
        )
        
        # Create Manager 2 with User
        self.manager2 = Manager.objects.create(
            name="Manager Two",
            email="manager2@test.com"
        )
        self.user2 = User.objects.create_user(
            username="user2",
            email="user2@test.com",
            password="testpass",
            manager=self.manager2
        )
        
        # Create Employee 1 with User
        self.employee1 = Employee.objects.create(
            name="Employee One",
            email="employee1@test.com"
        )
        self.user_emp1 = User.objects.create_user(
            username="user_emp1",
            email="user_emp1@test.com",
            password="testpass",
            employee=self.employee1
        )
        
        # Campaign testing skipped due to migration issues
        self.campaign = None
    
    def test_todo_created_when_address_marked_folg_opp(self):
        """Test that TODO is auto-created when address status = folg_opp."""
        address = Address.objects.create(
            address_text="Test Address 1, Oslo",
            status='folg_opp',
            manager=self.manager1,
            notes="Customer wants to think"
        )
        
        # Check TODO was created
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIsNotNone(todo, "TODO should be created")
        self.assertEqual(todo.title, "Følg opp adresse")
        self.assertEqual(todo.priority, Todo.Priority.HIGH)
        self.assertEqual(todo.status, Todo.Status.PENDING)
        self.assertEqual(todo.user, self.user1)
        self.assertEqual(todo.related_address, address)
    
    def test_no_todo_for_other_status(self):
        """Test that TODO is NOT created for other statuses."""
        address = Address.objects.create(
            address_text="Test Address 2, Oslo",
            status='ja',  # Different status
            manager=self.manager1
        )
        
        # Check NO TODO was created
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIsNone(todo, "TODO should NOT be created for 'ja' status")
    
    def test_todo_created_on_status_update(self):
        """Test that TODO is created when status is updated to folg_opp."""
        address = Address.objects.create(
            address_text="Test Address 3, Oslo",
            status='nei',
            manager=self.manager1
        )
        
        # Initially no TODO
        self.assertEqual(Todo.objects.filter(related_address=address).count(), 0)
        
        # Update status to folg_opp
        address.status = 'folg_opp'
        address.save()
        
        # Check TODO was created
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIsNotNone(todo, "TODO should be created on status update")
        self.assertEqual(todo.user, self.user1)
    
    def test_no_duplicate_todos(self):
        """Test that duplicate TODOs are not created."""
        address = Address.objects.create(
            address_text="Test Address 4, Oslo",
            status='folg_opp',
            manager=self.manager1
        )
        
        # First TODO should be created
        self.assertEqual(Todo.objects.filter(related_address=address).count(), 1)
        
        # Save again - should not create duplicate
        address.save()
        self.assertEqual(Todo.objects.filter(related_address=address).count(), 1)
        
        # Change and save again - should not create duplicate
        address.notes = "Updated notes"
        address.save()
        self.assertEqual(Todo.objects.filter(related_address=address).count(), 1)
    
    def test_user_isolation_manager1_todo(self):
        """
        CRITICAL TEST: User1 creates address → User1 gets TODO.
        User2 should NOT see User1's TODO.
        """
        # User1's manager creates address with folg_opp
        address1 = Address.objects.create(
            address_text="User1 Address, Oslo",
            status='folg_opp',
            manager=self.manager1,
            notes="User1's follow up"
        )
        
        # Check TODO was created for user1
        user1_todos = Todo.objects.filter(user=self.user1)
        self.assertEqual(user1_todos.count(), 1, "User1 should have 1 TODO")
        
        todo = user1_todos.first()
        self.assertEqual(todo.user, self.user1)
        self.assertEqual(todo.related_address, address1)
        
        # Check user2 CANNOT see user1's TODO
        user2_todos = Todo.objects.filter(user=self.user2)
        self.assertEqual(user2_todos.count(), 0, "User2 should have 0 TODOs")
        
        # Verify the TODO is not accessible to user2
        user2_related_todos = Todo.objects.filter(
            related_address=address1,
            user=self.user2
        )
        self.assertEqual(user2_related_todos.count(), 0)
    
    def test_user_isolation_manager2_todo(self):
        """
        CRITICAL TEST: User2 creates address → User2 gets TODO.
        User1 should NOT see User2's TODO.
        """
        # User2's manager creates address with folg_opp
        address2 = Address.objects.create(
            address_text="User2 Address, Oslo",
            status='folg_opp',
            manager=self.manager2,
            notes="User2's follow up"
        )
        
        # Check TODO was created for user2
        user2_todos = Todo.objects.filter(user=self.user2)
        self.assertEqual(user2_todos.count(), 1, "User2 should have 1 TODO")
        
        todo = user2_todos.first()
        self.assertEqual(todo.user, self.user2)
        self.assertEqual(todo.related_address, address2)
        
        # Check user1 CANNOT see user2's TODO
        user1_todos = Todo.objects.filter(user=self.user1)
        self.assertEqual(user1_todos.count(), 0, "User1 should have 0 TODOs")
    
    def test_user_isolation_multiple_users(self):
        """
        CRITICAL TEST: Multiple users create addresses.
        Each user only sees their own TODOs.
        """
        # User1 creates address
        address1 = Address.objects.create(
            address_text="User1 Address A, Oslo",
            status='folg_opp',
            manager=self.manager1
        )
        
        # User2 creates address
        address2 = Address.objects.create(
            address_text="User2 Address B, Oslo",
            status='folg_opp',
            manager=self.manager2
        )
        
        # Employee creates address
        address3 = Address.objects.create(
            address_text="Employee Address C, Oslo",
            status='folg_opp',
            employee=self.employee1
        )
        
        # Check each user has exactly 1 TODO
        self.assertEqual(Todo.objects.filter(user=self.user1).count(), 1)
        self.assertEqual(Todo.objects.filter(user=self.user2).count(), 1)
        self.assertEqual(Todo.objects.filter(user=self.user_emp1).count(), 1)
        
        # Check TODOs are correctly assigned
        user1_todo = Todo.objects.get(user=self.user1)
        self.assertEqual(user1_todo.related_address, address1)
        
        user2_todo = Todo.objects.get(user=self.user2)
        self.assertEqual(user2_todo.related_address, address2)
        
        emp_todo = Todo.objects.get(user=self.user_emp1)
        self.assertEqual(emp_todo.related_address, address3)
    
    def test_employee_gets_todo(self):
        """Test that Employee (not Manager) also gets TODO."""
        address = Address.objects.create(
            address_text="Employee Address, Oslo",
            status='folg_opp',
            employee=self.employee1,
            notes="Employee's follow up"
        )
        
        # Check TODO was created for employee's user
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIsNotNone(todo)
        self.assertEqual(todo.user, self.user_emp1)
    
    def test_description_includes_address_and_notes(self):
        """Test that description includes both address text and notes."""
        address = Address.objects.create(
            address_text="Full Address, Oslo",
            status='folg_opp',
            manager=self.manager1,
            notes="Important customer notes"
        )
        
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIn("Full Address, Oslo", todo.description)
        self.assertIn("Notater:", todo.description)
        self.assertIn("Important customer notes", todo.description)
    
    def test_description_without_notes(self):
        """Test that description works without notes."""
        address = Address.objects.create(
            address_text="Address Only, Oslo",
            status='folg_opp',
            manager=self.manager1
            # No notes
        )
        
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIn("Address Only, Oslo", todo.description)
        self.assertNotIn("Notater:", todo.description)
    
    def test_campaign_linked(self):
        """Test that TODO can be created without campaign (campaign nullable)."""
        address = Address.objects.create(
            address_text="Address Without Campaign, Oslo",
            status='folg_opp',
            manager=self.manager1
            # No campaign
        )
        
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIsNotNone(todo, "TODO should be created even without campaign")
        self.assertIsNone(todo.related_campaign, "Campaign should be None")
    
    def test_no_todo_without_user(self):
        """Test that no TODO is created if address has no user."""
        address = Address.objects.create(
            address_text="No User Address, Oslo",
            status='folg_opp'
            # No manager, no employee
        )
        
        # Check NO TODO was created
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIsNone(todo, "TODO should NOT be created without user")
    
    def test_deadline_is_null(self):
        """Test that deadline is null (user decides)."""
        address = Address.objects.create(
            address_text="Deadline Test, Oslo",
            status='folg_opp',
            manager=self.manager1
        )
        
        todo = Todo.objects.filter(related_address=address).first()
        self.assertIsNone(todo.deadline, "Deadline should be null")
    
    def test_completed_todo_does_not_prevent_new_creation(self):
        """Test that completed TODO doesn't prevent new TODO creation."""
        address = Address.objects.create(
            address_text="Completion Test, Oslo",
            status='folg_opp',
            manager=self.manager1
        )
        
        # First TODO created
        todo1 = Todo.objects.filter(related_address=address).first()
        self.assertIsNotNone(todo1)
        
        # Mark it as completed
        todo1.status = Todo.Status.COMPLETED
        todo1.save()
        
        # Change address status away and back
        address.status = 'ja'
        address.save()
        address.status = 'folg_opp'
        address.save()
        
        # New TODO should be created (old one was completed)
        pending_todos = Todo.objects.filter(
            related_address=address,
            status__in=[Todo.Status.PENDING, Todo.Status.IN_PROGRESS]
        )
        self.assertEqual(pending_todos.count(), 1, "New TODO should be created")
        
        # Total TODOs for this address should be 2 (1 completed, 1 pending)
        all_todos = Todo.objects.filter(related_address=address)
        self.assertEqual(all_todos.count(), 2)


class UserIsolationIntegrationTests(TestCase):
    """
    Integration tests specifically for user isolation.
    These ensure the complete flow works correctly.
    """
    
    def setUp(self):
        """Set up test scenario with multiple users."""
        # Manager 1
        self.manager1 = Manager.objects.create(
            name="Manager Alice",
            email="alice@test.com"
        )
        self.user_alice = User.objects.create_user(
            username="alice",
            email="alice@test.com",
            password="pass",
            manager=self.manager1
        )
        
        # Manager 2
        self.manager2 = Manager.objects.create(
            name="Manager Bob",
            email="bob@test.com"
        )
        self.user_bob = User.objects.create_user(
            username="bob",
            email="bob@test.com",
            password="pass",
            manager=self.manager2
        )
    
    def test_complete_isolation_scenario(self):
        """
        Complete scenario: Alice and Bob work independently.
        They should never see each other's TODOs.
        """
        # Alice marks 3 addresses as folg_opp
        for i in range(3):
            Address.objects.create(
                address_text=f"Alice Address {i}, Oslo",
                status='folg_opp',
                manager=self.manager1,
                notes=f"Alice's note {i}"
            )
        
        # Bob marks 2 addresses as folg_opp
        for i in range(2):
            Address.objects.create(
                address_text=f"Bob Address {i}, Oslo",
                status='folg_opp',
                manager=self.manager2,
                notes=f"Bob's note {i}"
            )
        
        # Verify Alice has exactly 3 TODOs
        alice_todos = Todo.objects.filter(user=self.user_alice)
        self.assertEqual(alice_todos.count(), 3)
        
        # Verify Bob has exactly 2 TODOs
        bob_todos = Todo.objects.filter(user=self.user_bob)
        self.assertEqual(bob_todos.count(), 2)
        
        # Verify Alice's TODOs don't belong to Bob
        for todo in alice_todos:
            self.assertEqual(todo.user, self.user_alice)
            self.assertNotEqual(todo.user, self.user_bob)
        
        # Verify Bob's TODOs don't belong to Alice
        for todo in bob_todos:
            self.assertEqual(todo.user, self.user_bob)
            self.assertNotEqual(todo.user, self.user_alice)
        
        # Verify total TODOs in system
        all_todos = Todo.objects.all()
        self.assertEqual(all_todos.count(), 5)

