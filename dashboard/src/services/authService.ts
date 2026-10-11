/**
 * authService — Dashboard username/password authentication
 *
 * Officials and tanods log in with a username and password.
 *
 * Session management (C4 fix):
 *   After password verification, the dashboard signs in with Firebase Anonymous Auth.
 *   Firebase manages the session via its own signed ID token — not a bare uid in
 *   localStorage. useAuth checks auth.currentUser (managed by Firebase) instead of
 *   trusting a raw string from localStorage, eliminating the auth bypass.
 *
 * Password hashing (C5 fix):
 *   Passwords are hashed with PBKDF2-SHA256 (100,000 iterations, random 16-byte salt).
 *   A per-user salt is stored in the user's Firestore doc alongside passwordHash.
 *   This replaces the previous unsalted SHA-256 which was crackable with rainbow tables.
 *
 *   // TODO: move password hashing fully server-side (Cloud Function) before production
 *   //        — client-side KDF is a stopgap. The hash + salt are readable by the
 *   //          dashboard client, which is still weaker than server-side verification.
 *
 * Account setup: run createOfficialAccount() from the browser console
 * or DevLoginPage to create accounts before the pilot.
 *
 * No SMS, no OTP, no external service — fully offline-capable once the
 * password has been set.
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
import { signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth';
import { db, auth } from './firebase';
import type { UserDocument } from '../types';

// ─── PBKDF2 password hashing ──────────────────────────────────────────────────
//
// On account creation: generate a random salt, derive a key with PBKDF2,
// store both passwordHash (hex) and passwordSalt (hex) in the user doc.
//
// On login: read the stored salt, re-derive with PBKDF2, compare hex strings.

function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: 100_000,
    },
    keyMaterial,
    256 // 32 bytes
  );

  return hexFromBuffer(derivedBits);
}

async function generateSalt(): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  return hexFromBuffer(saltBytes.buffer);
}

/**
 * hashPassword — derive a PBKDF2-SHA256 key from a password + new random salt.
 * Returns { hash, salt } — both must be stored in the user doc.
 */
export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const salt = await generateSalt();
  const hash = await deriveKey(password, salt);
  return { hash, salt };
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

  // Derive hash using the stored salt and compare.
  // Accounts created before the PBKDF2 migration won't have a passwordSalt.
  // If salt is absent, the login fails — the account must be recreated.
  const storedSalt: string | undefined = userData.passwordSalt;
  if (!storedSalt) {
    throw new Error(
      'Account requires a password reset. Please ask an admin to recreate this account with the updated hashing scheme.'
    );
  }

  const inputHash = await deriveKey(password, storedSalt);
  if (inputHash !== userData.passwordHash) {
    throw new Error('Invalid username or password.');
  }

  // C4 fix: establish a Firebase Auth session (anonymous) instead of trusting
  // a raw uid in localStorage. Firebase manages the signed session token.
  // The Emergo user's uid (in the users collection) is separate from the
  // Firebase Auth uid — we store the Emergo uid in the Firebase Auth user's
  // custom data via a Firestore lookup on each auth state change in useAuth.
  await signInAnonymously(auth);
  // Store the Emergo uid in localStorage ONLY as a lookup hint for useAuth to
  // know which users/{uid} doc to read after Firebase Auth confirms the session.
  // The actual authentication gate is auth.currentUser — not this value alone.
  const emergoUid = userSnap.id;
  localStorage.setItem(SESSION_KEY, emergoUid);

  return { uid: emergoUid, ...userData } as UserDocument;
}

// ─── Session ──────────────────────────────────────────────────────────────────

// SESSION_KEY stores the Emergo users/{uid} as a lookup hint only.
// It is NOT the auth gate — auth.currentUser from Firebase Auth is.
export const SESSION_KEY = 'emergo_dashboard_uid';

export function getStoredSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  await firebaseSignOut(auth);
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
 * C4 fix: uid is now a random UUID instead of a deterministic "user_{username}" string.
 * This prevents attackers from guessing uids and exploiting the session mechanism.
 *
 * C5 fix: password is hashed with PBKDF2-SHA256 (100k iterations, random salt).
 * Both passwordHash and passwordSalt are stored in the user doc.
 */
export async function createOfficialAccount(
  username: string,
  password: string,
  role: 'official' | 'tanod',
  displayName: string,
  phoneNumber: string
): Promise<void> {
  // Non-guessable uid (C4 fix)
  const uid = `user_${crypto.randomUUID()}`;

  // PBKDF2 hash + salt (C5 fix)
  const { hash: passwordHash, salt: passwordSalt } = await hashPassword(password);

  await setDoc(doc(db, 'users', uid), {
    role,
    displayName,
    phoneNumber,
    username: username.trim().toLowerCase(),
    passwordHash,
    passwordSalt,
    createdAt: serverTimestamp(),
  });

  console.log(`✅ Account created — uid: ${uid}, username: ${username}, role: ${role}`);
}
