/* eslint-disable no-restricted-globals */
importScripts('https://cdn.jsdelivr.net/npm/supercluster@7.1.5/dist/supercluster.min.js');

let addressesIndex = null;
let uploadedIndex  = null;

const toFeatures = (arr = []) =>
  arr.map(p => ({
    type: 'Feature',
    properties: { ...p }, // keep id, sourceType, status, uploadedAddressData, etc.
    geometry: { type: 'Point', coordinates: [p.position.lng, p.position.lat] },
  }));

self.onmessage = (e) => {
  const { type } = e.data;

  if (type === 'BUILD') {
    const { addresses, uploaded } = e.data;
    const CLUSTER_OPTS = { radius: 40, maxZoom: 22 }; // finer radius, deeper uncluster
    addressesIndex = new Supercluster(CLUSTER_OPTS).load(toFeatures(addresses || []));
    uploadedIndex  = new Supercluster(CLUSTER_OPTS).load(toFeatures(uploaded  || []));
    return;
  }

  if (type === 'CLUSTERS') {
    const { bbox, zoom } = e.data;
    const z = Math.floor(zoom);

    const serialize = (idx) => (idx ? idx.getClusters(bbox, z) : []).map(f => {
      const props = f.properties || {};
      if (props.cluster) {
        return {
          cluster: true,
          cluster_id: props.cluster_id,
          point_count: props.point_count,
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1]
        };
      }
      const olat = props.__origLat ?? f.geometry.coordinates[1];
      const olng = props.__origLng ?? f.geometry.coordinates[0];
      return { cluster: false, lat: olat, lng: olng, props };
    });

    self.postMessage({
      type: 'CLUSTERS_RESULT',
      addresses: serialize(addressesIndex),
      uploaded:  serialize(uploadedIndex),
    });
    return;
  }

  if (type === 'EXPANSION_ZOOM') {
    const { which, cluster_id } = e.data; // which: 'addresses' | 'uploaded'
    const idx = which === 'addresses' ? addressesIndex : uploadedIndex;
    const zoom = idx ? idx.getClusterExpansionZoom(cluster_id) : null;
    self.postMessage({ type: 'EXPANSION_ZOOM_RESULT', which, cluster_id, zoom });
  }
};
