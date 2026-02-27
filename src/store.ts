import type { ClothingItem, Outfit, Category, SavedOutfit } from './types';
import { EMPTY_OUTFIT } from './types';

const DB_NAME = 'wardrobe_db';
const DB_VERSION = 2;
const STORE_ITEMS = 'items';
const STORE_META = 'meta';
const STORE_SAVED = 'saved_outfits';

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_ITEMS)) {
        database.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_META)) {
        database.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(STORE_SAVED)) {
        database.createObjectStore(STORE_SAVED, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      db = request.result;
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

function tx(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest
): Promise<unknown> {
  return openDB().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(store, mode);
        const objectStore = transaction.objectStore(store);
        const request = fn(objectStore);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export async function getItems(): Promise<ClothingItem[]> {
  return tx(STORE_ITEMS, 'readonly', (s) => s.getAll()) as Promise<ClothingItem[]>;
}

export async function getItemsByCategory(category: Category): Promise<ClothingItem[]> {
  const all = await getItems();
  return all.filter((item) => item.category === category);
}

export async function addItem(item: ClothingItem): Promise<void> {
  await tx(STORE_ITEMS, 'readwrite', (s) => s.put(item));
}

export async function removeItem(id: string): Promise<void> {
  await tx(STORE_ITEMS, 'readwrite', (s) => s.delete(id));
}

export async function getOutfit(): Promise<Outfit> {
  const result = (await tx(STORE_META, 'readonly', (s) => s.get('outfit'))) as
    | { key: string; value: Outfit }
    | undefined;
  return result?.value ?? { ...EMPTY_OUTFIT };
}

export async function saveOutfit(outfit: Outfit): Promise<void> {
  await tx(STORE_META, 'readwrite', (s) => s.put({ key: 'outfit', value: outfit }));
}

export async function getSavedOutfits(): Promise<SavedOutfit[]> {
  return tx(STORE_SAVED, 'readonly', (s) => s.getAll()) as Promise<SavedOutfit[]>;
}

export async function addSavedOutfit(outfit: SavedOutfit): Promise<void> {
  await tx(STORE_SAVED, 'readwrite', (s) => s.put(outfit));
}

export async function removeSavedOutfit(id: string): Promise<void> {
  await tx(STORE_SAVED, 'readwrite', (s) => s.delete(id));
}
