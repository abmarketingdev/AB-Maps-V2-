import localforage from 'localforage';

localforage.config({
  name: 'ab-maps',
  storeName: 'ab_maps_data',
});

// Save data to IndexedDB
export const saveData = async (key, value) => {
  await localforage.setItem(key, value);
};

// Load data from IndexedDB
export const loadData = async (key) => {
  return await localforage.getItem(key);
};

// Remove data from IndexedDB
export const removeData = async (key) => {
  await localforage.removeItem(key);
};

// Sync queue for offline changes
export const addToSyncQueue = async (change) => {
  const queue = (await loadData('syncQueue')) || [];
  queue.push(change);
  await saveData('syncQueue', queue);
};

export const getSyncQueue = async () => {
  return (await loadData('syncQueue')) || [];
};

export const clearSyncQueue = async () => {
  await saveData('syncQueue', []);
}; 