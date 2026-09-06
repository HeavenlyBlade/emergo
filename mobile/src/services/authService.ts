/**
 * authService — Firebase Phone Number Authentication
 *
 * All Firebase Auth calls live here.
 * Components never import from 'firebase/auth' directly.
 *
 * Flow:
 *   1. sendOtp(phoneNumber)              → returns ConfirmationResult
 *   2. confirmOtp(confirmation, otp)     → signs in, creates users/{uid} if first login
 *   3. saveDisplayName(uid, name)        → updates the user document
 *   4. signOut()                         → signs the user out
 */

import {
  signInWithPhoneNumber,
  ConfirmationResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserDocument, UserRole } from '../types';

// ─── OTP ─────────────────────────────────────────────────────────────────────

/**
 * Step 1: Send OTP to the given phone number.
 * Returns a ConfirmationResult — pass it to confirmOtp with the code.
 *
 * On Android, Firebase may auto-read the SMS code (SMS Retriever API).
 * The user will still see the OTP screen but the code may pre-fill.
 */
export async function sendOtp(phoneNumber: string): Promise<ConfirmationResult> {
  // signInWithPhoneNumber handles reCAPTCHA internally on React Native
  // No external verifier component needed in SDK 57+
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber);
  return confirmation;
}

/**
 * Step 2: Confirm the OTP code entered by the user.
 * Signs in and creates a Firestore user document if this is the first login.
 * Returns the signed-in Firebase User.
 */
export async function confirmOtp(
  confirmation: ConfirmationResult,
  otp: string
): Promise<User> {
  const result = await confirmation.confirm(otp);
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

/**
 * Save the user's display name after first login.
 */
export async function saveDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { displayName: displayName.trim() });
}

/**
 * Get the current user's Firestore document.
 */
export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserDocument;
}

// ─── Auth state ───────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}
