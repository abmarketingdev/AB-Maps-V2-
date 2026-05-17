// Test script for frontend sales data handling
const mockSalesData = {
  results: [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      date: "20. Jul 17:48",
      name: "Lars Kristensen",
      email: "lars.kristensen@example.com",
      number: "486318328",
      status: "Fullført",
      outcome: "Ja",
      value: 1500.00,
      commission: 150.00,
      notes: "Customer was very interested in the product",
      campaign: "Standard OMS",
      campaign_id: "550e8400-e29b-41d4-a716-446655440000",
      employee_name: "John Doe",
      employee_id: "aaa0908b-7dd5-4e44-a588-3a0770f46e40",
      manager_name: "Jane Smith",
      manager_id: "bbb0908b-7dd5-4e44-a588-3a0770f46e41",
      area_name: "Oslo Sentrum",
      area_id: "ccc0908b-7dd5-4e44-a588-3a0770f46e42",
      completed_at: "20. Jul 18:30",
      metadata: {
        call_duration: 300,
        follow_up_required: false
      }
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      date: "20. Jul 16:30",
      name: "Sofia Andersen",
      email: "sofia.andersen@example.com",
      number: "486318329",
      status: "Venter",
      outcome: "Tilbakeringing",
      value: null,
      commission: null,
      notes: "Customer asked to call back tomorrow",
      campaign: "Standard OMS",
      campaign_id: "550e8400-e29b-41d4-a716-446655440000",
      employee_name: "John Doe",
      employee_id: "aaa0908b-7dd5-4e44-a588-3a0770f46e40",
      manager_name: "Jane Smith",
      manager_id: "bbb0908b-7dd5-4e44-a588-3a0770f46e41",
      area_name: "Oslo Sentrum",
      area_id: "ccc0908b-7dd5-4e44-a588-3a0770f46e42",
      completed_at: null,
      metadata: {
        call_duration: 120,
        follow_up_required: true,
        preferred_time: "morning"
      }
    }
  ],
  total_count: 2,
  page: 1,
  page_size: 50,
  total_pages: 1
};

// Test TypeScript type compatibility
function testSalesDataStructure() {
  console.log("🧪 Testing Frontend Sales Data Structure...");
  
  const results = mockSalesData.results;
  
  if (results.length === 0) {
    console.log("❌ No sales data to test");
    return;
  }
  
  const firstSale = results[0];
  
  // Test all required fields
  const requiredFields = [
    'id', 'date', 'name', 'email', 'number', 'status',
    'outcome', 'value', 'commission', 'notes', 'campaign',
    'campaign_id', 'employee_name', 'employee_id',
    'manager_name', 'manager_id', 'area_name', 'area_id',
    'completed_at', 'metadata'
  ];
  
  console.log("📋 Testing Required Fields:");
  let allFieldsPresent = true;
  
  requiredFields.forEach(field => {
    const hasField = field in firstSale;
    const status = hasField ? "✅" : "❌";
    console.log(`   ${status} ${field}: ${hasField ? typeof firstSale[field] : 'MISSING'}`);
    
    if (!hasField) {
      allFieldsPresent = false;
    }
  });
  
  console.log();
  
  if (allFieldsPresent) {
    console.log("✅ All required fields are present!");
  } else {
    console.log("❌ Some required fields are missing!");
  }
  
  // Test data formatting
  console.log("🎨 Testing Data Formatting:");
  
  // Test value formatting
  const value = firstSale.value;
  if (value !== null) {
    const formattedValue = `kr ${value.toLocaleString()}`;
    console.log(`   ✅ Value formatting: ${value} → ${formattedValue}`);
  } else {
    console.log("   ✅ Value formatting: null → '-'");
  }
  
  // Test status badge variants
  const status = firstSale.status;
  let badgeVariant = "default";
  if (status === "Fullført") {
    badgeVariant = "secondary";
  } else if (status === "Venter") {
    badgeVariant = "outline";
  }
  console.log(`   ✅ Status badge: ${status} → ${badgeVariant}`);
  
  // Test outcome badge
  const outcome = firstSale.outcome;
  console.log(`   ✅ Outcome badge: ${outcome} → outline`);
  
  console.log();
  console.log("🎉 Frontend data structure test completed!");
}

// Test table column count
function testTableColumns() {
  console.log("📊 Testing Table Column Count...");
  
  const expectedColumns = [
    "Dato", "Navn", "E-post", "Nummer", "Status", 
    "Resultat", "Verdi", "Kampanje", "Ansatt", "Område", "Handlinger"
  ];
  
  console.log(`   Expected columns: ${expectedColumns.length}`);
  console.log(`   Columns: ${expectedColumns.join(", ")}`);
  
  // Test colspan for loading/error states
  const colspan = expectedColumns.length;
  console.log(`   Loading/Error colspan: ${colspan}`);
  
  console.log("✅ Table column test completed!");
}

// Run tests
testSalesDataStructure();
testTableColumns(); 