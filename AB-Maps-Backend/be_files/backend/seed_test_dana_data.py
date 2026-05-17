"""
Seed dashboard data for test_dana so the employee dashboard + stats pages
render with non-zero numbers.

Run with:
    venv/bin/python manage.py shell < seed_test_dana_data.py

Idempotent — re-running just adds more activity / sales records dated in the
same window. If you want a clean re-seed, wipe test_dana's Activity / Sales
rows first via the admin or shell.

Targets the on-track / on-fire mood:
  - 70-100 doors per day for 10 days (~850 activities total)
  - Ja-rate ~4% (above the 3.0% threshold × 1.3 on-fire bump)
  - ~30 sales rows so SalesPageData has rich content
"""
import random
from datetime import timedelta
from django.utils import timezone

from users.models import User, Manager, Employee
from campaigns.models import Campaign, CampaignEmployee
from areas.models import Area
from dashboard.models import Activity, Sales

# ── Resolve test_dana ─────────────────────────────────────────────
user = User.objects.filter(username="test_dana").first()
if user is None:
    print("✗ test_dana not found. Run seed_test_users.py first.")
    raise SystemExit(1)
if not user.employee:
    print("✗ test_dana has no linked Employee record.")
    raise SystemExit(1)

emp = user.employee
print(f"✓ Found test_dana → Employee: {emp.name} ({emp.id})")

# ── Resolve manager + campaign + area ─────────────────────────────
admin_user = User.objects.filter(username="admin").first()
manager = admin_user.manager if admin_user else None
if manager is None:
    print("✗ admin manager not found. Run seed_dummy.py first.")
    raise SystemExit(1)

# Pick an existing active campaign (prefer the first one the admin created)
campaign = Campaign.objects.filter(created_by=manager).order_by("created_at").first()
if campaign is None:
    print("✗ No campaign found. Run seed_dummy.py first.")
    raise SystemExit(1)
print(f"✓ Target campaign: {campaign.name} ({campaign.id})")

area = Area.objects.first()  # any area is fine for the FK

# ── Assign test_dana to the campaign ──────────────────────────────
ce, created = CampaignEmployee.objects.get_or_create(
    campaign=campaign, employee=emp
)
print(f"{'✓ assigned' if created else '↺ already on'} {emp.name} → {campaign.name}")

# Assign to a couple more campaigns too so the selector has options
extra_campaigns = list(
    Campaign.objects.filter(created_by=manager).exclude(id=campaign.id)[:2]
)
for c in extra_campaigns:
    CampaignEmployee.objects.get_or_create(campaign=c, employee=emp)
    print(f"✓ also assigned to {c.name}")

# ── Wipe prior test_dana dashboard rows so re-runs aren't additive ─
prior_acts = Activity.objects.filter(employee=emp, activity_type="address_contact").count()
prior_sales = Sales.objects.filter(employee=emp).count()
if prior_acts or prior_sales:
    Activity.objects.filter(employee=emp, activity_type="address_contact").delete()
    Sales.objects.filter(employee=emp).delete()
    print(f"↺ cleared {prior_acts} prior activities + {prior_sales} prior sales")

# ── Seed Activity rows (the source of truth for stats endpoint) ───
now = timezone.now()

# 10 days back, 70-100 doors per day, status mix targeting ~4% ja rate
DAYS = 10
DOORS_PER_DAY_RANGE = (70, 100)
# Status mix (probability weights): ja=4%, nei=55%, ikke_hjemme=33%, folg_opp=8%
STATUS_CHOICES = ["ja"] * 4 + ["nei"] * 55 + ["ikke_hjemme"] * 33 + ["folg_opp"] * 8

act_count = 0
ja_count = 0
for day_offset in range(DAYS):
    day_doors = random.randint(*DOORS_PER_DAY_RANGE)
    base = now - timedelta(days=day_offset)
    for _ in range(day_doors):
        status_val = random.choice(STATUS_CHOICES)
        # Spread within work hours 09:00-19:00
        hour = random.randint(9, 19)
        minute = random.randint(0, 59)
        when = base.replace(hour=hour, minute=minute, second=random.randint(0, 59))
        a = Activity.objects.create(
            employee=emp,
            manager=manager,
            campaign=campaign,
            area=area,
            activity_type="address_contact",
            description=f"{emp.name} kontaktet adresse",
            metadata={
                "status": status_val,
                "campaign_id": str(campaign.id),
                "campaign_name": campaign.name,
                "user_name": emp.name,
                "recorded_at": when.isoformat(),
            },
        )
        # created_at is auto_now_add — override it directly via update()
        Activity.objects.filter(id=a.id).update(created_at=when)
        act_count += 1
        if status_val == "ja":
            ja_count += 1

print(f"✓ {act_count} Activity rows seeded ({ja_count} ja, {act_count - ja_count} other)")

# ── Seed Sales rows (the dashboard's SalesPageData feed) ──────────
PRODUCTS = ["Fastgiver 200kr", "Fastgiver 100kr", "Engangsbidrag", "Faddergiver"]
FIRST_NAMES = ["Kari", "Ola", "Maria", "Lars", "Emma", "Henrik", "Sofie", "Magnus", "Ingrid", "Erik"]
LAST_NAMES = ["Hansen", "Olsen", "Berg", "Larsen", "Eriksen", "Andersen", "Pedersen", "Nilsen"]

sales_count = 0
for _ in range(30):
    day_offset = random.randint(0, DAYS - 1)
    when = now - timedelta(days=day_offset, hours=random.randint(0, 8))
    Sales.objects.create(
        employee=emp,
        manager=manager,
        campaign=random.choice([campaign] + extra_campaigns),
        area=area,
        contact_name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
        contact_phone=f"4{random.randint(10000000, 99999999)}",
        status="completed",
        outcome="Ja",
        value=random.choice([100, 150, 200, 250, 300, 500]),
        sale_date=when.date(),
        notes=random.choice(PRODUCTS),
    )
    sales_count += 1

print(f"✓ {sales_count} Sales rows seeded")

# ── Summary ───────────────────────────────────────────────────────
hit_rate = (ja_count / act_count * 100) if act_count else 0.0
avg_per_day = act_count / DAYS
print("\n" + "=" * 60)
print(f"test_dana dashboard data ready")
print(f"  • {act_count} doors over {DAYS} days  ({avg_per_day:.1f}/day)")
print(f"  • {ja_count} ja  ({hit_rate:.1f}% hit-rate)")
print(f"  • {sales_count} sales rows")
print(f"  • assigned to {1 + len(extra_campaigns)} campaign(s)")
print("=" * 60)
print("\nLog out + back in as test_dana to see the populated dashboard.")
