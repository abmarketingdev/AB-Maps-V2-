// vectorTileClickTester.js - Systematic testing for vector tile clicks
class VectorTileClickTester {
  constructor() {
    this.testResults = [];
    this.isTesting = false;
  }

  // Test function to simulate different click scenarios
  async testVectorTileClicks() {
    console.log('🧪 [VectorTileClickTester] Starting systematic vector tile click testing...');
    this.isTesting = true;
    
    // Clear previous test results
    this.testResults = [];
    
    // Test 1: Check if vector tiles are loaded
    await this.testVectorTilesLoaded();
    
    // Test 2: Check map click events
    await this.testMapClickEvents();
    
    // Test 3: Check vector tile layer events
    await this.testVectorTileLayerEvents();
    
    // Test 4: Simulate invalid latlng scenarios
    await this.testInvalidLatLngScenarios();
    
    // Test 5: Check event propagation
    await this.testEventPropagation();
    
    this.isTesting = false;
    this.generateReport();
  }

  async testVectorTilesLoaded() {
    console.log('🧪 [VectorTileClickTester] Test 1: Checking vector tiles loaded...');
    
    const map = window.mapRef || document.querySelector('.leaflet-container')?._leaflet_id;
    const vectorTilePane = document.querySelector('.leaflet-pane.leaflet-vector-tile-pane');
    
    this.testResults.push({
      test: 'Vector Tiles Loaded',
      result: !!vectorTilePane,
      details: {
        hasMap: !!map,
        hasVectorTilePane: !!vectorTilePane,
        paneChildren: vectorTilePane?.children?.length || 0
      }
    });
    
    console.log('✅ Vector tiles loaded:', !!vectorTilePane);
  }

  async testMapClickEvents() {
    console.log('🧪 [VectorTileClickTester] Test 2: Testing map click events...');
    
    const mapContainer = document.querySelector('.leaflet-container');
    if (!mapContainer) {
      this.testResults.push({
        test: 'Map Click Events',
        result: false,
        details: { error: 'No map container found' }
      });
      return;
    }

    // Simulate a click on the map
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100
    });

    let clickHandled = false;
    const clickHandler = (e) => {
      clickHandled = true;
      console.log('🧪 [VectorTileClickTester] Map click detected:', e);
    };

    mapContainer.addEventListener('click', clickHandler);
    mapContainer.dispatchEvent(clickEvent);
    mapContainer.removeEventListener('click', clickHandler);

    this.testResults.push({
      test: 'Map Click Events',
      result: clickHandled,
      details: {
        clickHandled: clickHandled,
        mapContainer: !!mapContainer
      }
    });
  }

  async testVectorTileLayerEvents() {
    console.log('🧪 [VectorTileClickTester] Test 3: Testing vector tile layer events...');
    
    // Check if VectorTileLayer component is mounted
    const vectorTileElements = document.querySelectorAll('[class*="vector-tile"], [class*="vectorgrid"]');
    
    this.testResults.push({
      test: 'Vector Tile Layer Events',
      result: vectorTileElements.length > 0,
      details: {
        vectorTileElements: vectorTileElements.length,
        elements: Array.from(vectorTileElements).map(el => ({
          className: el.className,
          tagName: el.tagName
        }))
      }
    });
  }

  async testInvalidLatLngScenarios() {
    console.log('🧪 [VectorTileClickTester] Test 4: Testing invalid latlng scenarios...');
    
    // Test different invalid latlng scenarios
    const testCases = [
      { lat: undefined, lng: 10.7 },
      { lat: 59.9, lng: undefined },
      { x: 123, y: 456 },
      null,
      undefined,
      { lat: 'invalid', lng: 10.7 }
    ];

    const results = [];
    testCases.forEach((testCase, index) => {
      try {
        // Try to create a Leaflet point with invalid data
        if (window.L && window.L.point) {
          const point = window.L.point(testCase);
          results.push({
            testCase: index + 1,
            input: testCase,
            result: 'success',
            point: point
          });
        }
      } catch (error) {
        results.push({
          testCase: index + 1,
          input: testCase,
          result: 'error',
          error: error.message
        });
      }
    });

    this.testResults.push({
      test: 'Invalid LatLng Scenarios',
      result: results.length > 0,
      details: { results: results }
    });
  }

  async testEventPropagation() {
    console.log('🧪 [VectorTileClickTester] Test 5: Testing event propagation...');
    
    const mapContainer = document.querySelector('.leaflet-container');
    if (!mapContainer) {
      this.testResults.push({
        test: 'Event Propagation',
        result: false,
        details: { error: 'No map container found' }
      });
      return;
    }

    let propagationTest = {
      documentClick: false,
      mapClick: false,
      vectorTileClick: false
    };

    // Add event listeners
    const documentHandler = (e) => {
      propagationTest.documentClick = true;
      console.log('🧪 [VectorTileClickTester] Document click detected');
    };

    const mapHandler = (e) => {
      propagationTest.mapClick = true;
      console.log('🧪 [VectorTileClickTester] Map click detected');
    };

    document.addEventListener('click', documentHandler, true);
    mapContainer.addEventListener('click', mapHandler);

    // Simulate click
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 200
    });

    mapContainer.dispatchEvent(clickEvent);

    // Cleanup
    document.removeEventListener('click', documentHandler, true);
    mapContainer.removeEventListener('click', mapHandler);

    this.testResults.push({
      test: 'Event Propagation',
      result: propagationTest.documentClick || propagationTest.mapClick,
      details: propagationTest
    });
  }

  generateReport() {
    console.group('🧪 [VectorTileClickTester] Test Report');
    console.log('Total tests:', this.testResults.length);
    
    this.testResults.forEach((result, index) => {
      console.log(`Test ${index + 1}: ${result.test} - ${result.result ? 'PASS' : 'FAIL'}`);
      console.log('Details:', result.details);
    });
    
    console.groupEnd();
    
    // Store results globally
    window.vectorTileTestResults = this.testResults;
    
    return this.testResults;
  }

  // Quick test function
  quickTest() {
    console.log('🧪 [VectorTileClickTester] Running quick test...');
    
    const mapContainer = document.querySelector('.leaflet-container');
    const vectorTilePane = document.querySelector('.leaflet-pane.leaflet-vector-tile-pane');
    const vectorTileElements = document.querySelectorAll('[class*="vector-tile"], [class*="vectorgrid"]');
    
    console.log('Quick Test Results:');
    console.log('- Map container:', !!mapContainer);
    console.log('- Vector tile pane:', !!vectorTilePane);
    console.log('- Vector tile elements:', vectorTileElements.length);
    console.log('- Leaflet guard active:', !!window.leafletGuardDebug);
    console.log('- Error tracker active:', !!window.debugVectorTiles);
    console.log('- Vector tile debugger active:', !!window.vectorTileDebugger);
    
    return {
      mapContainer: !!mapContainer,
      vectorTilePane: !!vectorTilePane,
      vectorTileElements: vectorTileElements.length,
      leafletGuardActive: !!window.leafletGuardDebug,
      errorTrackerActive: !!window.debugVectorTiles,
      vectorTileDebuggerActive: !!window.vectorTileDebugger
    };
  }
}

// Create global instance
const vectorTileClickTester = new VectorTileClickTester();

// Expose globally
window.vectorTileClickTester = vectorTileClickTester;

console.log('🧪 [VectorTileClickTester] Vector tile click tester initialized');
console.log('🧪 [VectorTileClickTester] Use window.vectorTileClickTester.testVectorTileClicks() to run full test');
console.log('🧪 [VectorTileClickTester] Use window.vectorTileClickTester.quickTest() to run quick test');

export default vectorTileClickTester;
