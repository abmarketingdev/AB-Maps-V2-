"""
Tests for QC System Phase 7 – URL Routing & Integration.

Verifies:
- Every QC endpoint is reachable.
- No URL conflicts with existing apps.
- Correct HTTP methods are allowed / rejected.
"""
from django.test import TestCase
from django.urls import reverse, resolve, NoReverseMatch
from rest_framework.test import APIClient
from rest_framework import status as http_status

from django.contrib.auth import get_user_model
from users.models import Employee, Manager
from campaigns.models import Campaign
from qc_system.models import QCContact, QCHistory, QCSettings, ImportRecord

User = get_user_model()


def create_qc_admin(username='qc_admin', email='qcadmin@test.com'):
    user = User.objects.create_superuser(username=username, email=email, password='pass')
    user.admin_type = 'qc_admin'
    user.save(update_fields=['admin_type'])
    return user


def create_qc_employee(username, email):
    employee = Employee.objects.create(name=username, email=email)
    user = User.objects.create_user(username=username, email=email, password='pass')
    user.employee = employee
    user.employee_type = 'qc_emp'
    user.save()
    return user


class URLResolutionTest(TestCase):
    """Verify all named QC URLs can be resolved."""

    def test_auth_urls(self):
        """Auth endpoints resolve correctly."""
        self.assertEqual(reverse('qc-login'), '/api/qc/auth/login')
        self.assertEqual(reverse('qc-logout'), '/api/qc/auth/logout')
        self.assertEqual(reverse('qc-me'), '/api/qc/auth/me')

    def test_contacts_urls(self):
        self.assertEqual(reverse('qc-contacts-list'), '/api/qc/contacts/')
        self.assertEqual(reverse('qc-contacts-get-next'), '/api/qc/contacts/get_next/')
        self.assertEqual(reverse('qc-contacts-bulk-transfer'), '/api/qc/contacts/bulk_transfer/')

    def test_agents_url(self):
        self.assertEqual(reverse('qc-agents-list'), '/api/qc/agents/')

    def test_history_urls(self):
        self.assertEqual(reverse('qc-history-list'), '/api/qc/history/')
        self.assertEqual(reverse('qc-history-export'), '/api/qc/history/export/')

    def test_settings_url(self):
        self.assertEqual(reverse('qc-settings-list'), '/api/qc/settings/')

    def test_dashboard_url(self):
        self.assertEqual(reverse('qc-dashboard-stats'), '/api/qc/dashboard/stats/')

    def test_imports_urls(self):
        self.assertEqual(reverse('qc-imports-list'), '/api/qc/imports/')
        self.assertEqual(reverse('qc-imports-upload'), '/api/qc/imports/upload/')
        self.assertEqual(reverse('qc-imports-preview'), '/api/qc/imports/preview/')

    def test_transfer_requests_urls(self):
        self.assertEqual(reverse('qc-transfer-requests-list'), '/api/qc/transfer-requests/')


class NoURLConflictTest(TestCase):
    """
    Ensure QC URLs don't conflict with existing app URLs.
    All QC endpoints live under /api/qc/ — verify no overlap with
    /api/auth/, /api/campaigns/, /api/users/, etc.
    """

    def test_existing_auth_urls_unaffected(self):
        """The AB Maps auth URLs still resolve independently."""
        from django.urls import reverse
        # These should resolve to the original custom_auth views, not QC
        try:
            login_url = reverse('login')
            self.assertNotIn('/qc/', login_url)
        except NoReverseMatch:
            pass  # OK if the project uses a different name

    def test_existing_campaign_urls_unaffected(self):
        try:
            url = reverse('campaign-list')
            self.assertTrue(url.startswith('/api/campaigns/'))
        except NoReverseMatch:
            pass

    def test_qc_prefix_isolation(self):
        """All QC named URLs produce paths starting with /api/qc/."""
        qc_names = [
            'qc-login', 'qc-logout', 'qc-me',
            'qc-contacts-list', 'qc-contacts-get-next', 'qc-contacts-bulk-transfer',
            'qc-agents-list',
            'qc-history-list', 'qc-history-export',
            'qc-settings-list',
            'qc-dashboard-stats',
            'qc-imports-list', 'qc-imports-upload', 'qc-imports-preview',
            'qc-transfer-requests-list',
        ]
        for name in qc_names:
            url = reverse(name)
            self.assertTrue(
                url.startswith('/api/qc/'),
                f"URL '{name}' resolved to '{url}' which is outside /api/qc/",
            )


class EndpointAccessTest(TestCase):
    """
    Smoke-test every QC endpoint for correct HTTP status.
    Ensures endpoints are reachable (not 404) and enforce auth (401/403).
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = create_qc_admin()
        self.emp = create_qc_employee('emp1', 'emp1@test.com')
        self.manager = Manager.objects.create(name='Mgr', email='mgr@t.com')
        self.campaign = Campaign.objects.create(
            name='C', description='', created_by=self.manager,
        )

    # ── Unauthenticated requests should be rejected ──

    def test_unauth_contacts(self):
        resp = self.client.get('/api/qc/contacts/')
        self.assertIn(resp.status_code, [401, 403])

    def test_unauth_agents(self):
        resp = self.client.get('/api/qc/agents/')
        self.assertIn(resp.status_code, [401, 403])

    def test_unauth_history(self):
        resp = self.client.get('/api/qc/history/')
        self.assertIn(resp.status_code, [401, 403])

    def test_unauth_settings(self):
        resp = self.client.get('/api/qc/settings/')
        self.assertIn(resp.status_code, [401, 403])

    def test_unauth_dashboard(self):
        resp = self.client.get('/api/qc/dashboard/stats/')
        self.assertIn(resp.status_code, [401, 403])

    def test_unauth_imports(self):
        resp = self.client.get('/api/qc/imports/')
        self.assertIn(resp.status_code, [401, 403])

    # ── Authenticated admin can reach every endpoint ──

    def test_admin_contacts(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/qc/contacts/')
        self.assertEqual(resp.status_code, 200)

    def test_admin_agents(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/qc/agents/')
        self.assertEqual(resp.status_code, 200)

    def test_admin_history(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/qc/history/')
        self.assertEqual(resp.status_code, 200)

    def test_admin_settings(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/qc/settings/')
        self.assertEqual(resp.status_code, 200)

    def test_admin_dashboard_stats(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/qc/dashboard/stats/')
        self.assertEqual(resp.status_code, 200)

    def test_admin_imports(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/qc/imports/')
        self.assertEqual(resp.status_code, 200)

    # ── QC employee import list access ──

    def test_employee_imports_allowed(self):
        self.client.force_authenticate(user=self.emp)
        resp = self.client.get('/api/qc/imports/')
        self.assertEqual(resp.status_code, 200)

    # ── Non-QC user gets 403 on QC endpoints ──

    def test_maps_employee_forbidden(self):
        maps_emp_obj = Employee.objects.create(name='maps_e', email='maps_e@t.com')
        maps_user = User.objects.create_user(
            username='maps_e', email='maps_e@t.com', password='pass',
        )
        maps_user.employee = maps_emp_obj
        maps_user.employee_type = 'maps_emp'
        maps_user.save()

        self.client.force_authenticate(user=maps_user)
        resp = self.client.get('/api/qc/contacts/')
        self.assertEqual(resp.status_code, 403)

    # ── Verify login endpoint works (POST only) ──

    def test_login_post(self):
        resp = self.client.post(
            '/api/qc/auth/login',
            {'username': self.emp.username, 'password': 'pass'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['success'])

    def test_login_get_not_allowed(self):
        resp = self.client.get('/api/qc/auth/login')
        self.assertEqual(resp.status_code, 405)

    # ── Method restrictions on contacts ──

    def test_contacts_delete_not_allowed(self):
        self.client.force_authenticate(user=self.admin)
        contact = QCContact.objects.create(
            customer_name='X', phone_number='1', seller_name='S',
            campaign=self.campaign, status='til_behandling',
        )
        resp = self.client.delete(f'/api/qc/contacts/{contact.id}/')
        self.assertEqual(resp.status_code, 405)

    def test_contacts_post_not_allowed(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post('/api/qc/contacts/', {}, format='json')
        self.assertEqual(resp.status_code, 405)
