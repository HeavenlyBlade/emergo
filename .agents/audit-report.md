# Emergo — Full Technical Audit & Risk Prediction

**Scope:** `C:\Users\Asus\Desktop\Emergo` (mobile Expo/React Native app + React/Vite dashboard + Firebase Firestore), read-only audit. No code was modified; the dashboard linter was run for evidence only.
**Date of audit:** snapshot at commit `cf13d95` ("Regenerate package-lock.json to match updated SDK 57 package versions").

---

## Summary Answer

Emergo is a well-organized, cleanly written capstone project (emergency-response app for Barangay Marketview, Lucena City), and a prior audit pass already fixed many surface issues (commit `391cc9c`: "Full audit fixes — C1-C6, W1-W11…"). However, **the audit uncovered a cluster of serious security problems concentrated in one root cause: the project's entire security model depends on Firestore security rules that do not exist in the repository.** The dev plan and code comments repeatedly state the role check "MUST be enforced in `firestore.rules`, not only in UI logic," but no rules file is versioned, `firebase.json` does not deploy any, and no rules file exists anywhere in the tree. Combined with **client-side authentication that can be bypassed without a password** and **SMS-gateway credentials baked into the client bundles**, the current state should be treated as **unsafe to pilot with real residents until the items below are addressed.** There are also smaller quality, reliability, and documentation-drift issues worth fixing.

**Severity overview:** 5 Critical · 4 High · 9 Medium · 9 Low. Details with file/symbol citations below.

---

## Critical Findings

### C1 — No Firestore security rules exist; the entire RBAC is unenforceable
**Evidence:**
- `dashboard/firebase.json` contains only a `hosting` block — no `firestore.rules` key, no `storage.rules`.
- A recursive search of the whole repo for `*.rules` / `firestore.rules` / `storage.rules` returns **nothing**.
- Code repeatedly defers to rules that aren't there:
  - `mobile/src/services/incidentService.ts` and `dashboard/src/services/incidentService.ts` both document "Firestore security rules are the final gate — this is defense-in-depth," and gate writes only with a client-side `assertOfficial(uid)`.
  - `dashboard/src/components/IncidentDetailPanel.tsx` comment: "Role gate … Enforced here AND in Firestore rules."
  - `mobile/src/services/otpService.ts` security note: "Firestore security rules must restrict `otp_codes` to server-side only (or at minimum: only the matching phone number can read its own code)."
- `EMERGO_Development_Plan.md` §5 lists "Firestore schema + security rules implementation — including the officials-only verify rule" as a planned deliverable and the system-wide invariants state "This role check MUST be enforced in `firestore.rules`, not only in UI logic." That deliverable was not implemented.

**Impact:** Both clients (`mobile/src/services/firebase.ts`, `dashboard/src/services/firebase.ts`) embed the public Firebase config (`apiKey`/`projectId`/`appId`). Anyone who downloads the APK or visits the dashboard can initialize the Firestore JS SDK and, if the console rules are permissive (the default "test mode" is `allow read, write: if true`), read/write **any** document: read all `users` (including `passwordHash` and phone numbers), create incidents as any resident, set `status: 'verified'`/`'resolved'` as any official, and assign themselves `role: 'official'`. The project's single most security-sensitive requirement is unmet.

**Recommendation:** Author a `firestore.rules` file, wire it into `firebase.json` (`"firestore": { "rules": "firestore.rules" }`), deploy with `firebase deploy --only firestore:rules`, and lock the console to those rules. At minimum: residents may create only `incidents` where `reportedBy == request.auth.uid`; only `official` may transition `status`; `users` role field is writable only by admin; `otp_codes` is unreadable by clients.

### C2 — SMS Gateway credentials are baked into the client bundles (both apps)
**Evidence:**
- `mobile/.env` defines `EXPO_PUBLIC_SMS_GATEWAY_USER` / `EXPO_PUBLIC_SMS_GATEWAY_PASS` with real Basic-Auth credentials (values redacted here). The `EXPO_PUBLIC_` prefix means Expo inlines them into the shipped JS bundle. `mobile/src/services/smsService.ts` reads them at runtime to build the `Authorization: Basic …` header.
- `dashboard/.env` defines the **same** credentials as `VITE_SMS_GATEWAY_USER` / `VITE_SMS_GATEWAY_PASS`. The `VITE_` prefix inlines them into the browser bundle served to every dashboard visitor — yet **the dashboard does not use SMS at all** (it authenticates with username/password).
- The `.env` files themselves are correctly gitignored and are **not** tracked by git (verified with `git ls-files --error-unmatch`), so the leak is via the built artifacts (APK + hosted JS), not the repo.

**Impact:** Anyone who unpacks the APK or opens the dashboard's served JS can extract the gateway credentials and send arbitrary SMS through the dedicated Android phone/SIM — draining prepaid load or sending spam/abuse, and potentially impersonating Emergo's OTP sender.

**Recommendation:** Move SMS sending server-side (a small Cloud Function, a lightweight serverless endpoint, or restrict the gateway by IP/allow-list and rotate the credentials). At minimum, **remove `VITE_SMS_GATEWAY_*` from the dashboard entirely** since it doesn't send SMS. Rotate the currently-exposed credentials now.

### C3 — Client-side OTP verification is bypassable (no server to hold the secret)
**Evidence:** `mobile/src/services/otpService.ts`
- `generateAndSendOtp` writes the plaintext 6-digit code to `otp_codes/{phone}` via `setDoc`.
- `verifyOtp` reads that same document client-side and compares `data.code !== code`.
- There is no Cloud Function (the project explicitly avoids the Blaze plan — see `DECISIONS.md`).

**Impact:** Because `verifyOtp` must be able to read the doc, Firestore rules must grant the (unauthenticated, pre-login) client read access to its own `otp_codes/{phone}`. A client that can read the document can simply read the `code` field directly and authenticate as **any** phone number without ever receiving the SMS — the SMS becomes a no-op. The "minimum" rule option that `otpService.ts` itself mentions is precisely this bypass.

**Recommendation:** Verify OTPs server-side (Cloud Function that the client cannot read `otp_codes`), or hash the stored code with a per-request nonce so the stored value is unusable directly, and delete codes on read. Combined with C1, locking `otp_codes` to server-only is essential.

### C4 — Dashboard authentication bypass via localStorage (no server-side session)
**Evidence:**
- `dashboard/src/services/authService.ts`: `signInWithCredentials` ends with `localStorage.setItem(SESSION_KEY, uid)` where `SESSION_KEY = 'emergo_dashboard_uid'`.
- `dashboard/src/hooks/useAuth.ts`: on load it calls `getStoredSession()` (just `localStorage.getItem`) and, if a uid is present, runs `onSnapshot(users/{uid})`; if the doc exists it treats the user as authenticated. **There is no re-validation of the password or any token.**
- `dashboard/src/pages/DevLoginPage.tsx` demonstrates the model explicitly: `handleLogin` does `localStorage.setItem(SESSION_KEY, account.uid)` to log in with no credentials at all.
- UIDs are deterministic and guessable: `createOfficialAccount` derives `uid = "user_" + username` (e.g. `user_brgy_captain`).

**Impact:** On the production dashboard site, an attacker opens devtools, sets `localStorage["emergo_dashboard_uid"] = "user_brgy_captain"` (or any known official uid), refreshes, and is authenticated as that official — **no password required.** The `AuthGuard` in `App.tsx` only checks `userDoc.role === 'resident'`, so an official uid passes.

**Recommendation:** Don't trust a bare uid in localStorage. Issue a short-lived signed session token from a server (or use Firebase Auth / Supabase Auth, which the decision log already explored) and validate it server-side; or at minimum re-validate credentials and revoke on mismatch. Make uids non-guessable.

### C5 — Unsalted SHA-256 password hashing, computed and compared client-side
**Evidence:** `dashboard/src/services/authService.ts`
- `hashPassword` = `crypto.subtle.digest('SHA-256', …)` with **no salt**, stored as `passwordHash` in `users/{uid}` (`createOfficialAccount`).
- Login compares `inputHash !== userData.passwordHash` entirely in the browser.

**Impact:** (a) `passwordHash` is readable by the client (it must be, to log in), so it can be cracked offline with rainbow tables — trivially for an unsalted fast hash and common passwords. (b) A modified client can skip the comparison. (c) No lockout/rate-limit on `signInWithCredentials`, enabling online brute force. This is the credentials path that C4 renders moot anyway, but it must be fixed regardless.

**Recommendation:** Hash with a salted slow KDF (bcrypt/argon2) **server-side**, never store or compare hashes in the client. Add login rate-limiting / lockout. (This implies a backend, which the project has been avoiding — see Recommendation R1.)

---

## High Findings

### H1 — Role checks are client-only and bypassable by direct Firestore calls
`assertOfficial(uid)` (`incidentService.ts`, both apps) reads the caller's `users/{uid}.role` in the browser/device and throws if not `official`. Anyone with the public Firebase config can call `runTransaction`/`updateDoc` directly and set `status: 'verified'`, bypassing `assertOfficial`. Only Firestore rules can stop this (see C1). The transactions correctly handle the verify/resolved race, but they are moot protection without rules.

### H2 — Privilege escalation via client-side account creation
`createOfficialAccount` (`dashboard/src/services/authService.ts`) writes a `users` document with `role: 'official'|'tanod'` from the browser. `DevLoginPage.tsx` exposes a `CreateAccountForm` (dev-only, tree-shaken in prod via `import.meta.env.DEV`), but the exported function is callable from the console in any environment. If rules permit client writes of privileged roles (likely under C1), any visitor can self-create an official account.

### H3 — Push-token fan-out from the resident's device exposes all responders' tokens
`mobile/src/services/notificationService.ts` `notifyOfficialsAndTanods` queries `users where role in ['official','tanod']` and reads every `expoPushToken`, then POSTs to the Expo Push API from the resident's phone. Any resident (or anyone with the config) can harvest all officials'/tanods' push tokens and spam them or infer responder activity. Push should originate server-side; tokens should not be readable by residents.

### H4 — No rate limiting / abuse controls anywhere
- OTP: 6-digit code, 10-min window, no attempt counter or lockout (`otpService.ts` `verifyOtp`). Online brute force is feasible.
- Login: no throttling (`authService.ts`).
- Alerts: `submitEmergencyAlert` (`incidentService.ts`) has no per-user frequency cap; a resident can fire unlimited alerts, each fanning out high-priority pushes to every official — an amplification/DoS of the responder channel. `AlertScreen.tsx` even warns about false alerts but enforces nothing.

---

## Medium Findings

### M1 — Zero automated tests
Recursive search found no `*.test.*` / `*.spec.*` files in either project; neither `package.json` has a `test` script. For a safety-critical emergency app, the absence of any unit/integration test is a significant quality gap.

### M2 — No CI/CD pipeline
No `.github/workflows`, no GitLab/other CI config, no automated deploy. `firebase.json` exists for hosting but deploys are manual. Lint/typecheck/test never run automatically on push.

### M3 — Mobile app is not linted
`mobile/package.json` has no `lint` script and there is no eslint/oxlint config in `mobile/`. The dashboard uses oxlint but with a minimal ruleset (only `react/rules-of-hooks` error + `react/only-export-components` warn — `dashboard/.oxlintrc.json`); no security or best-practices rules are enabled.

### M4 — Dashboard TypeScript `strict` is off
`dashboard/tsconfig.app.json` sets `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` but **not** `strict` (no `strictNullChecks`, no `noImplicitAny`). The mobile app sets `"strict": true` (`mobile/tsconfig.json`). Inconsistent and risky for the dashboard where null/undefined bugs in incident/status handling could cause silent failures.

### M5 — ~68 MB of video committed to git and served on the login page
`dashboard/public/bg-1.mp4` (23.5 MB), `bg-2.mp4` (33.0 MB), `bg-3.mp4` (11.9 MB) are tracked by git (confirmed in `git ls-files`) and duplicated untracked in `source/`. They bloat the repo (slow clones, large diffs) and are served as login-page backgrounds — heavy on mobile data and slow to load. Recommend hosting externally / compressing / lazy-loading.

### M6 — No GPS acquisition timeout
`mobile/src/services/locationService.ts` `getCurrentLocation` calls `Location.getCurrentPositionAsync({ accuracy: High })` with no timeout. If GPS never locks (indoor/weak signal), the alert submission in `AlertScreen.tsx` hangs indefinitely on the spinner with no error — a reliability gap for the core emergency action. The offline guard is `NetInfo.isConnected`, which says nothing about GPS.

### M7 — `NetInfo.isConnected` can be true with no internet
`incidentService.ts` `submitEmergencyAlert` blocks only when `!netState.isConnected`. `isConnected` can be `true` while `isInternetReachable` is `false` (captive portal / dead Wi-Fi), so a tap can pass the guard then fail at the Firestore write. Minor, but worth using `isInternetReachable` for the emergency path.

### M8 — Admin/Records page and CSV export expose PII and lack role scoping
`dashboard/src/pages/AdminPage.tsx` `/admin` is reachable by both `official` and `tanod` (the `AuthGuard` in `App.tsx` only rejects `resident`). The CSV export writes full `reportedBy` and `verifiedBy` — and `reportedBy` is a **phone-number uid** (see `mobile/src/services/authService.ts` `confirmOtp`), so the export contains raw reporter phone numbers in plaintext. The on-screen table masks with `.slice(-8)`, but the export does not.

### M9 — Unbounded real-time query loads all incidents
`dashboard/src/hooks/useIncidents.ts` and `mobile/src/services/incidentService.ts` `subscribeToMyIncidents` subscribe with `orderBy('reportedAt','desc')` and no `limit`. Fine for a 35-person pilot, but as the incidents collection grows every client pulls the entire history into memory. Add a `limit()` and paginate for scale.

---

## Low Findings

### L1 — `DECISIONS.md` contains conflicting, overlapping auth decisions
The file records at least four different auth approaches without a clear "current" resolution: Android SMS Gateway → "Replace Firebase Phone Auth with Supabase Phone Auth" → later "Firebase Phone Number Authentication (OTP via SMS)"; meanwhile the dashboard actually uses username/password (commit `22f1cd0`). The reader cannot tell which is canonical. Consolidate into one "Current state" section.

### L2 — `EMERGO_Development_Plan.md` is stale relative to the implementation
The plan still says "Authentication is Phone Number (OTP) only — no email/password," mandates a Firestore rules deliverable, and specifies "Google Maps JS API" for Module 6. The dashboard uses password auth, no rules were shipped, and the map uses Leaflet/OSM (`DECISIONS.md`, `MapPage.tsx`). Update the plan or add a "Current state supersedes sections X/Y" note.

### L3 — README structure is out of date
`README.md` lists only `mobile/`, `dashboard/`, `DECISIONS.md`, `README.md`. The repo also contains `source/` (videos) and an empty `functions/` folder. `DECISIONS.md` says "`functions/` folder … can be removed," but it still exists.

### L4 — Dead/empty `functions/` directory
Per `DECISIONS.md` (Notification Architecture), Cloud Functions are intentionally not used. The empty `functions/` folder remains and is misleading. Remove it or add a `.gitkeep` with a note.

### L5 — Corrupted comment characters (oxlint `no-irregular-whitespace` warnings)
Running `npx oxlint src` in the dashboard flags 6 warnings: irregular-whitespace in comment headers of `IncidentsPage.tsx`, `IncidentDetailPanel.tsx` (×2), `Sidebar.tsx`, `MapPage.tsx` (×2). Comments read e.g. "MapPage  EModule 6" and "Open in Google Maps ↁE" where "— Module" and "→" were intended — an em-dash/arrow encoding artifact. Cosmetic but sloppy.

### L6 — Duplicated shared types across two projects
`mobile/src/types/index.ts` and `dashboard/src/types/index.ts` are hand-synced ("keep in sync with dashboard/src/types/"). Drift is likely; consider a shared package or generated types from the Firestore schema.

### L7 — Stale comments referencing Firebase Auth
`mobile/src/types/index.ts` `UserDocument.phoneNumber` is commented "from Firebase Auth, stored on first login," but Firebase Auth is not used (custom OTP / dashboard password). `mobile/src/services/authService.ts` header still says "Custom Phone Auth using SMS API PH + Firestore" while `DECISIONS.md` flip-flopped to Supabase/Firebase. Update comments to match reality.

### L8 — TanodScreen pull-to-refresh is a no-op
`mobile/src/screens/TanodScreen.tsx` `RefreshControl` `onRefresh={() => setFilter(filter)}` sets the same value (React bails out) while data is already real-time via `onSnapshot`. Misleading UX — refresh appears to do nothing. Remove it or wire it to a real refetch.

### L9 — Fragile EAS build workflow (Windows path-length copy)
`DECISIONS.md` documents building from `C:\emergo\mobile` (not the repo) to dodge the Windows 260-char `node_modules` path limit, via a manual `Copy-Item -Exclude node_modules` sync. This risks building stale code if the copy is forgotten, and splits "source of truth" from "build source." Consider enabling long paths (`LongPathsEnabled`) or moving the repo shallower to remove the manual copy.

---

## Positive Findings (to retain)

- Secrets are correctly gitignored and **not tracked**: `.env` (both apps) and `google-services.json` are excluded and verified absent from `git ls-files`. The `.gitignore` is thorough (keys, `.p8`, `.p12`, `.mobileprovision`, `GoogleService-Info.plist`).
- No genuine `TODO`/`FIXME`/`HACK`/`@ts-ignore` markers in source (the only matches were false positives in `package-lock.json` hashes).
- Dashboard passes `oxlint` with only cosmetic warnings — no lint errors.
- Good use of Firestore **transactions** for verify/resolve race safety (`incidentService.ts`, both apps) and correct status state-machine guards.
- Cryptographically secure OTP generation via `crypto.getRandomValues` (`otpService.ts`).
- Clean module separation (services / hooks / screens / types), consistent patterns, and thorough doc comments.
- Leaflet/OSM avoids Google Maps billing, matching the decision log; Option B offline behavior is implemented as designed (block with a clear error).
- Per-FEAT/dev discipline is visible (steering files, decision log, prior audit-fix commit).

---

## Predicted Future Problems (if unresolved)

1. **First real abuse incident:** because rules are absent (C1) and push tokens are client-readable (H3), a single motivated user (or an outsider with the public config) can spam all responders, spoof incidents, or self-promote to official — likely during the pilot itself.
2. **Credential drain:** exposed SMS-gateway creds (C2) will be extracted from the APK/bundle; prepaid load disappears or the gateway is used for unrelated spam, traced back to the project.
3. **Authentication bypass discovered by a panelist/student:** the localStorage-uid bypass (C4) is trivial and discoverable in minutes; for a thesis defense this is high-reputation risk.
4. **OTP complaints:** "I never got an SMS but I'm logged in" / "someone logged in as me" once the client-reads-its-own-code path (C3) is exercised.
5. **Scaling pain:** unbounded incident queries (M9) and 68 MB login videos (M5) will make the dashboard sluggish as records accumulate, and clones/deploys slow.
6. **Silent GPS hang:** a resident indoors hits "Send," the spinner never resolves (M6), and they assume the alert went through — a safety failure in an emergency app.

---

## Conclusions & Recommendations (implement nothing — recommendations only)

**R1 (highest priority) — Introduce a thin server-side trust boundary.** The root cause of C1–C5 and H1–H3 is that Emergo has no trusted execution context; every secret and every authorization decision lives in client-bundle code that is public. Options, in order of effort:
- *Minimal:* Author and deploy `firestore.rules` (fixes C1, H1, partially H2) and lock `otp_codes` to server-only + add a single Cloud Function for OTP verify and SMS send (fixes C2, C3). Even one Cloud Function requires leaving the free Spark plan (Blaze), which the project has avoided — but the free plan cannot make this app safe.
- *Better:* Use Firebase Auth (or Supabase Auth, already explored in `DECISIONS.md`) for real signed sessions, replacing the localStorage/AsyncStorage uid (fixes C4, C5) and enabling `request.auth.uid`-based rules. Send OTP/SMS and push fan-out from Cloud Functions/secure endpoints (fixes C2, C3, H3).

**R2 — Rotate the exposed SMS-gateway credentials immediately** and remove `VITE_SMS_GATEWAY_*` from the dashboard (C2). They are already in shipped artifacts.

**R3 — Add rate limiting / abuse controls:** OTP attempt caps + lockout, login throttling, per-user alert frequency cap with backoff (H4).

**R4 — Add a GPS acquisition timeout** with a clear error in `getCurrentLocation` (M6); use `isInternetReachable` in the offline guard (M7).

**R5 — Add tests and CI:** a `vitest` setup for service-layer logic (OTP verify, status transitions, role gates) and a GitHub Actions workflow running `oxlint` + `tsc --noEmit` + tests on push (M1, M2). Enable `strict` in the dashboard `tsconfig.app.json` (M4) and add a lint script + config to mobile (M3).

**R6 — Fix documentation drift:** consolidate `DECISIONS.md` auth entries (L1), update `EMERGO_Development_Plan.md` to reflect Leaflet/OSM, password-auth dashboard, and the rules gap (L2), and correct the README structure (L3).

**R7 — Repo hygiene:** move the 68 MB of videos out of git (Git LFS or external hosting) and compress/served lazy (M5); remove the empty `functions/` dir (L4); fix the corrupted comment characters (L5); consolidate shared types (L6); remove the no-op pull-to-refresh (L8); remove the manual `C:\emergo\mobile` copy step if feasible (L9).

**Verdict:** Issues were found — the project is not clean. The code quality is good, but the security architecture is unsound for an emergency-response system because its central safeguard (Firestore rules) is absent and its auth/secrets are client-side. Fix R1–R3 before any pilot with real residents.
