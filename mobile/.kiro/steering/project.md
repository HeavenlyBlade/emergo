# Emergo Mobile — Project Steering

> **Monorepo note:** This is the mobile app (`/mobile`) inside the `emergo` monorepo.
> See also: `/dashboard/.kiro/steering/project.md` for dashboard-side conventions.
> The System-Wide Invariants section below is identical in both steering files — any change must be made in both.

---

## Project Overview
Emergo is a mobile emergency response application for Barangay Marketview, Lucena City. Residents submit one-tap emergency alerts with GPS location. Barangay officials and tanods receive real-time notifications and manage incident verification through a separate dashboard.

---

## Tech Stack
- **Framework:** Expo SDK (React Native + TypeScript)
- **Authentication:** Firebase Phone Number Authentication (OTP via SMS) — all user roles use phone number login. No email/password. On first login, a `users/{uid}` document is created with `role: 'resident'` by default. Officials and tanods have their role set manually in Firestore by the admin before the pilot. Use Firebase test phone numbers during development to avoid hitting the 10 SMS/day free-tier limit.
- **Backend:** Firebase (Authentication, Cloud Firestore)
- **Maps:** Google Maps SDK for Android/iOS (react-native-maps)
- **Notifications:** Expo Push Notifications (`expo-notifications`) — free, no Cloud Functions or Blaze plan required. Push tokens stored in Firestore under `users/{uid}.expoPushToken`. Fan-out is triggered client-side via the Expo Push API when a new incident is submitted.
- **Build:** Expo EAS Build (internal distribution for pilot)

---

## Folder Conventions
```
mobile/
├── src/
│   ├── screens/        # Screen-level components (one file per screen)
│   ├── components/     # Reusable UI components
│   ├── services/       # All Firebase calls and business logic (NO Firebase calls inside components)
│   ├── hooks/          # Custom React hooks
│   ├── navigation/     # React Navigation setup and route types
│   ├── types/          # Shared TypeScript types and interfaces
│   └── utils/          # Pure utility functions (no side effects)
└── assets/             # Images, fonts, icons
```

---

## Naming Conventions
- Components and screens: `PascalCase` (e.g. `AlertButton.tsx`, `HomeScreen.tsx`)
- Hooks: `camelCase` prefixed with `use` (e.g. `useIncidents.ts`)
- Services: `camelCase` suffixed with `Service` (e.g. `incidentService.ts`)
- Files: `camelCase` unless they export a component (then `PascalCase`)
- Firestore collections: `camelCase` plural (e.g. `incidents`, `users`)
- Firestore document fields: `camelCase` (e.g. `reportedAt`, `verifiedBy`)

---

## TypeScript Rules
- Strict mode enabled — no `any` types
- All Firestore document shapes must have a corresponding TypeScript interface in `src/types/`
- Firebase SDK imports from `firebase/firestore`, `firebase/auth` etc. — never from the compat layer

---

## System-Wide Invariants (enforce in every spec)
> These rules apply across the entire Emergo system. They must be reflected in every `requirements.md`, `design.md`, and generated code. Do not deviate without a logged entry in `DECISIONS.md`.

- **Authentication is Phone Number (OTP) only — no email/password, no Google Sign-In.** On first login, create a `users/{uid}` document with `role: 'resident'` by default. Never allow users to self-assign `role: 'official'` or `role: 'tanod'` — these are set manually in Firestore by the admin. During development, use Firebase test phone numbers to avoid hitting the 10 SMS/day free-tier limit.
- **Notifications use Expo Push API — no Cloud Functions, no FCM topic, no Blaze plan.** On login, each official/tanod device registers an Expo push token stored in `users/{uid}.expoPushToken`. When a resident submits an alert, the app sends push notifications to all tokens belonging to users with `role == 'official'` or `role == 'tanod'` via the Expo Push API. All official/tanod devices are peers — none is "primary" or acts as a relay.
- **Only a user with `role == 'official'` may write `status: 'verified'` to any incident document.** Tanods and residents are explicitly forbidden from this write.
- **This role check MUST be enforced in `firestore.rules`, not only in UI logic.** A UI-only check passes a demo but fails a security evaluation. The Firestore rules are the real security boundary.
- **The app will not queue emergency reports offline.** If the device has no internet connection at the moment the resident taps the alert button, display a clear error prompt: *"No connection. Move to an area with signal and try again."* No silent queueing, no background retry, no optimistic submission.

---

## Firestore Data Model (decided in Phase 3)
```
users/{uid}
  - role: 'resident' | 'official' | 'tanod'
  - displayName: string
  - phoneNumber: string        ← from Firebase Auth, stored on first login
  - createdAt: Timestamp
  - expoPushToken?: string     ← stored on login for officials/tanods; used for fan-out

incidents/{id}
  - status: 'unverified' | 'verified' | 'resolved'
  - reportedAt: Timestamp
  - reportedBy: string (uid)
  - location: GeoPoint
  - description?: string
  - verifiedBy?: string (uid)
  - verifiedAt?: Timestamp
  - resolvedAt?: Timestamp
```

---

## Key Security Rules (decided in Phase 3)
- Any authenticated user can read their own `users/{uid}` document
- Any authenticated `official` or `tanod` can read all `incidents`
- Any authenticated `resident` can create an incident (only for themselves — `reportedBy == request.auth.uid`)
- Only `role == 'official'` can update `status` to `'verified'` — enforced in `firestore.rules`
- Verify transition must use a Firestore transaction checking `status == 'unverified'` before writing
