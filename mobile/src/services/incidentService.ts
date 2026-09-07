/**
 * incidentService — Emergency alert submission and incident management
 *
 * Option B offline behavior: if the device has no internet connection
 * at submission time, throw a clear error. No silent queueing.
 *
 * Security: reportedBy is always set to the current user's uid server-side.
 * Status starts as 'unverified' — only officials can set it to 'verified'.
 */

import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  GeoPoint,
  Unsubscribe,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from './firebase';
import { getCurrentLocation } from './locationService';
import { IncidentDocument } from '../types';

// ─── Submit alert ─────────────────────────────────────────────────────────────

export async function submitEmergencyAlert(
  uid: string,
  description?: string
): Promise<string> {
  // Option B — check connectivity before attempting submission
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    throw new Error(
      'No connection. Move to an area with signal and try again.'
    );
  }

  // Get GPS location
  const coords = await getCurrentLocation();

  // Create incident document
  const incidentRef = await addDoc(collection(db, 'incidents'), {
    status: 'unverified',
    reportedAt: serverTimestamp(),
    reportedBy: uid,
    location: new GeoPoint(coords.latitude, coords.longitude),
    description: description?.trim() ?? '',
  });

  return incidentRef.id;
}

// ─── Real-time listeners ──────────────────────────────────────────────────────

/**
 * Subscribe to a resident's own incidents in real time.
 * Returns unsubscribe function — call in useEffect cleanup.
 */
export function subscribeToMyIncidents(
  uid: string,
  callback: (incidents: IncidentDocument[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'incidents'),
    where('reportedBy', '==', uid),
    orderBy('reportedAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const incidents = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as IncidentDocument[];
    callback(incidents);
  });
}
