# Emergo
**Mobile Emergency Response Application — Barangay Marketview, Lucena City**

A capstone thesis project built with Expo (React Native), React (Vite), and Firebase.

---

## Monorepo Structure

```
emergo/
├── mobile/       # Expo/React Native app (residents, officials, tanods)
├── dashboard/    # React + Vite web dashboard (officials and tanods)
├── source/       # Raw video assets for dashboard login background (not in git LFS — see M5)
├── firestore.rules  # Firestore security rules (deploy with: firebase deploy --only firestore:rules)
├── DECISIONS.md  # Architectural decision log
└── README.md
```

Note: `functions/` is intentionally absent. Cloud Functions are not used (Spark plan). See DECISIONS.md.

## Stack
- **Mobile:** Expo SDK, React Native, TypeScript, Firebase SDK, Expo Push Notifications
- **Dashboard:** React, Vite, TypeScript, Tailwind CSS, Google Maps JS API
- **Backend:** Firebase Authentication, Cloud Firestore (free Spark plan — no Cloud Functions needed)
- **Notifications:** Expo Push API (free, no server required)
- **Build:** Expo EAS Build (mobile), Firebase Hosting (dashboard)

## Getting Started
See `EMERGO_Development_Plan.md` for the full phased build plan and step-by-step guidance.
