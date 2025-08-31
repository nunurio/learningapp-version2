"use client";

// 極小の IndexedDB ヘルパ（依存なし）
// DB: learnify_idb / stores: drafts

const DB_NAME = "learnify_idb";
const DB_VERSION = 1;

type DraftRow = {
  key: string; // `card:<cardId>`
  cardId: string;
  cardType: "text" | "quiz" | "fill-blank";
  title?: string | null;
  data: unknown;
  updatedAt: string; // ISO
};

export type { DraftRow };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("drafts")) {
        db.createObjectStore("drafts", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function draftsPut(row: DraftRow): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("drafts").put(row);
  });
}

export async function draftsGet(key: string): Promise<DraftRow | undefined> {
  const db = await openDB();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly");
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore("drafts").get(key);
    req.onsuccess = () => resolve(req.result as DraftRow | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function draftsDelete(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("drafts").delete(key);
  });
}
