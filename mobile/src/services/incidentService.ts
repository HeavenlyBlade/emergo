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

  // Notify all officials and tanods via Expo Push (fire and forget)
  const userSnap = await import('firebase/firestore').then(({ doc, getDoc }) =>
    getDoc(doc(db, 'users', uid))
  );
  const reporterName = userSnap.exists()
    ? userSnap.data().displayName ?? 'A resident'
    : 'A resident';

  import('./notificationService').then(({ notifyOfficialsAndTanods }) => {
    notifyOfficialsAndTanods(incidentRef.id, reporterName, coords).catch(() => {});
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

// ─── Status transitions ───────────────────────────────────────────────────────

/**
 * Verify an incident — ONLY role == 'official' should call this.
 * Uses a Firestore transaction to prevent race conditions:
 * if two officials tap verify at the same time, only the first succeeds.
 */
export async function verifyIncident(
  incidentId: string,
  officialUid: string
): Promise<void> {
  const { runTransaction, doc } = await import('firebase/firestore');
  const incidentRef = doc(db, 'incidents', incidentId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(incidentRef);
    if (!snap.exists()) throw new Error('Incident not found.');

    const current = snap.data();
    if (current.status !== 'unverified') {
      throw new Error(
        current.status === 'verified'
          ? `Already verified by another official.`
          : 'This incident has already been resolved.'
      );
    }

    transaction.update(incidentRef, {
      status: 'verified',
      verifiedBy: officialUid,
      verifiedAt: (await import('firebase/firestore')).serverTimestamp(),
    });
  });
}

/**
 * Resolve an incident — ONLY role == 'official' should call this.
 */
export async function resolveIncident(
  incidentId: string,
  officialUid: string
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  const incidentRef = doc(db, 'incidents', incidentId);
  await updateDoc(incidentRef, {
    status: 'resolved',
    resolvedBy: officialUid,
    resolvedAt: serverTimestamp(),
  });
}
