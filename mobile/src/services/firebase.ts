/**
 * Firebase configuration and initialization
 *
 * Credentials come from .env (EXPO_PUBLIC_ prefix).
 * Firestore is the only service used — auth is custom OTP via SMS Gateway.
 * No Firebase Auth SDK is used on mobile; Firestore rules allow mobile
 * operations without auth tokens (see firestore.rules).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export default app;

// No-op — kept so existing callers don't need changes.
// Rules are now open for the operations the mobile app needs.
export async function ensureAnonymousAuth(): Promise<void> {}
