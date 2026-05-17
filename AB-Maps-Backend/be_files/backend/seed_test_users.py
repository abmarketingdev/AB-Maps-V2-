"""
Create a handful of clearly-named test users for QA login.

Run with:
    venv/bin/python manage.py shell < seed_test_users.py

All test accounts share password: Test2026!
Usernames are prefixed with `test_` so they're easy to spot/delete later.

Idempotent — safe to re-run; only creates what's missing.
"""
from users.models import User, Manager, Employee

ADMIN = User.objects.filter(username="admin").first()
if not ADMIN or not ADMIN.manager:
    print("✗ Admin user/manager not found. Run seed_dummy.py first.")
    raise SystemExit(1)

PASSWORD = "Test2026!"

# ── (username, first, last, kind) ─────────────────────────────────
# kind: 'employee' | 'manager'
TEST_USERS = [
    ("test_dana",      "Test",   "Dana",      "employee"),
    ("test_lukas",     "Test",   "Lukas",     "employee"),
    ("test_ingrid",    "Test",   "Ingrid",    "employee"),
    ("test_leder",     "Test",   "Leder",     "manager"),
]

created = []
existing = []

for username, first, last, kind in TEST_USERS:
    email = f"{username}@ab-marketing.no"

    if kind == "employee":
        emp, _ = Employee.objects.get_or_create(
            email=email,
            defaults={
                "name": f"{first} {last}",
                "status": "active",
                "is_online": True,
            },
        )
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=PASSWORD,
                first_name=first,
                last_name=last,
            )
            user.employee = emp
            user.employee_type = "maps_emp"
            user.save()
            created.append((username, "ansatt"))
        else:
            existing.append((username, "ansatt"))
    elif kind == "manager":
        mgr, _ = Manager.objects.get_or_create(
            email=email,
            defaults={
                "name": f"{first} {last}",
                "status": "active",
                "is_online": True,
            },
        )
        user = User.objects.filter(username=username).first()
        if user is None:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=PASSWORD,
                first_name=first,
                last_name=last,
            )
            user.manager = mgr
            user.save()
            created.append((username, "leder"))
        else:
            existing.append((username, "leder"))

print("\n" + "=" * 56)
print(f"✓ Test users seeded — password for ALL: {PASSWORD}")
print("=" * 56)
for u, kind in created:
    print(f"  ✓ created   {u:<14}  ({kind})")
for u, kind in existing:
    print(f"  ↺ exists    {u:<14}  ({kind})")
print("=" * 56)
print("\nLog in at /login with Kontotype matching the role.\n")
