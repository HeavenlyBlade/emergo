/**
 * responderService — Location broadcasting, visibility toggling, and "On the way" status.
 */

import {
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ResponderOnTheWay } from '../types';

/**
 * Broadcasts responder GPS location and visibility status to Firestore.
 * Writes to both responder_locations and tanod_locations for complete interoperability.
 */
export async function updateResponderLocation(
  uid: string,
  displayName: string,
  coords: { latitude: number; longitude: number },
  isVisible: boolean,
  status: 'available' | 'on_the_way' = 'available',
  activeIncidentId: string | null = null
): Promise<void> {
  const payload = {
    uid,
    displayName,
    latitude: coords.latitude,
    longitude: coords.longitude,
    isVisible,
    status,
    activeIncidentId: activeIncidentId ?? null,
    lastSeen: serverTimestamp(),
  };

  try {
    await Promise.all([
      setDoc(doc(db, 'responder_locations', uid), payload, { merge: true }),
      setDoc(doc(db, 'tanod_locations', uid), payload, { merge: true }),
    ]);
  } catch (err) {
    console.error('[responderService] Failed to update location:', err);
    throw err;
  }
}

/**
 * Toggles whether responder is visible on maps to admin and residents.
 */
export async function setResponderVisibility(
  uid: string,
  isVisible: boolean
): Promise<void> {
  const payload = {
    isVisible,
    lastSeen: serverTimestamp(),
  };

  await Promise.all([
    setDoc(doc(db, 'responder_locations', uid), payload, { merge: true }),
    setDoc(doc(db, 'tanod_locations', uid), payload, { merge: true }),
  ]);
}

/**
 * Updates the incident's respondersOnTheWay list and responder's status.
 */
export async function setResponderOnTheWay(
  incidentId: string,
  responder: { uid: string; displayName: string; latitude: number; longitude: number },
  isOnTheWay: boolean
): Promise<void> {
  const incidentRef = doc(db, 'incidents', incidentId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(incidentRef);
    if (!snap.exists()) throw new Error('Incident not found.');

    const currentData = snap.data();
    const currentList: ResponderOnTheWay[] = currentData.respondersOnTheWay ?? [];

    let updatedList: ResponderOnTheWay[];
    if (isOnTheWay) {
      // Remove any existing entry for this responder and add fresh entry
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

    tx.update(incidentRef, {
      respondersOnTheWay: updatedList,
    });
  });

  // Update responder's location status
  try {
    const statusPayload = {
      status: isOnTheWay ? ('on_the_way' as const) : ('available' as const),
      activeIncidentId: isOnTheWay ? incidentId : null,
      lastSeen: serverTimestamp(),
    };
    await Promise.all([
      setDoc(doc(db, 'responder_locations', responder.uid), statusPayload, { merge: true }),
      setDoc(doc(db, 'tanod_locations', responder.uid), statusPayload, { merge: true }),
    ]);
  } catch (err) {
    console.error('[responderService] Error updating responder status:', err);
  }
}
