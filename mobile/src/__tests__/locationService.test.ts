/**
 * locationService tests
 *
 * expo-location is fully mocked.
 * Uses Jest fake timers to verify the 15-second GPS timeout without waiting.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

// ── Mock expo-location ───────────────────────────────────────────────────────
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 6 },
}))

import * as Location from 'expo-location'
import { getCurrentLocation } from '../services/locationService'

const mockRequestForegroundPermissionsAsync = Location.requestForegroundPermissionsAsync as jest.Mock
const mockGetCurrentPositionAsync = Location.getCurrentPositionAsync as jest.Mock

describe('getCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns coordinates when GPS locks within the timeout', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' })
    mockGetCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 13.9374, longitude: 121.6175 },
    })

    const coords = await getCurrentLocation()
    expect(coords.latitude).toBe(13.9374)
    expect(coords.longitude).toBe(121.6175)
  })

  it('rejects with GPS_TIMEOUT when GPS never locks (fake timers)', async () => {
    jest.useFakeTimers()

    mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' })
    // GPS call never resolves
    mockGetCurrentPositionAsync.mockReturnValueOnce(new Promise(() => {}))

    const locationPromise = getCurrentLocation()

    // Let the permission check resolve first (it's a microtask-based promise)
    await Promise.resolve()
    await Promise.resolve()

    // Now advance past the 15-second GPS timeout
    jest.advanceTimersByTime(15_001)

    // Flush remaining microtasks so the Promise.race rejection propagates
    await Promise.resolve()

    await expect(locationPromise).rejects.toThrow('GPS_TIMEOUT')
  })

  it('rejects with a permission error when location permission is denied', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' })

    await expect(getCurrentLocation()).rejects.toThrow('Location permission denied')
  })
})
