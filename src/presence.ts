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

// The server only notices a silent socket (Wi-Fi off, lid closed) after a
// timeout of minutes. A heartbeat bounds that: viewers treat a connection as
// gone once its lastSeen is older than STALE_MS.
const HEARTBEAT_MS = 5_000
const STALE_MS = 15_000

/**
 * Marks this client as online under /presence/{id} for as long as it holds
 * a connection to the Realtime Database.
 *
 * Each connection gets its own child under `connections`, so a client with two
 * tabs (or a reconnecting socket) doesn't flip to offline when one goes away.
 * The user is online while `connections` has at least one fresh child.
 *
 * Returns a cleanup function that removes this client's connection.
 */
export function trackPresence(id: string, name: string): () => void {
  const userRef = ref(db, `presence/${id}`)
  const connectionsRef = child(userRef, 'connections')
  const lastOnlineRef = child(userRef, 'lastOnline')

  let current: DatabaseReference | null = null
  let stopped = false
  let heartbeat: ReturnType<typeof setInterval> | undefined

  // `.info/connected` is a client-local flag that flips to true every time
  // the SDK (re)establishes its socket. onDisconnect handlers are tied to a
  // single socket, so they must be re-armed on every reconnect.
  const unsubscribe = onValue(ref(db, '.info/connected'), async (snap) => {
    // Any flip means the old socket is gone. Stop beating for it: queued
    // beats would land after its onDisconnect already removed it.
    clearInterval(heartbeat)
    if (snap.val() !== true) return

    const connection = push(connectionsRef)
    current = connection

    // Arm the server-side cleanup *before* announcing ourselves, so there is
    // no window where we're marked online without a pending disconnect.
    await onDisconnect(connection).remove()
    await onDisconnect(lastOnlineRef).set(serverTimestamp())

    if (stopped) return
    await update(userRef, { name })
    await set(connection, {
      startedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    })

    if (stopped || current !== connection) return
    heartbeat = setInterval(
      () => set(child(connection, 'lastSeen'), serverTimestamp()),
      HEARTBEAT_MS,
    )
  })

  return () => {
    stopped = true
    unsubscribe()
    clearInterval(heartbeat)
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
  connections?: Record<string, { lastSeen?: number }>
}

/**
 * Calls back with every presence entry, counting only connections that have
 * beaten within STALE_MS. Re-checks every second, since a connection can go
 * stale without any new data arriving.
 */
export function subscribeToPresence(
  callback: (entries: PresenceEntry[]) => void,
): () => void {
  let raw: Record<string, PresenceNode> = {}
  // Our clock vs the server's, so lastSeen (server time) compares fairly.
  let offset = 0

  const emit = () => {
    const now = Date.now() + offset
    const entries = Object.entries(raw).map(([id, node]) => ({
      id,
      name: node.name ?? 'Anonymous',
      connections: Object.values(node.connections ?? {}).filter(
        (c) => now - (c.lastSeen ?? 0) < STALE_MS,
      ).length,
      lastOnline: node.lastOnline ?? null,
    }))
    callback(entries)
  }

  const offsetRef = ref(db, '.info/serverTimeOffset')
  const unsubscribeOffset = onValue(offsetRef, (snap) => {
    offset = snap.val() ?? 0
  })
  const unsubscribePresence = onValue(ref(db, 'presence'), (snap) => {
    raw = snap.val() ?? {}
    emit()
  })
  const tick = setInterval(emit, 1_000)

  return () => {
    unsubscribeOffset()
    unsubscribePresence()
    clearInterval(tick)
  }
}

export function subscribeToConnectionState(
  callback: (connected: boolean) => void,
): () => void {
  return onValue(ref(db, '.info/connected'), (snap) => {
    callback(snap.val() === true)
  })
}
