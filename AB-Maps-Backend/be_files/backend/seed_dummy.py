"""
Seed dummy Norwegian test data for AB Maps local dev.
Run with:
    venv/bin/python manage.py shell < seed_dummy.py
"""
import random
import uuid
from datetime import timedelta
from django.contrib.gis.geos import Point, Polygon
from django.utils import timezone
from users.models import User, Manager, Employee
from campaigns.models import Campaign, CampaignArea, CampaignEmployee
from areas.models import Area, AreaEmployee
from addresses.models import Address
from dashboard.models import Activity, Sales
from todos.models import Todo

random.seed(42)
now = timezone.now()

# ── Find admin manager ────────────────────────────────────────────
admin_user = User.objects.filter(username='admin').first()
if not admin_user or not admin_user.manager:
    print("✗ Admin user/manager not found. Aborting.")
    raise SystemExit(1)
admin_manager = admin_user.manager
print(f"✓ Using admin manager: {admin_manager.name} ({admin_manager.id})")

# ── Campaign ──────────────────────────────────────────────────────
campaign, created = Campaign.objects.get_or_create(
    name="Norsk Folkehjelp",
    defaults={
        "description": "Innsamlingskampanje for Norsk Folkehjelp — Oslo Øst, vår 2026.",
        "created_by": admin_manager,
        "brand_color_hex": "#00A2C7",
    },
)
print(f"{'✓ created' if created else '↺ exists'} Campaign: {campaign.name}")

# ── Employees ─────────────────────────────────────────────────────
EMP_NAMES = [
    ("Dana", "Barzinje"),
    ("Lukas", "Blohne"),
    ("Jake", "Hamme"),
    ("Trond", "Ivar"),
    ("Ingrid", "Solberg"),
    ("Mathias", "Lien"),
    ("Sara", "Nordstrand"),
    ("Henrik", "Aas"),
    ("Emma", "Bakke"),
    ("Ola", "Nordmann"),
]

employees = []
for first, last in EMP_NAMES:
    username = f"{first.lower()}.{last.lower()}"
    email = f"{username}@ab-marketing.no"

    # Employee first (no FK to user required on its side)
    emp, _ = Employee.objects.get_or_create(
        email=email,
        defaults={
            "name": f"{first} {last}",
            "status": "active",
            "is_online": random.random() < 0.6,
        },
    )

    # Then user linked to employee, with a hashed password set in one go
    existing = User.objects.filter(username=username).first()
    if existing is None:
        user = User.objects.create_user(
            username=username,
            email=email,
            password="Demo2026!",
            first_name=first,
            last_name=last,
        )
        user.employee = emp
        user.employee_type = "maps_emp"
        user.save()
    employees.append(emp)
print(f"✓ {len(employees)} employees (login: <first>.<last> / Demo2026!)")

# ── Areas (realistic Oslo polygons, drawn as ~rectangles) ─────────
# (lon, lat) corners — Norway uses ~10–11°E / ~59–60°N
AREAS = [
    ("Sagene",         "#00A2C7", [(10.745, 59.940), (10.770, 59.940), (10.770, 59.952), (10.745, 59.952), (10.745, 59.940)]),
    ("Grünerløkka",    "#23AFD0", [(10.756, 59.920), (10.780, 59.920), (10.780, 59.935), (10.756, 59.935), (10.756, 59.920)]),
    ("Frogner",        "#4CCCE6", [(10.708, 59.917), (10.730, 59.917), (10.730, 59.930), (10.708, 59.930), (10.708, 59.917)]),
    ("Majorstuen",     "#2870B8", [(10.715, 59.928), (10.740, 59.928), (10.740, 59.940), (10.715, 59.940), (10.715, 59.928)]),
    ("Oslo sentrum",   "#12A594", [(10.738, 59.908), (10.762, 59.908), (10.762, 59.920), (10.738, 59.920), (10.738, 59.908)]),
    ("Gamle Oslo",     "#5FB8B0", [(10.762, 59.905), (10.790, 59.905), (10.790, 59.918), (10.762, 59.918), (10.762, 59.905)]),
]

areas = []
for name, color, ring in AREAS:
    poly = Polygon(ring, srid=4326)
    area, was_created = Area.objects.get_or_create(
        name=name,
        defaults={
            "polygon_geometry": poly,
            "color": color,
            "status": "active",
            "fylke": "Oslo",
            "house_count": random.randint(80, 420),
            "apartment_count": random.randint(140, 600),
            "created_by": admin_manager,
        },
    )
    if not was_created and area.polygon_geometry is None:
        area.polygon_geometry = poly
        area.color = color
        area.save()
    areas.append(area)
    # Link to campaign
    CampaignArea.objects.get_or_create(campaign=campaign, area=area)
    # Assign 2-4 random employees to each area (exactly one of employee/manager)
    for emp in random.sample(employees, random.randint(2, 4)):
        AreaEmployee.objects.get_or_create(area=area, employee=emp)
print(f"✓ {len(areas)} areas (linked to campaign + employees)")

# Link campaign to all employees
for emp in employees:
    CampaignEmployee.objects.get_or_create(campaign=campaign, employee=emp)

# ── Addresses scattered in each area ──────────────────────────────
STREETS = ["Gateveien", "Kirkegata", "Storgata", "Bygdøy allé", "Bogstadveien",
           "Markveien", "Thorvald Meyers gate", "Vogts gate", "Toftes gate", "Sannergata"]
STATUSES = ["ja", "ja", "ja", "nei", "nei", "ikke_hjemme", "folg_opp"]

addr_count = 0
for area in areas:
    bbox = area.polygon_geometry.extent  # (xmin, ymin, xmax, ymax)
    for _ in range(random.randint(12, 22)):
        lon = random.uniform(bbox[0], bbox[2])
        lat = random.uniform(bbox[1], bbox[3])
        street = random.choice(STREETS)
        num = random.randint(1, 89)
        Address.objects.create(
            address_text=f"{street} {num}, 0{random.randint(100, 990)} Oslo",
            status=random.choice(STATUSES),
            position=Point(lon, lat, srid=4326),
            campaign=campaign,
            recorded_at=now - timedelta(days=random.randint(0, 28), hours=random.randint(0, 23)),
        )
        addr_count += 1
print(f"✓ {addr_count} addresses")

# ── Sales records (last 30 days) ──────────────────────────────────
PRODUCTS = ["Fastgiver 200kr", "Fastgiver 100kr", "Engangsbidrag", "Faddergiver"]
sales_count = 0
for _ in range(60):
    emp = random.choice(employees)
    area = random.choice(areas)
    Sales.objects.create(
        employee=emp,
        manager=admin_manager,
        campaign=campaign,
        area=area,
        contact_name=f"{random.choice(EMP_NAMES)[0]} {random.choice(EMP_NAMES)[1]}",
        status="completed",
        outcome="success",
        value=random.choice([100, 150, 200, 250, 300, 500]),
        sale_date=now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23)),
    )
    sales_count += 1
print(f"✓ {sales_count} sales")

# ── Activity feed ────────────────────────────────────────────────
ACT_TYPES = ['address_contact', 'campaign_start', 'login', 'avtalegiro_contact', 'area_assignment']
for _ in range(80):
    emp = random.choice(employees)
    Activity.objects.create(
        employee=emp,
        manager=admin_manager,
        campaign=campaign,
        activity_type=random.choice(ACT_TYPES),
        description=f"{emp.name} aktivitet",
        created_at=now - timedelta(hours=random.randint(0, 96)),
    )
print(f"✓ activity log seeded")

# ── Todos ────────────────────────────────────────────────────────
TODO_TITLES = [
    "Følg opp Frogner-leads",
    "Forbered ukentlig rapport",
    "Tildel områder for neste uke",
    "Sjekk lås-status for Sagene",
    "Møte med teamleder",
    "Bekreft signatur på 3 salg",
    "Oppdater kampanjebeskrivelse",
    "Rydde i adresseregister",
]
for title in TODO_TITLES:
    is_done = random.random() < 0.3
    Todo.objects.get_or_create(
        title=title,
        user=admin_user,
        defaults={
            "description": f"{title} — automatisk generert testoppgave",
            "status": "completed" if is_done else random.choice(["pending", "in_progress"]),
            "priority": random.choice(["low", "medium", "high"]),
            "deadline": now + timedelta(days=random.randint(1, 14)),
            "completed_at": now if is_done else None,
        },
    )
print(f"✓ {len(TODO_TITLES)} todos")

print("\n✓ Seed complete. Log in with admin / AbMaps2026! and select campaign 'Norsk Folkehjelp'.")
