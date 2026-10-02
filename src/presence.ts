import {
  type DatabaseReference,
  child,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database'
import { db } from './firebase'

/**
 * Marks this client as online under /presence/{id} for as long as it holds
 * a connection to the Realtime Database.
 *
 * Each connection gets its own child under `connections`, so a client with two
 * tabs (or a reconnecting socket) doesn't flip to offline when one goes away.
 * The user is online while `connections` has at least one child.
 *
 * Returns a cleanup function that removes this client's connection.
 */
export function trackPresence(id: string, name: string): () => void {
  const userRef = ref(db, `presence/${id}`)
  const connectionsRef = child(userRef, 'connections')
  const lastOnlineRef = child(userRef, 'lastOnline')

  let current: DatabaseReference | null = null
  let stopped = false

  // `.info/connected` is a client-local flag that flips to true every time
  // the SDK (re)establishes its socket. onDisconnect handlers are tied to a
  // single socket, so they must be re-armed on every reconnect.
  const unsubscribe = onValue(ref(db, '.info/connected'), async (snap) => {
    if (snap.val() !== true) return

    const connection = push(connectionsRef)
    current = connection

    // Arm the server-side cleanup *before* announcing ourselves, so there is
    // no window where we're marked online without a pending disconnect.
    await onDisconnect(connection).remove()
    await onDisconnect(lastOnlineRef).set(serverTimestamp())

    if (stopped) return
    await update(userRef, { name })
    await set(connection, { startedAt: serverTimestamp() })
  })

  return () => {
    stopped = true
    unsubscribe()
    if (current) {
      void remove(current)
      void set(lastOnlineRef, serverTimestamp())
    }
  }
}

export type PresenceEntry = {
  id: string
  name: string
  connections: number
  lastOnline: number | null
}

type PresenceNode = {
  name?: string
  lastOnline?: number
  connections?: Record<string, unknown>
}

export function subscribeToPresence(
  callback: (entries: PresenceEntry[]) => void,
): () => void {
  return onValue(ref(db, 'presence'), (snap) => {
    const raw = (snap.val() ?? {}) as Record<string, PresenceNode>
    const entries = Object.entries(raw).map(([id, node]) => ({
      id,
      name: node.name ?? 'Anonymous',
      connections: Object.keys(node.connections ?? {}).length,
      lastOnline: node.lastOnline ?? null,
    }))
    callback(entries)
  })
}

export function subscribeToConnectionState(
  callback: (connected: boolean) => void,
): () => void {
  return onValue(ref(db, '.info/connected'), (snap) => {
    callback(snap.val() === true)
  })
}
