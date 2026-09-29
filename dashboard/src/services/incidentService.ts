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
} from 'firebase/firestore';
import { db } from './firebase';
import type { IncidentDocument } from '../types';

async function assertOfficial(uid: string): Promise<void> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists() || snap.data().role !== 'official') {
    throw new Error('Unauthorized: only officials can perform this action.');
  }
}

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
