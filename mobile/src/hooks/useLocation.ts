/**
 * useLocation — real-time GPS location tracking
 *
 * Requests permission on mount and watches the device position.
 * Used by AlertScreen to show the resident their current location
 * before they send an alert.
 */

import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Coordinates } from '../services/locationService';

interface UseLocationReturn {
  coords: Coordinates | null;
  permissionGranted: boolean;
  loading: boolean;
  error: string | null;
}

export function useLocation(): UseLocationReturn {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionGranted(false);
          setError('Location permission denied. Enable it in device settings.');
          setLoading(false);
          return;
        }

        setPermissionGranted(true);

        // Get initial position immediately
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCoords({
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        });
        setLoading(false);

        // Watch for position updates
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (loc) => {
            setCoords({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          }
        );
      } catch (err: any) {
        setError(err?.message ?? 'Could not get location.');
        setLoading(false);
      }
    };

    start();

    return () => {
      subscription?.remove();
    };
  }, []);

  return { coords, permissionGranted, loading, error };
}
