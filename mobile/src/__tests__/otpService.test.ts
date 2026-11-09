/**
 * otpService tests
 *
 * Firestore and smsService are fully mocked; no real network calls are made.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// ── Mock firebase/firestore ──────────────────────────────────────────────────
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn((_db: unknown, _col: string, id: string) => ({ id })),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  deleteDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}))

jest.mock('../services/firebase', () => ({ db: {} }))
jest.mock('../services/smsService', () => ({ sendSms: jest.fn() }))

import { generateAndSendOtp, verifyOtp } from '../services/otpService'
import { setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore'
import { sendSms } from '../services/smsService'

const mockSetDoc = setDoc as jest.Mock
const mockGetDoc = getDoc as jest.Mock
const mockDeleteDoc = deleteDoc as jest.Mock
const mockUpdateDoc = updateDoc as jest.Mock
const mockSendSms = sendSms as jest.Mock

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

  it('uses a normalized phone number as the Firestore document key', async () => {
    // The OTP doc key must strip + and spaces so it matches the auth UID.
    // Bug found during simulation: phone with spaces produced a mismatched key.
    mockSetDoc.mockResolvedValueOnce(undefined)
    mockSendSms.mockResolvedValueOnce(undefined)

    await generateAndSendOtp('+639171234567')

    // mockSetDoc is called as setDoc(docRef, data)
    // The docRef is created by doc(db, 'otp_codes', key) — our mock returns { id: key }
    const [docRef] = mockSetDoc.mock.calls[0] as [{ id: string }, unknown]
    expect(docRef.id).not.toContain('+')
    expect(docRef.id).not.toContain(' ')
    expect(docRef.id).toBe('639171234567')
  })
})

describe('verifyOtp', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true for a valid code', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ code: '123456', expiresAt: tsFromDate(future), attempts: 0 }),
    })
    mockDeleteDoc.mockResolvedValueOnce(undefined)

    expect(await verifyOtp('+639171234567', '123456')).toBe(true)
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })

  it('returns false for a wrong code and increments attempts', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ code: '123456', expiresAt: tsFromDate(future), attempts: 2 }),
    })
    mockUpdateDoc.mockResolvedValueOnce(undefined)

    expect(await verifyOtp('+639171234567', '999999')).toBe(false)
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { attempts: 3 })
  })

  it('throws after 5 failed attempts', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ code: '123456', expiresAt: tsFromDate(future), attempts: 5 }),
    })

    await expect(verifyOtp('+639171234567', '123456')).rejects.toThrow(
      'Too many incorrect attempts'
    )
  })

  it('returns false and deletes the document when the OTP has expired', async () => {
    const past = new Date(Date.now() - 1000)
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ code: '123456', expiresAt: tsFromDate(past), attempts: 0 }),
    })
    mockDeleteDoc.mockResolvedValueOnce(undefined)

    expect(await verifyOtp('+639171234567', '123456')).toBe(false)
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })

  it('returns false when no OTP document exists', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false })

    expect(await verifyOtp('+639171234567', '000000')).toBe(false)
  })
})
