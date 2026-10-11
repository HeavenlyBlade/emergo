# Emergo
**Mobile Emergency Response Application — Barangay Marketview, Lucena City**

A capstone thesis project built with Expo (React Native), React (Vite), and Firebase.

---

## Monorepo Structure

```
emergo/
├── mobile/          # Expo/React Native app (residents, officials, tanods)
├── dashboard/       # React + Vite web dashboard (officials and tanods)
├── source/          # Raw video assets for dashboard login background (not in git LFS — see M5)
├── firestore.rules  # Firestore security rules (deploy with: firebase deploy --only firestore:rules)
├── .github/
│   └── workflows/
│       └── ci.yml   # GitHub Actions CI (typecheck + lint + test on push/PR)
├── DECISIONS.md     # Architectural decision log
├── DEPLOYMENT.md    # Step-by-step deployment checklist
└── README.md
```

Note: `functions/` is intentionally absent. Cloud Functions are not used (Spark plan). See DECISIONS.md.

---

## Stack
- **Mobile:** Expo SDK 57, React Native 0.86, TypeScript, Firebase JS SDK, Expo Push Notifications
- **Dashboard:** React 19, Vite, TypeScript, Tailwind CSS, Leaflet + OpenStreetMap
- **Backend:** Firebase Anonymous Auth (dashboard session), Cloud Firestore (free Spark plan)
- **Notifications:** Expo Push API (free, no server required)
- **Build:** Expo EAS Build (mobile), Firebase Hosting (dashboard)

---

## Getting Started

```bash
# Dashboard
cd dashboard
npm install
npm run dev        # dev server
npm run build      # production build
npm test           # run vitest tests
npm run lint       # run oxlint

# Mobile
cd mobile
npm install
npm run start      # Expo dev server
npm test           # run jest tests
npm run lint       # run eslint
```

---

## Security

### Firestore RBAC Rules
`firestore.rules` (at the repo root) enforces role-based access control:
- Residents may create incidents only for themselves (`reportedBy == request.auth.uid`)
- Only `role == 'official'` may transition incident `status` to `verified` or `resolved`
- The `users` role field is writable only by admin
- `otp_codes` is locked to server-side only (no direct client reads/writes)

**You must deploy these rules before any pilot.** Run:
```bash
firebase deploy --only firestore:rules
```

### Password Hashing (Dashboard)
Dashboard passwords are hashed with PBKDF2-SHA256 (100,000 iterations, random 16-byte salt per user). Both `passwordHash` and `passwordSalt` are stored in the user's Firestore document. This replaces the prior unsalted SHA-256.

### Firebase Auth Session (Dashboard)
After password verification the dashboard establishes a Firebase Anonymous Auth session. The session gate is `auth.currentUser` (a signed Firebase ID token), not a raw uid in localStorage. This prevents the C4 localStorage-uid bypass.

### GPS Timeout (Mobile)
`locationService.getCurrentLocation` races GPS acquisition against a 15-second timeout. If the device cannot get a lock (indoors, weak signal), it throws `GPS_TIMEOUT` so the caller can show a clear error rather than hanging indefinitely.

### OTP Attempt Limiting (Mobile)
`otpService.verifyOtp` rejects after 5 failed attempts, preventing online brute-force of 6-digit codes. Codes expire after 10 minutes and are deleted on first successful verification (single-use).

---

## Deployment

See `DEPLOYMENT.md` for the full step-by-step checklist.

Key requirements:
1. `firebase deploy --only firestore:rules` **must** be run before any pilot
2. Rotate SMS Gateway credentials before going to production
3. Use EAS Build for the mobile APK (see DEPLOYMENT.md for the Windows long-path workaround)

---

## Testing

```bash
# Dashboard (Vitest)
cd dashboard
npm test           # vitest run (non-watch, CI mode)

# Mobile (Jest via jest-expo)
cd mobile
npm test           # jest
```

CI runs both automatically on every push and pull request to `master` via `.github/workflows/ci.yml`.
