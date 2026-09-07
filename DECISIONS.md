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

## 2026 — Authentication Provider Change: Firebase Auth → Custom OTP via SMS API PH
**Decision:** Build a custom OTP system using SMS API PH (smsapiph) instead of Firebase Phone Auth.
**Rationale:** Firebase Phone Auth requires Blaze (paid) plan for real SMS delivery. SMS API PH is a free Philippine SMS API that doesn't require billing.
**Architecture:**
- OTP codes are generated in the app, stored in Firestore `otp_codes/{phoneNumber}` with 10-minute expiry
- SMS is sent via `https://smsapiph.onrender.com/api/v1/send/sms` with `x-api-key` header
- On verification, code is matched and deleted (single-use)
- User session is persisted in AsyncStorage (uid = normalized phone number)
- Firestore `users/{uid}` document is created on first login with `role: 'resident'`
**Risk logged:** SMS API PH is a third-party free service with no SLA. If it goes down during the pilot, SMS delivery will fail. Mitigation: test thoroughly before pilot, have a backup plan (Firebase test numbers).
**Files changed:** `authService.ts`, `otpService.ts`, `smsService.ts`, `useAuth.ts`, all auth screens, `RootNavigator.tsx`
**Packages removed:** `@react-native-firebase/app`, `@react-native-firebase/auth`
**Decision:** Replace Firebase Phone Auth with Supabase Phone Auth for OTP delivery.
**Rationale:** Firebase Phone Auth (real SMS) requires the Blaze pay-as-you-go plan even for development. Supabase free tier includes phone OTP via their own Twilio account at no cost. No billing upgrade needed.
**What changes:**
- `authService.ts` — rewritten to use Supabase Auth
- `firebase.ts` — Auth removed, only Firestore (JS SDK) remains
- `useAuth.ts` — updated to use Supabase auth state listener
- `@react-native-firebase/auth` — can be removed
- Supabase JS client (`@supabase/supabase-js`) added
**What stays the same:**
- Firestore remains the database for `users` and `incidents` collections
- All screens, navigation, and Firestore logic unchanged
- Role assignment flow unchanged (resident by default, officials/tanods set manually)
**Note:** Supabase Auth handles the OTP session. After OTP confirmation, we still create/read the `users/{uid}` document in Firestore using the Supabase user's `id` as the document key.


**Repo:** https://github.com/HeavenlyBlade/resqhub-quake-watch
**When to use:** When building Module 7 (Barangay Official & Tanod Dashboard — List & Detail Panel)
**What to adapt (two things only):**

1. **Real-time subscription pattern** from `src/pages/Dashboard.tsx`:
   - The pattern of subscribing to new items, prepending them to state, showing a toast, and cleaning up on unmount is directly applicable.
   - In Emergo, replace Supabase's `channel.on('postgres_changes')` with Firestore's `onSnapshot` on the `incidents` collection.
   - Reference lines: the `useEffect` block starting with `const channel = supabase.channel(...)`.

2. **`formatTime` utility** from `src/pages/Dashboard.tsx`:
   - Shows relative time ("5m ago", "2h ago", "3d ago") — copy and adapt this directly for the incident list timestamp display.

**What NOT to use:** Auth (email/password + Supabase), data model (earthquake fields), UI library (shadcn/ui), or folder structure (flat, Lovable-generated). Different stack, different domain.

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
