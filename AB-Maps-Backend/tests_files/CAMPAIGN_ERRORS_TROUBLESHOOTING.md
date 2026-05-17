# Campaign Errors Troubleshooting Guide

## 🚨 Problems Identified

### **Error 1**: `Invalid campaign ID format: norsk-folkehjelp. Expected UUID format.`
- **Cause**: Frontend is using string IDs instead of UUIDs
- **Location**: `salesService.ts:48:15`

### **Error 2**: `TypeError: campaigns.map is not a function`
- **Cause**: API response format is unexpected
- **Location**: `salesService.ts:113:26`

## 🔧 What I Fixed

### **1. UUID Validation & Cleanup**
- ✅ Added UUID format validation in `getSelectedCampaign()`
- ✅ Auto-clear invalid campaign data from localStorage
- ✅ Added `clearInvalidCampaignData()` function
- ✅ Better error messages for invalid UUIDs

### **2. API Response Handling**
- ✅ Fixed campaigns API endpoint URL (`/api/campaigns/campaigns/`)
- ✅ Added response format validation
- ✅ Handle both array and paginated responses
- ✅ Better error logging

### **3. Frontend State Management**
- ✅ Clear invalid data on component mount
- ✅ Wait for authentication before loading campaigns
- ✅ Better error handling and user feedback
- ✅ Prevent API calls when no campaigns available

## 🧪 Testing Steps

### **Step 1: Test the Backend API**
```bash
python test_campaigns_api.py
```

This will test:
- ✅ Campaigns API endpoint
- ✅ Authentication
- ✅ Response format
- ✅ UUID validation

### **Step 2: Check Database**
```bash
python check_campaigns.py
```

This will show:
- ✅ Existing campaigns and their UUIDs
- ✅ Available users
- ✅ Sales data

### **Step 3: Test Frontend**
1. **Start backend**: `cd be_files/backend && python manage.py runserver`
2. **Start frontend**: `cd ab-maps-sales-dashboard_old && npm run dev`
3. **Visit**: `http://localhost:3000/sales`
4. **Login** with test credentials
5. **Check browser console** for logs

## 🔍 Debugging Commands

### **Clear Invalid Data**
```javascript
// In browser console
localStorage.clear()
// Then refresh the page
```

### **Check Stored Campaign**
```javascript
// In browser console
console.log('Stored campaign:', JSON.parse(localStorage.getItem('selectedCampaign')))
```

### **Test API Directly**
```bash
# Get token first
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "test_manager", "password": "testpass123"}'

# Use token to get campaigns
curl "http://localhost:8000/api/campaigns/campaigns/" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📊 Expected Behavior

### **Before Fix**:
- ❌ UUID validation error
- ❌ campaigns.map error
- ❌ Invalid campaign IDs in localStorage
- ❌ API calls with wrong endpoint

### **After Fix**:
- ✅ UUID validation works
- ✅ Campaigns load properly
- ✅ Invalid data auto-cleared
- ✅ Proper error messages
- ✅ Real UUIDs used in API calls

## 🎯 Root Causes

### **1. Invalid Campaign IDs**
- **Problem**: Hardcoded string IDs like `"norsk-folkehjelp"`
- **Solution**: Use real UUIDs from database
- **Fix**: Auto-clear invalid data, validate UUIDs

### **2. Wrong API Endpoint**
- **Problem**: Using `/api/campaigns/` instead of `/api/campaigns/campaigns/`
- **Solution**: Use correct endpoint
- **Fix**: Updated URL in `fetchCampaigns()`

### **3. Response Format Issues**
- **Problem**: Expecting array but getting different format
- **Solution**: Handle multiple response formats
- **Fix**: Added format validation and fallbacks

## 🚀 Quick Fix Commands

### **1. Clear All Data and Start Fresh**
```bash
# Backend
cd be_files/backend
python manage.py runserver

# Create fresh test data
python create_test_data.py

# Frontend
cd ab-maps-sales-dashboard_old
npm run dev
```

### **2. Test Everything**
```bash
# Test campaigns API
python test_campaigns_api.py

# Check database
python check_campaigns.py

# Visit frontend and login
# http://localhost:3000/sales
```

## 🎉 Success Criteria

The errors are fixed when:
- ✅ No UUID validation errors in console
- ✅ No `campaigns.map` errors
- ✅ Campaigns dropdown populates with real data
- ✅ Sales data loads correctly
- ✅ All API calls use proper UUIDs

## 📝 Notes

- **localStorage**: Invalid campaign data is automatically cleared
- **API Endpoint**: Now uses correct `/api/campaigns/campaigns/` URL
- **Authentication**: Required for all API calls
- **UUID Format**: Must be valid UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)

The campaign errors should now be completely resolved! 🎉 