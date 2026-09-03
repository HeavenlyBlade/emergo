# DECISIONS.md
A running log of architectural decisions made during development. Reference this in Chapter 4 (Results) of your thesis when explaining choices to your panel.

---

## 2026 — Offline Behavior (Module 2: Emergency Alert)
**Decision:** Option B — Block with error. No offline queueing.
**Rationale:** Silent delayed delivery of emergency alerts is a safety risk for a barangay-scale pilot. A clear error prompt is safer, simpler to build, and easier to explain to the panel than a background retry system.
**Impact:** Module 2 `design.md` must specify the error state. Figma wireframes must include the offline error screen.

---

## 2026 — Notification Architecture (Module 5: Notification Fan-Out)
**Decision:** Expo Push Notifications (`expo-notifications`) instead of Firebase Cloud Messaging (FCM) + Cloud Functions.
**Rationale:** Firebase Cloud Functions requires the Blaze (pay-as-you-go) plan. To avoid the cost during the capstone development phase, Expo Push API is used — it is free, requires no server, and delivers to both Android and iOS.
**How it works:**
- On login, each official/tanod device registers an Expo push token via `expo-notifications` and stores it in `users/{uid}.expoPushToken` in Firestore
- When a resident submits an emergency alert, the mobile app queries Firestore for all users with `role == 'official'` or `role == 'tanod'`, collects their push tokens, and sends a batch push request to the Expo Push API (`https://exp.host/--/api/v2/push/send`)
- All official/tanod devices receive the notification as peers — none is primary
**Impact:**
- `functions/` folder in the monorepo is not needed and can be removed
- Firebase free Spark plan is sufficient for the entire project
- Module 5 `requirements.md` and `design.md` must describe the Expo Push flow, not an FCM topic
- `users` Firestore schema includes `expoPushToken?: string`

---

<!-- Add new entries below as decisions are made during development -->

## 2026 — Authentication Provider (Module 1: Authentication & Role-Based Accounts)
**Decision:** Firebase Phone Number Authentication (OTP via SMS) for all user roles — residents, officials, and tanods.
**Rationale:** The target users are barangay residents in a local area who are not tech-savvy. Phone number login removes the need to remember a password or have a dedicated email account. Everyone knows their phone number. The login flow is: enter number → receive SMS code → enter 6 digits → done.
**How role assignment works:**
- After a user's phone number is verified for the first time, a `users/{uid}` document is created in Firestore with `role: 'resident'` by default
- Officials and tanods have their `role` set manually in Firestore by the developer/admin before the pilot begins — they never self-assign a privileged role
**Constraints:**
- Firebase Phone Auth on the free Spark plan is limited to 10 SMS verifications per day — sufficient for a ~35-person pilot as long as registrations are spread across days
- Do not run SMS-heavy stress tests during development — use Firebase's built-in test phone numbers feature instead (console → Authentication → Sign-in method → Phone → Test phone numbers)
- Phone auth requires a real physical device for testing — the OTP flow does not work in simulators
