const DB_NAME = "infinite-canvas";
const STORE_NAME = "images";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB."));
  });
  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export function isIdbImageRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("idb:");
}

export function imageIdFromRef(ref: string): string | null {
  return isIdbImageRef(ref) ? ref.slice(4) : null;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image data."));
    reader.readAsDataURL(blob);
  });
}

export async function putImage(blob: Blob): Promise<string> {
  const db = await openDatabase();
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  const transaction = db.transaction(STORE_NAME, "readwrite");
  await requestResult(transaction.objectStore(STORE_NAME).put(blob, id));
  return id;
}

/**
 * Stores an image and returns a reference. Falls back to an inline data URL
 * when IndexedDB is unavailable or over quota, so editing still works.
 */
export async function storeImage(blob: Blob): Promise<string> {
  try {
    const id = await putImage(blob);
    return `idb:${id}`;
  } catch {
    return blobToDataUrl(blob);
  }
}

export async function getImageBlob(refOrId: string): Promise<Blob | null> {
  const id = imageIdFromRef(refOrId) ?? refOrId;
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, "readonly");
    const value = await requestResult(transaction.objectStore(STORE_NAME).get(id));
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

export async function deleteImage(refOrId: string): Promise<void> {
  const id = imageIdFromRef(refOrId) ?? refOrId;
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  await requestResult(transaction.objectStore(STORE_NAME).delete(id));
}

/** Deletes stored images not referenced by the current canvas. */
export async function pruneImages(keepRefs: Iterable<string>): Promise<number> {
  const keep = new Set<string>();
  for (const ref of keepRefs) {
    const id = imageIdFromRef(ref);
    if (id) keep.add(id);
  }
  try {
    const db = await openDatabase();
    // Read keys in their own transaction: a transaction auto-commits when we
    // await between requests, so deleting inside the same one is unreliable.
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not list images."));
    });
    const orphaned = keys.filter((key): key is string => typeof key === "string" && !keep.has(key));
    if (orphaned.length === 0) return 0;

    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    for (const key of orphaned) store.delete(key);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    return orphaned.length;
  } catch {
    return 0;
  }
}
