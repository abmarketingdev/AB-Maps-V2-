"""
Tests for QC System models.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from qc_system.models import (
    QCContact, QCHistory, QCSettings, ImportRecord, ContactAssignment
)
from campaigns.models import Campaign
from users.models import Manager, Employee

User = get_user_model()


def create_qc_employee(username, email, password='testpass123'):
    """
    Helper to create a QC employee user with proper ordering:
    1. Create Employee profile
    2. Create User without employee_type
    3. Link Employee and set employee_type
    4. Save (passes clean() validation)
    """
    employee = Employee.objects.create(name=username, email=email)
    user = User.objects.create_user(
        username=username, email=email, password=password,
    )
    user.employee = employee
    user.employee_type = 'qc_emp'
    user.save()
    return user


class QCContactModelTest(TestCase):
    """Test QCContact model."""

    def setUp(self):
        self.qc_user = create_qc_employee('qc_employee1', 'qc1@test.com')

        manager = Manager.objects.create(name='Test Manager', email='mgr@test.com')
        self.campaign = Campaign.objects.create(
            name='Test Campaign', description='Test', created_by=manager,
        )

    def test_create_qc_contact(self):
        contact = QCContact.objects.create(
            customer_name='John Doe',
            phone_number='+47 123 45 678',
            seller_name='ANDERS',
            assigned_to=self.qc_user,
            campaign=self.campaign,
            status='til_behandling',
        )
        self.assertEqual(contact.customer_name, 'John Doe')
        self.assertEqual(contact.status, 'til_behandling')
        self.assertEqual(contact.attempt_count, 0)
        self.assertFalse(contact.urgent)
        self.assertIsNotNone(contact.id)

    def test_qc_contact_defaults(self):
        contact = QCContact.objects.create(
            customer_name='Jane Doe',
            phone_number='+47 987 65 432',
            seller_name='LINE',
        )
        self.assertEqual(contact.status, 'til_behandling')
        self.assertEqual(contact.attempt_count, 0)
        self.assertFalse(contact.urgent)
        self.assertIsNone(contact.assigned_to)
        self.assertIsNone(contact.campaign)

    def test_qc_contact_str(self):
        contact = QCContact.objects.create(
            customer_name='Test Customer',
            phone_number='+47 111 22 333',
            seller_name='SELLER',
        )
        self.assertIn('Test Customer', str(contact))
        self.assertIn('til_behandling', str(contact))


class QCHistoryModelTest(TestCase):
    """Test QCHistory model."""

    def setUp(self):
        self.qc_user = create_qc_employee('qc_agent1', 'agent1@test.com')
        self.contact = QCContact.objects.create(
            customer_name='Test Customer',
            phone_number='+47 123 45 678',
            seller_name='SELLER',
        )

    def test_create_qc_history(self):
        history = QCHistory.objects.create(
            contact=self.contact,
            customer_name='Test Customer',
            phone_number='123 45 678',
            qc_result='Svarte',
            svarte_category='positiv',
            si_opp='NEI',
            comment='Customer was satisfied',
            qc_agent_name='QC Agent 1',
            qc_agent=self.qc_user,
            tid='14:30',
        )
        self.assertEqual(history.qc_result, 'Svarte')
        self.assertEqual(history.svarte_category, 'positiv')
        self.assertEqual(history.tid, '14:30')
        self.assertIsNotNone(history.date)
        self.assertIsNotNone(history.created_at)


class QCSettingsModelTest(TestCase):
    """Test QCSettings model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', email='test@test.com', password='testpass123',
        )

    def test_create_qc_settings(self):
        settings = QCSettings.objects.create(
            user=self.user, daily_goal=120, auto_copy_phone=False, theme='mork',
        )
        self.assertEqual(settings.daily_goal, 120)
        self.assertFalse(settings.auto_copy_phone)
        self.assertEqual(settings.theme, 'mork')

    def test_qc_settings_defaults(self):
        settings = QCSettings.objects.create(user=self.user)
        self.assertEqual(settings.daily_goal, 100)
        self.assertTrue(settings.auto_copy_phone)
        self.assertEqual(settings.theme, 'lys')


class ImportRecordModelTest(TestCase):
    """Test ImportRecord model."""

    def setUp(self):
        manager = Manager.objects.create(name='Admin Manager', email='admin_mgr@test.com')
        self.user = User.objects.create_user(
            username='importer', email='importer@test.com', password='testpass123',
            is_superuser=True, is_staff=True,
        )
        self.user.manager = manager
        self.user.admin_type = 'qc_admin'
        self.user.save()

        self.campaign = Campaign.objects.create(
            name='Test Campaign', description='Test', created_by=manager,
        )

    def test_create_import_record(self):
        import_record = ImportRecord.objects.create(
            filename='test_contacts.csv',
            campaign=self.campaign,
            count=50,
            status='Fullfort',
            imported_by=self.user,
        )
        self.assertEqual(import_record.filename, 'test_contacts.csv')
        self.assertEqual(import_record.count, 50)
        self.assertEqual(import_record.status, 'Fullfort')
        self.assertIsNotNone(import_record.date)

    def test_import_record_defaults(self):
        import_record = ImportRecord.objects.create(filename='test.csv', count=10)
        self.assertEqual(import_record.status, 'Behandler')
        self.assertIsNotNone(import_record.date)


class ContactAssignmentModelTest(TestCase):
    """Test ContactAssignment model."""

    def setUp(self):
        self.qc_user = create_qc_employee('qc_worker', 'worker@test.com')

    def test_create_contact_assignment(self):
        assignment = ContactAssignment.objects.create(
            qc_employee=self.qc_user,
            total_assigned=100,
            active_assigned=25,
            completed_today=10,
        )
        self.assertEqual(assignment.total_assigned, 100)
        self.assertEqual(assignment.active_assigned, 25)
        self.assertEqual(assignment.completed_today, 10)

    def test_contact_assignment_defaults(self):
        assignment = ContactAssignment.objects.create(qc_employee=self.qc_user)
        self.assertEqual(assignment.total_assigned, 0)
        self.assertEqual(assignment.active_assigned, 0)
        self.assertEqual(assignment.completed_today, 0)
