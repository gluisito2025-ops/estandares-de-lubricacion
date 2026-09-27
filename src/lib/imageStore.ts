const DB_NAME = 'estandares-lubricacion'
const DB_VERSION = 1
const STORE = 'images'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

const memoryCache = new Map<string, string>()

export function peekImage(id: string): string | undefined {
  return memoryCache.get(id)
}

export async function putImage(id: string, dataUrl: string): Promise<void> {
  memoryCache.set(id, dataUrl)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(dataUrl, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getImage(id: string): Promise<string | undefined> {
  const cached = memoryCache.get(id)
  if (cached) return cached
  const db = await openDb()
  const value = await new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(id)
    request.onsuccess = () => resolve(request.result as string | undefined)
    request.onerror = () => reject(request.error)
  })
  if (value) memoryCache.set(id, value)
  return value
}

export async function loadImages(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const found = await Promise.all(unique.map(async (id) => [id, await getImage(id)] as const))
  const result: Record<string, string> = {}
  for (const [id, value] of found) if (value) result[id] = value
  return result
}

export async function deleteImages(ids: string[]): Promise<void> {
  for (const id of ids) memoryCache.delete(id)
  if (!ids.length) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const id of ids) store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}
