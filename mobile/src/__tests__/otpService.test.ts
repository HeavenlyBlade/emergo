/**
 * otpService tests
 *
 * Firestore and smsService are fully mocked; no real network calls are made.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// ── Mock firebase/firestore ──────────────────────────────────────────────────
const mockSetDoc = jest.fn()
const mockGetDoc = jest.fn()
const mockDeleteDoc = jest.fn()
const mockUpdateDoc = jest.fn()

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((_db: unknown, _col: string, id: string) => ({ id })),
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  deleteDoc: mockDeleteDoc,
  updateDoc: mockUpdateDoc,
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}))

jest.mock('../services/firebase', () => ({ db: {} }))

// ── Mock smsService ──────────────────────────────────────────────────────────
const mockSendSms = jest.fn()
jest.mock('../services/smsService', () => ({ sendSms: mockSendSms }))

// Import after mocks
import { generateAndSendOtp, verifyOtp } from '../services/otpService'

// Helper — returns a Firestore-like Timestamp from a Date
function tsFromDate(d: Date) {
  return { toDate: () => d }
}

describe('generateAndSendOtp', () => {
  beforeEach(() => jest.clearAllMocks())

  it('stores a 6-digit code and sends an SMS', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined)
    mockSendSms.mockResolvedValueOnce(undefined)

    await generateAndSendOtp('+639171234567')

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [, docData] = mockSetDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    const code = docData.code as string
    expect(code).toMatch(/^\d{6}$/)

    expect(mockSendSms).toHaveBeenCalledTimes(1)
  })
})

describe('verifyOtp', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true for a valid code', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        code: '123456',
        expiresAt: tsFromDate(future),
        attempts: 0,
      }),
    })
    mockDeleteDoc.mockResolvedValueOnce(undefined)

    const result = await verifyOtp('+639171234567', '123456')
    expect(result).toBe(true)
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })

  it('returns false for a wrong code and increments attempts', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        code: '123456',
        expiresAt: tsFromDate(future),
        attempts: 2,
      }),
    })
    mockUpdateDoc.mockResolvedValueOnce(undefined)

    const result = await verifyOtp('+639171234567', '999999')
    expect(result).toBe(false)
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { attempts: 3 })
  })

  it('throws after 5 failed attempts', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        code: '123456',
        expiresAt: tsFromDate(future),
        attempts: 5,
      }),
    })

    await expect(verifyOtp('+639171234567', '123456')).rejects.toThrow(
      'Too many incorrect attempts'
    )
  })

  it('returns false and deletes the document when the OTP has expired', async () => {
    const past = new Date(Date.now() - 1000) // 1 second in the past
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        code: '123456',
        expiresAt: tsFromDate(past),
        attempts: 0,
      }),
    })
    mockDeleteDoc.mockResolvedValueOnce(undefined)

    const result = await verifyOtp('+639171234567', '123456')
    expect(result).toBe(false)
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })

  it('returns false when no OTP document exists', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false })

    const result = await verifyOtp('+639171234567', '000000')
    expect(result).toBe(false)
  })
})
