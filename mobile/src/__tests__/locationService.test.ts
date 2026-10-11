/**
 * locationService tests
 *
 * expo-location is fully mocked.
 * Uses Jest fake timers to verify the 15-second GPS timeout without waiting.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

// ── Mock expo-location ───────────────────────────────────────────────────────
const mockRequestForegroundPermissionsAsync = jest.fn()
const mockGetCurrentPositionAsync = jest.fn()

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: mockRequestForegroundPermissionsAsync,
  getCurrentPositionAsync: mockGetCurrentPositionAsync,
  Accuracy: { High: 6 },
}))

import { getCurrentLocation } from '../services/locationService'

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

    // Advance clock past the 15-second timeout
    jest.advanceTimersByTime(15_001)

    await expect(locationPromise).rejects.toThrow('GPS_TIMEOUT')
  })

  it('rejects with a permission error when location permission is denied', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' })

    await expect(getCurrentLocation()).rejects.toThrow('Location permission denied')
  })
})
