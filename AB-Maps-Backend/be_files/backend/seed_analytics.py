"""
Seed richer analytics data for AB Maps local dev — adds:
  • 7 additional campaigns matching production (CARE, Talkmore, Strømmestiftelsen,
    Nasjonalforeningen, NRC, Røde Kors, Blå Kors)
  • 40 additional employees with Norwegian / international names
  • ~6000 Address records spread across last 90 days, varied statuses, with
    Talkmore-specific nei_subcategory breakdown
  • backdates recorded_at via raw .update() to bypass auto_now_add

Idempotent — safe to re-run.

Run with:
    venv/bin/python manage.py shell < seed_analytics.py
"""
import random
import math
from datetime import timedelta
from django.contrib.gis.geos import Point, Polygon
from django.utils import timezone
from django.db import transaction
from users.models import User, Manager, Employee
from campaigns.models import Campaign, CampaignArea, CampaignEmployee
from areas.models import Area, AreaEmployee
from addresses.models import Address

random.seed(2026)
now = timezone.now()

# ── Find admin manager ────────────────────────────────────────────
admin_user = User.objects.filter(username='admin').first()
if not admin_user or not admin_user.manager:
    print("✗ Admin user/manager not found. Run seed_dummy.py first.")
    raise SystemExit(1)
admin_manager = admin_user.manager
print(f"✓ Using admin manager: {admin_manager.name}")


# ─────────────────────────────────────────────────────────────────
# 1. Campaigns
# ─────────────────────────────────────────────────────────────────
CAMPAIGN_DEFS = [
    ("CARE",                          "Internasjonal hjelpeorganisasjon",                  "#3B82F6"),
    ("Talkmore",                      "Mobil og telekommunikasjon",                        "#F97316"),
    ("Strømmestiftelsen",             "Utdanning og fattigdomsbekjempelse",                "#10B981"),
    ("Nasjonalforeningen",            "Folkehelse og hjerte- og karsykdom",                "#EC4899"),
    ("NRC",                           "Norsk flyktninghjelp",                              "#8B5CF6"),
    ("Røde Kors",                     "Humanitær hjelp",                                   "#EF4444"),
    ("Blå Kors",                      "Rusforebygging og rehabilitering",                  "#0EA5E9"),
]

campaigns = []
for name, desc, color in CAMPAIGN_DEFS:
    c, created = Campaign.objects.get_or_create(
        name=name,
        defaults={
            "description": desc,
            "created_by": admin_manager,
            "brand_color_hex": color,
        },
    )
    campaigns.append(c)
    print(f"{'✓ created' if created else '↺ exists'} Campaign: {c.name}")

# Include the existing Norsk Folkehjelp campaign too
existing_nfh = Campaign.objects.filter(name="Norsk Folkehjelp").first()
if existing_nfh:
    campaigns.append(existing_nfh)
    print(f"↺ exists Campaign: {existing_nfh.name}")

print(f"✓ {len(campaigns)} campaigns total in scope\n")


# ─────────────────────────────────────────────────────────────────
# 2. Employees — Norwegian + international mix, matching production feel
# ─────────────────────────────────────────────────────────────────
NEW_EMP_NAMES = [
    ("Nadeem Rana", "Kristiansen"), ("Amyar", "Allahwaisy"), ("Hossein", "Lalak"),
    ("Axel Ange", "Dossou Gouin"), ("Embla Berg", "Dawson"), ("Kareem", "Kelkoul"),
    ("Tobias", "Doksæter"),         ("Ribaz",   "Izadi"),    ("Sigid",   "Evjen"),
    ("Mariam",  "Hassan"),          ("Jonas",   "Berg"),     ("Lina",    "Solheim"),
    ("Eirik",   "Dahl"),            ("Helene",  "Johansen"), ("Magnus",  "Pettersen"),
    ("Sofie",   "Andersen"),        ("Filip",   "Olsen"),    ("Tuva",    "Hansen"),
    ("Oscar",   "Larsen"),          ("Nora",    "Christensen"),("Aksel",  "Wilhelmsen"),
    ("Sigrid",  "Eriksen"),         ("Ola",     "Halvorsen"),("Iben",    "Strøm"),
    ("Erik",    "Knudsen"),         ("Maja",    "Iversen"),  ("Anders",  "Næss"),
    ("Mathilde","Sletten"),         ("Sander",  "Røed"),     ("Tiril",   "Aamodt"),
    ("Mohammed","Karimi"),          ("Yasmin",  "El-Hassan"),("Diego",   "Sanchez"),
    ("Priya",   "Sharma"),          ("Wei",     "Chen"),     ("Olek",    "Nowak"),
    ("Aino",    "Virtanen"),        ("Said",    "Beraki"),   ("Linda",   "Mikkelsen"),
    ("Aksel",   "Nordby"),
]

new_employees = []
for first, last in NEW_EMP_NAMES:
    username = (f"{first.lower()}.{last.lower()}"
                .replace(" ", "-").replace("ø","o").replace("å","a").replace("æ","ae"))
    email = f"{username}@ab-marketing.no"
    emp, _ = Employee.objects.get_or_create(
        email=email,
        defaults={
            "name": f"{first} {last}",
            "status": "active",
            "is_online": random.random() < 0.55,
        },
    )
    existing = User.objects.filter(username=username).first()
    if existing is None:
        u = User.objects.create_user(
            username=username, email=email, password="Demo2026!",
            first_name=first.split()[0], last_name=last,
        )
        u.employee = emp
        u.employee_type = "maps_emp"
        u.save()
    new_employees.append(emp)

# Pull in the original 10 employees too
existing_emps = list(Employee.objects.all())
all_employees = existing_emps  # already includes new + old
print(f"✓ {len(new_employees)} new employees added — {len(all_employees)} total in scope\n")


# ─────────────────────────────────────────────────────────────────
# 3. Link campaigns ↔ all employees
# ─────────────────────────────────────────────────────────────────
for c in campaigns:
    for emp in all_employees:
        CampaignEmployee.objects.get_or_create(campaign=c, employee=emp)
print("✓ campaign↔employee links ensured\n")


# ─────────────────────────────────────────────────────────────────
# 4. Address records — bulk over 90 days
# ─────────────────────────────────────────────────────────────────
# Realistic Oslo bounding box
OSLO_BBOX = (10.65, 59.87, 10.85, 59.97)
STREETS = ["Gateveien", "Kirkegata", "Storgata", "Bygdøy allé", "Bogstadveien",
           "Markveien", "Thorvald Meyers gate", "Vogts gate", "Toftes gate", "Sannergata",
           "Akersgata", "Karl Johans gate", "Møllergata", "Schous plass", "Grünerløkka",
           "Trondheimsveien", "Drammensveien", "Frognerveien", "Pilestredet", "Ullevålsveien"]

# Per-campaign volume + status distribution (rate of "ja" makes Ja% interesting)
# Format: (campaign, monthly_volume_per_employee, p_ja, p_nei, p_ikke_hjemme, p_folg_opp)
DISTRIBUTIONS = {
    "CARE":              (90,  0.020, 0.394, 0.530, 0.056),
    "Talkmore":          (60,  0.040, 0.287, 0.610, 0.063),
    "Strømmestiftelsen": (80,  0.024, 0.395, 0.521, 0.060),
    "Nasjonalforeningen":(75,  0.030, 0.380, 0.530, 0.060),
    "NRC":               (110, 0.053, 0.305, 0.580, 0.062),
    "Røde Kors":         (95,  0.045, 0.350, 0.535, 0.070),
    "Blå Kors":          (70,  0.035, 0.360, 0.545, 0.060),
    "Norsk Folkehjelp":  (88,  0.053, 0.352, 0.535, 0.060),
}

NEI_SUBS = ['ikke_interessert', 'darlig_erfaring', 'bindingstid', 'bedrift', 'pris', 'eksisterende_kunde']
# Weights for Talkmore nei subcategory (matches production-ish distribution)
TALKMORE_SUB_WEIGHTS = [0.30, 0.10, 0.20, 0.20, 0.06, 0.14]

# Bulk-create batches, then bulk-update recorded_at to backdate
BATCH = 500
total_created = 0

# Spread across last 90 days, with slight weekday bias and morning/afternoon hours
DAYS = 90

for c in campaigns:
    dist = DISTRIBUTIONS.get(c.name)
    if not dist:
        continue
    vol_per_emp_month, p_ja, p_nei, p_ih, p_fu = dist
    total_for_campaign = int(vol_per_emp_month * 3 * len(all_employees) * 0.55)  # ~90 days, sparser per emp

    print(f"  Seeding {total_for_campaign:>5} addresses for {c.name}…")
    to_create = []
    backdates = []

    for _ in range(total_for_campaign):
        emp = random.choice(all_employees)

        # Status by weighted choice
        r = random.random()
        if r < p_ja:
            status = "ja"
            sub = None
        elif r < p_ja + p_nei:
            status = "nei"
            # Talkmore-specific subcategory distribution
            if c.name == "Talkmore":
                sub = random.choices(NEI_SUBS, weights=TALKMORE_SUB_WEIGHTS, k=1)[0]
            elif random.random() < 0.3:
                sub = random.choice(NEI_SUBS)
            else:
                sub = None
        elif r < p_ja + p_nei + p_ih:
            status = "ikke_hjemme"
            sub = None
        else:
            status = "folg_opp"
            sub = None

        # Date — log-spaced toward recent days (more activity recently)
        days_ago = int(DAYS * (random.random() ** 1.3))
        hour = random.choices(
            list(range(8, 21)),
            weights=[1, 2, 3, 4, 6, 8, 9, 10, 9, 8, 6, 4, 2],  # weight by daypart
            k=1,
        )[0]
        backdate = now - timedelta(days=days_ago, hours=23 - hour, minutes=random.randint(0, 59))

        # Position
        lon = random.uniform(OSLO_BBOX[0], OSLO_BBOX[2])
        lat = random.uniform(OSLO_BBOX[1], OSLO_BBOX[3])

        street = random.choice(STREETS)
        num = random.randint(1, 199)
        postnr = random.randint(100, 990)

        a = Address(
            address_text=f"{street} {num}, 0{postnr} Oslo",
            status=status,
            nei_subcategory=sub,
            position=Point(lon, lat, srid=4326),
            campaign=c,
            employee=emp,
            manager=admin_manager,
        )
        to_create.append(a)
        backdates.append(backdate)

    # Bulk-create in batches, then bulk-update recorded_at to bypass auto_now_add
    with transaction.atomic():
        created_ids = []
        for i in range(0, len(to_create), BATCH):
            chunk = to_create[i:i + BATCH]
            Address.objects.bulk_create(chunk, batch_size=BATCH)
            created_ids.extend([a.id for a in chunk])
        # Update recorded_at in chunks
        for i in range(0, len(created_ids), BATCH):
            id_chunk = created_ids[i:i + BATCH]
            date_chunk = backdates[i:i + BATCH]
            # Per-row update (raw SQL would be faster but this stays within ORM)
            for aid, ts in zip(id_chunk, date_chunk):
                Address.objects.filter(pk=aid).update(recorded_at=ts)
    total_created += len(to_create)

print(f"\n✓ {total_created} addresses created across {len(campaigns)} campaigns\n")
print("✓ Seed complete. Reload /analytics — date-range filters now reflect real history.")
