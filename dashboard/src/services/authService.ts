/**
 * authService — Dashboard username/password authentication
 *
 * Officials and tanods log in with a username and password.
 * Passwords are hashed client-side with SHA-256 before comparison.
 * No SMS, no OTP, no external service — fully offline-capable.
 *
 * Account setup: run createOfficialAccount() from the browser console
 * or DevLoginPage to create accounts before the pilot.
 *
 * Session: stored in localStorage as the user's uid.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserDocument } from '../types';

const SESSION_KEY = 'emergo_dashboard_uid';

// ─── Password hashing ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function signInWithCredentials(
  username: string,
  password: string
): Promise<UserDocument> {
  if (!username.trim() || !password.trim()) {
    throw new Error('Username and password are required.');
  }

  // Find user by username field
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username.trim().toLowerCase()));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('Invalid username or password.');
  }

  const userSnap = snap.docs[0];
  const userData = userSnap.data();

  // Only officials and tanods can log into the dashboard
  if (userData.role === 'resident') {
    throw new Error('This dashboard is for officials and tanods only.');
  }

  // Compare password hash
  const inputHash = await hashPassword(password);
  if (inputHash !== userData.passwordHash) {
    throw new Error('Invalid username or password.');
  }

  const uid = userSnap.id;
  localStorage.setItem(SESSION_KEY, uid);

  return { uid, ...userData } as UserDocument;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export function getStoredSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function signOut(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserDocument;
}

// ─── Account creation (admin utility) ────────────────────────────────────────

/**
 * createOfficialAccount — creates or updates an official/tanod account.
 *
 * Call this from the browser console at /dev-login or from DevLoginPage.
 * Example:
 *   await createOfficialAccount('brgy_captain', 'SecurePass123', 'official', 'Juan dela Cruz', '+639171234567')
 *
 * The uid is derived from the username so it's deterministic and easy to manage.
 */
export async function createOfficialAccount(
  username: string,
  password: string,
  role: 'official' | 'tanod',
  displayName: string,
  phoneNumber: string
): Promise<void> {
  const uid = `user_${username.trim().toLowerCase().replace(/\s+/g, '_')}`;
  const passwordHash = await hashPassword(password);

  await setDoc(doc(db, 'users', uid), {
    role,
    displayName,
    phoneNumber,
    username: username.trim().toLowerCase(),
    passwordHash,
    createdAt: serverTimestamp(),
  });

  console.log(`✅ Account created — uid: ${uid}, username: ${username}, role: ${role}`);
}
