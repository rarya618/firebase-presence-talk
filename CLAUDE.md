# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Demo app for a conference talk on Firebase Realtime Database presence. Code is shown on stage, so favor short, readable code over abstraction; `src/presence.ts` is the centerpiece and its comments double as talk notes.

## Commands

- `npm run dev` — Vite dev server against the real Firebase project configured in `.env.local`. The Firebase emulators are deliberately not used; don't reintroduce them.
- `npm run build` — `tsc -b` type-check, then Vite build to `dist/`.
- `npm run lint` — oxlint (config in `.oxlintrc.json`, not ESLint).
- `npm run deploy` — build, then deploy Hosting, database rules, and Auth provider config (`auth` in `firebase.json`) to the project in `.firebaserc` (`presence-talk-demo`).

There is no test suite.

## Architecture

- `src/firebase.ts` initializes the app from `VITE_FIREBASE_*` env vars (template in `.env.example`; real values in gitignored `.env.local`).
- Identity is Firebase Anonymous Auth with `browserSessionPersistence` (`src/firebase.ts`): no sign-in UI, each tab is a distinct "person" for demoing from one machine, and reloads keep the same uid instead of leaving stale entries. The display name sits beside it in `sessionStorage` (`src/App.tsx`). Auth exists so an audience can't delete or overwrite each other's entries.
- `src/presence.ts` implements the multi-connection presence pattern. Data shape:
  `/presence/{id} = { name, lastOnline, connections: { <pushId>: { startedAt, lastSeen } } }`.
  A user is online iff some connection's `lastSeen` (heartbeat every 5s) is under 15s old; `onDisconnect` removes connections, the heartbeat bounds how long a silent socket (Wi-Fi off, lid closed) lingers before the server times it out. Invariants to preserve when editing:
  - `onDisconnect` handlers are re-armed inside the `.info/connected` listener on every reconnect (they're bound to one socket).
  - `onDisconnect` is armed *before* writing the connection node, so there's never an online entry without pending cleanup.
  - The heartbeat interval is cleared on every `.info/connected` flip, so queued beats can't revive a connection `onDisconnect` already removed (the rules' `hasChildren` check also rejects a bare `lastSeen`).
  - The `stopped` flag guards against React StrictMode's double-mount writing a ghost connection after cleanup.
- `database.rules.json`: `/presence` is world-readable; `/presence/{id}` is writable only when `auth.uid === id`. `.validate` rules enforce the data shape above and reject unknown keys. Update the rules alongside any data-shape change.
- `src/App.tsx` wires it together; "Go offline" uses `goOffline(db)` to demo disconnect without killing Wi-Fi. Hiding the page (`visibilitychange`) also calls `goOffline(db)` as a client-side speed-up; server-side `onDisconnect` stays the backstop for crashes and dead networks, so don't move cleanup logic into the client. While offline, a client keeps showing itself online (local writes) while everyone else goes stale and drops after 15s — that's expected and a talk point.
