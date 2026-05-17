"""
Tests for QC System History & Settings APIs (Phase 4).
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from users.models import Employee, Manager
from campaigns.models import Campaign
from qc_system.models import QCContact, QCHistory, QCSettings, ImportRecord

User = get_user_model()


def create_qc_employee(username, email, password='testpass123'):
    employee = Employee.objects.create(name=username, email=email)
    user = User.objects.create_user(username=username, email=email, password=password)
    user.employee = employee
    user.employee_type = 'qc_emp'
    user.save()
    return user


def create_qc_admin(username, email, password='testpass123'):
    manager = Manager.objects.create(name=username, email=email)
    user = User.objects.create_user(
        username=username, email=email, password=password,
        is_superuser=True, is_staff=True,
    )
    user.manager = manager
    user.admin_type = 'qc_admin'
    user.save()
    return user


def auth_client(user):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


# ──────────────────────────────────────────────
# History Tests
# ──────────────────────────────────────────────

class HistoryListTest(TestCase):
    """Test history list endpoint."""

    def setUp(self):
        self.emp1 = create_qc_employee('hist_emp1', 'he1@test.com')
        self.emp2 = create_qc_employee('hist_emp2', 'he2@test.com')
        self.admin = create_qc_admin('hist_admin', 'ha@test.com')

        self.contact = QCContact.objects.create(
            customer_name='History Customer',
            phone_number='+47 111 22 333',
            seller_name='SEL',
            assigned_to=self.emp1,
        )

        # emp1's history entries
        for i in range(3):
            QCHistory.objects.create(
                contact=self.contact,
                customer_name=f'Customer {i}',
                phone_number='+47 111 22 333',
                qc_result='Svarte',
                svarte_category='positiv',
                qc_agent_name='emp1',
                qc_agent=self.emp1,
                tid=f'10:{i:02d}',
            )

        # emp2's history entry
        QCHistory.objects.create(
            contact=self.contact,
            customer_name='Customer X',
            phone_number='+47 222 33 444',
            qc_result='Ikke svar',
            qc_agent_name='emp2',
            qc_agent=self.emp2,
            tid='11:00',
        )

    def test_employee_sees_own_history(self):
        client = auth_client(self.emp1)
        response = client.get(reverse('qc-history-list'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 3)

    def test_admin_sees_all_history(self):
        client = auth_client(self.admin)
        response = client.get(reverse('qc-history-list'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 4)

    def test_filter_by_qc_result(self):
        client = auth_client(self.admin)
        response = client.get(reverse('qc-history-list'), {'qc_result': 'Ikke svar'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 1)

    def test_filter_by_contact(self):
        client = auth_client(self.admin)
        response = client.get(reverse('qc-history-list'), {'contact': str(self.contact.id)})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 4)


class HistoryUpdateTest(TestCase):
    """Test history comment update."""

    def setUp(self):
        self.emp = create_qc_employee('hupdate', 'hup@test.com')
        self.client = auth_client(self.emp)
        self.contact = QCContact.objects.create(
            customer_name='Update Test',
            phone_number='+47 333 44 555',
            seller_name='S',
        )
        self.entry = QCHistory.objects.create(
            contact=self.contact,
            customer_name='Update Test',
            phone_number='+47 333 44 555',
            qc_result='Svarte',
            svarte_category='positiv',
            qc_agent_name='hupdate',
            qc_agent=self.emp,
            tid='12:00',
        )

    def test_update_comment(self):
        url = reverse('qc-history-detail', args=[self.entry.pk])
        response = self.client.patch(url, {'comment': 'Updated note'}, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['comment'], 'Updated note')

    def test_cannot_delete_history(self):
        url = reverse('qc-history-detail', args=[self.entry.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 405)

    def test_cannot_create_history_directly(self):
        response = self.client.post(reverse('qc-history-list'), {
            'customer_name': 'Fake',
            'phone_number': '123',
            'qc_result': 'Svarte',
        }, format='json')
        self.assertEqual(response.status_code, 405)


class HistoryExportTest(TestCase):
    """Test history CSV export."""

    def setUp(self):
        self.emp = create_qc_employee('export_emp', 'exp@test.com')
        self.client = auth_client(self.emp)
        self.contact = QCContact.objects.create(
            customer_name='Export Test',
            phone_number='+47 444 55 666',
            seller_name='S',
        )
        QCHistory.objects.create(
            contact=self.contact,
            customer_name='Export Test',
            phone_number='+47 444 55 666',
            qc_result='Svarte',
            svarte_category='positiv',
            si_opp='NEI',
            comment='Exported row',
            qc_agent_name='export_emp',
            qc_agent=self.emp,
            tid='14:30',
        )

    def test_export_csv(self):
        response = self.client.get(reverse('qc-history-export'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename=', response['Content-Disposition'])

        content = response.content.decode('utf-8')
        lines = content.strip().split('\n')
        self.assertEqual(len(lines), 2)  # header + 1 data row
        self.assertIn('Export Test', lines[1])
        self.assertIn('Svarte', lines[1])


# ──────────────────────────────────────────────
# Settings Tests
# ──────────────────────────────────────────────

class SettingsTest(TestCase):
    """Test settings retrieve and update."""

    def setUp(self):
        self.emp = create_qc_employee('settings_emp', 'set@test.com')
        self.client = auth_client(self.emp)
        manager = Manager.objects.create(name='Settings Manager', email='settings_mgr@test.com')
        self.campaign = Campaign.objects.create(
            name='Settings Campaign', description='settings', created_by=manager,
        )
        self.import_record = ImportRecord.objects.create(
            filename='settings.csv',
            campaign=self.campaign,
            list_name='Settings List',
            list_slug='settings-list',
            status='Fullfort',
            imported_by=self.emp,
        )

    def test_get_settings_auto_creates(self):
        """First GET should auto-create settings with defaults."""
        response = self.client.get(reverse('qc-settings-list'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['daily_goal'], 100)
        self.assertTrue(data['data']['auto_copy_phone'])
        self.assertEqual(data['data']['theme'], 'lys')
        self.assertIsNone(data['data']['selectedImportId'])
        self.assertIsNone(data['data']['selectedListName'])
        self.assertIsNone(data['data']['selectedListSlug'])

    def test_update_settings(self):
        # Ensure settings exist
        self.client.get(reverse('qc-settings-list'))

        # Update via POST
        response = self.client.post(reverse('qc-settings-list'), {
            'daily_goal': 150,
            'theme': 'mork',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['daily_goal'], 150)
        self.assertEqual(data['data']['theme'], 'mork')
        # auto_copy_phone should remain True (partial update)
        self.assertTrue(data['data']['auto_copy_phone'])

    def test_update_selected_import_via_camel_case_field(self):
        self.client.get(reverse('qc-settings-list'))
        response = self.client.post(reverse('qc-settings-list'), {
            'selectedImportId': str(self.import_record.id),
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['selectedImportId'], str(self.import_record.id))
        self.assertEqual(data['data']['selectedListName'], 'Settings List')
        self.assertEqual(data['data']['selectedListSlug'], 'settings-list')

    def test_update_selected_import_via_snake_case_field(self):
        self.client.get(reverse('qc-settings-list'))
        response = self.client.post(reverse('qc-settings-list'), {
            'selected_import_record': str(self.import_record.id),
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['selectedImportId'], str(self.import_record.id))

    def test_update_invalid_theme(self):
        self.client.get(reverse('qc-settings-list'))
        response = self.client.post(reverse('qc-settings-list'), {
            'theme': 'rainbow',
        }, format='json')
        self.assertEqual(response.status_code, 400)
