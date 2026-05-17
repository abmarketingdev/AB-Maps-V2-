// errorTracker.js - Comprehensive error tracking for vector tile debugging
class VectorTileErrorTracker {
  constructor() {
    this.errors = [];
    this.events = [];
    this.maxEntries = 50;
    
    // Set up global error handler
    this.setupGlobalErrorHandler();
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring();
  }

  setupGlobalErrorHandler() {
    const originalError = console.error;
    console.error = (...args) => {
      // Check if this is a latlng-related error
      const errorMessage = args.join(' ');
      if (errorMessage.includes('lat') || errorMessage.includes('lng') || errorMessage.includes('latlng')) {
        this.trackError('console.error', {
          message: errorMessage,
          args: args,
          stackTrace: new Error().stack?.split('\n').slice(1, 10),
          timestamp: new Date().toISOString()
        });
      }
      originalError.apply(console, args);
    };

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError('unhandledrejection', {
        reason: event.reason,
        stackTrace: event.reason?.stack?.split('\n') || ['No stack trace'],
        timestamp: new Date().toISOString()
      });
    });

    // Catch uncaught errors
    window.addEventListener('error', (event) => {
      this.trackError('uncaught', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stackTrace: event.error?.stack?.split('\n') || ['No stack trace'],
        timestamp: new Date().toISOString()
      });
    });
  }

  setupPerformanceMonitoring() {
    // Monitor map events
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === 'click' && this.tagName === 'DIV' && this.className?.includes('leaflet')) {
        console.log('🎯 [ErrorTracker] Leaflet click listener added to:', this.className);
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
  }

  trackError(type, data) {
    const entry = {
      id: Date.now() + Math.random(),
      type: type,
      data: data,
      timestamp: new Date().toISOString()
    };
    
    this.errors.push(entry);
    
    // Keep only recent entries
    if (this.errors.length > this.maxEntries) {
      this.errors.shift();
    }
    
    console.error(`🚨 [ErrorTracker] ${type}:`, entry);
  }

  trackEvent(type, data) {
    const entry = {
      id: Date.now() + Math.random(),
      type: type,
      data: data,
      timestamp: new Date().toISOString()
    };
    
    this.events.push(entry);
    
    // Keep only recent entries
    if (this.events.length > this.maxEntries) {
      this.events.shift();
    }
    
    console.log(`📊 [ErrorTracker] ${type}:`, entry);
  }

  getReport() {
    return {
      errors: this.errors,
      events: this.events,
      summary: {
        totalErrors: this.errors.length,
        totalEvents: this.events.length,
        errorTypes: this.errors.reduce((acc, err) => {
          acc[err.type] = (acc[err.type] || 0) + 1;
          return acc;
        }, {}),
        recentErrors: this.errors.slice(-10),
        recentEvents: this.events.slice(-10)
      }
    };
  }

  clear() {
    this.errors = [];
    this.events = [];
    console.log('🧹 [ErrorTracker] Cleared all tracked data');
  }

  export() {
    const report = this.getReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vector-tile-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Create global instance
const errorTracker = new VectorTileErrorTracker();

// Expose globally for debugging
window.vectorTileErrorTracker = errorTracker;

// Add some utility functions
window.debugVectorTiles = {
  getReport: () => errorTracker.getReport(),
  clear: () => errorTracker.clear(),
  export: () => errorTracker.export(),
  trackEvent: (type, data) => errorTracker.trackEvent(type, data),
  trackError: (type, data) => errorTracker.trackError(type, data)
};

console.log('🔍 [ErrorTracker] Vector tile error tracking initialized');
console.log('🔍 [ErrorTracker] Use window.debugVectorTiles.getReport() to see all tracked data');
console.log('🔍 [ErrorTracker] Use window.debugVectorTiles.export() to download debug data');

export default errorTracker;
