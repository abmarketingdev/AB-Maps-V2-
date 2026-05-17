# AB Person ID - API Changes for Frontend

**Feature:** New 4-digit Person ID for all users  
**Date:** October 13, 2025  
**For:** Frontend Team

---

## 🎯 What's New?

Every user (Admin, Manager, Employee) now has a **4-digit unique ID** called `ab_person_id`.

### **Example:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john_doe",
  "email": "john@example.com",
  "ab_person_id": "1234"  // ✅ NEW FIELD
}
```

---

## 📡 API Response Changes

### **1. Login API**

**Endpoint:** `POST /api/users/auth/login/`

**Before:**
```json
{
  "access": "eyJ0eXAi...",
  "refresh": "eyJ0eXAi...",
  "user_id": "550e8400...",
  "username": "john_doe",
  "email": "john@example.com",
  "user_type": "employee",
  "user_info": {
    "id": "660e8400...",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**After:**
```json
{
  "access": "eyJ0eXAi...",
  "refresh": "eyJ0eXAi...",
  "user_id": "550e8400...",
  "username": "john_doe",
  "email": "john@example.com",
  "user_type": "employee",
  "user_info": {
    "id": "660e8400...",
    "name": "John Doe",
    "email": "john@example.com",
    "ab_person_id": "1234"  // ✅ NEW
  }
}
```

---

### **2. Registration API**

**Endpoint:** `POST /api/users/auth/register/`

**Same changes as login - `ab_person_id` added to `user_info`.**

---

### **3. Token Verify API**

**Endpoint:** `GET /api/users/auth/verify/`

**Response includes `ab_person_id` in `user_info`:**

```json
{
  "valid": true,
  "user_id": "550e8400...",
  "username": "john_doe",
  "user_type": "employee",
  "user_info": {
    "id": "660e8400...",
    "name": "John Doe",
    "email": "john@example.com",
    "ab_person_id": "1234"  // ✅ NEW
  }
}
```

---

### **4. User List API**

**Endpoint:** `GET /api/users/users/`

**Before:**
```json
{
  "count": 10,
  "results": [
    {
      "id": "550e8400...",
      "username": "john_doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "employee": { ... },
      "manager": null,
      "is_active": true
    }
  ]
}
```

**After:**
```json
{
  "count": 10,
  "results": [
    {
      "id": "550e8400...",
      "username": "john_doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "ab_person_id": "1234",  // ✅ NEW
      "employee": { ... },
      "manager": null,
      "is_active": true
    }
  ]
}
```

---

### **5. Manager List API**

**Endpoint:** `GET /api/users/managers/`

**Before:**
```json
{
  "count": 5,
  "results": [
    {
      "id": "770e8400...",
      "name": "Jane Manager",
      "email": "jane@example.com",
      "phone": "+47 123 45 678",
      "status": "online",
      "is_online": true
    }
  ]
}
```

**After:**
```json
{
  "count": 5,
  "results": [
    {
      "id": "770e8400...",
      "name": "Jane Manager",
      "email": "jane@example.com",
      "phone": "+47 123 45 678",
      "ab_person_id": "5678",  // ✅ NEW
      "status": "online",
      "is_online": true
    }
  ]
}
```

---

### **6. Employee List API**

**Endpoint:** `GET /api/users/employees/`

**Same changes as Manager List - `ab_person_id` added.**

---

### **7. Address APIs (Include User Data)**

**Endpoints:**
- `GET /api/addresses/addresses/`
- `GET /api/addresses/addresses/{id}/`

**Before:**
```json
{
  "id": "880e8400...",
  "address_text": "Testveien 123, Oslo",
  "employee": {
    "id": "660e8400...",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "manager": null
}
```

**After:**
```json
{
  "id": "880e8400...",
  "address_text": "Testveien 123, Oslo",
  "employee": {
    "id": "660e8400...",
    "name": "John Doe",
    "email": "john@example.com",
    "ab_person_id": "1234"  // ✅ NEW
  },
  "manager": null
}
```

---

### **8. Campaign APIs**

**Endpoints:**
- `GET /api/campaigns/campaigns/`
- `GET /api/campaigns/campaigns/{id}/`

**Same changes - `ab_person_id` included in manager/employee data.**

---

### **9. Area APIs**

**Endpoints:**
- `GET /api/areas/areas/`
- `GET /api/areas/areas/{id}/employees/`

**Same changes - `ab_person_id` included in manager/employee data.**

---

## 🎨 Frontend Integration Guide

### **1. TypeScript Interface Updates**

**Before:**
```typescript
interface UserInfo {
  id: string;
  name: string;
  email: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  employee?: Employee;
  manager?: Manager;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  is_online: boolean;
}

interface Manager {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  is_online: boolean;
}
```

**After:**
```typescript
interface UserInfo {
  id: string;
  name: string;
  email: string;
  ab_person_id: string;  // ✅ ADD THIS
}

interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  ab_person_id: string;  // ✅ ADD THIS
  is_active: boolean;
  employee?: Employee;
  manager?: Manager;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  ab_person_id: string;  // ✅ ADD THIS
  status: string;
  is_online: boolean;
}

interface Manager {
  id: string;
  name: string;
  email: string;
  phone: string;
  ab_person_id: string;  // ✅ ADD THIS
  status: string;
  is_online: boolean;
}
```

---

### **2. Display Person ID in UI**

**Example: User Profile Card**

```tsx
function UserProfileCard({ user }: { user: User }) {
  return (
    <div className="profile-card">
      <h3>{user.first_name} {user.last_name}</h3>
      <p>Email: {user.email}</p>
      <p>Person ID: {user.ab_person_id}</p>  {/* ✅ NEW */}
      <p>Username: {user.username}</p>
    </div>
  );
}
```

**Example: Employee List**

```tsx
function EmployeeList({ employees }: { employees: Employee[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Person ID</th>  {/* ✅ NEW */}
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {employees.map(emp => (
          <tr key={emp.id}>
            <td>{emp.name}</td>
            <td>{emp.email}</td>
            <td>{emp.ab_person_id}</td>  {/* ✅ NEW */}
            <td>{emp.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### **3. Search/Filter by Person ID**

```tsx
function UserSearch() {
  const [personId, setPersonId] = useState('');
  
  async function searchByPersonId() {
    const response = await fetch(
      `/api/users/users/?search=${personId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    const data = await response.json();
    // Display results...
  }
  
  return (
    <div>
      <input
        type="text"
        placeholder="Search by Person ID (e.g., 1234)"
        maxLength={4}
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
      />
      <button onClick={searchByPersonId}>Search</button>
    </div>
  );
}
```

---

### **4. Store Person ID in Auth Context**

```tsx
interface AuthContext {
  user: {
    id: string;
    username: string;
    email: string;
    ab_person_id: string;  // ✅ ADD THIS
    user_type: 'admin' | 'manager' | 'employee';
  };
  tokens: {
    access: string;
    refresh: string;
  };
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthContext | null>(null);
  
  async function login(username: string, password: string) {
    const response = await fetch('/api/users/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    setAuth({
      user: {
        id: data.user_id,
        username: data.username,
        email: data.email,
        ab_person_id: data.user_info.ab_person_id,  // ✅ NEW
        user_type: data.user_type
      },
      tokens: {
        access: data.access,
        refresh: data.refresh
      }
    });
  }
  
  return (
    <AuthContext.Provider value={{ auth, login }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 🔍 Testing Guide

### **Test 1: Login Flow**

```typescript
describe('Login with Person ID', () => {
  it('should return ab_person_id in user_info', async () => {
    const response = await fetch('/api/users/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'testpass123'
      })
    });
    
    const data = await response.json();
    
    expect(data.user_info).toHaveProperty('ab_person_id');
    expect(data.user_info.ab_person_id).toMatch(/^\d{4}$/);
  });
});
```

---

### **Test 2: User List**

```typescript
describe('User List with Person ID', () => {
  it('should include ab_person_id for all users', async () => {
    const response = await fetch('/api/users/users/', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    
    data.results.forEach((user: User) => {
      expect(user).toHaveProperty('ab_person_id');
      expect(user.ab_person_id).toMatch(/^\d{4}$/);
    });
  });
});
```

---

### **Test 3: Backward Compatibility**

```typescript
describe('Backward Compatibility', () => {
  it('should still work if ab_person_id is null', () => {
    const user: User = {
      id: '123',
      username: 'test',
      email: 'test@example.com',
      ab_person_id: null  // Should handle gracefully
    };
    
    // Your app should not crash
    render(<UserProfile user={user} />);
    
    // Display fallback or empty string
    expect(screen.queryByText('Person ID: N/A')).toBeInTheDocument();
  });
});
```

---

## ⚠️ Important Notes

### **1. Field is Always Present**

After the backend update, `ab_person_id` will **ALWAYS** be present in API responses. It will never be `null` or missing.

### **2. Format**

- **Length:** Always 4 digits
- **Type:** String (not number)
- **Example:** `"1234"`, `"5678"`, `"9999"`

### **3. Uniqueness**

Each user has a **unique** `ab_person_id`. No two users will have the same ID.

### **4. Read-Only**

The `ab_person_id` is **auto-generated** and **cannot be changed** by users. It's read-only.

### **5. Display Format**

**Recommended:** Display as-is without any formatting.

```tsx
// ✅ Good
<span>Person ID: {user.ab_person_id}</span>

// ❌ Don't add formatting
<span>Person ID: AB-{user.ab_person_id}</span>
```

---

## 📋 Frontend Checklist

- [ ] Update TypeScript interfaces
- [ ] Update auth context/store
- [ ] Add Person ID to user profile display
- [ ] Add Person ID to user lists (employees, managers)
- [ ] Add Person ID to admin panels
- [ ] Test login flow
- [ ] Test registration flow
- [ ] Test user list APIs
- [ ] Handle null/undefined gracefully (shouldn't happen, but good practice)
- [ ] Update Storybook components (if applicable)
- [ ] Update E2E tests

---

## 🎯 Priority Areas

### **High Priority:**
1. ✅ Auth flows (login, register) - Update `user_info` handling
2. ✅ User profile pages - Display `ab_person_id`
3. ✅ Admin panels - Show `ab_person_id` in user lists

### **Medium Priority:**
4. User search/filter features
5. Employee/Manager lists
6. Reports that include user data

### **Low Priority:**
7. Historical data displays
8. Export features
9. Analytics dashboards

---

## 🚀 Migration Timeline

### **Phase 1: Backend Deployment**
- Backend team deploys changes
- All APIs start returning `ab_person_id`

### **Phase 2: Frontend Update (Can be gradual)**
- Update TypeScript interfaces (1 hour)
- Update auth context (30 min)
- Update user displays (2 hours)
- Testing (1 hour)

**Total Frontend Time:** ~4-5 hours

### **Phase 3: Validation**
- Verify all displays show Person ID
- Check no crashes from new field
- Validate search/filter works

---

## ❓ FAQ

### **Q: What if the API returns null for ab_person_id?**
**A:** It won't. After migration, all users will have an ID. But handle it gracefully anyway:

```tsx
{user.ab_person_id || 'N/A'}
```

### **Q: Can users change their Person ID?**
**A:** No, it's auto-generated and read-only.

### **Q: What's the format of the ID?**
**A:** Always 4 digits as a string. Example: `"1234"`

### **Q: Will this break existing API calls?**
**A:** No! It's a non-breaking change. Old code will continue to work, it just won't display the new field.

### **Q: Do I need to update my API calls?**
**A:** No, just update your response handling to include the new field.

### **Q: Is this a breaking change?**
**A:** No, it's additive only. No fields were removed or changed.

---

## 📞 Support

**Questions?** Contact:
- Backend Team: For API-related questions
- Frontend Lead: For integration guidance

---

**Status:** ✅ **READY FOR FRONTEND INTEGRATION**  
**Breaking Changes:** None  
**Required Updates:** TypeScript interfaces + Display components  
**Estimated Time:** 4-5 hours

Good luck! 🚀

