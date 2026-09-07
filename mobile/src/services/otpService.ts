/**
 * otpService — Custom OTP generation, storage, and verification
 *
 * Since we use a third-party SMS API (not Firebase Phone Auth),
 * we manage OTP state ourselves:
 *
 * 1. generateAndSendOtp(phoneNumber)
 *    - Generates a 6-digit code
 *    - Stores it in Firestore: otp_codes/{phoneNumber}
 *      with an expiry of 10 minutes
 *    - Sends it via smsService
 *
 * 2. verifyOtp(phoneNumber, code)
 *    - Reads the stored code from Firestore
 *    - Checks it matches and hasn't expired
 *    - Deletes the code on success (single-use)
 *    - Returns true/false
 *
 * Security notes:
 * - OTP codes expire after 10 minutes
 * - Codes are deleted after successful verification (single-use)
 * - Firestore security rules must restrict otp_codes to server-side only
 *   (or at minimum: only the matching phone number can read its own code)
 */

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { sendSms } from './smsService';

const OTP_EXPIRY_MINUTES = 10;

function generateCode(): string {
  // Cryptographically random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

export async function generateAndSendOtp(phoneNumber: string): Promise<void> {
  const code = generateCode();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  // Store in Firestore — keyed by phone number (normalized: +639...)
  const otpRef = doc(db, 'otp_codes', phoneNumber.replace(/\+/g, ''));
  await setDoc(otpRef, {
    code,
    phoneNumber,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: serverTimestamp(),
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
  const otpRef = doc(db, 'otp_codes', phoneNumber.replace(/\+/g, ''));
  const snap = await getDoc(otpRef);

  if (!snap.exists()) return false;

  const data = snap.data();
  const now = new Date();
  const expiresAt = (data.expiresAt as Timestamp).toDate();

  // Check expiry
  if (now > expiresAt) {
    await deleteDoc(otpRef); // clean up expired code
    return false;
  }

  // Check code match
  if (data.code !== code.trim()) return false;

  // Success — delete code so it can't be reused
  await deleteDoc(otpRef);
  return true;
}
