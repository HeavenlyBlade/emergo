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
import { db, ensureAnonymousAuth } from './firebase';
import { getCurrentLocation } from './locationService';
import { notifyOfficialsAndTanods } from './notificationService';
import type { IncidentDocument, ResponderOnTheWay } from '../types';

export const DEFAULT_ADMIN_MESSAGE =
  'The emergency has been received and responders will arrive shortly.';

// ─── Submit alert ─────────────────────────────────────────────────────────────

export async function submitEmergencyAlert(
  uid: string,
  description?: string,
  severity?: 'light' | 'moderate' | 'extreme',
  photoBase64?: string
): Promise<string> {
  await ensureAnonymousAuth();
  // If the device is offline, the Firestore addDoc call below will throw
  // and the caller (AlertScreen) will display the error to the user.

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
    const lastAlert = recentSnap.docs[0].data();
    const reportedAt = (lastAlert.reportedAt as Timestamp).toDate();
    const secondsLeft = Math.ceil((reportedAt.getTime() + 5 * 60 * 1000 - Date.now()) / 1000);
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const timeStr = minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;
    throw new Error(`Please wait ${timeStr} before submitting another alert.`);
  }

  const coords = await getCurrentLocation();

  const incidentRef = await addDoc(collection(db, 'incidents'), {
    status: 'unverified',
    reportedAt: serverTimestamp(),
    reportedBy: uid,
    location: new GeoPoint(coords.latitude, coords.longitude),
    description: description?.trim() ?? '',
    severity: severity ?? 'moderate',
    ...(photoBase64 ? { photoBase64 } : {}),
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
      const incidents = snap.docs.map((d: any) => ({
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
  await runTransaction(db, async (transaction: any) => {
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
  await runTransaction(db, async (transaction: any) => {
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

export async function sendAdminMessage(
  incidentId: string,
  officialUid: string,
  message: string = DEFAULT_ADMIN_MESSAGE
): Promise<void> {
  await assertOfficial(officialUid);
  const incidentRef = doc(db, 'incidents', incidentId);
  await updateDoc(incidentRef, {
    adminMessage: message,
    adminMessageSentAt: serverTimestamp(),
  });
}

export async function setResponderOnTheWay(
  incidentId: string,
  responder: { uid: string; displayName: string; latitude: number; longitude: number },
  isOnTheWay: boolean
): Promise<void> {
  const incidentRef = doc(db, 'incidents', incidentId);
  await runTransaction(db, async (tx: any) => {
    const snap = await tx.get(incidentRef);
    if (!snap.exists()) throw new Error('Incident not found.');

    const currentList: ResponderOnTheWay[] = snap.data().respondersOnTheWay ?? [];
    let updatedList: ResponderOnTheWay[];
    if (isOnTheWay) {
      updatedList = [
        ...currentList.filter((r) => r.uid !== responder.uid),
        {
          uid: responder.uid,
          displayName: responder.displayName,
          latitude: responder.latitude,
          longitude: responder.longitude,
          respondedAt: new Date().toISOString(),
        },
      ];
    } else {
      updatedList = currentList.filter((r) => r.uid !== responder.uid);
    }

    tx.update(incidentRef, { respondersOnTheWay: updatedList });
  });
}
