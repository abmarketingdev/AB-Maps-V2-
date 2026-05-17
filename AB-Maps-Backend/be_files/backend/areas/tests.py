"""
Comprehensive tests for Area Manager Assignment functionality.
Tests Phase 4 requirements: backward compatibility, validation, and all API endpoints.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Area, AreaEmployee
from users.models import Manager, Employee

User = get_user_model()


class AreaManagerAssignmentModelTest(TestCase):
    """Test AreaEmployee model with both employees and managers."""
    
    def setUp(self):
        """Set up test data."""
        self.manager1 = Manager.objects.create(
            name="Test Manager 1",
            email="manager1@test.com"
        )
        self.manager2 = Manager.objects.create(
            name="Test Manager 2",
            email="manager2@test.com"
        )
        self.employee1 = Employee.objects.create(
            name="Test Employee 1",
            email="employee1@test.com"
        )
        self.employee2 = Employee.objects.create(
            name="Test Employee 2",
            email="employee2@test.com"
        )
        
        # Create area without created_by to avoid database schema issues
        self.area = Area.objects.create(name="Test Area")
    
    def test_add_employee_to_area(self):
        """Test adding an employee to an area."""
        assignment = AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        self.assertEqual(assignment.area, self.area)
        self.assertEqual(assignment.employee, self.employee1)
        self.assertIsNone(assignment.manager)
        self.assertEqual(assignment.person_type, 'employee')
        self.assertEqual(assignment.person, self.employee1)
    
    def test_add_manager_to_area(self):
        """Test adding a manager to an area."""
        assignment = AreaEmployee.objects.create(
            area=self.area,
            employee=None,
            manager=self.manager2
        )
        self.assertEqual(assignment.area, self.area)
        self.assertIsNone(assignment.employee)
        self.assertEqual(assignment.manager, self.manager2)
        self.assertEqual(assignment.person_type, 'manager')
        self.assertEqual(assignment.person, self.manager2)
    
    def test_cannot_add_both_employee_and_manager(self):
        """Test that validation prevents adding both employee and manager."""
        from django.core.exceptions import ValidationError
        
        assignment = AreaEmployee(
            area=self.area,
            employee=self.employee1,
            manager=self.manager2
        )
        with self.assertRaises(ValidationError):
            assignment.clean()
    
    def test_cannot_add_neither_employee_nor_manager(self):
        """Test that validation requires at least one person."""
        from django.core.exceptions import ValidationError
        
        assignment = AreaEmployee(
            area=self.area,
            employee=None,
            manager=None
        )
        with self.assertRaises(ValidationError):
            assignment.clean()
    
    def test_unique_constraint_employee(self):
        """Test that same employee cannot be added twice to same area."""
        AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        
        # Try to add same employee again
        with self.assertRaises(Exception):  # IntegrityError or ValidationError
            AreaEmployee.objects.create(
                area=self.area,
                employee=self.employee1,
                manager=None
            )
    
    def test_unique_constraint_manager(self):
        """Test that same manager cannot be added twice to same area."""
        AreaEmployee.objects.create(
            area=self.area,
            employee=None,
            manager=self.manager2
        )
        
        # Try to add same manager again
        with self.assertRaises(Exception):  # IntegrityError or ValidationError
            AreaEmployee.objects.create(
                area=self.area,
                employee=None,
                manager=self.manager2
            )
    
    def test_different_areas_same_person(self):
        """Test that same person can be assigned to different areas."""
        area2 = Area.objects.create(
            name="Test Area 2",
            created_by=self.manager1
        )
        
        # Add employee to both areas
        assignment1 = AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        assignment2 = AreaEmployee.objects.create(
            area=area2,
            employee=self.employee1,
            manager=None
        )
        
        self.assertNotEqual(assignment1.id, assignment2.id)
        self.assertEqual(assignment1.employee, assignment2.employee)


class AreaManagerAssignmentAPITest(APITestCase):
    """Test API endpoints for area manager assignment."""
    
    def setUp(self):
        """Set up test data."""
        # Create managers
        self.manager1 = Manager.objects.create(
            name="Test Manager 1",
            email="manager1@test.com"
        )
        self.manager2 = Manager.objects.create(
            name="Test Manager 2",
            email="manager2@test.com"
        )
        
        # Create employees
        self.employee1 = Employee.objects.create(
            name="Test Employee 1",
            email="employee1@test.com"
        )
        self.employee2 = Employee.objects.create(
            name="Test Employee 2",
            email="employee2@test.com"
        )
        
        # Create users
        self.user_manager1 = User.objects.create_user(
            username="manager1",
            email="manager1@test.com",
            password="testpass123"
        )
        self.user_manager1.manager = self.manager1
        self.user_manager1.save()
        
        # Create area
        # Create area without created_by to avoid database schema issues
        self.area = Area.objects.create(name="Test Area")
        
        # Setup authentication
        refresh = RefreshToken.for_user(self.user_manager1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    
    def test_add_employee_to_area(self):
        """Test adding employee via API."""
        url = f'/api/areas/areas/{self.area.id}/add_employee/'
        data = {'employee_id': str(self.employee1.id)}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('assigned', response.data['message'].lower())
        
        # Verify assignment was created
        assignment = AreaEmployee.objects.get(area=self.area, employee=self.employee1)
        self.assertIsNotNone(assignment)
        self.assertEqual(assignment.person_type, 'employee')
    
    def test_add_manager_to_area(self):
        """Test adding manager via API."""
        url = f'/api/areas/areas/{self.area.id}/add_employee/'
        data = {'manager_id': str(self.manager2.id)}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('assigned', response.data['message'].lower())
        self.assertIn('manager', response.data['message'].lower())
        
        # Verify assignment was created
        assignment = AreaEmployee.objects.get(area=self.area, manager=self.manager2)
        self.assertIsNotNone(assignment)
        self.assertEqual(assignment.person_type, 'manager')
    
    def test_add_employee_requires_either_id(self):
        """Test that add_employee requires either employee_id or manager_id."""
        url = f'/api/areas/areas/{self.area.id}/add_employee/'
        data = {}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('required', response.data['error'].lower())
    
    def test_add_employee_cannot_have_both_ids(self):
        """Test that add_employee cannot accept both employee_id and manager_id."""
        url = f'/api/areas/areas/{self.area.id}/add_employee/'
        data = {
            'employee_id': str(self.employee1.id),
            'manager_id': str(self.manager2.id)
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('both', response.data['error'].lower())
    
    def test_remove_employee_from_area(self):
        """Test removing employee via API."""
        # First add employee
        AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        
        url = f'/api/areas/areas/{self.area.id}/remove_employee/'
        data = {'employee_id': str(self.employee1.id)}
        
        response = self.client.delete(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('removed', response.data['message'].lower())
        
        # Verify assignment was deleted
        self.assertFalse(AreaEmployee.objects.filter(area=self.area, employee=self.employee1).exists())
    
    def test_remove_manager_from_area(self):
        """Test removing manager via API."""
        # First add manager
        AreaEmployee.objects.create(
            area=self.area,
            employee=None,
            manager=self.manager2
        )
        
        url = f'/api/areas/areas/{self.area.id}/remove_employee/'
        data = {'manager_id': str(self.manager2.id)}
        
        response = self.client.delete(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('removed', response.data['message'].lower())
        self.assertIn('manager', response.data['message'].lower())
        
        # Verify assignment was deleted
        self.assertFalse(AreaEmployee.objects.filter(area=self.area, manager=self.manager2).exists())
    
    def test_get_employees_endpoint_returns_both_types(self):
        """Test that employees endpoint returns both employees and managers."""
        # Add both employee and manager
        AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        AreaEmployee.objects.create(
            area=self.area,
            employee=None,
            manager=self.manager2
        )
        
        url = f'/api/areas/areas/{self.area.id}/employees/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        # Check that both types are present
        person_types = [item['person_type'] for item in response.data]
        self.assertIn('employee', person_types)
        self.assertIn('manager', person_types)
        
        # Verify structure
        for item in response.data:
            self.assertIn('id', item)
            self.assertIn('name', item)
            self.assertIn('person_type', item)
            self.assertIn('email', item)
    
    def test_unassigned_employees_returns_both_types(self):
        """Test that unassigned_employees endpoint returns both employees and managers."""
        # Add one employee to area
        AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        
        url = f'/api/areas/areas/{self.area.id}/unassigned_employees/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        
        # Should have employee2 and manager2 (not assigned)
        person_ids = [item['id'] for item in response.data]
        self.assertIn(str(self.employee2.id), person_ids)
        self.assertIn(str(self.manager2.id), person_ids)
        
        # Should NOT have employee1 (already assigned)
        self.assertNotIn(str(self.employee1.id), person_ids)
        
        # Check person types
        person_types = [item['person_type'] for item in response.data]
        self.assertIn('employee', person_types)
        self.assertIn('manager', person_types)
    
    def test_my_areas_includes_both_types(self):
        """Test that my_areas endpoint includes both employees and managers in area data."""
        # Add both employee and manager to area
        AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        AreaEmployee.objects.create(
            area=self.area,
            employee=None,
            manager=self.manager2
        )
        
        url = '/api/areas/areas/my_areas/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)
        
        # Find our area
        area_data = next((a for a in response.data if a['id'] == str(self.area.id)), None)
        self.assertIsNotNone(area_data)
        
        # Check employees field includes both types
        employees = area_data.get('employees', [])
        self.assertEqual(len(employees), 2)
        
        person_types = [emp['person_type'] for emp in employees]
        self.assertIn('employee', person_types)
        self.assertIn('manager', person_types)
        
        # Check employee_count
        self.assertEqual(area_data.get('employee_count'), 2)
    
    def test_set_employees_with_both_types(self):
        """Test set_employees endpoint with both employees and managers."""
        url = f'/api/areas/areas/{self.area.id}/set_employees/'
        
        # Test with employee_ids and manager_ids
        data = {
            'employee_ids': [str(self.employee1.id), str(self.employee2.id)],
            'manager_ids': [str(self.manager2.id)]
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        
        # Verify all assignments were created
        assignments = AreaEmployee.objects.filter(area=self.area)
        self.assertEqual(assignments.count(), 3)
        
        # Check types
        employee_count = assignments.filter(employee__isnull=False).count()
        manager_count = assignments.filter(manager__isnull=False).count()
        self.assertEqual(employee_count, 2)
        self.assertEqual(manager_count, 1)
    
    def test_set_employees_with_assignments_format(self):
        """Test set_employees endpoint with assignments format."""
        url = f'/api/areas/areas/{self.area.id}/set_employees/'
        
        # Test with assignments list
        data = {
            'assignments': [
                {'employee_id': str(self.employee1.id)},
                {'manager_id': str(self.manager2.id)},
                {'employee_id': str(self.employee2.id)}
            ]
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        
        # Verify all assignments were created
        assignments = AreaEmployee.objects.filter(area=self.area)
        self.assertEqual(assignments.count(), 3)
    
    def test_backward_compatibility_employee_ids(self):
        """Test backward compatibility with employee_ids only."""
        url = f'/api/areas/areas/{self.area.id}/set_employees/'
        
        # Test with only employee_ids (old format)
        data = {
            'employee_ids': [str(self.employee1.id), str(self.employee2.id)]
        }
        
        response = self.client.put(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        
        # Verify all are employees
        assignments = AreaEmployee.objects.filter(area=self.area)
        for assignment in assignments:
            self.assertIsNotNone(assignment.employee)
            self.assertIsNone(assignment.manager)
    
    def test_area_serializer_includes_both_types(self):
        """Test that AreaSerializer includes both employees and managers."""
        # Add both types
        AreaEmployee.objects.create(
            area=self.area,
            employee=self.employee1,
            manager=None
        )
        AreaEmployee.objects.create(
            area=self.area,
            employee=None,
            manager=self.manager2
        )
        
        from .serializers import AreaSerializer
        
        serializer = AreaSerializer(self.area)
        data = serializer.data
        
        # Check employees field
        employees = data.get('employees', [])
        self.assertEqual(len(employees), 2)
        
        # Check person types
        person_types = [emp['person_type'] for emp in employees]
        self.assertIn('employee', person_types)
        self.assertIn('manager', person_types)
        
        # Check employee_count
        self.assertEqual(data.get('employee_count'), 2)
    
    def test_cannot_add_same_person_twice(self):
        """Test that same person cannot be added twice."""
        # Add employee first time
        url = f'/api/areas/areas/{self.area.id}/add_employee/'
        data = {'employee_id': str(self.employee1.id)}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Try to add same employee again
        response = self.client.post(url, data, format='json')
        # Should return 200 OK with "already assigned" message
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('already', response.data['message'].lower())
        
        # Verify only one assignment exists
        count = AreaEmployee.objects.filter(area=self.area, employee=self.employee1).count()
        self.assertEqual(count, 1)
