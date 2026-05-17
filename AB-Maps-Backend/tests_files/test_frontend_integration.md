# Frontend Integration Test Guide

## 🎯 Overview

The filtered sales API is now fully integrated into the frontend. Here's how to test it:

## 🚀 Quick Start

### 1. **Start the Backend Server**
```bash
cd be_files/backend
python manage.py runserver
```

### 2. **Create Test Data**
```bash
python create_test_data.py
```

### 3. **Start the Frontend**
```bash
cd ab-maps-sales-dashboard_old
npm run dev
# or
yarn dev
```

### 4. **Test the Integration**

Visit: `http://localhost:3000/sales` (or your sales page URL)

## ✅ What You Should See

### **Default Behavior (Today's Data)**
- ✅ Date range defaults to today's date
- ✅ Campaign dropdown populated with real campaigns
- ✅ Sales table shows data from the API
- ✅ Loading states while fetching data
- ✅ Error handling if API is unavailable

### **Table Columns**
- ✅ **Dato** - Formatted date (e.g., "10. Mar 23:35")
- ✅ **Navn** - Contact name
- ✅ **E-post** - Contact email
- ✅ **Nummer** - Contact phone number
- ✅ **Status** - Norwegian status (Venter, Fullført, etc.)
- ✅ **Handlinger** - Action menu

### **Filtering Features**
- ✅ **Date Range** - Change start/end dates
- ✅ **Campaign Filter** - Select specific campaigns
- ✅ **Search** - Search in name/email
- ✅ **Status Filter** - "Vis påbegynte" checkbox
- ✅ **Pagination** - Previous/Next buttons

## 🔧 Testing Scenarios

### **1. Default Load (Today's Data)**
- Page loads with today's date
- Shows sales for the selected campaign
- Displays loading spinner initially

### **2. Campaign Selection**
- Click campaign dropdown
- Select different campaigns
- Data refreshes automatically

### **3. Date Range Filtering**
- Change start date
- Change end date
- Data refreshes with new date range

### **4. Search Functionality**
- Type in search box
- Results filter in real-time
- Searches name and email fields

### **5. Status Filtering**
- Toggle "Vis påbegynte" checkbox
- Shows/hides pending and callback statuses
- Only shows completed when unchecked

### **6. Pagination**
- Click "Forrige" (Previous)
- Click "Neste" (Next)
- Buttons disable appropriately

## 🐛 Troubleshooting

### **No Data Showing**
1. Check if backend is running: `http://localhost:8000/api/dashboard/sales/filtered/`
2. Verify test data was created: `python create_test_data.py`
3. Check browser console for errors
4. Ensure campaign is selected in localStorage

### **API Errors**
1. Check Django server logs
2. Verify authentication (login required)
3. Check campaign ID exists in database
4. Verify date format (YYYY-MM-DD)

### **Frontend Issues**
1. Check browser console for JavaScript errors
2. Verify API_BASE_URL in salesService.ts
3. Check network tab for failed requests
4. Ensure CORS is configured properly

## 📊 Expected Data Format

The API returns:
```json
{
  "results": [
    {
      "date": "10. Mar 23:35",
      "name": "Dana Barzinje",
      "email": "dana@example.com",
      "number": "48631833",
      "status": "Venter"
    }
  ],
  "total_count": 1,
  "page": 1,
  "page_size": 50,
  "total_pages": 1
}
```

## 🎨 UI Features

### **Loading States**
- Spinner while fetching data
- Table opacity reduced during loading
- "Laster data..." message

### **Error Handling**
- Error messages displayed in table
- Graceful fallback to empty state
- Console logging for debugging

### **Empty States**
- "Ingen salg funnet for valgt periode" message
- Clean, user-friendly display

### **Responsive Design**
- Works on mobile and desktop
- Responsive table layout
- Adaptive filter controls

## 🔄 Real-time Updates

The frontend automatically:
- ✅ Refreshes data when filters change
- ✅ Updates pagination info
- ✅ Handles loading states
- ✅ Shows error messages
- ✅ Maintains user selections

## 🎉 Success Criteria

The integration is working correctly when:
1. ✅ Page loads with today's sales data
2. ✅ Campaign selection works
3. ✅ Date filtering works
4. ✅ Search functionality works
5. ✅ Status filtering works
6. ✅ Pagination works
7. ✅ Loading states display properly
8. ✅ Error handling works
9. ✅ Data format matches expected structure

## 📝 Notes

- **Default Campaign**: First campaign is auto-selected if none exists
- **Date Format**: Uses YYYY-MM-DD for API, displays in Norwegian format
- **Status Mapping**: API statuses are mapped to Norwegian display names
- **Authentication**: Requires user to be logged in
- **CORS**: May need CORS configuration for local development 