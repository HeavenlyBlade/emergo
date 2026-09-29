/**
 * Shared TypeScript types for Emergo
 * These mirror the Firestore data model exactly — keep in sync with dashboard/src/types/
 */

import { Timestamp, GeoPoint } from 'firebase/firestore';

// ─── User roles ───────────────────────────────────────────────────────────────

export type UserRole = 'resident' | 'official' | 'tanod';

// ─── Firestore document shapes ────────────────────────────────────────────────

/**
 * users/{uid}
 * Created on first phone number login.
 * role defaults to 'resident' — officials/tanods are set manually by admin.
 */
export interface UserDocument {
  uid: string;
  role: UserRole;
  displayName: string;
  phoneNumber: string;       // from Firebase Auth, stored on first login
  createdAt: Timestamp;
  expoPushToken?: string;    // stored on login for officials/tanods; used for fan-out
  username?: string;         // dashboard login (officials/tanods only)
  passwordHash?: string;     // SHA-256 hex, set by admin
}

/**
 * incidents/{id}
 * Created when a resident submits an emergency alert.
 * Status lifecycle: unverified → verified → resolved
 */
export type IncidentStatus = 'unverified' | 'verified' | 'resolved';

export interface IncidentDocument {
  id: string;
  status: IncidentStatus;
  reportedAt: Timestamp;
  reportedBy: string;         // uid of the resident who submitted
  location: GeoPoint;
  description?: string;
  verifiedBy?: string;        // uid of the official who verified — only role == 'official'
  verifiedAt?: Timestamp;
  resolvedBy?: string;        // uid of the official who resolved
  resolvedAt?: Timestamp;
}

// ─── Navigation param types ───────────────────────────────────────────────────

/**
 * Auth stack — shown when user is not logged in
 */
export type AuthStackParamList = {
  PhoneEntry: undefined;
  OtpVerify: { phoneNumber: string };
  DisplayNameSetup: undefined;
};

/**
 * App stack — shown when user is logged in
 * Will grow as modules are built
 */
export type AppStackParamList = {
  Home: undefined;
  Alert: undefined;
  Tanod: undefined;
};
