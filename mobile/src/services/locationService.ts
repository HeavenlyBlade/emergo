/**
 * locationService — GPS location capture
 *
 * Requests location permission and gets the current coordinates.
 * Returns a Firestore GeoPoint-compatible object { latitude, longitude }.
 *
 * Option B offline behavior is handled in incidentService — location
 * capture itself doesn't need a network connection.
 *
 * M6 fix: A 15-second timeout is applied to GPS acquisition. If the device
 * cannot get a lock in time (e.g. indoors, weak signal), getCurrentLocation
 * throws a GPS_TIMEOUT error. Callers should catch this and show a clear
 * user-facing message: "Could not get your location. Please enable GPS or try again."
 */

import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const GPS_TIMEOUT_MS = 15_000; // 15 seconds

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<Coordinates> {
  const hasPermission = await requestLocationPermission();

  if (!hasPermission) {
    throw new Error(
      'Location permission denied. Please enable location access in your device settings to send an emergency alert.'
    );
  }

  // M6 fix: race the GPS call against a 15-second timeout.
  // If GPS never locks, throw GPS_TIMEOUT so the caller can show a clear error.
  const locationPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('GPS_TIMEOUT')), GPS_TIMEOUT_MS)
  );

  const location = await Promise.race([locationPromise, timeoutPromise]);

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}
