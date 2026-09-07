/**
 * authService — Custom Phone Auth using SMS API PH + Firestore
 *
 * Since we're not using Firebase Auth, we manage sessions ourselves
 * using AsyncStorage. A "session" is just the user's uid stored locally.
 *
 * Flow:
 *   1. sendOtp(phoneNumber)          → generates + sends OTP via smsService
 *   2. confirmOtp(phone, code)       → verifies OTP, creates/loads user doc,
 *                                      saves session to AsyncStorage
 *   3. saveDisplayName(uid, name)    → updates users/{uid}.displayName
 *   4. signOut()                     → clears AsyncStorage session
 *   5. getStoredSession()            → returns stored uid or null (for app launch)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateAndSendOtp, verifyOtp } from './otpService';
import { UserDocument, UserRole } from '../types';

const SESSION_KEY = 'emergo_user_uid';

// ─── OTP ─────────────────────────────────────────────────────────────────────

export async function sendOtp(phoneNumber: string): Promise<void> {
  await generateAndSendOtp(phoneNumber);
}

export async function confirmOtp(
  phoneNumber: string,
  code: string
): Promise<UserDocument> {
  const isValid = await verifyOtp(phoneNumber, code);
  if (!isValid) {
    throw new Error('Invalid or expired verification code. Please try again.');
  }

  // Use phone number as uid (normalized: strip +)
  const uid = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');

  // Create users/{uid} on first login with role: 'resident' by default
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const newUser: Omit<UserDocument, 'uid'> = {
      role: 'resident' as UserRole,
      displayName: '',
      phoneNumber,
      createdAt: serverTimestamp() as any,
    };
    await setDoc(userRef, newUser);
  }

  // Persist session locally
  await AsyncStorage.setItem(SESSION_KEY, uid);

  const snap = await getDoc(userRef);
  return { uid, ...snap.data() } as UserDocument;
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

// ─── Session ──────────────────────────────────────────────────────────────────

export async function getStoredSession(): Promise<string | null> {
  return await AsyncStorage.getItem(SESSION_KEY);
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
