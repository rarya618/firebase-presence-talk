import { useEffect, useState } from 'react'
import { goOffline, goOnline } from 'firebase/database'
import { db } from './firebase'
import {
  type PresenceEntry,
  subscribeToConnectionState,
  subscribeToPresence,
  trackPresence,
} from './presence'

const ADJECTIVES = ['Swift', 'Quiet', 'Brave', 'Lucky', 'Sunny', 'Clever']
const ANIMALS = ['Otter', 'Falcon', 'Panda', 'Lynx', 'Koala', 'Heron']

function randomName() {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
}

function timeAgo(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.round(minutes / 60)}h ago`
}

// sessionStorage is per tab, so every tab is a separate person, and a
// reload keeps the same identity instead of leaving a stale entry behind.
function sessionValue(key: string, create: () => string) {
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const value = create()
  sessionStorage.setItem(key, value)
  return value
}

function App() {
  const [id] = useState(() => sessionValue('presence-id', () => crypto.randomUUID()))
  const [name] = useState(() => sessionValue('presence-name', randomName))
  const [connected, setConnected] = useState(false)
  const [entries, setEntries] = useState<PresenceEntry[]>([])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => trackPresence(id, name), [id, name])

  useEffect(() => subscribeToPresence(setEntries), [])

  useEffect(() => subscribeToConnectionState(setConnected), [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const sorted = [...entries].sort(
    (a, b) =>
      Number(b.connections > 0) - Number(a.connections > 0) ||
      (b.lastOnline ?? 0) - (a.lastOnline ?? 0),
  )
  const onlineCount = entries.filter((e) => e.connections > 0).length

  return (
    <main>
      <header>
        <h1>Who's here?</h1>
        <p className="muted">
          {onlineCount} online
        </p>
      </header>

      <section className="me">
        <span className={`dot ${connected ? 'online' : 'offline'}`} />
        <div>
          <strong>{name}</strong>
          <div className="muted">
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => (connected ? goOffline(db) : goOnline(db))}
        >
          {connected ? 'Go offline' : 'Go online'}
        </button>
      </section>

      <ul className="list">
        {sorted.map((entry) => {
          const online = entry.connections > 0
          return (
            <li key={entry.id}>
              <span className={`dot ${online ? 'online' : 'offline'}`} />
              <span className="name">
                {entry.name}
                {entry.id === id && <span className="muted"> (you)</span>}
              </span>
              <span className="muted">
                {online
                  ? entry.connections > 1
                    ? `${entry.connections} connections`
                    : 'online'
                  : entry.lastOnline
                    ? `last seen ${timeAgo(entry.lastOnline, now)}`
                    : 'offline'}
              </span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

export default App
