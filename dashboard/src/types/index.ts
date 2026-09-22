/**
 * Shared TypeScript types for Emergo Dashboard
 * Must match mobile/src/types/index.ts exactly.
 */

import { Timestamp, GeoPoint } from 'firebase/firestore';

export type UserRole = 'resident' | 'official' | 'tanod';

export interface UserDocument {
  uid: string;
  role: UserRole;
  displayName: string;
  phoneNumber: string;
  createdAt: Timestamp;
  expoPushToken?: string;
}

export type IncidentStatus = 'unverified' | 'verified' | 'resolved';

export interface IncidentDocument {
  id: string;
  status: IncidentStatus;
  reportedAt: Timestamp;
  reportedBy: string;
  location: GeoPoint;
  description?: string;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  resolvedAt?: Timestamp;
}
