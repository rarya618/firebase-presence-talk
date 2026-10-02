# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Demo app for a conference talk on Firebase Realtime Database presence. Code is shown on stage, so favor short, readable code over abstraction; `src/presence.ts` is the centerpiece and its comments double as talk notes.

## Commands

- `npm run dev` — Vite dev server against the real Firebase project configured in `.env.local`. The Firebase emulators are deliberately not used; don't reintroduce them.
- `npm run build` — `tsc -b` type-check, then Vite build to `dist/`.
- `npm run lint` — oxlint (config in `.oxlintrc.json`, not ESLint).
- `npm run deploy` — build, then deploy Hosting + database rules to the active Firebase project. There's no `.firebaserc` yet; `npx firebase use --add` creates it.

There is no test suite.

## Architecture

- `src/firebase.ts` initializes the app from `VITE_FIREBASE_*` env vars (template in `.env.example`; real values in gitignored `.env.local`).
- No Firebase Auth (deliberately). Identity is a random ID + name kept in `sessionStorage` (`src/App.tsx`), so each tab is a distinct "person" for demoing from one machine and reloads don't leave stale entries.
- `src/presence.ts` implements the multi-connection presence pattern. Data shape:
  `/presence/{id} = { name, lastOnline, connections: { <pushId>: { startedAt } } }`.
  A user is online iff `connections` is non-empty. Invariants to preserve when editing:
  - `onDisconnect` handlers are re-armed inside the `.info/connected` listener on every reconnect (they're bound to one socket).
  - `onDisconnect` is armed *before* writing the connection node, so there's never an online entry without pending cleanup.
  - The `stopped` flag guards against React StrictMode's double-mount writing a ghost connection after cleanup.
- `database.rules.json`: with no auth, `/presence` is world-readable and world-writable; `.validate` rules enforce the data shape above and reject unknown keys. Update the rules alongside any data-shape change.
- `src/App.tsx` wires it together; "Go offline" uses `goOffline(db)` to demo disconnect without killing Wi-Fi. While offline, a client's own list is stale (local cache) — that's expected and a talk point.

## Git workflow

Never commit automatically. When a change is done, send a list of what changed and end with a suggested commit message, written after checking `git log` so it matches the existing history's style.
