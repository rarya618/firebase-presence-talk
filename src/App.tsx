import { useEffect, useState } from 'react'
import { goOffline, goOnline } from 'firebase/database'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { QRCodeSVG } from 'qrcode.react'
import { auth, db } from './firebase'
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

// The name lives in sessionStorage next to the (per-tab) anonymous user,
// so a reload keeps both.
function sessionValue(key: string, create: () => string) {
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const value = create()
  sessionStorage.setItem(key, value)
  return value
}

function App() {
  const [uid, setUid] = useState<string | null>(null)
  const [name] = useState(() => sessionValue('presence-name', randomName))
  const [connected, setConnected] = useState(false)
  const [entries, setEntries] = useState<PresenceEntry[]>([])

  // Sign in anonymously: no UI, but the uid lets the rules make sure each
  // person can only write their own /presence entry.
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (user) setUid(user.uid)
        else void signInAnonymously(auth)
      }),
    [],
  )

  useEffect(() => (uid ? trackPresence(uid, name) : undefined), [uid, name])

  useEffect(() => subscribeToPresence(setEntries), [])

  useEffect(() => subscribeToConnectionState(setConnected), [])

  // One dot per online user. Each tab is its own anonymous user, so this is
  // one per device, and stuffing fake connections into your own entry still
  // only counts once.
  const devices = entries
    .filter((entry) => entry.connections > 0)
    .map((entry) => ({ key: entry.id, mine: entry.id === uid }))
  const shareUrl = window.location.origin

  return (
    <main>
      <section className="count">
        {/* Keyed on the count so the pop animation replays on every change. */}
        <div key={devices.length} className="number">
          {devices.length}
        </div>
        <div className="label">
          {devices.length === 1 ? 'device connected' : 'devices connected'}
        </div>

        <div className="devices">
          {devices.map((device) => (
            <span
              key={device.key}
              className={`dot online${device.mine ? ' mine' : ''}`}
            />
          ))}
        </div>

        <div className="me">
          <span className={`dot ${connected ? 'online' : 'offline'}`} />
          <span>
            <strong>{name}</strong>
            <span className="muted">
              {connected ? ' · connected' : ' · disconnected'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => (connected ? goOffline(db) : goOnline(db))}
          >
            {connected ? 'Go offline' : 'Go online'}
          </button>
        </div>
      </section>

      <section className="join">
        <div className="qr">
          <QRCodeSVG value={shareUrl} size={512} marginSize={2} />
        </div>
        <div className="muted">{shareUrl.replace(/^https?:\/\//, '')}</div>
      </section>
    </main>
  )
}

export default App
