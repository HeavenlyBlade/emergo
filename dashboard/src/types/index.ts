/**
 * Shared TypeScript types for Emergo Dashboard
 * Must match mobile/src/types/index.ts exactly.
 *
 * Note: We use plain objects for Firestore special types (GeoPoint, Timestamp)
 * to avoid circular import issues with firebase/firestore in Vite.
 * At runtime these are still Firestore GeoPoint/Timestamp instances.
 */

export type UserRole = 'resident' | 'official' | 'admin' | 'responder' | 'tanod';

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

export interface ResponderOnTheWay {
  uid: string;
  displayName: string;
  latitude: number;
  longitude: number;
  respondedAt?: TimestampLike | string;
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
  photoBase64?: string;
  adminMessage?: string;
  adminMessageSentAt?: TimestampLike;
  respondersOnTheWay?: ResponderOnTheWay[];
}

export interface ResponderLocation {
  uid: string;
  displayName: string;
  role?: string;
  latitude: number;
  longitude: number;
  isVisible: boolean;
  status?: 'available' | 'on_the_way';
  activeIncidentId?: string | null;
  lastSeen?: TimestampLike;
}
