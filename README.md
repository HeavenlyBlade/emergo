# Emergo
**Mobile Emergency Response Application — Barangay Marketview, Lucena City**

A capstone thesis project built with Expo (React Native), React (Vite), and Firebase.

---

## Monorepo Structure

```
emergo/
├── mobile/       # Expo/React Native app (residents, officials, tanods)
├── dashboard/    # React + Vite web dashboard (officials and tanods)
├── DECISIONS.md  # Architectural decision log
└── README.md
```

## Stack
- **Mobile:** Expo SDK, React Native, TypeScript, Firebase SDK, Expo Push Notifications
- **Dashboard:** React, Vite, TypeScript, Tailwind CSS, Google Maps JS API
- **Backend:** Firebase Authentication, Cloud Firestore (free Spark plan — no Cloud Functions needed)
- **Notifications:** Expo Push API (free, no server required)
- **Build:** Expo EAS Build (mobile), Firebase Hosting (dashboard)

## Getting Started
See `EMERGO_Development_Plan.md` for the full phased build plan and step-by-step guidance.
