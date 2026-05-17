# AB Person ID - Quick Code Reference

**Quick copy-paste reference for implementation**

---

## 1. Model Update

**File:** `backend/users/models.py`

```python
# Add after the id field (around line 70):

ab_person_id = models.CharField(
    max_length=4,
    unique=True,
    null=True,
    blank=True,
    help_text="4-digit unique person ID (manually set by admin)"
)
```

**That's it!** No auto-generation logic needed - admin manually sets this field.

---

## 2. Migration

**Command:**
```bash
python manage.py makemigrations users -n add_ab_person_id
```

**Migration will be auto-generated - NO manual edits needed:**

```python
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),  # Will auto-match your last migration
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='ab_person_id',
            field=models.CharField(
                blank=True,
                help_text='4-digit unique person ID (manually set by admin)',
                max_length=4,
                null=True,
                unique=True
            ),
        ),
    ]
```

**What happens:**
- All existing users will have `ab_person_id = NULL`
- Admin can manually assign IDs later

**Apply:**
```bash
python manage.py migrate
```

---

## 3. UserSerializer

**File:** `backend/users/serializers.py`

**Update class:**

```python
class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    ab_person_id = serializers.CharField(  # ✅ ADD
        required=False, 
        allow_null=True, 
        allow_blank=True
    )
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'ab_person_id',  # ✅ ADD
            'employee', 'manager', 'is_active'
        ]
        read_only_fields = ['id']  # ✅ ab_person_id is WRITABLE
    
    def validate_ab_person_id(self, value):  # ✅ ADD VALIDATION
        """Validate ab_person_id format and uniqueness."""
        if value is None or value == '':
            return None
        
        # Must be 4 digits
        if not value.isdigit() or len(value) != 4:
            raise serializers.ValidationError(
                "Person ID must be exactly 4 digits"
            )
        
        # Must be unique
        queryset = User.objects.filter(ab_person_id=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError(
                "This Person ID is already in use"
            )
        
        return value
```

---

## 4. ManagerSerializer

**File:** `backend/users/serializers.py`

```python
class ManagerSerializer(serializers.ModelSerializer):
    """Serializer for Manager model."""
    ab_person_id = serializers.SerializerMethodField()  # ✅ ADD
    
    class Meta:
        model = Manager
        fields = [
            'id', 'name', 'email', 'phone', 'status', 
            'ab_person_id',  # ✅ ADD (insert after 'status')
            'is_online', 'last_seen', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ab_person_id', 'created_at', 'updated_at']  # ✅ UPDATE
    
    def get_ab_person_id(self, obj):  # ✅ ADD THIS METHOD
        """Get ab_person_id from related User."""
        try:
            return obj.user.ab_person_id if hasattr(obj, 'user') and obj.user else None
        except:
            return None
```

---

## 5. EmployeeSerializer

**File:** `backend/users/serializers.py`

```python
class EmployeeSerializer(serializers.ModelSerializer):
    """Serializer for Employee model."""
    ab_person_id = serializers.SerializerMethodField()  # ✅ ADD
    
    class Meta:
        model = Employee
        fields = [
            'id', 'name', 'email', 'phone', 'status', 
            'ab_person_id',  # ✅ ADD (insert after 'status')
            'is_online', 'last_seen', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ab_person_id', 'created_at', 'updated_at']  # ✅ UPDATE
    
    def get_ab_person_id(self, obj):  # ✅ ADD THIS METHOD
        """Get ab_person_id from related User."""
        try:
            return obj.user.ab_person_id if hasattr(obj, 'user') and obj.user else None
        except:
            return None
```

---

## 6. ProfileSerializer

**File:** `backend/users/serializers.py`

```python
class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile updates."""
    employee = EmployeeSerializer(read_only=True)
    manager = ManagerSerializer(read_only=True)
    ab_person_id = serializers.CharField(read_only=True)  # ✅ ADD
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 
            'ab_person_id',  # ✅ ADD
            'employee', 'manager', 'is_active'
        ]
        read_only_fields = ['id', 'username', 'ab_person_id']  # ✅ UPDATE
```

---

## 7. UserInfoSerializer

**File:** `backend/users/serializers.py`

```python
class UserInfoSerializer(serializers.Serializer):
    """Serializer for user info in auth responses."""
    id = serializers.CharField(help_text="User ID")
    name = serializers.CharField(help_text="User's display name")
    email = serializers.CharField(help_text="User's email address")
    ab_person_id = serializers.CharField(help_text="4-digit person ID")  # ✅ ADD
```

---

## 8. Login API - users/views.py

**File:** `backend/users/views.py`

**Function:** `AuthViewSet.login()` (around line 368)

**Find all `user_info = {` constructions and add `ab_person_id`:**

```python
# Admin user_info (around line 392)
user_info = {
    'id': str(user.id),
    'name': user.username,
    'email': user.email,
    'ab_person_id': user.ab_person_id,  # ✅ ADD
}

# Superuser with manager (around line 400)
if user.is_superuser and hasattr(user, 'manager') and user.manager:
    user_type = 'superuser'
    user_info = {
        'id': str(user.manager.id),
        'name': user.manager.name,
        'email': user.manager.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }

# Employee (around line 407)
elif hasattr(user, 'employee') and user.employee:
    user_type = 'employee'
    user_info = {
        'id': str(user.employee.id),
        'name': user.employee.name,
        'email': user.employee.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }

# Manager (around line 416)
elif hasattr(user, 'manager') and user.manager:
    user_type = 'manager'
    user_info = {
        'id': str(user.manager.id),
        'name': user.manager.name,
        'email': user.manager.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }
```

---

## 9. Register API - users/views.py

**File:** `backend/users/views.py`

**Function:** `AuthViewSet.register()` (around line 568)

**Same changes - add `ab_person_id` to all `user_info` dicts:**

```python
# Around line 585
user_info = {
    'id': str(user.id),
    'name': user.username,
    'email': user.email,
    'ab_person_id': user.ab_person_id,  # ✅ ADD
}

# Around line 593
if user.is_superuser and hasattr(user, 'manager') and user.manager:
    user_type = 'superuser'
    user_info = {
        'id': str(user.manager.id),
        'name': user.manager.name,
        'email': user.manager.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }

# Around line 600
elif hasattr(user, 'manager') and user.manager:
    user_type = 'manager'
    user_info = {
        'id': str(user.manager.id),
        'name': user.manager.name,
        'email': user.manager.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }

# Around line 606
elif hasattr(user, 'employee') and user.employee:
    user_info = {
        'id': str(user.employee.id),
        'name': user.employee.name,
        'email': user.employee.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }
```

---

## 10. Verify Token API - users/views.py

**File:** `backend/users/views.py`

**Function:** `AuthViewSet.verify()` (around line 650)

```python
# Around line 660
if hasattr(user, 'employee') and user.employee:
    user_type = 'employee'
    user_info = {
        'id': str(user.employee.id),
        'name': user.employee.name,
        'email': user.employee.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }

# Around line 667
elif hasattr(user, 'manager') and user.manager:
    user_type = 'manager'
    user_info = {
        'id': str(user.manager.id),
        'name': user.manager.name,
        'email': user.manager.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }

# Around line 674
else:
    user_type = 'admin'
    user_info = {
        'id': str(user.id),
        'name': f"{user.first_name} {user.last_name}".strip() or user.username,
        'email': user.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }
```

---

## 11. Custom Auth - CustomTokenObtainPairSerializer

**File:** `backend/custom_auth/serializers.py`

**Function:** `CustomTokenObtainPairSerializer.validate()` (around line 13)

```python
# Around line 19
user_info = {
    'id': str(user.id),
    'name': user.username,
    'email': user.email,
    'ab_person_id': user.ab_person_id,  # ✅ ADD
    'is_superuser': user.is_superuser,
}

# Around line 28
if hasattr(user, 'employee') and user.employee:
    user_type = 'employee'
    user_info = {
        'id': str(user.employee.id),
        'name': user.employee.name,
        'email': user.employee.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }

# Around line 35
elif hasattr(user, 'manager') and user.manager:
    user_type = 'manager'
    user_info = {
        'id': str(user.manager.id),
        'name': user.manager.name,
        'email': user.manager.email,
        'ab_person_id': user.ab_person_id,  # ✅ ADD
    }
```

---

## 12. Custom Auth Views

**File:** `backend/custom_auth/views.py`

### **CustomTokenObtainPairView.post()** (around line 29)

```python
# Around line 48
return Response({
    'refresh': str(refresh),
    'access': str(refresh.access_token),
    'user_id': str(user.id),
    'username': user.username,
    'email': user.email,
    'user_type': serializer.validated_data.get('user_type'),
    'user_info': serializer.validated_data.get('user_info'),  # Already includes ab_person_id
    'expires_in': 3600,
})
```

### **LoginView.post()** (around line 88)

**Same pattern - add `ab_person_id` to all user_info dicts:**

```python
# Around line 102
user_info = {
    'id': str(user.id),
    'name': user.username,
    'email': user.email,
    'ab_person_id': user.ab_person_id,  # ✅ ADD
    'is_superuser': user.is_superuser,
}

# Similar for employee and manager sections...
```

---

## 13. Admin Panel (Optional)

**File:** `backend/users/admin.py`

```python
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'username', 'email', 'ab_person_id',  # ✅ ADD
        'first_name', 'last_name', 'is_staff'
    )
    
    search_fields = ('username', 'email', 'ab_person_id')  # ✅ ADD search
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('ab_person_id', 'employee', 'manager')  # ✅ ADD - Editable!
        }),
    )
```

**Note:** `ab_person_id` is **editable** in admin - not in readonly_fields!

---

## Testing Commands

### **1. Generate Migration**
```bash
cd backend
source be_env/bin/activate
python manage.py makemigrations users -n add_ab_person_id
```

### **2. Check Migration SQL**
```bash
python manage.py sqlmigrate users 000X  # Replace 000X with actual number
```

### **3. Apply Migration**
```bash
python manage.py migrate
```

### **4. Test in Shell**
```bash
python manage.py shell

from users.models import User

# Check all users have IDs
users = User.objects.all()
for user in users:
    print(f"{user.username}: {user.ab_person_id}")

# Check uniqueness
ids = list(User.objects.values_list('ab_person_id', flat=True))
print(f"Total: {len(ids)}, Unique: {len(set(ids))}")
assert len(ids) == len(set(ids)), "Duplicate IDs found!"

# Test new user creation
new_user = User.objects.create_user(
    username='testuser999',
    email='test999@example.com',
    password='testpass123'
)
print(f"New user ID: {new_user.ab_person_id}")
assert new_user.ab_person_id is not None
```

### **5. Test API**
```bash
# Login
curl -X POST http://localhost:8000/api/users/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}' \
  | jq '.user_info.ab_person_id'

# List users
curl -X GET http://localhost:8000/api/users/users/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  | jq '.results[].ab_person_id'
```

---

## Rollback (If Needed)

### **Rollback Migration**
```bash
# Find the migration number before add_ab_person_id
python manage.py showmigrations users

# Rollback to previous migration
python manage.py migrate users 0001  # Replace with actual previous migration
```

### **Delete Migration File**
```bash
rm backend/users/migrations/000X_add_ab_person_id.py
```

---

## Verification Checklist

```bash
# Run these commands to verify everything works:

# 1. Check model
python manage.py shell -c "from users.models import User; print(User._meta.get_field('ab_person_id'))"

# 2. Check all users have IDs
python manage.py shell -c "from users.models import User; print('Users without ID:', User.objects.filter(ab_person_id__isnull=True).count())"

# 3. Check uniqueness
python manage.py shell -c "from users.models import User; ids = list(User.objects.values_list('ab_person_id', flat=True)); print('Unique:', len(ids) == len(set(ids)))"

# 4. Test API
curl http://localhost:8000/api/users/auth/verify/ -H "Authorization: Bearer TOKEN" | jq '.user_info.ab_person_id'
```

---

## Summary of Changes

| File | Lines Changed | Complexity |
|------|---------------|------------|
| `users/models.py` | +25 | Medium |
| `users/serializers.py` | +15 | Low |
| `users/views.py` | +20 | Low |
| `users/admin.py` | +5 | Low |
| `custom_auth/serializers.py` | +6 | Low |
| `custom_auth/views.py` | +10 | Low |
| `users/migrations/000X_*.py` | +50 | Medium |

**Total:** ~131 lines of code  
**Time:** 3-4 hours

---

**Status:** ✅ Ready to implement  
**Difficulty:** Medium  
**Risk:** Low

