# Emergo Dashboard — Project Steering

> **Monorepo note:** This is the web dashboard (`/dashboard`) inside the `emergo` monorepo.
> See also: `/mobile/.kiro/steering/project.md` for mobile-side conventions.
> The System-Wide Invariants section below is identical in both steering files — any change must be made in both.

---

## Project Overview
Emergo Dashboard is the web interface for Barangay Marketview officials and tanods. It displays a live map of incidents, a filterable incident list, and allows officials to verify and resolve reports. It connects to the same Firebase project as the mobile app.

---

## Tech Stack
- **Framework:** React + TypeScript (Vite)
- **Authentication:** Firebase Phone Number Authentication (OTP via SMS) — same provider as the mobile app. Dashboard users (officials/tanods) log in with their phone number. Role is read from `users/{uid}.role` in Firestore after auth. The dashboard never allows role self-assignment.
- **Maps:** Google Maps JavaScript API (`@vis.gl/react-google-maps`) — NOT the mobile SDK
- **Backend:** Firebase (Authentication, Cloud Firestore — same project as mobile app)
- **Styling:** Tailwind CSS
- **State:** React context + custom hooks (no external state library unless complexity demands it)
- **Note:** The dashboard does not send or receive push notifications — that is handled entirely by the mobile app via Expo Push API. The dashboard receives incident updates through Firestore real-time listeners only.

---

## Folder Conventions
```
dashboard/
├── src/
│   ├── pages/          # Page-level components (one file per route)
│   ├── components/     # Reusable UI components
│   ├── services/       # All Firebase calls and business logic (NO Firebase calls inside components)
│   ├── hooks/          # Custom React hooks (especially Firestore real-time listeners)
│   ├── types/          # Shared TypeScript types — must match mobile's Firestore shapes exactly
│   └── utils/          # Pure utility functions (no side effects)
├── public/             # Static assets
└── index.html
```

---

## Naming Conventions
- Components and pages: `PascalCase` (e.g. `IncidentCard.tsx`, `MapPage.tsx`)
- Hooks: `camelCase` prefixed with `use` (e.g. `useIncidents.ts`, `useLiveMap.ts`)
- Services: `camelCase` suffixed with `Service` (e.g. `incidentService.ts`)
- Files: `camelCase` unless they export a component (then `PascalCase`)
- Firestore collections: `camelCase` plural — must match mobile exactly (`incidents`, `users`)
- Firestore document fields: `camelCase` — must match mobile exactly

---

## TypeScript Rules
- Strict mode enabled — no `any` types
- All Firestore document shapes must have a corresponding TypeScript interface in `src/types/`
- These interfaces must be kept in sync with `mobile/src/types/` — they describe the same documents
- Firebase SDK imports from `firebase/firestore`, `firebase/auth` — never from the compat layer

---

## Maps Rules
- Use Google Maps **JavaScript API** for the dashboard (`@vis.gl/react-google-maps` or `@react-google-maps/api`)
- Do NOT use the React Native Maps or mobile SDK — those are for the Expo app only
- Map pins must visually distinguish incident status:
  - `unverified` → pulsing outline marker
  - `verified` → solid filled marker
  - `resolved` → grayed-out marker
- The map must update in real time via a Firestore `onSnapshot` listener — no manual refresh

---

## System-Wide Invariants (enforce in every spec)
> These rules apply across the entire Emergo system. They must be reflected in every `requirements.md`, `design.md`, and generated code. Do not deviate without a logged entry in `DECISIONS.md`.

- **Authentication is Phone Number (OTP) only — no email/password, no Google Sign-In.** On first login, a `users/{uid}` document is created with `role: 'resident'` by default. Officials and tanods have their role set manually in Firestore by the admin before the pilot. Never allow users to self-assign `role: 'official'` or `role: 'tanod'`.
- **Notifications use Expo Push API — no Cloud Functions, no FCM topic, no Blaze plan.** On login, each official/tanod device registers an Expo push token stored in `users/{uid}.expoPushToken`. When a resident submits an alert, the mobile app sends push notifications to all tokens belonging to users with `role == 'official'` or `role == 'tanod'` via the Expo Push API. The dashboard has no role in this flow — it receives incident updates via Firestore listeners only. All official/tanod devices are peers — none is "primary" or acts as a relay.
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
  - expoPushToken?: string     ← stored on login for officials/tanods; used for fan-out by mobile app

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
