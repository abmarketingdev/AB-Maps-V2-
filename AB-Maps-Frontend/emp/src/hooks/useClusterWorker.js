import { useEffect, useRef } from 'react';

/**
 * Hook to manage the cluster Web Worker lifecycle and messaging
 * 
 * Provides:
 * - buildIndexes(addresses, uploaded): Rebuilds both Supercluster indexes
 * - requestClusters(bbox, zoom): Returns Promise<{addresses, uploaded}> with cluster/single data
 * - requestExpansionZoom(which, cluster_id): Returns Promise<zoom> for cluster expansion
 */
export default function useClusterWorker() {
  const workerRef = useRef(null);
  const resolversRef = useRef(new Map()); // requestId -> resolve

  useEffect(() => {
    console.log('🔧 [WORKER DEBUG] Creating new Worker...');
    
    // Determine the correct worker path based on the current URL
    const currentPath = window.location.pathname;
    const workerPath = currentPath.startsWith('/emp') 
      ? '/emp/workers/cluster.worker.js'
      : '/workers/cluster.worker.js';
    
    
    const w = new Worker(workerPath);
    workerRef.current = w;
    
    const onMessage = ({ data }) => {
      // For CLUSTERS_RESULT and EXPANSION_ZOOM_RESULT we resolve all waiting promises of that type
      if (data.type === 'CLUSTERS_RESULT') {
        const r = resolversRef.current.get('CLUSTERS');
        if (r) { 
          r(data); 
          resolversRef.current.delete('CLUSTERS'); 
        }
      }
      if (data.type === 'EXPANSION_ZOOM_RESULT') {
        const r = resolversRef.current.get(`EXPZ:${data.which}:${data.cluster_id}`);
        if (r) { 
          r(data.zoom); 
          resolversRef.current.delete(`EXPZ:${data.which}:${data.cluster_id}`); 
        }
      }
    };
    
    w.addEventListener('message', onMessage);
    
    // Add error handler
    w.addEventListener('error', (error) => {
      console.error('❌ [WORKER DEBUG] Worker error:', error);
    });
    
    return () => {
      console.log('🧹 [WORKER DEBUG] Cleaning up worker...');
      w.removeEventListener('message', onMessage);
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const buildIndexes = (addresses, uploaded) => {
    console.log('🔧 [WORKER DEBUG] buildIndexes called with:', {
      addressesCount: addresses?.length || 0,
      uploadedCount: uploaded?.length || 0
    });
    workerRef.current?.postMessage({ type: 'BUILD', addresses, uploaded });
  };

  const requestClusters = (bbox, zoom) =>
    new Promise((resolve) => {
      resolversRef.current.set('CLUSTERS', resolve);
      workerRef.current?.postMessage({ type: 'CLUSTERS', bbox, zoom });
    });

  const requestExpansionZoom = (which, cluster_id) =>
    new Promise((resolve) => {
      resolversRef.current.set(`EXPZ:${which}:${cluster_id}`, resolve);
      workerRef.current?.postMessage({ type: 'EXPANSION_ZOOM', which, cluster_id });
    });

  return { buildIndexes, requestClusters, requestExpansionZoom };
}

