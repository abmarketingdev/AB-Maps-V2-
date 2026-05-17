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
    // Creating web worker for clustering
    // Build robust candidates (try absolute root first for CRA dev/prod)
    const base = (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL) || (document.baseURI || window.location.origin);
    const baseClean = base.replace(/\/$/, '');
    const publicUrl = process.env.PUBLIC_URL || '';
    const candidates = [
      `${publicUrl}/workers/cluster.worker.js`,  // Production with PUBLIC_URL
      '/manager/workers/cluster.worker.js',      // Production fallback
      '/workers/cluster.worker.js',              // Local development
      `${window.location.origin}/workers/cluster.worker.js`,
      `${baseClean}/workers/cluster.worker.js`,
    ];

    let w;
    let lastErr = null;
    for (const url of candidates) {
      try {
        // try worker path
        w = new Worker(url);
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!w) {
      return () => {};
    }
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
    
    return () => {
      w.removeEventListener('message', onMessage);
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const buildIndexes = (addresses, uploaded) => {
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
