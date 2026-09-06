/**
 * Firebase configuration and initialization
 *
 * Uses the Firebase JS SDK (v11) — pure JavaScript, no native modules needed.
 * Credentials come from google-services.json (Android) — never hardcode these
 * in source control. This file reads from constants derived from that file.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
// @firebase/auth exposes getReactNativePersistence for React Native environments
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getReactNativePersistence } = require('@firebase/auth');
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAVuho32VquGJoVRO48bpoNOR1AE55qoDk',
  authDomain: 'emergo-31db1.firebaseapp.com',
  projectId: 'emergo-31db1',
  storageBucket: 'emergo-31db1.firebasestorage.app',
  messagingSenderId: '867278178273',
  appId: '1:867278178273:android:ff194d204e2d442b3234a0',
};

export { firebaseConfig };

// Prevent re-initialization on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth with AsyncStorage persistence so users stay logged in between app restarts
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getFirestore(app);

export default app;
