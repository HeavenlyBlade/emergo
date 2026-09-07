/**
 * authService — Firebase Phone Number Authentication
 *
 * Uses @react-native-firebase/auth for phone OTP — the native module
 * handles SMS sending and verification without needing a browser/DOM.
 *
 * Firestore calls use the JS SDK via db from firebase.ts.
 *
 * Flow:
 *   1. sendOtp(phoneNumber)              → returns ConfirmationResult
 *   2. confirmOtp(confirmation, otp)     → signs in, creates users/{uid} if first login
 *   3. saveDisplayName(uid, name)        → updates the user document
 *   4. signOut()                         → signs the user out
 */

import {
  getAuth,
  signInWithPhoneNumber,
  signOut as rnfSignOut,
  onAuthStateChanged,
  type ConfirmationResult,
  type User,
} from '@react-native-firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { UserDocument, UserRole } from '../types';

const auth = getAuth();

// ─── OTP ─────────────────────────────────────────────────────────────────────

/**
 * Step 1: Send OTP to the given phone number.
 * Returns a ConfirmationResult — pass it to confirmOtp with the code.
 */
export async function sendOtp(phoneNumber: string): Promise<ConfirmationResult> {
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber);
  return confirmation;
}

/**
 * Step 2: Confirm the OTP code entered by the user.
 * Signs in and creates a Firestore user document if this is the first login.
 */
export async function confirmOtp(
  confirmation: ConfirmationResult,
  otp: string
): Promise<User> {
  const result = await confirmation.confirm(otp);
  if (!result) throw new Error('Confirmation failed');
  const user = result.user;

  // Create users/{uid} on first login with role: 'resident' by default
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const newUser: Omit<UserDocument, 'uid'> = {
      role: 'resident' as UserRole,
      displayName: '',
      phoneNumber: user.phoneNumber ?? '',
      createdAt: serverTimestamp() as any,
    };
    await setDoc(userRef, newUser);
  }

  return user;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function saveDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { displayName: displayName.trim() });
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserDocument;
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await rnfSignOut(auth);
}

export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
