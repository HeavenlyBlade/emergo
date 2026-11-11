/**
 * incidentService tests — covers assertOfficial role gate.
 *
 * Firestore is fully mocked; no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks (must be declared before vi.mock factory runs) ─────────────
const { mockGetDoc } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
}))

// ── Mock Firebase ────────────────────────────────────────────────────────────

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}))
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInAnonymously: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
}))
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  getDoc: mockGetDoc,
  getDocs: vi.fn(() => Promise.resolve({ empty: true, docs: [] })),
  query: vi.fn(),
  runTransaction: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => null),
  where: vi.fn(),
}))

import { verifyIncident } from '../services/incidentService'

// Helper: build a mock DocumentSnapshot
function makeSnap(exists: boolean, data: Record<string, unknown>) {
  return {
    exists: () => exists,
    data: () => data,
  }
}

describe('assertOfficial (via verifyIncident)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when the caller has role "resident"', async () => {
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, { role: 'resident' }))

    await expect(verifyIncident('incident-1', 'uid-resident')).rejects.toThrow(
      'Unauthorized'
    )
  })

  it('does not throw the Unauthorized error when caller is "official"', async () => {
    // assertOfficial passes; the function then calls runTransaction.
    // runTransaction is mocked to immediately throw "Incident not found" —
    // what matters here is that we do NOT get an Unauthorized error.
    mockGetDoc.mockResolvedValueOnce(makeSnap(true, { role: 'official' }))

    const { runTransaction } = await import('firebase/firestore')
    vi.mocked(runTransaction).mockRejectedValueOnce(new Error('Incident not found.'))

    await expect(verifyIncident('incident-1', 'uid-official')).rejects.toThrow(
      'Incident not found.'
    )
    // Crucially, the error is NOT "Unauthorized"
  })

  it('throws when the caller uid does not exist in Firestore', async () => {
    mockGetDoc.mockResolvedValueOnce(makeSnap(false, {}))

    await expect(verifyIncident('incident-1', 'uid-ghost')).rejects.toThrow(
      'Unauthorized'
    )
  })
})
