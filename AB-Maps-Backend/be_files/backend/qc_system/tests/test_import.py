"""
Tests for QC System Phase 6 – Import Management.
"""
import csv
import io
import json
import uuid

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from qc_system.models import QCContact, ImportRecord, ContactAssignment
from campaigns.models import Campaign
from users.models import Manager, Employee

User = get_user_model()


def create_qc_admin(username='qc_admin', email='qcadmin@test.com', password='testpass123'):
    """Create a QC admin (superuser with admin_type='qc_admin')."""
    user = User.objects.create_superuser(
        username=username, email=email, password=password,
    )
    user.admin_type = 'qc_admin'
    user.save(update_fields=['admin_type'])
    return user


def create_qc_employee(username, email, password='testpass123'):
    """Create a QC employee user."""
    employee = Employee.objects.create(name=username, email=email)
    user = User.objects.create_user(
        username=username, email=email, password=password,
    )
    user.employee = employee
    user.employee_type = 'qc_emp'
    user.save()
    return user


def _make_csv_bytes(rows, fieldnames=None):
    """Build an in-memory CSV file from a list of dicts."""
    if not rows:
        return b''
    if fieldnames is None:
        fieldnames = list(rows[0].keys())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode('utf-8')


def _make_xlsx_bytes(rows, fieldnames=None):
    """Build an in-memory XLSX file from a list of dicts."""
    from openpyxl import Workbook

    if not rows:
        fieldnames = fieldnames or []
    elif fieldnames is None:
        fieldnames = list(rows[0].keys())

    wb = Workbook()
    ws = wb.active
    ws.append(fieldnames)  # header row
    for row in rows:
        ws.append([row.get(f, '') for f in fieldnames])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


class ImportUploadCSVTest(TestCase):
    """Tests for POST /api/qc/imports/upload/ with CSV files."""

    def setUp(self):
        self.client = APIClient()
        self.admin = create_qc_admin()
        self.client.force_authenticate(user=self.admin)

        self.manager = Manager.objects.create(name='Mgr', email='mgr@test.com')
        self.campaign = Campaign.objects.create(
            name='Test Campaign', description='', created_by=self.manager,
        )

    def _upload(self, file_bytes, filename='contacts.csv', extra=None):
        data = {
            'file': io.BytesIO(file_bytes),
            'campaignId': str(self.campaign.id),
            'listName': 'list_nf',
            'mappings': json.dumps({'name': 'Navn', 'phone': 'Telefon', 'seller': 'Selger'}),
            'agentIds': json.dumps([]),
        }
        if extra:
            data.update(extra)
        data['file'].name = filename
        return self.client.post('/api/qc/imports/upload/', data, format='multipart')

    def test_upload_csv_basic(self):
        rows = [
            {'Navn': 'Ola Nordmann', 'Telefon': '+47 900 00 001', 'Selger': 'ANDERS'},
            {'Navn': 'Kari Nordmann', 'Telefon': '+47 900 00 002', 'Selger': 'PER'},
        ]
        resp = self._upload(_make_csv_bytes(rows))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['data']['contactsCreated'], 2)
        self.assertEqual(QCContact.objects.count(), 2)

        # Import record created and completed
        self.assertEqual(ImportRecord.objects.count(), 1)
        rec = ImportRecord.objects.first()
        self.assertEqual(rec.status, 'Fullfort')
        self.assertEqual(rec.count, 2)
        self.assertEqual(rec.campaign, self.campaign)
        self.assertEqual(rec.list_name, 'list_nf')
        self.assertEqual(rec.list_slug, 'list-nf')
        self.assertEqual(QCContact.objects.exclude(import_record=rec).count(), 0)

    def test_upload_requires_list_name(self):
        rows = [{'Navn': 'No List', 'Telefon': '+47 900 00 003', 'Selger': 'PER'}]
        data = {
            'file': io.BytesIO(_make_csv_bytes(rows)),
            'campaignId': str(self.campaign.id),
            'mappings': json.dumps({'name': 'Navn', 'phone': 'Telefon', 'seller': 'Selger'}),
            'agentIds': json.dumps([]),
        }
        data['file'].name = 'contacts.csv'
        resp = self.client.post('/api/qc/imports/upload/', data, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('listName', str(resp.json()['error']))

    def test_upload_rejects_duplicate_list_name_same_campaign(self):
        rows = [{'Navn': 'One', 'Telefon': '+47 900 00 011', 'Selger': 'A'}]
        first = self._upload(_make_csv_bytes(rows), extra={'listName': 'List NF'})
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self._upload(_make_csv_bytes(rows), extra={'listName': 'list nf'})
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_csv_with_custom_mappings(self):
        rows = [
            {'Name': 'Test', 'Phone': '12345', 'Rep': 'SELGER1'},
        ]
        file_bytes = _make_csv_bytes(rows, fieldnames=['Name', 'Phone', 'Rep'])
        data = {
            'file': io.BytesIO(file_bytes),
            'campaignId': str(self.campaign.id),
            'listName': 'custom_list',
            'mappings': json.dumps({'name': 'Name', 'phone': 'Phone', 'seller': 'Rep'}),
            'agentIds': json.dumps([]),
        }
        data['file'].name = 'custom.csv'
        resp = self.client.post('/api/qc/imports/upload/', data, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        contact = QCContact.objects.first()
        self.assertEqual(contact.customer_name, 'Test')
        self.assertEqual(contact.phone_number, '12345')
        self.assertEqual(contact.seller_name, 'SELGER1')

    def test_upload_csv_with_agent_distribution(self):
        agent1 = create_qc_employee('agent1', 'a1@test.com')
        agent2 = create_qc_employee('agent2', 'a2@test.com')

        rows = [
            {'Navn': f'Person {i}', 'Telefon': f'+47 900 00 {i:03d}', 'Selger': 'S'}
            for i in range(6)
        ]
        data = {
            'file': io.BytesIO(_make_csv_bytes(rows)),
            'campaignId': str(self.campaign.id),
            'listName': 'distribution_batch',
            'mappings': json.dumps({'name': 'Navn', 'phone': 'Telefon', 'seller': 'Selger'}),
            'agentIds': json.dumps([str(agent1.id), str(agent2.id)]),
        }
        data['file'].name = 'contacts.csv'
        resp = self.client.post('/api/qc/imports/upload/', data, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        assigned = body['data']['agentsAssigned']
        self.assertEqual(assigned[str(agent1.id)], 3)
        self.assertEqual(assigned[str(agent2.id)], 3)

        # Verify DB
        self.assertEqual(QCContact.objects.filter(assigned_to=agent1).count(), 3)
        self.assertEqual(QCContact.objects.filter(assigned_to=agent2).count(), 3)

        # Verify ContactAssignment stats
        stats1 = ContactAssignment.objects.get(qc_employee=agent1)
        self.assertEqual(stats1.total_assigned, 3)
        self.assertEqual(stats1.active_assigned, 3)

    def test_upload_invalid_format(self):
        data = {
            'file': io.BytesIO(b'not a csv'),
            'campaignId': str(self.campaign.id),
            'listName': 'bad_format',
            'mappings': '{}',
            'agentIds': '[]',
        }
        data['file'].name = 'data.txt'
        resp = self.client.post('/api/qc/imports/upload/', data, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_nonexistent_campaign(self):
        rows = [{'Navn': 'X', 'Telefon': '1', 'Selger': 'Y'}]
        data = {
            'file': io.BytesIO(_make_csv_bytes(rows)),
            'campaignId': str(uuid.uuid4()),
            'listName': 'missing_campaign',
            'mappings': '{}',
            'agentIds': '[]',
        }
        data['file'].name = 'contacts.csv'
        resp = self.client.post('/api/qc/imports/upload/', data, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_upload_skips_empty_rows(self):
        rows = [
            {'Navn': '', 'Telefon': '', 'Selger': ''},
            {'Navn': 'Valid', 'Telefon': '123', 'Selger': 'S'},
        ]
        resp = self._upload(_make_csv_bytes(rows))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        body = resp.json()
        self.assertEqual(body['data']['contactsCreated'], 1)
        self.assertEqual(body['data']['totalErrors'], 1)

    def test_upload_requires_admin(self):
        """QC employees should NOT be able to upload."""
        emp = create_qc_employee('emp_noaccess', 'emp_noaccess@test.com')
        self.client.force_authenticate(user=emp)
        rows = [{'Navn': 'X', 'Telefon': '1', 'Selger': 'Y'}]
        resp = self._upload(_make_csv_bytes(rows))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class ImportUploadXLSXTest(TestCase):
    """Tests for POST /api/qc/imports/upload/ with XLSX files."""

    def setUp(self):
        self.client = APIClient()
        self.admin = create_qc_admin()
        self.client.force_authenticate(user=self.admin)

        self.manager = Manager.objects.create(name='Mgr', email='mgr@test.com')
        self.campaign = Campaign.objects.create(
            name='Campaign', description='', created_by=self.manager,
        )

    def test_upload_xlsx(self):
        rows = [
            {'Navn': 'Excel Person', 'Telefon': '+47 111 22 333', 'Selger': 'KNUT'},
        ]
        file_bytes = _make_xlsx_bytes(rows)
        data = {
            'file': io.BytesIO(file_bytes),
            'campaignId': str(self.campaign.id),
            'listName': 'xlsx_list',
            'mappings': json.dumps({'name': 'Navn', 'phone': 'Telefon', 'seller': 'Selger'}),
            'agentIds': json.dumps([]),
        }
        data['file'].name = 'contacts.xlsx'
        resp = self.client.post('/api/qc/imports/upload/', data, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(QCContact.objects.count(), 1)
        contact = QCContact.objects.first()
        self.assertEqual(contact.customer_name, 'Excel Person')


class ImportPreviewTest(TestCase):
    """Tests for POST /api/qc/imports/preview/."""

    def setUp(self):
        self.client = APIClient()
        self.admin = create_qc_admin()
        self.client.force_authenticate(user=self.admin)

    def test_preview_csv(self):
        rows = [
            {'Navn': 'A', 'Telefon': '1', 'Selger': 'S'},
            {'Navn': 'B', 'Telefon': '2', 'Selger': 'T'},
        ]
        data = {'file': io.BytesIO(_make_csv_bytes(rows))}
        data['file'].name = 'preview.csv'
        resp = self.client.post('/api/qc/imports/preview/', data, format='multipart')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['success'])
        self.assertIn('Navn', body['data']['columns'])
        self.assertEqual(body['data']['totalRows'], 2)

    def test_preview_xlsx(self):
        rows = [{'Col1': 'val1', 'Col2': 'val2'}]
        data = {'file': io.BytesIO(_make_xlsx_bytes(rows))}
        data['file'].name = 'preview.xlsx'
        resp = self.client.post('/api/qc/imports/preview/', data, format='multipart')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIn('Col1', body['data']['columns'])

    def test_preview_no_file(self):
        resp = self.client.post('/api/qc/imports/preview/', {}, format='multipart')
        self.assertEqual(resp.status_code, 400)

    def test_preview_bad_format(self):
        data = {'file': io.BytesIO(b'hello')}
        data['file'].name = 'bad.pdf'
        resp = self.client.post('/api/qc/imports/preview/', data, format='multipart')
        self.assertEqual(resp.status_code, 400)


class ImportHistoryTest(TestCase):
    """Tests for GET /api/qc/imports/ and GET /api/qc/imports/:id/."""

    def setUp(self):
        self.client = APIClient()
        self.admin = create_qc_admin()
        self.client.force_authenticate(user=self.admin)

        self.manager = Manager.objects.create(name='Mgr', email='mgr@test.com')
        self.campaign = Campaign.objects.create(
            name='Campaign', description='', created_by=self.manager,
        )

    def test_list_empty(self):
        resp = self.client.get('/api/qc/imports/')
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['count'], 0)

    def test_list_with_records(self):
        ImportRecord.objects.create(
            filename='file1.csv', campaign=self.campaign,
            count=10, status='Fullfort', imported_by=self.admin,
        )
        ImportRecord.objects.create(
            filename='file2.csv', campaign=self.campaign,
            count=5, status='Feilet', imported_by=self.admin,
        )
        resp = self.client.get('/api/qc/imports/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['count'], 2)

    def test_list_filter_by_status(self):
        ImportRecord.objects.create(
            filename='ok.csv', campaign=self.campaign,
            count=10, status='Fullfort', imported_by=self.admin,
        )
        ImportRecord.objects.create(
            filename='fail.csv', campaign=self.campaign,
            count=0, status='Feilet', imported_by=self.admin,
        )
        resp = self.client.get('/api/qc/imports/', {'status': 'Fullfort'})
        self.assertEqual(resp.json()['count'], 1)

    def test_retrieve_record(self):
        rec = ImportRecord.objects.create(
            filename='f.csv', campaign=self.campaign,
            count=3, status='Fullfort', imported_by=self.admin,
        )
        resp = self.client.get(f'/api/qc/imports/{rec.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['data']['filename'], 'f.csv')

    def test_retrieve_not_found(self):
        resp = self.client.get(f'/api/qc/imports/{uuid.uuid4()}/')
        self.assertEqual(resp.status_code, 404)

    def test_list_available_for_qc_employee(self):
        emp = create_qc_employee('emp_hist', 'emp_hist@test.com')
        self.client.force_authenticate(user=emp)
        resp = self.client.get('/api/qc/imports/')
        self.assertEqual(resp.status_code, 200)
