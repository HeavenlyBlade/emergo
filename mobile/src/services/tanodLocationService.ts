/**
 * tanodLocationService — Broadcasts the responder/tanod GPS location to Firestore.
 * Writes to both responder_locations and tanod_locations so Admin's Live Map sees it.
 */
import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, ensureAnonymousAuth } from './firebase';

export async function startLocationBroadcast(
  uid: string,
  displayName: string
): Promise<Location.LocationSubscription> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Enable it in device settings.');
  }

  await ensureAnonymousAuth();

  const writeLocation = async (latitude: number, longitude: number) => {
    const payload = {
      uid,
      latitude,
      longitude,
      lastSeen: serverTimestamp(),
      displayName,
      isVisible: true,
    };
    await Promise.all([
      setDoc(doc(db, 'tanod_locations', uid), payload, { merge: true }),
      setDoc(doc(db, 'responder_locations', uid), payload, { merge: true }),
    ]);
  };

  // Write initial position immediately so Admin sees responder right away
  try {
    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await writeLocation(initial.coords.latitude, initial.coords.longitude);
  } catch {
    // Watch below will write on first fix
  }

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 20,
    },
    async (loc) => {
      try {
        await writeLocation(loc.coords.latitude, loc.coords.longitude);
      } catch (err) {
        console.error('[tanodLocationService] Failed to write location:', err);
      }
    }
  );

  return subscription;
}

export async function setMobileResponderVisibility(
  uid: string,
  isVisible: boolean
): Promise<void> {
  const payload = { isVisible, lastSeen: serverTimestamp() };
  await Promise.all([
    setDoc(doc(db, 'tanod_locations', uid), payload, { merge: true }),
    setDoc(doc(db, 'responder_locations', uid), payload, { merge: true }),
  ]);
}
