# Firebase Presence

Demo app for a talk on building online/offline presence with the Firebase Realtime Database (`.info/connected` + `onDisconnect`). React + Vite + TypeScript.

## Setup

1. Create a Firebase project with **Realtime Database** enabled, and register a web app.
2. `npm install`
3. `npx firebase use --add` and select the project.
4. Copy `.env.example` to `.env.local` and fill in the web app config.

## Run

```sh
npm run dev   # http://localhost:5173
```

Open several tabs: each tab is its own person. Use **Go offline** or close a tab to watch the server-side `onDisconnect` fire in the other tabs; the Realtime Database page in the Firebase console shows `/presence` changing live.

## Deploy

```sh
npm run deploy   # builds, then deploys Hosting and database rules
```
