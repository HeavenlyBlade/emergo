/**
 * incidentUtils tests — mobile
 *
 * Covers formatRelativeTime, formatResponseTime, STATUS_COLORS, STATUS_LABELS.
 * No Firebase, no network — pure utility functions.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

// Mock firebase/firestore — incidentUtils imports Timestamp as a type only
jest.mock('firebase/firestore', () => ({}))

import {
  formatRelativeTime,
  formatResponseTime,
  STATUS_COLORS,
  STATUS_LABELS,
} from '../utils/incidentUtils'

// Helper — creates a fake Firestore Timestamp from a date
function ts(date: Date) {
  return { toDate: () => date }
}

// Helper — creates a Timestamp that is `ms` milliseconds ago
function msAgo(ms: number) {
  return ts(new Date(Date.now() - ms))
}

// Helper — creates a Timestamp that is `ms` milliseconds in the future
function msAhead(ms: number) {
  return ts(new Date(Date.now() + ms))
}

describe('formatRelativeTime', () => {
  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('')
  })

  it('returns "Just now" for timestamps under 10 seconds ago', () => {
    expect(formatRelativeTime(msAgo(5_000))).toBe('Just now')
    expect(formatRelativeTime(msAgo(9_999))).toBe('Just now')
  })

  it('returns seconds for timestamps 10–59 seconds ago', () => {
    expect(formatRelativeTime(msAgo(10_000))).toBe('10s ago')
    expect(formatRelativeTime(msAgo(30_000))).toBe('30s ago')
    expect(formatRelativeTime(msAgo(59_000))).toBe('59s ago')
  })

  it('returns minutes for timestamps 1–59 minutes ago', () => {
    expect(formatRelativeTime(msAgo(60_000))).toBe('1m ago')
    expect(formatRelativeTime(msAgo(3 * 60_000))).toBe('3m ago')
    expect(formatRelativeTime(msAgo(59 * 60_000))).toBe('59m ago')
  })

  it('returns hours for timestamps 1–23 hours ago', () => {
    expect(formatRelativeTime(msAgo(60 * 60_000))).toBe('1h ago')
    expect(formatRelativeTime(msAgo(5 * 60 * 60_000))).toBe('5h ago')
  })

  it('returns days for timestamps 24+ hours ago', () => {
    expect(formatRelativeTime(msAgo(24 * 60 * 60_000))).toBe('1d ago')
    expect(formatRelativeTime(msAgo(3 * 24 * 60 * 60_000))).toBe('3d ago')
  })
})

describe('formatResponseTime', () => {
  it('returns empty string for undefined from', () => {
    expect(formatResponseTime(undefined, ts(new Date()))).toBe('')
  })

  it('returns empty string for undefined to', () => {
    expect(formatResponseTime(ts(new Date()), undefined)).toBe('')
  })

  it('returns empty string for negative difference (to before from)', () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 5000)
    expect(formatResponseTime(ts(now), ts(earlier))).toBe('')
  })

  it('returns seconds for response under 1 minute', () => {
    const from = new Date()
    const to = new Date(from.getTime() + 30_000)
    expect(formatResponseTime(ts(from), ts(to))).toBe('30s')
  })

  it('returns minutes and seconds for response 1–59 minutes', () => {
    const from = new Date()
    const to = new Date(from.getTime() + (4 * 60 + 32) * 1000)
    expect(formatResponseTime(ts(from), ts(to))).toBe('4m 32s')
  })

  it('returns hours and minutes for response 1+ hours', () => {
    const from = new Date()
    const to = new Date(from.getTime() + (65 * 60 * 1000))
    expect(formatResponseTime(ts(from), ts(to))).toBe('1h 5m')
  })

  it('returns 0s for same timestamp', () => {
    const now = ts(new Date())
    expect(formatResponseTime(now, now)).toBe('0s')
  })
})

describe('STATUS_COLORS', () => {
  it('has a color for every status', () => {
    expect(STATUS_COLORS.unverified).toBeTruthy()
    expect(STATUS_COLORS.verified).toBeTruthy()
    expect(STATUS_COLORS.resolved).toBeTruthy()
  })

  it('unverified is amber, verified is green, resolved is gray', () => {
    expect(STATUS_COLORS.unverified).toMatch(/F59E0B/i)
    expect(STATUS_COLORS.verified).toMatch(/10B981/i)
    expect(STATUS_COLORS.resolved).toMatch(/9CA3AF/i)
  })
})

describe('STATUS_LABELS', () => {
  it('has a label for every status', () => {
    expect(STATUS_LABELS.unverified).toBe('Unverified')
    expect(STATUS_LABELS.verified).toBe('Verified')
    expect(STATUS_LABELS.resolved).toBe('Resolved')
  })})
