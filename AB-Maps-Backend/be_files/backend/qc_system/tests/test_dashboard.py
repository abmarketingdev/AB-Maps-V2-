"""
Tests for QC System Dashboard APIs (Phase 5).
Campaign-specific stats: QC admin gets campaign_stats + personal_stats; QC employee gets personal_stats only.
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from users.models import Employee, Manager
from campaigns.models import Campaign
from qc_system.models import QCContact, QCHistory, QCSettings

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


class DashboardStatsTest(TestCase):
    """Test campaign-specific dashboard stats endpoint."""

    def setUp(self):
        self.emp = create_qc_employee('dash_emp', 'dash@test.com')
        self.admin = create_qc_admin('dash_admin', 'dashadm@test.com')
        self.emp_client = auth_client(self.emp)
        self.admin_client = auth_client(self.admin)

        self.campaign = Campaign.objects.create(
            name='Dash Campaign',
            description='Test',
            created_by=self.admin.manager,
        )

        # Create contacts in various statuses (all in campaign, assigned to emp)
        statuses = [
            'til_behandling', 'til_behandling', 'til_behandling',
            'forste_oppring', 'forste_oppring',
            'andre_oppring',
            'positiv_tilbakemelding',
            'negativ_tilbakemelding',
        ]
        for i, st in enumerate(statuses):
            QCContact.objects.create(
                customer_name=f'Dash Customer {i}',
                phone_number=f'+47 000 00 {i:03d}',
                seller_name='S',
                assigned_to=self.emp,
                campaign=self.campaign,
                status=st,
            )

        # Create today's history entries
        contact = QCContact.objects.first()
        for qc_result in ['Svarte', 'Svarte', 'Ikke svar', 'Opptatt']:
            QCHistory.objects.create(
                contact=contact,
                customer_name='Dash Customer',
                phone_number='+47 000 00 000',
                qc_result=qc_result,
                svarte_category='positiv' if qc_result == 'Svarte' else None,
                qc_agent_name='dash_emp',
                qc_agent=self.emp,
                tid='10:00',
            )

        # Add one with si_opp = JA
        QCHistory.objects.create(
            contact=contact,
            customer_name='Si Opp Customer',
            phone_number='+47 000 00 999',
            qc_result='Svarte',
            svarte_category='negativ',
            si_opp='JA',
            qc_agent_name='dash_emp',
            qc_agent=self.emp,
            tid='11:00',
        )

    def _stats_url(self, campaign_id=None):
        url = reverse('qc-dashboard-stats')
        if campaign_id is not None:
            return f"{url}?campaign={campaign_id}"
        return url

    def test_missing_campaign_returns_400(self):
        response = self.emp_client.get(reverse('qc-dashboard-stats'))
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())
        self.assertIn('campaign', response.json()['error'].lower())

    def test_invalid_campaign_returns_404(self):
        response = self.emp_client.get(
            self._stats_url('00000000-0000-0000-0000-000000000000')
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn('error', response.json())

    def test_employee_stats(self):
        response = self.emp_client.get(self._stats_url(self.campaign.id))
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']

        self.assertEqual(data['campaign']['id'], str(self.campaign.id))
        self.assertEqual(data['campaign']['name'], self.campaign.name)

        # Employee gets only personal_stats
        self.assertNotIn('campaign_stats', data)
        ps = data['personal_stats']

        # Column counts
        self.assertEqual(ps['columns']['til_behandling'], 3)
        self.assertEqual(ps['columns']['forste_oppring'], 2)
        self.assertEqual(ps['columns']['andre_oppring'], 1)
        self.assertEqual(ps['columns']['positiv_tilbakemelding'], 1)
        self.assertEqual(ps['columns']['negativ_tilbakemelding'], 1)
        self.assertEqual(ps['columns']['tredje_oppring'], 0)

        self.assertEqual(ps['totalActive'], 6)

        self.assertEqual(ps['todayStats']['svarte'], 3)
        self.assertEqual(ps['todayStats']['ikkeSvar'], 1)
        self.assertEqual(ps['todayStats']['opptatt'], 1)
        self.assertEqual(ps['todayStats']['siOpp'], 1)

        self.assertEqual(ps['completedToday'], 5)
        self.assertEqual(ps['dailyGoal'], 100)
        self.assertEqual(ps['goalProgress'], 5.0)

    def test_custom_daily_goal(self):
        QCSettings.objects.create(user=self.emp, daily_goal=50)
        response = self.emp_client.get(self._stats_url(self.campaign.id))
        data = response.json()['data']['personal_stats']
        self.assertEqual(data['dailyGoal'], 50)
        self.assertEqual(data['goalProgress'], 10.0)  # 5/50 * 100

    def test_admin_sees_campaign_and_personal_stats(self):
        response = self.admin_client.get(self._stats_url(self.campaign.id))
        self.assertEqual(response.status_code, 200)
        data = response.json()['data']

        self.assertEqual(data['campaign']['id'], str(self.campaign.id))

        # Admin gets campaign_stats (all contacts in campaign)
        self.assertIn('campaign_stats', data)
        cs = data['campaign_stats']
        self.assertEqual(cs['columns']['til_behandling'], 3)
        self.assertEqual(cs['totalActive'], 6)
        self.assertEqual(cs['totalContacts'], 8)

        # Admin also gets personal_stats (own contacts in campaign; admin has none)
        self.assertIn('personal_stats', data)
        ps = data['personal_stats']
        self.assertEqual(ps['columns']['til_behandling'], 0)
        self.assertEqual(ps['totalActive'], 0)

    def test_unauthenticated_rejected(self):
        client = APIClient()
        response = client.get(self._stats_url(self.campaign.id))
        self.assertEqual(response.status_code, 401)
