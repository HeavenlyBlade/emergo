/**
 * authService — Dashboard session management
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserDocument, UserRole } from '../types';

const SESSION_KEY = 'emergo_dashboard_uid';
const SMS_GATEWAY_URL = 'https://api.sms-gate.app/3rdparty/v1/message';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtp(phoneNumber: string): Promise<void> {
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  const otpRef = doc(db, 'otp_codes', phoneNumber.replace(/\+/g, ''));
  await setDoc(otpRef, {
    code,
    phoneNumber,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: serverTimestamp(),
  });

  const user = import.meta.env.VITE_SMS_GATEWAY_USER;
  const pass = import.meta.env.VITE_SMS_GATEWAY_PASS;
  const credentials = btoa(`${user}:${pass}`);

  await fetch(SMS_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      textMessage: {
        text: `Your Emergo dashboard code is: ${code}\n\nExpires in 10 minutes.`,
      },
      phoneNumbers: [phoneNumber],
    }),
  });
}

export async function confirmOtp(
  phoneNumber: string,
  code: string
): Promise<UserDocument> {
  const otpRef = doc(db, 'otp_codes', phoneNumber.replace(/\+/g, ''));
  const snap = await getDoc(otpRef);

  if (!snap.exists()) throw new Error('Code not found. Please request a new one.');

  const data = snap.data();
  const now = new Date();
  const expiresAt = (data.expiresAt as Timestamp).toDate();

  if (now > expiresAt) {
    await deleteDoc(otpRef);
    throw new Error('Code expired. Please request a new one.');
  }

  if (data.code !== code.trim()) {
    throw new Error('Incorrect code. Please try again.');
  }

  await deleteDoc(otpRef);

  const uid = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      role: 'resident' as UserRole,
      displayName: '',
      phoneNumber,
      createdAt: serverTimestamp(),
    });
  }

  localStorage.setItem(SESSION_KEY, uid);
  const finalSnap = await getDoc(userRef);
  return { uid, ...finalSnap.data() } as UserDocument;
}

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
