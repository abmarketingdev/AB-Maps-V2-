// vectorTileDebugger.js - Additional debugging utilities for vector tiles
import L from 'leaflet';

class VectorTileDebugger {
  constructor() {
    this.clickEvents = [];
    this.invalidLatLngs = [];
    this.setupEventMonitoring();
  }

  setupEventMonitoring() {
    // Monitor all click events on the map
    document.addEventListener('click', (e) => {
      // Check if this is a map-related click
      if (e.target.closest('.leaflet-container') || 
          e.target.closest('.leaflet-map-pane') ||
          e.target.closest('.leaflet-tile-pane') ||
          e.target.closest('.leaflet-overlay-pane') ||
          e.target.closest('.leaflet-marker-pane') ||
          e.target.closest('.leaflet-popup-pane') ||
          e.target.closest('.leaflet-control-container')) {
        
        this.trackClickEvent(e, 'document');
      }
    }, true); // Use capture phase

    // Monitor mouse events
    document.addEventListener('mousedown', (e) => {
      if (e.target.closest('.leaflet-container')) {
        this.trackClickEvent(e, 'mousedown');
      }
    }, true);
  }

  trackClickEvent(event, source) {
    const clickData = {
      timestamp: new Date().toISOString(),
      source: source,
      target: {
        tagName: event.target.tagName,
        className: event.target.className,
        id: event.target.id
      },
      coordinates: {
        clientX: event.clientX,
        clientY: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY
      },
      eventPhase: event.eventPhase,
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      defaultPrevented: event.defaultPrevented,
      propagationStopped: event.cancelBubble
    };

    this.clickEvents.push(clickData);
    
    // Keep only last 20 events
    if (this.clickEvents.length > 20) {
      this.clickEvents.shift();
    }

    console.log(`🖱️ [VectorTileDebugger] ${source} event:`, clickData);
  }

  trackInvalidLatLng(latlng, source, stackTrace) {
    const invalidData = {
      timestamp: new Date().toISOString(),
      source: source,
      latlng: latlng,
      latlngType: typeof latlng,
      latlngKeys: latlng ? Object.keys(latlng) : 'null/undefined',
      stackTrace: stackTrace
    };

    this.invalidLatLngs.push(invalidData);
    
    // Keep only last 10 invalid latlngs
    if (this.invalidLatLngs.length > 10) {
      this.invalidLatLngs.shift();
    }

    console.error(`🚨 [VectorTileDebugger] Invalid latlng from ${source}:`, invalidData);
  }

  getReport() {
    return {
      clickEvents: this.clickEvents,
      invalidLatLngs: this.invalidLatLngs,
      summary: {
        totalClicks: this.clickEvents.length,
        totalInvalidLatLngs: this.invalidLatLngs.length,
        recentClicks: this.clickEvents.slice(-5),
        recentInvalidLatLngs: this.invalidLatLngs.slice(-5)
      }
    };
  }

  clear() {
    this.clickEvents = [];
    this.invalidLatLngs = [];
    console.log('🧹 [VectorTileDebugger] Cleared all tracked data');
  }

  // Test function to simulate invalid latlng
  testInvalidLatLng() {
    console.log('🧪 [VectorTileDebugger] Testing invalid latlng scenarios...');
    
    const testCases = [
      { lat: undefined, lng: 10.7 },
      { lat: 59.9, lng: undefined },
      { lat: null, lng: 10.7 },
      { lat: 59.9, lng: null },
      { x: 123, y: 456 }, // Common mistake
      { lat: 'invalid', lng: 10.7 },
      { lat: 59.9, lng: 'invalid' },
      null,
      undefined,
      {}
    ];

    testCases.forEach((testCase, index) => {
      console.log(`🧪 [VectorTileDebugger] Test case ${index + 1}:`, testCase);
      this.trackInvalidLatLng(testCase, 'test', ['Test stack trace']);
    });
  }
}

// Create global instance
const vectorTileDebugger = new VectorTileDebugger();

// Expose globally
window.vectorTileDebugger = vectorTileDebugger;

console.log('🔍 [VectorTileDebugger] Vector tile debugger initialized');
console.log('🔍 [VectorTileDebugger] Use window.vectorTileDebugger.getReport() to see tracked data');
console.log('🔍 [VectorTileDebugger] Use window.vectorTileDebugger.testInvalidLatLng() to test scenarios');

export default vectorTileDebugger;
