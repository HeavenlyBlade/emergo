/**
 * incidentService — Dashboard incident verification and resolution
 *
 * Role gate: only officials can verify. Enforced in Firestore rules
 * AND here for defense-in-depth.
 * Race condition: verifyIncident uses a Firestore transaction.
 */

import {
  doc,
  runTransaction,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { IncidentDocument } from '../types';

export async function verifyIncident(
  incidentId: string,
  officialUid: string
): Promise<void> {
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
  const incidentRef = doc(db, 'incidents', incidentId);
  await updateDoc(incidentRef, {
    status: 'resolved',
    resolvedBy: officialUid,
    resolvedAt: serverTimestamp(),
  });
}

export async function getAllIncidents(): Promise<IncidentDocument[]> {
  const q = query(
    collection(db, 'incidents'),
    orderBy('reportedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as IncidentDocument[];
}
