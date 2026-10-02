import { useEffect, useState } from 'react'
import { goOffline, goOnline } from 'firebase/database'
import { QRCodeSVG } from 'qrcode.react'
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

  useEffect(() => trackPresence(id, name), [id, name])

  useEffect(() => subscribeToPresence(setEntries), [])

  useEffect(() => subscribeToConnectionState(setConnected), [])

  // One dot per open connection, i.e. per device that has the page open.
  const devices = entries.flatMap((entry) =>
    Array.from({ length: entry.connections }, (_, i) => ({
      key: `${entry.id}-${i}`,
      mine: entry.id === id,
    })),
  )
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
