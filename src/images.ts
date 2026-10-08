// Player art (film posters, studio logo). Images live in IndexedDB rather than the
// localStorage save, which is too small for pictures; saves only hold their ids.

import { useEffect, useState } from 'react'

const DB = 'greenlit-images'
const STORE = 'images'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const cache = new Map<string, string>()
const listeners = new Set<() => void>()

export async function putImage(id: string, dataUrl: string) {
  cache.set(id, dataUrl)
  try {
    await tx('readwrite', (s) => s.put(dataUrl, id))
  } catch {
    // Storage unavailable: the image still shows for this session.
  }
  listeners.forEach((l) => l())
}

export async function getImage(id: string): Promise<string | undefined> {
  if (cache.has(id)) return cache.get(id)
  try {
    const url = await tx<string | undefined>('readonly', (s) => s.get(id))
    if (url) cache.set(id, url)
    return url
  } catch {
    return undefined
  }
}

export async function getImages(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const id of ids) {
    const url = await getImage(id)
    if (url) out[id] = url
  }
  return out
}

export function useImage(id: string | undefined): string | undefined {
  const [url, setUrl] = useState(() => (id ? cache.get(id) : undefined))
  useEffect(() => {
    let live = true
    const load = () => {
      if (id) getImage(id).then((u) => live && setUrl(u))
      else setUrl(undefined)
    }
    load()
    listeners.add(load)
    return () => {
      live = false
      listeners.delete(load)
    }
  }, [id])
  return url
}

// Crop to the target shape from the centre and shrink, so a phone photo becomes a small JPEG.
export async function processImage(file: File, width: number, height: number, type = 'image/jpeg'): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(width / bitmap.width, height / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h)
  return canvas.toDataURL(type, 0.82)
}

export const newImageId = () => crypto.randomUUID()
