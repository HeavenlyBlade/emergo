/**
 * Shared TypeScript types for Emergo Dashboard
 * Must match mobile/src/types/index.ts exactly.
 *
 * Note: We use plain objects for Firestore special types (GeoPoint, Timestamp)
 * to avoid circular import issues with firebase/firestore in Vite.
 * At runtime these are still Firestore GeoPoint/Timestamp instances.
 */

export type UserRole = 'resident' | 'official' | 'tanod';

export interface UserDocument {
  uid: string;
  role: UserRole;
  displayName: string;
  phoneNumber: string;
  createdAt: { toDate: () => Date };
  expoPushToken?: string;
  // Dashboard login credentials (officials and tanods only)
  username?: string;
  passwordHash?: string;
  passwordSalt?: string; // hex-encoded PBKDF2 salt; required alongside passwordHash
}

export type IncidentStatus = 'unverified' | 'verified' | 'resolved';

export interface GeoPointLike {
  latitude: number;
  longitude: number;
}

export interface TimestampLike {
  toDate: () => Date;
}

export interface IncidentDocument {
  id: string;
  status: IncidentStatus;
  reportedAt: TimestampLike;
  reportedBy: string;
  location: GeoPointLike;
  description?: string;
  severity?: 'light' | 'moderate' | 'extreme';
  verifiedBy?: string;
  verifiedAt?: TimestampLike;
  resolvedBy?: string;
  resolvedAt?: TimestampLike;
}
