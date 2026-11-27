/**
 * incidentService — Dashboard incident verification and resolution
 *
 * Role gate: assertOfficial checks the caller's role before any write.
 * Firestore security rules are the final gate — this is defense-in-depth.
 * Both verifyIncident and resolveIncident use transactions for race-condition safety.
 */

import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { IncidentDocument } from '../types';

export const DEFAULT_ADMIN_MESSAGE =
  'The emergency has been received and responders will arrive shortly.';

async function assertOfficial(uid: string): Promise<void> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists() || (snap.data().role !== 'official' && snap.data().role !== 'admin')) {
    throw new Error('Unauthorized: only officials can perform this action.');
  }
}

async function notifyResidentVerified(_reportedBy: string, _incidentId: string, _message: string): Promise<void> {
  // NOTE: Expo Push API (exp.host) is a server-to-server API and blocks
  // browser fetch requests with CORS. Resident notifications are delivered
  // via the mobile app's real-time Firestore subscription to their own
  // incidents (subscribeToMyIncidents in AlertScreen). The status update
  // written by verifyIncident below triggers that listener, which schedules
  // a local device notification — no server-to-server call needed here.
  //
  // The expoPushToken stored on the user document is used by the mobile app
  // only (official/tanod fan-out runs from the resident's device, not the dashboard).
  //
  // If you later add a backend proxy or Cloud Function, re-enable the fetch here.
}

export async function sendAdminMessage(
  incidentId: string,
  officialUid: string,
  message: string = DEFAULT_ADMIN_MESSAGE
): Promise<void> {
  await assertOfficial(officialUid);
  const incidentRef = doc(db, 'incidents', incidentId);
  const snap = await getDoc(incidentRef);
  await updateDoc(incidentRef, {
    adminMessage: message,
    adminMessageSentAt: serverTimestamp(),
  });
  if (snap.exists() && snap.data().reportedBy) {
    notifyResidentVerified(snap.data().reportedBy, incidentId, message).catch(() => {});
  }
}

export async function verifyIncident(
  incidentId: string,
  officialUid: string,
  initialMessage?: string
): Promise<void> {
  await assertOfficial(officialUid);

  const incidentRef = doc(db, 'incidents', incidentId);
  let reportedBy: string | undefined;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(incidentRef);
    if (!snap.exists()) throw new Error('Incident not found.');

    const current = snap.data();
    reportedBy = current.reportedBy;
    if (current.status !== 'unverified') {
      throw new Error(
        current.status === 'verified'
          ? 'Already verified by another official.'
          : 'This incident has already been resolved.'
      );
    }

    const updates: Record<string, unknown> = {
      status: 'verified',
      verifiedBy: officialUid,
      verifiedAt: serverTimestamp(),
    };

    if (initialMessage) {
      updates.adminMessage = initialMessage;
      updates.adminMessageSentAt = serverTimestamp();
    }

    transaction.update(incidentRef, updates);
  });

  if (reportedBy) {
    notifyResidentVerified(
      reportedBy,
      incidentId,
      initialMessage || DEFAULT_ADMIN_MESSAGE
    ).catch(() => {});
  }
}

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

export async function getAllIncidents(): Promise<IncidentDocument[]> {
  const q = query(collection(db, 'incidents'), orderBy('reportedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as IncidentDocument[];
}
