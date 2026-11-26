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
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db, ensureAnonymousAuth } from './firebase';
import { generateAndSendOtp, verifyOtp } from './otpService';
import { hashPassword, verifyPassword } from '../utils/passwordUtils';
import { UserDocument, UserRole } from '../types';

const SESSION_KEY = 'emergo_user_uid';

// ─── OTP ─────────────────────────────────────────────────────────────────────

export async function sendOtp(phoneNumber: string): Promise<void> {
  await ensureAnonymousAuth();
  await generateAndSendOtp(phoneNumber);
}

export async function confirmOtp(
  phoneNumber: string,
  code: string
): Promise<UserDocument> {
  // Retry auth here — by the time OTP is verified, the network is confirmed
  // working (the OTP SMS was received), so this retry is likely to succeed
  // even if the initial ensureAnonymousAuth call in sendOtp failed.
  await ensureAnonymousAuth();
  const isValid = await verifyOtp(phoneNumber, code);
  if (!isValid) {
    throw new Error('Invalid or expired verification code. Please try again.');
  }

  // Use phone number as uid (normalized: strip +)
  const phoneUid = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');

  // Check by phoneUid first, then fallback to querying by phoneNumber
  // (dashboard-created responder/official accounts use user_<username> as doc ID)
  let uid = phoneUid;
  let userRef = doc(db, 'users', uid);
  let userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const q = query(
      collection(db, 'users'),
      where('phoneNumber', '==', phoneNumber),
      limit(1)
    );
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      uid = qSnap.docs[0].id;
      userRef = doc(db, 'users', uid);
      userSnap = qSnap.docs[0];
    }
  }

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

// ─── Password Login & Profile ─────────────────────────────────────────────────

export async function signInWithPhonePassword(
  phoneNumber: string,
  password: string
): Promise<UserDocument> {
  await ensureAnonymousAuth();
  const phoneUid = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');

  let uid = phoneUid;
  let userRef = doc(db, 'users', uid);
  let userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const q = query(
      collection(db, 'users'),
      where('phoneNumber', '==', phoneNumber),
      limit(1)
    );
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      uid = qSnap.docs[0].id;
      userRef = doc(db, 'users', uid);
      userSnap = qSnap.docs[0];
    }
  }

  if (!userSnap.exists()) {
    throw new Error('No account found for this number. Please register first.');
  }

  const userData = userSnap.data();
  if (!userData.passwordHash || !userData.passwordSalt) {
    if (userData.role === 'resident') {
      throw new Error('No password set for this account. Tap "Forgot password?" to set one via SMS.');
    }
    throw new Error('Account has no password set. Ask an official or admin to reset it.');
  }

  const valid = await verifyPassword(password, userData.passwordHash, userData.passwordSalt);
  if (!valid) {
    throw new Error('Incorrect phone number or password.');
  }

  await AsyncStorage.setItem(SESSION_KEY, uid);
  return { uid, ...userData } as UserDocument;
}

export async function saveProfileAndPassword(
  uid: string,
  displayName: string,
  password: string
): Promise<void> {
  await ensureAnonymousAuth();
  const { hash, salt } = await hashPassword(password);
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    displayName: displayName.trim(),
    passwordHash: hash,
    passwordSalt: salt,
  });
}

export async function resetPassword(
  uid: string,
  password: string
): Promise<void> {
  await ensureAnonymousAuth();
  const { hash, salt } = await hashPassword(password);
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    passwordHash: hash,
    passwordSalt: salt,
  });
}

export async function saveDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  await ensureAnonymousAuth();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { displayName: displayName.trim() });
}

export async function getUserRoleByPhone(phoneNumber: string): Promise<UserRole | null> {
  await ensureAnonymousAuth();
  const phoneUid = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
  const snap = await getDoc(doc(db, 'users', phoneUid));
  if (snap.exists()) return (snap.data().role as UserRole) ?? null;

  const q = query(collection(db, 'users'), where('phoneNumber', '==', phoneNumber), limit(1));
  const qSnap = await getDocs(q);
  if (!qSnap.empty) return (qSnap.docs[0].data().role as UserRole) ?? null;
  return null;
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  await ensureAnonymousAuth();
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

/**
 * Checks if a Firestore user document exists for the given phone number.
 * Used by the Sign In tab to prevent creating new accounts.
 * uid is derived the same way confirmOtp derives it: strip '+' and spaces.
 */
export async function checkUserExists(phoneNumber: string): Promise<boolean> {
  await ensureAnonymousAuth();
  const uid = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) return true;

  // Fallback: check dashboard-created responder/official accounts by phoneNumber
  const q = query(
    collection(db, 'users'),
    where('phoneNumber', '==', phoneNumber),
    limit(1)
  );
  const qSnap = await getDocs(q);
  return !qSnap.empty;
}

// ─── Push token registration ───────────────────────────────────────────────

/**
 * Called after user doc loads in useAuth.
 * Registers push token for residents, officials, tanods, and responders.
 */
export async function registerPushTokenIfNeeded(
  uid: string,
  role: string
): Promise<void> {
  if (role === 'resident' || role === 'official' || role === 'tanod' || role === 'responder') {
    const { registerPushToken } = await import('./notificationService');
    await registerPushToken(uid);
  }
}
