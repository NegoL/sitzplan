import { useEffect, useState } from 'preact/hooks'
import type { AppState } from './domain/types'

const DB = 'sitzplan'
const STORE = 'kv'
const KEY = 'state'

let state: AppState = { classes: [], rooms: [], plans: [] }
const listeners = new Set<() => void>()

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function persist() {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(state, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadState() {
  const db = await open()
  const saved = await new Promise<AppState | undefined>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  if (saved) state = saved
  // Ask the browser not to evict the data when storage runs low.
  void navigator.storage?.persist?.()
}

export const getState = () => state

function set(next: AppState) {
  state = next
  listeners.forEach((l) => l())
  persist().catch((e) => alert(`Speichern fehlgeschlagen: ${e}`))
}

/** Changes the state through a mutable copy and saves it on the device. */
export function update(change: (draft: AppState) => void) {
  const draft = structuredClone(state)
  change(draft)
  set(draft)
}

export function useAppState(): AppState {
  const [, rerender] = useState(0)
  useEffect(() => {
    const l = () => rerender((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  return state
}

export function backupJson(): string {
  return JSON.stringify({ app: 'sitzplan', version: 1, ...state })
}

/** Replaces everything with the content of a backup file. Throws if the file is not a backup. */
export function restoreBackup(json: string) {
  const data = JSON.parse(json)
  if (data?.app !== 'sitzplan' || ![data.classes, data.rooms, data.plans].every(Array.isArray)) {
    throw new Error('Keine Sitzplan-Sicherung')
  }
  set({ classes: data.classes, rooms: data.rooms, plans: data.plans })
}

export const uid = () => crypto.randomUUID()
