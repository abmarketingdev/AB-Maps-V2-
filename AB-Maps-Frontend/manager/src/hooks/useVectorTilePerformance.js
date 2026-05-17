import { useEffect, useRef, useState } from 'react';

export default function useVectorTilePerformance(enabled = false) {
  const [metrics, setMetrics] = useState({
    fps: 0,
    memoryUsage: 0,
    tileLoadAvg: 0,
    visibleTiles: 0
  });
  
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  
  useEffect(() => {
    if (!enabled) return;
    
    let animationId;
    let metricsInterval;
    
    // FPS counter
    const countFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      
      if (delta >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / delta);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
        
        setMetrics(prev => ({ ...prev, fps }));
      }
      
      animationId = requestAnimationFrame(countFPS);
    };
    
    // Start FPS counter
    animationId = requestAnimationFrame(countFPS);
    
    // Memory and tile metrics
    metricsInterval = setInterval(() => {
      // Memory usage
      if (performance.memory) {
        const memoryMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
        setMetrics(prev => ({ ...prev, memoryUsage: parseFloat(memoryMB) }));
      }
      
      // Count visible tiles
      const tiles = document.querySelectorAll('.leaflet-tile-loaded');
      const vectorTileLayers = document.querySelectorAll('.leaflet-vg-container');
      setMetrics(prev => ({ 
        ...prev, 
        visibleTiles: tiles.length + vectorTileLayers.length 
      }));
    }, 2000);
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (metricsInterval) clearInterval(metricsInterval);
    };
  }, [enabled]);
  
  return metrics;
}
