/**
 * locationService — GPS location capture
 *
 * Requests location permission and gets the current coordinates.
 * Returns a Firestore GeoPoint-compatible object { latitude, longitude }.
 *
 * Option B offline behavior is handled in incidentService — location
 * capture itself doesn't need a network connection.
 */

import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

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

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}
