# Authentication Test Guide

## 🔐 Fixing the 401 Unauthorized Error

The API requires authentication. Here's how to fix it:

## 🚀 Quick Solutions

### **Option 1: Use the Frontend Login (Recommended)**

1. **Start the frontend**:
```bash
cd ab-maps-sales-dashboard_old
npm run dev
```

2. **Visit the sales page**: `http://localhost:3000/sales`

3. **You'll see a login prompt** with test credentials:
   - **Manager**: `test_manager` / `testpass123`
   - **Employee**: `test_employee` / `testpass123`

4. **Login and the API will work automatically**

### **Option 2: Test in Browser with Session**

1. **Login to Django Admin**:
   - Visit: `http://localhost:8000/admin/`
   - Login with superuser credentials
   - Keep this tab open

2. **Test API in same browser**:
   - Visit: `http://localhost:8000/api/dashboard/sales/filtered/?campaign_id=norsk-folkehjelp&start_date=2025-07-20&end_date=2025-07-20`

### **Option 3: Use curl with Authentication**

1. **Get a token**:
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "test_manager", "password": "testpass123"}'
```

2. **Use the token**:
```bash
curl "http://localhost:8000/api/dashboard/sales/filtered/?campaign_id=norsk-folkehjelp&start_date=2025-07-20&end_date=2025-07-20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔧 What I Fixed

### **1. Updated Sales Service**
- Added authentication headers to API calls
- Uses `authService.getAuthHeader()` for Bearer tokens
- Removed session-based authentication

### **2. Added Login Component**
- Created `LoginPrompt.tsx` for easy testing
- Shows test credentials
- Handles login errors

### **3. Updated Sales Screen**
- Checks authentication on load
- Shows login prompt if not authenticated
- Automatically refreshes data after login

## ✅ Test Credentials

The `create_test_data.py` script created these users:

### **Manager Account**
- **Username**: `test_manager`
- **Password**: `testpass123`
- **Access**: All sales data

### **Employee Account**
- **Username**: `test_employee`
- **Password**: `testpass123`
- **Access**: Only own sales data

## 🧪 Testing Steps

1. **Start backend**: `cd be_files/backend && python manage.py runserver`
2. **Create test data**: `python create_test_data.py`
3. **Start frontend**: `cd ab-maps-sales-dashboard_old && npm run dev`
4. **Visit**: `http://localhost:3000/sales`
5. **Login** with test credentials
6. **Verify** data loads correctly

## 🔍 Debugging

### **If still getting 401**:
1. Check if user exists: `python manage.py shell`
   ```python
   from django.contrib.auth import get_user_model
   User = get_user_model()
   User.objects.filter(username='test_manager').exists()
   ```

2. Check token in browser dev tools:
   - Network tab → Look for Authorization header
   - Application tab → Local Storage → Check for `auth_tokens`

3. Verify API endpoint:
   ```bash
   curl -X POST http://localhost:8000/api/auth/login/ \
     -H "Content-Type: application/json" \
     -d '{"username": "test_manager", "password": "testpass123"}'
   ```

### **If login fails**:
1. Check Django logs for errors
2. Verify user was created properly
3. Try creating a new superuser:
   ```bash
   python manage.py createsuperuser
   ```

## 🎯 Expected Result

After successful authentication:
- ✅ API calls work without 401 errors
- ✅ Sales data loads in the table
- ✅ Today's data shows by default
- ✅ All filtering works correctly
- ✅ Pagination functions properly

The authentication is now properly integrated and should resolve the 401 Unauthorized error! 🎉 