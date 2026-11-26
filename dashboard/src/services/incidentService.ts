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

async function notifyResidentVerified(reportedBy: string, incidentId: string, message: string): Promise<void> {
  try {
    const userSnap = await getDoc(doc(db, 'users', reportedBy));
    const token = userSnap.exists() ? userSnap.data().expoPushToken : null;
    if (!token || typeof token !== 'string' || !token.startsWith('ExponentPushToken')) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        sound: 'default',
        title: 'Emergency Alert Verified',
        body: message,
        data: { incidentId, type: 'verified' },
        priority: 'high',
      }),
    });
  } catch (err) {
    console.warn('[incidentService] Resident push notification skipped:', err);
  }
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
