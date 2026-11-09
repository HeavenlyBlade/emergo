# Emergo — Testing Guide

## Overview

Emergo has two layers of testing:

1. **Automated unit tests** — run locally, no devices needed, cover core service logic
2. **Manual end-to-end testing** — requires physical devices, tests the full system

---

## Part 1 — Automated Unit Tests

All Firebase, SMS, and location calls are fully mocked. No network access required.

### Run all tests

**Dashboard (Vitest — 8 tests):**
```
cd "C:\Users\Asus\Desktop\Emergo\dashboard"
node_modules\.bin\vitest run
```

**Mobile (Jest — 9 tests):**
```
cd "C:\Users\Asus\Desktop\Emergo\mobile"
node_modules\.bin\jest --forceExit
```

### What is covered

| Test file | What it tests |
|-----------|--------------|
| `dashboard/authService.test.ts` | PBKDF2 password hashing — hash/salt non-empty, random salts, deterministic KDF, wrong password mismatch |
| `dashboard/incidentService.test.ts` | Role gate — resident and tanod are blocked from verifying, official is allowed, non-existent UID is blocked |
| `mobile/otpService.test.ts` | OTP generation stores a 6-digit code, correct code returns true, wrong code increments attempts, 5 wrong attempts throws, expired OTP returns false, missing OTP returns false |
| `mobile/locationService.test.ts` | GPS returns coordinates on lock, GPS_TIMEOUT thrown after 15 seconds, permission denied throws correct error |

### Expected output

```
Dashboard:  2 test files  |  8 tests passed
Mobile:     2 test files  |  9 tests passed
```

Zero failures. If any test fails, do not proceed to manual testing.

---

## Part 2 — Manual End-to-End Testing

### Required devices and services

| Item | Purpose |
|------|---------|
| This PC | Runs the dashboard (browser) and Expo dev server |
| Test phone (Android + Expo Go) | Acts as resident or tanod |
| sms-server-device | Android phone running Android SMS Gateway |

### sms-server-device requirements
- App: Android SMS Gateway (from `https://github.com/capcom6/android-sms-gateway/releases`)
- Must have internet (WiFi or mobile data)
- Must have SMS credit on its SIM
- Cloud mode credentials: `QETICF / eiqmu3io7wnphn` (see `mobile/.env`)

### Before every test session

1. Boot the sms-server-device, open Android SMS Gateway, confirm the button shows **Online**
2. Verify SMS credit is available on its SIM
3. Start the dashboard:
   ```
   cd "C:\Users\Asus\Desktop\Emergo\dashboard"
   npm run dev
   ```
   Open `http://localhost:5173`
4. Start the Expo dev server:
   ```
   cd "C:\Users\Asus\Desktop\Emergo\mobile"
   npm start -- --clear
   ```
   Scan the QR with Expo Go on the test phone

### Quick SMS gateway check

Run this in PowerShell before starting — replace the number with your own:

```powershell
$user = "QETICF"
$pass = "eiqmu3io7wnphn"
$creds = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${user}:${pass}"))
Invoke-RestMethod `
  -Uri "https://api.sms-gate.app/3rdparty/v1/message" `
  -Method POST `
  -Headers @{ Authorization = "Basic $creds"; "Content-Type" = "application/json" } `
  -Body '{"textMessage":{"text":"Emergo SMS test"},"phoneNumbers":["+639XXXXXXXXX"]}'
```

You should receive the SMS within a few seconds. `state: Pending` means the device is offline.

---

## Test Accounts

Create accounts at `http://localhost:5173/dev-login` before testing.

| Role | Login method | Can do |
|------|-------------|--------|
| `resident` | Phone OTP (mobile app) | Send emergency alerts |
| `tanod` | Phone OTP (mobile app) | View and monitor incidents |
| `official` | Username + password (dashboard) | Verify and resolve incidents |

---

## Test 1 — OTP Registration

**Happy path:**
1. Open Expo Go on the test phone
2. Enter a Philippine mobile number (10 digits starting with 9)
3. Tap **Send verification code**
4. Wait for the SMS — code arrives within a few seconds when sms-server-device is Online
5. Enter the 6-digit code, tap **Verify**
6. Enter a display name, tap **Continue**
7. Resident lands on the Alert screen. Tanod lands on the Incident Monitor.

**Edge cases:**

| Scenario | Expected result |
|----------|----------------|
| Wrong code entered | Error shown, attempt counter increments |
| Wrong code 5 times in a row | "Too many incorrect attempts. Please request a new code." |
| Code not entered within 10 minutes | "OTP has expired" |
| sms-server-device Offline | SMS never arrives; the code is queued and delivers when device comes Online |

---

## Test 2 — Emergency Alert (Resident)

**Happy path:**
1. Sign in as a resident
2. Confirm GPS is enabled on the phone
3. Tap **SEND EMERGENCY ALERT**
4. Confirm the dialog — tap **Send Alert**
5. A success message appears
6. An incident card appears below with status **Unverified**

**Edge cases:**

| Scenario | Expected result |
|----------|----------------|
| GPS off when alert is tapped | "Could not get your location. Please enable GPS or try again." |
| Airplane mode on | Network error — no alert submitted, no silent queue |
| Taps cancel on the confirmation dialog | Nothing happens, no alert sent |
| Submits a second alert within 5 minutes | "Please wait before submitting another alert." |

---

## Test 3 — Official Verifies and Resolves (Dashboard)

**Happy path:**
1. Log in to `http://localhost:5173` as an official
2. Open the **Live Map** — the resident's alert appears as an amber pin
3. Click the pin — the detail panel opens on the right
4. Check the **Reported** timestamp and confirm it is accurate
5. Click **Verify Incident** — pin turns green, resident's incident card updates to **Verified** in real time (no refresh)
6. Check that **Response time** is shown in the panel (e.g. "Response time: 2m 14s")
7. Click **Mark as Resolved** — pin turns gray, resident's card updates to **Resolved** in real time
8. Go to `/incidents` — confirm the incident is in the list with correct status and timestamps
9. Go to `/admin` — confirm the incident appears in the records table and can be exported as CSV

---

## Test 4 — Tanod Incident Monitor (Mobile)

**Happy path:**
1. Sign in as a tanod on the test phone
2. The Incident Monitor loads with all incidents in real-time
3. The unverified count badge appears at the top if there are unverified incidents
4. Tap an incident card to expand it — location details and timestamps appear
5. If the incident has been verified, **Response time** is shown (e.g. "Response: 2m 14s")
6. Tap **Open in Google Maps** — opens at the correct coordinates
7. Use the filter tabs (All / Unverified / Verified / Resolved) — counts update correctly
8. Pull down to refresh — list reloads

---

## Test 5 — Role Access Control

| Action | Expected |
|--------|----------|
| Resident opens `http://localhost:5173` | Blocked — redirected to login, cannot get past it |
| Tanod opens `http://localhost:5173` | Can log in and view incidents, but no Verify or Resolve buttons |
| Official opens mobile app and logs in | Sees "Use the Emergo web dashboard on a PC or laptop" message |
| Tanod attempts Firestore write for verify | Rejected by Firestore security rules (even bypassing the UI) |

---

## Test 6 — Rate Limiting and Security

| Test | How to test | Expected |
|------|------------|----------|
| OTP brute force | Enter wrong OTP 5 times | Locked out, must request new code |
| Alert rate limit | Send alert, then immediately send another | Second blocked for 5 minutes |
| GPS timeout | Disable GPS, send alert, wait | Error shown within 15 seconds |
| Race condition (2 officials verify at once) | Two officials tap Verify on the same incident simultaneously | Only one succeeds; second gets "Already verified by another official." |

---

## Full Pre-Demo Checklist

Run through all items below before a demo or defense presentation:

**Setup:**
- [ ] sms-server-device is Online and has SMS credit
- [ ] SMS gateway test passes (PowerShell command above)
- [ ] Dashboard running at `http://localhost:5173`
- [ ] Expo dev server running, test phone connected via Expo Go
- [ ] At least one resident, tanod, and official account created

**Core flows:**
- [ ] Resident registers via OTP
- [ ] Resident sends emergency alert with GPS on
- [ ] Alert pin appears on dashboard map immediately
- [ ] Official verifies — pin turns green, response time shows in panel
- [ ] Resident sees status update live on mobile (no refresh)
- [ ] Official resolves — pin turns gray
- [ ] Tanod sees all incidents with correct filters and counts
- [ ] Tanod can open incident location in Google Maps
- [ ] CSV export from /admin page downloads and opens correctly

**Security:**
- [ ] Resident is blocked from the dashboard
- [ ] Alert is blocked with clear error when GPS is off
- [ ] Alert is blocked with clear error when offline (airplane mode)
- [ ] Wrong OTP 5 times results in lockout

---

## Simulation Results (automated logic verification)

The following were verified by code simulation without a physical device:

| Check | Result |
|-------|--------|
| Rate limit window (5 min) | Correctly blocks within window, allows after |
| OTP document key consistency across all phone formats | Match confirmed |
| OTP code always exactly 6 digits (100,000 trials) | All valid |
| Custom base64 encoder (SMS Gateway auth) | Matches native btoa output |
| GPS timeout race condition | Timeout fires correctly at 15 seconds |
| Firestore RBAC rules (8 role/action cases) | All pass |
| Dashboard double-click login bug | Confirmed fixed |
| Timestamp formatting (5s to 2 days) | All correct |
| Response time formatting (30s, 4m32s, 1h5m, invalid) | All correct, negative returns empty |
| Navigation routing (all roles and states) | All correct |
| OTP brute-force protection | Blocks on attempt 6 |
| CSV export escaping (commas, quotes, empty, null) | RFC-4180 compliant |
