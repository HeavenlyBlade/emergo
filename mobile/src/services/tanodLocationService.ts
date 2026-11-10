/**
 * tanodLocationService — Broadcasts the tanod's GPS location to Firestore.
 * Only called from TanodScreen for users with role === 'tanod'.
 */
import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function startLocationBroadcast(
  uid: string,
  displayName: string
): Promise<Location.LocationSubscription> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied. Enable it in device settings.');
  }

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 20,
    },
    async (loc) => {
      try {
        await setDoc(doc(db, 'tanod_locations', uid), {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          lastSeen: serverTimestamp(),
          displayName,
        });
      } catch (err) {
        console.error('[tanodLocationService] Failed to write location:', err);
      }
    }
  );

  return subscription;
}
