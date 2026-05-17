# AB Person ID - Frontend API Cheatsheet

**Quick reference for integrating AB Person ID in frontend**

---

## 📋 Quick Summary

**New Field:** `ab_person_id`
- **Type:** String (4 digits) or `null`
- **Format:** `"1234"` (4 digits only)
- **Optional:** Can be `null`
- **Editable:** Yes (admin only via PATCH)

---

## 🔑 Key Points

✅ **Optional Field** - Can be `null` or a 4-digit string  
✅ **Admin Controlled** - Only admins can set/update  
✅ **Unique** - No two users can have the same ID  
✅ **Format:** Exactly 4 digits (`"1000"` to `"9999"`)

---

## 📡 API Endpoints

### **1. Create User WITH Person ID**

**Endpoint:** `POST /api/users/auth/register/`

**Request:**
```json
{
  "username": "newuser123",
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!",
  "first_name": "New",
  "last_name": "User",
  "user_type": "employee",
  "ab_person_id": "1234"  // ✅ OPTIONAL - Admin can provide
}
```

**Response:**
```json
{
  "refresh": "eyJ0eXAi...",
  "access": "eyJ0eXAi...",
  "user_id": "550e8400-...",
  "username": "newuser123",
  "email": "newuser@example.com",
  "user_type": "employee",
  "user_info": {
    "id": "660e8400-...",
    "name": "New User",
    "email": "newuser@example.com",
    "ab_person_id": "1234"  // ✅ PRESENT
  },
  "expires_in": 3600,
  "message": "User registered successfully"
}
```

---

### **2. Create User WITHOUT Person ID**

**Endpoint:** `POST /api/users/auth/register/`

**Request:**
```json
{
  "username": "newuser456",
  "email": "newuser456@example.com",
  "password": "SecurePass123!",
  "password_confirm": "SecurePass123!",
  "first_name": "Another",
  "last_name": "User",
  "user_type": "manager"
  // No ab_person_id provided
}
```

**Response:**
```json
{
  "refresh": "eyJ0eXAi...",
  "access": "eyJ0eXAi...",
  "user_id": "770e8400-...",
  "username": "newuser456",
  "email": "newuser456@example.com",
  "user_type": "manager",
  "user_info": {
    "id": "880e8400-...",
    "name": "Another User",
    "email": "newuser456@example.com",
    "ab_person_id": null  // ✅ NULL (not provided)
  },
  "expires_in": 3600,
  "message": "User registered successfully"
}
```

---

### **3. Update Existing User (Add Person ID)**

**Endpoint:** `PATCH /api/users/users/{user_id}/`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json
```

**Request:**
```json
{
  "ab_person_id": "5678"
}
```

**Response:**
```json
{
  "id": "user-uuid",
  "username": "existinguser",
  "email": "existing@example.com",
  "first_name": "Existing",
  "last_name": "User",
  "ab_person_id": "5678",  // ✅ UPDATED
  "employee": { ... },
  "manager": null,
  "is_active": true
}
```

---

### **4. Update Existing User (Change Person ID)**

**Endpoint:** `PATCH /api/users/users/{user_id}/`

**Request:**
```json
{
  "ab_person_id": "9999"  // Change from old ID to new ID
}
```

**Response:**
```json
{
  "id": "user-uuid",
  "username": "existinguser",
  "email": "existing@example.com",
  "ab_person_id": "9999",  // ✅ CHANGED
  // ... rest of user data
}
```

---

### **5. Update Existing User (Remove Person ID)**

**Endpoint:** `PATCH /api/users/users/{user_id}/`

**Request:**
```json
{
  "ab_person_id": null  // Set to null to remove
}
```

**Response:**
```json
{
  "id": "user-uuid",
  "username": "existinguser",
  "email": "existing@example.com",
  "ab_person_id": null,  // ✅ REMOVED
  // ... rest of user data
}
```

---

### **6. Login (Returns Person ID)**

**Endpoint:** `POST /api/users/auth/login/`

**Request:**
```json
{
  "username": "manager1",
  "password": "password123"
}
```

**Response:**
```json
{
  "refresh": "eyJ0eXAi...",
  "access": "eyJ0eXAi...",
  "user_id": "550e8400-...",
  "username": "manager1",
  "email": "manager1@example.com",
  "user_type": "manager",
  "user_info": {
    "id": "660e8400-...",
    "name": "Manager Name",
    "email": "manager1@example.com",
    "ab_person_id": "1234"  // ✅ PRESENT (or null if not assigned)
  },
  "expires_in": 3600
}
```

---

### **7. List Users (Includes Person ID)**

**Endpoint:** `GET /api/users/users/`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response:**
```json
{
  "count": 10,
  "results": [
    {
      "id": "550e8400-...",
      "username": "user1",
      "email": "user1@example.com",
      "first_name": "User",
      "last_name": "One",
      "ab_person_id": "1234",  // ✅ Has ID
      "employee": { ... },
      "manager": null,
      "is_active": true
    },
    {
      "id": "660e8400-...",
      "username": "user2",
      "email": "user2@example.com",
      "first_name": "User",
      "last_name": "Two",
      "ab_person_id": null,  // ✅ No ID yet
      "employee": { ... },
      "manager": null,
      "is_active": true
    }
  ]
}
```

---

### **8. List Managers (Includes Person ID)**

**Endpoint:** `GET /api/users/managers/`

**Response:**
```json
{
  "count": 5,
  "results": [
    {
      "id": "770e8400-...",
      "name": "Manager Name",
      "email": "manager@example.com",
      "phone": "+47 123 45 678",
      "status": "online",
      "ab_person_id": "5678",  // ✅ PRESENT
      "is_online": true,
      "last_seen": "2025-10-13T10:00:00Z"
    }
  ]
}
```

---

### **9. List Employees (Includes Person ID)**

**Endpoint:** `GET /api/users/employees/`

**Response:**
```json
{
  "count": 20,
  "results": [
    {
      "id": "880e8400-...",
      "name": "Employee Name",
      "email": "employee@example.com",
      "phone": "+47 987 65 432",
      "status": "working",
      "ab_person_id": "9876",  // ✅ PRESENT (or null)
      "is_online": true,
      "last_seen": "2025-10-13T11:00:00Z"
    }
  ]
}
```

---

## 🎨 Frontend Implementation

### **1. TypeScript Interface**

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  ab_person_id: string | null;  // ✅ CAN BE NULL
  employee?: Employee;
  manager?: Manager;
  is_active: boolean;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  ab_person_id: string | null;  // ✅ CAN BE NULL
  is_online: boolean;
}

interface Manager {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  ab_person_id: string | null;  // ✅ CAN BE NULL
  is_online: boolean;
}
```

---

### **2. Create User Form (React)**

```tsx
function CreateUserForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    user_type: 'employee',
    ab_person_id: ''  // ✅ OPTIONAL
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const response = await fetch('/api/users/auth/register/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        ...formData,
        // Send ab_person_id only if provided
        ab_person_id: formData.ab_person_id || undefined
      })
    });
    
    const data = await response.json();
    console.log('Created user with Person ID:', data.user_info.ab_person_id);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        value={formData.username}
        onChange={e => setFormData({...formData, username: e.target.value})}
        required
      />
      
      {/* Other fields... */}
      
      <input
        type="text"
        placeholder="Person ID (optional, 4 digits)"
        value={formData.ab_person_id}
        onChange={e => setFormData({...formData, ab_person_id: e.target.value})}
        maxLength={4}
        pattern="[0-9]{4}"
      />
      <small>Optional: Enter a 4-digit Person ID (e.g., 1234)</small>
      
      <button type="submit">Create User</button>
    </form>
  );
}
```

---

### **3. Update Person ID (React)**

```tsx
async function updatePersonId(userId: string, personId: string | null) {
  const response = await fetch(`/api/users/users/${userId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAdminToken()}`
    },
    body: JSON.stringify({
      ab_person_id: personId  // Can be "1234" or null
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.ab_person_id?.[0] || 'Failed to update');
  }
  
  return await response.json();
}

// Usage
await updatePersonId(user.id, '5678');  // Set to 5678
await updatePersonId(user.id, null);    // Remove Person ID
```

---

### **4. Display Person ID**

```tsx
function UserCard({ user }: { user: User }) {
  return (
    <div className="user-card">
      <h3>{user.first_name} {user.last_name}</h3>
      <p>Email: {user.email}</p>
      <p>Username: {user.username}</p>
      <p>
        Person ID: {user.ab_person_id || 'Not assigned'}
      </p>
    </div>
  );
}
```

---

### **5. Edit Person ID Component**

```tsx
function EditPersonId({ user, onUpdate }: { user: User, onUpdate: () => void }) {
  const [personId, setPersonId] = useState(user.ab_person_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setLoading(true);
    setError('');
    
    try {
      await fetch(`/api/users/users/${user.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          ab_person_id: personId || null
        })
      }).then(async res => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.ab_person_id?.[0] || 'Update failed');
        }
        return res.json();
      });
      
      alert('Person ID updated successfully');
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="edit-person-id">
      <label>
        Person ID (4 digits):
        <input
          type="text"
          value={personId}
          onChange={e => setPersonId(e.target.value)}
          maxLength={4}
          pattern="[0-9]{4}"
          placeholder="1234"
        />
      </label>
      
      {error && <div className="error">{error}</div>}
      
      <button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save Person ID'}
      </button>
      
      <button onClick={() => setPersonId('')}>
        Clear
      </button>
    </div>
  );
}
```

---

## ⚠️ Validation Rules

### **Frontend Validation (Recommended):**

```typescript
function validatePersonId(value: string): string | null {
  // Empty is OK (null)
  if (!value || value.trim() === '') {
    return null;
  }
  
  // Must be 4 digits
  if (!/^\d{4}$/.test(value)) {
    return 'Person ID must be exactly 4 digits';
  }
  
  // Valid
  return null;
}

// Usage
const error = validatePersonId(personId);
if (error) {
  setError(error);
  return;
}
```

---

## 🚨 Error Handling

### **Common Errors:**

#### **1. Invalid Format (Not 4 Digits)**

**Request:**
```json
{
  "ab_person_id": "123"  // Only 3 digits
}
```

**Response:** (400 Bad Request)
```json
{
  "ab_person_id": [
    "Person ID must be exactly 4 digits"
  ]
}
```

---

#### **2. Duplicate Person ID**

**Request:**
```json
{
  "ab_person_id": "1234"  // Already exists
}
```

**Response:** (400 Bad Request)
```json
{
  "ab_person_id": [
    "This Person ID is already in use"
  ]
}
```

---

#### **3. Invalid Characters**

**Request:**
```json
{
  "ab_person_id": "ABCD"  // Letters not allowed
}
```

**Response:** (400 Bad Request)
```json
{
  "ab_person_id": [
    "Person ID must be exactly 4 digits"
  ]
}
```

---

### **Error Handling Example:**

```typescript
async function updatePersonId(userId: string, personId: string) {
  try {
    const response = await fetch(`/api/users/users/${userId}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ ab_person_id: personId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      if (error.ab_person_id) {
        // Show specific Person ID error
        alert(`Error: ${error.ab_person_id[0]}`);
      } else {
        alert('Failed to update Person ID');
      }
      return null;
    }
    
    return await response.json();
  } catch (err) {
    console.error('Network error:', err);
    alert('Failed to connect to server');
    return null;
  }
}
```

---

## 📊 Complete API Examples

### **JavaScript/Fetch Examples:**

#### **Create User:**
```javascript
async function createUser(userData) {
  const response = await fetch('/api/users/auth/register/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: userData.username,
      email: userData.email,
      password: userData.password,
      password_confirm: userData.password,
      first_name: userData.firstName,
      last_name: userData.lastName,
      user_type: userData.userType,
      ab_person_id: userData.personId || undefined  // Optional
    })
  });
  
  return await response.json();
}

// Usage
const newUser = await createUser({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe',
  userType: 'employee',
  personId: '1234'  // Optional
});

console.log('Person ID:', newUser.user_info.ab_person_id);
```

---

#### **Update Person ID:**
```javascript
async function updateUserPersonId(userId, personId) {
  const response = await fetch(`/api/users/users/${userId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      ab_person_id: personId
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.ab_person_id?.[0] || 'Update failed');
  }
  
  return await response.json();
}

// Usage
const updated = await updateUserPersonId(user.id, '5678');
console.log('Updated Person ID:', updated.ab_person_id);
```

---

## 🎯 Common Use Cases

### **Use Case 1: Admin Creates Employee with Person ID**

```typescript
const createEmployeeWithId = async () => {
  const response = await fetch('/api/users/auth/register/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'emp_001',
      email: 'emp001@company.com',
      password: 'TempPass123!',
      password_confirm: 'TempPass123!',
      first_name: 'Employee',
      last_name: '001',
      user_type: 'employee',
      ab_person_id: '1001'  // Admin assigns ID
    })
  });
  
  const data = await response.json();
  return data;
};
```

---

### **Use Case 2: Admin Assigns Person ID to Existing User**

```typescript
const assignPersonId = async (userId: string) => {
  // Get next available ID or let admin enter manually
  const personId = '2001';  // Admin decides
  
  const response = await fetch(`/api/users/users/${userId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ ab_person_id: personId })
  });
  
  return await response.json();
};
```

---

### **Use Case 3: Display User List with Person IDs**

```tsx
function UserList({ users }: { users: User[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>Email</th>
          <th>Person ID</th>
          <th>Type</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <td>{user.username}</td>
            <td>{user.email}</td>
            <td>
              {user.ab_person_id ? (
                <span className="person-id">{user.ab_person_id}</span>
              ) : (
                <span className="no-id">Not assigned</span>
              )}
            </td>
            <td>{user.employee ? 'Employee' : 'Manager'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### **Use Case 4: Filter Users Without Person ID**

```typescript
// Get all users without Person ID assigned
async function getUsersWithoutPersonId() {
  const response = await fetch('/api/users/users/', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  
  // Filter in frontend
  const usersWithoutId = data.results.filter(
    user => user.ab_person_id === null
  );
  
  return usersWithoutId;
}
```

---

### **Use Case 5: Search by Person ID**

```typescript
async function searchByPersonId(personId: string) {
  // Use search parameter
  const response = await fetch(
    `/api/users/users/?search=${personId}`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  
  return await response.json();
}
```

---

## 🔒 Permission Notes

### **Who Can Update `ab_person_id`:**
- ✅ **Superusers (Admins)** - Can update any user
- ✅ **Managers** - Can update any user (depending on your permissions)
- ❌ **Employees** - Cannot update (read-only)

### **Security:**
- All update operations require authentication
- PATCH endpoint respects existing permission system
- Non-admins get 403 Forbidden when trying to update

---

## ✅ Quick Checklist

### **Frontend Tasks:**

- [ ] Update TypeScript interfaces to include `ab_person_id: string | null`
- [ ] Add Person ID field to user creation form (optional input)
- [ ] Add Person ID display to user profile pages
- [ ] Add Person ID column to user lists (managers, employees)
- [ ] Create PATCH function to update Person ID
- [ ] Handle `null` values gracefully (show "Not assigned")
- [ ] Add validation (4 digits only)
- [ ] Show error messages for validation failures
- [ ] Test creating user WITH Person ID
- [ ] Test creating user WITHOUT Person ID
- [ ] Test updating existing user to add Person ID
- [ ] Test validation errors

---

## 🎯 Quick Testing

### **Test in Browser Console:**

```javascript
// Login and check response
fetch('http://localhost:8000/api/users/auth/login/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'youruser',
    password: 'yourpass'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Person ID:', data.user_info.ab_person_id);
});

// Create user with Person ID
fetch('http://localhost:8000/api/users/auth/register/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser999',
    email: 'test999@example.com',
    password: 'TestPass123!',
    password_confirm: 'TestPass123!',
    user_type: 'employee',
    ab_person_id: '9999'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Created with Person ID:', data.user_info.ab_person_id);
});

// Update existing user
fetch('http://localhost:8000/api/users/users/USER_ID_HERE/', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    ab_person_id: '8888'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Updated Person ID:', data.ab_person_id);
});
```

---

## 📞 Summary

### **What Frontend Needs to Do:**

1. ✅ **Add optional input** to user creation forms
2. ✅ **Display Person ID** in user lists and profiles  
3. ✅ **Create PATCH function** to update Person ID
4. ✅ **Handle `null` values** gracefully
5. ✅ **Add validation** (4 digits, numbers only)
6. ✅ **Show error messages** from API

### **Endpoints to Use:**

```
POST   /api/users/auth/register/     # Create user (include ab_person_id)
PATCH  /api/users/users/{id}/        # Update user (set ab_person_id)
GET    /api/users/users/             # List users (see ab_person_id)
GET    /api/users/managers/          # List managers (see ab_person_id)
GET    /api/users/employees/         # List employees (see ab_person_id)
```

### **Field Details:**

```
Field Name: ab_person_id
Type: string | null
Format: 4 digits only ("1234", "5678", etc.)
Optional: Yes
Writable: Yes (admin only)
```

---

## 🚀 Quick Start

**1. Update TypeScript:**
```typescript
interface User {
  // ... existing fields
  ab_person_id: string | null;  // ADD THIS
}
```

**2. Add to Create Form:**
```tsx
<input 
  type="text" 
  name="ab_person_id" 
  maxLength={4}
  pattern="[0-9]{4}"
  placeholder="Person ID (optional)"
/>
```

**3. Display in Lists:**
```tsx
{user.ab_person_id || 'Not assigned'}
```

**4. Update Function:**
```typescript
PATCH /api/users/users/{id}/
{ "ab_person_id": "1234" }
```

**Done!** ✅

---

**Questions?** Check `API_CHANGES_FRONTEND.md` for full details!

---

**Version:** 1.0  
**Status:** ✅ Ready for Frontend Integration  
**Backend:** ✅ Complete

