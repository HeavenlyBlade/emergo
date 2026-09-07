/**
 * Firebase configuration and initialization
 *
 * Auth uses @react-native-firebase/auth — native module, properly supports
 * phone number OTP on Android without a DOM/browser reCAPTCHA.
 *
 * Firestore uses the Firebase JS SDK — pure JS, no native module needed.
 *
 * @react-native-firebase reads google-services.json automatically at build time,
 * so no manual config object is needed for auth.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAVuho32VquGJoVRO48bpoNOR1AE55qoDk',
  authDomain: 'emergo-31db1.firebaseapp.com',
  projectId: 'emergo-31db1',
  storageBucket: 'emergo-31db1.firebasestorage.app',
  messagingSenderId: '867278178273',
  appId: '1:867278178273:android:ff194d204e2d442b3234a0',
};

export { firebaseConfig };

// JS SDK app instance — used for Firestore only
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

export default app;
