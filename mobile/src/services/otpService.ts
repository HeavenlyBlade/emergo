/**
 * otpService — Custom OTP generation, storage, and verification
 *
 * Since we use a third-party SMS API (not Firebase Phone Auth),
 * we manage OTP state ourselves:
 *
 * 1. generateAndSendOtp(phoneNumber)
 *    - Generates a 6-digit code
 *    - Stores it in Firestore: otp_codes/{phoneNumber}
 *      with an expiry of 10 minutes and attempts = 0
 *    - Sends it via smsService
 *
 * 2. verifyOtp(phoneNumber, code)
 *    - Reads the stored code from Firestore
 *    - Checks the attempt counter — rejects after 5 failed attempts (H4 fix)
 *    - Checks it matches and hasn't expired
 *    - Deletes the code on success (single-use)
 *    - Returns true/false
 *
 * Security notes:
 * - OTP codes expire after 10 minutes
 * - Codes are deleted after successful verification (single-use)
 * - Max 5 verification attempts per code (H4 fix) — prevents online brute force
 * - Firestore security rules must restrict otp_codes to server-side only
 *   (or at minimum: only the matching phone number can read its own code)
 */

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { sendSms } from './smsService';

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

async function generateCode(): Promise<string> {
  // Cryptographically secure 6-digit code using Web Crypto API
  // Available in React Native 0.73+ via Hermes, and in all Expo SDK 50+ builds
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (100000 + (array[0] % 900000)).toString();
  return code;
}

export async function generateAndSendOtp(phoneNumber: string): Promise<void> {
  const code = await generateCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  // Store in Firestore — keyed by phone number (normalized: +639...)
  // attempts starts at 0; incremented on each failed verification attempt.
  const otpRef = doc(db, 'otp_codes', phoneNumber.replace(/\+/g, '').replace(/\s/g, ''));
  await setDoc(otpRef, {
    code,
    phoneNumber,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: serverTimestamp(),
    attempts: 0,
  });

  // Send via SMS API PH
  await sendSms(
    phoneNumber,
    `Your Emergo verification code is: ${code}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.`
  );
}

export async function verifyOtp(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  const otpRef = doc(db, 'otp_codes', phoneNumber.replace(/\+/g, '').replace(/\s/g, ''));
  const snap = await getDoc(otpRef);

  if (!snap.exists()) return false;

  const data = snap.data();
  const now = new Date();
  const expiresAt = (data.expiresAt as Timestamp).toDate();

  // H4 fix: reject if too many failed attempts
  const attempts: number = data.attempts ?? 0;
  if (attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error(
      'Too many incorrect attempts. Please request a new code.'
    );
  }

  // Check expiry
  if (now > expiresAt) {
    await deleteDoc(otpRef); // clean up expired code
    return false;
  }

  // Check code match — increment attempts counter first (before checking)
  // so a successful guess after N-1 failures also counts correctly.
  if (data.code !== code.trim()) {
    // Increment attempt counter in Firestore
    await updateDoc(otpRef, { attempts: attempts + 1 });
    return false;
  }

  // Success — delete code so it can't be reused
  await deleteDoc(otpRef);
  return true;
}
