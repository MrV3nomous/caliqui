const DB_NAME = 'CaliquiAssetDB';
const ASSET_STORE = 'userAssets';
const WORKSPACE_STORE = 'workspace';
const WORKSPACE_DRAFT_KEY = 'current_draft';
const CHECKPOINT_KEY = 'remix_checkpoint';

// Upgraded to Version 2 to support the new workspace store
const DB_VERSION = 2;

export interface WorkspaceState {
  id: string; // Will always be 'current_draft' or 'remix_checkpoint'
  state: string; // The JSON stringified Zustand state
  timestamp: number;
}

export interface UserAsset {
  id: string;
  blob: Blob;
  aspectRatio: number;
  timestamp: number;
  isArchived?: boolean; // Optional to safely handle V1 records
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // V1 Store: Preserve existing user uploads completely untouched
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
        }

        // V2 Store: Local workspace drafts and checkpoints for large JSON payloads
        if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
          db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked. Please close other tabs of this app.');
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Handle structural database changes from other tabs/windows
        db.onversionchange = () => {
          db.close();
          if (dbPromise === promise) {
            dbPromise = null;
          }
        };

        // Handle catastrophic connection loss
        db.onclose = () => {
          if (dbPromise === promise) {
            dbPromise = null;
          }
        };

        resolve(db);
      };

      request.onerror = (event) => {
        if (dbPromise === promise) {
          dbPromise = null;
        }
        reject((event.target as IDBOpenDBRequest).error);
      };
    } catch (error) {
      if (dbPromise === promise) {
        dbPromise = null;
      }
      reject(error);
    }
  });

  dbPromise = promise;
  return promise;
}

function normalizeUserAsset(value: unknown): UserAsset | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.id !== 'string' || raw.id.trim() === '') return null;
  if (!(raw.blob instanceof Blob)) return null;

  let aspectRatio = 1;
  if (
    typeof raw.aspectRatio === 'number' &&
    Number.isFinite(raw.aspectRatio) &&
    raw.aspectRatio > 0
  ) {
    aspectRatio = raw.aspectRatio;
  }

  let timestamp = 0;
  if (typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)) {
    timestamp = raw.timestamp;
  }

  const isArchived = typeof raw.isArchived === 'boolean' ? raw.isArchived : false;

  return {
    id: raw.id,
    blob: raw.blob,
    aspectRatio,
    timestamp,
    isArchived,
  };
}

// ==========================================
// USER ASSET METHODS
// ==========================================

export async function saveAssetToDB(id: string, blob: Blob, aspectRatio: number): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(ASSET_STORE, 'readwrite');
      const store = transaction.objectStore(ASSET_STORE);

      // Explicitly set isArchived to false (reactivates an asset if replacing/re-saving)
      const putRequest = store.put({
        id,
        blob,
        aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1,
        timestamp: Date.now(),
        isArchived: false,
      });

      putRequest.onerror = () => reject(putRequest.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

export async function getAllAssetsFromDB(): Promise<UserAsset[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(ASSET_STORE, 'readonly');
      const store = transaction.objectStore(ASSET_STORE);
      const request = store.getAll();

      let results: UserAsset[] = [];

      request.onsuccess = () => {
        const rawResults = (request.result || []) as unknown[];

        results = rawResults
          .map(normalizeUserAsset)
          .filter((asset): asset is UserAsset => asset !== null && !asset.isArchived)
          .sort((a, b) => b.timestamp - a.timestamp);
      };

      request.onerror = () => reject(request.error);

      // Always resolve from oncomplete to guarantee full transaction boundary
      transaction.oncomplete = () => resolve(results);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Retrieves a specific asset by ID, regardless of its archived status.
 * Required for rehydrating older designs that reference assets no longer in the active dock.
 */
export async function getAssetByIdFromDB(id: string): Promise<UserAsset | null> {
  if (!id) return null;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(ASSET_STORE, 'readonly');
      const store = transaction.objectStore(ASSET_STORE);
      const request = store.get(id);

      let result: UserAsset | null = null;

      request.onsuccess = () => {
        result = normalizeUserAsset(request.result);
      };

      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Soft deletes an asset by marking it as archived.
 * This removes it from the active dock but preserves the blob for saved designs.
 */
export async function archiveAssetInDB(id: string): Promise<void> {
  if (!id) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(ASSET_STORE, 'readwrite');
      const store = transaction.objectStore(ASSET_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const asset = normalizeUserAsset(getRequest.result);
        if (asset) {
          asset.isArchived = true;
          const putRequest = store.put(asset);
          putRequest.onerror = () => reject(putRequest.error);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

export async function deleteAssetFromDB(id: string): Promise<void> {
  if (!id) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(ASSET_STORE, 'readwrite');
      const store = transaction.objectStore(ASSET_STORE);

      const request = store.delete(id);
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

// ==========================================
// WORKSPACE METHODS (V2 API)
// ==========================================

export async function saveWorkspaceToDB(stateJsonString: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
      const store = transaction.objectStore(WORKSPACE_STORE);

      const draft: WorkspaceState = {
        id: WORKSPACE_DRAFT_KEY,
        state: stateJsonString,
        timestamp: Date.now(),
      };

      const request = store.put(draft);
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

export async function loadWorkspaceFromDB(): Promise<string | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(WORKSPACE_STORE, 'readonly');
      const store = transaction.objectStore(WORKSPACE_STORE);
      const request = store.get(WORKSPACE_DRAFT_KEY);

      let result: string | null = null;

      request.onsuccess = () => {
        const data = request.result as WorkspaceState | undefined;
        if (data && typeof data.state === 'string') {
          result = data.state;
        }
      };

      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

export async function clearWorkspaceFromDB(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
      const store = transaction.objectStore(WORKSPACE_STORE);

      const request = store.delete(WORKSPACE_DRAFT_KEY);
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

// ==========================================
// CHECKPOINT METHODS
// ==========================================

export async function saveCheckpointToDB(stateJsonString: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
      const store = transaction.objectStore(WORKSPACE_STORE);

      const draft: WorkspaceState = {
        id: CHECKPOINT_KEY,
        state: stateJsonString,
        timestamp: Date.now(),
      };

      const request = store.put(draft);
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

export async function loadCheckpointFromDB(): Promise<string | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(WORKSPACE_STORE, 'readonly');
      const store = transaction.objectStore(WORKSPACE_STORE);
      const request = store.get(CHECKPOINT_KEY);

      let result: string | null = null;

      request.onsuccess = () => {
        const data = request.result as WorkspaceState | undefined;
        if (data && typeof data.state === 'string') {
          result = data.state;
        }
      };

      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}

export async function clearCheckpointFromDB(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
      const store = transaction.objectStore(WORKSPACE_STORE);

      const request = store.delete(CHECKPOINT_KEY);
      request.onerror = () => reject(request.error);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    } catch (e) {
      reject(e);
    }
  });
}
