"""
Tests for QC System authentication (Phase 2).
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from users.models import Employee, Manager

User = get_user_model()


def create_qc_employee(username, email, password='testpass123'):
    """Create a QC employee user with Employee profile."""
    employee = Employee.objects.create(name=username, email=email)
    user = User.objects.create_user(username=username, email=email, password=password)
    user.employee = employee
    user.employee_type = 'qc_emp'
    user.save()
    return user


def create_qc_admin(username, email, password='testpass123'):
    """Create a QC admin user with Manager profile."""
    manager = Manager.objects.create(name=username, email=email)
    user = User.objects.create_user(
        username=username, email=email, password=password,
        is_superuser=True, is_staff=True,
    )
    user.manager = manager
    user.admin_type = 'qc_admin'
    user.save()
    return user


def create_maps_employee(username, email, password='testpass123'):
    """Create a Maps employee (non-QC)."""
    employee = Employee.objects.create(name=username, email=email)
    user = User.objects.create_user(username=username, email=email, password=password)
    user.employee = employee
    user.employee_type = 'maps_emp'
    user.save()
    return user


class QCLoginTest(TestCase):
    """Test QC login endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse('qc-login')
        self.qc_emp = create_qc_employee('qc_emp', 'qc@test.com')
        self.qc_admin = create_qc_admin('qc_admin', 'qcadmin@test.com')
        self.maps_emp = create_maps_employee('maps_emp', 'maps@test.com')

    def test_qc_employee_login_success(self):
        response = self.client.post(self.login_url, {
            'username': 'qc_emp', 'password': 'testpass123',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('access', data['data'])
        self.assertIn('refresh', data['data'])
        self.assertEqual(data['data']['agent']['userType'], 'qc_employee')

    def test_qc_admin_login_success(self):
        response = self.client.post(self.login_url, {
            'username': 'qc_admin', 'password': 'testpass123',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['agent']['userType'], 'qc_admin')

    def test_maps_employee_login_rejected(self):
        response = self.client.post(self.login_url, {
            'username': 'maps_emp', 'password': 'testpass123',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = response.json()
        self.assertFalse(data['success'])

    def test_invalid_credentials(self):
        response = self.client.post(self.login_url, {
            'username': 'qc_emp', 'password': 'wrongpassword',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_fields(self):
        response = self.client.post(self.login_url, {'username': 'qc_emp'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class QCLogoutTest(TestCase):
    """Test QC logout endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse('qc-login')
        self.logout_url = reverse('qc-logout')
        self.qc_emp = create_qc_employee('qc_emp2', 'qc2@test.com')

    def test_logout_success(self):
        # Login first
        login_resp = self.client.post(self.login_url, {
            'username': 'qc_emp2', 'password': 'testpass123',
        })
        tokens = login_resp.json()['data']
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        # Logout
        response = self.client.post(self.logout_url, {'refresh': tokens['refresh']})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()['success'])

    def test_logout_unauthenticated(self):
        response = self.client.post(self.logout_url, {'refresh': 'fake-token'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class QCMeTest(TestCase):
    """Test QC me endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.login_url = reverse('qc-login')
        self.me_url = reverse('qc-me')
        self.qc_emp = create_qc_employee('qc_emp3', 'qc3@test.com')
        self.maps_emp = create_maps_employee('maps_emp2', 'maps2@test.com')

    def _login(self, username, password='testpass123'):
        resp = self.client.post(self.login_url, {
            'username': username, 'password': password,
        })
        if resp.status_code == 200:
            token = resp.json()['data']['access']
            self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return resp

    def test_me_qc_employee(self):
        self._login('qc_emp3')
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['userType'], 'qc_employee')
        self.assertEqual(data['data']['email'], 'qc3@test.com')

    def test_me_unauthenticated(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_maps_employee_forbidden(self):
        """Maps employee gets authenticated but IsQCUser blocks them."""
        from rest_framework_simplejwt.tokens import RefreshToken
        token = str(RefreshToken.for_user(self.maps_emp).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
