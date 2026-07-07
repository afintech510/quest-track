const DB_NAME = 'questtrack';
const DB_VERSION = 1;
const CACHE_STORE = 'stateCache';
const MUTATION_STORE = 'mutationQueue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'tableName' });
      }
      if (!db.objectStoreNames.contains(MUTATION_STORE)) {
        db.createObjectStore(MUTATION_STORE, { keyPath: 'mutation_id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheState(tableName, rows) {
  const db = await openDB();
  const store = db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE);
  await reqToPromise(store.put({ tableName, rows, updatedAt: Date.now() }));
}

export async function getCachedState(tableName) {
  const db = await openDB();
  const store = db.transaction(CACHE_STORE).objectStore(CACHE_STORE);
  const result = await reqToPromise(store.get(tableName));
  return result?.rows ?? [];
}

export async function queueMutation(mutation) {
  const db = await openDB();
  const store = db.transaction(MUTATION_STORE, 'readwrite').objectStore(MUTATION_STORE);
  await reqToPromise(store.put({
    ...mutation,
    mutation_id: mutation.mutation_id || crypto.randomUUID(),
    queued_at: Date.now(),
  }));
}

export async function getPendingMutations() {
  const db = await openDB();
  const store = db.transaction(MUTATION_STORE).objectStore(MUTATION_STORE);
  return reqToPromise(store.getAll());
}

export async function clearMutation(mutation_id) {
  const db = await openDB();
  const store = db.transaction(MUTATION_STORE, 'readwrite').objectStore(MUTATION_STORE);
  await reqToPromise(store.delete(mutation_id));
}

export async function getPendingCount() {
  const db = await openDB();
  const store = db.transaction(MUTATION_STORE).objectStore(MUTATION_STORE);
  return reqToPromise(store.count());
}
