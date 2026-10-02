import { initializeApp } from 'firebase/app'
import { browserSessionPersistence, initializeAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const db = getDatabase(app)

// Session persistence keeps the anonymous user per tab, so each tab is still
// its own person, and a reload signs back in as the same user.
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
})
