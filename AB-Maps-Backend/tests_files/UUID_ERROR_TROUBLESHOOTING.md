# UUID Error Troubleshooting Guide

## 🚨 Problem: "norsk-folkehjelp" is not a valid UUID

The error occurs because the frontend is trying to use a string ID (`norsk-folkehjelp`) instead of a proper UUID format that the database expects.

## 🔧 Quick Fix

### **Step 1: Check Existing Campaigns**
```bash
python check_campaigns.py
```

This will show you:
- ✅ Existing campaigns and their UUIDs
- ✅ Available users
- ✅ Sales data count
- ✅ Correct API call examples

### **Step 2: Create Test Data (if needed)**
```bash
python create_test_data.py
```

### **Step 3: Get Real Campaign UUIDs**
Run the check script again to get the real UUIDs:
```bash
python check_campaigns.py
```

You'll see output like:
```
✅ Campaign: Norsk Folkehjelp
   ID: 550e8400-e29b-41d4-a716-446655440000
```

### **Step 4: Test with Correct UUID**
Use the real UUID in your API call:
```bash
curl "http://localhost:8000/api/dashboard/sales/filtered/?campaign_id=550e8400-e29b-41d4-a716-446655440000&start_date=2025-07-20&end_date=2025-07-20"
```

## 🎯 What I Fixed

### **1. Frontend Validation**
- ✅ Added UUID format validation
- ✅ Better error messages
- ✅ Removed hardcoded string IDs
- ✅ Proper campaign loading

### **2. Backend Error Handling**
- ✅ UUID format validation
- ✅ Helpful error messages
- ✅ Proper UUID conversion

### **3. Campaign Management**
- ✅ Real campaign loading from API
- ✅ UUID validation
- ✅ Fallback handling

## 🧪 Testing Steps

### **Option 1: Use the Frontend (Recommended)**
1. **Start backend**: `cd be_files/backend && python manage.py runserver`
2. **Create test data**: `python create_test_data.py`
3. **Start frontend**: `cd ab-maps-sales-dashboard_old && npm run dev`
4. **Visit**: `http://localhost:3000/sales`
5. **Login** with test credentials
6. **Select campaign** from dropdown (uses real UUIDs)

### **Option 2: Test API Directly**
1. **Get campaign UUID**:
   ```bash
   python check_campaigns.py
   ```

2. **Test API with real UUID**:
   ```bash
   curl "http://localhost:8000/api/dashboard/sales/filtered/?campaign_id=REAL_UUID_HERE&start_date=2025-07-20&end_date=2025-07-20"
   ```

## 🔍 Debugging

### **If campaigns don't load**:
1. Check if backend is running
2. Verify authentication
3. Check network tab for API errors
4. Run `python check_campaigns.py` to verify data exists

### **If UUID validation fails**:
1. Clear localStorage: `localStorage.clear()`
2. Refresh page
3. Select campaign from dropdown (not manual entry)

### **If API still fails**:
1. Check Django logs for detailed errors
2. Verify campaign exists in database
3. Ensure proper authentication

## 📊 Expected UUID Format

Valid UUID format:
```
550e8400-e29b-41d4-a716-446655440000
```

Invalid formats:
```
❌ norsk-folkehjelp
❌ standard-oms
❌ 123
❌ abc-def
```

## 🎉 Success Criteria

The fix is working when:
- ✅ Frontend loads campaigns from API
- ✅ Campaign dropdown shows real campaign names
- ✅ API calls use proper UUIDs
- ✅ No more "not a valid UUID" errors
- ✅ Sales data loads correctly

## 🚀 Quick Test

1. **Run this command** to see your campaigns:
   ```bash
   python check_campaigns.py
   ```

2. **Use the provided UUID** in your API call

3. **Or just use the frontend** - it will handle UUIDs automatically!

The UUID error should now be resolved! 🎉 