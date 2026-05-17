"""
Tests for QC System contact APIs (Phase 3).
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from users.models import Employee, Manager
from campaigns.models import Campaign
from qc_system.models import (
    QCContact, QCHistory, ContactAssignment, QCTransferRequest, QCTransferRequestItem,
    ImportRecord, QCSettings,
)

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


class ContactListTest(TestCase):
    """Test contact list endpoint."""

    def setUp(self):
        self.emp1 = create_qc_employee('emp1', 'emp1@test.com')
        self.emp2 = create_qc_employee('emp2', 'emp2@test.com')
        self.admin = create_qc_admin('admin1', 'admin1@test.com')

        mgr = Manager.objects.create(name='Campaign Manager', email='cmgr@test.com')
        self.campaign = Campaign.objects.create(
            name='Camp 1', description='test', created_by=mgr,
        )

        # contacts for emp1
        for i in range(3):
            QCContact.objects.create(
                customer_name=f'Customer {i}',
                phone_number=f'+47 111 22 {i:03d}',
                seller_name='SEL',
                assigned_to=self.emp1,
                campaign=self.campaign,
            )
        # contact for emp2
        QCContact.objects.create(
            customer_name='Other Customer',
            phone_number='+47 222 33 444',
            seller_name='SEL',
            assigned_to=self.emp2,
            campaign=self.campaign,
        )

    def test_employee_sees_own_contacts(self):
        client = auth_client(self.emp1)
        response = client.get(reverse('qc-contacts-list'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 3)

    def test_admin_sees_all_contacts(self):
        client = auth_client(self.admin)
        response = client.get(reverse('qc-contacts-list'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 4)


class GetNextContactTest(TestCase):
    """Test get_next action."""

    def setUp(self):
        self.emp = create_qc_employee('nextemp', 'next@test.com')
        self.client = auth_client(self.emp)

        # Create contacts with different statuses
        self.c_urgent = QCContact.objects.create(
            customer_name='Urgent Guy', phone_number='+47 000 00 001',
            seller_name='S', assigned_to=self.emp, status='forste_oppring', urgent=True,
        )
        self.c_til = QCContact.objects.create(
            customer_name='Til Guy', phone_number='+47 000 00 002',
            seller_name='S', assigned_to=self.emp, status='til_behandling',
        )
        self.c_forste = QCContact.objects.create(
            customer_name='Forste Guy', phone_number='+47 000 00 003',
            seller_name='S', assigned_to=self.emp, status='forste_oppring',
        )

    def test_urgent_first(self):
        response = self.client.get(reverse('qc-contacts-get-next'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['customer_name'], 'Urgent Guy')

    def test_no_contacts_available(self):
        # Move all to completed
        QCContact.objects.filter(assigned_to=self.emp).update(status='positiv_tilbakemelding')
        response = self.client.get(reverse('qc-contacts-get-next'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data['data'])


class ImportScopedBoardTest(TestCase):
    """Test list-scoped contacts board and get_next behavior."""

    def setUp(self):
        self.emp = create_qc_employee('scope_emp', 'scope_emp@test.com')
        self.client = auth_client(self.emp)

        mgr = Manager.objects.create(name='Scope Manager', email='scope_mgr@test.com')
        self.campaign = Campaign.objects.create(
            name='Scope Campaign', description='scope', created_by=mgr,
        )
        self.import_a = ImportRecord.objects.create(
            filename='a.csv',
            list_name='List A',
            list_slug='list-a',
            campaign=self.campaign,
            status='Fullfort',
            imported_by=self.emp,
        )
        self.import_b = ImportRecord.objects.create(
            filename='b.csv',
            list_name='List B',
            list_slug='list-b',
            campaign=self.campaign,
            status='Fullfort',
            imported_by=self.emp,
        )

        self.contact_a = QCContact.objects.create(
            customer_name='Scope A',
            phone_number='+47 800 00 001',
            seller_name='S',
            assigned_to=self.emp,
            campaign=self.campaign,
            import_record=self.import_a,
            status='til_behandling',
        )
        self.contact_b = QCContact.objects.create(
            customer_name='Scope B',
            phone_number='+47 800 00 002',
            seller_name='S',
            assigned_to=self.emp,
            campaign=self.campaign,
            import_record=self.import_b,
            status='til_behandling',
        )

    def test_contacts_list_uses_selected_import_from_settings(self):
        QCSettings.objects.update_or_create(
            user=self.emp,
            defaults={'selected_import_record': self.import_a},
        )
        response = self.client.get(reverse('qc-contacts-list'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['data'][0]['customer_name'], 'Scope A')

    def test_contacts_list_query_param_overrides_settings(self):
        QCSettings.objects.update_or_create(
            user=self.emp,
            defaults={'selected_import_record': self.import_a},
        )
        response = self.client.get(reverse('qc-contacts-list'), {'list_slug': 'list-b'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['data'][0]['customer_name'], 'Scope B')

    def test_get_next_uses_selected_import_from_settings(self):
        QCSettings.objects.update_or_create(
            user=self.emp,
            defaults={'selected_import_record': self.import_b},
        )
        response = self.client.get(reverse('qc-contacts-get-next'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['customer_name'], 'Scope B')

    def test_get_next_query_param_overrides_settings(self):
        QCSettings.objects.update_or_create(
            user=self.emp,
            defaults={'selected_import_record': self.import_b},
        )
        response = self.client.get(reverse('qc-contacts-get-next'), {'import_id': str(self.import_a.id)})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['customer_name'], 'Scope A')


class ApproveContactTest(TestCase):
    """Test approve action (call result workflow)."""

    def setUp(self):
        self.emp = create_qc_employee('approver', 'approver@test.com')
        self.client = auth_client(self.emp)
        ContactAssignment.objects.create(
            qc_employee=self.emp, total_assigned=10, active_assigned=5,
        )
        self.contact = QCContact.objects.create(
            customer_name='Approve Test', phone_number='+47 111 11 111',
            seller_name='S', assigned_to=self.emp, status='til_behandling',
        )

    def test_approve_svarte_positiv(self):
        url = reverse('qc-contacts-approve', args=[self.contact.pk])
        response = self.client.patch(url, {
            'qcResult': 'Svarte', 'svarteCategory': 'positiv',
            'siOpp': 'NEI', 'comment': 'happy customer',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['contact']['status'], 'positiv_tilbakemelding')
        self.assertEqual(data['data']['historyEntry']['qc_result'], 'Svarte')

    def test_approve_svarte_requires_category(self):
        url = reverse('qc-contacts-approve', args=[self.contact.pk])
        response = self.client.patch(url, {
            'qcResult': 'Svarte',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_approve_ikke_svar_increments_attempt(self):
        url = reverse('qc-contacts-approve', args=[self.contact.pk])
        response = self.client.patch(url, {
            'qcResult': 'Ikke svar',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['contact']['status'], 'forste_oppring')
        self.assertEqual(data['data']['contact']['attempt_count'], 1)

    def test_approve_second_attempt(self):
        self.contact.attempt_count = 1
        self.contact.status = 'forste_oppring'
        self.contact.save()
        url = reverse('qc-contacts-approve', args=[self.contact.pk])
        response = self.client.patch(url, {
            'qcResult': 'Opptatt',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['contact']['status'], 'andre_oppring')
        self.assertEqual(data['data']['contact']['attempt_count'], 2)

    def test_cannot_approve_others_contact(self):
        """Other employee can't even see the contact (queryset filtered by assigned_to)."""
        other_emp = create_qc_employee('other', 'other@test.com')
        other_client = auth_client(other_emp)
        url = reverse('qc-contacts-approve', args=[self.contact.pk])
        response = other_client.patch(url, {
            'qcResult': 'Svarte', 'svarteCategory': 'positiv',
        }, format='json')
        # Returns 404 because the queryset is scoped — contact is invisible to this user
        self.assertEqual(response.status_code, 404)


class UrgentContactTest(TestCase):
    """Test urgent action."""

    def setUp(self):
        self.emp = create_qc_employee('urgentemp', 'urgent@test.com')
        self.client = auth_client(self.emp)
        self.contact = QCContact.objects.create(
            customer_name='Urgent Test', phone_number='+47 222 22 222',
            seller_name='S', assigned_to=self.emp, status='til_behandling',
        )

    def test_mark_urgent(self):
        url = reverse('qc-contacts-urgent', args=[self.contact.pk])
        response = self.client.patch(url, {
            'urgent': True, 'urgent_message': 'VIP customer!',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['data']['urgent'])
        self.assertEqual(data['data']['urgent_message'], 'VIP customer!')


class BulkTransferTest(TestCase):
    """Test bulk_transfer action."""

    def setUp(self):
        self.admin = create_qc_admin('transferadmin', 'ta@test.com')
        self.emp1 = create_qc_employee('t_emp1', 'te1@test.com')
        self.emp2 = create_qc_employee('t_emp2', 'te2@test.com')
        self.admin_client = auth_client(self.admin)
        self.emp_client = auth_client(self.emp1)

        self.contacts = []
        for i in range(3):
            c = QCContact.objects.create(
                customer_name=f'Transfer {i}', phone_number=f'+47 333 {i:02d} 000',
                seller_name='S', assigned_to=self.emp1, status='til_behandling',
            )
            self.contacts.append(c)
        ContactAssignment.objects.create(
            qc_employee=self.emp1, total_assigned=3, active_assigned=3,
        )

    def test_admin_bulk_transfer(self):
        url = reverse('qc-contacts-bulk-transfer')
        response = self.admin_client.patch(url, {
            'contactIds': [str(c.id) for c in self.contacts],
            'targetAgentId': str(self.emp2.id),
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['data']['transferred'], 3)

        # Verify reassignment
        for c in self.contacts:
            c.refresh_from_db()
            self.assertEqual(c.assigned_to, self.emp2)

    def test_employee_bulk_transfer_creates_pending_request(self):
        url = reverse('qc-contacts-bulk-transfer')
        response = self.emp_client.patch(url, {
            'contactIds': [str(c.id) for c in self.contacts],
            'targetAgentId': str(self.emp2.id),
        }, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['data']['status'], 'pending')
        self.assertEqual(data['data']['requestedCount'], 3)

        transfer_request = QCTransferRequest.objects.get(id=data['data']['requestId'])
        self.assertEqual(transfer_request.requested_by, self.emp1)
        self.assertEqual(transfer_request.target_agent, self.emp2)
        self.assertEqual(transfer_request.status, 'pending')
        self.assertEqual(transfer_request.requested_count, 3)
        self.assertEqual(
            QCTransferRequestItem.objects.filter(request=transfer_request).count(),
            3,
        )

        # Verify no immediate reassignment for employee-created request
        for c in self.contacts:
            c.refresh_from_db()
            self.assertEqual(c.assigned_to, self.emp1)

    def test_employee_cannot_bulk_transfer_others_contacts(self):
        """Contacts assigned to emp2; emp1 must not transfer them."""
        for c in self.contacts:
            c.assigned_to = self.emp2
            c.save()
        ContactAssignment.objects.filter(qc_employee=self.emp1).update(active_assigned=0)
        ContactAssignment.objects.get_or_create(
            qc_employee=self.emp2,
            defaults={'total_assigned': 3, 'active_assigned': 3},
        )
        url = reverse('qc-contacts-bulk-transfer')
        response = self.emp_client.patch(url, {
            'contactIds': [str(self.contacts[0].id)],
            'targetAgentId': str(self.emp2.id),
        }, format='json')
        self.assertEqual(response.status_code, 403)


class TransferRequestAdminFlowTest(TestCase):
    def setUp(self):
        self.admin = create_qc_admin('tr_admin', 'tr_admin@test.com')
        self.emp1 = create_qc_employee('tr_emp1', 'tr_emp1@test.com')
        self.emp2 = create_qc_employee('tr_emp2', 'tr_emp2@test.com')
        self.admin_client = auth_client(self.admin)
        self.emp_client = auth_client(self.emp1)

        self.contact1 = QCContact.objects.create(
            customer_name='TR 1', phone_number='+47 777 00 001',
            seller_name='S', assigned_to=self.emp1, status='til_behandling',
        )
        self.contact2 = QCContact.objects.create(
            customer_name='TR 2', phone_number='+47 777 00 002',
            seller_name='S', assigned_to=self.emp1, status='forste_oppring',
        )

    def _create_pending_request(self):
        resp = self.emp_client.patch(reverse('qc-contacts-bulk-transfer'), {
            'contactIds': [str(self.contact1.id), str(self.contact2.id)],
            'targetAgentId': str(self.emp2.id),
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        return resp.json()['data']['requestId']

    def test_admin_can_list_pending_requests(self):
        self._create_pending_request()
        resp = self.admin_client.get(reverse('qc-transfer-requests-list'))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['pendingCount'], 1)
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['data'][0]['status'], 'pending')

    def test_admin_can_accept_request_and_transfer_contacts(self):
        req_id = self._create_pending_request()
        resp = self.admin_client.post(
            reverse('qc-transfer-requests-accept', args=[req_id]),
            {},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.contact1.refresh_from_db()
        self.contact2.refresh_from_db()
        self.assertEqual(self.contact1.assigned_to, self.emp2)
        self.assertEqual(self.contact2.assigned_to, self.emp2)

    def test_admin_can_decline_request_without_transfer(self):
        req_id = self._create_pending_request()
        resp = self.admin_client.post(
            reverse('qc-transfer-requests-decline', args=[req_id]),
            {'declineReason': 'Wrong target'},
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.contact1.refresh_from_db()
        self.contact2.refresh_from_db()
        self.assertEqual(self.contact1.assigned_to, self.emp1)
        self.assertEqual(self.contact2.assigned_to, self.emp1)

    def test_accept_fails_if_contact_owner_changed_and_request_stays_pending(self):
        req_id = self._create_pending_request()
        self.contact1.assigned_to = self.admin
        self.contact1.save(update_fields=['assigned_to'])

        resp = self.admin_client.post(
            reverse('qc-transfer-requests-accept', args=[req_id]),
            {},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

        request_obj = QCTransferRequest.objects.get(id=req_id)
        self.assertEqual(request_obj.status, 'pending')
        self.assertIsNone(request_obj.reviewed_by)
        self.assertIsNone(request_obj.reviewed_at)


class AgentListTest(TestCase):
    """Test agents endpoint."""

    def setUp(self):
        self.emp1 = create_qc_employee('agnt1', 'a1@test.com')
        self.emp2 = create_qc_employee('agnt2', 'a2@test.com')
        self.admin = create_qc_admin('agntadmin', 'aa@test.com')

    def test_list_agents(self):
        client = auth_client(self.emp1)
        response = client.get(reverse('qc-agents-list'))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['count'], 2)  # 2 QC employees only
