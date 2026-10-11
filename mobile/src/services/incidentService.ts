/**
 * incidentService — Emergency alert submission and incident management
 *
 * Option B offline behavior: if the device has no internet connection
 * at submission time, throw a clear error. No silent queueing.
 *
 * Role gate: verifyIncident and resolveIncident check the caller's role
 * in Firestore before writing. Firestore security rules are the final gate,
 * but this is defense-in-depth at the service layer.
 */

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  orderBy,
  limit,
  serverTimestamp,
  GeoPoint,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import NetInfo from '@react-native-community/netinfo';
import { db } from './firebase';
import { getCurrentLocation } from './locationService';
import { notifyOfficialsAndTanods } from './notificationService';
import type { IncidentDocument } from '../types';

// ─── Submit alert ─────────────────────────────────────────────────────────────

export async function submitEmergencyAlert(
  uid: string,
  description?: string
): Promise<string> {
  // Option B — block on no connection
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    throw new Error('No connection. Move to an area with signal and try again.');
  }

  // H4 fix: rate limit — prevent submitting more than one alert every 5 minutes
  const fiveMinutesAgo = Timestamp.fromDate(
    new Date(Date.now() - 5 * 60 * 1000)
  );
  const recentQuery = query(
    collection(db, 'incidents'),
    where('reportedBy', '==', uid),
    where('reportedAt', '>', fiveMinutesAgo),
    limit(1)
  );
  const recentSnap = await getDocs(recentQuery);
  if (!recentSnap.empty) {
    throw new Error('Please wait before submitting another alert.');
  }

  const coords = await getCurrentLocation();

  const incidentRef = await addDoc(collection(db, 'incidents'), {
    status: 'unverified',
    reportedAt: serverTimestamp(),
    reportedBy: uid,
    location: new GeoPoint(coords.latitude, coords.longitude),
    description: description?.trim() ?? '',
  });

  // Fetch reporter name for the notification
  const userSnap = await getDoc(doc(db, 'users', uid));
  const reporterName = userSnap.exists()
    ? (userSnap.data().displayName as string | undefined) ?? 'A resident'
    : 'A resident';

  // Notify officials and tanods — fire and log, don't swallow silently
  notifyOfficialsAndTanods(incidentRef.id, reporterName, coords).catch((err) => {
    console.error('[incidentService] Push notification failed:', err);
  });

  return incidentRef.id;
}

// ─── Real-time listeners ──────────────────────────────────────────────────────

export function subscribeToMyIncidents(
  uid: string,
  callback: (incidents: IncidentDocument[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'incidents'),
    where('reportedBy', '==', uid),
    orderBy('reportedAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const incidents = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as IncidentDocument[];
      callback(incidents);
    },
    (err) => {
      console.error('[incidentService] subscribeToMyIncidents error:', err);
      callback([]);
    }
  );
}

// ─── Status transitions ───────────────────────────────────────────────────────

async function assertOfficial(uid: string): Promise<void> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists() || snap.data().role !== 'official') {
    throw new Error('Unauthorized: only officials can perform this action.');
  }
}

/**
 * Verify an incident — ONLY role == 'official'.
 * Transaction prevents two officials verifying simultaneously.
 */
export async function verifyIncident(
  incidentId: string,
  officialUid: string
): Promise<void> {
  await assertOfficial(officialUid);

  const incidentRef = doc(db, 'incidents', incidentId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(incidentRef);
    if (!snap.exists()) throw new Error('Incident not found.');

    const current = snap.data();
    if (current.status !== 'unverified') {
      throw new Error(
        current.status === 'verified'
          ? 'Already verified by another official.'
          : 'This incident has already been resolved.'
      );
    }

    transaction.update(incidentRef, {
      status: 'verified',
      verifiedBy: officialUid,
      verifiedAt: serverTimestamp(),
    });
  });
}

/**
 * Resolve an incident — ONLY role == 'official'.
 * Transaction prevents resolving an already-resolved incident.
 */
export async function resolveIncident(
  incidentId: string,
  officialUid: string
): Promise<void> {
  await assertOfficial(officialUid);

  const incidentRef = doc(db, 'incidents', incidentId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(incidentRef);
    if (!snap.exists()) throw new Error('Incident not found.');
    if (snap.data().status === 'resolved') throw new Error('Already resolved.');

    transaction.update(incidentRef, {
      status: 'resolved',
      resolvedBy: officialUid,
      resolvedAt: serverTimestamp(),
    });
  });
}
