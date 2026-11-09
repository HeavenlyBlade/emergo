/**
 * incidentUtils tests — dashboard
 *
 * Covers formatRelativeTime, formatResponseTime, STATUS_COLORS, STATUS_LABELS, STATUS_BG.
 * No Firebase, no network — pure utility functions.
 */

import { describe, it, expect, vi } from 'vitest'

// incidentUtils only imports types from firebase/firestore, no runtime calls
vi.mock('firebase/firestore', () => ({}))

import {
  formatRelativeTime,
  formatResponseTime,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_BG,
} from '../utils/incidentUtils'

// Helper — creates a fake TimestampLike from a date
function ts(date: Date) {
  return { toDate: () => date }
}

function msAgo(ms: number) {
  return ts(new Date(Date.now() - ms))
}

describe('formatRelativeTime', () => {
  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('')
  })

  it('returns "Just now" for timestamps under 10 seconds ago', () => {
    expect(formatRelativeTime(msAgo(5_000))).toBe('Just now')
  })

  it('returns seconds for 10–59 seconds ago', () => {
    expect(formatRelativeTime(msAgo(15_000))).toBe('15s ago')
    expect(formatRelativeTime(msAgo(59_000))).toBe('59s ago')
  })

  it('returns minutes for 1–59 minutes ago', () => {
    expect(formatRelativeTime(msAgo(60_000))).toBe('1m ago')
    expect(formatRelativeTime(msAgo(45 * 60_000))).toBe('45m ago')
  })

  it('returns hours for 1–23 hours ago', () => {
    expect(formatRelativeTime(msAgo(2 * 60 * 60_000))).toBe('2h ago')
  })

  it('returns days for 24+ hours ago', () => {
    expect(formatRelativeTime(msAgo(2 * 24 * 60 * 60_000))).toBe('2d ago')
  })
})

describe('formatResponseTime', () => {
  it('returns empty string when from is undefined', () => {
    expect(formatResponseTime(undefined, ts(new Date()))).toBe('')
  })

  it('returns empty string when to is undefined', () => {
    expect(formatResponseTime(ts(new Date()), undefined)).toBe('')
  })

  it('returns empty string for negative difference', () => {
    const now = new Date()
    expect(formatResponseTime(ts(now), ts(new Date(now.getTime() - 1000)))).toBe('')
  })

  it('returns seconds for sub-minute response', () => {
    const from = new Date()
    expect(formatResponseTime(ts(from), ts(new Date(from.getTime() + 45_000)))).toBe('45s')
  })

  it('returns minutes and seconds for multi-minute response', () => {
    const from = new Date()
    expect(
      formatResponseTime(ts(from), ts(new Date(from.getTime() + (4 * 60 + 32) * 1000)))
    ).toBe('4m 32s')
  })

  it('returns hours and minutes for hour-long response', () => {
    const from = new Date()
    expect(
      formatResponseTime(ts(from), ts(new Date(from.getTime() + 65 * 60 * 1000)))
    ).toBe('1h 5m')
  })
})

describe('STATUS_COLORS', () => {
  it('maps every status to a hex color', () => {
    expect(STATUS_COLORS.unverified).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(STATUS_COLORS.verified).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(STATUS_COLORS.resolved).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

describe('STATUS_BG', () => {
  it('has a Tailwind class for every status', () => {
    expect(STATUS_BG.unverified).toContain('bg-')
    expect(STATUS_BG.verified).toContain('bg-')
    expect(STATUS_BG.resolved).toContain('bg-')
  })
})

describe('STATUS_LABELS', () => {
  it('has a text label for every status', () => {
    expect(STATUS_LABELS.unverified).toBe('Unverified')
    expect(STATUS_LABELS.verified).toBe('Verified')
    expect(STATUS_LABELS.resolved).toBe('Resolved')
  })
})
